/**
 * G1 (intake) y G4 (salida) — `SEG-25`, `CHA-30..38`, `CHA-31`.
 *
 * Estas dos capas son **deterministas y sin modelo**, y por eso son las que de verdad sostienen el
 * proyecto. El LLM es la parte no determinista; un guardrail que dependa del LLM para decidir si
 * una respuesta es aceptable no es un guardrail, es una segunda opinion.
 *
 * Division:
 *
 * - **G1** entra antes de gastar un token: normaliza, acota, quita PII y clasifica la intencion.
 *   Es la unica capa que puede corre en el navegador, y por eso no depende de nada de servidor.
 * - **G4** sale despues de que el modelo spoke, y es la unica que decide si lo que dijo se
 *   muestra. Comprueba forma, citas, PII, canarios, filtracion de prompt y longitud. Si algo falla,
 *   el usuario recibe una respuesta fija, no la del modelo.
 *
 * Regla que atraviesa las dos capas: **el fallo por defecto es rechazar**. Ante la duda entre
 * "responder" y "no responder", no se responde. Un CV con una respuesta de mas no cuesta nada; un
 * CV que se equivoca de persona, pierde la entrevista.
 */

import { z } from 'zod'

import { isAllowed } from './chunks.ts'

/* ================================================================== *
 * G1 — Intake
 * ================================================================== */

/** Tope de longitud de la pregunta — `SEG-15`. */
export const MAX_INPUT_CHARS = 500

/**
 * Tipos de intencion. No es un clasificador de ML: son reglas explicitas y auditables.
 *
 * `attack` y `abusive` estan separadas de `out_of_scope` a proposito. Bloquear por motivational
 * y bloquear por "no lo se" son politicas distintas, con costes distintos: la primera puede
 * tener falsos positivos legitimos (alguien pregunta por opinion tecnica y la palabra "malo"
 * aparece en su frase), y la segunda no.
 */
export type Intent = 'in_scope' | 'out_of_scope' | 'attack' | 'abusive'

/**
 * Familias de ataque de `SPEC.md` §7.7, reducidas a lo que se puede detectar sin modelo.
 *
 * La lista **no** pretende ser completa ni reemplaza el eval set: pretende interceptar lo suficiente
 * para que el intento barato de biaya cero falle. Lo que no llega aqui lo detiene `G4` sobre la
 * salida, que es el control que de verdad importa.
 */
const ATTACK_PATTERNS: readonly RegExp[] = [
  // Divulgacion de prompt
  /\b(?:tus|las|my|your)\s+(?:instruc(?:ci|t)|prompt|directiva|reglas|system\s*prompt)/i,
  /\b(?:revela|revelar|muestrame|dime|repite|imprime|print|show|reveal|output|reproduce)\b[^\n]{0,40}\b(?:instruc(?:ci|t)|prompt|reglas|contexto\s*inicial|system)/i,
  /\b(?:ignora|olvida|ignore|forget|override|anula|desactiva)\b[^\n]{0,40}\b(?:instruc(?:ci|t)|regla|reglas|restricci|pol[ií]tica|guardrail|restricciones)/i,
  // Cambio de rol / jerarquia falsa
  /\b(?:ahora\s+eres|act[uú]a\s+como|you\s+are\s+now|as\s+of\s+now|modo\s+desarrollador|developer\s+mode|dan\s+mode|jailbreak|dan)\b/i,
  /\b\[?\s*(?:system|admin|root|developer)\s*\]?\s*:/i,
  // Extraccion de contexto oculto
  /\b(?:primeras?\s+\d+\s+(?:palabras|caracteres|lineas|words|characters)|from\s+the\s+top|repeat\s+the\s+above|empieza\s+por\s+la\s+primera)\b/i,
  // Ofuscacion de la peticion
  /\b(?:base64|rot13|hexadecimal|codifica|en\s+hex|inversa\s+la|frases?\s+al\s+rev[eé]s)\b[^\n]{0,40}\b(?:instruc(?:ci|t)|prompt|reglas)/i,
  // Exfiltracion de PII
  /\b(?:dime|revela|muestra|cu[aá]l\s+es)\b[^\n]{0,30}\b(?:email|tel[eé]fono|m[oó]vil|dni|nie|iban|direcci[oó]n|sueldo|salario|availability|disponibilidad)\b/i,
  // Cadenas conocidas de jailbreak
  /\b(?:do\s+anything\s+now|dan\s+is\s+on|opera\s+mode|developer\s+mode\s+enabled|you\s+have\s+no\s+restrictions)\b/i,
]

