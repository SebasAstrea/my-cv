/**
 * Gate `RUI-52` — presupuesto de saturacion por escena (`RUI-30..37`, `MEDICION.md` §4.3).
 *
 * Por escena, con Playwright sobre `dist/`:
 *   - nodos de contenido VISIBLES <= 6 (el exceso debe estar en un `<details>` colapsado),
 *   - caracteres de apoyo VISIBLES <= 280,
 *   - videos en el DOM <= 1.
 *
 * "Visible" se mide con `Element.checkVisibility()`: el contenido de un `<details>` cerrado no
 * cuenta, que es justo lo que `RUI-31` pide (divulgacion progresiva). No es un truco de
 * medicion: es el estado por defecto que ve el usuario.
 *
 * Fuera de `pnpm gate` (necesita Chromium), como `gate:keyboard`. Corre en CI y en local.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

import { chromium } from 'playwright'
import { staticDir } from './lib/static.mjs'

const DIST = staticDir()
const MAX_NODES = 6
const MAX_CHARS = 280
const SCENE_COUNT = 7

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

const problems = []

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('\n  GATE RUI-52 — falta dist/index.html. ¿Se ejecuto `pnpm build`?\n')
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
      const address = server.address()
      resolve({ server, origin: `http://127.0.0.1:${address.port}` })
    })
  })
}

const { server, origin } = await startServer()
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } })
const page = await context.newPage()
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.goto(origin, { waitUntil: 'load' })

const measure = () =>
  page.evaluate((sel) => {
    const scenes = [...document.querySelectorAll('[data-scene]')]
    return scenes.map((scene) => {
      const nodes = [...scene.querySelectorAll(sel)].filter(
        (el) =>
          el.closest('.scene__meta') === null &&
          el.checkVisibility() &&
          el.textContent.trim().length > 0 &&
          el.querySelector(sel) === null,
      )
      const chars = nodes.reduce((sum, el) => sum + el.textContent.trim().length, 0)
      return {
        id: scene.id,
        nodes: nodes.length,
        chars,
        detail: nodes.map((el) => el.textContent.trim().slice(0, 24)),
      }
    })
  }, 'h1,h2,h3,h4,p,li,summary,a,button,dt,dd,figcaption')

const measured = await measure()
const videoCount = await page.evaluate(() => document.querySelectorAll('video').length)

if (measured.length !== SCENE_COUNT) {
  problems.push(`se esperaban ${SCENE_COUNT} escenas y hay ${measured.length}`)
}

for (const scene of measured) {
  const tag = `${scene.id}`
  if (scene.nodes > MAX_NODES) {
    problems.push(
      `${tag}: ${scene.nodes} nodos visibles (max ${MAX_NODES}) — ${scene.detail.join(' | ')}`,
    )
  }
  if (scene.chars > MAX_CHARS) {
    problems.push(`${tag}: ${scene.chars} caracteres visibles (max ${MAX_CHARS})`)
  }
  console.log(
    `  · ${tag.padEnd(10)} ${String(scene.nodes).padStart(2)} nodos · ${String(scene.chars).padStart(3)} car.`,
  )
}

if (videoCount > 1) problems.push(`${videoCount} <video> en el DOM (max 1)`)

await context.close()
await browser.close()
server.close()

console.log('')
if (problems.length > 0) {
  console.error(`  GATE RUI-52 — ${problems.length} escena(s) fuera de presupuesto\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}
console.log(
  `  OK  RUI-30..37 · RUI-52 — ${SCENE_COUNT} escenas dentro de presupuesto (<= ${MAX_NODES} nodos, <= ${MAX_CHARS} car.)\n`,
)
