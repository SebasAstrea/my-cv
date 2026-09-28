# Metodología de Desarrollo — SCRUM

**Proyecto** Portafolio / CV "Dossier" · **Norma base** ISO/IEC 25000:2017 (SQuaRE)
**Documentos asociados** [`SPEC.md`](./SPEC.md) (requerimientos) · [`MEDICION.md`](./MEDICION.md) (protocolo de verificación) · [`TRACEABILITY.md`](./TRACEABILITY.md) (cobertura) · [`BACKLOG.md`](./BACKLOG.md) (detalle por sprint)

> **Principio rector.** La especificación define 240 requisitos con método de verificación.
> Un requisito sin método de verificación con criterio numérico no es un requisito, es una
> intención (`MEDICION.md` §5). Por eso en este proyecto **el entregable de un sprint no es
> código, es un entregable con gate en verde**. Un sprint cuyo código funciona pero cuyo
> gate no pasa, no está terminado.

---

## 1. Por qué SCRUM aquí y no Kanban/waterfall

El producto tiene tres características que hacen que el trabajo en lotes grandes falle:

1. **Verificabilidad barata y numérica.** Casi todo el spec se reduce a umbrales que una
   máquina comprueba (`RNF-07`: 350 KB; `RUI-30`: 6 nodos; `SEG-32`: 0 campos privados).
   Con verificaciones baratas, ciclos cortos y automatizados, el bucle de feedback se
   puede cerrar en días, que es exactamente el criterio de elección de SCRUM
   (Schwaber & Sutherland): el coste de comprobar es menor que el coste de equivocarse.
2. **Alta incertidumbre técnica concentrada.** `DEC-01` (dónde corre el
   modelo), `DEC-02` (vídeo por escenas) y `CHA-30` (tasa de éxito de inyección) tienen
   riesgo alto. Hay que ordenarlos para que lo incierto se aborde **en un sprint
   acotado**, no al final del proyecto.
3. **Coste de retraso alto en la dirección de arte.** `RFU-05` (estética) y los
   antipatrones `RUI-50` solo se detectan cuando hay algo que mirar. Un waterfall aquí
   significaría descubrir que la dirección de arte no funciona en el mes 6.

Lo que **no** usamos: roles de plantilla, ceremonias de 4 horas, velocity
como métrica de rendimiento individual, ni sprints de "ritmo". Un producto
unipersonal con 240 requisitos no gana nada imitando a un equipo de nueve.

---

## 2. Roles

| Rol | Responsable | Nota |
|---|---|---|
| **Product Owner** | Propietario del CV | Decide el orden. Única persona que puede cambiar el alcance de un sprint o relajar un budget. |
| **Scrum Master** | El mismo, en la práctica | Facilita: protege el WIP, recuerda las ceremonias, no implementa. |
| **Equipo de desarrollo** | 1 | Con Gates: el que escribe código sin saltarse el gate es la misma persona. |

**Consecuencia de la unidad de equipo:** no se hace Scrum de mentira. Se eliminan los roles
que solo existen para distribuir responsabilidad en equipos grandes y se concentran en dos
ceremonias con producto: **Planificación** y **Revisión**, más un **Retrospectiva** corta.
El control de calidad no lo da un "scrum master" sino el gate de CI, que es objetivo y no
negociable.

---

## 3. Ceremonias

| Ceremonia | Cuándo | Duración | Qué produce | Regla dura |
|---|---|---|---|---|
| **Refinamiento** | Inicio de sprint | 45 min | Backlog del sprint siguiente con criterios de aceptación en texto de gate | Un requisito entra al sprint solo si tiene método de verificación. Si no, vuelve a `SPEC.md`. |
| **Planificación** | Inicio de sprint | 60 min | Sprint goal + alcance comprometido | El objetivo es un **resultado verificable**, no "terminar tareas". |
| **Daily** | Diaria | 10 min | Bloqueos | Sin stand-up formal: el tablero es la daily. Se registra solo lo que bloquea. |
| **Revisión** | Fin de sprint | 45 min | Entregable + veredicto `ACCEPTED` / `NOT ACCEPTED` contra el gate | Sin gate en verde, `NOT ACCEPTED`. No hay "casi". |
| **Retrospectiva** | Fin de sprint | 30 min | 1 acción con dueño y fecha | Máximo 1 acción. Un backlog de 15 acciones es un backlog de 0. |

**Presupuesto de tiempo de ceremonia: ~2.5 h/semana (10 % del sprint).** Si se supera dos
sprints seguidos, la retrospectiva corrige el dimensionamiento del sprint, no la ceremonia.

---

## 4. Sprint

