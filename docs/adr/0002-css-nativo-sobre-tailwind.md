# ADR-0002 — CSS nativo con tokens, sin Tailwind

**Estado** Aceptada · **Fecha** Sprint 1 · **Sprint** 1 · **Requisitos motivadores** `RNF-87`, `RNF-09`, `RUI-01..05`, `RUI-70..74`

## Contexto

La dirección de arte del proyecto es deliberadamente específica y tipada:

- Color en **OKLCH** con dos temas de primera clase y **un solo acento** (`RUI-01`, `ABR-04`).
- Radios 0 por defecto, máximo 4px; separación por **hairlines de 1px**, no por cards con sombra
  (`RUI-23`, `RUI-24`).
- Retícula de 12 columnas **asimétrica**, con proporciones alternas `7/5` y `5/7` por escena
  (`RUI-20`, `RUI-21`).
- Animación restringida a `transform` y `opacity`, con duraciones de un set tokenizado
  (`RUI-70..72`).
- **Cero valores literales** de color o de escala en componentes, verificado por lint (`RNF-87`).

El proyecto ya tiene Tailwind v4 en `frontend-style-lab`, así que la opción "usar lo que se
conoce" era real y había que evaluarla, no descartarla por reflejo.

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| **CSS nativo + custom properties** | Budget mínimo (RNF-09: 24 KB gzip, alcanzable sin fight). `RNF-87` verificable por `grep`/`stylelint`: si no hay `var(--…)` o token, no compila. Control total de la retícula asimétrica y del set de duraciones. | Hay que escribir el sistema a mano (escala modular, tokens, variante clara/oscura). Sin utilidades, más teclas. |
| Tailwind v4 con `@theme` | Sintaxis corta, `@theme` permite mapear tokens. Familiaridad. | `RNF-87` deja de ser trivial: hay que configurar cada color/escala como variable, y `text-[oklch(0.16_0.012_260)]` es exactamente el literal que la lint rule prohíbe. Los "arbitrary values" son un agujero de mantenimiento permanente. La retícula asimétrica alterna se expresa peor. El HTML se llena de clases. |
| CSS Modules | Scope por componente. | No resuelve tokens globales; añade un paso de build. `RNF-87` sigue necesitando tokens. |
| Vanilla-ext / unoCSS | Livianos, atoms on demand. | Madurez y tooling por debajo de Astro+CSS nativo para este caso. |

## Decisión

**CSS nativo con custom properties**, en tres capas:

1. `tokens.css` — **única fuente** de color, tipografía, espacio, radio, duración y easing
   (`RNF-87`). Sin condiciones de runtime.
2. `reset.css` — reset moderno y normalization.
3. `global.css` — elementos base, retícula, y los patrones compartidos (hairline, mono, chips).

Toda constante de diseño pasa por `var(--token)`. Una regla `stylelint` con
`declaration-property-value-allowed-list` **rechaza** cualquier literal de color o de duración
fuera de los tokens declarados en `tokens.css`.

**El tema claro/oscuro se resuelve con `:root` y `[data-theme]`, no con `class` en `<html>`**,
porque `RF-09` exige que la elección se respete **antes de la primera pintura** (sin flash) y un
atributo en `<html>` lo permite desde el HTML servido, sin esperar al JS.

## Consecuencias

**A favor:** `RNF-87` pasa a ser una propiedad mecánica del lint, no una convención. Budget de CSS holgado. La retícula y los tokens son auditables a ojo. Cero dependencia extra en el bundle.

**En contra / deuda aceptada:**
- Más teclas que utilidades. Se acepta: el sitio tiene 7 escenas, no 200 componentes.
- Los breakpoints (`RUI-90`) se escriben a mano. Se centralizan en `tokens.css` como custom
  properties `--bp-*` solo donde se puedan usar en `@media` (que no se puede en CSS puro): se
  documenta como límite conocido y se centralizan en un fichero `_breakpoints.css` con una
  comentario de "cambiar aquí".
- El `oklch()` en navegadores sin soporte (`RNF-31`): se provee fallback `hex` equivalente
  calculado una vez y anotado, no calculado en runtime.

**Impacto en budgets:** ninguno. El budget de CSS se mantiene en **≤ 24 KB gzip** (RNF-09).
