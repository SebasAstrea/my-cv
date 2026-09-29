/**
 * Panel de consulta — `RF-51..58`.
 *
 * Reglas que no se negocian en este fichero:
 *
 * - **`textContent`, nunca `innerHTML`.** Lo que se pinta es salida de un modelo, aunque G4 la
 *   haya validado: la validacion comprueba citas, PII y longitud, no que el texto no lleve
 *   `<script>`. Un `innerHTML` aqui convertiria un guardrail en un XSS.
 * - **Los enlaces de las citas salen del mapa de anclas**, no del id que devuelve el modelo. Un
 *   id desconocido no se convierte en enlace; se queda como texto.
 * - **El historial vive en memoria.** `RF-56`: al recargar, sesion vacia. Nada de `localStorage`
 *   ni de `sessionStorage`.
 * - **Sin streaming** (`ADR-0011`): se espera a la respuesta completa y validada, y mientras
 *   tanto se muestra un indicador. No hay boton de parar porque parar no ahorraria la llamada.
 *
 * Modulo diferido, como `nav.ts` y `video.ts`: no bloquea la ruta critica (`RNF-08`) y sin el la
 * pagina se lee entera (`RF-07`).
 */

import { citationTarget } from '../lib/chat/anchors.ts'

/** Mismo tope que `chatRequest` en el servidor (`guardrails.ts`). */
const MAX_PREGUNTA = 300

interface Turno {
  readonly tipo: 'pregunta' | 'respuesta'
  readonly texto: string
  readonly citas: readonly string[]
  readonly degradada: boolean
}

/** Lo que devuelve `/api/chat`, comprobado a mano: por la red no entra nada de fiar (`RNF-80`). */
interface RespuestaApi {
  readonly ok: boolean
  readonly answer: string
  readonly citations: readonly string[]
  readonly degraded: boolean
}

function esRespuestaApi(value: unknown): value is RespuestaApi {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.ok === 'boolean' &&
    typeof r.answer === 'string' &&
    typeof r.degraded === 'boolean' &&
    Array.isArray(r.citations) &&
    r.citations.every((c) => typeof c === 'string')
  )
}

function nuevoIdSesion(): string {
  // No es una identidad ni un secreto: es la etiqueta de la ventana de cortesia del servidor.
  // Si el navegador no trae `randomUUID`, un contador aleatorio basta para separar pestanas.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `s-${String(Math.random()).slice(2)}`
}

/**
 * Devuelve el elemento o falla. Se usa un `throw` y no un `return` silencioso porque si el chat
 * esta en la pagina y le falta una pieza, eso es un error de programacion que hay que ver en
 * desarrollo, no un panel que se abre a medias. TypeScript, ademas, no conserva el
 * estrechamiento de nulos dentro de los closures, y asi el resto del modulo trabaja con tipos no
 * nulos sin `!` ni castings (`RNF-80`).
 */
function exigir<T extends Element>(nodo: T | null, pieza: string): T {
  if (nodo === null) throw new Error(`Falta la pieza del chat: ${pieza}`)
  return nodo
}

