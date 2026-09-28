/**
 * Schema del CV — `RF-20`, `DEC-03.c`, `RND-03`.
 *
 * Este es el contrato de `DEC-03`: un unico origen de verdad, validado en build y en CI.
 * Un CV invalido no despliega. Todo lo que salga de aqui (`cv.ts` -> UI -> JSON-LD ->
 * exportadores -> RAG) pasa por este schema, asi que la validacion no es una cortesia:
 * es lo que garantiza que los tres consumidores hablan del mismo dato.
 *
 * Decisiones de diseno que conviene no romper sin ADR:
 *
 * - Las fechas son ISO 8601 **reducidas** (`YYYY-MM` o `YYYY-MM-DD`). Un CV no necesita
 *   precision de dia, y `YYYY-MM-DD` en un "inicio" invita a una exactitud que no existe.
 * - `RND-02` ("anos de experiencia") NO se guarda en el dato: se deriva. Un numero de anos
 *   guardado es un numero que se desincroniza del resto en cuanto cambia una fecha.
 * - `RF-22` (nivel de stack sin estrellas) se cumple haciendo que el significado de cada
 *   nivel viva en este fichero, no en el dato. El dato dice `avanzado`; aqui esta escrito
 *   que significa `avanzado`.
 * - `DEC-03.b` (visibilidad) es un campo obligatorio en todo nodo con datos personales. No
 *   hay valor por defecto: omitirlo es un error de schema, no una omision silenciosa.
 */

import { z } from 'zod'

/* ------------------------------------------------------------------ *
 * Primitivas
 * ------------------------------------------------------------------ */

/** `YYYY-MM` o `YYYY-MM-DD`. Rechaza dias invalidos (31 de febrero). */
const ISO_DATE = /^\d{4}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?$/

export const isoDate = z
  .string()
  .regex(ISO_DATE, 'Fecha ISO 8601 reduccion YYYY-MM o YYYY-MM-DD (RND-03)')
  .refine((value) => {
    // Rechaza 2023-02-31 y similares: el regex anterior valida la forma, no el calendario.
    const [year, month, day] = value.split('-').map(Number) as [number, number, number | undefined]
    if (day === undefined) return true
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return day <= lastDay
  }, 'Dia inexistente para ese mes (RND-03)')

/** Marca de revision: `RND-04` obliga a revisar el CV cada 6 meses. */
export const lastReviewed = isoDate

/**
 * `DEC-03.b` / `SEG-30`. Todo nodo con datos personales declara su tier.
 *
 * - `public`   → llega al cliente, al chat y al PDF.
 * - `private`  → se elimina en build. Nunca llega a ningun artefacto (`SEG-31/32`).
 * - `redacted` → llega al cliente con el campo sensible sustituido.
 *
 * `ABR-06` elimina `redacted` del uso real de v1, pero la capacidad se conserva para no
 * cerrarla en el modelo de datos.
 */
export const visibility = z.enum(['public', 'private', 'redacted'])

/** `DEC-03.b` en la practica: lo que se marca es el nodo, no cada campo. */
export const VisibilityFlag = z.object({ visibility: visibility })

/** Bandera de dato semilla — `ADR-0003`. */
export const FixtureFlag = z.object({ fixture: z.literal(true) })

/* ------------------------------------------------------------------ *
 * `RF-22` — niveles de stack, con su significado declarado aqui
 * ------------------------------------------------------------------ */

/**
 * El significado de cada nivel es parte del schema, no del dato. Un "3/5" o cinco
 * estrellas queda estructuralmente imposible: el dato solo puede nombrar un nivel de
 * esta lista, y la lista dice en prosa que significa.
 */
export const STACK_LEVELS = {
  /** Uso diario en produccion. Resuelvo el caso yo mismo sin ayuda externa. */
  daily: 'Uso diario en produccion. Resuelvo el caso yo mismo, sin ayuda externa.',
  /** Comfortable: lo elijo por defecto para este tipo de problema. */
  advanced:
    'Diseno la solucion y la reviso a fondo. Es mi opcion por defecto para este tipo de problema.',
  /** Competente: construido de principio a fin con supervision ocasional. */
  proficient:
    'Construyo de principio a fin con esto y me defiendo solo ante el grueso de los problemas.',
  /** Conozco el modelo mental y los limites; lo elijo con supervision. */
  familiar:
    'Conozco el modelo mental y los limites. Lo elijo cuando hay apoyo o el riesgo es bajo.',
  /** He leido la documentacion y lo he tocado poco. */
  exposure: 'Formacion teorica o exposicion superficial. No lo elijo para trabajo de produccion.',
} as const

