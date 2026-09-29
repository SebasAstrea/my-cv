/**
 * `POST /api/chat` — `ADR-0008`.
 *
 * Ruta de Astro: 12 lineas de cableado y nada mas. Toda la logica esta en
 * `src/lib/chat/handler.ts`, que no importa nada de Astro, para que `gate:chat` pueda
 * ejecutarla en Node sin Vite (`getCv()` usa `import.meta.glob`).
 *
 * El sitio sigue siendo `output: 'static'` (`ADR-0001`): `prerender = false` es lo unico que
 * convierte esta ruta en funcion, y nada mas del proyecto depende del adaptador. El adaptador es
 * lo que permite que exista esta ruta; no lo que convierte las paginas en SSR.
 */

import type { APIRoute } from 'astro'
import { getCv } from '../../data/index.ts'
import { buildAllowlist, buildChunks } from '../../lib/chat/chunks.ts'
import { createChatHandler } from '../../lib/chat/handler.ts'

export const prerender = false

/**
 * El corpus se construye por peticion, no al importar el modulo: `getCv()` ya cachea, y asi el
 * handler sigue siendo correcto si el documento cambia entre invocaciones.
 */
export const POST: APIRoute = createChatHandler(() => {
  const chunks = buildChunks(getCv().cv)
  return { chunks, allowlist: buildAllowlist(chunks) }
})
