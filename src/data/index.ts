/**
 * Punto unico de acceso al CV — `DEC-03.a`.
 *
 * Todo el sistema (UI, JSON-LD, exportadores, RAG del chat) entra por aqui. Ningun modulo
 * importa `cv.fixture.ts` directamente: si lo hiciera, la garantia de `toPublicCv` se
 * desvaneceria en cuanto alguien escribiera un import.
 *
 * `CV_DATA_SOURCE` decide el origen (`ADR-0003`):
 *   - `fixture`  → `cv.fixture.ts`, datos semilla marcados.
 *   - `real`     → `cv.real.ts` (gitignored, `SEG-30`).
 *   - `missing`  → error explicito, para probar el camino de fallo.
 *
 * En un build que se despliega, `astro.config.mjs` ya ha rechazado cualquier valor distinto de
 * `real`. Este modulo es la segunda comprobacion, deliberadamente independiente: una sola
 * comprobacion es un unico punto de fallo.
 *
 * Nota de implementacion: la carga del documento usa `import.meta.glob`, no `import()`. Un
 * `import()` con ruta literal lo resuelve Rollup en tiempo de build y falla si el fichero no
 * existe — que es justo el caso normal, porque `cv.real.ts` esta gitignored (`SEG-30`). El
 * glob no falla cuando el patron no casa con nada: simplemente no lo incluye.
 */

import { parseCv, toPublicCv, type CvIssue } from '../lib/cv/validate.ts'
import { dataSource, type DataSource } from '../lib/env.ts'
import type { PublicCvDocument } from './schema.ts'

export type { DataSource }

export interface CvContext {
  /** Documento ya validado y ya sin campos privados. Seguro para el cliente. */
  readonly cv: PublicCvDocument
  readonly source: DataSource
  /** `true` si los datos son semilla. La UI lo muestra; el gate de produccion lo prohibe. */
  readonly isFixture: boolean
  /**
   * Incidencias no bloqueantes (p. ej. solapes de `RND-02`, que son legitimos pero conviene
   * que se vean). Las bloqueantes hacen que `cv` no exista.
   */
  readonly issues: readonly CvIssue[]
}

/**
 * Modulos de dato disponibles, resueltos en build. `cv.real.ts` solo aparece si existe:
 * esta gitignored (`SEG-30`) y en un checkout limpio no esta.
 */
const DATA_MODULES = import.meta.glob<{ readonly cvFixture?: unknown; readonly cv?: unknown }>(
  './cv.*.ts',
  { eager: true },
)

function moduleFor(source: Exclude<DataSource, 'missing'>): unknown {
  const path = `./cv.${source}.ts`
  const mod = DATA_MODULES[path]
  if (mod === undefined) {
    if (source === 'real') {
      throw new Error(
        '[ADR-0003] CV_DATA_SOURCE=real pero falta src/data/cv.real.ts. ' +
          'Es el fichero que se gitignora por ser PII (SEG-30). ' +
          'Copia src/data/cv.fixture.ts como punto de partida y rellena los datos reales.',
      )
    }
    throw new Error(`[ADR-0003] No hay modulo de datos para "${source}" (${path}).`)
  }
  const document = mod.cv ?? mod.cvFixture
  if (document === undefined) {
    throw new Error(`[ADR-0003] ${path} no exporta ni \`cv\` ni \`cvFixture\`.`)
  }
  return document
}

function loadDocument(source: DataSource): unknown {
  if (source === 'missing') {
    throw new Error('[ADR-0003] CV_DATA_SOURCE=missing. No hay documento que cargar.')
  }
  return moduleFor(source)
}

let cached: CvContext | null = null

/**
 * Devuelve el CV validado y sin campos privados.
 *
 * Falla ruidosamente si el documento no valida: un CV invalido no despliega (`DEC-03.c`).
 * Los problemas se acumulan para que un solo build muestre todos, no solo el primero.
 */
export function getCv(): CvContext {
  if (cached !== null) return cached

  const source = dataSource()
  const raw = loadDocument(source)
  const parsed = parseCv(raw)

  if (!parsed.ok) {
    const detail = parsed.issues
      .map((i) => `  [${i.requirement}] ${i.path}: ${i.message}`)
      .join('\n')
    throw new Error(
      `[DEC-03.c] El CV no valida el schema. ${parsed.issues.length} problema(s):\n${detail}`,
    )
  }

  const blocking = parsed.issues.filter((i) => i.requirement !== 'RND-02')
  if (blocking.length > 0) {
    const detail = blocking.map((i) => `  [${i.requirement}] ${i.path}: ${i.message}`).join('\n')
    throw new Error(
      `[DEC-03.c] El CV valida el schema pero viola ${blocking.length} regla(s) de integridad:\n${detail}`,
    )
  }

  cached = {
    cv: toPublicCv(parsed.cv),
    source,
    isFixture: source === 'fixture',
    issues: parsed.issues,
  }
  return cached
}

export { toPublicCv, parseCv } from '../lib/cv/validate.ts'
export type { CvDocument, PublicCvDocument } from './schema.ts'
export { STACK_LEVELS } from './schema.ts'
