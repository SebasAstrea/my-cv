/**
 * Clips de la línea temporal — `DEC-02`, `RF-40`.
 *
 * Los clips son **temporales** (Sprint 5) y viven, en el build, en `/clips/` servidos desde
 * `public/` (los sincroniza `scripts/sync-clips.mjs` desde `src/data/`). El mapeo es por orden
 * de escena: `video1.mp4` -> escena 00, ..., `video7.mp4` -> escena 06.
 *
 * Cuando lleguen los clips definitivos, este modulo seguira apuntando a `/clips/` y solo cambia
 * el material, no la UI.
 */

export const CLIPS_DIR = '/clips'

/** Numero de escenas con clip (una por escena, `RF-40`). */
export const CLIP_COUNT = 7

function file(index: number, kind: 'video' | 'poster', ext: string): string {
  if (index < 0 || index >= CLIP_COUNT) return ''
  return `${CLIPS_DIR}/${kind}${index + 1}.${ext}`
}

/** URL del clip de una escena por su indice (0-based). */
export function clipUrl(index: number): string {
  return file(index, 'video', 'mp4')
}

/** URL del poster (primer frame, AVIF) de una escena por su indice. */
export function posterUrl(index: number): string {
  return file(index, 'poster', 'avif')
}
