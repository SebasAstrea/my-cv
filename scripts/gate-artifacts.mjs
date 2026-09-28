/**
 * Gate SEG-31 / SEG-32: ningun campo `private` en ningun artefacto de cliente.
 *
 * `SEG-31` dice que los campos `private` se eliminan en build, no se ocultan con CSS.
 * `SEG-32` convierte esa promesa en un gate: si un solo artefacto entregable al navegador
 * contiene un valor `private` del CV, el build falla.
 *
 * Como no se puede leer `cv.real.ts` (esta gitignored, `SEG-30`), los valores se toman del
 * documento ya validado en el proceso — el mismo objeto que consume la pagina. Si el
 * documento no valida, el gate lo dice y falla: no tiene nada que buscar.
 *
 * Se comparan de forma literal, no por heuristica. Un campo `private` con un valor
 * derivado (un email obfuscado, un telefono con prefijo) no lo detecta este gate; por eso
 * el procedimiento de revision del Sprint 12 sigue siendo obligatorio.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCv, toPublicCv } from '../src/lib/cv/validate.ts'
import { dataSource } from '../src/lib/env.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

if (!existsSync(DIST)) {
  console.error('  GATE SEG-32: dist/ no existe. Ejecuta `pnpm build` antes.')
  process.exit(1)
}

const source =
  dataSource() === 'real'
    ? (await import('../src/data/cv.real.ts')).cv
    : (await import('../src/data/cv.fixture.ts')).cvFixture

const parsed = parseCv(source)
if (!parsed.ok) {
  console.error('  GATE SEG-32: el CV no valida. No hay nada que comprobar.')
  for (const i of parsed.issues) console.error(`  [${i.requirement}] ${i.path}: ${i.message}`)
  process.exit(1)
}

const doc = parsed.cv

/** Valores `private` que no pueden aparecer en un artefacto de cliente. */
const secrets = []

const addSecret = (label, value) => {
  if (typeof value === 'string' && value.trim().length >= 4) {
    secrets.push({ label, value: value.trim() })
  }
}

for (const [field, value] of Object.entries(doc.contact)) {
  if (field.endsWith('Visibility') || value === undefined) continue
  const isPrivate =
    field === 'email' || field === 'location' || field === 'salaryExpectation' || value === null
  if (isPrivate) addSecret(`contact.${field}`, value)
}

// Cualquier rol o proyecto `private` contributes su texto a la lista.
for (const r of doc.roles.filter((x) => x.visibility === 'private')) {
  addSecret(`roles[${r.id}].company`, r.company)
}
for (const p of doc.projects.filter((x) => x.visibility === 'private')) {
  addSecret(`projects[${p.id}].name`, p.name)
}

if (secrets.length === 0) {
  console.log('  OK  SEG-32 — 0 campos private declarados; nada que filtrar')
  process.exit(0)
}

/**
 * Comprobacion 1 — estructural. `SEG-31` promete que el campo desaparece; esto lo verifica
 * sin ambiguedad: si `toPublicCv` deja de filtrar una clave, la clave esta en la salida.
 *
 * Solo mira las claves que el schema declara `private`. `github` y `linkedin` son publicos y
 * deben sobrevivir; comprobarlo seria un fallo del gate, no del codigo.
 */
const publicDoc = toPublicCv(doc)
const publicContact = publicDoc.contact
const PRIVATE_CONTACT_KEYS = Object.keys(doc.contact).filter(
  (key) =>
    !key.endsWith('Visibility') &&
    (key === 'email' || key === 'location' || key === 'salaryExpectation'),
)
const structuralLeaks = PRIVATE_CONTACT_KEYS.filter((key) => key in publicContact)

if (structuralLeaks.length > 0) {
  console.error('\n  GATE SEG-32: `toPublicCv` no elimino los campos private.\n')
  for (const key of structuralLeaks) console.error(`  contact.${key} sobrevive a toPublicCv`)
  process.exit(1)
}

/**
 * Comprobacion 2 — por valor, sobre los artefactos.
 *
 * Solo cuenta como fuga un valor que NO aparece legitimamente en ningun campo publico del
 * documento. Sin ese matiz el gate daria falsos positivos constantes: `person.location` es
 * publica y suele contener la ciudad que tambien aparece en la direccion privada, y a un
 * gate que no se puede distinguir de un fallo real se acaba desactivando — que es peor que no
 * tenerlo. Aqui la colision se reporta como aviso.
 */
const publicValues = new Set()
const collectPublic = (value) => {
  if (typeof value === 'string') publicValues.add(value.trim())
  else if (Array.isArray(value)) value.forEach(collectPublic)
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (!k.endsWith('Visibility')) collectPublic(v)
  }
}
collectPublic(publicDoc)

const ambiguous = secrets.filter((s) => publicValues.has(s.value))

// `RF-27` / `ADR-0006`: el email de contacto puede entregarse al cliente como canal publico
// designado (`PUBLIC_CONTACT_EMAIL`), para el revelado bajo interaccion. Se excluye del escaneo
// de fugas, pero es la UNICA excepcion y solo si el valor coincide con el declarado publico.
const publicContactEmail = (process.env.PUBLIC_CONTACT_EMAIL ?? '').trim()
const isDesignatedPublic = (value) => publicContactEmail !== '' && value === publicContactEmail
const uniq = secrets.filter((s) => !publicValues.has(s.value) && !isDesignatedPublic(s.value))
if (secrets.some((s) => isDesignatedPublic(s.value))) {
  console.log('  · contact.email tratado como canal publico designado (RF-27, ADR-0006)')
}

const artefacts = walk(DIST).filter((f) => /\.(?:html|json|js|css|xml|txt|webmanifest)$/.test(f))
const leaks = []

for (const file of artefacts) {
  const rel = relative(ROOT, file)
  const text = readFileSync(file, 'utf8')
  for (const secret of uniq) {
    if (text.includes(secret.value)) {
      leaks.push({ file: rel, label: secret.label })
    }
  }
}

if (leaks.length > 0) {
  console.error(
    `\n  GATE SEG-32: ${leaks.length} fuga(s) de campo private en artefactos de cliente.\n`,
  )
  for (const leak of leaks) console.error(`  ${leak.file}  contiene ${leak.label}`)
  console.error(
    '\n  SEG-31: los campos private se eliminan en build. Ocultarlos con CSS no cuenta.\n',
  )
  process.exit(1)
}

for (const s of ambiguous) {
  console.log(`  nota  ${s.label} comparte valor con un campo publico; no se puede discriminar`)
}
console.log(
  `  OK  SEG-32 — ${uniq.length} valor(es) private comprobados, 0 fugas en ${artefacts.length} artefacto(s)` +
    (ambiguous.length > 0 ? ` · ${ambiguous.length} ambiguo(s) por valor compartido` : ''),
)
