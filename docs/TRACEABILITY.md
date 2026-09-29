# Matriz de Trazabilidad — ISO/IEC 25000 → Requisitos → Verificación

**Documento asociado** [`SPEC.md`](./SPEC.md) · [`MEDICION.md`](./MEDICION.md)

Esta matriz demuestra cobertura: cada característica de producto de ISO/IEC 25010 tiene requisitos asociados, y cada requisito tiene un método de verificación. Un hueco en cualquier columna es un hueco de calidad, y se cierra o se documenta como riesgo aceptado.

**Cobertura actual:** 240 requisitos identificables (`CHA` 20, `RF` 36, `RFU` 7, `RND` 8, `RNF` 69, `RUI` 70, `SEG` 30) + 15 decisiones/supuestos/abiertos (`DEC`, `SUP`, `ABR`; 5 cerradas, 1 abierta).

Leyenda de verificación: **T** = test automatizado en CI · **M** = medición/benchmark · **E** = evaluación con usuarios · **R** = revisión manual/documental.

---

## 1. ISO/IEC 25010 §4.1 — Functional suitability (Idoneidad funcional)

| Sub-característica | Requisitos | Verificación |
|---|---|---|
| **Functional completeness** (completitud funcional) | `RF-01`…`RF-13`, `RF-20`…`RF-26`, `RF-40`…`RF-45`, `RF-50`…`RF-58` | T: cobertura de flujos en Playwright; checklist de `RF-20` validado por schema Zod; gate de placeholders (`RF-25`) |
| **Functional correctness** (corrección funcional) | `RF-04`, `RF-07`, `RF-11`, `RF-23`, `RF-26`, `RF-41`, `RF-43`, `RF-52`, `RF-56`, `CHA-01`…`CHA-07`, `CHA-34` | T: tests de comportamiento; `SEG-32` (campos privados); `CHA-34` (citas válidas) |
| **Functional appropriateness** (Idoneidad para el propósito) | `RFU-01`…`RFU-03`, `RFU-07`, `CHA-20`, `CHA-21`, `CHA-22`, `RNF-33` | E: `MEDICION.md §4` (n=40 comprensibilidad); T: `RNF-33` (parseo ATS) |

**Nota:** la tercera sub-característica es donde un CV falla más: no por estar incompleto, sino por no priorizar. Se mide con `RFU-03` (comprensión en 30 s).

---

## 2. ISO/IEC 25010 §4.2 — Performance efficiency (Eficiencia de rendimiento)

| Sub-característica | Requisitos | Verificación |
|---|---|---|
| **Responsiveness** (tiempo de respuesta) | `RNF-01`…`RNF-04`, `RNF-06`, `RNF-16`…`RNF-19`, `RNF-22` | M: Web Vitals T1/T2; Lighthouse CI; trazas de latencia del chat por franja horaria |
| **Throughput** (rendimiento/caudal) | `RNF-13`, `RNF-14`, `RNF-18` | M: frames/s y tok/s; k6 en el endpoint de chat |
| **Resource utilization** (utilización de recursos) | `RNF-07`…`RNF-12`, `RNF-15`, `RNF-20`, `RNF-21`, `RNF-90` | T: budgets en CI; instrumentación de bytes y coste |
| **Capacity** (capacidad) | `RNF-50`, `RNF-52`, `RNF-68` | M: prueba de carga hasta el punto de saturación; error rate bajo carga |
| **Scalability** (escalabilidad) | `RNF-50`, `RNF-68`, `RNF-21` | M: k6 en escalones (10 → 100 → 500 rps); validación de coste |
| **Accuracy / Reliability** (exactitud) | `CHA-04`, `CHA-30`…`CHA-38`, `RND-01`, `RND-02` | T: eval set del chat con Cohen's κ; E: auditoría de datos del CV |

**Nota:** la sub-característica de exactitud es donde un LLM falla de forma más probable. Por eso tiene su propio bloque de eval y no se considera "cubierta" por los tests de latencia.

---

## 3. ISO/IEC 25010 §4.3 — Compatibility (Compatibilidad)

| Sub-característica | Requisitos | Verificación |
|---|---|---|
| **Co-existence** (coexistencia) | `RNF-40`, `RNF-70` (sin terceros), `SEG-40` | T: inventario de red en Playwright = 0 terceros; test de 0 cookies de terceros |
| **Interoperability** (interoperabilidad) | `RNF-30`…`RNF-35`, `RNF-100`…`RNF-103`, `DEC-01.b` | T: matriz de navegadores (Playwright + dispositivos físicos); 5 exportadores del CV; test de intercambio de `ModelProvider` |

---

## 4. ISO/IEC 25010 §4.4 — Usability (Usabilidad)

| Sub-característica | Requisitos | Verificación |
|---|---|---|
| **Appropriateness recognizability** (reconocibilidad) | `RUI-20`…`RUI-25`, `RUI-60.a`…`RUI-60.g`, `RF-02` | M: revisión de diseño (R) + snapshot visual por escena |
| **Learnability** (aprendizaje) | `RF-06`, `RNF-42` | E: `RFU-01` (primera interacción útil < 5 s) |
| **Operability** (operabilidad) | `RF-03`…`RF-05`, `RF-13`, `RF-45`, `RUI-86`…`RUI-88`, `RNF-41` | T: Playwright teclado/pointer; flows de chat |
| **User error protection** (protección ante error) | `RF-10`, `RNF-41`, `RNF-53`, `RNF-55`, `RF-54` | T: escenarios de fallo inyectado (chat caído, vídeo 404, red lenta) |
| **User interface aesthetics** (estética) | `RUI-01`…`RUI-19`, `RUI-30`…`RUI-37`, `RUI-50.a`…`RUI-50.k`, `RUI-60.a`…`RUI-60.g` | E: `RFU-04` (A/B forzado vs referencias), `RFU-05` (MQ-UIAS, n=100) + T: presupuestos de diseño §4.3 y lista de antipatrones |
| **Accessibility** (accesibilidad) | `RUI-80`…`RUI-88`, `RNF-101` | T: axe-core (5 estados) + teclado + reflow + revisión manual; WCAG 2.2 AA |
| **Inclusiveness** (inclusividad) | `RUI-74`, `RUI-84`, `RUI-88`, `RUI-92`, `RUI-93` | T: matriz de preferencias (motion, contrast, color forzado, zoom) |

