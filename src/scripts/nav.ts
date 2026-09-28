/**
 * Navegacion, estado del rail, deep-link y tema — `RF-02..05`, `RF-09`.
 *
 * Mejora progresiva (`RF-07`, `RNF-101`): sin este script el CV se lee entero y el rail sigue
 * siendo enlaces `#escena-0N` que funcionan solos. Lo que anade es:
 *   - el estado activo del rail (`RF-02`, `RUI-34`),
 *   - la URL deep-linkeable sin ensuciar el historial (`RF-04`),
 *   - la navegacion por teclado entre escenas (`RF-05`),
 *   - el toggle de tema persistente (`RF-09`).
 *
 * Sin JS no se pierde contenido: solo comodidad. Por eso todo se engancha sobre el DOM ya
 * renderizado en servidor, sin crear nodos de contenido.
 */

const SCENE_SELECTOR = '[data-scene]'
const RAIL_LINK_SELECTOR = '[data-scene-link]'
const HEADING_SUFFIX = '-titulo'

/** Escenas en orden de documento. */
function scenes(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SCENE_SELECTOR))
}

/** Marca una escena como activa en el rail. `RUI-34`: no depende solo del color. */
function setActive(id: string): void {
  for (const link of document.querySelectorAll<HTMLElement>(RAIL_LINK_SELECTOR)) {
    link.setAttribute('aria-current', link.dataset.sceneLink === id ? 'true' : 'false')
  }
}

/** Mueve el foco al heading enfocable de la escena (`RF-05`) y sincroniza la URL. */
function goTo(scene: HTMLElement, push: boolean): void {
  const id = scene.id
  const heading = document.getElementById(`${id}${HEADING_SUFFIX}`)
  scene.scrollIntoView({ block: 'start' })
  heading?.focus({ preventScroll: true })
  setActive(id)
  activeId = id
  const url = `#${id}`
  if (push) history.pushState(null, '', url)
  else history.replaceState(null, '', url)
}

let activeId: string | null = null

/* ------------------------------------------------------------------ *
 * `RF-02` + `RF-04`: estado activo por visibilidad, URL por replaceState.
 * ------------------------------------------------------------------ */

const ratios = new Map<string, number>()

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      ratios.set(entry.target.id, entry.intersectionRatio)
    }
    let best: string | null = null
    let bestRatio = 0
    for (const [id, ratio] of ratios) {
      if (ratio > bestRatio) {
        bestRatio = ratio
        best = id
      }
    }
    if (best !== null && best !== activeId) {
      activeId = best
      setActive(best)
      // `RF-04`: el scroll no crea entradas de historial; la URL se reescribe.
      history.replaceState(null, '', `#${best}`)
    }
  },
  { threshold: [0, 0.25, 0.5, 0.75, 1] },
)

for (const scene of scenes()) observer.observe(scene)

// Estado inicial: el hash si existe, o la primera escena.
const initialHash = location.hash.replace('#', '')
const initial = initialHash !== '' ? document.getElementById(initialHash) : null
activeId = initial?.dataset.scene ?? scenes()[0]?.id ?? null
if (activeId !== null) setActive(activeId)

/* ------------------------------------------------------------------ *
 * `RF-03`: clic en el rail (sin JS el ancla ya funciona; con JS se enfoca el heading).
 * ------------------------------------------------------------------ */

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null
  const link = target?.closest<HTMLAnchorElement>(RAIL_LINK_SELECTOR)
  const id = link?.dataset.sceneLink
  if (link === null || link === undefined || id === undefined) return
  const scene = document.getElementById(id)
  if (scene === null) return
  event.preventDefault()
  goTo(scene, true)
})

/* ------------------------------------------------------------------ *
 * `RF-05`: navegacion por teclado entre escenas.
 * ------------------------------------------------------------------ */

const NAV_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'])

function currentIndex(list: HTMLElement[]): number {
  const focusedScene = document.activeElement?.closest<HTMLElement>(SCENE_SELECTOR)
  if (focusedScene !== null && focusedScene !== undefined) return list.indexOf(focusedScene)
  return list.findIndex((scene) => scene.id === activeId)
}

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !NAV_KEYS.has(event.key)) return
  const target = event.target as HTMLElement | null
  if (
    target?.isContentEditable === true ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
  ) {
    return
  }
  const list = scenes()
  if (list.length === 0) return
  const from = Math.max(0, currentIndex(list))
  let next = from
  if (event.key === 'ArrowDown' || event.key === 'PageDown')
    next = Math.min(list.length - 1, from + 1)
  else if (event.key === 'ArrowUp' || event.key === 'PageUp') next = Math.max(0, from - 1)
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = list.length - 1
  const targetScene = list[next]
  if (targetScene === undefined) return
  event.preventDefault()
  goTo(targetScene, true)
})

