# Backlog — detalle verificable por sprint

**Documento asociado** [`SCRUM.md`](./SCRUM.md) (ceremonias y DoD) · [`SPEC.md`](./SPEC.md)
(qué se exige) · [`TRACEABILITY.md`](./TRACEABILITY.md) (cobertura ISO) ·
[`MEDICION.md`](./MEDICION.md) (protocolo) · [ADRs](./adr/)

> `SCRUM.md` dice **cuándo**. `BACKLOG.md` dice **cómo se comprueba**. Un requisito sin fila
> aquí no se puede cerrar: el punto 4 del DoD (`SCRUM.md` §5) no tiene forma de verificarse.

## Convenciones

| Columna | Significado |
|---|---|
| **Gate** | Comando que sale distinto de 0 si el requisito no se cumple. Sin comando, no hay gate. |
| **Estado** | `DONE` · `WIP` · `TODO` · `DEFERRED` (fuera de alcance v1, con motivo) |
| **Evidencia** | Dónde queda la prueba. `pnpm gate` ejecutada es evidencia de nivel 3 (`TRACEABILITY.md` §13). |

Los sprints 2–12 están **desglosados por requisito pero sin implementación**: el detalle de
tareas se escribe en la planificación de cada sprint (§8 de `SCRUM.md`), no antes. Un backlog
escrito con 11 sprints de anticipación es una Prediction, no un Backlog.

---

## Sprint 1 — Fundación y toolchain

**Goal:** repo que compila, valida el CV con Zod, sirve shell con tokens y 7 escenas vacías.
**Requisitos núcleo:** `RNF-80`, `RNF-87`, `RF-20`, `RND-03`, `RUI-01..24`, `RUI-70..74`.

| # | Requisito | Entregable | Gate | Estado | Evidencia |
|---|---|---|---|---|---|
| 1.1 | `RNF-80` | `tsconfig` estricto: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, 0 `any` | `pnpm typecheck` | `DONE` | `astro check` + `tsc --noEmit`, 0 errores |
| 1.2 | `RNF-80` | ESLint flat config con set type-aware en `src/**/*.ts`; `.astro` lo valida `astro check` | `pnpm lint` | `DONE` | `eslint . --max-warnings 0` |
| 1.3 | `ADR-0002` | Stylelint con patrón BEM y `custom-property-pattern` para tokens | `pnpm lint` | `DONE` | 0 problemas en `src/**/*.css` |
| 1.4 | `RF-20` | `src/data/schema.ts`: contrato Zod del CV completo, `.strict()` en cada objeto | `pnpm check:cv` | `DONE` | Fixture parsea; `.strict()` rechaza claves desconocidas |
| 1.5 | `RF-20` | `src/lib/cv/validate.ts`: reglas cruzadas (`RND-02`, `RND-03`, `RND-04`) y `toPublicCv` | `pnpm check:cv` | `DONE` | Fixture válido, 1 aviso `RND-02` (solape legítimo) |
| 1.6 | `SEG-31` | `PublicCvDocument` como tipo de salida: `contact.email` no compila en la UI | `pnpm gate:artifacts` | `DONE` | Comprobación estructural de claves |
| 1.7 | `SEG-32` | Gate de artefactos: ninguna clave `private` sobrevive, ningún valor `private` en `dist/` | `pnpm gate:artifacts` | `DONE` | Probado en ambas direcciones (fuga → exit 1) |
| 1.8 | `ADR-0003` | `src/lib/env.ts` + `src/data/index.ts` con selector `fixture`/`real`/`missing` | `pnpm build` | `DONE` | Build con fixture OK; despliegue sin `real` falla |
| 1.9 | `RNF-87` | `src/styles/tokens.css`: OKLCH, escala tipográfica, grid, motion, dark/light | `pnpm gate:tokens` | `DONE` | 7 ficheros, 71 tokens |
| 1.10 | `RUI-01..24` | `global.css` + componentes de las 7 escenas con grid 7/5–5/7 | `pnpm build` | `DONE` | 7 `<h2>` con `id` en `dist/index.html` |
| 1.11 | `RF-24` | `src/data/storyboard.ts`: timecodes generados, no escritos a mano | `pnpm build` | `DONE` | 7 escenas, 58 s de línea temporal |
| 1.12 | `RF-25` | Gate de placeholders de fixture | `pnpm gate:placeholders` | `DONE` | Bloqueante en despliegue, aviso en dev/PR |
| 1.13 | `RNF-07..12` | Gate de budgets sobre `dist/` real | `pnpm gate:budgets` | `DONE` | CSS 2.6/24 KB, JS 0/110 KB, 1ª carga 4.8/350 KB |
| 1.14 | `RNF-33` | `output: 'static'`: HTML generado en build, 0 KB de JS en ruta crítica | `pnpm gate:budgets` | `DONE` | `0.0 KB` de JS |
| 1.15 | — | `pnpm gate` encadena los 7 pasos y es el comando único de verificación | `pnpm gate` | `DONE` | exit 0 |
| 1.16 | `SCRUM.md` §5 | CI en GitHub Actions ejecutando `pnpm gate` en cada PR | `.github/workflows/ci.yml` | `DONE` | Workflow con 2 jobs (calidad, artefactos) |
| 1.17 | `SCRUM.md` §9 | Trazabilidad del Sprint 1 en `TRACEABILITY.md` §12 | Revisión | `DONE` | Tabla de verificación |

