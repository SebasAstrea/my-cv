# Estado del proyecto — fuente única de progreso

> **Lee esto primero.** Este fichero es lo que un agente (o una persona) mira para saber
> qué está hecho, qué no, y qué tiene que hacer ahora.
>
> - **Cómo** se trabaja aquí: `SCRUM.md` (ritmo, DoD) y `AGENTS.md` (reglas de código).
> - **Qué** se exige: `SPEC.md`. **Cómo se mide:** `MEDICION.md`. **Cobertura:** `TRACEABILITY.md`.
> - **Detalle por requisito y gates:** `BACKLOG.md`. **Decisiones:** `docs/adr/`.
>
> Este fichero **no se mantiene a mano sin red de seguridad**: `scripts/status.mjs` verifica
> que cada comando y cada fichero que se nombran aquí existen de verdad, y `pnpm status` es el
> primer paso de `pnpm gate`. Si la tabla miente, el build falla. Es la misma idea que
> `SCRUM.md` §5.1: *un requisito marcado «hecho» sin evidencia no cuenta*.

---

## 1. Ahora mismo

| | |
|---|---|
| **Sprint activo** | **4 — Divulgación progresiva y presupuesto** (en curso) |
| **Último sprint aceptado** | **3 — Navegación, teclado y tema** (`ACCEPTED`, commit `35beb5a`) |
| **Gate** | `pnpm gate` — 12 pasos, exit 0 |
| **Bloqueo** | Ninguno conocido |
| **Deuda registrada** | 11 ítems (`TD-01`..`TD-11` en `BACKLOG.md`) |
| **Riesgos abiertos** | 8 aceptados (`RK-01`..`RK-08` en `TRACEABILITY.md` §12) |
| **Medición de calidad** | Sprint 1 medido y publicado en `docs/reportes-calidad/1-fundacion-y-toolchain/REPORTE.md`. T4/T5, sin datos de campo. 4 de 7 escenas incumplen el presupuesto §4.3 (`TD-11`) y hay 1 crítica de seguridad abierta (`TD-06`) |

**Siguiente acción concreta:** el núcleo del Sprint 4 (presupuesto de saturación y divulgación
progresiva) está implementado y su gate `pnpm gate:saturation` pasa en las 7 escenas. Faltan dos
piezas con decisión pendiente: el **revelado de email** (`RF-26/27`, choca con la regla 6 de
`AGENTS.md` y exige ADR) y la **descarga en PDF** (`RF-11`, requiere elegir generación).

```bash
pnpm gate:saturation   # RUI-30..37: <= 6 nodos y <= 280 caracteres visibles por escena
pnpm gate:keyboard     # navegación, teclado y deep-link del detalle (RF-13)
```

---

## 2. Progreso por sprint

`WIP` = en curso · `TODO` = sin empezar · `DONE` = gate en verde y DoD completo.

| # | Goal | Estado | Gate principal | Requisitos núcleo |
|---|---|---|---|---|
| 0 | Especificar | `DONE` | Revisión de los 240 requisitos | — |
| 1 | Fundación y toolchain | `DONE` | `pnpm gate` | `RNF-80`, `RNF-87`, `RF-20`, `RND-03`, `RUI-01..24`, `RUI-70..74` |
| 2 | Fuente de verdad y render SSR | `DONE` | Parseo ATS + `RF-25` | `DEC-03`, `RF-01`, `RF-23`, `RF-25`, `RNF-33`, `RNF-100` |
| 3 | Navegación, teclado y tema | `DONE` | `gate:keyboard` — teclado 100 % | `RF-02..06`, `RF-09`, `RUI-81` |
| 4 | Divulgación progresiva y presupuesto | `WIP` | `gate:saturation` — `RUI-52` | `RUI-30..37`, `RUI-52`, `RF-13`, `RF-26/27`, `RF-10`, `RF-11` |
| 5 | Sistema de vídeo | `TODO` | 1 `<video>` DOM + `RF-41` | `DEC-02`, `RF-40..45`, `RNF-55`, `RUI-96` |
| 6 | Chat G1–G4 (guardrails) | `TODO` | 100 % cobertura guardrails | `CHA-01..07`, `CHA-20..22`, `SEG-11`, `SEG-25` |
| 7 | Chat G5–G6 + eval set | `TODO` | `CHA-30` ≤ 1 % | `DEC-01.b/f`, `RF-50..58`, `RNF-68/69`, `CHA-30..39` |
| 8 | Rendimiento | `TODO` | Todos los budgets §4.2 | `RNF-01..23`, `RNF-85`, `MEDICION.md` §4.5 |
| 9 | Seguridad | `TODO` | 0 hallazgos §4.7 | `SEG-01..06`, `SEG-20..25`, `SEG-30..35`, `RNF-61..71` |
| 10 | Accesibilidad y calidad en uso | `TODO` | 0 serious/critical | `RUI-80..88`, `RUI-33`, `RNF-84` |
| 11 | PWA, i18n, portabilidad | `TODO` | Matriz de navegadores | `RNF-30..35`, `RF-12` |
| 12 | Hardening y release v1 | `TODO` | Smoke post-deploy + SLO | `RNF-50..58`, `SEG-43/44`, `RND-01..08`, `G6` |

