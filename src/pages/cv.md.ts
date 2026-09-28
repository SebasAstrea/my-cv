/**
 * Exportador Markdown — `RNF-100`. Genera `/cv.md` en build.
 *
 * Version legible por humanos y por LLMs: la misma jerarquia de secciones que la pagina.
 */

import type { APIRoute } from 'astro'

import { getCv } from '../data/index.ts'
import { toMarkdown } from '../lib/cv/exporters.ts'
import { siteUrl } from '../lib/env.ts'

export const prerender = true

export const GET: APIRoute = () => {
  const { cv } = getCv()
  const url = new URL('/', siteUrl()).toString()
  return new Response(toMarkdown(cv, { url, now: new Date() }), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  })
}