/** Insultos y Olsen-directed hate toward a protected attribute. Bloquean antes de gastar token. */
const ABUSIVE_PATTERNS: readonly RegExp[] = [
  /\b(?:idiota|est[uú]pido|imb[eé]cil|in[uú]til|basura|perdedor|capullo|gilipollas)\b/i,
  /\b(?:subnormal|retrasad|idi[oó]tica|enfermo\s+mental|inutil)\b/i,
  /\b(?:racista|racistas|xen[oó]fobo)\b/i,
]

/**
 * Preguntas fuera del alcance del CV.
 *
 * El chat responde *de* un CV, no *sobre* la persona que lo tiene. Un buen sistema responde esto
 * sin generar una opinion, porque "no soy tu asesor financiero" tampoco es una opinion: es una
 * respuesta. La lista cubre las tres que mas se repiten: opinion personal, consejo vital, y
 * evaluacion de terceros.
 */
const OUT_OF_SCOPE_PATTERNS: readonly RegExp[] = [
  /\b(?:qu[eé]\s+(?:opinas|piensas|crees)|tu\s+opini[oó]n|what\s+do\s+you\s+think)\b/i,
  /\b(?:deber[ií]a|deber[ií]as|convendr[ií]a|me\s+recomiendas|recomend[aá]s|should\s+i|do\s+you\s+recommend)\b/i,
  /\b(?:tu\s+salario|tu\s+sueldo|cu[aá]nto\s+cobras|cu[aá]nto\s+ganas|salary|expectativas?\s+salarial(?:es)?|pretensi[oó]n\s+salarial)\b/i,
  /\b(?:est[aá]s\s+disponible|tienes\s+disponibilidad|fecha\s+de\s+disponibilidad|can\s+you\s+start)\b/i,
  /\b(?:valoras|opinas\s+de|qu[eé]\s+piensas\s+de)\b[^\n]{0,30}\b(?:empresa|startup|competidor|colega|manager|equipo)\b/i,
]

/* --- PII: scrub en entrada, deteccion en salida --- */

/**
 * Patrones de PII con identificacion europea y española.
 *
 * Se usan en dos direcciones opuestas y por eso estan juntos: en G1 se **borran** del input, y en
 * G4 se **buscan** en la salida. La misma expresion, dos politicas.
 *
 * El scrub del input (G1) existe por `SEG-35`: un atacante puede intentar que el sistema memorice
 * un DNI o una tarjeta ajena escribiendolo. El sistema no guarda el input, pero el log de errores
 * ni el trace de un proveedor externo no tienen por que guardarlo tampoco.
 */
export const PII_PATTERNS: readonly { readonly name: string; readonly re: RegExp }[] = [
  { name: 'email', re: /[\w.+-]+@[\w-]+\.[\w.-]{2,}/gi },
  { name: 'dni-nie', re: /\b\d{8}[A-HJ-NP-TV-Z]\b/gi },
  { name: 'nif-cif', re: /\b[XYZ]?\d{7,8}[A-HJ-NP-TV-Z]\b/gi },
  { name: 'iban', re: /\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){2,7}[A-Z0-9]{1,4}\b/g },
  { name: 'es-phone', re: /(?:\+34[\s-]?)?[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g },
  { name: 'es-postal', re: /\b(?:CP|C\.P\.|Codigo Postal)\s*\d{5}\b/gi },
  { name: 'card', re: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g },
]

