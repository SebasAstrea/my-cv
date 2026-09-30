#!/usr/bin/env node
/**
 * Exporta el `cv.real.ts` local como JSON para `CV_REAL_JSON` de Vercel.
 *
 * Por que existe: el CV real es PII y esta gitignored (`SEG-30`), asi que Vercel no lo recibe
 * por git. `vercel.json` lo materializa desde el secreto `CV_REAL_JSON` (o `CV_REAL_B64`) antes
 * de construir:
 *
 *   "buildCommand": "node scripts/write-real-cv.mjs && CV_DATA_SOURCE=real pnpm build"
 *
 * Editar ese secreto a mano es incomodo. Este script lo genera desde el fichero que si se edita
 * con comodidad (tu editor, con tipos y validacion del schema).
 *
 * Flujo completo:
 *   1. Editas `src/data/cv.real.ts` en local.
 *   2. `pnpm cv:json` y copias la salida.
 *   3. La pegas en Vercel -> Settings -> Environment Variables -> `CV_REAL_JSON`.
 *   4. Redeploy.
 *
 * `cv` ya paso por `cvDocument.parse()`, asi que volver a meterlo en `parse()` es idempotente:
 * el JSON de salida es valido como entrada.
 *
 * El import es dinamico a proposito: `cv.real.ts` no existe en un checkout limpio (esta
 * gitignored), y un import estatico daria un error de modulo ilegible en vez del aviso de abajo.
 */

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ruta = fileURLToPath(new URL('../src/data/cv.real.ts', import.meta.url))

if (!existsSync(ruta)) {
  console.error(
    '\n  Falta src/data/cv.real.ts.\n' +
      '  Esta gitignored (PII, `SEG-30`), asi que en un checkout limpio no esta.\n' +
      '  Crealo antes de exportar.\n',
  )
  process.exit(1)
}

const modulo = await import(ruta)
const cv = modulo.cv
if (cv === undefined) {
  console.error('\n  src/data/cv.real.ts no exporta `cv`. Revisa el fichero.\n')
  process.exit(1)
}

process.stdout.write(`${JSON.stringify(cv, null, 2)}\n`)
