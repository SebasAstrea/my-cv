/**
 * Chunking y allowlist del CV — `CHA-01`, `CHA-02`, `CHA-03`, `SEG-11`.
 *
 * El chat no "habla con el CV": **solo puede citar texto que esta aqui**. Este modulo es el
 * unico sitio del proyecto donde se decide que partes del documento son recuperables, y por eso
 * es deliberadamente pequeno, sin dependencias y 100 % determinista.
 *
 * Tres decisiones que conviene no romper sin ADR:
 *
 * 1. **Sin embeddings.** Para un documento de siete secciones, la recuperacion por solapamiento
 *    de terminos es igual de buena que un vector store, cuesta cero, no tiene chunking semantico
 *    que se pueda desalinear, y —lo que manda aqui— **es auditable**: se puede demostrar chunk a
 *    chunk que ninguna respuesta sale de fuera de la allowlist. Un indice vectorial daria mejor
 *    recall y peor auditabilidad, que es justo el trade-off equivocado cuando `CHA-04` exige
 *    trazabilidad de cada afirmacion.
 *
 * 2. **El `chunkId` no se acepta del cliente.** Llega desde aqui, siempre. `SEG-11` es la regla
 *    que hace el bypass imposible: un atacante que pida `contacto-privado` no tiene de donde
 *    sacarlo, porque la funcion no lee ids del cliente, solo texto de la pregunta.
 *
 * 3. **Los chunks `private` no se construyen.** No se filtran despues: no existen. Un
 *    `chunkId` invalido se rechaza en la frontera con el mismo error que uno inexistente
 *    (no se distingue "existe pero no puedes" de "no existe", porque esa distincion es un oraculo).
 */

import type { PublicCvDocument } from '../../data/schema.ts'

/** Seccion del documento a la que pertenece un chunk. Coincide con los ids de `RF-01`. */
export type SectionId = 'persona' | 'perfil' | 'experiencia' | 'proyectos' | 'stack' | 'formacion'

export interface Chunk {
  /** Identificador estable. Es lo que el modelo cita y lo que el cliente valida. */
  readonly id: string
  readonly section: SectionId
  /** Texto exacto que se entrega al modelo. Lo que se cita es esto, literal. */
  readonly text: string
  /** Hash del texto: detecta que alguien edito un chunk sin actualizar nada mas. `RNF-88`. */
  readonly hash: string
}

/** Tope de chunks por turno — `CHA-01`. */
export const MAX_CHUNKS = 8

/** Tope aproximado de tokens de contexto por turno — `CHA-01`. Estimacion 1 token ~ 4 chars. */
export const MAX_CONTEXT_CHARS = 3000

/**
 * Un chunk con mas caracteres que esto no entra en un turno: es un proyecto con demasiados logros
 * y hay que partirlo, no recortar el contexto a la mitad de una frase.
 */
const CHUNK_SOFT_LIMIT = 700

/**
 * Palabras vacias en espanol e ingles.
 *
 * Se filtran para que "cuales son mis IDS" puntue por "IDS" y no por "cuales". No es un stemmer:
 * el recall aqui lo da el propio documento, que es pequeño, y añadir un stemmer estandarizaria
 * terminos ("proyectos" -> "proyect") y perderia los tecnicos, que es justo lo que se busca.
 */