**Nota sobre estética:** es la sub-característica que más software ignora y la que este proyecto trata como requisito de primer nivel. Se mide con instrumentos validados (`RFU-04`, `RFU-05`) y con presupuestos automáticos (`MEDICION.md §4.3`), no con opinión del autor.

---

## 5. ISO/IEC 25010 §4.5 — Reliability (Fiabilidad)

| Sub-característica | Requisitos | Verificación |
|---|---|---|
| **Maturity** (madurez) | `RNF-51`, `RNF-54`, `CHA-39` (flip rate) | T: crash-free sessions, hydration errors; eval con 3 repeticiones |
| **Availability** (disponibilidad) | `RNF-50`, `RNF-58` | M: uptime monitor externo + SLO/error budget |
| **Fault tolerance** (tolerancia a fallos) | `RNF-53`, `RNF-55`, `RNF-56`, `RNF-58` | T: `error-boundary`; clip 404 → poster; circuit breaker |
| **Recoverability** (recuperabilidad) | `RNF-41`, `RNF-57`, `RND-04` (vigencia) | T: acciones de recuperación; runbook de incidente; revisión semestral del CV |
| **Failure manageability** (gestión de fallos) | `RNF-41`, `RNF-53`, `RNF-55` | E: ¿el fallo se entiende? (usability del error) |

---

## 6. ISO/IEC 25010 §4.6 — Security (Seguridad)

| Sub-característica | Requisitos | Verificación |
|---|---|---|
| **Confidentiality** (confidencialidad) | `SEG-30`…`SEG-35`, `SEG-40`…`SEG-44`, `SEG-25`, `RNF-70`, `RNF-71` | T: artefactos sin campos privados (`SEG-32`); canario PII (0 fugas); payload RUM sin IP |
| **Integrity** (integridad) | `SEG-11`, `SEG-15`, `SEG-21`, `SEG-23`, `RNF-61`, `RNF-66` | T: fuzzing del borde; auditoría de deps; hash de pesos del modelo |
| **Non-repudiation** (no repudio) | `RNF-67`, `RNF-57` | R: política de retención y auditoría; (n/a estricto en sitio público, se cubre vía logs + SLO) |
| **Accountability** (responsabilidad) | `RNF-67`, `SEG-35`, `CHA-06` (métricas de guardrail), `RND-07` (trazabilidad del dato) | T: RUM/logs sin PII; métricas de guardrail y alertas |
| **Authenticity** (autenticidad) | `SEG-13` (Turnstile), `SEG-10`, `SEG-16` | T: post sin token/origin válido → 403; inspección de bundle (0 credenciales) |

**Controles de proceso asociados** (no en 25010 pero exigidos aquí): ISO/IEC 27001/27002 (gestión de cambios, gestión de incidentes), OWASP ASVS 4.0.3 L2, OWASP LLM Top 10, NIST AI RMF 1.0 (función *Govern/Map/Measure/Manage* para el componente de IA). Ver `MEDICION.md §4.7`.

---

## 7. ISO/IEC 25010 §4.7 — Maintainability (Mantenibilidad)

| Sub-característica | Requisitos | Verificación |
|---|---|---|
| **Modularity** (modularidad) | `DEC-01.b` (`ModelProvider`), `DEC-03`, `RNF-87`, `RNF-88` | T: intercambio de provider sin tocar guardrails; tokens desde fuente única |
| **Reusability** (reusabilidad) | `DEC-03.a`, `RNF-100` (5 exportadores), `RNF-90` | T: los exportadores comparten la misma fuente |
| **Analysability** (analizabilidad) | `RNF-80`, `RNF-89` (ADRs) | T: `tsc --noEmit`; ADRs en `docs/` |
| **Changeability** (modificabilidad) | `RNF-83` (CI < 10 min), `RNF-84` (visual regression) | M: tiempo de pipeline; diffs visuales detectados |
| **Testability** (verificabilidad) | `RNF-81`, `RNF-82`, `RNF-85` | M: cobertura ≥ 80%, mutación ≥ 70%, budgets en CI |

---

## 8. ISO/IEC 25010 §4.8 — Portability (Portabilidad)

| Sub-característica | Requisitos | Verificación |
|---|---|---|
| **Adaptability** (adaptabilidad) | `RNF-30`…`RNF-32`, `RNF-35`, `DEC-01.b` | T: fallback sin WebGPU; i18n |
| **Installability** (instalabilidad) | `RNF-34` (PWA) | T: instalabilidad + offline parcial |
| **Replaceability** (reemplazabilidad) | `RNF-103` (`ModelProvider`), `RNF-100` (exportadores) | T: cambiar de proveedor/idioma = env var, sin deploy de lógica |
| **Environment portability** (portabilidad de entorno) | `RNF-101`, `RNF-102`, `RNF-30` | T: contenido sin JS; sin vendor lock-in de contenido |

---

## 9. ISO/IEC 25019 — Calidad en uso

Esta norma mide el resultado en el contexto de uso real (no la producto aislada). Es donde viven `RFU-*` y varios `CHA-*`.

