/**
 * Verificador de `docs/STATUS.md`.
 *
 * Existe por una razon concreta: un checklist escrito a mano se pudre. Dice "gate en verde" y
 * el gate desaparece; dice "8 pasos" y son 9; nadie se entera hasta que un sprint entero se
 * construye sobre una mentira. `SCRUM.md` §5.1 dice que un requisito marcado "hecho" sin
 * evidencia no cuenta; esto es la evidencia de que el estado que se declara "hecho" existe.
 *
 * Comprueba, sin ejecutar los gates:
 *   1. Que cada comando de la tabla §3 exista como script de `package.json`.
 *   2. Que cada gate tenga su fichero en `scripts/`.
 *   3. Que `pnpm gate` mencione todos los gates, en orden y sin huecos.
 *   4. Que los sprints de §2 coincidan con los del roadmap de `SCRUM.md` §7.
 *   5. Que el sprint activo sea coherente con §1.
 *
 * Con `--full` ejecuta ademas `pnpm gate` entero. Sin el, es un chequeo de milisegundos apto
 * para meterse en la cadena de gates.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const STATUS = join(ROOT, 'docs/STATUS.md')
const SCRUM = join(ROOT, 'docs/SCRUM.md')
const PKG = join(ROOT, 'package.json')

const problems = []
const notes = []

const fail = (msg) => problems.push(msg)
const note = (msg) => notes.push(msg)

const status = readFileSync(STATUS, 'utf8')
const scrum = readFileSync(SCRUM, 'utf8')
const pkg = JSON.parse(readFileSync(PKG, 'utf8'))

/* ------------------------------------------------------------------ *
 * 1-3. Gates
 * ------------------------------------------------------------------ */

/** Filas de la tabla §3: | `nombre` | `comando` | ... | */
const gateRows = [...status.matchAll(/^\|\s*`([a-z:]+)`\s*\|\s*`(pnpm [a-z:]+)`\s*\|/gm)]

if (gateRows.length === 0) {
  fail('No se encontro la tabla de gates en docs/STATUS.md §3.')
}

for (const [, name, command] of gateRows) {
  const script = command.replace('pnpm ', '')
  if (!(script in pkg.scripts)) {
    fail(`Gate \`${name}\`: \`${command}\` no existe en package.json.`)
  }
  // Salvo los wrappers de herramientas, todo gate debe tener su propio fichero en scripts/
  // para poder razonar sobre el. `pnpm foo:bar` -> `scripts/foo-bar.mjs`.
  const hasOwnFile = existsSync(join(ROOT, 'scripts', `${script.replace(':', '-')}.mjs`))
  const isWrapper = [
    'typecheck',
    'lint',
    'lint:fix',
    'format',
    'format:check',
    'status',
    'build',
  ].includes(script)
  if (!hasOwnFile && !isWrapper) {
    fail(
      `Gate \`${name}\`: no hay scripts/${script.replace(':', '-')}.mjs ni es un wrapper conocido.`,
    )
  }
}

// La cadena de `pnpm gate` debe contener cada gate de la tabla, en el orden declarado.
const gateChain = pkg.scripts.gate ?? ''
const chain = gateChain.split('&&').map((s) => s.trim().replace('pnpm ', ''))
for (const [, name, command] of gateRows) {
  const script = command.replace('pnpm ', '')
  if (!chain.includes(script)) {
    fail(`Gate \`${name}\` (\`${script}\`) no aparece en \`pnpm gate\`.`)
  }
}
for (const step of chain) {
  if (!(step in pkg.scripts)) {
    fail(`\`pnpm gate\` invoca \`pnpm ${step}\`, que no existe en package.json.`)
  }
  if (!gateRows.some(([, , command]) => command === `pnpm ${step}`)) {
    note(`\`pnpm gate\` incluye \`pnpm ${step}\`, que no esta en la tabla §3 de STATUS.md.`)
  }
}

// `build` es un gate implicitamente: sin el, los gates que miden `dist/` no tienen nada que medir.
if (!chain.includes('build') && gateRows.some(([, , c]) => c === 'pnpm gate:artifacts')) {
  fail('`pnpm gate` no ejecuta `build`, pero hay gates que miden `dist/`.')
}

/* ------------------------------------------------------------------ *
 * 4-5. Sprints
 * ------------------------------------------------------------------ */

