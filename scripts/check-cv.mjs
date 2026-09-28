/**
 * Gate DEC-03.c: el CV valida el schema y las reglas de integridad.
 *
 * Es el gate que `SPEC.md` 2 (`DEC-03.c`) exige literalmente: "un CV invalido no despliega".
 *
 * A diferencia de los otros gates, este puede pasar a proposito aunque la validacion falle:
 * imprime todos los problemas con su requisito de origen, para que arreglar el dato sea un
 * acto deliberado y no una serie de intentos.
 *
 *   --strict   falla si hay problemas (por defecto en produccion y en CI)
 *   --allow-rnd02  no falla por solapes de roles, que son legitimos (`RND-02`)
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCv } from '../src/lib/cv/validate.ts'
import { dataSource } from '../src/lib/env.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const args = new Set(process.argv.slice(2))

// Estricto por defecto, en todos los entornos: un CV invalido no despliega, y tampoco es
// aceptable que lo sea solo en local. `--loose` existe para depurar el schema.
const strict = !args.has('--loose')
// `RND-02` solapa: un solape entre roles es LEGAL (consultoria, proyectos propios). Lo que
// `RND-02` prohibe es *mostrar la suma ingenua*. Por eso es aviso, no fallo, tanto aqui como
// en `getCv()`. `--strict-overlap` lo convierte en bloqueante si alguna vez hace falta.
const strictOverlap = args.has('--strict-overlap')

const source =
  dataSource() === 'real'
    ? (await import('../src/data/cv.real.ts')).cv
    : (await import('../src/data/cv.fixture.ts')).cvFixture

const parsed = parseCv(source, new Date())

const schemaFailed = !parsed.ok
const issues = parsed.ok ? parsed.issues : parsed.issues
const blocking = issues.filter((i) => (i.requirement === 'RND-02' ? strictOverlap : true))

const document = schemaFailed
  ? 'no valida el schema'
  : `${parsed.cv.roles.length} roles · ${parsed.cv.projects.length} proyectos · ${parsed.cv.stack.length} grupos de stack`

console.log('')
console.log('  CV  DEC-03.c')
console.log(`  ${document}`)

if (schemaFailed) {
  console.error(`\n  ${issues.length} problema(s) de schema:\n`)
  for (const i of issues) console.error(`  [${i.requirement}] ${i.path}: ${i.message}`)
} else if (issues.length > 0) {
  const grouped = new Map()
  for (const i of issues) {
    const list = grouped.get(i.requirement) ?? []
    list.push(i)
    grouped.set(i.requirement, list)
  }
  for (const [requirement, list] of grouped) {
    const warn = requirement === 'RND-02'
    const tag = warn ? 'aviso' : '·'
    console.log(`  ${tag} ${requirement}  ${list.length}:`)
    for (const i of list) console.log(`      ${i.path}: ${i.message}`)
  }
}

const hasReal = existsSync(join(ROOT, 'src/data/cv.real.ts'))
if (!hasReal) console.log('  · cv.real.ts ausente — se usa el fixture (ADR-0003)')

console.log('')

if (strict && blocking.length > 0) {
  console.error(
    `  GATE DEC-03.c: ${blocking.length} problema(s) bloqueante(s). El CV no despliega.\n`,
  )
  process.exit(1)
}

const advisories = issues.length - blocking.length
console.log(`  OK  DEC-03.c — 0 problema(s) bloqueante(s), ${advisories} aviso(s)\n`)