| Dimensión | Requisitos | Verificación |
|---|---|---|
| **Effectiveness** (efectividad) | `RFU-01`, `RFU-02`, `RFU-03`, `RFU-07` | E: tareas cronometradas (n=30–40), binomial de Wilson |
| **Efficiency** (eficiencia) | `RFU-01` (< 10 s), `RFU-02` (≥ 90%) | E: tiempo hasta el objetivo, no satisfacción |
| **Satisfaction** (satisfacción) | `RFU-04`, `RFU-05`, `RFU-06` | E: MQ-UIAS (n=100), UMUX-Lite, A/B forzado (n=30), bootstrap de medias |
| **Freedom from risk** (libertad de riesgo) | `SEG-30`…`SEG-35`, `CHA-30`, `CHA-31`, `RFN-101` | T: cero fugas de PII, cero PII en bundle, transparencia del chat |
| **Context coverage** (cobertura de contexto) | `RFU-01`…`RFU-07` por persona (P1–P4), `RNF-33` (P4/ATS) | E: cobertura de las 4 personas; T: parseo ATS |

---

## 10. ISO/IEC 25012 — Calidad del dato (aplicada al CV)

El CV *es* el dato. Si el dato es incorrecto, todo el producto hereda el error. Requisitos `RND-01`…`RND-08`, verificados en `SPEC.md §6.8`. Trazabilidad resumida:

| Dimensión | Requisitos | Verificación |
|---|---|---|
| Exactitud / Consistencia / Validez | `RND-01`, `RND-02`, `RND-03` | R: auditoría contra fuente; T: schema + coherencia temporal |
| Completitud / Relevancia | `RND-05`, `RND-06` | T: schema required; gate de longitud por escena |
| Accesibilidad / Cumplimiento | `RND-08`, `RNF-33`, `RNF-101` | T: texto plano sin JS; parseo ATS |
| Retención / Trazabilidad | `RND-04`, `RND-07` | R: revisión semestral; enlaces a evidencia |

---

## 11. Cobertura de la línea temporal de varias escenas y el vídeo

Requisitos transversales que no pertenecen a una única característica de 25010 y que se trazan aparte para no perderlos:

| Requisito | Tema ISO | Verificación |
|---|---|---|
| `RF-40`…`RF-45`, `DEC-02` | §4.1 Functional suitability, §4.2 Performance | T: reproducción/pausa por escena; 1 `<video>` en DOM |
| `RUI-30`…`RUI-37` (presupuesto de saturación) | §4.4 Usability / aesthetics | T: presupuestos §4.3 de `MEDICION.md` |
| `RUI-33` (contraste sobre vídeo) | §4.4 Accessibility | T: muestreo de píxel §4.4 de `MEDICION.md` |
| `RNF-13`, `RNF-14`, `RNF-15` | §4.2 Performance efficiency | M: crossover emparejado, Wilcoxon (§4.5) |

---

## 12. Riesgos aceptados y huecos conocidos

Un hueco declarado es mejor que un hueco oculto. Estado actual:

| ID | Riesgo / hueco | Impacto | Mitigación | Estado |
|---|---|---|---|---|
| `RK-01` | El laboratorio no puede reproducir Thermal Throttling real de decodificación de vídeo. | Métricas de vídeo pesimistas en lab. | Complementar con ≥ 3 dispositivos físicos (§5) | Aceptado |
| `RK-02` | CrUX no tendrá suficiente tráfico para segmentos finos (ej. slow-mid mobile). | `RNF-01..04` sin evidencia de campo. | RUM propio (T1); marcar requisitos como "verificado en laboratorio" hasta tener 500 sesiones | Aceptado |
| `RK-03` | Los modelos de lenguaje son no deterministas; los gates del chat tienen varianza. | Flapping de CI en `CHA-30`. | 3 repeticiones por build + reporte de flip rate (`CHA-39`); margen en el umbral (1% con LCI< 3%) | Aceptado |
| `RK-04` | Los edificios anidados de guardrail añaden latencia. | `RNF-17` (TTFT). | G1 en cliente (coste 0 de red), G4 con salida corta; medir por capa | Aceptado |
| `RK-05` | El modo `webgpu` expone el prompt al cliente. | Debilita `SEG-25` / G3. | Deshabilitado por defecto; opt-in explícito; solo tras pasar eval set. Riesgo documentado | Aceptado con mitigación |
| `RK-06` | Sin datos de conversión fiables (tráfico bajo) para validar `RFU-07`. | No concluyente. | Declarado en `MEDICION.md §7.2` como experimento no concluyente; se usa `RFU-03` como proxy | Aceptado |
| `RK-07` | Los antipatrones `RUI-50` dependen de revisión humana, no solo de lint. | Deriva de diseño. | Snapshot visual + revisión de diseño por persona en cada PR con cambio de `RUI` | Mitigado |
| `RK-08` | El presupuesto de saturación (`RUI-30`) puede ser subjetivo en el límite. | Discrepancias entre revisores. | Playwright cuenta nodos; el límite numérico (6) elimina la subjetividad | Mitigado |
| `RK-09` | Los guardrails del chat (G1–G4) se han verificado solo contra un proveedor determinista, nunca contra un modelo real (`ABR-01` abierto). | La tasa de fuga real (`CHA-30`), el coste (`CHA-32`) y la latencia (`CHA-33`) **no están medidos**. G3 y G4 están construidos y probados contra entradas simuladas, no contra el adversarial de un LLM de verdad. | Sprint 7: `ABR-01` **cerrado** con Groq (`ADR-0009`) y los guardrails ya se ejecutan contra la forma de respuesta de un modelo real. Queda montar el eval set y medir; no se declaran cumplidos `CHA-30/32/33` | **Aceptado, con hueco declarado** |

---

## 12 bis. Verificación ejecutada — Sprint 1 (Fundación y toolchain)