function iniciar(): void {
  const raiz = document.querySelector<HTMLElement>('[data-chat]')
  if (raiz === null) return

  const panel = exigir(raiz.querySelector<HTMLDialogElement>('[data-chat-panel]'), 'panel')
  const abrir = exigir(raiz.querySelector<HTMLButtonElement>('[data-chat-open]'), 'abrir')
  const cerrar = exigir(raiz.querySelector<HTMLButtonElement>('[data-chat-close]'), 'cerrar')
  const formulario = exigir(raiz.querySelector<HTMLFormElement>('[data-chat-form]'), 'formulario')
  const entrada = exigir(raiz.querySelector<HTMLInputElement>('[data-chat-input]'), 'entrada')
  const registro = exigir(raiz.querySelector<HTMLOListElement>('[data-chat-log]'), 'registro')
  const estado = exigir(raiz.querySelector<HTMLElement>('[data-chat-status]'), 'estado')
  const borrar = exigir(raiz.querySelector<HTMLButtonElement>('[data-chat-clear]'), 'borrar')
  const sugerencias = raiz.querySelectorAll<HTMLButtonElement>('[data-chat-suggestion]')

  const sesion = nuevoIdSesion()
  let enviando = false

  function abrirPanel(): void {
    if (!panel.open) panel.showModal()
    entrada.focus()
  }

  function pintarTurno(turno: Turno): void {
    const li = document.createElement('li')
    li.className = turno.tipo === 'pregunta' ? 'chat__turno chat__turno--pregunta' : 'chat__turno'

    const texto = document.createElement('p')
    texto.className = 'chat__texto'
    texto.textContent = turno.texto
    li.append(texto)

    if (turno.degradada) {
      const aviso = document.createElement('p')
      aviso.className = 'chat__aviso mono'
      aviso.textContent = 'Respondido desde el propio CV, sin modelo.'
      li.append(aviso)
    }

    // `RF-52`: 1–3 citas clicables. El servidor manda las que respaldan la respuesta; la interfaz
    // no inventa ninguna y no muestra mas de tres para no convertir la respuesta en una lista.
    const citas = turno.citas.slice(0, 3)
    if (citas.length > 0) {
      const lista = document.createElement('ul')
      lista.className = 'chat__citas'
      for (const id of citas) {
        const destino = citationTarget(id)
        const item = document.createElement('li')
        if (destino === undefined) {
          item.textContent = id
          lista.append(item)
          continue
        }
        const boton = document.createElement('button')
        boton.type = 'button'
        boton.className = 'chat__cita'
        boton.textContent = destino.label
        boton.addEventListener('click', () => {
          irACita(destino.sceneAnchor, destino.detailAnchor)
        })
        item.append(boton)
        lista.append(item)
      }
      li.append(lista)
    }

    registro.append(li)
    li.scrollIntoView({ block: 'nearest' })
  }

  function irACita(sceneAnchor: string, detailAnchor?: string): void {
    if (detailAnchor !== undefined) {
      const detalle = document.getElementById(detailAnchor)
      if (detalle instanceof HTMLDetailsElement) detalle.open = true
    }
    // `RF-01`/`RUI-82`: el foco cae en el heading (`#escena-0N-titulo`), no en la seccion, para
    // que un lector de pantalla anuncie de que escena se trata.
    const destino =
      document.getElementById(`${sceneAnchor}-titulo`) ?? document.getElementById(sceneAnchor)
    panel.close()
    if (destino instanceof HTMLElement) {
      destino.scrollIntoView({ block: 'center', behavior: 'smooth' })
      destino.focus({ preventScroll: true })
    }
  }

  function mostrarEstado(texto: string, visible: boolean): void {
    estado.textContent = texto
    estado.hidden = !visible
  }

  async function preguntar(pregunta: string): Promise<void> {
    if (enviando) return
    const limpia = pregunta.trim().slice(0, MAX_PREGUNTA)
    if (limpia === '') return

    enviando = true
    pintarTurno({ tipo: 'pregunta', texto: limpia, citas: [], degradada: false })
    mostrarEstado('Pensando…', true)

    try {
      const respuesta = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session': sesion },
        body: JSON.stringify({ question: limpia }),
      })

      const bruto: unknown = await respuesta.json().catch(() => null)

      if (respuesta.status === 404) {
        // `DEC-01.f`: el kill switch dejo la ruta fuera. No es un error del que haya que
        // disculparse: se dice y se ofrece el contacto, que ya esta en el formulario.
        mostrarEstado('El chat no está disponible. Usa el contacto de abajo.', true)
        return
      }
      if (!esRespuestaApi(bruto)) {
        mostrarEstado('No he podido leer la respuesta. Inténtalo de nuevo.', true)
        return
      }

      pintarTurno({
        tipo: 'respuesta',
        texto: bruto.answer,
        citas: bruto.citations,
        degradada: bruto.degraded,
      })
      // Un rechazo de G1/G4 llega como `ok: false` con texto fijo ya redactado para la persona:
      // se muestra igual, sin motivo tecnico, y el aviso de degradacion solo si aplica.
      mostrarEstado(bruto.ok ? '' : 'Puedes reformular la pregunta.', !bruto.ok)
    } catch {
      mostrarEstado('No hay conexión con el servicio. Inténtalo de nuevo.', true)
    } finally {
      enviando = false
      entrada.value = ''
    }
  }

  abrir.addEventListener('click', abrirPanel)
  cerrar.addEventListener('click', () => {
    panel.close()
  })

  formulario.addEventListener('submit', (event) => {
    event.preventDefault()
    void preguntar(entrada.value)
  })

  for (const sugerencia of sugerencias) {
    sugerencia.addEventListener('click', () => {
      entrada.value = sugerencia.textContent?.trim() ?? ''
      formulario.requestSubmit()
    })
  }

  borrar.addEventListener('click', () => {
    registro.replaceChildren()
    mostrarEstado('', false)
    entrada.focus()
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar, { once: true })
} else {
  iniciar()
}
