/**
 * Handler del chat — `RF-50`, `SEG-20`, `ADR-0008`.
 *
 * **No sabe nada de Astro.** Es una funcion de `(Request) => Response`, y la ruta de Astro
 * (`src/pages/api/chat.ts`) es la que la monta. La separacion no es estetica: `getCv()` usa
 * `import.meta.glob`, que es una transformacion de Vite y no existe en Node pelado, asi que si
 * la ruta y la logica vivieran en el mismo fichero, `gate:chat` no podria importar el handler
 * para probarlo sin reventar al cargar el modulo. Separado, el gate ejercita exactamente el
 * codigo que corre en produccion.
 *
 * El pipeline es fijo y en este orden, porque cada etapa cuesta mas que la anterior:
 *
 *   1. origen, metodo y tasa — gratis; corta el uso desde otro sitio antes de leer el cuerpo
 *   2. `chatRequest`        — Zod `.strict()`; lo que no esta declarado no se procesa
 *   3. `intake` (G1)        — sin coste de token; de aqui sale el "no llamo al modelo"
 *   4. `retrieve`           — sin coste; de aqui sale el "no consta en el CV" (`CHA-06`)
 *   5. `buildPrompt`        — el corpus lo elige el servidor, nunca el cliente (`SEG-11`)
 *   6. `provider`           — el unico punto que sale a la red
 *   7. `validateOutput` (G4)— sin coste; ninguna salida llega al cliente sin pasar por aqui
 *
 * Las etapas 3, 4 y 7 no cuestan dinero, y por eso van antes y despues del modelo y no dentro
 * de el: un guardrail que corre "dentro" del prompt es una recomendacion, no un control.
 */

import { MIN_RELEVANCE, retrieve, type Chunk } from './chunks.ts'
import { intake, rejectionText, validateOutput } from './guardrails.ts'
import { buildPrompt, hashPrompt } from './prompt.ts'
import { getProvider, offlineProvider, type Provider } from './provider.ts'
import { chatRequest, type ChatResponse } from './schema.ts'
import { chatEnabled, groqApiKey, modelProvider, ratePerMinute, siteUrl } from '../env.ts'

export interface Corpus {
  readonly chunks: readonly Chunk[]
  readonly allowlist: ReadonlySet<string>
}

/**
 * Fabrica del handler.
 *
 * Existe por una razon concreta: `getCv()` usa `import.meta.glob`, que es una transformacion de
 * Vite y **no existe** en Node pelado, asi que un gate que importase `chat.ts` para probarlo
 * reventaria al cargar el modulo, no al ejecutar el handler. Con la dependencia del corpus
 * inyectada, `gate:chat` ejercita el handler de verdad —el mismo de produccion, no una copia—
 * con el fixture, y la unica linea que queda atada a `getCv()` es la de abajo.
 *
 * El corpus se carga por peticion y no al arrancar el modulo a proposito: `getCv()` ya cachea,
 * y asi el handler es correcto aunque el documento cambie entre invocaciones.
 */

/** Cuerpo maximo aceptado. El schema ya limita `question`; esto corta antes de parsear. */
const MAX_BODY_BYTES = 2048

/**
 * Textos fijos de rechazo.
 *
 * Ninguno lo genera el modelo y ninguno contiene lo que el usuario escribio. Es lo unico que
 * sale hacia el cliente cuando algo falla, y por eso estan aqui y no en el prompt: un texto de
 * rechazo que depende del modelo es un texto de rechazo que se puede convencer.
 */
const FIXED = {
  origen: 'La peticion no viene de este sitio.',
  metodo: 'Metodo no permitido.',
  vacio: 'Escribe una pregunta.',
  bloqueado: 'No puedo responder a eso.',
  fueraDeAlcance:
    'Puedo responder preguntas sobre el CV (experiencia, proyectos, stack, formacion). ' +
    'Sobre la decision de contratar, no soy la persona indicada.',
  deshabilitado: 'El chat no esta disponible.',
  tasa: 'Demasiadas preguntas seguidas. Espera un momento.',
  cuerpo: 'La peticion es demasiado grande.',
  formato: 'La peticion no tiene el formato esperado.',
  proveedor: 'El servicio no responde. Intentalo de nuevo.',
  sinContexto: 'No consta en el CV.',
} as const

