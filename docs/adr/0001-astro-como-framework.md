# ADR-0001 — Astro como framework de render

**Estado** Aceptada · **Fecha** Sprint 1 · **Sprint** 1 · **Requisito motivator** `RNF-33`, `RF-07`, `RNF-08`

## Contexto

`SPEC.md` exige, de forma simultánea y no negociable:

- `SUP-05` / `RNF-33`: el CV debe ser HTML semántico **renderizado en servidor**, parseable por ATS.
- `RF-07`: el CV completo se lee en orden **con JavaScript deshabilitado**.
- `RNF-08`: JS en ruta crítica ≤ 110 KB gzip, y **≤ 45 KB por encima del fold**.
- `RNF-09`: CSS total ≤ 24 KB gzip.
- `RNF-100`: 5 exportadores (JSON, JSON-LD, Markdown, PDF, texto plano) desde un único origen.
- `SUP-02`: despliegue en Vercel (Node/Edge, sin GPU).

Estos requisitos empujan en una dirección muy concreta: **cero o casi cero JS en la ruta
crítica, y generación de HTML en build/SSR**. Un SPA con hidratación completa no puede cumplir
`RNF-08` sin disciplina manual constante.

## Opciones consideradas

| Opción | Cumplimiento | Coste |
|---|---|---|
| **Astro 5** (SSG + islas) | HTML estático por defecto; JS solo en islas. `RNF-08` ronda 0 KB en ruta crítica. Genera JSON/MD/TXT triviales. Deploy nativo en Vercel. | Ecosistema de islas: cada interacción dinámica es un `client:*` que hay que justificar contra el budget. |
| Next.js App Router | SSR real, streaming, RSC. Nativo en Vercel. | React + runtime de hidratación ≈ 90–130 KB gzip de ruta crítica. Viola `RNF-08` salvo con trabajo heroico. `RNF-100` queda supeditado al modelo de caché de RSC. |
| Vite + HTML/JS a pelo | Control absoluto de bytes. Mínimo riesgo de performance. | Hay que reimplementar a mano generación de 7 escenas, i18n, exportadores, y el HTML dinámico. Coste alto, reimplementación de lo que Astro ya da. |
| SvelteKit | SSR + islands, runtime muy ligero. | Menos ecosistema y menos familiaridad en este repo. Sin ventaja medible frente a Astro para un sitio de una página. |

## Decisión

**Astro 5** con `output: 'static'` y prerendering completo. Las interacciones que sí necesitan
JS (navegación por teclado, tema, vídeo, chat) se implementan como islas **o como scripts
vanilla** de pocos KB, no como componentes hidratados de framework.

## Consecuencias

**A favor:**
- `RNF-08` y `RF-07` se cumplen por construcción, no por disciplina. El presupuesto de JS deja
  de ser una batalla continua.
- `DEC-03` (fuente única de verdad) se apoya de forma natural en el build: los exportadores son
  funciones puras que importan el mismo módulo que las páginas.
- Sin vendor lock-in de la capa de contenido (`RNF-102`): Astro es compilador, no servicio.
- Familiaridad: ya hay un proyecto Astro en el entorno (`frontend-style-lab/astro`).

**En contra / deuda aceptada:**
- Cada isla es un coste de JS. La política del proyecto será: **antes de añadir una isla,
  demostrar que no se puede con `<script type="module">` vanilla o con CSS**. La regla va en
  `CONTRIBUTING`/`AGENTS.md` del repo.
- Astro no da CSP con nonce de serie: se resuelve en el Sprint 9 (`SEG-02`) con `hash` en vez de
  `nonce`, que es más adecuado para un sitio estático.
- El streaming de tokens del chat (`RF-55`) no se benefician de streaming de HTML: será una isla
  dedicada en el Sprint 7.

**Impacto en budgets:** ninguna relaxing. El budget de JS del Sprint 1 se fija en **0 KB en
ruta crítica** (todo el HTML es estático) y las islas se contabilizan aparte contra `RNF-08`.
