/**
 * Proveedor de modelo — `DEC-01.b`, `ADR-0004`, `ADR-0008`.
 *
 * **No hay modelo aqui, y es deliberado.** `ABR-01` (que modelo) sigue abierto a proposito: el
 * Sprint 6 construye el camino de los guardrails, no la calidad de la respuesta, y atar el
 * proyecto a un proveedor antes de decidir cual es exactamente el error que `ADR-0004` quiere
 * evitar. Lo que hay aqui es la **interfaz** y un proveedor de reserva que no sale a la red.
 *
 * Que el stub sea determinista no es un atajo de tests: es lo que permite que `gate:chat`
 * compruebe el camino completo (G1 -> recuperacion -> prompt -> proveedor -> G4 -> respuesta)
 * sin gastar un token ni depender de la red. Un gate que necesita una API para funcionar es un
 * gate que acaba desactivado.
 *
 * Lo que este fichero **no** hace, a proposito:
 * - No reintenta. Un reintento automatico de una peticion con la API key es como se convierte
 *   un fallo puntual en un gasto. Quien reintenta es quien sabe si puede.
 * - No registra la pregunta ni la respuesta. El prompt lleva el CV entero; un log de eso es una
 *   copia de PII en otro sitio (`SEG-30`).
 * - No mide tokens aqui. Lo medira el proveedor real en el Sprint 7, con `CHA-32` (`MEDICION.md`).
 */

import type { BuiltPrompt } from './prompt.ts'

/**
 * Un proveedor devuelve **texto crudo**, no un objeto.
 *
 * Deliberadamente: el parseo del JSON es trabajo de `G4`, no del proveedor. Si el proveedor
 * devolviera ya un objeto tipado, cada uno tendria su propia idea de que hacer cuando el modelo
 * devuelve algo invalido, y `CHA-31` (canario) se quedaria sin comprobar en la mitad de los casos.
 */
export interface Provider {
  readonly id: string
  /** `true` si la respuesta no viene de un modelo. La UI lo dice. */
  readonly degraded: boolean
  complete(prompt: BuiltPrompt): Promise<string>
}

/**
 * Valores de `MODEL_PROVIDER` (`DEC-01.b`).
 *
 * `off` funciona sin credenciales. `groq` es la implementacion de API gestionada que eligio
 * `ADR-0009` al cerrar `ABR-01`; sin `GROQ_API_KEY` **degrada a `off`**, no falla.
 */
export type ModelProviderId = 'off' | 'groq'

/** Un solo host, el de `SEG-24`. Si esto cambia, `SEG-24` cambia con el. */
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Proveedor de reserva: responde con el primer chunk recuperado, citado y sin inventar.
 *
 * No simula inteligencia. Recorta la primera frase del chunk mas relevante y la devuelve tal
 * cual, con su id de chunk como cita y `confidence: 'medium'` porque no ha estimado nada. Un
 * despliegue con `MODEL_PROVIDER=off` responde de forma util y honesta: lo que dice esta en el
 * CV, con el fragmento exacto, y sin ninguna sintesis.
 *
 * Devuelve el **mismo contrato** que un modelo real para que el resto del sistema no tenga dos
 * caminos. Un camino especial para el stub es un camino que no se prueba en produccion.
 */
export function offlineProvider(): Provider {
  return {
    id: 'off',
    degraded: true,
    complete(prompt: BuiltPrompt): Promise<string> {
      // Se toma la primera linea de datos del prompt, que es el chunk de mayor score: el
      // endpoint ya lo ha ordenando por relevancia, asi que aqui no hay nada que decidir.
      const data = /^=== BEGIN CV DATA ===\n([\s\S]*?)\n=== END CV DATA ===/m.exec(
        prompt.system,
      )?.[1]
      const firstLine = data
        ?.split('\n')
        .find((line) => line.trim().length > 0)
        ?.trim()
      const answer =
        firstLine === undefined
          ? 'No consta en el CV.'
          : firstLine.length > 600
            ? firstLine.slice(0, 599).trimEnd() + '…'
            : firstLine
      const chunkId = /^-\s*id:\s*(\S+)/m.exec(data ?? '')?.[1] ?? ''
      return Promise.resolve(
        JSON.stringify({
          answer,
          citations: chunkId === '' ? [] : [chunkId],
          confidence: 'medium',
        }),
      )
    },
  }
}

