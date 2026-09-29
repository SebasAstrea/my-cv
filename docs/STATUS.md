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
| **Sprint activo** | **7 — Chat G5–G6 + eval set** (en curso: `ABR-01` cerrado con Groq, falta UI y eval set) |
| **Último sprint aceptado** | **6 — Chat G1–G4 (guardrails)** |
| **Gate** | `pnpm gate` — 14 pasos, exit 0 |
| **Bloqueo** | Ninguno conocido |
| **Deuda registrada** | 13 ítems (`TD-01`..`TD-13` en `BACKLOG.md`) |
| **Riesgos abiertos** | 9 aceptados (`RK-01`..`RK-09` en `TRACEABILITY.md` §12) |
| **Medición de calidad** | Sprint 1 medido en `docs/reportes-calidad/1-fundacion-y-toolchain/REPORTE.md`; Sprint 8 (rendimiento) en `docs/reportes-calidad/8-rendimiento/`. T4/T5, sin datos de campo. `TD-06` (Astro) cerrada por `ADR-0005`; `TD-11` (presupuesto de diseño) sigue abierto |

**Siguiente acción concreta:** `ABR-01` ya está **cerrado** (`ADR-0009`): el modelo es
`openai/gpt-oss-120b` en Groq, con `reasoning_effort: 'low'`, sin reintentos, con la clave solo en
el servidor y con `off` como reserva. `pnpm gate:chat` sube a **40/40** y el gate completo sigue en
verde. Lo que falta del Sprint 7 es lo que no se puede escribir sin medir: la **UI** (`RF-51..58`) y
el **eval set** que da `CHA-30/32/33`. Aparte, y por decisión del PO a mitad de sprint, los desplegables de escena van **abiertos por defecto** (`ADR-0010`), lo que subió el presupuesto de saturación a 29 nodos / 1.064 car. y dejó 3 escenas más altas que una pantalla (`TD-13`). Antes de desplegar hay que **rotar `GROQ_API_KEY`**: la que se
usó para las pruebas se lordó en texto plano y no es una credencial válida para producción.

El Sprint 6 sigue cerrado y verificado: G1–G4 cortan antes y después del modelo, sin gastar un
token, y el corpus del chat es server-only.
El siguiente sprint es el **7 (G5–G6 + eval set)**, y su primer paso no es de código: es cerrar
`ABR-01`, el modelo concreto. Sin eso `CHA-30` (tasa de fuga ≤ 1 %), `CHA-32` (coste) y `CHA-33`
(latencia p95) no se pueden medir, porque necesitan llamadas reales.

Lo que queda del vídeo sigue igual: Sprint 5 cerrado (clips definitivos sin audio, ≤ 800 KB,
alineados a 5 s; `ADR-0007`) y solo pendiente la medición **emparejada** de `MEDICION.md` §4.5
(`RNF-13/14/15`, protocolo con n ≥ 30), que no es un `pnpm` suelto.

```bash
pnpm gate:chat         # CHA-01..07, CHA-20/22/31/34/36/37, SEG-11/20/25/31/35, ADR-0008
pnpm gate:video        # DEC-02 + RF-40..45 + RUI-95/96 + ADR-0007
pnpm medir:lab         # T4: LCP/TBT/CLS/TTFB con vídeo
```

**Trabajo adelantado (decisión del PO):** el Sprint 9 (seguridad) tiene cabeceras + CSP con
hash y auditoría; el Sprint 8 (rendimiento) ya trae **fuentes self-hosted** (3 woff2, 71,9 KB,
`RNF-10`/`RUI-17`) y la medición de lab dentro de presupuesto. Detalle en `TRACEABILITY.md` §12 sexies.

---

## 2. Progreso por sprint

`WIP` = en curso · `TODO` = sin empezar · `DONE` = gate en verde y DoD completo.

