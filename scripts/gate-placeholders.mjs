/**
 * Gate RF-25: sin placeholders, y el fixture nunca llega a produccion.
 *
 * Dos niveles, porque no todos los marcadores son igual de graves y `ADR-0003` necesita que
 * el fixture exista en dev:
 *
 *  **Nivel 1 — siempre.** `Lorem`, `TODO`, `FIXME`, `undefined`, `NaN`… No tienen excusa en
 *  ningun entorno. Un logro con un `TODO` es un logro que miente, y el sitio entero es la
 *  fuente de la verdad.
 *
 *  **Nivel 2 — solo en produccion.** `Ejemplo`, `Nombre Apellido`, `example.invalid`,
 *  `dummy`… Son marcadores legitimos del fixture, y un error si llegan a un artefacto
 *  entregable. En dev y PR solo se avisa.
 *
 * Ademas, en produccion, el fixture de `ADR-0003` no puede estar presente en absoluto.
 *
 * Se lee el HTML DIST, no el fuente: lo que importa es que el visitante no pueda ver el
 * marcador, no que el repositorio este impecable.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { dataSource, isDeployBuild } from '../src/lib/env.ts'
import { staticDir } from './lib/static.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = staticDir()

// Estricto si el build va a desplegarse, o si se ha pedido explicitamente datos reales.
// Un build de PR con el fixture avisa pero no bloquea: el fixture existe para eso (ADR-0003).
const deploying = isDeployBuild()
const wantsReal = dataSource() === 'real'
const isProduction = deploying || wantsReal

/** Nivel 1: prohibidos siempre. */
const ALWAYS = [
  { id: 'lorem', re: /\blorem\b/i },
  { id: 'ipsum', re: /\bdolor sit amet\b/i },
  { id: 'todo', re: /\bTODO\b/ },
  { id: 'fixme', re: /\bFIXME\b/ },
  { id: 'xxx', re: /\bXXX+\b/ },
  { id: 'placeholder', re: /\bplaceholder\b/i },
  { id: 'undefined', re: />undefined/ },
  { id: 'nan', re: /\bNaN\b/ },
  { id: 'fecha-nula', re: /NaN\s*(?:mes|anos|a\s+ño)/ },
]

/** Nivel 2: errores si aparecen en produccion. */
const PRODUCTION_ONLY = [
  { id: 'ejemplo', re: /\bejemplo\b/i },
  { id: 'nombre-apellido', re: /\bnombre\s+apellido\b/i },
  { id: 'invalid-url', re: /example\.invalid/ },
  { id: 'dummy', re: /\b(?:dummy|fake|lorem-ipsum)\b/i },
]

/** Indicios de que el artefacto es el del fixture (`ADR-0003`). */
const FIXTURE_MARKERS = ['Datos de ejemplo', 'no es el CV real', 'CV_DATA_SOURCE=fixture']

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

if (!existsSync(DIST)) {
  console.error('  GATE RF-25: dist/ no existe. Ejecuta `pnpm build` antes.')
  process.exit(1)
}

const artefacts = walk(DIST).filter((f) => /\.(?:html|json|js|css|xml|txt|webmanifest)$/.test(f))
const hard = []
const soft = []
const fixtureHits = []

for (const file of artefacts) {
  const rel = relative(ROOT, file)
  const text = readFileSync(file, 'utf8')

  for (const { id, re } of ALWAYS) {
    re.lastIndex = 0
    const match = re.exec(text)
    if (match !== null) hard.push({ file: rel, id, snippet: match[0].slice(0, 60) })
  }

  for (const { id, re } of PRODUCTION_ONLY) {
    re.lastIndex = 0
    const match = re.exec(text)
    if (match !== null) soft.push({ file: rel, id, snippet: match[0].slice(0, 60) })
  }

  for (const marker of FIXTURE_MARKERS) {
    if (text.includes(marker)) fixtureHits.push({ file: rel, marker })
  }
}

const label = deploying ? 'despliegue' : wantsReal ? 'datos reales' : 'dev/PR (fixture)'
const blocked = isProduction ? [...hard, ...soft] : hard
const warned = isProduction ? [] : soft

console.log('')
if (blocked.length > 0) {
  console.error(`  GATE RF-25 (${label}): ${blocked.length} marcador(es) bloqueante(s)\n`)
  for (const f of blocked) console.error(`  ${f.file}  [${f.id}] "${f.snippet}"`)
  console.error('')
  process.exit(1)
}

if (isProduction && fixtureHits.length > 0) {
  console.error(
    `\n  GATE RF-25 (${label}): el fixture de ADR-0003 ha llegado al artefacto.\n` +
      `  Construye con CV_DATA_SOURCE=real.\n`,
  )
  for (const hit of fixtureHits) console.error(`  ${hit.file}  contiene "${hit.marker}"`)
  console.error('')
  process.exit(1)
}

for (const w of warned) console.log(`  aviso  ${w.file}  [${w.id}] "${w.snippet}"`)
if (warned.length > 0) {
  console.log('  ^ marcadores de fixture permitidos en dev/PR, bloqueantes en produccion')
}

const fixtureNote =
  fixtureHits.length > 0 ? ` · fixture presente${isProduction ? '' : ' (permitido aqui)'}` : ''
console.log(
  `  OK  RF-25 — ${artefacts.length} artefactos, 0 marcadores bloqueantes${fixtureNote}\n`,
)