const STOPWORDS = new Set([
  'a',
  'al',
  'algo',
  'algunas',
  'algunos',
  'ante',
  'antes',
  'como',
  'con',
  'contra',
  'cual',
  'cuando',
  'de',
  'del',
  'desde',
  'donde',
  'dos',
  'durante',
  'e',
  'el',
  'ella',
  'ellas',
  'ellos',
  'en',
  'entre',
  'era',
  'erais',
  'eran',
  'eres',
  'es',
  'esa',
  'esos',
  'esta',
  'estaba',
  'estado',
  'estan',
  'estar',
  'estas',
  'este',
  'esto',
  'estos',
  'estoy',
  'fue',
  'fueron',
  'ha',
  'hace',
  'hacen',
  'hacer',
  'he',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'me',
  'mi',
  'mis',
  'mucho',
  'muy',
  'nada',
  'ni',
  'no',
  'nos',
  'nuestra',
  'o',
  'os',
  'otra',
  'otro',
  'para',
  'pero',
  'poco',
  'por',
  'porque',
  'que',
  'quien',
  'se',
  'sea',
  'segun',
  'ser',
  'si',
  'sin',
  'sobre',
  'son',
  'su',
  'sus',
  'tambien',
  'tanto',
  'te',
  'tiene',
  'tienen',
  'todo',
  'todos',
  'tu',
  'un',
  'una',
  'uno',
  'y',
  'ya',
  // Interrogaciones y aceptaciones: son las palabras mas frecuentes de una consulta y las que
  // menos retienen nada del CV. Sin esta linea "¿cuales son mis IDS?" puntua por "cuales".
  'cuales',
  'cuanto',
  'cuanta',
  'cuantos',
  'cuantas',
  'que',
  'dime',
  'diganme',
  'cuentame',
  'explicame',
  'ayudame',
  'puedes',
  'puede',
  'podrias',
  'sabes',
  'saber',
  'quiero',
  'necesito',
  'ayuda',
  'favor',
  'gracias',
  'hola',
  'buenas',
  'hablemos',
  'algo',
  'algun',
  'alguna',
  'i',
  'me',
  'my',
  'the',
  'and',
  'for',
  'with',
  'what',
  'which',
  'who',
  'do',
  'does',
  'did',
  'are',
  'your',
  'you',
  'please',
  'tell',
  'about',
])

/** Normaliza para comparar: minusculas sin acentos, sin puntuacion, espacios colapsados. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Reducciyon de plurales y terminaciones, para emparejar en espanol.
 *
 * Sin esto el chat falla en las preguntas mas normales que hay: en espanol se **pregunta** en
 * plural y el CV se **escribe** en singular. "Que certificaciones tiene" contra "Certificacion
 * CKA" no coincide con ninguna busqueda literal, y lo mismo con tecnologias, tecnologias,
 * proyectos o años. Medido: sin esto, "¿Que certificaciones tiene?" devolvia "No consta en el
 * CV" con la respuesta correcta a un metro de distancia en el documento.
 *
 * No es un stemmer linguistico: son las cinco terminaciones mas rentables y nada mas. Se aplica
 * **simetricamente** a la consulta y al corpus, que es lo que lo hace seguro: si "kubernetes" se
 * reduce a "kubernete", tambien se reduce en el indice, y sigue encontrandose. Lo que puede
 * pasar es que dos palabras distintas caigan en el mismo tallo y una recupere un fragmento de mas.
 * Eso es un problema de relevancia, y la respuesta la siguen acotando G4 y la allowlist.
 *
 * El minimo de 3 caracteres evita que "usa" -> "us" colisione con medio CV.
 */
export function stem(token: string): string {
  if (token.length <= 3) return token
  for (const suffix of ['es', 's', 'a', 'o', 'e']) {
    if (!token.endsWith(suffix)) continue
    const base = token.slice(0, -suffix.length)
    if (base.length >= 3) return base
  }
  return token
}

/** Tokens significativos de una consulta, en el orden en que aparecen y sin repetir. */
export function tokenize(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const token of normalize(text).split(' ')) {
    if (token.length < 2 || STOPWORDS.has(token) || seen.has(token)) continue
    seen.add(token)
    out.push(token)
  }
  return out
}

/**
 * Hash FNV-1a de 32 bits, en hex de 8 caracteres.
 *
 * No es criptografico y no pretende serlo: `RNF-88` pide que un cambio en el prompt o en un
 * chunk sea **visible**, no secreto. Usar uno criptografico exigiria una dependencia asincrona
 * (`crypto.subtle`) y no aportaria nada aqui.
 */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/* ------------------------------------------------------------------ *
 * Construccion de los chunks
 * ------------------------------------------------------------------ */

function push(out: Chunk[], section: SectionId, id: string, text: string): void {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length === 0) return
  out.push({ id, section, text: clean, hash: fnv1a(clean) })
}

