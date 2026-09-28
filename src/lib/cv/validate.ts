/**
 * Validacion del CV y eliminacion de campos privados — `DEC-03.c`, `SEG-31`, `RND-02..05`.
 *
 * Dos responsabilidades separadas a proposito:
 *
 * 1. `parseCv` ejecuta el schema **y las reglas que el schema no puede expresses** (coherencia
 *    temporal entre nodos, solapes, unicidad de ids, `RND-02`). Se llama en build y en CI.
 * 2. `toPublicCv` produce el objeto que llega al cliente, con los nodos `private` **eliminados**.
 *    No ocultos con CSS: eliminados (`SEG-31`). Se llama una vez, aqui, y su salida es lo
 *    unico que consume el resto del sistema.
 *
 * La distincion importa: si un consumidor puede leer el objeto original, la eliminacion de
 * privados deja de ser una garantia y pasa a ser una convencion. `SEG-32` verifica en CI que
 * ningun artefacto contiene lo que esta funcion tira.
 */

import { cvDocument, type CvDocument, type PublicCvDocument } from '../../data/schema.ts'

/* ------------------------------------------------------------------ *
 * Fechas
 * ------------------------------------------------------------------ */

/** `YYYY-MM` -> indice de mes. Devuelve `undefined` si la cadena no es valida. */
export function monthIndex(iso: string): number | undefined {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(iso.slice(0, 7))
  if (match === null) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  if (year === undefined || month === undefined) return undefined
  return year * 12 + (month - 1)
}

/** Meses entre dos fechas ISO reducidas. `end - start`, en meses enteros. */
export function monthsBetween(startIso: string, endIso: string): number | undefined {
  const from = monthIndex(startIso)
  const to = monthIndex(endIso)
  if (from === undefined || to === undefined) return undefined
  return to - from
}

/**
 * `RF-23`: "3 anos 7 meses" a partir de dos fechas ISO. Sin fechas hardcodeadas.
 * Devuelve el texto relativo; el absoluto lo compone el presentador.
 */
export function formatDuration(startIso: string, endIso: string | null, now: Date): string {
  const end = endIso ?? now.toISOString().slice(0, 7)
  const months = monthsBetween(startIso, end)
  if (months === undefined) return ''
  if (months <= 0) return 'menos de un mes'

  const years = Math.floor(months / 12)
  const rest = months % 12
  const yearPart = years === 1 ? '1 ano' : `${years} anos`
  if (rest === 0) return yearPart
  return `${yearPart} ${rest} ${rest === 1 ? 'mes' : 'meses'}`
}

/** `RF-23`: "Mar 2022 - Presente". */
export function formatRange(startIso: string, endIso: string | null): string {
  const format = (iso: string): string => {
    const [year, month] = iso.slice(0, 7).split('-') as [string, string]
    const months = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ]
    const name = months[Number(month) - 1] ?? ''
    return `${name} ${year}`
  }
  return endIso === null
    ? `${format(startIso)} – Presente`
    : `${format(startIso)} – ${format(endIso)}`
}

/* ------------------------------------------------------------------ *
 * Reglas que el schema no puede expresar
 * ------------------------------------------------------------------ */

export interface CvIssue {
  /** Ruta legible: `roles[2].highlights[0].metric`. */
  path: string
  message: string
  /** Requisito del spec que esta regla implementa. */
  requirement: string
}

const issue = (path: string, message: string, requirement: string): CvIssue => ({
  path,
  message,
  requirement,
})

/**
 * Reglas de integridad que dependen de **mas de un nodo** o del calendario. Zod no las
 * cubre bien (o no las cubre), asi que viven aqui y son parte del gate igual que el schema.
 */
