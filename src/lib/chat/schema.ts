/**
 * Contrato de la API del chat — `RF-50`, `SEG-20`, `ADR-0008`.
 *
 * Es un `.strict()` por la misma razon que el del CV: lo que llega por la red entra aqui, y un
 * campo que no se declare no se ignora en silencio, se rechaza. Con un objeto abierto, un
 * atacante anadiria `{ "role": "system", "citations": [...] }` y el endpoint leeria lo que le
 * mandan de forma distinta a la que se espera.
 *
 * El request es **una** pregunta y nada mas. No hay historial, no hay `sessionId` obligatorio y
 * no hay forma de inyectar contexto: el unico contexto posible es el que el servidor decide
 * recuperar del CV. Es la decision de `ADR-0008` que hace el ataque de prompt injection
 * irrelevante por construccion, y por eso el schema no ofrece la extension que lo haria posible.
 */

import { z } from 'zod'
import { MAX_ANSWER_CHARS, MAX_INPUT_CHARS } from './guardrails.ts'

/**
 * Lo que acepta el endpoint.
 *
 * `.strict()` y `question` con el mismo tope que G1: el recorte se hace una sola vez, en el
 * borde, y el resto del sistema asume que la pregunta ya esta saneada. Si el endpoint admitiera
 * 10 KB, habria dos reglas de recorte y solo una comprobada.
 */
export const chatRequest = z
  .object({
    question: z.string().min(1).max(MAX_INPUT_CHARS),
  })
  .strict()

export type ChatRequest = z.infer<typeof chatRequest>

/** Ids de chunk que respaldan la respuesta. Los decide el servidor, nunca el cliente. */
export const chatCitations = z.array(z.string().min(1).max(80)).max(8)

/**
 * Lo que devuelve el endpoint.
 *
 * `ok: false` no es un error HTTP con cuerpo de error: es una respuesta valida con un motivo, y
 * el texto que ve la persona lo decide el servidor (`rejectionText`). El cliente solo tiene que
 * saber mostrar `answer`.
 */
export const chatResponse = z
  .object({
    ok: z.boolean(),
    /** Texto listo para mostrar. Nunca contiene salida cruda del modelo. */
    answer: z.string().max(MAX_ANSWER_CHARS + 200),
    citations: chatCitations,
    /** `true` si la respuesta no viene de un modelo, sino del proveedor de reserva. */
    degraded: z.boolean(),
    /** Motivo de `ok: false`. Ausente cuando la respuesta es correcta. */
    reason: z.string().max(60).optional(),
    /** Avisos de auditoria (`sin-citas`, `truncada`). No se muestran al usuario. */
    warnings: z.array(z.string().max(40)).max(8).default([]),
  })
  .strict()

export type ChatResponse = z.infer<typeof chatResponse>