### 2.1 Sprint 4 — desglose de trabajo

- [x] Presupuesto de saturación: ≤ 6 nodos y ≤ 280 caracteres visibles por escena (`RUI-30`)
- [x] Divulgación progresiva con `<details>` nativo (legible sin JS, accesible) (`RUI-31`)
- [x] `RF-13`: detalle por proyecto colapsado con URL compartible (`#proyecto-<slug>`)
- [x] Gate `RUI-52` (`pnpm gate:saturation`) + CI
- [ ] Revelado de email (`RF-26/27`) — **decisión pendiente**: choca con la regla 6 de `AGENTS.md`
      («la PII no se ofusca, se elimina»); requiere ADR antes de implementarlo
- [ ] Descarga en PDF (`RF-11`) — decidir generación (build con Playwright vs `window.print()`)

**Cierre del Sprint 3:** navegación, teclado, deep-link y tema, con `gate:keyboard` al 100 %.

---

## 3. Gates

Cada fila debe corresponded con un script real de `package.json` y con un fichero real en
`scripts/`. `pnpm status` lo comprueba.

| Gate | Comando | Qué protege | Bloquea |
|---|---|---|---|
| `status` | `pnpm status` | La veracidad de este documento | Sí |
| `format:check` | `pnpm format:check` | Consistencia de formato del código (`docs/` exento a propósito) | Sí |
| `typecheck` | `pnpm typecheck` | `RNF-80` — `strict`, `noUncheckedIndexedAccess`, 0 `any` | Sí |
| `lint` | `pnpm lint` | `RNF-80`, `ADR-0002` — ESLint + Stylelint | Sí |
| `test` | `pnpm test` | Pruebas unitarias (`node:test`) sobre fechas y documento | Sí |
| `check:cv` | `pnpm check:cv` | `RF-20`, `RND-03` — schema Zod y reglas cruzadas | Sí |
| `gate:tokens` | `pnpm gate:tokens` | `RNF-87`, `RUI-70`, `RUI-24` — 0 literales fuera de tokens | Sí |
| `build` | `pnpm build` | Genera `dist/`. Sin él, los tres gates siguientes no tienen nada que medir | Sí |
| `gate:ats` | `pnpm gate:ats` | `RNF-33`, `RNF-100`, `RND-08` — HTML semántico + JSON-LD `Person`/`Occupation` y los 4 exportadores en `dist/` | Sí |
| `gate:placeholders` | `pnpm gate:placeholders` | `RF-25` — marcadores de fixture | En despliegue |
| `gate:budgets` | `pnpm gate:budgets` | `RNF-07..12` — budgets sobre `dist/` real | Sí |
| `gate:artifacts` | `pnpm gate:artifacts` | `SEG-31`, `SEG-32` — ningún campo `private` en cliente | Sí |

**Comando único:** `pnpm gate` = `status` → `format:check` → `typecheck` → `lint` → `test`
→ `check:cv` → `gate:tokens` → `build` → `gate:ats` → `gate:placeholders` → `gate:budgets`
→ `gate:artifacts`.
Equivale a `pnpm verify`.

**Fuera de `pnpm gate` (gates de sprint):** `pnpm gate:keyboard` (`RF-02..06`, `RF-09`, `RF-13`,
navegación y teclado) y `pnpm gate:saturation` (`RUI-30..37`, `RUI-52`, presupuesto de escena).
Corren en el job `keyboard` de CI porque necesitan Chromium; no entran en el gate rápido de PR.

### 3.1 Gates probados en negativo

Un gate que solo se ha visto pasar no está verificado. Estos tienen su prueba de fallo:

