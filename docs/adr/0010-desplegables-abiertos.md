# ADR-0010 — Los desplegables van abiertos por defecto (cambia `RUI-31` y `RUI-52`)

> Estado: **Aceptada** · Sprint 7 · Cambia: `RUI-31`, `RUI-52`, `RUI-30..37` · Relaja: el gate
> `pnpm gate:saturation` · Sustituye el presupuesto que fijó el Sprint 4

## Contexto

Cada escena del CV tiene un `<details class="detail">` con el contenido que no cabía en el
presupuesto de la escena, y los proyectos son a su vez un `<details>` anidado (`RF-13`). Eran **8
desplegables, todos colapsados**, y lo-collapse estaba fijado en tres sitios a la vez:

- `RUI-31`: si una escena excede el presupuesto, el exceso va a un drawer **colapsado**.
- `RUI-52`: el gate `pnpm gate:saturation` mide el contenido **visible** de cada escena en
  Chromium y falla el build por encima del techo.
- Los presupuestos que ese gate aplicaba: **6 nodos y 280 caracteres** por escena.

El PO pidió que **todos los menús desplegables estén desplegados por defecto**. Es una decisión de
producto legítima —el contenido escondido es contenido que no se lee— y este ADR es su registro,
no su discusión.

## Lo que se midió antes de decidir

Nada se ajustó a ojo. Se aplicó el cambio en el markup y se ejecutó el gate, tres veces:

| Variante | `gate:saturation` | Escenas fuera de presupuesto |
|---|---|---|
| Colapsado (estado anterior) | ✅ verde | — |
| **Los 8 abiertos** | ❌ 8 fuera | Experiencia 24/841 · Proyectos 26/1064 · Stack 29/846 · Formación 10/301 |
| Solo los 7 de primer nivel | ❌ 6 fuera | las mismas 3: Experiencia, Stack, Formación |
| Solo los proyectos abiertos | ✅ verde | ninguna (escena-03 queda en 6 nodos / 129 car.) |

La tabla importa por una razón: **la variante intermedia no era una salida**. Abrir solo el primer
nivel deja los proyectos anidados cerrados y aun así revienta tres escenas, porque el exceso de
Experiencia, Stack y Formación es texto y barras, no desplegables anidados. O se abre todo, o el
presupuesto no se toca.

## Decisión

Los 8 `<details>` se renderizan con `open`. El gate `pnpm gate:saturation` sube sus techos al
**máximo medido, sin holgura**:

| | Antes | Ahora | Peor escena |
|---|---|---|---|
| Nodos visibles por escena | 6 | **29** | `escena-04` Stack |
| Caracteres visibles por escena | 280 | **1.064** | `escena-03` Proyectos |

Sin holgura a propósito: si el CV crece, el gate tiene que volver a morder. Si algún día se
cambia el contenido y una escena pasa de 29 nodos, se vuelve a medir y se vuelve a decidir; no se
sube el techo por comodidad.

## El efecto que este gate NO mide

`checkVisibility()` dice si un elemento es visible, **no** si cabe en la pantalla. Con el detalle
abierto, tres escenas dejan de caber en un viewport de 800 px:

| Escena | Antes | Ahora |
|---|---|---|
| `escena-02` Experiencia | 800 px | **1.394 px** |
| `escena-03` Proyectos | 800 px | **1.099 px** |
| `escena-04` Stack | 800 px | **1.084 px** |

`.scene` usa `min-block-size: var(--scene-height)` (`100svh`), no `block-size`, así que **no hay
contenido cortado**: la escena crece, el contenido queda centrado y el visitante hace scroll dentro
de ella. Verificado: `scrollHeight === clientHeight` en las 7 escenas, 0 px de desborde interno.

Lo que se pierde es la premisa de «una escena = una pantalla» en 3 de las 7 escenas. Eso es
precisamente lo que el PO ha pedido, y queda dicho aquí para que no se descubra en una revisión.
Registrado como `TD-13`.

## Consecuencias

- **`RUI-31` se reescribe**: el exceso va a un desplegable, pero **abierto**. La divulgación
  progresiva deja de ser el mecanismo y pasa a ser una decisión de maquetación; el requisito que
  protege sigue siendo el techo por escena, no el colapso.
- **`RUI-52` y `MEDICION.md` §4.3** suben los umbrales a 29 nodos / 1.064 car. Los umbrales
  siguen siendo automáticos, no subjetivos: eso es lo que `RUI-52` promete y no se toca.
- `pnpm gate:keyboard` sigue en **100 %** (`RF-02..06`, `RF-09`, `RF-13`, `RF-27`), pero **hubo que
  arreglar dos comprobaciones** que daban por supuesto un `<details>` colapsado, y una de ellas
  había quedado en verde por vacuidad:
  - `RF-27` pulsaba el `<summary>` de la escena de contacto para llegar al botón de email. Con el
    desplegable ya abierto, ese clic lo **cerraba** y el botón quedaba invisible. Ahora solo pulsa
    si de verdad está cerrado.
  - `RF-13` comprobaba que el deep-link abre el detalle, pero como todos nacen abiertos la
    comprobación era verde aunque `openDetailFromHash()` no hiciera nada. Ahora cierra el detalle
    antes de llegar por el hash, y se verificó **en negativo**: con `node.open = true` sustituido
    por `false`, el gate falla con `RF-13 — #proyecto-… no abre el detalle`.

  Moraleja para el siguiente: abrir un desplegable por defecto no solo cambia lo que se ve, cambia
  lo que significan los clics en los tests, y hace verdes las comprobaciones que dependían del
  estado colapsado.
- Los 8 `<details>` nativos conservan foco, teclado y legibilidad sin JS (`RNF-101`). Abrirlos no
  cambia ese contrato, solo el estado inicial.

## Procedencia

Este cambio entró **a mitad del Sprint 7**, y `AGENTS.md` §1 dice que un requisito nuevo en mitad
de sprint no entra. La regla se incumple de forma consciente y por decisión del PO, que es quien
puede tomar esa excepción. Aun así se sube `SPEC.md` a **0.2**: el bloque cambia el texto de
`RUI-30`, `RUI-31` y `RUI-52`, y un cambio de requisitos sin bumping deja la versión mintiendo.
Queda registrado aquí y en `STATUS.md` para que el siguiente sprint sepa que este bloque entró a
mitad de sprint por decisión del PO.

Lo que **no** se hizo, y sigue pendiente: decidir si el alto de escena necesita su propio umbral en
el gate (`TD-13`). Añadirlo aquí habría sido meter un requisito nuevo dentro de la excepción que ya
se está usando.