/** Parte un texto largo en trozos que cortan en fin de frase, nunca a mitad de palabra. */
function splitLong(text: string, baseId: string, out: Chunk[]): void {
  if (text.length <= CHUNK_SOFT_LIMIT) {
    push(out, sectionOf(baseId), baseId, text)
    return
  }
  const sentences = text.split(/(?<=[.!?])\s+/)
  let buffer = ''
  let part = 0
  for (const sentence of sentences) {
    if (buffer.length > 0 && buffer.length + sentence.length + 1 > CHUNK_SOFT_LIMIT) {
      push(out, sectionOf(baseId), `${baseId}.${part}`, buffer)
      buffer = ''
      part += 1
    }
    buffer = buffer === '' ? sentence : `${buffer} ${sentence}`
  }
  if (buffer !== '') push(out, sectionOf(baseId), `${baseId}.${part}`, buffer)
}

/** `experiencia.acme.0` -> `experiencia`. Los ids compuestos se declaran con esa forma. */
function sectionOf(id: string): SectionId {
  const root = id.split('.')[0] ?? 'persona'
  const known: readonly SectionId[] = [
    'persona',
    'perfil',
    'experiencia',
    'proyectos',
    'stack',
    'formacion',
  ]
  return known.includes(root as SectionId) ? (root as SectionId) : 'persona'
}

/**
 * Construye el corpus recuperable desde el documento **publico**.
 *
 * Recibe `PublicCvDocument` y no `CvDocument` a proposito: los campos `private` ya fueron
 * eliminados por `toPublicCv` (`SEG-31`), asi que el tipo hace imposible que entren aqui aunque
 * alguien pase el documento equivocado. Es la garantia estatica de `SEG-11`, no una convencion.
 */
/**
 * Construye el corpus recuperable desde el documento **publico**.
 *
 * Recibe `PublicCvDocument` y no `CvDocument` a proposito: los campos `private` ya fueron
 * eliminados por `toPublicCv` (`SEG-31`), asi que el tipo hace imposible que entren aqui aunque
 * alguien pase el documento equivocado. Es la garantia estatica de `SEG-11`, no una convencion.
 *
 * **Por que se trocea por seccion y no por item** (`ADR-0009`). Antes eran 16 fragmentos y el
 * retrieval se quedaba corto, porque empareja por palabra y las preguntas no usan el vocabulario
 * del CV. Medido: "¿Que certificaciones tiene?" no encontraba "Certificacion CKA" (plural contra
 * singular) y contestaba "No consta en el CV". Con un fragmento por seccion, los 8 caben, el CV
 * completo entra en el contexto y la pregunta llega al modelo con los datos delante.
 *
 * Los proyectos siguen siendo fragmentos aparte porque son lo que mas se cita, y se conserva el
 * `splitLong` para que un texto largo no se corte a mitad de palabra.
 */
