/**
 * Clips de la línea temporal — `DEC-02`, `RF-40`.
 *
 * Los clips definitivos viven, en el build, en `/clips/` servidos desde `public/` (versionados).
 * El mapeo es por orden de escena: `video1.webm` -> escena 00, ..., `video7.webm` -> escena 06.
 * Formato: WebM/VP9 sin audio, CRF 50; posters WebP (primer frame) derivados por
 * `scripts/make-posters.mjs`.
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
  return file(index, 'video', 'webm')
}

/** URL del poster (primer frame, WebP) de una escena por su indice. */
export function posterUrl(index: number): string {
  return file(index, 'poster', 'webp')
}
