/**
 * Gate `DEC-02`, `RF-40..45`, `RUI-95/96` — sistema de video por escenas.
 *
 * Playwright sobre `dist/`:
 *   1. Un **solo** `<video>` en el DOM (`DEC-02.b`).
 *   2. Cada escena declara su clip (`RF-40`).
 *   3. `RF-41`: al entrar en una escena el clip reproduce; al cambiar de escena cambia el `src`.
 *   4. `RF-10`: modo `off` deja el video en pausa (solo poster).
 *   5. `RUI-74`/`RUI-95`: con `prefers-reduced-motion` no reproduce.
 *   6. `RF-45`: los controles existen y son alcanzables.
 *
 * Si no hay clips en `dist/` (CI con clips gitignored), se **omite** y sale 0: no hay material
 * que medir, y un gate rojo por lo que no existe ensena a ignorar gates.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avif': 'image/avif',
}

const problems = []

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('\n  GATE video — falta dist/index.html. ¿Se ejecuto `pnpm build`?\n')
  process.exit(1)
}

if (!existsSync(join(DIST, 'clips/video1.mp4'))) {
  console.log('  · sin clips en dist/ (temporales, gitignored); gate de video omitido\n')
  process.exit(0)
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
      const address = server.address()
      resolve({ server, origin: `http://127.0.0.1:${address.port}` })
    })
  })
}

const { server, origin } = await startServer()
const browser = await chromium.launch()

try {
  // --- 1 y 2: un solo video y cada escena con clip ---
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  const page = await context.newPage()
  await page.goto(origin, { waitUntil: 'load' })

  const videoCount = await page.evaluate(() => document.querySelectorAll('video').length)
  if (videoCount === 1) console.log('  · un solo <video> en el DOM — DEC-02.b')
  else problems.push(`hay ${videoCount} <video> en el DOM (debe haber 1)`)

  const scenesWithoutClip = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-scene]')].filter((s) => !(s.dataset.clip ?? '')).length,
  )
  if (scenesWithoutClip === 0) console.log('  · cada escena declara su clip — RF-40')
  else problems.push(`${scenesWithoutClip} escena(s) sin data-clip (RF-40)`)

  // --- 3: RF-41, reproduce al entrar y cambia de clip al cambiar de escena ---
  const playing = await page
    .waitForFunction(
      () => {
        const v = document.querySelector('video')
        return (
          v instanceof HTMLVideoElement && !v.paused && (v.currentSrc ?? v.src).includes('video1')
        )
      },
      null,
      { timeout: 8000 },
    )
    .then(() => true)
    .catch(() => false)
  if (playing) console.log('  · RF-41: reproduce el clip de la escena activa (video1)')
  else problems.push('RF-41: el video no reproduce la escena activa')

  await page.evaluate(() => document.getElementById('escena-01')?.scrollIntoView())
  const switched = await page
    .waitForFunction(
      () => (document.querySelector('video')?.currentSrc ?? '').includes('video2'),
      null,
      { timeout: 8000 },
    )
    .then(() => true)
    .catch(() => false)
  if (switched) console.log('  · RF-41: al cambiar de escena cambia el clip (video2)')
  else problems.push('RF-41: el clip no cambia al cambiar de escena')

  // --- ADR-0007: reproduce una vez y congela el ultimo frame ---
  const frozen = await page
    .waitForFunction(
      () => {
        const v = document.querySelector('video')
        return v instanceof HTMLVideoElement && v.paused && v.ended
      },
      null,
      { timeout: 9000 },
    )
    .then(() => true)
    .catch(() => false)
  if (frozen) console.log('  · ADR-0007: reproduce una vez y congela el ultimo frame')
  else problems.push('ADR-0007: el clip no se detiene al terminar (¿sigue en bucle?)')

  // --- ADR-0007: volver del final al principio reinicia el ciclo ---
  await page.evaluate(() => document.getElementById('escena-00')?.scrollIntoView())
  const restarted = await page
    .waitForFunction(
      () => {
        const v = document.querySelector('video')
        return (
          v instanceof HTMLVideoElement && !v.paused && (v.currentSrc ?? v.src).includes('video1')
        )
      },
      null,
      { timeout: 9000 },
    )
    .then(() => true)
    .catch(() => false)
  if (restarted) console.log('  · ADR-0007: al volver al principio se reinicia el clip')
  else problems.push('ADR-0007: no se reinicia al volver al principio')

  // --- 4: RF-10, modo off deja el video en pausa ---
  await page.locator('[data-video-toggle]').click() // auto -> on
  await page.locator('[data-video-toggle]').click() // on -> off
  const pausedOff = await page
    .waitForFunction(() => document.querySelector('video')?.paused === true, null, {
      timeout: 4000,
    })
    .then(() => true)
    .catch(() => false)
  if (pausedOff) console.log('  · RF-10: modo off deja el video en pausa (solo poster)')
  else problems.push('RF-10: modo off no pausa el video')

  // --- 6: RF-45, controles presentes ---
  const controls = await page.evaluate(() =>
    ['[data-video-toggle]', '[data-video-pause]', '[data-video-restart]'].every(
      (s) => document.querySelector(s) !== null,
    ),
  )
  if (controls) console.log('  · RF-45: controles de video presentes')
  else problems.push('RF-45: faltan controles de video')

  await context.close()

  // --- 5: RUI-74, con reduced-motion no reproduce ---
  const rmContext = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    reducedMotion: 'reduce',
  })
  const rmPage = await rmContext.newPage()
  await rmPage.goto(origin, { waitUntil: 'load' })
  await rmPage.waitForTimeout(1200)
  const rmPaused = await rmPage.evaluate(() => document.querySelector('video')?.paused !== false)
  if (rmPaused) console.log('  · RUI-74: con reduced-motion no reproduce (poster)')
  else problems.push('RUI-74: reproduce pese a prefers-reduced-motion')
  await rmContext.close()
} finally {
  await browser.close()
  server.close()
}

console.log('')
if (problems.length > 0) {
  console.error(`  GATE video — ${problems.length} hallazgo(s)\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}
console.log('  OK  DEC-02 · RF-40..45 · RUI-95/96 — sistema de video por escenas\n')