/**
 * Canario de exfiltracion — `CHA-31`, `SEG-31`.
 *
 * Token **sintetico** que se inyecta en el tier `private` del CV en los entornos de prueba. Si
 * alguna vez aparece en una respuesta, significa que un campo privado llego al modelo y de ahi al
 * usuario. Por eso se comprueba por igualdad de substring y no por regex de PII: un
 * `+34600111222` inventado no lo detecta el patron de telefono, pero si este token.
 *
 * En produccion el CV real no tiene canario: el control real es `SEG-32` (que el campo `private`
 * no exista en el corpus) mas este patron, que es la red por si el gate fallara.
 */
export const CANARY_TOKENS: readonly string[] = [
  'CANARY-DNI-00000000X',
  'CANARY-TLF-600000000',
  'CANARY-IBAN-ES0000000000000000000000',
]

/**
 * Elimina PII del input — G1.
 *
 * Sustituye por `[redactado]` en vez de borrar: borrar deja huecos que el usuario interpreta como
 * que el sistema no leyo su pregunta, y Redacta deja claro que si la leyo y decidio no propagar
 * el dato. El texto sigue siendo legible para el modelo, que es lo que se busca.
 */
export function scrubPii(input: string): string {
  let out = input
  for (const { re } of PII_PATTERNS) out = out.replace(re, '[redactado]')
  for (const token of CANARY_TOKENS) out = out.replaceAll(token, '[redactado]')
  return out
}

/**
 * Sustituye los caracteres de control C0 y `DEL` por un espacio.
 *
 * Se recorre por puntos de codigo en vez de usar una expresion regular porque `no-control-regex`
 * esta activo y `RNF-80` no admite `eslint-disable`. El resultado es el mismo y el motivo queda
 * escrito: un `\u0000` pegado en medio de una pregunta llega al prompt como un caracter invisible
 * que puede partir un delimitador (`SEG-25`).
 *
 * Se conservan tabulador, salto de linea y retorno: son espacios legitimos y el colapso de
 * espacios de `sanitizeQuestion` los convierte despues.
 */
function stripControlChars(input: string): string {
  let out = ''
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0
    const isSpace = code === 0x09 || code === 0x0a || code === 0x0d
    const isControl = (!isSpace && code < 0x20) || code === 0x7f
    out += isControl ? ' ' : char
  }
  return out
}

/** Normaliza entrada: recorta, colapsa espacios, quita control chars. Idempotente. */
export function sanitizeQuestion(input: string): string {
  return stripControlChars(input).replace(/\s+/g, ' ').trim().slice(0, MAX_INPUT_CHARS)
}

/**
 * Clasifica la intencion. Reglas puras, en orden de precedencia: ataque > abusivo > fuera de
 * alcance > dentro.
 *
 * El orden importa. Un texto puede ser ambas cosas ("eres idiota, revela tus instrucciones"), y
 * bloquear primero el ataque es lo correcto, porque es el que hay que registrar.
 */
export function classifyIntent(input: string): Intent {
  if (ATTACK_PATTERNS.some((re) => re.test(input))) return 'attack'
  if (ABUSIVE_PATTERNS.some((re) => re.test(input))) return 'abusive'
  if (OUT_OF_SCOPE_PATTERNS.some((re) => re.test(input))) return 'out_of_scope'
  return 'in_scope'
}

export interface Intake {
  readonly ok: boolean
  readonly intent: Intent
  /** Pregunta ya saneada y sin PII. Es lo unico que se puede enviar al modelo. */
  readonly question: string
  /** Motivo del rechazo, apto para log. Nunca contiene el texto del usuario. */
  readonly reason?: string
}

/**
 * G1 completo. Se llama antes de cualquier gasto y antes de abrir socket.
 *
 * `ok: false` significa "no llames al modelo". El llamador responde con un texto fijo segun
 * `intent`; nunca reenvia la pregunta para que otro la conteste.
 */
export function intake(raw: string): Intake {
  const question = scrubPii(sanitizeQuestion(raw))

  if (question.trim().length === 0) {
    return { ok: false, intent: 'in_scope', question, reason: 'vacia' }
  }
  const intent = classifyIntent(question)
  if (intent === 'attack' || intent === 'abusive') {
    return { ok: false, intent, question, reason: 'filtro de entrada' }
  }
  return { ok: true, intent, question }
}