| Gate | Cómo se rompe a propósito | Resultado esperado |
|---|---|---|
| `gate:artifacts` | `toPublicCv` deja pasar `contact` | exit 1, nombra `contact.email` y `contact.location` |
| `gate:artifacts` | Email inyectado en `dist/index.html` | exit 1, `dist/index.html contiene contact.email` |
| `astro build` | `VERCEL=1 CV_DATA_SOURCE=fixture` | exit 1, mensaje `[ADR-0003]` |
| `astro build` | `VERCEL=1 CV_DATA_SOURCE=real` sin `cv.real.ts` | exit 1, indica el fichero y cómo crearlo |
| `deploy-contract` (CI) | Automático en cada push | Verifica los dos anteriores |

**Los cuatro se ejecutan también en CI** (`.github/workflows/ci.yml`, job `deploy-contract`).

---

## 4. Hecho por el Sprint 1

Implementado y verificado. El detalle requisito por requisito, con comando y número, está en
`TRACEABILITY.md` §12 bis. No se repite aquí para que no haya dos copias que se separen.

- Toolchain: TypeScript estricto, ESLint con set type-aware, Stylelint con patrón BEM, Prettier.
- Datos: schema Zod completo con `.strict()`, validación cruzada, `PublicCvDocument`.
- Shell: tokens OKLCH, reset, grid 7/5–5/7, 7 escenas, storyboard generado (58 s).
- Gates: los 8 de la tabla anterior, más la prueba en negativo de los de seguridad.
- Documentación: `SCRUM.md`, `BACKLOG.md`, 4 ADRs, CI con 2 jobs.
- Build estático: `dist/index.html` 9.3 KB, CSS 2.6 KB, **0 KB de JS** en ruta crítica.

### 4.1 No verificado a propósito

Que no esté aquí como «cumplido» aunque parezca cerca:

| Qué | Por qué no cuenta | Dónde se cierra |
|---|---|---|
| `RUI-01..24` diseño | Verificado estructuralmente (markup, grid, jerarquía), no por revisión con persona. El punto 4 del DoD por requisito sigue abierto | Sprint 10 |
| `RUI-70..74` completo | Solo la parte de `reset.css`; falta la de teclado y foco en componentes | Sprint 3 |
| Tests unitarios | No hay lógica con ramas aún; los gates cubren el resultado observable. `TD-01` | Sprint 2 o 3 |
| `pnpm lint` en `.astro` | `astro check` lo valida con el compilador real. `TD-04` | Cuando haya plugin |
| `pnpm typecheck` en `scripts/` | Sin reglas type-aware, pero `tsc --noEmit` sí los compila. `TD-03` | Cuando un gate tenga lógica de dominio |
| Formato de `docs/` | Fuera de Prettier a propósito: realinearía tablas enteras. `TD-05` | — |

---

## 5. Decisiones vigentes

| ADR | Decisión | Estado |
|---|---|---|
| [`0001`](./adr/0001-astro-como-framework.md) | Astro 5, `output: 'static'`, sin framework de UI | Aceptada |
| [`0002`](./adr/0002-css-nativo-sobre-tailwind.md) | CSS nativo con tokens; sin Tailwind | Aceptada |
| [`0003`](./adr/0003-fixture-de-datos.md) | Fixture en dev, `real` obligatorio en despliegue; `cv.real.ts` gitignored | Aceptada |
| [`0004`](./adr/0004-abr-01-api-gestionada.md) | `ABR-01` cerrado: solo API gestionada. WebGPU se aplaza tras `ModelProvider` | Aceptada |

**Cerrada:** `ABR-01` (ver `SPEC.md` §9.2). **Sin abrir pendientes.**

---

## 6. Cómo contribuya un agente

1. Lee este fichero, luego `AGENTS.md`.
2. `pnpm status` — si falla, el repo está inconsistente con lo que dice aquí. Arréglalo antes de tocar código.
3. Trabaja **un sprint a la vez**. `SCRUM.md` §6: un requisito nuevo a mitad de sprint no entra.
4. Cada cambio que toques un requisito necesita: código + gate + fila en `TRACEABILITY.md` §12 bis + ADR si toca `SPEC.md` §2.
5. `pnpm gate` en verde antes de commitear.
6. Actualiza §1 y §2 de este fichero en el mismo commit. Si no, el siguiente agente trabaja con información obsoleta.
