/**
 * Preguntas sugeridas — `RF-53`.
 *
 * Se derivan del CV, no se escriben a mano: una lista fija deja de cuadrar en cuanto el CV
 * cambia, y ademas el requisito pide justamente que salgan del documento real. Se toman dos
 * proyectos (los dos primeros, que son los que el propietario puso delante) y dos consultas
 * transversales que el corpus sabe responder: stack y formacion.
 *
 * El idioma esta fijado a espanol porque la i18n es del Sprint 11 (`RF-12`). Cuando exista, esta
 * funcion es el unico sitio que cambia: devuelve textos, no claves de traduccion.
 *
 * No importa nada del chat a proposito. Es una funcion de datos `=> datos`, y por eso se puede
 * probar sin corpus, sin proveedor y sin red.
 */

import { type PublicCvDocument } from '../../data/schema.ts'

/** Etiquetas consultables que el corpus sabe responder (`chunks.ts`). */
const STACK_QUESTION = '¿Qué tecnologías domina y para qué las usa?'
const EDUCATION_QUESTION = '¿Dónde estudió y qué certificaciones tiene?'

export function suggestedQuestions(cv: PublicCvDocument): readonly string[] {
  const questions: string[] = []

  for (const project of cv.projects.slice(0, 2)) {
    questions.push(`¿Qué hiciste en ${project.name}?`)
  }

  questions.push(STACK_QUESTION)
  questions.push(EDUCATION_QUESTION)

  // El esquema permite hasta 20 proyectos; la interfaz muestra 4 como maximo (`RF-53`: 3-4).
  return questions.slice(0, 4)
}