| # | Goal | Estado | Gate principal | Requisitos núcleo |
|---|---|---|---|---|
| 0 | Especificar | `DONE` | Revisión de los 240 requisitos | — |
| 1 | Fundación y toolchain | `DONE` | `pnpm gate` | `RNF-80`, `RNF-87`, `RF-20`, `RND-03`, `RUI-01..24`, `RUI-70..74` |
| 2 | Fuente de verdad y render SSR | `DONE` | Parseo ATS + `RF-25` | `DEC-03`, `RF-01`, `RF-23`, `RF-25`, `RNF-33`, `RNF-100` |
| 3 | Navegación, teclado y tema | `DONE` | `gate:keyboard` — teclado 100 % | `RF-02..06`, `RF-09`, `RUI-81` |
| 4 | Divulgación progresiva y presupuesto | `DONE` | `gate:saturation` — `RUI-52` | `RUI-30..37`, `RUI-52`, `RF-13`, `RF-26/27`, `RF-10`, `RF-11` |
| 5 | Sistema de vídeo | `DONE` | 1 `<video>` DOM + `RF-41` | `DEC-02`, `RF-40..45`, `RNF-55`, `RUI-96` |
| 6 | Chat G1–G4 (guardrails) | `DONE` | `pnpm gate:chat` — 31/31 al cierre del sprint (40/40 hoy) | `CHA-01..07`, `CHA-20..22`, `SEG-11`, `SEG-20/25/31/35` |
| 7 | Chat G5–G6 + eval set | `WIP` | `CHA-30` ≤ 1 % | `DEC-01.b/f`, `RF-50..58`, `RNF-68/69`, `CHA-30..39` |
| 8 | Rendimiento | `TODO` | Todos los budgets §4.2 | `RNF-01..23`, `RNF-85`, `MEDICION.md` §4.5 |
| 9 | Seguridad | `TODO` | 0 hallazgos §4.7 | `SEG-01..06`, `SEG-20..25`, `SEG-30..35`, `RNF-61..71` |
| 10 | Accesibilidad y calidad en uso | `TODO` | 0 serious/critical | `RUI-80..88`, `RUI-33`, `RNF-84` |
| 11 | PWA, i18n, portabilidad | `TODO` | Matriz de navegadores | `RNF-30..35`, `RF-12` |
| 12 | Hardening y release v1 | `TODO` | Smoke post-deploy + SLO | `RNF-50..58`, `SEG-43/44`, `RND-01..08`, `G6` |

### 2.1 Sprint 7 — desglose de trabajo

Lo que **no** depende de medir ya está: el proveedor real y el límite por IP. Lo que sí depende, se
queda declarado como pendiente en lugar de marcado como hecho.

- [x] `ABR-01` cerrado: `openai/gpt-oss-120b` en Groq, clave solo en servidor (`ADR-0009`)
- [x] `off` como reserva: sin clave, con error de red o con `content` vacío se degrada sin romper
- [x] `reasoning` descartado y `content` vacío tratado como fallo del proveedor, no como respuesta
- [x] Recuperación en español: stemmed y 8 chunks por sección, con alias de stack y formación
- [x] G4 acepta la cita con corchetes que el modelo copia del bloque de datos (`CHA-36`)
- [x] `RNF-68`: 10/min **por IP** + ventana de sesión, con IP del primer salto de `x-forwarded-for`
- [x] `pnpm gate:chat` en 40/40 y `tests/chat-proveedor.test.ts` con 23 pruebas
- [x] `ADR-0010`: los 8 `<details>` abiertos por defecto, con el techo de saturación subido al máximo medido
- [ ] **UI** `RF-51..58` y `DEC-01.f` (kill switch): no existe componente que llame a `/api/chat`
- [ ] `RNF-69` (Turnstile), cuota diaria por fingerprint y `Retry-After` en el 429
- [ ] **Eval set** y medición de `CHA-30`, `CHA-32`, `CHA-33`; `RNF-17` sin datos suficientes
- [ ] Rotar `GROQ_API_KEY` y configurarla en Vercel; hoy el despliegue cae a `off`

### 2.2 Sprint 6 — desglose de trabajo

La ruta `/api/chat` es la **única** parte on-demand del sitio (`ADR-0008`): todo lo demás sigue
HTML prerenderizado, y el adaptador de Vercel solo habilita esa ruta. El corpus del chat no sale
del servidor en ningún caso (`SEG-25`).

