#!/usr/bin/env node
/**
 * Materializa `src/data/cv.real.ts` en un build remoto (Vercel / Cloudflare Pages).
 *
 * El CV real es PII y esta gitignored (`SEG-30`), asi que un checkout limpio no lo tiene y
 * `astro build` falla con `[ADR-0003]` — que es lo correcto. Para desplegar desde Git sin
 * versionar el fichero, el proyecto guarda su contenido como secreto de build y este script
 * lo escribe antes de `astro build`:
 *
 *   - `CV_REAL_B64`  el `cv.real.ts` completo, en base64. Via fiel (comentarios incluidos).
 *   - `CV_REAL_JSON` el `CvDocument` como JSON; se envuelve en `cvDocument.parse(...)`.
 *
 * En local no hace nada si el fichero ya existe: no pisa el CV real del propietario.
 *
 * La alternativa sin secretos es construir en local y subir `dist/` (`wrangler pages deploy`
 * o `vercel deploy --prebuilt`); ver `docs/STATUS.md` §1.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const target = join(ROOT, 'src/data/cv.real.ts')

if (existsSync(target)) {
  console.log('  · src/data/cv.real.ts ya existe; no se toca.')
  process.exit(0)
}

const b64 = process.env.CV_REAL_B64
const json = process.env.CV_REAL_JSON

let content = ''
if (b64 !== undefined && b64.trim() !== '') {
  content = Buffer.from(b64, 'base64').toString('utf8')
} else if (json !== undefined && json.trim() !== '') {
  // Se parsea antes de escribir para fallar aqui, con un mensaje claro, y no dentro de Astro.
  const parsed = JSON.parse(json)
  content =
    '/** Generado en build desde CV_REAL_JSON. No versionar (PII, `SEG-30`). */\n' +
    "import { cvDocument } from './schema.ts'\n\n" +
    `export const cv = cvDocument.parse(${JSON.stringify(parsed, null, 2)})\n`
} else {
  console.error(
    '\n  [deploy] Falta src/data/cv.real.ts y no hay CV_REAL_B64 ni CV_REAL_JSON.\n' +
      '  Define uno de los dos secretos del proyecto, o construye en local y sube dist/.\n',
  )
  process.exit(1)
}

mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, content, 'utf8')
console.log('  · src/data/cv.real.ts escrito desde el secreto de build.')
