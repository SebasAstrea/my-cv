/**
 * Exportador JSON — `RNF-100`. Genera `/cv.json` en build.
 *
 * Es el mismo `PublicCvDocument` que pinta la UI (`DEC-03.a`): sin campos privados porque
 * `getCv()` ya paso por `toPublicCv` (`SEG-31`), y por tanto no hay PII en el artefacto.
 */

import type { APIRoute } from 'astro'

import { getCv } from '../data/index.ts'
import { toJson } from '../lib/cv/exporters.ts'

export const prerender = true

export const GET: APIRoute = () => {
  const { cv } = getCv()
  return new Response(toJson(cv), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