- **Duración:** 1 semana natural (lunes → domingo).
- **Sprint goal:** un resultado verificable ("El sitio se renderiza en servidor con 7
  escenas desde un único origen de verdad validado", no "configurar el proyecto").
- **Compromiso:** en un sprint unipersonal el objetivo se compromete **completo**. Si no cabe,
  se divide el objetivo. No se entrega 70 % de un objetivo (salvo Sprint 12, ver §7).
- **WIP:** 1 sprint. No se abre un sprint nuevo sin cerrar la revisión del anterior. El
  trabajo a medio hacer no se acumula.
- **Fecha de corte:** el domingo. Lo que no pasó el gate el domingo se arrastra al sprint
  siguiente **y se anota en el retro** con la causa.

---

## 5. Definition of Done (DoD) — la ley del proyecto

`TRACEABILITY.md` §13 define el DoD por requisito. El DoD de un **entregable de sprint** es
más estricto, porque incluye la evidencia:

Un sprint está `ACCEPTED` solo si se cumplen **los 7 puntos**:

| # | Condición | Verificable por |
|---|---|---|
| 1 | Todos los requisitos del sprint implementados | Diff de código |
| 2 | `pnpm typecheck` en verde, 0 errores, 0 `any` implícito | `tsc --noEmit` (`RNF-80`) |
| 3 | `pnpm lint` en verde (ESLint + Stylelint) | CI |
| 4 | Los **gates del sprint** declarados en `BACKLOG.md` en verde | Suite de gates |
| 5 | `pnpm build` genera artefactos dentro de budget | `scripts/budgets.mjs` (`RNF-07..12`) |
| 6 | Entrada en `TRACEABILITY.md` con ID y método de verificación exactos | Revisión |
| 7 | ADR redactado si el entregable relaja un budget o cambia una decisión de `SPEC.md` §2 | Revisión |

**Los puntos 2, 4 y 5 bloquean. El punto 6 y 7 no son opcionales aunque "funcione".**

### 5.1 Anti-patrón de cierre

> Un requisito marcado "hecho" sin entrada en `TRACEABILITY.md` **no cuenta**.
> Un ADR ausente cuando se toca una decisión de `SPEC.md` §2 **revierte el cambio**.

Esto está en `TRACEABILITY.md` §13 y se repite aquí porque es el modo de fallo real de un
proyecto con este volumen de requisitos: terminar features que nadie sabe verificar.

---

## 6. Gestión del alcance

| Situación | Acción | Quién |
|---|---|---|
| Requisito entra a mitad de sprint | No entra. Va al sprint siguiente. | PO |
| Requisito de un sprint no cabe | Se saca el de menor valor de negocio, no el más difícil. Se registra. | PO |
| Se descubre requisito nuevo | Se añade a `SPEC.md` con bump de versión de `SPEC.md` (§10) y va a `BACKLOG.md`. | PO |
| Se relaja un budget (p. ej. `RNF-07` 350 → 450 KB) | ADR con número antes/después y justificación. Sin ADR, no se toca. | PO |
| Un gate falla 3 sprints seguidos por diseño | El gate se revisa formalmente (no se desactiva). `MEDICION.md` §9 prohíbe "ajustar el budget después de ver el número". | PO |

---

## 7. Roadmap de sprints

Cada sprint es 1 semana. El entregable es un artefacto verificable, no un porcentaje.

| # | Sprint Goal | Entregable verificable | Requisitos nucleus | Gate principal |
|---|---|---|---|---|
| **0** | Especificar | `SPEC.md` + `MEDICION.md` + `TRACEABILITY.md` | — | Revisión de los 240 requisitos |
| **1** | **Fundación y toolchain** | Repo que compila, valida el CV con Zod, sirve shell con tokens y 7 escenas vacías | `RNF-80`, `RNF-87`, `RF-20`, `RND-03`, `RUI-01..24`, `RUI-70..74` | `typecheck` + `build` + Zod |
| **2** | Fuente de verdad y render SSR | CV real validado, 7 escenas renderizadas, JSON-LD, 4 exportadores | `DEC-03`, `RF-01`, `RF-23`, `RF-24`, `RF-25`, `RNF-33`, `RNF-100` | `RNF-33` ATS + `RF-25` |
| **3** | Navegación, teclado y tema | Rail, deep-link, teclado completo, skip-link, tema sin flash | `RF-02..06`, `RF-09`, `RUI-81` | Teclado 100 % flujos |
| **4** | Divulgación progresiva y presupuesto | Drawer de detalle, gate de saturación, email, PDF | `RUI-30..37`, `RUI-52`, `RF-13`, `RF-26/27`, `RF-10`, `RF-11` | `RUI-52` Playwright |
| **5** | Sistema de vídeo (DEC-02) | 7 clips + posters, pool de 1 vídeo, IO, controles | `DEC-02`, `RF-40..45`, `RNF-55`, `RUI-96` | 1 `<video>` DOM + `RF-41` |
| **6** | Chat G1–G4 (guardrails) | Chunking, allowlist, prompt server-only, salida validada | `CHA-01..07`, `CHA-20..22`, `SEG-11`, `SEG-25` | 100 % cobertura guardrails |
| **7** | Chat G5–G6 + eval set | ModelProvider `api`, rate limit, Turnstile, UI, eval set | `DEC-01.b/f`, `RF-50..58`, `RNF-68/69`, `CHA-30..39` | `CHA-30` ≤ 1 % |
| **8** | Rendimiento | Lighthouse CI con budgets, RUM, medición emparejada del vídeo | `RNF-01..23`, `RNF-85`, `MEDICION.md` §4.5 | Todos los budgets de §4.2 |
| **9** | Seguridad | Cabeceras, CSP, escáneres, artefactos sin PII, SBOM | `SEG-01..06`, `SEG-20..25`, `SEG-30..35`, `RNF-61..71` | 0 hallazgos §4.7 |
| **10** | Accesibilidad y calidad en uso | axe en 5 estados, contraste por píxel, reflow, visual regression | `RUI-80..88`, `RUI-33`, `RNF-84` | 0 serious/critical |
| **11** | PWA, i18n, portabilidad | Instalable + offline, ES/EN con hreflang, matriz de navegadores | `RNF-30..35`, `RF-12` | Matriz de navegadores |
| **12** | Hardening y release v1 | SLO/monitoring, sonda jailbreak, auditoría de datos, docs | `RNF-50..58`, `SEG-43/44`, `RND-01..08`, `G6` | Smoke post-deploy + SLO |

### 7.1 Notas de dimensionamiento del roadmap

- **Los sprints 5, 7 y 9 son los de mayor riesgo.** El vídeo depende de material externo
  (`ABR-05` dice que los clips los produce el propietario); el eval set del chat depende de un
  modelo no determinista (`RK-03`); la seguridad depende de que el despliegue en Vercel permita
  los headers que se piden. Si alguno de los tres se retrasa, **se recorta alcance del sprint, no
  se recorta el gate**.
- **Los sprints 2 y 4 son secuenciales por diseño.** El Sprint 2 necesita el contenido real del
  CV; el Sprint 4 construye la divulgación progresiva sobre las escenas que el Sprint 2 produce.
- **El Sprint 12 es el único que admite entrega parcial**: se cierra con 2 semanas de datos de
  campo para `RFU-01..07` (`MEDICION.md` §2.1 exige ≥ 500 sesiones por segmento para publicar
  p75). Lo que no tenga volumen de campo se entrega etiquetado como *verificado en laboratorio*.

---

## 8. Ceremonia de cierre de sprint (checklist)

```
REVISIÓN DE SPRINT N
├─ [ ] ¿El sprint goal se cumple con el gate en verde?        → ACCEPTED / NOT ACCEPTED
├─ [ ] ¿Los 7 puntos del DoD (§5) están completos?
├─ [ ] ¿TRACEABILITY.md actualizado con ID + método?
├─ [ ] ¿Hay ADR para cada decisión de SPEC.md §2 tocada?
├─ [ ] ¿Los budgets se movieron? → si sí, ¿hay ADR?
├─ [ ] ¿Algún gate falló y se desactivó? → registrar con fecha de caducidad
├─ [ ] RETRO: 1 acción con dueño y fecha
└─ [ ] PLANIFICACIÓN N+1: sprint goal + alcance
```

---

## 9. Trazabilidad scrum → requisitos

La tabla §7 mapea sprints a requisitos. El detalle fino (requisito a requisito, con su gate
concreto) vive en [`BACKLOG.md`](./BACKLOG.md). La cobertura normativa ISO/IEC 25000
vive en [`TRACEABILITY.md`](./TRACEABILITY.md). Ninguno de los tres documentos sustituye a
los otros dos: `SCRUM.md` dice **cuándo**, `BACKLOG.md` dice **cómo se comprueba**, y
`TRACEABILITY.md` dice **qué característica de calidad cubre**.

---

## 10. Glosario

| Término | Significado en este proyecto |
|---|---|
| **Gate** | Un umbral numérico que, si falla, bloquea el cierre del sprint. Un gate sin número es una preferencia. |
| **Budget** | Un techo de recursos (`RNF-07`: 350 KB). Moverlo requiere ADR. |
| **Entregable** | Artefacto verificable con gate. Un commit no es un entregable. |
| **WIP** | Trabajo en curso. En unipersonal = sprints abiertos. Máximo 1. |
| **Private field** | Campo del CV con flag `private`: se elimina en build, nunca llega al cliente (`SEG-31`). |
| **ACCEPTED** | El gate del sprint está en verde Y los 7 puntos del DoD están completos. |
