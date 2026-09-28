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
| 2 | Fuente de verdad y render SSR | `DEC-03`, `RF-01`, `RF-23`, `RF-25`, `RNF-33`, `RNF-100` | Parseo ATS + `RF-25` | `DONE` |
| 3 | Navegación, teclado y tema | `RF-02..06`, `RF-09`, `RUI-81` | `gate:keyboard` — teclado 100 % | `DONE` |
| 4 | Divulgación progresiva y presupuesto | `RUI-30..37`, `RUI-52`, `RF-13`, `RF-26/27`, `RF-10`, `RF-11` | `gate:saturation` — `RUI-52` | `DONE` |
| 5 | Sistema de vídeo | `DEC-02`, `RF-40..45`, `RNF-55`, `RUI-96` | 1 `<video>` DOM + `RF-41` | `WIP` |
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
| `TD-01` | **CERRADA (Sprint 2):** tests unitarios de la lógica de presentación en `tests/exporters.test.ts` (37 tests en `pnpm test`). | El Sprint 1 no tenía lógica con ramas; la deuda se cierra al llegar la presentación exportable. | Cerrada en Sprint 2 | `RNF-80` |
| `TD-02` | `package.json` declara `packageManager: pnpm@10.4.1`; el entorno local tiene otra versión. | El lockfile fija la resolución de dependencias, que es lo que importa para reproducibilidad. Se alinea en el Sprint 2 con `corepack`. | Sprint 2 | — |
| `TD-03` | `scripts/*.mjs` se lintan sin reglas type-aware. | Son CLI de Node; sus errores de tipo los caza `tsc --noEmit` igualmente. Las reglas type-aware solo producían ruido sobre `JSON.parse`. |—when se escriba lógica de dominio en un gate | `RNF-80` (parcial) |
| `TD-04` | `.astro` queda fuera de ESLint. | `astro check` lo valida con el compilador real; el parser de TS solo vería el frontmatter y daría una imagen falsa del fichero. | Cuando haya plugin oficial de Astro para ESLint | — |
| `TD-05` | `docs/` queda fuera de Prettier. | `SPEC.md` y `MEDICION.md` están escritos a mano con prosa a ~100 columnas y tablas anchas; Prettier realinearía las tablas enteras y el diff sería ilegible sin mejorar nada. | Cuando exista un formateador que no reescriba tablas existentes | — |
| `TD-06` | **`astro@5.18.2` con 1 vulnerabilidad crítica (CVSS 9,8, RCE vía optimización AVIF) y 4 altas.** El fix exige Astro ≥ 7,2,8: dos versiones mayores. | Verificada **no explotable hoy**: 0 imágenes en `dist/`, sin `<Image>`, sin `astro:assets`, `slot=` literales, salida estática sin servidor. El riesgo se arma en cuanto entre el primer `<Image>`, que es el Sprint 5. No se migró porque hacerlo *después* de ver el número es el anti-patrón de `MEDICION.md` §9 y arriesgaría un baseline recién en verde. Detalle en el reporte de calidad §6. | Antes del Sprint 5 | `SEG-01..06` |
| `TD-07` | `MEDICION.md` §5 pide 3 cachés; el estado `warm` no es medible porque **no hay Service Worker** y sin SW la segunda visita es idéntica a la primera. | No se mide un `warm` inexistente: se declararía `cold` con otro nombre. `MEDICION.md` §5 define `warm` como «con Service Worker activo». | Cuando exista el SW, o se corrija §5 | `RNF-07` |
| `TD-08` | `MEDICION.md` §5 pide iPhone 12 (WebKit) y el estado no es medible: **WebKit no arranca** en este entorno (falta la librería de sistema `libicu74`). | Instalar una librería de sistema requiere `sudo`, fuera del alcance de un agente. Afecta también al contraste sobre vídeo de §4.4, que necesita Chromium+WebKit para cubrir iOS. | `sudo apt-get install libicu74` | `RNF-01`, `RUI-02` |
| `TD-09` | Lighthouse no está instalado, así que el gate de §4.2 «Performance ≥ 0,95 / ≥ 0,98» no se ejecuta. | La medición de este sprint usa `PerformanceObserver` directamente, que mide LCP/TBT/CLS reales pero **no** produce el score de Lighthouse. Es una métrica distinta, no un sustituto. | Sprint 2 | `RNF-01..04` |
| `TD-10` | `medir-diseno.py` requiere Python 3 con `pillow` y `numpy`, que no son dependencias de Node. | El muestreo de píxeles de §4.3 es array maths sobre imágenes; hacerlo en JS exigiría decodificar PNG a mano. Se documenta el prerrequisito en vez de instalar una dependencia nativa de Node que solo se usa al medir. | Cuando exista una razon para medir en CI | `RUI-01` |
| `TD-11` | El presupuesto de diseño §4.3 incumple en 4 de 7 escenas con contenido semilla (27 nodos y 757 caracteres contra límites de 6 y 280). | **No es una regresión**: es el shell sin revelado progresivo (`RUI-30`, Sprint 4) y texto de fixture. **No se relajó ningún umbral** para que pasara (§9). Como gate de PR bloquearía cambios legítimos sobre esas escenas mientras el contenido sea semilla. | Al llegar contenido real | `RUI-30`, `RUI-52` |

