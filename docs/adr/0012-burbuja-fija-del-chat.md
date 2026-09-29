# ADR-0012 — El chat es una burbuja fija, no un botón al final de la página

> Estado: **Aceptada** · Sprint 7 · Cambia: `RF-51` (dónde vive el teaser) · Excepción acotada a
> `RUI-24` y `RUI-36`

## Contexto

El panel de consulta se entró primero como un botón dentro de la escena 06 (Contacto), junto a
«Descargar PDF». El problema es de uso, no de código: **la escena 06 es la última**. Quien no
baja hasta el final no descubre que el CV se puede preguntar, y quien está leyendo la experiencia
o el stack —que es donde surgen las preguntas— no tiene el chat a mano. La función existía y era
invisible.

Decisión del PO: convertirla en una **burbuja flotante que acompaña el scroll**.

## Decisión

La burbuja vive en el slot `overlay` de `Base.astro`, **fuera de las escenas**, con
`position: fixed` en la esquina inferior derecha. Es chrome del sitio, como los controles de vídeo
o el conmutador de tema, no contenido de una escena. Sigue siendo un `<dialog>` nativo el que se
abre al pulsarla.

Dos consecuencias que no se pueden tapar:

### `RUI-36` — «un solo elemento focal por escena»

Una burbuja fija añade **un botón a todos los viewports**, no a uno. La acción primaria de una
escena deja de ser «la única cosa con peso de botón en el viewport» que pedía el requisito. Se
mitiga, no se elimina:

- la burbuja usa `--surface-2` y borde, **no** el acento (`RUI-01`). El acento es de la acción
  primaria; la burbuja solo lo enciende en `:hover`/`:focus-visible`;
- queda fuera de `<main>`, así que no compite en el flujo de lectura ni en el presupuesto de
  saturación por escena (`RUI-52`): `escena-06` vuelve a 5 nodos / 54 car.

Que la interacción sea un `<dialog>` modal ayuda: mientras se pregunta, el resto de la página no
es interactuable, así que no hay dos focos simultáneos.

**Es un intercambio consciente**: se gana descubribilidad y se pierde pureza de «una escena, una
acción». El PO lo prefiere así.

### `RUI-24` — techo de radio en 4 px

Una burbuja tiene que ser redonda, y `RUI-24` prohíbe radios fuera de `{0, 2px, 4px}`. En vez de
meter el literal en `global.css`, se declara **un** token nuevo, `--radius-pill`, en `tokens.css`.
El gate permite `var(--radius-*)`, así que la excepción queda en el único sitio donde las
excepciones de diseño pueden vivir, y sigue habiendo que justificarla: era un token, no un
`border-radius: 50%` suelto por ahí.

## Consecuencias

- El teaser de `RF-51` pasa de texto a icono con `aria-label`. Sigue siendo opt-in (la primera
  pregunta exige un clic) y sigue siendo discreto, que es lo que pide el requisito.
- `gate:chat-ui` gana una comprobación: la burbuja tiene que estar **dentro del viewport en la
  parte de arriba de la página y después de bajar al fondo**. Sin ella, volver a mover el chat
  dentro de una escena pasaría desapercibido hasta que alguien lo notara a mano. Probado en
  negativo: con `position: static`, falla con `arriba=false`.
- Al imprimir (`RF-11`) la burbuja se oculta, como el rail y los controles de vídeo.

## Lo que no cambia

El panel sigue siendo `RF-50` (cajón lateral en ≥1200 px, hoja en móvil, `Esc` lo cierra), la
privacidad sigue declarada antes de la primera pregunta (`RF-57`) y la degradación sigue ofreciendo
contacto (`RF-54`). Lo único que cambia es **dónde está la puerta**.