/**
 * Ventana de tasa por instancia.
 *
 * Es una mitigacion de cortesias, **no** una cuota: en serverless cada instancia tiene la suya,
 * el identificador lo pone el cliente y por tanto no es una identidad, y un atacante puede
 * distribuir peticiones. Ver `rateLimitedByIp` para lo que si es una identidad.
 */
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 12
const hits = new Map<string, number[]>()

/**
 * Peticiones por minuto y **IP** (`RNF-68`, decision del PO).
 *
 * Esta es la unica cuota del endpoint que no la elige el cliente: la IP sale de las cabeceras que
 * pone el proxy delante de la funcion, no del cuerpo ni de una cabecera que pueda falsear el
 * navegador. Sigue sin ser una identidad de persona (una IP es una NAT, y un atacante con
 * cuentas de proxy la rotates), asi que acota el abuso de Hobby, no lo detiene.
 *
 * El limite vive aqui y no en un store compartido porque en serverless cada instancia tiene la
 * suya. Con varias instancias el tope real por IP es `CHAT_RATE_PER_MIN` multiplicado por
 * cuantas mas haya. Es laLimitacion que se acepto knowingly al decidir no meter Redis (`TD-12`).
 */
const hitsByIp = new Map<string, number[]>()

/** Identidad de red de la peticion, en orden de fiabilidad decreciente. */
function clientIp(request: Request): string {
  for (const header of ['x-vercel-forwarded-for', 'cf-connecting-ip', 'x-forwarded-for']) {
    const value = request.headers.get(header)
    if (value === null || value.trim() === '') continue
    // `x-forwarded-for` es una cadena de saltos: `cliente, proxy1, proxy2`. El primero es el
    // cliente, y es el unico que nos interesa; los proxies son de fiar, el cliente no.
    const first = value.split(',')[0]
    if (first !== undefined && first.trim() !== '') return first.trim()
  }
  return 'desconocida'
}

function rateLimitedByIp(ip: string, max: number): boolean {
  const now = Date.now()
  const recent = (hitsByIp.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= max) {
    hitsByIp.set(ip, recent)
    return true
  }
  recent.push(now)
  hitsByIp.set(ip, recent)
  if (hitsByIp.size > 5000) {
    for (const [key, times] of hitsByIp) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) hitsByIp.delete(key)
    }
  }
  return false
}

/** Reinicia la cuota por IP. Lo usa el gate, que si no arrastraria el limite entre casos. */
export function resetIpQuota(): void {
  hitsByIp.clear()
}

function rateLimited(session: string): boolean {
  const now = Date.now()
  const recent = (hits.get(session) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) {
    hits.set(session, recent)
    return true
  }
  recent.push(now)
  hits.set(session, recent)
  // El mapa crece con cada session distinta; podarlo lo deja acotado por el uso real.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key)
    }
  }
  return false
}

function json(body: ChatResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Una respuesta de chat en cache es la respuesta de otra persona.
      'cache-control': 'no-store',
    },
  })
}

/** Rechazo con texto fijo. `reason` va al log; el texto que ve la persona no lo elige el modelo. */
function deny(answer: string, reason: string, status: number, degraded = false): Response {
  return json({ ok: false, answer, citations: [], degraded, reason, warnings: [] }, status)
}

/**
 * Corte por origen.
 *
 * `connect-src 'self'` ya impide que un navegador *lea* una respuesta de otro sitio, pero un
 * `<form>` o un `fetch` en modo `no-cors` si puede *enviarla*, y quien paga la llamada es esta
 * cuenta. Comparar el `Origin` contra el host corta ese caso sin coste de red. Las peticiones
 * sin `Origin` (curl, gates) pasan: son las legitimas de una comprobacion.
 */
function foreignOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (origin === null) return false
  try {
    return new URL(origin).host !== new URL(siteUrl()).host
  } catch {
    return true
  }
}