`SCRUM.md` §5 exige una entrada por requisito *con el método exacto*. Esta es la del Sprint 1:
qué se ejecutó, con qué comando, y qué número dio. Lo que no aparece aquí no se ha verificado.

| Requisito | Método | Comando | Resultado | Estado |
|---|---|---|---|---|
| `RNF-80` | T: `astro check` + `tsc --noEmit`, 0 `any` implícito | `pnpm typecheck` | 0 errores, 21 ficheros | **Cumplido** |
| `RNF-80` | T: ESLint flat config, set type-aware en `src/**/*.ts` | `pnpm lint` | 0 problemas | **Cumplido** |
| `ADR-0002` | T: Stylelint, patrón BEM + `custom-property-pattern` | `pnpm lint` | 0 problemas en `src/**/*.css` | **Cumplido** |
| `RF-20` | T: el fixture parsea contra el schema Zod; `.strict()` en cada objeto | `pnpm check:cv` | exit 0 | **Cumplido** |
| `RF-20` | T: reglas cruzadas de integridad | `pnpm check:cv` | 1 aviso `RND-02` (solape legítimo, no bloqueante por diseño) | **Cumplido** |
| `RND-03` | T: ninguna fecha futura | `pnpm check:cv` | 0 fechas futuras | **Cumplido** |
| `SEG-31` | T: `PublicCvDocument` como tipo de salida; `contact.email` no compila en la UI | `pnpm typecheck` | 0 errores | **Cumplido** |
| `SEG-31` | T: ninguna clave `private` sobrevive a `toPublicCv` (comprobación estructural) | `pnpm gate:artifacts` | 0 fugas | **Cumplido** |
| `SEG-32` | T: ningún valor `private` en `dist/**` | `pnpm gate:artifacts` | 2 valores comprobados, 0 fugas en 2 artefactos | **Cumplido** |
| `SEG-32` | T: **el gate detecta la fuga** (prueba en negativo) | `pnpm gate:artifacts` con `toPublicCv` alterado | exit 1, nombra `contact.email` y `contact.location` | **Cumplido** |
| `ADR-0003` | T: build con fixture funciona en dev | `pnpm build` | exit 0, `dist/index.html` 9.3 KB | **Cumplido** |
| `ADR-0003` | T: **un despliegue con fixture falla** (prueba en negativo) | `VERCEL=1 CV_DATA_SOURCE=fixture pnpm build` | exit 1, mensaje `[ADR-0003]` | **Cumplido** |
| `ADR-0003` | T: el mensaje de `real` sin `cv.real.ts` es accionable | `VERCEL=1 CV_DATA_SOURCE=real pnpm build` | exit 1, indica el fichero y cómo crearlo | **Cumplido** |
| `RNF-87` | T: 0 literales de color o escala fuera de `tokens.css` | `pnpm gate:tokens` | 7 ficheros, 71 tokens | **Cumplido** |
| `RUI-01..24` | R: grid 7/5–5/7, 7 escenas, sin 50/50 | `pnpm build` | 7 `<h2>` con `id` en `dist/index.html` | **Cumplido** |
| `RF-24` | T: metadatos de storyboard generados | `pnpm build` | 7 escenas, 35 s | **Cumplido** |
| `RF-25` | T: marcadores de fixture bloqueantes en despliegue, aviso en dev/PR | `pnpm gate:placeholders` | 2 marcadores, 0 bloqueantes (fixture permitido aquí) | **Cumplido** |
| `RNF-07` | M: primera carga sin vídeo | `pnpm gate:budgets` | 4.8 KB / 350 KB | **Cumplido** |
| `RNF-08` | M: JS en ruta crítica | `pnpm gate:budgets` | 0.0 KB / 110 KB | **Cumplido** |
| `RNF-09` | M: CSS total | `pnpm gate:budgets` | 2.6 KB / 24 KB | **Cumplido** |
| `RNF-10..12` | M: fuentes, poster LCP, primer segmento | `pnpm gate:budgets` | `sin material` en `dist/`: no medibles hasta el sprint de fuentes y de vídeo | **No medible** |
| `RNF-33` | T: HTML semántico generado en build, parseable sin JS | `pnpm build` | 1 página estática, 0 KB de JS | **Cumplido** |
| `SCRUM.md` §5 | T: la cadena de gates es reproducible con un comando | `pnpm gate` | exit 0, 10 pasos | **Cumplido** |
| `RNF-01` | T4: LCP de lab, mediana de 3 (desktop, 4g, cold) | `pnpm medir:lab` | 0,268 s / 1,8 s | **Cumplido** |
| `RNF-15` | T4: TBT de lab, mediana de 3 | `pnpm medir:lab` | 0,006 s / 0,150 s | **Cumplido** |
| `RNF-03` | T4: CLS de lab, mediana de 3 | `pnpm medir:lab` | 0,0000 / 0,02 | **Cumplido** |
| `RNF-04` | T4: TTFB de lab, mediana de 3 | `pnpm medir:lab` | 0,001 s / 0,4 s | **Cumplido** |
| `RNF-01..04` | T4: los 5 perfiles de red de `MEDICION.md` §5, móvil y desktop | `pnpm medir:lab` | peor caso 0,74 s (`3g-fast`), margen 59 % | **Cumplido** |
| `RNF-07..09` | T5: budgets sobre `dist/`, gzip | `pnpm medir:estatico` | 4,8 / 0,0 / 2,6 KB | **Cumplido** |
| `RUI-02` | T: contraste de texto resuelto en el navegador, WCAG 2.1 AA | `pnpm medir:diseno` | 5/5 pares cumplen, peor 5,28:1 | **Cumplido** |
| `RNF-84` | T: axe-core WCAG 2.2 AA, 3 de los 5 estados de §4.8 | `pnpm medir:lab` | 0 violaciones, 0 serious/critical | **Cumplido** |
| `RNF-84` | T: reflow 320 px sin scroll horizontal | `pnpm medir:lab` | 0 px de scroll en 3 estados | **Cumplido** |
| `RNF-84` | T: `prefers-reduced-motion` sin animaciones vivas | `pnpm medir:lab` | 0 animaciones en ejecución | **Cumplido** |
| `RNF-84` | T: target size, 0 objetivos < 24 px | `pnpm medir:lab` | 0 casos | **Cumplido** |
| `RUI-01` | T5: presupuesto de diseño por escena, §4.3 | `pnpm medir:diseno` | **3/7 escenas cumplen**; `stack` 27 nodos y `experiencia` 757 caracteres | **Incumplido** (`TD-11`) |
| `SEG-01..06` | T: auditoría de dependencias | `pnpm audit --audit-level=high` | 1 crítica (CVSS 9,8, `astro`), 4 altas; explotabilidad actual verificada nula | **Incumplido** (`TD-06`) |
| `SCRUM.md` §5 | T: las cifras de `STATUS.md` §1 coinciden con la realidad | `pnpm status` | nº de pasos y rango `TD-*` verificados, 4 negativos probados | **Cumplido** |
| `RNF-07..12` | T: el gate **sigue detectando** el exceso tras el cambio a `sin material` | `pnpm gate:budgets` con CSS de 43,4 KB / 4 fuentes | exit 1 en ambos casos | **Cumplido** |

