/**
 * Gate `RF-02..06` y `RF-09` — navegacion solo-teclado, 100 % de los flujos.
 *
 * `MEDICION.md` §4.8 pide "100 % de flujos completables". Este gate sirve `dist/` en un
 * puerto efimero (sin depender de `astro preview`) y conduce la pagina con Playwright:
 *
 *   1. Sin JS (`RF-07`): el contenido y las 7 escenas se leen igual.
 *   2. Skip-link al primer `Tab` (`RF-06`).
 *   3. Teclado entre escenas: End/Home/ArrowDown/PageDown (`RF-05`), con el heading enfocado.
 *   4. El rail marca la escena activa con `aria-current` (`RF-02`, `RUI-34`).
 *   5. Deep-link: la URL refleja la escena (`RF-04`).
 *   6. El clic en el rail mueve el foco al heading (`RF-03`).
 *   7. Toggle de tema persistente (`RF-09`).
 *
 * No forma parte de `pnpm gate` a proposito: descarga/arranca Chromium y el gate rapido de PR
 * no debe pagar ese coste. Se ejecuta como paso propio (`pnpm gate:keyboard`), tambien en CI.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

import { chromium } from 'playwright'
import { staticDir } from './lib/static.mjs'

const DIST = staticDir()
const SCENE_COUNT = 7

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
}

const problems = []
const ok = (label, detail = '') => console.log(`  · ${label}${detail ? ` — ${detail}` : ''}`)
const fail = (label, detail = '') => problems.push(`${label}${detail ? ` — ${detail}` : ''}`)

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('\n  GATE teclado — falta dist/index.html. ¿Se ejecuto `pnpm build`?\n')
  process.exit(1)
}

/** Servidor estatico minimo sobre `dist/`, en un puerto libre. */
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
      const address = server.address()
      resolve({ server, origin: `http://127.0.0.1:${address.port}` })
    })
  })
}

const { server, origin } = await startServer()
const browser = await chromium.launch()

