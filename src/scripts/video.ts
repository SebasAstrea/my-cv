/**
 * Sistema de video — `DEC-02`, `RF-10`, `RF-40..45`, `RUI-95/96`, `RNF-55`.
 *
 * Un solo `<video>` (`DEC-02.b`) recicla el clip de la escena activa. Mejora progresiva: sin
 * JS no hay video y el CV se lee igual (`RF-43`). El video es decorativo (`aria-hidden`); el
 * contenido nunca depende de el.
 */

const MODE_KEY = 'video-mode'
type Mode = 'auto' | 'on' | 'off'

const video = document.querySelector<HTMLVideoElement>('[data-stage-video]')
const posterImg = document.querySelector<HTMLImageElement>('[data-stage-poster]')
const scenes = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'))

const toggleButton = document.querySelector<HTMLButtonElement>('[data-video-toggle]')
const pauseButton = document.querySelector<HTMLButtonElement>('[data-video-pause]')
const restartButton = document.querySelector<HTMLButtonElement>('[data-video-restart]')

const prefersReduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isNarrow = (): boolean => window.matchMedia('(max-width: 600px)').matches

function readMode(): Mode {
  try {
    const raw = localStorage.getItem(MODE_KEY)
    if (raw === 'on' || raw === 'off' || raw === 'auto') return raw
  } catch {
    // almacenamiento no disponible
  }
  return 'auto'
}

let mode: Mode = readMode()
let activeIndex = -1
let destroyTimer: number | undefined

/** `RF-10`: `off` = solo poster; `on` = reproduce; `auto` = respeta sistema (`RUI-74`) y movil (`RUI-95`). */
function shouldPlay(): boolean {
  if (mode === 'off') return false
  if (mode === 'on') return true
  return !prefersReduced() && !isNarrow()
}

function setPoster(scene: HTMLElement): void {
  const poster = scene.dataset.poster
  if (posterImg === null || poster === undefined || poster === '') return
  if (posterImg.getAttribute('src') !== poster) posterImg.setAttribute('src', poster)
  posterImg.hidden = false
}

function destroyVideo(): void {
  if (video === null) return
  video.pause()
  video.removeAttribute('src')
  delete video.dataset.clip
  video.load()
}

/** Activa la escena `index`: cambia poster y clip, reproduce o degrada a poster. */
function activate(index: number): void {
  const scene = scenes[index]
  if (scene === undefined) return
  activeIndex = index
  window.clearTimeout(destroyTimer)
  setPoster(scene)

  if (video === null) return
  const clip = scene.dataset.clip ?? ''

  if (shouldPlay() && clip !== '') {
    if (video.dataset.clip !== clip) {
      video.src = clip
      video.dataset.clip = clip
      video.load()
    }
    const poster = scene.dataset.poster
    if (poster !== undefined && poster !== '') video.poster = poster
    const played = video.play()
    if (played !== undefined) {
      played
        .then(() => {
          if (posterImg !== null) posterImg.hidden = true
        })
        .catch(() => {
          if (posterImg !== null) posterImg.hidden = false
        })
    }
  } else {
    video.pause()
    // `RUI-96`: destruye el clip poco despues de dejar de ser la escena activa.
    if (video.dataset.clip !== undefined) {
      destroyTimer = window.setTimeout(destroyVideo, 2000)
    }
  }
}

/* `RF-41`: reproduce la escena mas visible; pausa al salir. */
const ratios = new Map<number, number>()
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const element = entry.target as HTMLElement
      ratios.set(Number(element.dataset.sceneIndex), entry.intersectionRatio)
    }
    let best = -1
    let bestRatio = 0
    for (const [index, ratio] of ratios) {
      if (ratio > bestRatio) {
        bestRatio = ratio
        best = index
      }
    }
    if (best !== -1 && best !== activeIndex && bestRatio >= 0.2) activate(best)
  },
  { threshold: [0, 0.2, 0.6, 0.8, 1] },
)
for (const scene of scenes) observer.observe(scene)

/* `RF-45`: controles manuales alcanzables por teclado. */
const MODE_LABELS: Record<Mode, string> = {
  auto: 'Vídeo: auto',
  on: 'Vídeo: on',
  off: 'Vídeo: off',
}

function updateToggle(): void {
  if (toggleButton === null) return
  toggleButton.textContent = MODE_LABELS[mode]
  toggleButton.setAttribute('aria-pressed', mode === 'on' ? 'true' : 'false')
}

if (toggleButton !== null) {
  toggleButton.addEventListener('click', () => {
    mode = mode === 'auto' ? 'on' : mode === 'on' ? 'off' : 'auto'
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      // sin persistencia
    }
    updateToggle()
    if (activeIndex !== -1) activate(activeIndex)
  })
}

if (pauseButton !== null) {
  pauseButton.addEventListener('click', () => {
    if (video === null) return
    if (video.paused) {
      void video.play()
      pauseButton.textContent = 'Pausar'
    } else {
      video.pause()
      pauseButton.textContent = 'Reanudar'
    }
  })
}

if (restartButton !== null) {
  restartButton.addEventListener('click', () => {
    if (video === null) return
    video.currentTime = 0
    void video.play()
  })
}

/* `RNF-55`: si un clip falla, se conserva el poster (sin layout shift). */
if (video !== null) {
  video.addEventListener('error', () => {
    if (posterImg !== null) posterImg.hidden = false
  })
}

/* Si tampoco hay poster (p. ej. despliegue sin clips), se oculta en vez de mostrar un roto. */
if (posterImg !== null) {
  posterImg.addEventListener('error', () => {
    posterImg.hidden = true
  })
}

/* Re-evalua al cambiar las preferencias o el ancho. */
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
  if (activeIndex !== -1) activate(activeIndex)
})
window.matchMedia('(max-width: 600px)').addEventListener('change', () => {
  if (activeIndex !== -1) activate(activeIndex)
})

updateToggle()
if (scenes.length > 0 && activeIndex === -1) activate(0)