**Lo que NO cubre el Sprint 1, y no debe leerse como cumplido:** `RUI-70..74` están implementados
solo en la parte de `reset.css` (`prefers-reduced-motion`, foco visible); el resto llega con el
teclado del Sprint 3. `RUI-01..24` se han verificado estructuralmente (grid y jerarquía en el
markup), no por revisión de diseño con persona — el punto 4 del DoD por requisito (§13) queda
pendiente para cuando haya capturas que mirar. Sin tests unitarios: registrado como `TD-01` en
`BACKLOG.md`.

---

## 12 ter. Verificación ejecutada — Sprint 2 (Fuente de verdad y render SSR)

Mismo contrato que §12 bis: cada fila es un requisito con su comando y su número. `WIP` no es
"cumplido": el sprint sigue abierto hasta cerrar `TD-02` y desplegar.

| Requisito | Método | Comando | Resultado | Estado |
|---|---|---|---|---|
| `DEC-03.a` | T: un único origen; UI, JSON-LD y exportadores salen de `getCv()` | `pnpm build` | HTML + 4 exportadores desde el mismo documento | **Cumplido** |
| `RF-01` | T: 7 escenas, heading con id estable y un solo `h1` | `pnpm gate:ats` | 1 `h1` + 6 `h2`, ids `escena-00..06` | **Cumplido** |
| `RF-23` | T: fechas relativas + absolutas calculadas desde ISO | `pnpm test` + `pnpm build` | `formatRange`/`formatDuration` en las 7 escenas | **Cumplido** |
| `RF-24` | T: metadatos de escena generados del storyboard | `pnpm build` | timecodes e índices `00/07..06/07` en el markup | **Cumplido** |
| `RF-25` | T: sin marcadores de fixture en artefacto desplegable | `pnpm gate:placeholders` | 0 bloqueantes con datos reales | **Cumplido** |
| `RNF-33` | T: HTML semántico + JSON-LD `Person`/`Occupation` | `pnpm gate:ats` | 1 `h1`, 7 escenas, JSON-LD `Person` + `Occupation` | **Cumplido** |
| `RNF-100` | T: 4 exportadores estáticos en `dist/` | `pnpm gate:ats` | `cv.json`, `cv.jsonld`, `cv.md`, `cv.txt` | **Cumplido** (falta PDF: `RF-11`, Sprint 4) |
| `RND-08` | T: texto plano completo sin JS ni vídeo | `pnpm gate:ats` | `dist/cv.txt` no vacío | **Cumplido** |
| `TD-01` | T: tests unitarios de la lógica de presentación | `pnpm test` | 37 tests, 0 fallos | **Cumplido** |

**Lo que NO cubre el Sprint 2:** la divulgación progresiva (`RUI-30..37`, Sprint 4) todavía no
reduce el número de nodos visibles por escena, así que `TD-11` sigue abierto. El PDF es `RF-11`
(Sprint 4). La alineación de `packageManager` con `corepack` (`TD-02`) queda pendiente: el
entorno local trae pnpm 12.x y no trae `corepack`; el CI fija 10.4.1 vía `pnpm/action-setup`.

---

## 12 quater. Verificación ejecutada — Sprint 3 (Navegación, teclado y tema)

Gate principal: `pnpm gate:keyboard` (Playwright, job `keyboard` de CI). Resultado: **100 % de
los flujos**, 10 comprobaciones en verde.

| Requisito | Método | Comando | Resultado | Estado |
|---|---|---|---|---|
| `RF-02` | T: el rail marca la escena activa sin depender solo del color | `pnpm gate:keyboard` | `aria-current="true"` + peso + regla (`RUI-34`) | **Cumplido** |
| `RF-03` | T: clic en el rail navega y enfoca el heading | `pnpm gate:keyboard` | foco en `escena-04-titulo` tras el clic | **Cumplido** |
| `RF-04` | T: la URL refleja la escena; sin entradas de historial por scroll | `pnpm gate:keyboard` | `replaceState` + hash por escena | **Cumplido** |
| `RF-05` | T: `↑/↓`, `PageUp/PageDown`, `Home/End` mueven el foco entre escenas | `pnpm gate:keyboard` | 6 flujos de teclado verificados | **Cumplido** |
| `RF-06` | T: skip-link al primer `Tab` | `pnpm gate:keyboard` | primer `Tab` enfoca `.skip-link` | **Cumplido** |
| `RF-07` | T: sin JS el contenido y las 7 escenas se leen | `pnpm gate:keyboard` | 1 `h1`, 7 escenas, 7 enlaces de rail sin JS | **Cumplido** |
| `RF-09` | T: toggle de tema persistente sin flash | `pnpm gate:keyboard` | conmuta y persiste tras recargar | **Cumplido** |
| `RUI-81` | T: landmarks y un solo `h1` | `pnpm gate:keyboard` + `gate:ats` | `header/nav/main/footer`, 1 `h1` | **Cumplido** |

