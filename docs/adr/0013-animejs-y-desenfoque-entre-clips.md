# ADR-0013 — anime.js para la burbuja y el panel; desenfoque CSS entre clips

> Estado: **Aceptada** · Sprint 7 · Añade dependencia: `animejs@4` · Toca: `RF-42`, `RF-51`

## Contexto

El PO pidió tres cosas: subir la burbuja del chat, animarla junto con el desplegable, y una
transición de desenfoque al cambiar de clip de vídeo. Las dos primeras piden una librería de
animación; la tercera no.

## Decisión 1 — anime.js, y solo para el chrome del chat

Se añade `animejs@4` y se usa **únicamente** para dos gestos: la entrada y el pulso de la burbuja,
y la apertura y el cierre del `<dialog>`.

Se centraliza en `src/lib/motion.ts` para que las dos reglas que no se negocian se cumplan una
vez y no en cada llamada:

- **`prefers-reduced-motion`** (`RUI-74`, `RUI-95`). El reset global de `reset.css` neutraliza
  las transiciones y animaciones **CSS** con `transition-duration: 0.01ms !important`, pero
  anime.js escribe estilos inline desde JS y no pasa por ahí. Sin un guard explícito, quien pide
  movimiento reducido vería moverse igual la burbuja y el panel. Se comprueba **en cada
  animación**, no al cargar, porque la preferencia se puede cambiar con la página abierta.
- **Duraciones** (`RUI-70`): el set es cerrado, `{120, 240, 480, 720}` ms. `motion.ts` declara
  `DUR.fast/base/slow` con los mismos valores que `--dur-fast/base/slow`. Es una copia
  declarada —son números de JS, no CSS— y no un literal perdido.

Además, `animar()` tiene un `setTimeout` de guarda: si anime.js nunca emite `onComplete` (pestaña
en segundo plano, target desmontado), la promesa del cierre se resolvería igual. Un panel que no
se cierra por una animación colgada es peor que un panel sin animación.

### Coste

El JS de cliente pasa de **10,6 KB a 40,8 KB** (bytes crudos, `RNF-08` permite 110 KB). anime.js
aporta ~30 KB crudos, unos 11 KB gzip. Está dentro del presupuesto, pero no es gratis, y por eso
se dice el número en vez de «apenas pesa».

## Decisión 2 — el desenfoque entre clips es CSS, no anime.js

`DEC-02.b` mantiene **un solo** `<video>` que recicla el `src`, así que cambiar de escena es un
corte seco. El PO pidió una transición de «unfocus» entre clip y clip.

Aquí **no** se usa anime.js a propósito. Es una transición de dos propiedades (`filter`,
`opacity`) sobre un elemento, con una clase que entra y sale desde `video.ts`. En CSS:

1. el reset global ya respeta `prefers-reduced-motion` para transiciones CSS, así que el guard no
   hay que reimplementarlo;
2. no mete la librería en el camino del vídeo, que es el que corre en cada cambio de escena;
3. una transición de dos valores no justifica traer un motor de animación.

Se activa en `desenfocarStage()` cuando el clip **cambia de verdad** (no en un cambio de modo
sobre la misma escena) y se desactiva al reproducir el nuevo. La clase dura `--dur-base` (240 ms).

## Un falso positivo que hubo que arreglar

Al entrar anime.js, `gate:placeholders` (`RF-25`) tumbó el build: buscaba `NaN` en **todos** los
artefactos, incluidos los bundles `.js`, y el código minificado de anime.js contiene `NaN`.

No es un marcador que el visitante pueda leer: es código. Se acotó el gate para que los
marcadores de **contenido** (`NaN`, `undefined`, `TODO`, `lorem`…) se busquen solo en artefactos
de contenido (`.html`, `.json`, `.css`, `.xml`, `.txt`, `.webmanifest`), no en `.js`. Las cadenas
del fixture (`FIXTURE_MARKERS`) sí se siguen buscando también en el código.

**Probado en negativo**: inyectando `<p>duracion: NaN meses</p>` en `dist/index.html`, el gate
vuelve a fallar con `[nan] "NaN"`. El caso real sigue cubierto; lo que se quitó es el falso
positivo, no la comprobación.

## Consecuencias

- `gate:chat-ui` gana una comprobación de movimiento reducido: con `prefers-reduced-motion`, el
  panel abre y cierra **sin** animación (si el guard de `motion.ts` fallara, `Esc` tardaría ~120 ms
  y el test lo delata). Y sus comprobaciones de `Esc` y de foco de cita ahora esperan al **estado
  final** en vez de leer el instante siguiente: con animación, leer el instante mide la animación,
  no el cierre.
- `gate:video` gana una comprobación de `RF-42`: un `MutationObserver` deja constancia de que la
  clase de desenfoque llegó a aplicarse al cambiar de clip. Dura 240 ms, así que leerla después no
  probaría nada. En negativo, sin `desenfocarStage()`, falla.
- anime.js queda como dependencia de producción. Si algún día se quiere quitar, `motion.ts` es el
  único fichero que la importa.