## Gates registrados en CI

| Gate | Comando | Qué protege | Bloquea |
|---|---|---|---|
| `check:cv` | `node --experimental-strip-types scripts/check-cv.mjs` | `RF-20`, `RND-03` | Sí |
| `gate:tokens` | `pnpm gate:tokens` | `RNF-87`, `RUI-70` | Sí |
| `gate:ats` | `pnpm gate:ats` | `RNF-33`, `RNF-100`, `RND-08` | Sí |
| `gate:security` | `pnpm gate:security` | `SEG-02/03/05`, `RNF-62/63` | Sí |
| `gate:keyboard` | `pnpm gate:keyboard` | `RF-02..06`, `RF-09`, `RF-13` (Playwright) | Sí (job `keyboard`) |
| `gate:saturation` | `pnpm gate:saturation` | `RUI-30..37`, `RUI-52` (Playwright) | Sí (job `keyboard`) |
| `gate:video` | `pnpm gate:video` | `DEC-02`, `RF-40..45`, `RUI-95/96` (Playwright) | Sí (job `keyboard`, se omite sin clips) |
| `gate:placeholders` | `pnpm gate:placeholders` | `RF-25` | En despliegue |
| `gate:budgets` | `pnpm gate:budgets` | `RNF-07..12` | Sí |
| `gate:artifacts` | `pnpm gate:artifacts` | `SEG-31`, `SEG-32` | Sí |

## Reportes de calidad por sprint

La medición vive en `docs/reportes-calidad/<sprint>/`. Un `REPORTE.md` y sus gráficas por
sprint, con los datos crudos en JSON al lado para que las cifras del informe no estén tecleadas
a mano.

| Sprint | Reporte | Cobertura | Estado |
|---|---|---|---|
| 1 — Fundación y toolchain | `1-fundacion-y-toolchain/REPORTE.md` | T4/T5 completo. Sin datos T1/T2: no hay tráfico. 4 de 7 escenas incumplen §4.3, y 1 crítica de seguridad abierta (`TD-06`) | `DONE` |

Reproducir: `pnpm medir`. Prerequisites: `playwright install chromium` (ya en el repo) y
Python 3 con `pillow` + `numpy` para el muestreo de píxeles (`TD-10`).

Estos scripts **no** forman parte de `pnpm gate`: la medición completa tarda minutos y necesita
navegador, mientras que `pnpm gate` es el gate rápido de PR. La medición se ejecuta a demanda
y en el reporte semanal de `MEDICION.md` §8.