**Lo que NO cubre el Sprint 3:** el presupuesto de diseño por escena (`RUI-30..37`) y el
revelado de email (`RF-27`) son del Sprint 4. `RUI-83` (objetivo táctil) se cumple en el rail y
el toggle vía `--target-min`, pendiente de la medición por píxel de `MEDICION.md` §4.4.

---

## 12 quinquies. Verificación ejecutada — Sprint 4 (Divulgación progresiva y presupuesto)

Gate principal: `pnpm gate:saturation` (Playwright, job `keyboard` de CI). Resultado: 7 escenas
dentro de presupuesto; email y PDF verificados con `gate:keyboard`. Estado: `DONE`.

| Requisito | Método | Comando | Resultado | Estado |
|---|---|---|---|---|
| `RUI-30` | T: ≤ 29 nodos de contenido y ≤ 1.064 caracteres visibles por escena | `pnpm gate:saturation` | peor escena `escena-04` 29 nodos/846 car.; `escena-03` 26/1.064; techo = máximo medido con los desplegables abiertos (`ADR-0010`, antes 6/280) | **Cumplido** |
| `RUI-31` | T: el exceso va a un `<details>`, y se mide solo lo visible | `pnpm gate:saturation` | `checkVisibility()` + los 8 con `open` en el HTML construido | **Cumplido** (ya no colapsa: `ADR-0010`) |
| `RUI-52` | T: el presupuesto se verifica por Playwright, umbral numérico | `pnpm gate:saturation` | exit 0 con 29/1.064 | **Cumplido** |
| `RUI-37` | T: ninguna escena se recorta al abrir el detalle | `pnpm gate:saturation` (medición manual de alto) | `scrollHeight === clientHeight` en las 7; 0 px de desborde interno. 3 escenas miden más que `--scene-height` | **Parcial**: sin umbral de alto (`TD-13`) |
| `RF-13` | T: cada proyecto es un detalle colapsado con URL compartible | `pnpm gate:keyboard` | `#proyecto-<slug>` abre el detalle | **Cumplido** |
| `RUI-36` | T: un único elemento focal (el `<summary>`) por escena | `pnpm gate:saturation` | 1 acción por escena | **Cumplido** |
| `RF-27` | T: revelado de email sin el email en el HTML inicial | `pnpm gate:keyboard` con `PUBLIC_CONTACT_EMAIL` | botón real, `aria-expanded`, `mailto:` al revelar; email en 0 HTML, en 1 JS | **Cumplido** (`ADR-0006`) |
| `RF-11` | T: descarga en PDF (impresión) y texto plano | `pnpm gate:keyboard` + `/cv.txt` | botón `Descargar PDF` expande detalles e imprime; `/cv.txt` exporta | **Cumplido** |

**Lo que NO cubre el Sprint 4:** el resto del presupuesto `RUI-32..37` (acento por píxel,
opacidad de video, area en blanco) depende del video (Sprint 5) y de la medicion por pixel
(`MEDICION.md` §4.3/§4.4), que se cierra en el Sprint 10. El email se entrega por el bundle JS
(limite declarado en `ADR-0006`).

---

## 12 sexies. Trabajo adelantado — Seguridad (Sprint 9) y Rendimiento (Sprint 8)

El Sprint 5 (vídeo) está bloqueado por material externo (`ABR-05`). Por decisión del PO se
adelanta el trabajo que **no depende del vídeo** en los Sprints 8 y 9.