/**
 * Fabrica del handler.
 *
 * Las dos dependencias se inyectan por una razon concreta: `getCv()` usa `import.meta.glob`, que
 * es una transformacion de Vite y **no existe** en Node pelado, asi que un gate que importase
 * `chat.ts` para probarlo reventaria al cargar el modulo, no al ejecutar el handler. Con el
 * corpus y el proveedor inyectados, `gate:chat` ejercita el handler de verdad —el mismo de
 * produccion, no una copia— con el fixture, y lo unico que queda atado a Vite es la ultima
 * linea del fichero.
 *
 * El proveedor tambien se inyecta porque la prueba en negativo de `G4` (`STATUS.md` §3.1) necesita
 * un proveedor que devuelva un canario, y eso no se puede pedir al proveedor de verdad sin hacer
 * una llamada de red. Un guardrail que solo se puede probar con el sistema real es un guardrail
 * que acaba sin probar.
 *
 * El corpus se carga por peticion y no al arrancar el modulo a proposito: `getCv()` ya cachea,
 * y asi el handler es correcto aunque el documento cambie entre invocaciones.
 */
/**
 * El handler solo desestructura `request`. Declarar aqui el contrato minimo, en vez de devolver
 * directamente la `APIRoute` de Astro, tiene dos efectos: la ruta sigue compilando sin cast
 * (`APIContext` es asignable a `{ request }`, al reves no), y el gate puede invocar el handler en
 * Node sin fabricar cookies, `props` ni `redirect` de Astro.
 */
export type ChatHandler = (context: { request: Request }) => Promise<Response>

