/**
 * De una cita (`chunk-id`) a su sitio exacto en la pagina — `RF-52`.
 *
 * El modelo cita ids del corpus (`stack`, `proyectos.tooling-deploy`, `formacion.grado`), y esos
 * ids no son anclas del DOM. Traducirlos es responsabilidad del servidor de guardrails, no del
 * modelo: si el modelo pudiera elegir a donde lleva un enlace, un chunk comprometido seria un
 * enlace a otro sitio.
 *
 * La traduccion es puramente derivada, sin estado y sin red, para que la pueda usar el mismo
 * modulo en el servidor (para saber que anclas existen) y en el cliente (para navegar al pulsar
 * una cita). El id no se interpola nunca en el DOM: se busca en este mapa y se usa el valor del
 * mapa, que es de lista cerrada.
 *
 * El ancla de escena sale de `SCENE_IDS` (`storyboard.ts`), que es la fuente de la numeracion
 * `#escena-0N` de `RF-01`. Escribir aqui `escena-03` a mano seria una segunda fuente que se
 * rompe en cuanto se reordene el storyboard.
 */

import { SCENE_IDS, type SceneId } from '../../data/storyboard.ts'

/** Raiz de un id de chunk. Coincide con `SectionId` de `chunks.ts`. */
export type CitationSection =
  'persona' | 'perfil' | 'experiencia' | 'proyectos' | 'stack' | 'formacion'

/** `RUI-60`/`RF-01`: que escena corresponde a cada seccion del corpus. */
const SECTION_TO_SCENE: Readonly<Record<CitationSection, SceneId>> = {
  persona: 'identidad',
  perfil: 'perfil',
  experiencia: 'experiencia',
  proyectos: 'proyectos',
  stack: 'stack',
  formacion: 'formacion',
}

/** Texto del enlace de la cita. El mismo nombre que la escena. */
const SECTION_LABEL: Readonly<Record<CitationSection, string>> = {
  persona: 'Identidad',
  perfil: 'Perfil',
  experiencia: 'Experiencia',
  proyectos: 'Proyectos',
  stack: 'Stack',
  formacion: 'Formación',
}

const SECTIONS = Object.keys(SECTION_TO_SCENE) as readonly CitationSection[]

function isSection(value: string): value is CitationSection {
  return (SECTIONS as readonly string[]).includes(value)
}

/** Raiz del id. `proyectos.tooling-deploy` → `proyectos`; lo desconocido cae a `persona`. */
export function citationSection(id: string): CitationSection {
  const root = id.split('.')[0] ?? ''
  return isSection(root) ? root : 'persona'
}

export interface CitationTarget {
  readonly section: CitationSection
  /** Ancla estable del heading: `escena-03`. */
  readonly sceneAnchor: string
  /** Desplegable del proyecto, si la cita es de un proyecto: `proyecto-<slug>`. */
  readonly detailAnchor?: string
  /** Texto visible del enlace. */
  readonly label: string
}

/**
 * Destino de una cita. Devuelve `undefined` si el id contiene algo que no es de lista cerrada:
 * preferimos dejar la cita sin enlace a construir uno con texto del modelo.
 */
export function citationTarget(id: string): CitationTarget | undefined {
  const section = citationSection(id)
  const sceneId = SECTION_TO_SCENE[section]
  const index = SCENE_IDS.indexOf(sceneId)
  if (index < 0) return undefined
  const base: CitationTarget = {
    section,
    sceneAnchor: `escena-${String(index).padStart(2, '0')}`,
    label: SECTION_LABEL[section],
  }
  if (section !== 'proyectos') return base

  const slug = id.slice('proyectos.'.length)
  // El slug lo genera el propio corpus a partir del id del proyecto; se comprueba igualmente
  // porque un id con `/`, espacios o comillas acabaria en un selector o en un `id=` roto.
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return base
  return { ...base, detailAnchor: `proyecto-${slug}` }
}