**Fuera del Sprint 1, declarado aquí para que conste:** `RUI-30..37` (divulgación progresiva),
`RUI-70..74` completos (los de `prefers-reduced-motion` y foco están en `reset.css`; el resto
llega con el teclado del Sprint 3), `RF-26/27` (email), `RF-40..45` (vídeo).

---

## Sprints 2–12

| Sprint | Goal | Requisitos núcleo | Gate principal | Estado |
|---|---|---|---|---|
| 2 | Fuente de verdad y render SSR | `DEC-03`, `RF-01`, `RF-23`, `RF-25`, `RNF-33`, `RNF-100` | Parseo ATS + `RF-25` | `TODO` |
| 3 | Navegación, teclado y tema | `RF-02..06`, `RF-09`, `RUI-81` | Teclado 100 % flujos | `TODO` |
| 4 | Divulgación progresiva y presupuesto | `RUI-30..37`, `RUI-52`, `RF-13`, `RF-26/27`, `RF-10`, `RF-11` | `RUI-52` Playwright | `TODO` |
| 5 | Sistema de vídeo | `DEC-02`, `RF-40..45`, `RNF-55`, `RUI-96` | 1 `<video>` DOM + `RF-41` | `TODO` |
| 6 | Chat G1–G4 (guardrails) | `CHA-01..07`, `CHA-20..22`, `SEG-11`, `SEG-25` | 100 % cobertura guardrails | `TODO` |
| 7 | Chat G5–G6 + eval set | `DEC-01.b/f`, `RF-50..58`, `RNF-68/69`, `CHA-30..39` | `CHA-30` ≤ 1 % | `TODO` |
| 8 | Rendimiento | `RNF-01..23`, `RNF-85`, `MEDICION.md` §4.5 | Todos los budgets §4.2 | `TODO` |
| 9 | Seguridad | `SEG-01..06`, `SEG-20..25`, `SEG-30..35`, `RNF-61..71` | 0 hallazgos §4.7 | `TODO` |
| 10 | Accesibilidad y calidad en uso | `RUI-80..88`, `RUI-33`, `RNF-84` | 0 serious/critical | `TODO` |
| 11 | PWA, i18n, portabilidad | `RNF-30..35`, `RF-12` | Matriz de navegadores | `TODO` |
| 12 | Hardening y release v1 | `RNF-50..58`, `SEG-43/44`, `RND-01..08`, `G6` | Smoke post-deploy + SLO | `TODO` |

---

## Deuda técnica y desviaciones registradas

`SCRUM.md` §5.1: un requisito "hecho" sin evidencia no cuenta. Aquí se registra lo que se
saboteó a sabiendas, con fecha de caducidad, para que no se pierda.

| ID | Qué | Por qué | Caduca | Requisitos afectados |
|---|---|---|---|---|
| `TD-01` | Sin tests unitarios. La verificación es por gates end-to-end sobre artefactos. | El Sprint 1 no tiene lógica con ramas sino validación; los gates cubren el resultado observable. Un test unitario de `validate.ts` sin gate que lo invoque es decorativo. | Sprint 2 (con la lógica de presentación) | `RNF-80` (parcial) |
| `TD-02` | `package.json` declara `packageManager: pnpm@10.4.1`; el entorno local tiene otra versión. | El lockfile fija la resolución de dependencias, que es lo que importa para reproducibilidad. Se alinea en el Sprint 2 con `corepack`. | Sprint 2 | — |
| `TD-03` | `scripts/*.mjs` se lintan sin reglas type-aware. | Son CLI de Node; sus errores de tipo los caza `tsc --noEmit` igualmente. Las reglas type-aware solo producían ruido sobre `JSON.parse`. |—when se escriba lógica de dominio en un gate | `RNF-80` (parcial) |
| `TD-04` | `.astro` queda fuera de ESLint. | `astro check` lo valida con el compilador real; el parser de TS solo vería el frontmatter y daría una imagen falsa del fichero. | Cuando haya plugin oficial de Astro para ESLint | — |

## Gates registrados en CI

| Gate | Comando | Qué protege | Bloquea |
|---|---|---|---|
| `check:cv` | `node --experimental-strip-types scripts/check-cv.mjs` | `RF-20`, `RND-03` | Sí |
| `gate:tokens` | `pnpm gate:tokens` | `RNF-87`, `RUI-70` | Sí |
| `gate:placeholders` | `pnpm gate:placeholders` | `RF-25` | En despliegue |
| `gate:budgets` | `pnpm gate:budgets` | `RNF-07..12` | Sí |
| `gate:artifacts` | `pnpm gate:artifacts` | `SEG-31`, `SEG-32` | Sí |