try {
  // --- 1. Sin JS: el contenido se lee entero (`RF-07`, `RNF-101`) ---
  const noJs = await browser.newContext({ javaScriptEnabled: false })
  const noJsPage = await noJs.newPage()
  await noJsPage.goto(origin, { waitUntil: 'domcontentloaded' })
  const sections = await noJsPage.locator('[data-scene]').count()
  const railLinks = await noJsPage.locator('[data-scene-link]').count()
  const h1 = await noJsPage.locator('h1').count()
  if (sections === SCENE_COUNT && railLinks === SCENE_COUNT && h1 === 1) {
    ok('sin JS: 1 h1, 7 escenas y 7 enlaces de rail', 'RF-07')
  } else {
    fail('sin JS', `h1=${h1}, escenas=${sections}, rail=${railLinks}`)
  }
  await noJs.close()

  // --- Flujos con JS ---
  const context = await browser.newContext()
  const page = await context.newPage()
  // `prefers-reduced-motion: reduce` hace el scroll instantaneo (`reset.css`), de modo que el
  // IntersectionObserver se asienta en la escena destino y la asercion es determinista.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(origin, { waitUntil: 'load' })

  const heading = (scene) => `escena-${String(scene).padStart(2, '0')}-titulo`
  const focusedId = () => page.evaluate(() => document.activeElement?.id ?? '')
  const activeRail = () =>
    page.evaluate(
      () =>
        document
          .querySelector('[data-scene-link][aria-current="true"]')
          ?.getAttribute('data-scene-link') ?? null,
    )

  // 2. Skip-link (`RF-06`)
  await page.keyboard.press('Tab')
  const skipFocused = await page.evaluate(
    () => document.activeElement?.classList.contains('skip-link') ?? false,
  )
  if (skipFocused) {
    ok('primer Tab enfoca el skip-link', 'RF-06')
  } else {
    fail('skip-link no enfocado al primer Tab')
  }

  // 3+4+5. Teclado entre escenas, rail activo y hash
  await page.evaluate(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined,
  )
  const flows = [
    ['End', SCENE_COUNT - 1],
    ['Home', 0],
    ['ArrowDown', 1],
    ['PageDown', 2],
    ['ArrowDown', 3],
    ['ArrowUp', 2],
  ]
  for (const [key, scene] of flows) {
    await page.keyboard.press(key)
    await page.waitForFunction((id) => document.activeElement?.id === id, heading(scene), {
      timeout: 2000,
    })
    const rail = await activeRail()
    const hash = await page.evaluate(() => location.hash)
    if (
      rail === `escena-${String(scene).padStart(2, '0')}` &&
      hash === `#escena-${String(scene).padStart(2, '0')}`
    ) {
      ok(`${key} → escena ${String(scene).padStart(2, '0')}`, 'RF-05/RF-02/RF-04')
    } else {
      fail(`${key}`, `foco=${await focusedId()} rail=${rail} hash=${hash}`)
    }
  }

  // 6. Clic en el rail mueve el foco al heading (`RF-03`)
  await page.locator('[data-scene-link="escena-04"]').click()
  await page.waitForFunction((id) => document.activeElement?.id === id, heading(4), {
    timeout: 2000,
  })
  const clickedId = await focusedId()
  if (clickedId === heading(4)) {
    ok('clic en el rail enfoca el heading', 'RF-03')
  } else {
    fail('clic en el rail no enfoca', `foco=${clickedId}`)
  }

  // 7. Toggle de tema persistente (`RF-09`)
  const before = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.locator('[data-theme-toggle]').click()
  const after = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.reload({ waitUntil: 'load' })
  const persisted = await page.evaluate(() => document.documentElement.dataset.theme)
  if (before !== after && persisted === after)
    ok(`tema conmuta (${before}→${after}) y persiste`, 'RF-09')
  else fail('tema', `before=${before} after=${after} persisted=${persisted}`)

  // 8. `RF-13`: la URL del detalle de proyecto es compartible y lo abre.
  const projectId = await page.evaluate(
    () => document.querySelector('details[id^="proyecto-"]')?.id ?? null,
  )
  if (projectId === null) {
    fail('RF-13', 'no hay ningun <details> de proyecto')
  } else {
    // Con `ADR-0010` todos los desplegables nacen abiertos, asi que esta comprobacion se quedaria
    // verde siempre y no probaria nada. Se cierra el detalle a proposito: si al llegar por el
    // hash vuelve a estar abierto, es el deep-link el que lo abre, no el HTML.
    await page.goto(origin, { waitUntil: 'load' })
    await page.evaluate((id) => {
      const el = document.getElementById(id)
      if (el instanceof HTMLDetailsElement) el.open = false
    }, projectId)
    await page.goto(`${origin}/#${projectId}`, { waitUntil: 'load' })
    const openVisible = await page.evaluate((id) => {
      const el = document.getElementById(id)
      return el instanceof HTMLDetailsElement && el.open && el.checkVisibility()
    }, projectId)

    if (openVisible) {
      ok(`deep-link abre el detalle ${projectId}`, 'RF-13')
    } else {
      fail('RF-13', `#${projectId} no abre el detalle`)
    }
  }

  // 9. `RF-27`: si hay canal de email configurado, el boton lo revela sin estar en el HTML.
  const emailButtons = await page.locator('[data-contact-email]').count()
  if (emailButtons > 0) {
    await page.goto(origin, { waitUntil: 'load' })
    // Igual que arriba: el desplegable ya nace abierto (`ADR-0010`). Pulsar el resumen sin
    // comprobarlo lo cerraria y ocultaria justo el boton que esta comprobacion va a pulsar.
    const yaAbierto = await page.evaluate(
      () => document.querySelector('#escena-06 .detail')?.hasAttribute('open') ?? false,
    )
    if (!yaAbierto) await page.locator('#escena-06 .detail__summary').first().click()
    await page.locator('[data-contact-email]').click()
    const revealed = await page.evaluate(() => {
      const output = document.querySelector('[data-contact-email-output]')
      const link = output?.querySelector('a')
      return {
        hidden: output?.hasAttribute('hidden') ?? true,
        href: link?.getAttribute('href') ?? '',
      }
    })
    if (!revealed.hidden && revealed.href.startsWith('mailto:')) {
      ok('revelado de email (RF-27)')
    } else {
      fail('RF-27', JSON.stringify(revealed))
    }
  } else {
    ok('sin PUBLIC_CONTACT_EMAIL: boton de email no renderizado', 'RF-27 opcional')
  }

  await context.close()
} finally {
  await browser.close()
  server.close()
}

console.log('')
if (problems.length > 0) {
  console.error(`  GATE teclado — ${problems.length} hallazgo(s)\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}
console.log('  OK  RF-02..06 · RF-09 — teclado y navegacion: 100 % de los flujos\n')
