/**
 * Donde vive el sitio estatico construido.
 *
 * Sin este modulo, cada gate hacia `join(ROOT, 'dist')` por su cuenta. Con el adaptador de
 * Vercel (`ADR-0008`) eso paso a ser **incorrecto**: Astro deja el HTML y los assets de
 * navegador en `dist/client/` y la funcion del chat en `.vercel/output/`. Un gate que apunta a
 * `dist/` encuentra un directorio sin `index.html` y, segun como este escrito, pasa sin mirar
 * nada. Un gate que no comprueba nada es peor que un gate roto: parece verdad.
 *
 * Por eso la ruta se resuelve una vez, aqui, y se falla ruidosamente si no hay sitio:
 *
 *   1. `dist/client` — build con adaptador (`pnpm build` en produccion)
 *   2. `dist`        — build estatico puro, sin adaptador
 *   3. error         — no hay build; el mensaje dice como rehacerlo
 *
 * El orden importa: si existen los dos, `dist/client` es el que se sirve, porque es lo que el
 * adaptador copia a `.vercel/output/static/`.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Raiz del repositorio. */
export const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** Candidato 1: build con adaptador de Vercel. */
const CON_ADAPTADOR = join(ROOT, 'dist', 'client')
/** Candidato 2: build estatico puro. */
const SIN_ADAPTADOR = join(ROOT, 'dist')

/**
 * Resuelve el directorio del sitio estatico, o lanza si no hay build.
 *
 * Se comprueba `index.html` y no solo que el directorio exista: un `dist/client/` a medio
 * generar es justo el caso en el que un gate mediria un sitio incompleto sin darse cuenta.
 */
export function staticDir() {
  for (const dir of [CON_ADAPTADOR, SIN_ADAPTADOR]) {
    if (existsSync(join(dir, 'index.html'))) return dir
  }
  throw new Error(
    `[GATE] No encuentro el sitio construido.\n` +
      `  Buscado: ${CON_ADAPTADOR}/index.html y ${SIN_ADAPTADOR}/index.html\n` +
      `  Ejecuta \`pnpm build\` antes de este gate.`,
  )
}
