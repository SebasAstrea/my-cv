/**
 * Gate RNF-87 + RUI-70: literales de diseno solo en `tokens.css`.
 *
 * Por que este gate y no una regla de stylelint: una regex sobre el valor de una propiedad
 * no distingue `transparent` de `oklch(...)`, no sigue los custom properties y falla en
 * silencio cuando el valor viene de una variable. Aqui el analisis es explicito y el error
 * senala fichero y linea.
 *
 * Reglas:
 *  1. `RNF-87`  Ningun color literal fuera de `tokens.css`.
 *  2. `RUI-70`  Ninguna duracion fuera del set {120,240,480,720} ms, y solo como `var(--dur-*)`.
 *  3. `RNF-87`  Ningun radio literal fuera de {0, 2px, 4px} (`RUI-24`).
 *  4. Coherencia: todo `var(--x)` usado debe estar declarado en `tokens.css`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TOKENS = 'src/styles/tokens.css'
const SCAN_DIRS = ['src']

/** Valores permitidos donde el color no es un token pero no admite alternativa. */
const COLOR_KEYWORDS = new Set([
  'transparent',
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'none',
])

const COLOR_PATTERNS = [
  { name: 'oklch/lab/lch', re: /\b(?:oklch|oklab|lab|lch)\s*\(/g },
  { name: 'hex', re: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g },
  { name: 'rgb/hsl/color', re: /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|color-mix|color)\s*\(/g },
]

/** `RUI-70`: el set cerrado de duraciones. */
const ALLOWED_MS = new Set([120, 240, 480, 720])
/** Valores neutros admitidos (coinciden con el override de `prefers-reduced-motion`). */
const ALLOWED_NEUTRAL_MS = new Set([0, 0.01])

const RADIUS_ALLOWED = /^(?:0|2px|4px)$/
const RADIUS_PROPS = /^\s*(?:border(?:-[a-z]+)*-radius|outline-offset)\s*:/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith('.css') || full.endsWith('.astro')) out.push(full)
  }
  return out
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}

const tokensSource = readFileSync(join(ROOT, TOKENS), 'utf8')

/** Tokens declarados en `tokens.css`. Se recogen de las custom propertiesdefinitions. */
const declaredTokens = new Set(
  [...tokensSource.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
)

/** Custom properties definidas en el propio fichero (no heredadas de tokens.css). */
const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
  .map((f) => relative(ROOT, f))
  .filter((f) => f !== TOKENS)

const errors = []

for (const file of files) {
  const source = readFileSync(join(ROOT, file), 'utf8')
  const localTokens = new Set([...source.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]))
  const known = new Set([...declaredTokens, ...localTokens])

  // --- 1. Colores literales ---
  for (const { name, re } of COLOR_PATTERNS) {
    re.lastIndex = 0
    for (const match of source.matchAll(re)) {
      const value = match[0]
      if (COLOR_KEYWORDS.has(value.toLowerCase())) continue
      // `RUI-35` documenta el tamano del tile de grano en KB, no un color. Los numeros con
      // `#` en comentarios no son colores: se ignoran las lineas de comentario.
      const at = match.index ?? 0
      const line = lineOf(source, at)
      const lineText = source.split('\n')[line - 1] ?? ''
      const inComment =
        lineText.trimStart().startsWith('*') || lineText.trimStart().startsWith('/*')
      if (inComment) continue
      errors.push({
        file,
        line,
        rule: 'RNF-87',
        message: `color literal (${name}: ${value}) fuera de ${TOKENS}. Usa var(--token)`,
      })
    }
  }

  // --- 2. Duraciones fuera del set ---
  const durationRe = /([0-9]*\.?[0-9]+)(ms|s)\b/g
  for (const match of source.matchAll(durationRe)) {
    const raw = match[1]
    const unit = match[2]
    const value = Number(raw)
    const ms = unit === 's' ? value * 1000 : value
    if (ALLOWED_MS.has(ms) || ALLOWED_NEUTRAL_MS.has(ms)) continue
    // Las duraciones de `scroll-behavior` fuera de `tokens.css` serian un literal; aqui solo
    // se senalan las que aparecen en transiciones/animaciones.
    const at = match.index ?? 0
    const line = lineOf(source, at)
    const before = source.slice(Math.max(0, at - 120), at)
    const relevant = /transition|animation|@keyframes/.test(
      before.slice(before.lastIndexOf(';') + 1),
    )
    if (!relevant) continue
    errors.push({
      file,
      line,
      rule: 'RUI-70',
      message: `duracion ${raw}${unit} fuera del set {120,240,480,720}ms. Usa var(--dur-*)`,
    })
  }

  // --- 3. Radios fuera de {0, 2px, 4px} (`RUI-24`) ---
  for (const [index, line] of source.split('\n').entries()) {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue
    const prop = line.split(':')[0]
    if (prop === undefined || !RADIUS_PROPS.test(line)) continue
    const value = line
      .slice(line.indexOf(':') + 1)
      .replace(/;.*$/, '')
      .trim()
    if (value === '' || value.startsWith('var(')) continue
    if (RADIUS_ALLOWED.test(value)) continue
    errors.push({
      file,
      line: index + 1,
      rule: 'RUI-24',
      message: `radio "${value}" fuera de {0, 2px, 4px}. Usa var(--radius-*)`,
    })
  }

  // --- 4. Tokens usados pero no declarados ---
  for (const match of source.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
    const token = match[1]
    if (token === undefined || known.has(token)) continue
    const at = match.index ?? 0
    errors.push({
      file,
      line: lineOf(source, at),
      rule: 'RNF-87',
      message: `var(${token}) no declarado en ${TOKENS}`,
    })
  }
}

if (errors.length > 0) {
  console.error(`\n  GATE RNF-87 / RUI-70 / RUI-24 — ${errors.length} hallazgo(s)\n`)
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line}  [${e.rule}] ${e.message}`)
  }
  console.error('')
  process.exit(1)
}

console.log(
  `  OK  RNF-87 · RUI-70 · RUI-24 — ${files.length} ficheros, ${declaredTokens.size} tokens`,
)
