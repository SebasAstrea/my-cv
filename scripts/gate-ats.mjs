/**
 * Gate RNF-33 · RNF-100 · RND-08 — el CV es parseable, completo y portable.
 *
 * `RNF-33` exige que el CV lo entienda un ATS: HTML semantico renderizado en servidor y
 * `JSON-LD` `Person` + `Occupation`. Eso no se ve a ojo en un navegador (todo "parece" bien),
 * asi que se comprueba sobre `dist/index.html`, el artefacto real.
 *
 * Se anaden dos comprobaciones baratas del mismo contrato de datos:
 *   - `RNF-100`: los cuatro exportadores estaticos existen en `dist/`.
 *   - `RND-08`: el texto plano no esta vacio (el CV se obtiene sin JS ni video).
 *
 * No importa `src/` a proposito: mide el ARTEFACTO, no la intencion. Un cambio que rompa el
 * render pero no el schema lo caza este gate y no `check:cv`.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const problems = []

/** `RF-01` fija 7 escenas; el id estable es `#escena-0N` (`Scene.astro`). */
const SCENE_COUNT = 7

const indexPath = join(DIST, 'index.html')
if (!existsSync(indexPath)) {
  console.error('\n  GATE RNF-33 — falta dist/index.html. ¿Se ejecuto `pnpm build`?\n')
  process.exit(1)
}

const html = readFileSync(indexPath, 'utf8')

// --- RNF-33: exactamente un h1 y una seccion por escena ---
const h1Count = [...html.matchAll(/<h1\b/g)].length
if (h1Count !== 1) {
  problems.push(`RNF-33: se esperaba 1 <h1> y hay ${h1Count}`)
}
for (let i = 0; i < SCENE_COUNT; i += 1) {
  const id = `id="escena-${String(i).padStart(2, '0')}-titulo"`
  if (!html.includes(id)) problems.push(`RF-01/RNF-33: falta el heading ${id}`)
}

// --- RNF-33: JSON-LD Person + Occupation, y su nombre visible en el HTML ---
const ldMatch = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html)
if (ldMatch === null) {
  problems.push('RNF-33: no se encontro el <script type="application/ld+json">')
} else {
  try {
    const data = JSON.parse(ldMatch[1])
    if (data['@type'] !== 'Person') {
      problems.push(`RNF-33: JSON-LD @type es "${data['@type']}", se esperaba "Person"`)
    }
    const occupation = data.hasOccupation
    if (occupation === null || typeof occupation !== 'object') {
      problems.push('RNF-33: JSON-LD sin hasOccupation')
    } else if (occupation['@type'] !== 'Occupation') {
      problems.push('RNF-33: hasOccupation no es de tipo "Occupation"')
    }
    const name = data.name
    if (typeof name !== 'string' || name.length === 0) {
      problems.push('RNF-33: JSON-LD sin name')
    } else if (!html.includes(name)) {
      problems.push(`RNF-33: el nombre "${name}" del JSON-LD no aparece en el HTML servido`)
    }
  } catch (error) {
    problems.push(`RNF-33: JSON-LD no parsea (${String(error)})`)
  }
}

// --- RNF-100 + RND-08: exportadores estaticos ---
for (const file of ['cv.json', 'cv.jsonld', 'cv.md', 'cv.txt']) {
  if (!existsSync(join(DIST, file))) problems.push(`RNF-100: falta dist/${file}`)
}

const plainTextPath = join(DIST, 'cv.txt')
if (existsSync(plainTextPath) && readFileSync(plainTextPath, 'utf8').trim().length < 80) {
  problems.push('RND-08: dist/cv.txt esta practicamente vacio')
}

if (problems.length > 0) {
  console.error(`\n  GATE RNF-33 / RNF-100 / RND-08 — ${problems.length} hallazgo(s)\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

console.log(
  `  OK  RNF-33 · RNF-100 · RND-08 — 1 h1, ${SCENE_COUNT} escenas, JSON-LD y 4 exportadores`,
)
