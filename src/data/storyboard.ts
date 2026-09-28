/**
 * Storyboard de la linea temporal — `SPEC.md` 5.9, `ABR-05`.
 *
 * El storyboard esta DEFINIDO en el spec y los clips los produce el propietario. Este modulo
 * es la fuente de la que salen los metadatos generados de cada escena (`RF-24`): el timecode,
 * la duracion y el indice `00/07 ... 06/07`. Nada de eso se escribe a mano en el markup, o
 * dejaria de cuadrar en cuanto un clip cambie de duracion.
 *
 * En el Sprint 5 este mismo objeto es el manifest de video que consume `DEC-02`: nombre de
 * fichero, ladder de resoluciones, bitrate objetivo y GOP salen de aqui, no de una constante
 * suelta en el componente de video.
 *
 * `RUI-60.b` exige que los timecodes **correspondan a los clips**. Por eso estan en segundos
 * exactos y por eso el gate de `RNF-24` compara el timecode renderizado con esta tabla.
 */

/** Duracion de cada clip, en segundos, al frame. Tomada literalmente de `SPEC.md` 5.9. */
export const CLIP_DURATIONS_S = [7, 8, 10, 12, 7, 6, 8] as const

export const SCENE_IDS = [
  'identidad',
  'perfil',
  'experiencia',
  'proyectos',
  'stack',
  'formacion',
  'contacto',
] as const

export type SceneId = (typeof SCENE_IDS)[number]

/** Clip de la escena 03: tres sub-cortes de 4 s, uno por proyecto destacado. */
export const PROJECT_SUBCUT_S = 4
export const PROJECT_SUBCUTS = CLIP_DURATIONS_S[3] / PROJECT_SUBCUT_S

/** Formatea segundos como `MM:SS`. `RF-44` lo muestra en el rail. */
export function timecode(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export interface SceneMeta {
  readonly id: SceneId
  /** Indice de la escena, 0-based. `00/07` sale de aqui. */
  readonly index: number
  /** `00/07` — numeracion editorial de margen (`RUI-60.a`). */
  readonly counter: string
  readonly slug: string
  /** Id estable del heading, `RF-01`: `#escena-0N`. */
  readonly anchor: string
  /** Duracion del clip en segundos. */
  readonly durationS: number
  /** Inicio del clip en la linea, en segundos. Acumulado. */
  readonly startS: number
  readonly endS: number
  readonly timecodeStart: string
  readonly timecodeEnd: string
  /** Duracion en el formato relativo de `RF-23`: "10 s", "1 min 2 s". */
  readonly durationLabel: string
  /** `RF-44`: `00:04 / 00:07`. */
  readonly progress: string
  /**
   * Proporcion de la retícula asimetrica de esta escena (`RUI-21`, `RUI-60.c`).
   * Nunca 50/50: alterna `wide-content` (7/5) y `wide-meta` (5/7).
   */
  readonly split: 'wide-content' | 'wide-meta'
  /** Clave de fichero del clip. `DEC-02.a`. El prefijo de resolucion se anade al montar. */
  readonly clip: string
  /** Version del clip para el cache-busting del `src`. */
  readonly clipVersion: number
}

/** Duracion legible: `RUI-60.f` muestra la duracion real de cada etapa en el margen. */
function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`
}

/**
 * Construye los metadatos de escena con el cursor de tiempo acumulado.
 *
 * Funcion declarada en vez de IIFE: el transpificador de TypeScript emite mal los parentesis
 * de un `satisfies` dentro de una IIFE anidada en un `import.meta` mas arriba, y el fallo
 * aparece en tiempo de ejecucion como `SCENE_IDS.map(...) is not a function`, que no senala
 * el sitio real del problema.
 */
function buildScenes(): readonly SceneMeta[] {
  const total = String(SCENE_IDS.length).padStart(2, '0')
  let cursor = 0

  return SCENE_IDS.map((id, index): SceneMeta => {
    const durationS = CLIP_DURATIONS_S[index] ?? 0
    const startS = cursor
    cursor += durationS
    const padded = String(index).padStart(2, '0')

    return {
      id,
      index,
      counter: `${padded}/${total}`,
      slug: `escena-${padded}`,
      anchor: `escena-${padded}`,
      durationS,
      startS,
      endS: cursor,
      timecodeStart: timecode(startS),
      timecodeEnd: timecode(cursor),
      durationLabel: durationLabel(durationS),
      progress: `${timecode(startS)} / ${timecode(cursor)}`,
      // `RUI-21`: nunca 50/50. Alterna 7/5 y 5/7 para que la retícula respire.
      split: index % 2 === 0 ? 'wide-content' : 'wide-meta',
      clip: `sc${padded}`,
      clipVersion: 1,
    }
  })
}

/** `RF-24`: metadatos generados, no escritos a mano. */
export const SCENES: readonly SceneMeta[] = buildScenes()

/** Duracion total de la linea temporal. Util para el `timecode` final y para el budget. */
export const TOTAL_DURATION_S = SCENES.reduce((sum, s) => sum + s.durationS, 0)

/** Busqueda por id, para el resto del codigo. `noUncheckedIndexedAccess` obliga a comprobar. */
export function sceneById(id: string): SceneMeta | undefined {
  return SCENES.find((s) => s.id === id)
}