function collectIntegrityIssues(cv: CvDocument, now: Date): CvIssue[] {
  const issues: CvIssue[] = []
  const nowMonth = now.toISOString().slice(0, 7)

  // --- Unicidad de ids en cada coleccion ---
  const collections = {
    roles: cv.roles,
    projects: cv.projects,
    education: cv.education,
    certifications: cv.certifications,
    publications: cv.publications,
    stack: cv.stack,
  } as const

  for (const [name, items] of Object.entries(collections)) {
    const seen = new Set<string>()
    items.forEach((item, index) => {
      if (seen.has(item.id)) {
        issues.push(issue(`${name}[${index}].id`, `id duplicado "${item.id}"`, 'RND-05'))
      }
      seen.add(item.id)
    })
  }

  // --- `RND-03`: fin posterior a inicio, en todos los roles y proyectos ---
  for (const [index, r] of cv.roles.entries()) {
    if (r.end !== null) {
      const months = monthsBetween(r.start, r.end)
      if (months === undefined) {
        issues.push(issue(`roles[${index}]`, `fechas no parseables`, 'RND-03'))
      } else if (months <= 0) {
        issues.push(
          issue(
            `roles[${index}]`,
            `fin "${r.end}" no es posterior a inicio "${r.start}"`,
            'RND-03',
          ),
        )
      }
    }
  }

  for (const [index, p] of cv.projects.entries()) {
    if (p.end !== null) {
      const months = monthsBetween(p.start, p.end)
      if (months !== undefined && months <= 0) {
        issues.push(
          issue(
            `projects[${index}]`,
            `fin "${p.end}" no es posterior a inicio "${p.start}"`,
            'RND-03',
          ),
        )
      }
    }
  }

  // --- `RND-03`: sin fechas futuras ---
  for (const [name, items] of Object.entries(collections)) {
    items.forEach((item, index) => {
      const start = 'start' in item ? item.start : undefined
      const end = 'end' in item ? item.end : undefined
      const date = 'date' in item ? item.date : undefined
      for (const [field, value] of [
        ['start', start],
        ['end', end],
        ['date', date],
      ] as const) {
        if (value !== undefined && value !== null && value.slice(0, 7) > nowMonth) {
          issues.push(issue(`${name}[${index}].${field}`, `fecha futura "${value}"`, 'RND-03'))
        }
      }
    })
  }

  for (const [index, c] of cv.certifications.entries()) {
    if (c.expires !== null && c.expires.slice(0, 7) < nowMonth) {
      issues.push(issue(`certifications[${index}].expires`, `caducada (${c.expires})`, 'RND-03'))
    }
  }

  // --- `RND-04`: el CV no puede llevar mas de 6 meses sin revisarse ---
  const reviewedMonths = monthsBetween(cv.lastReviewed, nowMonth)
  if (reviewedMonths === undefined) {
    issues.push(issue('lastReviewed', 'fecha no parseable', 'RND-04'))
  } else if (reviewedMonths > 6) {
    issues.push(
      issue(
        'lastReviewed',
        `revisado hace ${reviewedMonths} meses, el maximo es 6 (RND-04)`,
        'RND-04',
      ),
    )
  }

  // --- `RND-02`: los anos de experiencia se derivan de solapes reales, no de aritmetica ingenua ---
  // Regla: un mismo mes no puede contar dos veces. Si dos roles se solapan en el tiempo, la
  // suma de sus duraciones excede el tiempo realmente trabajado.
  const spans = cv.roles.map((r, index) => {
    const from = monthIndex(r.start)
    const to = monthIndex(r.end ?? nowMonth)
    return from !== undefined && to !== undefined ? { index, from, to } : null
  })
  const valid = spans.filter((s): s is { index: number; from: number; to: number } => s !== null)

  const naive = valid.reduce((sum, s) => sum + (s.to - s.from), 0)
  const covered = new Set<number>()
  for (const span of valid) {
    for (let m = span.from; m < span.to; m += 1) covered.add(m)
  }
  const actual = covered.size

  if (naive > actual) {
    // No es un error: solapar roles es legitimo (consultoria, proyectos propios). Se reporta
    // para que el dato de "anos de experiencia" que se muestra sea el real y no la suma.
    issues.push(
      issue(
        'roles',
        `solape detectado: ${naive} meses naivos vs ${actual} meses reales. ` +
          `RND-02 exige mostrar ${actual / 12} anos, no ${(naive / 12).toFixed(1)}`,
        'RND-02',
      ),
    )
  }

  // --- `RF-21`: la metrica de un logro debe ser verificable (`RND-07`) ---
  cv.roles.forEach((r, roleIndex) => {
    r.highlights.forEach((h, hIndex) => {
      if (h.metric.evidence === undefined) {
        issues.push(
          issue(
            `roles[${roleIndex}].highlights[${hIndex}].metric.evidence`,
            'metrica sin evidencia enlazada (RND-07). Sin enlace, la cifra es una opinion',
            'RF-21',
          ),
        )
      }
    })
  })

  // --- `RF-20` / `RND-06`: el resumen no puede desbordar el presupuesto de la escena ---
  if (cv.summary.length > 280) {
    issues.push(issue('summary', `supera los 280 caracteres`, 'RND-06'))
  }

  return issues
}