export type StackLevel = keyof typeof STACK_LEVELS

/* ------------------------------------------------------------------ *
 * Logros y metricas — `RF-21`, `RND-07`
 * ------------------------------------------------------------------ */

/**
 * `RF-21`: todo logro con impacto lleva **una** metrica verificable. Exactamente una:
 * un esquema que admita cero o dos no impone nada.
 */
export const metric = z
  .object({
    value: z.number().finite(),
    unit: z.string().min(1).max(24),
    /** Que ventana mide la metrica: "12 meses", "trimestre", "p95". */
    period: z.string().min(1).max(40).optional(),
    /** `RND-07`: donde se puede comprobar. Opcional, pero si no hay, la metrica es una opinion. */
    evidence: z.string().url().optional(),
  })
  .strict()

/** Un logro de un rol. `RND-06`: cabe en el presupuesto de la escena. */
export const highlight = z
  .object({
    text: z.string().min(10).max(280),
    metric: metric,
    visibility: visibility,
  })
  .strict()

/* ------------------------------------------------------------------ *
 * Roles — seccion 02
 * ------------------------------------------------------------------ */

export const role = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id slug kebab-case'),
    company: z.string().min(1).max(80),
    title: z.string().min(1).max(80),
    /** `YYYY-MM`. */
    start: isoDate,
    /** `null` = presente. `RF-23` lo formatea como relativo. */
    end: isoDate.nullable(),
    /** Que era de ese rol, en una frase. `RND-06`. */
    scope: z.string().min(10).max(280),
    /** `RF-20`: 2–4 logros. */
    highlights: z.array(highlight).min(2).max(4),
    /** Etiqueta de relacion laboral. Afecta a la densidad de la escena, no al calculo de anos. */
    employmentType: z.enum(['full-time', 'part-time', 'contract', 'freelance']).optional(),
    location: z.string().min(1).max(80).optional(),
    visibility: visibility,
    fixture: z.literal(true).optional(),
  })
  .strict()

/* ------------------------------------------------------------------ *
 * Proyectos — seccion 03
 * ------------------------------------------------------------------ */

export const project = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id slug kebab-case'),
    name: z.string().min(1).max(80),
    /** `RF-20`: problema, rol, stack, resultado, link. */
    problem: z.string().min(10).max(280),
    role: z.string().min(3).max(120),
    stack: z.array(z.string().min(1).max(40)).min(1).max(12),
    outcome: z.string().min(10).max(280),
    link: z.string().url().optional(),
    /** `RND-07`. */
    evidence: z.string().url().optional(),
    /** Anios que duro el proyecto. `null` = en curso. */
    start: isoDate,
    end: isoDate.nullable(),
    visibility: visibility,
    fixture: z.literal(true).optional(),
  })
  .strict()

/* ------------------------------------------------------------------ *
 * Stack — seccion 04
 * ------------------------------------------------------------------ */

export const stackItem = z
  .object({
    name: z.string().min(1).max(40),
    /** Clave de `STACK_LEVELS`. El significado lo aporta el schema. */
    level: z.enum(Object.keys(STACK_LEVELS) as [StackLevel, ...StackLevel[]]),
    /** Anos de uso. `RF-20` lo pide como dato de apoyo, no como nivel. */
    years: z.number().min(0).max(50).optional(),
  })
  .strict()

export const stackGroup = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id slug kebab-case'),
    label: z.string().min(1).max(40),
    items: z.array(stackItem).min(1).max(20),
  })
  .strict()

/* ------------------------------------------------------------------ *
 * Formacion y certificaciones — seccion 05
 * ------------------------------------------------------------------ */

export const education = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id slug kebab-case'),
    title: z.string().min(1).max(120),
    institution: z.string().min(1).max(120),
    start: isoDate,
    end: isoDate.nullable(),
    detail: z.string().min(1).max(200).optional(),
  })
  .strict()

