/**
 * Gate de accesibilidad — `RUI-80` y la parte automatizable de `RUI-81..88`.
 *
 * `RUI-80` pide WCAG 2.2 AA con axe-core en CI, **0 violaciones serious/critical**, y ademas una
 * revision manual de 20 criterios que axe no puede comprobar. Este gate cubre la parte
 * automatica; la manual queda declarada en `TRACEABILITY.md` y no se marca aqui.
 *
 * Se miden los 5 estados de `MEDICION.md` §4.8, no solo la pagina en reposo: la mitad de los
 * fallos de accesibilidad aparecen en estados que no son el inicial (el panel abierto, el video
 * caido, el movimiento reducido).
 *
 * Se falla solo por `serious`/`critical`, que es lo que pide el requisito. `moderate`/`minor` se
 * imprimen como aviso: no bloquean, pero se ven.
 */

import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
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

const BLOQUEANTES = new Set(['serious', 'critical'])
const problems = []

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('\n  GATE RUI-80 — falta dist/index.html. ¿Se ejecuto `pnpm build`?\n')
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

/** Analiza el estado actual y acumula. `nombre` es el estado de MEDICION §4.8. */
async function auditar(page, nombre) {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()

  const graves = resultado.violations.filter((v) => BLOQUEANTES.has(v.impact ?? ''))
  const leves = resultado.violations.filter((v) => !BLOQUEANTES.has(v.impact ?? ''))

  for (const v of graves) {
    problems.push(`${nombre}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} nodo(s))`)
    for (const nodo of v.nodes) {
      problems.push(`      ${nodo.target.join(' ')} — ${nodo.failureSummary?.split('\n')[0] ?? ''}`)
    }
  }
  console.log(
    `  · ${nombre.padEnd(16)} ${resultado.violations.length} violacion(es), ${graves.length} serious/critical`,
  )
  for (const v of leves) {
    console.log(`      aviso [${v.impact}] ${v.id} — ${v.help}`)
  }
}

const { server, origin } = await startServer()
const browser = await chromium.launch()

try {
  // `@axe-core/playwright` exige un contexto explicito; `browser.newPage()` suelto no vale.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(origin, { waitUntil: 'load' })

  // Estado 1: inicio.
  await auditar(page, 'inicio')

  // Estado 2: medio de escena.
  await page.evaluate(() => document.getElementById('escena-02')?.scrollIntoView())
  await page.waitForTimeout(150)
  await auditar(page, 'medio-escena')

  // Estado 3: panel de chat abierto.
  await page.locator('[data-chat-open]').click()
  await page.locator('[data-chat-panel]').evaluate((d) => d.open)
  // El panel entra animado (240 ms). Medir a mitad de la animacion mezcla los colores con el
  // fondo y axe reporta un contraste que no existe cuando el panel esta quieto.
  await page.waitForTimeout(400)
  await auditar(page, 'chat-abierto')
  await page.keyboard.press('Escape')
  await page
    .locator('[data-chat-panel]')
    .evaluate((d) => !d.open)
    .catch(() => undefined)

  // Estado 4: video con movimiento reducido (solo poster).
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(origin, { waitUntil: 'load' })
  await auditar(page, 'reduced-motion')
  await page.emulateMedia({ reducedMotion: null })

  // Estado 5: error de carga de video (se conserva el poster, sin layout shift).
  await page.goto(origin, { waitUntil: 'load' })
  await page.evaluate(() => {
    document.querySelector('video')?.dispatchEvent(new Event('error'))
  })
  await page.waitForTimeout(150)
  await auditar(page, 'video-error')

  // `RUI-85`: reflow a 320 px sin scroll horizontal.
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto(origin, { waitUntil: 'load' })
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  if (desborde > 1) problems.push(`RUI-85: reflow a 320 px con ${desborde} px de scroll horizontal`)
  else console.log('  · RUI-85           reflow 320 px sin scroll horizontal')
} finally {
  await browser.close()
  server.close()
}

console.log('')
if (problems.length > 0) {
  console.error(`  GATE RUI-80/85 — ${problems.length} hallazgo(s)\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}
console.log('  OK  RUI-80 · RUI-85 — axe-core WCAG 2.2 AA: 0 serious/critical en 5 estados\n')
