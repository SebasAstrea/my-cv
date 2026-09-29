/**
 * Genera los posters AVIF (primer frame) de los clips de `public/clips/`.
 *
 * Los clips definitivos ya viven en `public/clips/` (se versionan). Este script solo deriva el
 * poster `posterN.avif` de cada `videoN.mp4` con `ffmpeg`, y solo si falta o esta caduco. No
 * toca los clips: re-codificarlos a ciegas seria destruir el master.
 *
 * Antes copiaba los clips desde `src/data/` (cuando eran provisionales). Ya no: el material es
 * definitivo y su sitio es `public/clips/`.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIR = join(ROOT, 'public/clips')
const COUNT = 7

let ffmpeg = false
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  ffmpeg = true
} catch {
  ffmpeg = false
}

mkdirSync(DIR, { recursive: true })

let present = 0
let generated = 0

for (let i = 1; i <= COUNT; i += 1) {
  const clip = join(DIR, `video${i}.mp4`)
  if (!existsSync(clip)) continue
  present += 1

  const poster = join(DIR, `poster${i}.avif`)
  const stale = !existsSync(poster) || statSync(poster).mtimeMs < statSync(clip).mtimeMs
  if (ffmpeg && stale) {
    try {
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-loglevel',
          'error',
          '-i',
          clip,
          '-frames:v',
          '1',
          '-vf',
          'scale=960:-2',
          '-c:v',
          'libaom-av1',
          '-still-picture',
          '1',
          '-crf',
          '34',
          '-cpu-used',
          '6',
          '-f',
          'avif',
          poster,
        ],
        { stdio: 'ignore' },
      )
      generated += 1
    } catch {
      // sin ffmpeg o sin encoder AVIF: el poster se omite
    }
  }
}

console.log(
  present === 0
    ? '  · posters: sin clips en public/clips'
    : `  · posters: ${present}/${COUNT} clips, ${generated} generados`,
)