/**
 * Groq — `ADR-0009`, el cierre de `ABR-01`.
 *
 * Se eligio por tres numeros, no por gusto: plan gratuito sin tarjeta, 1.000 peticiones/dia y
 * 200.000 tokens/dia, `gpt-oss-120b` por encima del 0,85 de calidad que exige `CHA-33`, y
 * prompts no usados para entrenar (el free tier de Gemini si los usa, y un CV no es training data).
 *
 * Lo que este proveedor **no** hace, y es lo importante:
 * - No reintenta. Un reintento con la API key es como un fallo puntual se convierte en un gasto.
 *   Si Groq falla, el handler cae a `off` y el visitante recibe una cita, no un error.
 * - No registra ni la pregunta ni la respuesta ni el prompt. Un log de eso es una copia del CV
 *   en otro sitio (`SEG-30`).
 * - No mira la respuesta. Devuelve texto crudo; decidir si vale es trabajo de G4, en un sitio.
 */
function groqProvider(apiKey: string): Provider {
  return {
    id: 'groq',
    degraded: false,
    async complete(prompt: BuiltPrompt): Promise<string> {
      // El prompt va como mensaje `user` y **no** como `system`. Todo lo que lleva dentro
      // (instrucciones, corpus, pregunta) esta marcado como delimitado y no confiable por G3; si
      // ademas viajara en el rol de maxima confianza, el modelo recibiria dos señales
      // contradictorias sobre que parte es_data. Un unico mensaje `user` no deja nada privilegiado
      // que un "ignora lo anterior" pueda atacar.
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [{ role: 'user', content: prompt.system }],
          // `gpt-oss` es un modelo de razonamiento: la respuesta llega con un campo `reasoning`
          // aparte. El techo es alto porque el razonamiento se paga con los mismos tokens, y con
          // uno bajo se queda a medias y `content` sale vacio.
          max_completion_tokens: 2000,
          reasoning_effort: 'low',
          temperature: 0.1,
        }),
        // Sin esto, un proveedor colgado se lleva la funcion serverless por delante. Cortar es
        // mejor que quedarse esperando: el visitante recibe la cita de `off` y el gate sigue verde.
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      })

      if (!res.ok) throw new Error(`Groq respondio ${res.status}`)
      const body: unknown = await res.json()
      const content = readContent(body)
      if (content === '') throw new Error('Groq devolvio content vacio')
      // El `reasoning` se descarta a proposito: es la cadena de pensamiento del modelo, no la
      // respuesta. Si se colara en `answer` seria ruido, y puede que texto que G4 teria que
      // medir. Un proveedor no decide que es la respuesta.
      return content
    },
  }
}

/** Techo de espera del proveedor. Medido: `gpt-oss-120b` responde en 1,2–2,0 s. */
const PROVIDER_TIMEOUT_MS = 8000

/**
 * Saca `choices[0].message.content` de la respuesta de Groq.
 *
 * Se valida el camino a mano en vez de confiar en un `as` porque lo que llega por la red no es
 * de este proyecto (`RNF-80`): un `choices` vacio o un `content` que no sea string no pueden
 * llegar a `JSON.stringify` de G4 y romperlo con un `TypeError` en lugar de con un motivo.
 */
function readContent(body: unknown): string {
  if (typeof body !== 'object' || body === null) return ''
  const choices = (body as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const first: unknown = choices[0]
  if (typeof first !== 'object' || first === null) return ''
  const message = (first as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return ''
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' ? content.trim() : ''
}

/**
 * Resuelve el proveedor segun `MODEL_PROVIDER` (`DEC-01.b`).
 *
 * `groq` **degrada a `off`** si falta `GROQ_API_KEY`, en vez de lanzar. La razon: un despliegue
 * con la clave mal puesta o caducada debe seguir contestando con citas, porque un chat caido es
 * peor que un chat tonto. Un valor desconocido si lanza, porque ahi el error es de configuracion
 * y callarlo dejaria un despliegue medio configurado creyendose que habla con un modelo.
 */
export function getProvider(id: string | undefined, apiKey: string | undefined): Provider {
  const value = id ?? 'off'
  if (value === 'off') return offlineProvider()
  if (value === 'groq') {
    if (apiKey === undefined || apiKey.trim() === '') return offlineProvider()
    return groqProvider(apiKey.trim())
  }
  throw new Error(
    `[ABR-01] MODEL_PROVIDER="${value}" no esta implementado. ` +
      'Los valores validos son "groq" (ADR-0009) y "off".',
  )
}