export function buildChunks(cv: PublicCvDocument): Chunk[] {
  const out: Chunk[] = []

  // 1. Quien es: nombre, rol, ubicacion, resumen y publicaciones en un solo bloque. Una pregunta
  //    sobre "quien es" o "que publica" no tiene queholders de donde colgar.
  const publications = cv.publications
    .map((pub) => {
      const url = pub.url === undefined ? '' : ` ${pub.url}`
      return `${pub.title} (${pub.kind}, ${pub.date}):${url}`
    })
    .join(' ')
  const resumen = [
    `${cv.person.name}. ${cv.person.role}. ${cv.person.tagline}. Ubicacion: ${cv.person.location}.`,
    cv.summary,
    publications === '' ? '' : `Publicaciones: ${publications}`,
  ]
    .filter((part) => part !== '')
    .join(' ')
  push(out, 'persona', 'persona', resumen)

  // 2. Experiencia completa en un bloque. La pregunta tipica ("donde ha trabajado", "que hizo en
  //    2022") menciona el ano o la empresa, y un fragmento por puesto obligaba a acertar el
  //    puesto exacto para que la pregunta llegara al fragmento correcto.
  const roles = cv.roles.map((role) => {
    const header = `${role.company} — ${role.title} (${role.start} – ${role.end ?? 'actualidad'})`
    // `RF-21` obliga a una metrica por logro, asi que no hay caso "sin metrica": formatearla
    // siempre es correcto y `formatMetric` no necesita rama de ausencia.
    const achievements = role.highlights.map((h) => {
      const m = h.metric
      const period = m.period === undefined ? '' : `, ${m.period}`
      return `${h.text} (${m.value} ${m.unit}${period})`
    })
    return `${header}. ${role.scope} ${achievements.join(' ')}`
  })
  push(out, 'experiencia', 'experiencia', roles.join(' | '))

  // 3. Proyectos: uno por proyecto, que es la granularidad que se cita.
  for (const project of cv.projects) {
    const header = `${project.name} (${project.start} – ${project.end ?? 'actualidad'}).`
    const link = project.link === undefined ? '' : ` ${project.link}`
    const body =
      `${header} Problema: ${project.problem}. Mi rol: ${project.role}. ` +
      `Resultado: ${project.outcome}. Stack: ${project.stack.join(', ')}.${link}`
    splitLong(body, `proyectos.${project.id}`, out)
  }

  // 4. Stack en un bloque, y con el nombre que la gente usa. El documento agrupa por "Lenguajes",
  //    "Infraestructura", "Observabilidad", "Interfaz" y nunca dice la palabra "tecnologias", que
  //    es justo lo que pregunta cualquiera. Nombrarlo no es rellenar el CV: no afirma
  //    experiencia que no este en los items, solo nombra lo que la lista ya es.
  const stack = cv.stack
    .map((group) => {
      const items = group.items.map((item) => {
        const years = item.years === undefined ? '' : `, ${item.years} anos`
        return `${item.name} (nivel ${item.level}${years})`
      })
      return `${group.label}: ${items.join('; ')}`
    })
    .join(' | ')
  push(out, 'stack', 'stack', `Stack de tecnologias, herramientas y lenguajes: ${stack}.`)

  for (const entry of cv.education) {
    const detail = entry.detail === undefined ? '' : ` ${entry.detail}`
    // Mismo criterio que el stack: se nombran las palabras con las que se pregunta. "¿Donde
    // estudio?" no comparte ningun termino con "Grado en Ingenieria Informatica — Universidad de
    // Ejemplo", y la respuesta estaba a un metro. No se inventa nada: solo se dice que esto es
    // formacion, que es lo que es.
    const aka =
      entry === cv.education[0] ? 'Formacion academica (estudios, universidad, titulo): ' : ''
    push(
      out,
      'formacion',
      `formacion.${entry.id}`,
      `${aka}${entry.title} — ${entry.institution} (${entry.start} – ${entry.end ?? 'actualidad'}).${detail}`,
    )
  }

  for (const cert of cv.certifications) {
    const expires = cert.expires === null ? '' : `, caduca ${cert.expires}`
    push(
      out,
      'formacion',
      `certificacion.${cert.id}`,
      `Certificacion ${cert.name} de ${cert.issuer} (${cert.date}${expires}).`,
    )
  }

  return out
}

/* ------------------------------------------------------------------ *
 * Allowlist y recuperacion
 * ------------------------------------------------------------------ */

/**
 * Allowlist derivada de los chunks, no una constante escrita a mano.
 *
 * Que sea derivada es lo que hace `SEG-11` robusto: anadir un rol nuevo al CV anade su chunk y
 * una constante escrita a mano se quedaria obsoleta en silencio, que es como se cuelan datos.
 */
export function buildAllowlist(chunks: readonly Chunk[]): ReadonlySet<string> {
  return new Set(chunks.map((c) => c.id))
}

/** Un `chunkId` es valido solo si esta en la allowlist. Origen del texto: aqui, nunca el cliente. */
export function isAllowed(id: string, allowlist: ReadonlySet<string>): boolean {
  return allowlist.has(id)
}

/**
 * Recuperacion por solapamiento de terminos, con desempate determinista.
 *
 * El score es la fraccion de terminos de la consulta que aparecen en el chunk. Asi un chunk con
 * 30 palabras no gana a uno con 5 solo por ser largo, que es el fallo clasico de contar
 * apariciones. Los empates se rompen por `section` y luego por `id`, de modo que la misma
 * pregunta devuelve siempre los mismos chunks: sin eso, `CHA-34` (consistencia de citas) no se
 * puede comprobar porque cambiaria entre llamadas.
 */
