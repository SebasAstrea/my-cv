/**
 * Genera los posters WebP (primer frame) de los clips de `public/clips/`.
 *
 * Los clips definitivos ya viven en `public/clips/` (se versionan). Este script solo deriva el
 * poster `posterN.webp` de cada `videoN.webm` con `ffmpeg`, y solo si falta o esta caduco. No
 * toca los clips: re-codificarlos a ciegas seria destruir el master.
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
  const clip = join(DIR, `video${i}.webm`)
  if (!existsSync(clip)) continue
  present += 1

  const poster = join(DIR, `poster${i}.webp`)
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
          'libwebp',
          '-quality',
          '60',
          '-compression_level',
          '6',
          '-preset',
          'picture',
          '-f',
          'webp',
          poster,
        ],
        { stdio: 'ignore' },
      )
      generated += 1
    } catch {
      // sin ffmpeg o sin encoder WebP: el poster se omite
    }
  }
}

console.log(
  present === 0
    ? '  · posters: sin clips en public/clips'
    : `  · posters: ${present}/${COUNT} clips, ${generated} generados`,
)
