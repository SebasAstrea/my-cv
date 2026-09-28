/**
 * Sincroniza los clips del Sprint 5 desde `src/data/` (temporal) a `public/clips/`, y genera
 * los posters (primer frame) en AVIF con `ffmpeg`.
 *
 * Por que una copia y no un import de Vite: los clips son **temporales** y estan gitignored, asi
 * que un import de un fichero ausente romperia el build de despliegue. Aqui, si no hay clips, el
 * script no hace nada y el sitio degrada a poster/fondo (`RF-43`), pero el build no falla.
 *
 * Los nombres se mantienen `videoN.mp4` (`N` = 1..7) y los posters `posterN.avif`. `gate:budgets`
 * mide los posters (`RNF-11` <= 70 KB) porque casan `poster*`, y NO mide los clips porque no
 * casan `sc0N-*` (a proposito: son provisionales).
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src/data')
const OUT = join(ROOT, 'public/clips')
const COUNT = 7

let ffmpeg = false
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  ffmpeg = true
} catch {
  ffmpeg = false
}

mkdirSync(OUT, { recursive: true })

let copied = 0
let generated = 0
let present = 0

for (let i = 1; i <= COUNT; i += 1) {
  const src = join(SRC, `video${i}.mp4`)
  if (!existsSync(src)) continue
  present += 1

  const dst = join(OUT, `video${i}.mp4`)
  if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) {
    copyFileSync(src, dst)
    copied += 1
  }

  const poster = join(OUT, `poster${i}.avif`)
  const stale = !existsSync(poster) || statSync(poster).mtimeMs < statSync(src).mtimeMs
  if (ffmpeg && stale) {
    try {
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-loglevel',
          'error',
          '-i',
          src,
          '-frames:v',
          '1',
          '-vf',
          'scale=1280:-2',
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
      // Sin ffmpeg o sin encoder AVIF: el poster se omite; el video sigue sirviendo.
    }
  }
}

if (present === 0) {
  console.log('  · clips: sin material en src/data (temporal); se omite la sincronizacion')
} else {
  console.log(
    `  · clips: ${present}/${COUNT} presentes, ${copied} copiados a public/clips, ${generated} posters generados`,
  )
}
