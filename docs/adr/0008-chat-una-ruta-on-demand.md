# ADR-0008 — El chat añade una ruta on-demand a un sitio que sigue siendo estático

**Estado** Aceptada · **Fecha** Sprint 6 · **Sprint** 6
**Requisitos motivadores** `CHA-01..07`, `CHA-20..22`, `SEG-11`, `SEG-25`, `DEC-01.d`
**Modifica** [`ADR-0001`](./0001-astro-como-framework.md) de forma acotada · **Añade** adaptador de despliegue

## Contexto

`ADR-0001` decidió `output: 'static'` sin framework de UI, y de ahí se derivan tres cosas que el
proyecto ha sostenido durante seis sprints:

- el HTML se prerenderiza, y por tanto es parseable por ATS (`RNF-33`);
- el CV se lee entero sin JS (`RF-07`);
- la ruta crítica lleva **0 KB de JS** (`RNF-08`), y hoy son 2,5 KB contando navegación y vídeo.

El Sprint 6 necesita un endpoint de chat. Y hay una razón de seguridad, no de gusto, para que
ese endpoint **no pueda ser un fichero estático**: `DEC-01.d` exige que el system prompt sea un
artefacto **server-only**, porque un prompt servido al cliente se lee con `view-source` y con el
`fetch` del propio bundle. Un "chat" que compone el prompt en el navegador no tiene prompt
secreto, y sin prompt secreto `SEG-25` no es cierto.

El conflicto es real: servidor contra estático. Pero no son opciones excluyentes, porque
Astro permite prerenderizar todo y dejar **una** ruta como `on-demand`.

## Decisión

1. **El sitio sigue siendo estático por defecto.** No se cambia `output: 'static'` a `'server'`.
2. **Una única ruta on-demand:** `src/pages/api/chat.ts`, con `export const prerender = false`.
   Todo lo demás se prerenderiza igual que hasta ahora.
3. **Adaptador de despliegue:** `@astrojs/vercel`, en modo que la única función serverless sea la
   del chat. `vercel.json` **no cambia**: ya traía `buildCommand` con `CV_DATA_SOURCE=real`, y es el
   mismo build el de siempre. Lo que cambia es que el build deja además `.vercel/output/`, que es lo
   que Vercel consume (Build Output API).
4. **La lógica del chat no depende de Astro.** `src/pages/api/chat.ts` son 12 líneas de cableado y
   toda la decisión vive en `src/lib/chat/handler.ts`, que es una función `(Request) => Response`.
   No es separación por gusto: `getCv()` usa `import.meta.glob`, que no existe fuera de Vite, así
   que si la ruta y la lógica estuvieran juntas `gate:chat` no podría ejercitar el handler de
   producción sin Vite. La interfaz del chat (isla `client:idle`, `RF-51..58`) es del Sprint 7 y
   **no** forma parte de esta decisión.
5. **El prompt vive solo en el módulo de servidor.** `src/lib/chat/prompt.ts` no lo importa
   ningún componente de cliente, y el test de `SEG-25` falla si aparece la cadena en `dist/`.
6. **`connect-src 'self'` se mantiene.** El navegador solo habla con el origen propio; el egress
   al proveedor del modelo ocurre desde la función, no desde el cliente (`SEG-24`).

## Consecuencias

- **A favor:** el CV sigue siendo 0 KB de JS en ruta crítica y sigue siendo parseable por ATS. La
  función del chat duerme hasta que alguien pregunta, así que el coste en reposo es cero.
- **A favor:** `SEG-25` pasa a ser cierto por construcción, no por convención.
- **En contra:** se añade una dependencia (`@astrojs/vercel`) y una superficie de red que antes no
  existía. Se acepta: es el precio de tener el prompt en el servidor, y `SEG-24` acota el egress a
  un único host.
- **En contra y aceptado:** `pnpm build` deja de producir un `dist/` puramente estático cuando hay
  adapter. El HTML sigue prerenderizado, que es lo que importan `RNF-33` y `RF-07`; los
  exportadores (`/cv.json`, `/cv.md`, `/cv.txt`, `/cv.jsonld`) siguen siendo ficheros.
- **Resuelto de paso, no debt:** con el adaptador, Astro deja el sitio en `dist/client/` y no en
  `dist/`. Los once scripts que leían `join(ROOT, 'dist')` habrían medido un directorio sin
  `index.html` — y, según cómo estuvieran escritos, **habrían pasado sin medir nada**. Se resolvió
  con `scripts/lib/static.mjs`, que resuelve la ruta una vez y **lanza** si no encuentra el sitio.
  El riesgo de un gate que no comprueba nada es peor que el de un gate roto: parece verdad.
- **Hueco declarado, no verificado:** el despliegue real en Vercel con la función `/api/chat` **no se
  ha probado desde este entorno**. Lo verificado es local (`pnpm gate:chat` sobre el handler) y que
  el build produce la función. Que Vercel enrute `/api/chat` a la función y sirva el resto estático
  es una comprobación de humo pendiente del Sprint 12 (`SEG-44`), no una afirmación de este ADR.

## Alternativas descartadas

- **`output: 'server'` para todo el sitio:** destruye el prerenderizado, y con él `RNF-33` y
  `RF-07`. Descartado por coste de un beneficio que no hace falta.
- **Prompt en el cliente con ofuscación:** `SEG-25` deja de ser cierto; cualquiera lee el prompt.
  Descartado.
- **Servicio externo (vector DB + LLM gestionado) con el prompt propio del proveedor:** no permite
  aplicar `G4` (validación de salida) ni `CHA-04` (groundedness) sobre lo que devuelve el
  proveedor. Descartado porque el control del guardrail es el producto, no el modelo.
