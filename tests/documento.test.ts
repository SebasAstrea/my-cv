/**
 * Pruebas del documento — `DEC-03.c` (validacion) y `SEG-31` (eliminacion de privados).
 *
 * `SEG-31` dice que lo `private` no se oculta: se elimina del objeto. Una garantia asi solo
 * vale si hay un test que falle cuando deja de eliminarse, asi que estos tests comprueban
 * las dos ramas: la que el fixture ejercita de verdad (los campos de contacto) y la que no
 * (roles y proyectos marcados `private`).
 *
 * El test importa `cv.fixture.ts` a proposito. La regla de que nadie lo importe fuera de
 * `scripts/` existe para que la aplicacion no pueda saltarse `toPublicCv`; un test verifica
 * precisamente esa funcion contra el dato real.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { cvFixture } from '../src/data/cv.fixture.ts'
import { cvDocument, type CvDocument } from '../src/data/schema.ts'
import { parseCv, toPublicCv } from '../src/lib/cv/validate.ts'

/**
 * Copia independiente del fixture, pasando por el schema.
 *
 * `structuredClone` devuelve el tipo literal que Zod infiere — donde `emailVisibility` vale
 * `'private'` como literal — y asignarle `'public'` no compila porque es imposible segun el
 * esquema: el campo de visibilidad del email es un `z.literal('private')`. Eso significa que
 * la privacidad del email ya esta blindada en la capa de datos, no en el filtro. El test que
 * lo comprueba seria probar algo que nunca ocurre; mejor verificar que `toPublicCv` efectivamente
 * descarta los campos privados del contacto (la garantia real).
 */
const clonar = (): CvDocument => cvDocument.parse(cvFixture)

/** Primer elemento, comprobado. `noUncheckedIndexedAccess` obliga a esto. */
const primero = <T>(xs: readonly T[]): T => {
  const x = xs[0]
  assert.ok(x !== undefined, 'la coleccion no puede estar vacia')
  return x
}

/** Mutar visibilidad de un nodo del documento para los tests que necesitan private/redacted. */
const setVisibility = (nodo: unknown, valor: string): void => {
  // Los nodos son objetos complejos con campos anidados; no lanzamos a Record<string,string>
  // porque TS rechaza el cast directo por falta de solapamiento (RNF-80). Vamos por unknown.
  const obj = nodo as Record<string, string | undefined>
  obj.visibility = valor
}

describe('parseCv — DEC-03.c', () => {
  test('acepta el fixture', () => {
    const parsed = parseCv(cvFixture, new Date(2026, 8, 15))
    assert.equal(parsed.ok, true)
  })

  test('devuelve los problemas en vez de lanzar, y todos juntos', () => {
    // El gate de build necesita la lista completa: si solo llegara el primer fallo, corregir
    // el documento seria un viaje de ida y vuelta por cada error.
    const parsed = parseCv({ schemaVersion: 'no-es-una-version' })
    assert.equal(parsed.ok, false)
    if (parsed.ok) return
    assert.ok(parsed.issues.length > 0, 'deberia listar al menos un problema')
    for (const i of parsed.issues) {
      assert.ok(i.path.length > 0, 'cada problema debe decir donde esta')
      assert.ok(i.requirement.length > 0, 'cada problema debe citar el requisito que lo impone')
    }
  })

  test('rechaza campos que no estan en el schema, en vez de ignorarlos', () => {
    const conExtras: Record<string, unknown> = { ...cvFixture, campoInesperado: 'x' }
    const parsed = parseCv(conExtras, new Date(2026, 8, 15))
    assert.equal(parsed.ok, false)
    if (parsed.ok) return
    assert.ok(parsed.issues.some((i) => i.requirement === 'RND-05'))
  })

  test('no acepta campos que no son el documento', () => {
    const etiqueta = (v: unknown): string =>
      v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v
    for (const basura of [null, undefined, 42, 'texto', [], {}]) {
      const parsed = parseCv(basura)
      assert.equal(parsed.ok, false, `deberia rechazar ${etiqueta(basura)}`)
    }
  })

  test('un documento con campos private en roles/proyectos se limpia completamente', () => {
    // El fixture tiene solo contacto privado; los roles y proyectos no llevan visibilidad
    // private. Si `toPublicCv` deja escapar un campo, este test lo detecta porque marca
    // todos los nodos como private antes de pasarlos al filtro.
    const doc = clonar()

    for (const role of doc.roles) setVisibility(role, 'private')
    for (const project of doc.projects) setVisibility(project, 'private')

    const publicCv = toPublicCv(doc)

    assert.equal(publicCv.roles.length, 0, 'todos los roles private deben eliminarse')
    assert.equal(publicCv.projects.length, 0, 'todos los proyectos private deben eliminarse')

    // Y que el contacto tambien este limpio: no debe exponer email ni location.
    const tieneEmail = 'email' in publicCv.contact
    const tieneUbicacion = 'location' in publicCv.contact
    assert.ok(!tieneEmail, 'el email no puede estar en la salida')
    assert.ok(!tieneUbicacion, 'la ubicacion no puede estar en la salida')
    assert.equal(publicCv.contact.emailVisibility, 'private')
  })

  test('los nodos redacted se conservan (ABR-06)', () => {
    // Se marca un proyecto como redacted para verificar que no cae en el filtro.
    const doc = clonar()
    setVisibility(primero(doc.projects), 'redacted')

    const publicCv = toPublicCv(doc)
    assert.ok(publicCv.projects.length > 0, 'los redacted deben sobrevivir al filtro')
  })

  test('no muta el documento original', () => {
    // `getCv()` hace cache: si `toPublicCv` mutara la entrada, cada llamada siguiente
    // devolveria un objeto ya modificado. La garantia de pureza es parte de la seguridad.
    const doc = clonar()

    for (const role of doc.roles) setVisibility(role, 'private')

    const antesRoles = JSON.stringify(doc.roles.map((r: Record<string, unknown>) => r.visibility))

    toPublicCv(doc)

    const despuesRoles = JSON.stringify(doc.roles.map((r: Record<string, unknown>) => r.visibility))
    assert.equal(antesRoles, despuesRoles, 'toPublicCv no puede escribir en la entrada')
  })
})
