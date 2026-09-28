/**
 * Exportador JSON-LD — `RNF-100`, `RNF-33`. Genera `/cv.jsonld` en build.
 *
 * Es el mismo objeto `Person` que se incrusta en `<head>`, servido como fichero: un ATS que no
 * ejecute JS puede descargarlo y parsearlo sin depender del HTML.
 */

import type { APIRoute } from 'astro'

import { getCv } from '../data/index.ts'
import { toJsonLd } from '../lib/cv/exporters.ts'
import { siteUrl } from '../lib/env.ts'

export const prerender = true

export const GET: APIRoute = () => {
  const { cv } = getCv()
  const url = new URL('/', siteUrl()).toString()
  return new Response(toJsonLd(cv, { url, now: new Date() }), {
    headers: { 'content-type': 'application/ld+json; charset=utf-8' },
  })
}
