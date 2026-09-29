/**
 * Animaciones — un unico sitio para anime.js.
 *
 * Existe para que las dos reglas que no se negocian se cumplan una vez y no en cada llamada:
 *
 * 1. **`prefers-reduced-motion`** (`RUI-74`, `RUI-95`). El reset global neutraliza las
 *    transiciones y animaciones **CSS**, pero anime.js escribe estilos inline desde JS y no pasa
 *    por ahi. Sin este guard, quien pide movimiento reducido veria moverse igual la burbuja y el
 *    panel. Se comprueba en cada animacion y no una vez al cargar, porque el usuario puede
 *    cambiar la preferencia con la pagina abierta.
 * 2. **Duraciones** (`RUI-70`): el set es cerrado, `{120, 240, 480, 720}` ms, los mismos valores
 *    que declaran `--dur-fast`, `--dur-base` y `--dur-slow`. Se repiten aqui como constante
 *    porque son numeros de JS, no CSS; es una copia declarada, no un literal perdido.
 */

import { animate, type AnimationParams } from 'animejs'

export const DUR = { fast: 120, base: 240, slow: 480 } as const

/** `true` si la persona pidio movimiento reducido. Se consulta en cada animacion, no al cargar. */
export function quieto(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Anima `target` y resuelve al terminar. Con movimiento reducido no toca nada y resuelve ya.
 *
 * El `setTimeout` de guarda no es paranoia: si anime.js nunca emite `onComplete` (target
 * desmontado a mitad, pestana en segundo plano), el que espera esta promesa —el cierre del
 * dialogo— se quedaria colgado y el panel no se cerraria. Terminar de mas es mejor que no
 * terminar.
 */
export function animar(target: Element, params: AnimationParams, duration: number): Promise<void> {
  if (quieto()) return Promise.resolve()
  return new Promise((resolve) => {
    let hecho = false
    const fin = (): void => {
      if (hecho) return
      hecho = true
      resolve()
    }
    animate(target, { ...params, duration, ease: 'outQuad', onComplete: fin })
    window.setTimeout(fin, duration + 80)
  })
}

/** Borra los estilos que deja anime.js. Necesario para que abrir sin animar no herede opacidad 0. */
export function limpiar(target: HTMLElement, propiedades: readonly string[]): void {
  for (const propiedad of propiedades) target.style.removeProperty(propiedad)
}
