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

/** Valores de `MODEL_PROVIDER`. `off` es el unico que funciona sin credenciales. */
export type ModelProviderId = 'off'

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
function offlineProvider(): Provider {
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
 * Resuelve el proveedor segun `MODEL_PROVIDER`.
 *
 * Solo hay un valor implemented. Cuando `ABR-01` se cierre, se anaden aqui los proveedores
 * de API gestionada que elija `ADR-0004`, todos con la misma interfaz, y el gate no cambia.
 */
export function getProvider(id: string | undefined): Provider {
  const value = id ?? 'off'
  if (value === 'off') return offlineProvider()
  throw new Error(
    `[ABR-01] MODEL_PROVIDER="${value}" no esta implementado. ` +
      'Los proveedores de API gestionada llegan al cerrar ABR-01 (ADR-0004). ' +
      'Hasta entonces el unico valor valido es "off".',
  )
}
