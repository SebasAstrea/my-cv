/**
 * Exportador de texto plano — `RNF-100`, `RND-08`. Genera `/cv.txt` en build.
 *
 * Es la garantia de `RND-08`: el CV completo se obtiene sin JS y sin video. Si todo lo demas
 * fallara, este fichero sigue siendo el CV.
 */

import type { APIRoute } from 'astro'

import { getCv } from '../data/index.ts'
import { toPlainText } from '../lib/cv/exporters.ts'
import { siteUrl } from '../lib/env.ts'

export const prerender = true

export const GET: APIRoute = () => {
  const { cv } = getCv()
  const url = new URL('/', siteUrl()).toString()
  return new Response(toPlainText(cv, { url, now: new Date() }), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