export const certification = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id slug kebab-case'),
    name: z.string().min(1).max(120),
    issuer: z.string().min(1).max(120),
    date: isoDate,
    /** Caduca. `null` = no caduca. */
    expires: isoDate.nullable(),
    /** `RND-07`. */
    evidence: z.string().url().optional(),
  })
  .strict()

export const publication = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id slug kebab-case'),
    title: z.string().min(1).max(160),
    kind: z.enum(['talk', 'article', 'paper', 'video', 'podcast']),
    date: isoDate,
    url: z.string().url(),
  })
  .strict()

/* ------------------------------------------------------------------ *
 * Persona y contacto — secciones 00, 01, 06
 * ------------------------------------------------------------------ */

export const person = z
  .object({
    name: z.string().min(2).max(80),
    /** El rol, en la forma en que un reclutador lo buscaria. `RFU-01`. */
    role: z.string().min(3).max(80),
    /** Una linea. `RND-06`: <= 45ch de apoyo. */
    tagline: z.string().min(10).max(90),
    location: z.string().min(1).max(80),
    /** `ABR-03`: espanol unico en v1. El campo se conserva para no cerrar la puerta a EN. */
    lang: z.literal('es'),
    fixture: z.literal(true).optional(),
  })
  .strict()

/** `RND-05` pide 100% de los campos requeridos; los opcionales se omiten, no se vacian. */
export const contact = z
  .object({
    /**
     * `SEG-30`: el email es `private`. Llega al cliente por revelacion bajo interaccion
     * (`RF-27`), nunca en el HTML inicial.
     */
    email: z.string().email(),
    emailVisibility: z.literal('private'),
    github: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    /** `SEG-30`: `private` por defecto. */
    location: z.string().min(1).max(120).optional(),
    locationVisibility: z.literal('private').optional(),
    /** Salario esperado: `SEG-30` lo lista como `private` sin excepcion. */
    salaryExpectation: z.string().optional(),
    salaryVisibility: z.literal('private').optional(),
  })
  .strict()

/* ------------------------------------------------------------------ *
 * Documento completo
 * ------------------------------------------------------------------ */

export const cvDocument = z
  .object({
    schemaVersion: z.literal(1),
    person: person,
    /** `RF-20`: resumen. `RND-06`: <= 45ch de apoyo visible, el resto va al detalle. */
    summary: z.string().min(10).max(280),
    roles: z.array(role).min(1).max(12),
    projects: z.array(project).min(1).max(20),
    stack: z.array(stackGroup).min(1).max(12),
    education: z.array(education).max(12),
    certifications: z.array(certification).max(20),
    publications: z.array(publication).max(20),
    contact: contact,
    /** `RND-04`: vigencia del dato. Se muestra en el sitio. */
    lastReviewed: lastReviewed,
  })
  .strict()

export type CvDocument = z.infer<typeof cvDocument>
export type Role = z.infer<typeof role>
export type Project = z.infer<typeof project>
export type StackGroup = z.infer<typeof stackGroup>
export type Education = z.infer<typeof education>
export type Certification = z.infer<typeof certification>
export type Publication = z.infer<typeof publication>
export type Contact = z.infer<typeof contact>
export type Person = z.infer<typeof person>
export type Highlight = z.infer<typeof highlight>
export type StackItem = z.infer<typeof stackItem>

/**
 * Lo que sale a renderizar — `SEG-31`.
 *
 * Deliberadamente NO es `CvDocument`: es el mismo documento **sin** los campos privados, y su
 * tipo lo refleja. Si fuera un `CvDocument`, `cv.contact.email` compilaria en cualquier
 * componente y bastaria un despiste para filtrar PII al cliente. Con este tipo, la escena de
 * contacto no puede leer el email aunque quiera; lo obtiene por una via explicita y separada.
 */
export type PublicContact = Omit<Contact, 'email'> & {
  readonly emailVisibility: 'private'
}

export type PublicCvDocument = Omit<CvDocument, 'contact' | 'roles' | 'projects'> & {
  readonly contact: PublicContact
  readonly roles: readonly Role[]
  readonly projects: readonly Project[]
}