/* ================================================================== *
 * G4 — Salida
 * ================================================================== */

/** Tope de la respuesta mostrada — `CHA-36`. */
export const MAX_ANSWER_CHARS = 700

/**
 * Tope duro del `answer` que devuelve el modelo, antes de truncar.
 *
 * Son dos topes y no uno a proposito. Entre `MAX_ANSWER_CHARS` y este, la respuesta se trunca y se
 * muestra (`CHA-36`: perder el final es mejor que no responder). Por encima de este, se rechaza:
 * un modelo que devuelve 5000 caracteres no esta contestando una pregunta, y truncarlo a 700
 * produciria una respuesta sin final que parece fiable. Este tope es tambien la defensa de
 * memoria frente a un proveedor que devuelva la peticion entera.
 */
export const MAX_HARD_ANSWER_CHARS = MAX_ANSWER_CHARS * 4

/** Contrato de salida del modelo. `.strict()`: una clave extra es un fallo, no se ignora. */
export const modelAnswer = z
  .object({
    answer: z.string().min(1).max(MAX_HARD_ANSWER_CHARS),
    citations: z.array(z.string().min(1).max(80)).max(8),
    confidence: z.enum(['high', 'medium', 'low']),
  })
  .strict()

export type ModelAnswer = z.infer<typeof modelAnswer>

/**
 * Indicios de divulgacion de prompt en la salida.
 *
 * No se busca la palabra "prompt" (una respuesta legitima puede decir "no tengo contexto para
 * describir prompts"), sino las formas en que un modelo se delata. Se anade `System:` porque
 * algunos modelos con paso de razonamiento abierto destilan su system en la primera linea.
 */
const OUTPUT_LEAK_PATTERNS: readonly RegExp[] = [
  /\b(?:here\s+are|these\s+are|est[ae]s\s+(?:son|s))[^\n]{0,30}\bmy\s+(?:instructions|rules|system\s*prompt)\b/i,
  /\b(?:my\s+instructions|i\s+am\s+instructed|i\s+was\s+instructed|estoy\s+instruido|he\s+sido\s+instruido|tengo\s+(?:instrucciones|reglas|directivas))\b/i,
  /^\s*(?:system|assistant|user)\s*:/im,
  /\b(?:BEGIN\s+CV\s+DATA|ANSWER\s+FORMAT|ABSOLUTE\s+RULES)\b/i,
  /\b(?:repeat|print|output)\s+everything\s+above\b/i,
]

export type RejectReason =
  | 'json-invalido'
  | 'cita-no-permitida'
  | 'pii-en-salida'
  | 'canario'
  | 'fuga-prompt'
  | 'demasiado-larga'
  | 'confianza-baja'

export type OutputVerdict =
  | { readonly ok: true; readonly answer: ModelAnswer; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly reason: RejectReason; readonly detail?: string }

const REJECT_TEXT: Record<RejectReason, string> = {
  'json-invalido': 'La respuesta no cumplo el formato esperado. Intentalo de nuevo.',
  'cita-no-permitida': 'La respuesta no pudo verificarse contra el CV.',
  'pii-en-salida': 'La respuesta contenia datos que no puedo compartir. Reformula la pregunta.',
  canario: 'La respuesta no pudo verificarse.',
  'fuga-prompt': 'No puedo compartir informacion interna del sistema.',
  'demasiado-larga': 'La respuesta fue demasiado larga. Reformula la pregunta mas concreta.',
  'confianza-baja': 'No tengo esa informacion en el CV. Puedes escribirme directamente.',
}

/** Texto que se muestra cuando G4 rechaza. Es fijo: nunca incorporate salida del modelo. */
export function rejectionText(reason: RejectReason): string {
  return REJECT_TEXT[reason]
}