- [x] Chunking del CV en fragmentos con id estable y hash, y allowlist derivada de ellos (`CHA-01/02`)
- [x] Recuperación por solapamiento de términos, con desempate determinista (`CHA-34`)
- [x] `G1` en la entrada: recorte, scrub de PII, bloqueo de ataques y abuso, sin gastar un token
- [x] `G2`: canarios de PII en el prompt, con respuesta binaria y sin margen (`CHA-31`)
- [x] `G3`: prompt con corpus delimitado como dato no confiable, re-anclaje canónico y hash (`RNF-88`)
- [x] `G4` en la salida: contrato Zod `.strict()`, citas contra allowlist, PII, fuga y longitud (`CHA-05/36/37`)
- [x] `POST /api/chat` con origen, método, tasa y cuerpo acotados (`SEG-20/23`)
- [x] Proveedor de reserva determinista y determinista de verdad: `ABR-01` sigue abierto
- [x] `pnpm gate:chat` con 31 comprobaciones **y su prueba en negativo** (G1 y G4, rotas a propósito)
- [x] Separación transporte/lógica (`src/pages/api/chat.ts` monta, `src/lib/chat/handler.ts` decide)
- [x] `scripts/lib/static.mjs`: los gates resuelven el sitio construido, no asumen `dist/`

**Nota:** la lógica del chat es independiente de Astro para que el gate pueda ejecutarla en Node
sin Vite (`getCv()` usa `import.meta.glob`). La ruta son 12 líneas de cableado.

### 2.3 Sprint 5 — desglose de trabajo

La infraestructura de vídeo está implementada y en verde (`pnpm gate:video`). Los **clips son
provisionales** (7 × 5 s), así que la continuidad de corte (`RF-42`) y las duraciones del
storyboard quedan para el material definitivo.

- [x] Un solo `<video>` en el DOM con reciclado de `src` (`DEC-02.b`, `RUI-96`)
- [x] `IntersectionObserver`: reproduce la escena activa y cambia de clip al cambiar de escena (`RF-41`)
- [x] Cada escena declara su clip y poster (`RF-40`); posters AVIF ≤ 29 KB
- [x] `RF-10`: modo `on/off/auto` persistente; `off` = solo poster
- [x] `RUI-74`/`RUI-95`: `prefers-reduced-motion` y móvil ≤ 600 px → sin reproducción (poster)
- [x] Controles manuales accesibles: modo, pausa, reinicio (`RF-45`)
- [x] `RNF-55`: si un clip falla, se conserva el poster (sin layout shift)
- [x] Gate `pnpm gate:video` + paso en CI (se omite si no hay clips)
- [x] Clips definitivos: sin pista de audio (`RF-42`, `ffmpeg -an`) y ≤ 800 KB/segmento (`RNF-12`, 437,8 KB; total 2,5 MB)
- [x] Duraciones alineadas a los clips (5 s) en `storyboard.ts` y `SPEC.md` §5.9 (`RUI-60.b`)

**Nota:** los clips definitivos viven en `public/clips/videoN.mp4` (versionados) y sus posters
`posterN.avif` los deriva `scripts/make-posters.mjs`. Los originales de trabajo quedan en
`src/data/clips-original/` (gitignored).

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
| `gate:security` | `pnpm gate:security` | `SEG-02/03/05`, `RNF-62/63` — CSP (hash del script inline recalculado) y cabeceras en `_headers` + `vercel.json` | Sí |
| `gate:placeholders` | `pnpm gate:placeholders` | `RF-25` — marcadores de fixture | En despliegue |
| `gate:budgets` | `pnpm gate:budgets` | `RNF-07..12` — budgets sobre `dist/` real | Sí |
| `gate:artifacts` | `pnpm gate:artifacts` | `SEG-31`, `SEG-32` — ningún campo `private` en cliente | Sí |
| `gate:chat` | `pnpm gate:chat` | `CHA-01..07`, `CHA-20/22/31/34/36/37`, `SEG-11/20/25/31/35`, `ABR-01`, `ADR-0008/0009` | Sí |

**Comando único:** `pnpm gate` = `status` → `format:check` → `typecheck` → `lint` → `test`
→ `check:cv` → `gate:tokens` → `build` → `gate:ats` → `gate:security` → `gate:placeholders`
→ `gate:budgets` → `gate:artifacts` → `gate:chat`.
Equivale a `pnpm verify`.

**Fuera de `pnpm gate` (gates de sprint):** `pnpm gate:keyboard` (`RF-02..06`, `RF-09`, `RF-13`),
`pnpm gate:saturation` (`RUI-30..37`, `RUI-52`) y `pnpm gate:video` (`DEC-02`, `RF-40..45`,
`RUI-95/96`). Corren en el job `keyboard` de CI porque necesitan Chromium; no entran en el gate
rápido de PR. `gate:video` se omite si no hay clips (son provisionales y gitignored).
`gate:chat` sí entra en `pnpm gate` y no necesita Chromium: ejercita el handler en Node.