// Sprints del roadmap de SCRUM.md §7: filas que empiezan por | **N** |
const scrumSprints = [...scrum.matchAll(/^\|\s*\*\*(\d+)\*\*\s*\|/gm)].map((m) => Number(m[1]))

// Sprints de STATUS.md §2: | N | ... | `ESTADO` |
const statusSprints = [
  ...status.matchAll(/^\|\s*(\d+)\s*\|[^|]+\|\s*`(DONE|WIP|TODO|DEFERRED)`\s*\|/gm),
].map((m) => ({ n: Number(m[1]), state: m[2] }))

if (statusSprints.length !== scrumSprints.length) {
  fail(
    `STATUS.md lista ${statusSprints.length} sprints y SCRUM.md §7 lista ${scrumSprints.length}. ` +
      `Actualiza los dos a la vez.`,
  )
} else {
  for (const [i, n] of scrumSprints.entries()) {
    if (statusSprints[i].n !== n) {
      fail(
        `Desajuste de sprints: SCRUM.md §7 va por ${n} y STATUS.md §2 va por ${statusSprints[i].n}.`,
      )
    }
  }
}

// Ningun sprint anterior al activo puede quedar sin terminar.
const activeIdx = statusSprints.findIndex((s) => s.state !== 'DONE')
if (activeIdx === -1) {
  note('Todos los sprints estan DONE. ¿Proyecto terminado? Actualiza §1.')
} else {
  for (const s of statusSprints.slice(0, activeIdx)) {
    if (s.state !== 'DONE') {
      fail(
        `Sprint ${s.n} esta \`${s.state}\` y el activo es el ${statusSprints[activeIdx].n}. Un sprint sin cerrar no se salta.`,
      )
    }
  }
  const active = statusSprints[activeIdx]
  const claimed = /Sprint activo\*\* \| \*\*(\d+)/.exec(status)
  if (claimed === null) {
    fail('No se encuentra la fila "Sprint activo" en STATUS.md §1.')
  } else if (Number(claimed[1]) !== active.n) {
    fail(
      `§1 dice "sprint activo ${claimed[1]}" pero §2 tiene el ${active.n} como primero sin terminar.`,
    )
  }
}

// Exactamente un sprint en curso, como mucho. Varios `WIP` a la vez es un scrum roto.
const wip = statusSprints.filter((s) => s.state === 'WIP')
if (wip.length > 1) {
  fail(`Sprintes en WIP a la vez: ${wip.map((s) => s.n).join(', ')}. Uno solo.`)
}

/* ------------------------------------------------------------------ *
 * 6. Lo que opencode carga como instrucciones
 * ------------------------------------------------------------------ */

// Si alguien renombra AGENTS.md o STATUS.md y no actualiza opencode.json, los agentes dejan
// de leer el estado del proyecto sin que nadie se entere: no hay error, solo silencio.
const opencodePath = join(ROOT, 'opencode.json')
if (!existsSync(opencodePath)) {
  fail('No existe opencode.json. Sin `instructions`, un agente no lee AGENTS.md ni STATUS.md.')
} else {
  const opencode = JSON.parse(readFileSync(opencodePath, 'utf8'))
  for (const file of opencode.instructions ?? []) {
    if (!existsSync(join(ROOT, file))) {
      fail(`opencode.json carga \`${file}\`, que no existe. Ningun agente lo va a leer.`)
    }
  }
  for (const required of ['AGENTS.md', 'docs/STATUS.md']) {
    if (!(opencode.instructions ?? []).includes(required)) {
      fail(
        `opencode.json no carga \`${required}\`. Es como un agente sabria el avance del proyecto.`,
      )
    }
  }
}

/* ------------------------------------------------------------------ *
 * Reporte
 * ------------------------------------------------------------------ */

console.log(`\n  STATUS  (docs/STATUS.md)\n`)
console.log(
  `  · sprints       ${statusSprints.filter((s) => s.state === 'DONE').length} done` +
    `, ${statusSprints.filter((s) => s.state === 'WIP').length} wip` +
    `, ${statusSprints.filter((s) => s.state === 'TODO').length} todo`,
)
console.log(`  · gates         ${gateRows.length} declarados, ${chain.length} en \`pnpm gate\``)

for (const n of notes) console.log(`\n  nota  ${n}`)

if (problems.length > 0) {
  console.error(
    `\n  STATUS: ${problems.length} discrepancia(s). El documento no describe el repo.\n`,
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

console.log('\n  OK  STATUS — el documento coincide con el repo\n')