/* ------------------------------------------------------------------ *
 * `RF-04`: back/forward restauran la escena.
 * ------------------------------------------------------------------ */

window.addEventListener('popstate', () => {
  const id = location.hash.replace('#', '')
  const scene = id !== '' ? document.getElementById(id) : null
  if (scene !== null) {
    scene.scrollIntoView({ block: 'start' })
    setActive(scene.id)
    activeId = scene.id
  }
})

/* ------------------------------------------------------------------ *
 * `RF-09`: toggle de tema persistente. El valor se aplica antes de pintar desde el script
 * inline de `Base.astro`; aqui solo se conmuta y se persiste.
 * ------------------------------------------------------------------ */

const themeToggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')

function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem('theme', theme)
  } catch {
    // Modo privado sin almacenamiento: el tema se aplica igual, solo no persiste.
  }
  if (themeToggle !== null) {
    const isLight = theme === 'light'
    themeToggle.setAttribute('aria-pressed', isLight ? 'true' : 'false')
    themeToggle.textContent = isLight ? 'Tema claro' : 'Tema oscuro'
  }
}

if (themeToggle !== null) {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  themeToggle.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light')
  })
}

/* ------------------------------------------------------------------ *
 * `RF-27`: revelado del email bajo interaccion. La direccion vive en el bundle del cliente
 * (`PUBLIC_CONTACT_EMAIL`), nunca en el HTML; el boton la monta y activa el `mailto:` al pulsar.
 * Decision y limites en `docs/adr/0005`.
 * ------------------------------------------------------------------ */

const contactButton = document.querySelector<HTMLButtonElement>('[data-contact-email]')

if (contactButton !== null) {
  contactButton.addEventListener('click', () => {
    const email = import.meta.env.PUBLIC_CONTACT_EMAIL
    const output = document.querySelector<HTMLElement>('[data-contact-email-output]')
    if (typeof email !== 'string' || email === '' || output === null) return
    const link = document.createElement('a')
    link.href = `mailto:${email}`
    link.textContent = email
    output.replaceChildren(link)
    output.hidden = false
    contactButton.setAttribute('aria-expanded', 'true')
    contactButton.hidden = true
  })
}

/* ------------------------------------------------------------------ *
 * `RF-11`: descarga en PDF. Antes de imprimir abre todos los `<details>` para que el PDF
 * lleve el contenido completo; los devuelve a su estado al terminar.
 * ------------------------------------------------------------------ */

const printButton = document.querySelector('[data-print]')
if (printButton !== null) {
  printButton.addEventListener('click', () => {
    window.print()
  })
}

window.addEventListener('beforeprint', () => {
  for (const details of document.querySelectorAll<HTMLDetailsElement>('details')) {
    if (!details.open) {
      details.dataset.printOpened = 'true'
      details.open = true
    }
  }
})

window.addEventListener('afterprint', () => {
  for (const details of document.querySelectorAll<HTMLDetailsElement>(
    'details[data-print-opened="true"]',
  )) {
    details.open = false
    delete details.dataset.printOpened
  }
})

/* ------------------------------------------------------------------ *
 * `RF-13`: cada detalle de proyecto tiene URL compartible (`#proyecto-<slug>`).
 * ------------------------------------------------------------------ */

/** Abre desde el hash el `<details>` destino y todos sus ancestros `<details>`. */
function openDetailFromHash(): void {
  const id = location.hash.replace('#', '')
  if (id === '') return
  const target = document.getElementById(id)
  if (target === null) return
  let node: HTMLElement | null = target
  let opened = false
  while (node !== null) {
    if (node instanceof HTMLDetailsElement && !node.open) {
      node.open = true
      opened = true
    }
    node = node.parentElement
  }
  if (opened) target.scrollIntoView({ block: 'center' })
}

openDetailFromHash()
window.addEventListener('hashchange', openDetailFromHash)

for (const details of document.querySelectorAll<HTMLDetailsElement>('details[id^="proyecto-"]')) {
  details.addEventListener('toggle', () => {
    if (details.open) history.replaceState(null, '', `#${details.id}`)
  })
}