export function createChatHandler(
  loadCorpus: () => Corpus,
  loadProvider: () => Provider = () => getProvider(modelProvider(), groqApiKey()),
): ChatHandler {
  return async ({ request }): Promise<Response> => {
    // El metodo se comprueba aqui y no solo con `export const ALL` de la ruta. Depender de que el
    // framework enrute bien es confiar en que lo hara; y con un `GET` sin cuerpo, un `text()` y un
    // `JSON.parse` fallarian con 400, que dice "tu peticion esta mal" de algo que no lo esta.
    if (request.method !== 'POST') return deny(FIXED.metodo, 'metodo', 405)

    if (foreignOrigin(request)) return deny(FIXED.origen, 'origen-externo', 403)
    if (!chatEnabled()) return deny(FIXED.deshabilitado, 'deshabilitado', 404)

    // La cuota por IP va **antes** de la de sesion y antes de leer el cuerpo: es la que no la
    // elige el cliente, y leer el cuerpo de un petitorio ya es trabajo que nadie quiere hacer.
    // La de sesion se queda como segunda capa, porque una pestana puede reventar su cuota propia
    // sin querer sin que eso deba tumbar a su IP entera.
    if (rateLimitedByIp(clientIp(request), ratePerMinute())) return deny(FIXED.tasa, 'tasa', 429)

    const session = request.headers.get('x-session') ?? 'anon'
    if (rateLimited(session)) return deny(FIXED.tasa, 'tasa', 429)

    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return deny(FIXED.cuerpo, 'cuerpo', 413)
    }

    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return deny(FIXED.formato, 'formato', 400)
    }
    const parsed = chatRequest.safeParse(body)
    if (!parsed.success) return deny(FIXED.formato, 'formato', 400)
    if (parsed.data.question.trim().length === 0) return deny(FIXED.vacio, 'vacio', 400)

    // --- G1. Sin coste: aqui se decide si hay llamada o no ---
    const gate = intake(parsed.data.question)
    if (!gate.ok) {
      // `gate.reason` es un valor de lista cerrada: el texto del usuario no llega al log.
      console.info('[chat] G1 bloquea', { intent: gate.intent, reason: gate.reason })
      return deny(FIXED.bloqueado, gate.reason ?? 'filtro-de-entrada', 400)
    }

    // Fuera de alcance se responde sin llamar al modelo (`CHA-20`): el texto es fijo y no depende
    // de que el modelo "se niegue" a opinar, que es una garantia que no existe.
    if (gate.intent === 'out_of_scope') {
      console.info('[chat] fuera de alcance')
      return json(
        {
          ok: true,
          answer: FIXED.fueraDeAlcance,
          citations: [],
          degraded: false,
          reason: 'fuera-de-alcance',
          warnings: [],
        },
        200,
      )
    }

    // --- Recuperacion. Sin coste: de aqui sale el "no consta" de `CHA-06` ---
    const { chunks, allowlist } = loadCorpus()
    const found = retrieve(gate.question, chunks, allowlist)

    if (found.topScore < MIN_RELEVANCE) {
      console.info('[chat] sin contexto', {
        topScore: Number(found.topScore.toFixed(3)),
        unmatched: found.unmatchedTerms.length,
      })
      return json(
        {
          ok: true,
          answer: FIXED.sinContexto,
          citations: [],
          degraded: false,
          reason: 'sin-contexto',
          warnings: [],
        },
        200,
      )
    }

    // --- Unico punto que sale a la red ---
    // `loadProvider()` va DENTRO del try a proposito: resolver el proveedor tambien lanza, cuando
    // `MODEL_PROVIDER` tiene un valor que no existe (`ABR-01`). Fuera del try, un despliegue mal
    // configurado devolveria un 500 sin manejar, con la traza del framework en el cuerpo, en vez
    // de un 502 con texto fijo.
    const prompt = buildPrompt(
      found.chunks.map((c) => ({ id: c.id, text: c.text })),
      gate.question,
    )

    let modelRaw: string
    let degraded = false

    // Resolver el proveedor va FUERA del try que degrada, a proposito. Un `MODEL_PROVIDER` que no
    // existe es un error de configuracion: si se degradara en silencio, un despliegue mal
    // configurado responderia con citas y pareceria un chat que funciona, que es la forma mas
    // cara de no enterarse. Un 502 con texto fijo dice "el modelo no esta" sin filtrar la traza.
    let provider: Provider
    try {
      provider = loadProvider()
    } catch (error) {
      console.error('[chat] proveedor no configurado', { error: String(error) })
      return deny(FIXED.proveedor, 'proveedor', 502, false)
    }
    degraded = provider.degraded

    try {
      modelRaw = await provider.complete(prompt)
    } catch (error) {
      // Se registra el fallo del proveedor, nunca el prompt: el prompt lleva el CV entero.
      //
      // Un fallo de API **no** es un 502 cuando hay alternativa. Con `ADR-0009` cerrado, casi
      // todos los fallos que llegan aqui son de red o de cuota del proveedor: Groq caido, 429, la
      // clave caducada, el timeout de 8 s. Devolver 502 en esos casos deja el chat muerto por un
      // problema de un tercero, y el visitante no tiene ni idea de que ha habido un modelo
      // detras. Se degrada al proveedor de reserva y se dice con `degraded: true`, que es lo que
      // la UI usa para no fingir que esto lo escribio un modelo.
      //
      // No es un reintento de la llamada fallida: es un camino distinto, sin coste, que ya
      // devuelve texto valido y pasa por el mismo G4. Lo que no se reintenta es Groq.
      console.error('[chat] proveedor caido, se degrada a "off"', { error: String(error) })
      try {
        modelRaw = await offlineProvider().complete(prompt)
        degraded = true
      } catch {
        // Si hasta el de reserva falla (no deberia: no toca la red), un 502 es honesto.
        return deny(FIXED.proveedor, 'proveedor', 502, false)
      }
    }

    // --- G4. Sin coste: de aqui no sale nada sin pasar ---
    const verdict = validateOutput(modelRaw, allowlist)
    console.info('[chat] turno', {
      prompt: hashPrompt(prompt.system).slice(0, 8),
      ok: verdict.ok,
      reason: verdict.ok ? 'ok' : verdict.reason,
      warnings: verdict.ok ? verdict.warnings : [],
    })

    if (!verdict.ok) return deny(rejectionText(verdict.reason), verdict.reason, 200, degraded)

    return json(
      {
        ok: true,
        answer: verdict.answer.answer,
        citations: verdict.answer.citations,
        degraded,
        warnings: [...verdict.warnings],
      },
      200,
    )
  }
}
