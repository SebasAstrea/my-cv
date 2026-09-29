/**
 * Gate `SEG-02/03/05`, `RNF-62/63/72` — cabeceras de seguridad y CSP sobre el artefacto.
 *
 * Comprueba dos cosas que se rompen en silencio:
 *
 *   1. **La CSP cuadra con el HTML real.** El hash sha256 del script inline del tema se recalcula
 *      desde `dist/index.html`; si alguien cambia ese script y no actualiza la CSP, el navegador
 *      bloquea el script y el tema parpadea. Este gate lo caza en local, no en producción.
 *   2. **Las cabeceras versionadas coinciden.** `public/_headers` (Cloudflare/Netlify) y
 *      `vercel.json` declaran el mismo juego; una que se quede atras es una degradación silenciosa
 *      según la plataforma.
 *
 * No sondea la red: mide el artefacto y la configuración versionada. El sondeo HTTP del deploy
 * real es del Sprint 12 (smoke post-deploy).
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { staticDir } from './lib/static.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = staticDir()
const problems = []

const indexHtml = join(DIST, 'index.html')
const headersFile = join(DIST, '_headers')
const vercelFile = join(ROOT, 'vercel.json')

for (const [label, path] of [
  ['dist/index.html', indexHtml],
  ['dist/_headers', headersFile],
  ['vercel.json', vercelFile],
]) {
  if (!existsSync(path)) {
    console.error(`\n  GATE SEG-02 — falta ${label}. ¿Se ejecuto \`pnpm build\`?\n`)
    process.exit(1)
  }
}

/** Cabeceras de un fichero `_headers` (formato `Clave: valor` por linea). */
function parseHeadersFile(text) {
  const map = {}
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Za-z-]+):\s*(.+?)\s*$/.exec(line)
    if (match) map[match[1].toLowerCase()] = match[2]
  }
  return map
}

/** Cabeceras de `vercel.json` (primer bloque `source`). */
function parseVercelHeaders(json) {
  const map = {}
  for (const group of json.headers ?? []) {
    for (const header of group.headers ?? []) map[String(header.key).toLowerCase()] = header.value
  }
  return map
}

const headers = parseHeadersFile(readFileSync(headersFile, 'utf8'))
const vercel = parseVercelHeaders(JSON.parse(readFileSync(vercelFile, 'utf8')))

const csp = headers['content-security-policy']
const cspVercel = vercel['content-security-policy']

// --- 1. Hash del script inline contra la CSP ---
const html = readFileSync(indexHtml, 'utf8')
const inlineExecutable = []
const scriptRe = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g
let match
while ((match = scriptRe.exec(html)) !== null) {
  const type = /type="([^"]+)"/.exec(match[1])?.[1] ?? ''
  // Los data blocks (`application/ld+json`) no se ejecutan y no los cubre `script-src`.
  if (type !== '' && !/javascript|module/i.test(type)) continue
  inlineExecutable.push('sha256-' + createHash('sha256').update(match[2], 'utf8').digest('base64'))
}

if (csp === undefined) {
  problems.push('dist/_headers no declara Content-Security-Policy')
} else {
  for (const hash of inlineExecutable) {
    if (!csp.includes(hash)) problems.push(`CSP sin el hash del script inline: ${hash}`)
  }
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ]) {
    if (!csp.includes(directive)) problems.push(`CSP sin "${directive}"`)
  }
  for (const forbidden of ["'unsafe-eval'", "'unsafe-inline'"]) {
    if (csp.includes(forbidden)) problems.push(`CSP contiene ${forbidden}`)
  }
}

// --- 2. `_headers` y `vercel.json` coinciden ---
if (csp === undefined || cspVercel === undefined) {
  if (cspVercel === undefined) problems.push('vercel.json no declara Content-Security-Policy')
} else if (csp !== cspVercel) {
  problems.push('la CSP de dist/_headers y la de vercel.json no coinciden')
}

const REQUIRED = {
  'strict-transport-security': (v) =>
    /max-age=31536000/.test(v) && /includeSubDomains/.test(v) && /preload/.test(v),
  'x-content-type-options': (v) => v === 'nosniff',
  'referrer-policy': (v) => v === 'strict-origin-when-cross-origin',
  'permissions-policy': (v) =>
    /geolocation=\(\)/.test(v) && /camera=\(\)/.test(v) && /microphone=\(\)/.test(v),
  'cross-origin-opener-policy': (v) => v === 'same-origin',
}

for (const [key, isValid] of Object.entries(REQUIRED)) {
  for (const [where, map] of [
    ['dist/_headers', headers],
    ['vercel.json', vercel],
  ]) {
    const value = map[key]
    if (value === undefined) problems.push(`${where} sin ${key}`)
    else if (!isValid(value)) problems.push(`${where} ${key} no cumple: "${value}"`)
  }
}

if (problems.length > 0) {
  console.error(`\n  GATE SEG-02/03/05 — ${problems.length} hallazgo(s)\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

console.log(
  `  OK  SEG-02/03/05 · RNF-62/63 — CSP (${inlineExecutable.length} hash inline) y cabeceras en _headers + vercel.json`,
)
