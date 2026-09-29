/**
 * Gate de la UI del chat — `RF-50..58`, `DEC-01.f`.
 *
 * Por que un gate de navegador y no una comprobacion sobre el HTML: casi todo lo que promete la
 * interfaz es comportamiento —abre, cierra con `Esc`, pinta la respuesta, navega al pulsar una
 * cita, borra el historial— y nada de eso se ve en el markup. Un `grep` sobre `dist/` daria por
 * buenos estados que la persona no llega a ver.
 *
 * El endpoint se intercepta: el gate no llama al modelo. Lo que se comprueba es la **interfaz**,
 * y para eso la respuesta tiene que ser determinista. G1–G4 ya tienen su gate en `pnpm gate:chat`,
 * que corre en Node sin Chromium.
 *
 * Une las condiciones de `gate-saturation.mjs`: sirve el sitio construido y lo abre en Chromium.
 */

import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { chromium } from 'playwright'
import { staticDir } from './lib/static.mjs'

const DIST = staticDir()
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

const problems = []
let checks = 0

function check(id, cond, msg) {
  checks += 1
  if (cond) {
    console.log(`  OK   ${id.padEnd(8)} ${msg}`)
  } else {
    problems.push(`  FALLA ${id.padEnd(8)} ${msg}`)
    console.log(`  FALLA ${id.padEnd(8)} ${msg}`)
  }
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('\n  GATE RF-51..58 — falta dist/index.html. ¿Se ejecuto `pnpm build`?\n')
  process.exit(1)
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
      let filePath = join(DIST, normalize(urlPath))
      if (urlPath.endsWith('/')) filePath = join(filePath, 'index.html')
      if (!existsSync(filePath)) filePath = join(DIST, 'index.html')
      try {
        const body = await readFile(filePath)
        res.writeHead(200, {
          'content-type': TYPES[extname(filePath)] ?? 'application/octet-stream',
        })
        res.end(body)
      } catch {
        res.writeHead(404)
        res.end('not found')
      }
    })
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })
    })
  })
}

const { server, origin } = await startServer()
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const apaRespuesta = (cuerpo) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(cuerpo),
})