### 3.1 Gates probados en negativo

Un gate que solo se ha visto pasar no está verificado. Estos tienen su prueba de fallo:

| Gate | Cómo se rompe a propósito | Resultado esperado |
|---|---|---|
| `gate:artifacts` | `toPublicCv` deja pasar `contact` | exit 1, nombra `contact.email` y `contact.location` |
| `gate:artifacts` | Email inyectado en `dist/index.html` | exit 1, `dist/index.html contiene contact.email` |
| `astro build` | `VERCEL=1 CV_DATA_SOURCE=fixture` | exit 1, mensaje `[ADR-0003]` |
| `astro build` | `VERCEL=1 CV_DATA_SOURCE=real` sin `cv.real.ts` | exit 1, indica el fichero y cómo crearlo |
| `gate:chat` | `if (false)` en el bloqueo de G1 | exit 1, nombra `CHA-25` y el ataque concreto que dejó pasar |
| `gate:chat` | Se desactiva la detección de canario en G4 | exit 1, `CHA-31` |
| `gate:chat` | Se borra `scripts/lib/static.mjs` | exit 1 antes de medir nada |
| `deploy-contract` (CI) | Automático en cada push | Verifica los dos anteriores |

**Los siete se ejecutan también en CI** (`.github/workflows/ci.yml`, job `deploy-contract`).

---

## 4. Hecho por el Sprint 1

Implementado y verificado. El detalle requisito por requisito, con comando y número, está en
`TRACEABILITY.md` §12 bis. No se repite aquí para que no haya dos copias que se separen.

- Toolchain: TypeScript estricto, ESLint con set type-aware, Stylelint con patrón BEM, Prettier.
- Datos: schema Zod completo con `.strict()`, validación cruzada, `PublicCvDocument`.
- Shell: tokens OKLCH, reset, grid 7/5–5/7, 7 escenas, storyboard generado (35 s).
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
| [`0005`](./adr/0005-astro-7-cierra-vulnerabilidad-critica.md) | Astro 5 → 7: cierra la vulnerabilidad crítica (CVSS 9,8) de `TD-06` | Aceptada |
| [`0006`](./adr/0006-email-revelado-bajo-interaccion.md) | Email por revelado bajo interacción (`RF-27`); excepción acotada de `SEG-32` | Aceptada |
| [`0007`](./adr/0007-clips-una-vez-sin-bucle.md) | Los clips se reproducen una vez y congelan el último frame (no bucle, `RF-42`) | Aceptada |
| [`0008`](./adr/0008-chat-una-ruta-on-demand.md) | El chat es una única función on-demand; `output: 'static'` se mantiene (`SEG-25`, `RNF-08`) | Aceptada |
| [`0009`](./adr/0009-groq-cierra-abr-01.md) | `ABR-01` cerrado: el modelo es `openai/gpt-oss-120b` en Groq, clave solo en servidor, `off` como reserva | Aceptada |
| [`0010`](./adr/0010-desplegables-abiertos.md) | Los 8 `<details>` van **abiertos** por defecto; `RUI-31`/`RUI-52` suben a 29 nodos / 1.064 car. Entró a mitad de sprint por decisión del PO | Aceptada |

**Abierto a propósito:** nada de `ABR-01` (cerrado por `ADR-0009`). Lo que sigue abierto y
**declarado** es la medición: `CHA-30/32/33` necesitan el eval set, y el límite de 10/min por IP es
una mitigación por instancia, no una cuota global (`TD-12`).

---

## 6. Cómo contribuya un agente

1. Lee este fichero, luego `AGENTS.md`.
2. `pnpm status` — si falla, el repo está inconsistente con lo que dice aquí. Arréglalo antes de tocar código.
3. Trabaja **un sprint a la vez**. `SCRUM.md` §6: un requisito nuevo a mitad de sprint no entra.
4. Cada cambio que toques un requisito necesita: código + gate + fila en `TRACEABILITY.md` §12 bis + ADR si toca `SPEC.md` §2.
5. `pnpm gate` en verde antes de commitear.
6. Actualiza §1 y §2 de este fichero en el mismo commit. Si no, el siguiente agente trabaja con información obsoleta.
