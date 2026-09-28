/**
 * Pruebas de los exportadores — `RNF-100`, `RND-08`, `RNF-33` (`TD-01`).
 *
 * `TD-01` decia que el Sprint 1 no tenia logica con ramas y que un test sin gate era
 * decorativo. El Sprint 2 anade logica de presentacion, asi que la deuda se cierra aqui: la
 * prueba corre dentro de `pnpm test`, que ya es un paso de `pnpm gate`.
 *
 * El documento de prueba es el fixture: el CV real es PII y no puede entrar en la suite
 * (`SEG-30`). Los formatos no dependen del contenido, solo de la forma del documento.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { cvFixture } from '../src/data/cv.fixture.ts'
import {
  buildPersonJsonLd,
  toJson,
  toJsonLd,
  toMarkdown,
  toPlainText,
} from '../src/lib/cv/exporters.ts'
import { toPublicCv } from '../src/lib/cv/validate.ts'

const cv = toPublicCv(cvFixture)
// Fecha fija: los formatos incluyen duraciones y "anos de experiencia" (`RF-23`, `RND-02`).
const ctx = { url: 'https://example.invalid/', now: new Date(2024, 5, 15, 12, 0, 0) }

describe('buildPersonJsonLd', () => {
  test('declara Person con hasOccupation de tipo Occupation', () => {
    const ld = buildPersonJsonLd(cv, ctx)
    assert.equal(ld['@type'], 'Person')
    const occupation = ld.hasOccupation as Record<string, unknown>
    assert.equal(occupation['@type'], 'Occupation')
  })

  test('el name es el de la persona y la url la del contexto', () => {
    const ld = buildPersonJsonLd(cv, ctx)
    assert.equal(ld.name, cv.person.name)
    assert.equal(ld.url, ctx.url)
  })
})

describe('toJson', () => {
  test('ida y vuelta sin perdida y sin el email privado', () => {
    const parsed = JSON.parse(toJson(cv)) as Record<string, unknown>
    assert.equal(parsed.summary, cv.summary)
    const contact = parsed.contact as Record<string, unknown>
    assert.equal('email' in contact, false)
  })
})

describe('toJsonLd', () => {
  test('es JSON valido con @context de schema.org', () => {
    const parsed = JSON.parse(toJsonLd(cv, ctx)) as Record<string, unknown>
    assert.equal(parsed['@context'], 'https://schema.org')
    assert.equal(parsed['@type'], 'Person')
  })
})

describe('toMarkdown', () => {
  test('incluye la persona, la primera seccion y cada proyecto', () => {
    const md = toMarkdown(cv, ctx)
    assert.ok(md.includes(cv.person.name), 'falta el nombre de la persona')
    assert.ok(md.includes('## Experiencia'), 'falta la seccion de experiencia')
    for (const project of cv.projects) {
      assert.ok(md.includes(project.name), `falta el proyecto ${project.name}`)
    }
  })
})

describe('toPlainText', () => {
  test('es autosuficiente y sin sintaxis Markdown', () => {
    const txt = toPlainText(cv, ctx)
    assert.ok(txt.includes(cv.person.name), 'falta el nombre de la persona')
    assert.ok(txt.includes(cv.lastReviewed), 'falta la fecha de revision')
    assert.doesNotMatch(txt, /^#/m, 'el texto plano no debe contener encabezados Markdown')
  })
})