try {
  await page.goto(origin, { waitUntil: 'load' })

  // 1. `RF-51`: no modal al cargar; el panel se abre bajo interaccion.
  const cerradoAlCargar = await page.locator('[data-chat-panel]').evaluate((d) => !d.open)
  check('RF-51', cerradoAlCargar, 'el panel no puede estar abierto al cargar')
  check(
    'RF-51',
    (await page.locator('[data-chat-open]').count()) === 1,
    'tiene que haber un teaser para abrirlo',
  )

  // 2. `RF-57`: la declaracion de datos esta ANTES de la primera pregunta y no escondida.
  const avisoVisible = await page.locator('[data-chat-panel] details[open]').count()
  check('RF-57', avisoVisible >= 1, 'la declaracion de datos debe ir en un details abierto')

  // 3. `RF-53`: 3-4 preguntas sugeridas.
  const nSugerencias = await page.locator('[data-chat-suggestion]').count()
  check('RF-53', nSugerencias >= 3 && nSugerencias <= 4, `${nSugerencias} sugeridas (se piden 3-4)`)

  // 3 bis. `RF-51`/`RUI-36`: la burbuja va FIJA. Si vuelve a una escena, se ve al final y no
  // antes; se comprueba en la parte de arriba de la pagina y despues de bajar.
  const enViewport = () =>
    page.locator('[data-chat-open]').evaluate((el) => {
      const r = el.getBoundingClientRect()
      return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth
    })
  const arriba = await enViewport()
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(120)
  const abajo = await enViewport()
  check(
    'RF-51',
    arriba && abajo,
    `la burbuja debe verse fija en todo el scroll (arriba=${arriba}, abajo=${abajo})`,
  )
  await page.evaluate(() => window.scrollTo(0, 0))

  await page.locator('[data-chat-open]').click()
  check(
    'RF-51',
    await page.locator('[data-chat-panel]').evaluate((d) => d.open),
    'el clic en el teaser abre el panel',
  )

  // 4. `RF-50`: `Esc` cierra. El cierre se anima, asi que se espera al ESTADO FINAL, no al
  // instante siguiente al teclazo: comprobar el instante mediria la animacion, no el cierre.
  await page.keyboard.press('Escape')
  const cerro = await page
    .waitForFunction(() => !document.querySelector('[data-chat-panel]')?.open, undefined, {
      timeout: 2000,
    })
    .then(() => true)
    .catch(() => false)
  check('RF-50', cerro, '`Esc` debe cerrar el panel')

  // 5. `RF-56`: el historial empieza vacio; tras preguntar hay un turno; recargar lo vacia.
  await page.route('**/api/chat', (route) =>
    route.fulfill(
      apaRespuesta({
        ok: true,
        answer: 'Usa Go y Kubernetes.',
        citations: ['stack'],
        degraded: false,
        warnings: [],
      }),
    ),
  )
  await page.locator('[data-chat-open]').click()
  await page.locator('[data-chat-input]').fill('¿Qué tecnologías usa?')
  await page.locator('[data-chat-send]').click()
  // Se espera a la CITA, no al primer turno: el turno de la pregunta se pinta de inmediato y
  // esperar a ese hacia que el gate contara antes de que llegara la respuesta.
  const cita = page.locator('.chat__cita').first()
  await cita.waitFor({ timeout: 5000 })
  const turnos = await page.locator('[data-chat-log] .chat__turno').count()
  check('RF-56', turnos === 2, `tras preguntar deberia haber pregunta y respuesta, hay ${turnos}`)

  // 6. `RF-52`: la cita se pinta y lleva a la escena, enfocando el heading.
  check('RF-52', (await cita.count()) === 1, 'la respuesta con cita debe pintar el enlace de cita')
  await cita.click()
  // El foco llega despues de cerrar el panel (mientras es modal, el resto es inerte). Se espera
  // al estado final en vez de leer de inmediato.
  const enfoco = await page
    .waitForFunction(() => document.activeElement?.id.endsWith('-titulo') ?? false, undefined, {
      timeout: 3000,
    })
    .then(() => true)
    .catch(() => false)
  const focoId = await page.evaluate(() => document.activeElement?.id ?? '')
  check('RF-52', enfoco, `la cita debe enfocar el heading, enfoco ${focoId}`)

  // 7. `RF-56`: borrar deja el historial limpio.
  await page.locator('[data-chat-open]').click()
  await page.locator('[data-chat-clear]').click()
  const trasBorrar = await page.locator('[data-chat-log] .chat__turno').count()
  check('RF-56', trasBorrar === 0, `borrar debe vaciar el historial, quedan ${trasBorrar}`)
  await page.keyboard.press('Escape')
  await page.reload({ waitUntil: 'load' })
  await page.locator('[data-chat-open]').click()
  const trasRecargar = await page.locator('[data-chat-log] .chat__turno').count()
  check('RF-56', trasRecargar === 0, 'al recargar la sesion debe estar vacia')

  // 8. `RF-54`: si el modelo no esta, se avisa y se ofrece contacto, sin error tecnico.
  await page.unroute('**/api/chat')
  await page.route('**/api/chat', (route) =>
    route.fulfill(
      apaRespuesta({ ok: true, answer: 'Usa Go.', citations: [], degraded: true, warnings: [] }),
    ),
  )
  await page.locator('[data-chat-input]').fill('¿Con qué trabajas?')
  await page.locator('[data-chat-send]').click()
  await page.locator('.chat__aviso').first().waitFor({ timeout: 5000 })
  const aviso = (await page.locator('.chat__aviso').first().textContent()) ?? ''
  check(
    'RF-54',
    aviso.toLowerCase().includes('sin modelo') &&
      (await page.locator('[data-chat-contact]').count()) === 1,
    `la degradacion debe avisarse y ofrecer contacto, dijo "${aviso.trim()}"`,
  )

  // 9. `RF-54`/`DEC-01.f`: la ruta fuera (kill switch) no es un error tecnico para la persona.
  await page.unroute('**/api/chat')
  await page.route('**/api/chat', (route) => route.fulfill({ status: 404, body: 'not found' }))
  await page.locator('[data-chat-input]').fill('¿Dónde estudió?')
  await page.locator('[data-chat-send]').click()
  // El estado ya es visible con "Pensando…": hay que esperar al texto final, no a que se vea.
  await page.waitForFunction(
    () =>
      /no está disponible/i.test(document.querySelector('[data-chat-status]')?.textContent ?? ''),
    undefined,
    { timeout: 5000 },
  )
  const estado = (await page.locator('[data-chat-status]').textContent()) ?? ''
  check(
    'DEC-01.f',
    /no está disponible/i.test(estado) && !/404|error|fetch/i.test(estado),
    `con la ruta apagada se dice sin tecnicismos, dijo "${estado.trim()}"`,
  )
  // 10. Movimiento reducido (`RUI-74`, `RUI-95`): la UI tiene que funcionar igual, y sin esperar
  // animacion. Si el guard de `motion.ts` fallara, `Esc` tardaria ~120 ms en cerrar y el tiempo
  // de aqui lo delataria.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(origin, { waitUntil: 'load' })
  await page.locator('[data-chat-open]').click()
  const abiertoQuieto = await page.locator('[data-chat-panel]').evaluate((d) => d.open)
  await page.keyboard.press('Escape')
  const cerrroQuieto = await page
    .waitForFunction(() => !document.querySelector('[data-chat-panel]')?.open, undefined, {
      timeout: 200,
    })
    .then(() => true)
    .catch(() => false)
  check(
    'RUI-74',
    abiertoQuieto && cerrroQuieto,
    'con movimiento reducido el panel debe abrir y cerrar sin animacion',
  )
} finally {
  await browser.close()
  server.close()
}

console.log('')
if (problems.length > 0) {
  console.error(`  GATE RF-51..58 — ${problems.length} comprobacion(es) fallida(s)\n`)
  for (const p of problems) console.error(p)
  console.error('')
  process.exit(1)
}
console.log(
  `  OK  RF-50..58 · RF-51..53 · DEC-01.f — panel de chat: ${checks}/${checks} en verde\n`,
)
