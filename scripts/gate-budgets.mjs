/**
 * Gate de budgets de artefactos — `RNF-07..12`, `MEDICION.md` 4.2.
 *
 * "El presupuesto se aplica antes de la linea" (`MEDICION.md` 1.6). Medir despues de
 * arreglar es tarde, asi que esto corre en cada build, no en un informe.
 *
 * Umbrales (gzip, que es lo que viaja por la red):
 *
 *   RNF-07  primera carga sin video      <= 350 KB
 *   RNF-08  JS en ruta critica          <= 110 KB  (y 0 KB por encima del fold en v1)
 *   RNF-09  CSS total                    <=  24 KB
 *   RNF-10  fuentes                      <=  90 KB, <= 3 ficheros
 *   RNF-11  poster LCP                   <=  70 KB
 *   RNF-12  primer segmento de video     <= 800 KB
 *
 * Cada umbral movido necesita ADR (`MEDICION.md` 10). Editar el numero aqui sin ADR es la
 * forma de convertir un budget en una preferencia retrospectiva.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')

/** Budgets v1.0. Ver ADR si alguno cambia. */
export const BUDGETS = {
  'RNF-07': { label: 'Primera carga sin video', maxKB: 350 },
  'RNF-08': { label: 'JS en ruta critica', maxKB: 110 },
  'RNF-09': { label: 'CSS total', maxKB: 24 },
  'RNF-10': { label: 'Fuentes', maxKB: 90, maxFiles: 3 },
  'RNF-11': { label: 'Poster LCP', maxKB: 70 },
  'RNF-12': { label: 'Primer segmento de video', maxKB: 800 },
}

const KB = 1024
const gz = (buffer) => gzipSync(buffer, { level: 9 }).length / KB
const raw = (buffer) => buffer.length / KB

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

if (!existsSync(DIST)) {
  console.error('  GATE budgets: dist/ no existe. Ejecuta `pnpm build` antes.')
  process.exit(1)
}

const files = walk(DIST)
const by = (re) => files.filter((f) => re.test(f))

const css = by(/\.css$/)
const js = by(/\.js$/)
const fonts = by(/\.(?:woff2|woff|ttf|otf)$/)
const posters = by(/poster.*\.(?:avif|webp|jpg|png)$/)
const segments = by(/sc\d+-.*\.(?:mp4|webm|m4s)$/)

const sum = (list, fn) => list.reduce((acc, f) => acc + fn(readFileSync(f)), 0)

const html = readFileSync(join(DIST, 'index.html'))
const htmlGz = gz(html)

const measured = [
  {
    id: 'RNF-07',
    value: htmlGz + sum(css, gz) + sum(js, gz),
    parts: `html ${htmlGz.toFixed(1)} + css ${sum(css, gz).toFixed(1)} + js ${sum(js, gz).toFixed(1)}`,
  },
  { id: 'RNF-08', value: sum(js, gz), parts: `${js.length} ficheros` },
  { id: 'RNF-09', value: sum(css, gz), parts: `${css.length} ficheros` },
  {
    id: 'RNF-10',
    value: sum(fonts, gz),
    parts: `${fonts.length} ficheros (top ${BUDGETS['RNF-10'].maxFiles})`,
  },
  {
    id: 'RNF-11',
    value: posters.length === 0 ? 0 : Math.max(...posters.map((f) => raw(readFileSync(f)))),
    parts: `${posters.length} posters`,
  },
  {
    id: 'RNF-12',
    value: segments.length === 0 ? 0 : Math.max(...segments.map((f) => raw(readFileSync(f)))),
    parts: `${segments.length} segmentos`,
  },
]

const violations = []

console.log('\n  BUDGETS  (MEDICION.md 4.2)\n')
for (const m of measured) {
  const budget = BUDGETS[m.id]
  if (budget === undefined) continue
  const limit = `max ${budget.maxKB} KB`
  const ok = m.value <= budget.maxKB
  const bar = '█'.repeat(Math.min(24, Math.round((m.value / budget.maxKB) * 24))).padEnd(24, '·')
  console.log(
    `  ${ok ? '·' : '✗'} ${m.id}  ${budget.label.padEnd(28)} ${m.value.toFixed(1).padStart(7)} KB / ${limit}  ${bar}  ${m.parts}`,
  )

  if (!ok) {
    violations.push(
      `${m.id} ${budget.label}: ${m.value.toFixed(1)} KB supera ${budget.maxKB} KB (${m.parts})`,
    )
  }

  if (m.id === 'RNF-10' && budget.maxFiles !== undefined && fonts.length > budget.maxFiles) {
    violations.push(`RNF-10 fuentes: ${fonts.length} ficheros, max ${budget.maxFiles} (RUI-17)`)
  }
}

console.log('')

if (violations.length > 0) {
  console.error(`  GATE budgets: ${violations.length} presupuesto(s) superado(s)\n`)
  for (const v of violations) console.error(`  ${v}`)
  console.error(
    '\n  Mover un presupuesto requiere ADR con el numero antes/después y por que el nuevo',
  )
  console.error('  valor es aceptable (MEDICION.md 10). Sin ADR, el presupuesto no se mueve.\n')
  process.exit(1)
}

console.log('  OK  budgets — todos dentro de limite\n')