/**
 * Indice de tallos de un chunk, memorizado por objeto.
 *
 * Los `Chunk` son inmutables y se construyen una vez por peticion, asi que un `WeakMap` los
 * indexa sin coste para las llamadas siguientes y sin anadir un campo al tipo `Chunk` — que
 * viaja al prompt y del que depende la allowlist, y ahi no se toca nada sin motivo.
 */
const indices = new WeakMap<Chunk, ReadonlySet<string>>()

function chunkStems(chunk: Chunk): ReadonlySet<string> {
  const cached = indices.get(chunk)
  if (cached !== undefined) return cached
  const stems = new Set<string>()
  for (const token of normalize(chunk.text).split(' ')) {
    if (token.length === 0) continue
    stems.add(token)
    stems.add(stem(token))
  }
  indices.set(chunk, stems)
  return stems
}

export function scoreChunk(chunk: Chunk, terms: readonly string[]): number {
  if (terms.length === 0) return 0
  const haystack = normalize(chunk.text)
  const stems = chunkStems(chunk)
  let hits = 0
  for (const term of terms) {
    // Camino normal: coincidencia por tallo, que es la que empareja plural con singular.
    if (stems.has(term) || stems.has(stem(term))) {
      hits += 1
      continue
    }
    // Camino de simbolos ("c++", "c#", ".net"): se escapa y se busca literal, porque como
    // `RegExp` lo interpretaria `c++` no compila y `.net` casaria con cualquier caracter. Y se
    // busca con limites de palabra para que "go" no case con "google" ni "ia" con "diagrama".
    const re = /^[a-z0-9]+$/.test(term)
      ? new RegExp(`\\b${term}\\b`)
      : new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u')
    if (re.test(haystack)) hits += 1
  }
  return hits / terms.length
}

export interface Retrieval {
  readonly chunks: readonly Chunk[]
  /** Max score alcanzado. Por debajo de `MIN_RELEVANCE` el chat dice que no consta. */
  readonly topScore: number
  /** Terms de la pregunta que no aparecen en ningun chunk. Base de `CHA-06`. */
  readonly unmatchedTerms: readonly string[]
}

/** Por debajo de este score no se responde con contenido: se responde que no consta (`CHA-06`). */
export const MIN_RELEVANCE = 0.34

/**
 * Selecciona los chunks para una pregunta.
 *
 * Devuelve tambien `topScore` y los terminos no encontrados a proposito: son la entrada de
 * `CHA-06`, que exige responder "no consta en el CV" cuando la relevance es baja. Sin exponerlos
 * aqui, esa decision terminaria siendo un `if` magico dentro del prompt y no seria comprobable.
 */
export function retrieve(
  question: string,
  chunks: readonly Chunk[],
  allowlist: ReadonlySet<string>,
  max: number = MAX_CHUNKS,
): Retrieval {
  const terms = tokenize(question)
  const eligible = chunks.filter((c) => isAllowed(c.id, allowlist))

  if (terms.length === 0) {
    return { chunks: [], topScore: 0, unmatchedTerms: [] }
  }

  const scored = eligible
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.chunk.section !== b.chunk.section) {
        return a.chunk.section < b.chunk.section ? -1 : 1
      }
      return a.chunk.id < b.chunk.id ? -1 : 1
    })

  const selected: Chunk[] = []
  let chars = 0
  for (const { chunk } of scored) {
    if (selected.length >= max) break
    if (chars + chunk.text.length > MAX_CONTEXT_CHARS) {
      // Se sigue intentando con chunks mas cortos en vez de romper el contexto a mitad: mejor
      // dos citas precisas que una truncada.
      continue
    }
    selected.push(chunk)
    chars += chunk.text.length
  }

  const matched = new Set<string>()
  for (const { chunk } of scored) {
    const haystack = normalize(chunk.text)
    for (const term of terms) {
      const re = new RegExp(`\\b${term}\\b`)
      if (re.test(haystack)) matched.add(term)
    }
  }

  return {
    chunks: selected,
    topScore: scored[0]?.score ?? 0,
    unmatchedTerms: terms.filter((t) => !matched.has(t)),
  }
}