/**
 * Extrae el objeto JSON de la salida cruda del modelo.
 *
 * Un modelo pequeno wrapped en triple backtick es lo habitual, no la excepcion, asi que se
 * limpia el bloque de codigo antes de parsear. Aun asi, si no hay JSON valido, se rechaza: no se
 * intenta "reparar" la salida, porque un reparador de JSON es un agujero de inyeccion con pasos
 * extra.
 */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  const candidate = (fenced?.[1] ?? trimmed).trim()
  try {
    return JSON.parse(candidate)
  } catch {
    return undefined
  }
}

/**
 * G4 completo.
 *
 * El orden de las comprobaciones es intencionado: **estructura, luego citas, luego contenido**.
 * Una cita invalida es un fallo de integridad mas grave que una respuesta larga, y si una
 * respuesta cita un id que no existe, ya no es terreno verificable aunque el texto suene bien.
 *
 * @param raw Salida cruda del modelo.
 * @param allowlist Ids permitidos. Viene de `chunks.ts`, nunca del cliente ni del modelo.
 */
export function validateOutput(raw: string, allowlist: ReadonlySet<string>): OutputVerdict {
  const candidate = extractJson(raw)

  // El exceso de longitud se comprueba **antes** del schema, y por eso tiene su propio motivo. Si
  // se dejara al `.max()` de Zod, un `answer` de 6000 caracteres se reportaria como
  // `json-invalido`, que es mentira: el JSON es valido, lo que es inservible es su tamano. Un
  // motivo de rechazo preciso es lo que permite que el log diga por que fallo.
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    'answer' in candidate &&
    typeof candidate.answer === 'string' &&
    candidate.answer.length > MAX_HARD_ANSWER_CHARS
  ) {
    return { ok: false, reason: 'demasiado-larga', detail: String(candidate.answer.length) }
  }

  const parsed = modelAnswer.safeParse(candidate)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message
    // `exactOptionalPropertyTypes` esta activo: `detail` no admite `undefined` explicito, asi
    // que la clave solo se escribe cuando hay algo que decir.
    return issue === undefined
      ? { ok: false, reason: 'json-invalido' }
      : { ok: false, reason: 'json-invalido', detail: issue }
  }
  const answer = parsed.data
  const warnings: string[] = []

  // 1. Citas: cada id debe existir en la allowlist (`CHA-05`, `CHA-34`).
  const invalidCitations = answer.citations.filter((id) => !isAllowed(id, allowlist))
  if (invalidCitations.length > 0) {
    return { ok: false, reason: 'cita-no-permitida', detail: invalidCitations.join(', ') }
  }
  if (answer.citations.length === 0) warnings.push('sin-citas')

  // 2. Canario: binario y sin margen. Un solo evento es un incidente, no un porcentaje.
  for (const token of CANARY_TOKENS) {
    if (answer.answer.includes(token)) return { ok: false, reason: 'canario', detail: token }
  }

  // 3. PII en la salida: no se filtra, se rechaza. Un CV publico no necesita ninguna de ellas.
  for (const { name, re } of PII_PATTERNS) {
    const found = new RegExp(re.source, re.flags).test(answer.answer)
    if (found) return { ok: false, reason: 'pii-en-salida', detail: name }
  }

  // 4. Fuga de prompt.
  for (const re of OUTPUT_LEAK_PATTERNS) {
    if (re.test(answer.answer)) return { ok: false, reason: 'fuga-prompt' }
  }

  // 5. Longitud: se trunca con elipsis en vez de rechazar. Perder el final de una respuesta
  //    larga es mejor que no responder, siempre que no se haya cortado una cita util.
  let text = answer.answer.trim()
  if (text.length > MAX_ANSWER_CHARS) {
    text = `${text.slice(0, MAX_ANSWER_CHARS - 1).trimEnd()}…`
    warnings.push('truncada')
  }

  // 6. Confianza baja con contenido afirmativo: se rechaza y se deriva a contacto.
  if (answer.confidence === 'low' && text.length > 120) {
    return { ok: false, reason: 'confianza-baja' }
  }

  return { ok: true, answer: { ...answer, answer: text }, warnings }
}