/* ------------------------------------------------------------------ *
 * Entrada publica
 * ------------------------------------------------------------------ */

export type ParsedCv =
  { ok: true; cv: CvDocument; issues: CvIssue[] } | { ok: false; issues: CvIssue[] }

/**
 * Valida un documento CV. Devuelve los problemas en vez de lanzar, porque el gate de build
 * necesita **todos** los fallos de una vez, no solo el primero.
 */
export function parseCv(input: unknown, now: Date = new Date()): ParsedCv {
  const result = cvDocument.safeParse(input)

  if (!result.success) {
    const issues: CvIssue[] = result.error.issues.map((i) =>
      issue(i.path.join('.'), i.message, i.code === 'unrecognized_keys' ? 'RND-05' : 'RF-20'),
    )
    return { ok: false, issues }
  }

  const issues = collectIntegrityIssues(result.data, now)
  return { ok: true, cv: result.data, issues }
}

/**
 * Elimina lo `private` — `SEG-31`.
 *
 * El email y el resto de campos privados **no se filtran ni se enmascaran**: desaparecen del
 * objeto. Quien necesite mostrarlos (la escena de contacto) los obtiene por una via distinta y
 * explicita, no leyendo el documento original. `SEG-32` falla el build si un artefacto de
 * cliente los contiene.
 */
export function toPublicCv(cv: CvDocument): PublicCvDocument {
  return {
    ...cv,
    // Los roles y proyectos `private` se eliminan; los `redacted` se conservan (capacidad
    // reservada, `ABR-06`; su sustitucion de campos la hace el presentador, no este modulo).
    roles: cv.roles.filter((r) => r.visibility !== 'private'),
    projects: cv.projects.filter((p) => p.visibility !== 'private'),
    contact: {
      emailVisibility: 'private',
      ...(cv.contact.locationVisibility === undefined
        ? {}
        : { locationVisibility: cv.contact.locationVisibility }),
    },
  }
}

/* ------------------------------------------------------------------ *
 * Derivados — `RF-23`, `RND-02`
 * ------------------------------------------------------------------ */

/**
 * Anos de experiencia: union de los intervalos, en meses, convertidos a anos con una
 * decimal. `RND-02` define esta operacion y obliga a que UI, chat y PDF usen la misma.
 *
 * Acepta `PublicCvDocument` porque es lo que la UI tiene a mano: el email no interviene, y
 * atar el calculo al documento privado haria que cada presentador leyera el original.
 */
export function totalExperienceMonths(cv: PublicCvDocument, now: Date = new Date()): number {
  const nowMonth = now.toISOString().slice(0, 7)
  const covered = new Set<number>()
  for (const r of cv.roles) {
    const from = monthIndex(r.start)
    const to = monthIndex(r.end ?? nowMonth)
    if (from === undefined || to === undefined) continue
    for (let m = from; m < to; m += 1) covered.add(m)
  }
  return covered.size
}

/** Redondeo a 1 decimal, para mostrar "4.3 anos" y no "4 anos 3 meses y 18 dias". */
export function yearsFrom(months: number): string {
  return (months / 12).toFixed(1)
}