| Requisito | Método | Comando | Resultado | Estado |
|---|---|---|---|---|
| `RNF-62` / `SEG-02` | T: CSP con hash del script inline, sin `unsafe-eval`/`unsafe-inline` | `pnpm gate:security` | 1 hash inline recalculado; directivas exigidas presentes | **Cumplido** |
| `SEG-03` | T: `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP | `pnpm gate:security` | presentes y válidas en `_headers` + `vercel.json` | **Cumplido** |
| `SEG-05` | T: `frame-ancestors 'none'` (+ `X-Frame-Options: DENY`) | `pnpm gate:security` | presente | **Cumplido** |
| `RNF-63` / `SEG-01` | T: HSTS `max-age` + `includeSubDomains` + `preload` | `pnpm gate:security` | presente en ambas configs | **Cumplido** |
| `RNF-72` | T: `_headers` versionado y coherente con `vercel.json` | `pnpm gate:security` | las dos CSP coinciden | **Parcial** (sondeo HTTP del preview: Sprint 12) |
| `SEG-21` / `RNF-61` | T: auditoría de dependencias de producción | `pnpm audit --audit-level=high` | 0 vulnerabilidades | **Cumplido** |
| `RUI-17` / `RNF-10` | T/M: 3 woff2 self-hosted, ≤ 90 KB, ≤ 2 preloads | `pnpm gate:budgets` | **71,9 KB**, 3 ficheros, 2 preloads | **Cumplido** |
| `RNF-03` | T: CLS de lab sin regresión por `font-display: swap` | `pnpm medir:lab` | 0,0001 (obj. 0,02) | **Cumplido** |

**Pendiente de seguridad (depende del chat o del release):** `SEG-22` (SBOM CycloneDX en cada
release), `SEG-25`/`SEG-33..35`/`RNF-67/68/69` (chat: prompt server-only, rate limit, Turnstile,
privacidad), `SEG-23/24` (pesos del modelo), `SEG-44` (supresión). Sprint 9 completo se cierra
con el chat (Sprints 6-7) y el release (Sprint 12).

---

## 12 septies. Verificación ejecutada — Sprint 5 (Sistema de vídeo)

Gate principal: `pnpm gate:video` (Playwright). Resultado: 7 comprobaciones en verde con clips
provisionales. Los clips actuales son de 5 s (no los del storyboard), así que `RF-42` (continuidad
de corte) y `RUI-60.b` (timecodes = clips) quedan para el material definitivo.

| Requisito | Método | Comando | Resultado | Estado |
|---|---|---|---|---|
| `DEC-02.b` | T: un solo `<video>` en el DOM | `pnpm gate:video` | 1 `<video>` | **Cumplido** |
| `RF-40` | T: cada escena declara su clip | `pnpm gate:video` | 7/7 escenas con `data-clip` | **Cumplido** |
| `RF-41` | T: reproduce la escena activa y cambia de clip | `pnpm gate:video` | video1 → video2 al cambiar | **Cumplido** |
| `RF-10` | T: modo `off` deja el vídeo en pausa | `pnpm gate:video` | pausa tras `auto→on→off` | **Cumplido** |
| `RF-45` | T: controles manuales presentes | `pnpm gate:video` | toggle + pausa + reinicio | **Cumplido** |
| `RUI-74` | T: `prefers-reduced-motion` no reproduce | `pnpm gate:video` | poster, sin `play` | **Cumplido** |
| `RUI-95` | T: móvil ≤ 600 px → sin reproducción por defecto | `pnpm gate:video` + `video.ts` | `auto` no reproduce en ≤ 600 px | **Cumplido** |
| `RUI-96` | T: 1 clip activo; destruido al salir | `src/scripts/video.ts` | `removeAttribute('src')` tras 2 s fuera | **Cumplido** |
| `RNF-55` | T: si un clip falla, poster sin layout shift | `src/scripts/video.ts` | `error` → poster | **Cumplido** |
| `RNF-11` | M: poster ≤ 70 KB AVIF | `pnpm gate:budgets` | 14,3 KB máx. (7 posters, clips definitivos) | **Cumplido** |
| `RF-42` | T: clips sin audio; reproducen una vez y congelan el último frame (`ADR-0007`) | `ffmpeg -an` + `pnpm gate:video` | 7/7 sin audio; 1 vez + congelado; reinicio al volver al principio | **Cumplido** |
| `RNF-12` | M: primer segmento de vídeo ≤ 800 KB | `pnpm medir:estatico` | 437,8 KB / 800 KB (total 2,5 MB) | **Cumplido** |
| `RUI-60.b` | T: los timecodes corresponden a los clips | `pnpm build` | clips de 5,000 s; `storyboard.ts` y `SPEC.md` §5.9 alineados | **Cumplido** |

---

## 12 octies. Verificación ejecutada — Sprint 6 (Chat G1–G4, guardrails)

Gate principal: `pnpm gate:chat`. Resultado: **31/31 comprobaciones en verde**, más 41 asserts
unitarios en `pnpm test` sobre G1–G4. Sin proveedor de modelo: `ABR-01` sigue abierto, así que
lo verificado aquí es el **andamiaje de seguridad**, no la calidad de la respuesta (`CHA-30` es
del Sprint 7 y no se marca).

| Requisito | Método | Comando | Resultado | Estado |
|---|---|---|---|---|
| `CHA-01` | T: pregunta → recuperación acotada; nunca más de 8 chunks ni 3.000 chars | `pnpm gate:chat` + `tests/chat-guardrails.test.ts` | presupuesto respetado en todas las consultas | **Cumplido** |
| `CHA-02` | T: el corpus del chat se deriva de `buildChunks(cv)`, no está escrito a mano | `tests/chat-guardrails.test.ts` | `buildAllowlist` deriva de los chunks; id inexistente → `false` | **Cumplido** |
| `CHA-03` | T: la allowlist la fija el servidor; el cliente no envía ids de chunk | `pnpm gate:chat` | `chatRequest` es `.strict()`: una clave extra → 400 | **Cumplido** |
| `CHA-04` | T: G1 recorta a 500 chars en vez de rechazar | `tests/chat-guardrails.test.ts` | 900 chars → `ok: true`, 500 exactos | **Cumplido** |
| `CHA-05` | T: toda cita de la respuesta existe en la allowlist | `pnpm gate:chat` | cita inventada → `cita-no-permitida` | **Cumplido** |
| `CHA-06` | T: sin contexto suficiente se dice "no consta en el CV" | `pnpm gate:chat` | pregunta de bitcoin → `No consta en el CV.`, sin proveedor | **Cumplido** |
| `CHA-07` | T: la respuesta no supera 700 caracteres | `tests/chat-guardrails.test.ts` | truncada con `…` + aviso `truncada` | **Cumplido** |
| `CHA-20` | T: fuera de alcance se responde con texto fijo, **sin** llamar al modelo | `pnpm gate:chat` | `reason: fuera-de-alcance`, proveedor inyectado que lanza → nunca llamado | **Cumplido** |
| `ABR-01` | T: el proveedor elegido responde y la clave no sale del servidor | `pnpm gate:chat` + `SEG-25` | `MODEL_PROVIDER=groq` → `groq`; sin clave → `off`; valor inventado → error; 0 fugas en 7 assets | **Cumplido** (`ADR-0009`) |
| `RNF-68` | T: el límite por IP corta en la petición 11 y es por IP, no global | `tests/chat-proveedor.test.ts` | 10/min por IP; `.55` agota, `.57` sigue con 200; `x-forwarded-for` toma el primer salto | **Parcial**: falta `Retry-After` y cuota diaria |
| `CHA-31` | T: el fallback no puede filtrar los canarios de `G2` | `tests/chat-proveedor.test.ts` | respuesta de `off` → `ok: true`, sin canarios ni `BEGIN CV DATA` | **Cumplido** |
| `CHA-34` | T: pregunta en plural encuentra el chunk en singular | `tests/chat-proveedor.test.ts` | 8 chunks por sección; `¿Dónde estudió?` casa con formación | **Cumplido** |
| `CHA-36` | T: el modelo puede devolver `[id]` y el servidor lo normaliza | `tests/chat-proveedor.test.ts` | `"[stack]"` → cita `stack` válida; `"[inventado]"` → rechazada | **Cumplido** |
| `CHA-37` | T: `gpt-oss` manda `reasoning` y `content` por separado; solo `content` es la respuesta | `tests/chat-proveedor.test.ts` | `fetch` simulado: el razonamiento no aparece en la salida y G4 acepta el `content`; `content` vacío → error, no respuesta vacía | **Cumplido** |
| `CHA-21` | T: ventana de tasa por instancia, por sesión **y** por IP | `pnpm gate:chat` + `tests/chat-proveedor.test.ts` | sesión 12/min (la 13.ª → 429); IP 10/min (la 11.ª → 429) y otra IP sigue con 200 | **Cumplido** (best-effort, no cuota: `TD-12`) |
| `CHA-22` | T: opinión personal y consejo vital se rechazan como fuera de alcance, no como insulto | `tests/chat-guardrails.test.ts` | "¿me recomiendas Rust?" → `out_of_scope`; "eres idiota" → `abusive` | **Cumplido** |
| `SEG-11` | T: el corpus lo elige el servidor; los ids de chunk no se pueden pedir | `tests/chat-guardrails.test.ts` | `isAllowed('experiencia.<inventado>')` → `false` | **Cumplido** |
| `SEG-20` | T: origen ajeno, método, tamaño de cuerpo y formato | `pnpm gate:chat` | 403 / 405 / 413 / 400 | **Cumplido** |
| `SEG-25` | T: ninguna firma del prompt ni canario llega a un asset de navegador | `pnpm gate:chat` | 0 fugas en 7 assets; detector autocomprobado | **Cumplido** |
| `SEG-31` | T: el email `private` no aparece en ninguna respuesta | `pnpm gate:chat` | respuesta con el email inyectado → rechazada; 0 apariciones | **Cumplido** |
| `SEG-35` | T: PII redactada en entrada y rechazada en salida | `pnpm test` + `pnpm gate:chat` | email/NIF/IBAN → `[redactado]` y `pii-en-salida` | **Cumplido** |
| `CHA-31` | T: un canario en la salida se rechaza, sin margen | `pnpm gate:chat` | `reason: canario`; el canario no aparece ni en el motivo | **Cumplido** |
| `CHA-34` | T: citas consistentes entre turnos | `pnpm gate:chat` | desempate por sección e id: misma pregunta → mismos chunks | **Cumplido** |
| `CHA-36` | T: respuesta larga se trunca; por encima del tope duro se rechaza con su motivo | `tests/chat-guardrails.test.ts` | 1.200 chars → truncada; 8.000 → `demasiado-larga` | **Cumplido** |
| `CHA-37` | T: confianza baja con contenido afirmativo deriva a no consta | `tests/chat-guardrails.test.ts` | `low` + > 120 chars → `confianza-baja` | **Cumplido** |
| `RNF-88` | T: el hash del prompt cambia si cambia el corpus o la pregunta | `tests/chat-guardrails.test.ts` | 3 prompts → 3 hashes | **Cumplido** |
| `ADR-0008` | T: el sitio sigue prerenderizado con el adaptador puesto | `pnpm gate:chat` | `index.html` + 4 exportadores en `dist/client`; función server compilada | **Cumplido** |
| `RNF-33` | T: el HTML sigue siendo estático y parseable | `pnpm gate:ats` | ver §12 quater (sin cambio con el adaptador) | **Cumplido** |
| `ABR-01` | T: un `MODEL_PROVIDER` desconocido falla ruidosamente, no cae a `off` | `pnpm gate:chat` | 502 con texto fijo | **Cumplido** (la elección del modelo sigue abierta) |

### Qué **no** cubre este sprint

- `CHA-30` (tasa de fuga real ≤ 1 %), `CHA-32` (coste por turno) y `CHA-33` (latencia p95) **no se
  pueden medir sin modelo**: son el Sprint 7 con eval set. Marcar el Sprint 6 `DONE` no los
  declara cumplidos.
- La ventana de tasa es por instancia y el identificador lo pone el cliente: mitiga un bucle
  torpe, no a un atacante distribuido. Está escrito en el código y aquí.
- No hay interfaz: el Sprint 6 construye y verifica el endpoint, no la escena de chat. `RF-50`
  cubre la ruta; la UI del chat entra en `RF-51..58` (Sprint 7).

---

## 13. Definición de Hecho (DoD) por requisito

Para que un requisito pase a "cumplido" en la matriz:

1. **Código** implementado y revisado.
2. **Test en CI** en verde con el método de la columna de verificación.
3. **Entrada en esta matriz** con el ID y el método exactos.
4. **Revisión de diseño** si es un requisito `RUI` (y no solo "pasa el axe").
5. **ADR** si el requisito relaja un budget o cambia una decisión de §2.

Un requisito sin el punto 3 no cuenta. La matriz se actualiza en el mismo PR que implementa el requisito.
