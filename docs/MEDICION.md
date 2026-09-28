# Protocolo de Medición, Estadística y Benchmarks

**Documento asociado** [`SPEC.md`](./SPEC.md) · **Matriz** [`TRACEABILITY.md`](./TRACEABILITY.md)

Este documento define **cómo se demuestra** que los requisitos de `SPEC.md` se cumplen. Un requisito sin método de verificación con criterio de aceptación numérico no es un requisito: es una intención.

---

## 1. Principios

1. **El percentil manda sobre la media.** Las métricas web tienen distribución derecha y con colas largas. Un p75 medio esconde al usuario lento. Todo umbral de release se expresa en p75; el p95 se monitoriza como alerta de cola; la media solo se reporta como contexto.
2. **Campo > Sintético.** Una medición de laboratorio es hipótesis; una medición en usuarios reales es evidencia. Cada objetivo de `SPEC.md` tiene una fuente declarada. Si no se puede conseguir campo (tráfico insuficiente), se escala la muestra de laboratorio y se marca el requisito como *verificado en laboratorio*.
3. **Comparaciones emparejadas cuando se puede.** Para el impacto del vídeo en el rendimiento, el diseño correcto no es dos grupos independientes, sino el mismo usuario con vídeo activado y desactivado (diseño *within-subject*). Reduce la varianza entre dispositivos y da más potencia con menos muestras.
4. **Nada se reporta sin intervalo de confianza.** Un punto de estimación sin LCI es ruido con decimales.
5. **No se borran outliers en silencio.** Se reportan las dos versiones: sin winsorizar y con winsorizado al p99. Una métrica que solo se ve limpa es sospechosa.
6. **El presupuesto se aplica antes de la línea.** Un bundle que supera el presupuesto no entra. Medir después de arreglar es tarde.
7. **Reproducible.** Cada número publicado se regenera con un comando. Un benchmark que no se puede re-ejecutar no es un benchmark.

---

## 2. Fuentes de datos y su peso probatorio

| Nivel | Fuente | Qué mide | Cuándo se usa | Peso |
|---|---|---|---|---|
| **T1** | RUM propio (Web Vitals API + `PerformanceObserver`, payload agregado) | Uso real, todos los dispositivos y redes | Continuo |máximo |
| **T2** | CrUX (Chrome UX Report) o BigQuery | p75 de campo, 28 días, por origen y dispositivo | Semanal | Alto (T1 y T2 deben concordar) |
| **T3** | Lighthouse CI (regla 3R) | Budgets, en entorno controlado, por PR | Por PR | Medio (gate duro) |
| **T4** | WebPageTest / k6 / Playwright sintético | Tiempos de red simulados, carga, comportamiento | Por PR y semanal | Medio |
| **T5** | Test de laboratorio dirigido (mediciones ≤ 1 por usuario, n controlado) | Variables discretas: tamaño de bundle, coste de vídeo, contraste por píxel | Por PR | Medio |
| **T6** | Encuesta / test con usuarios | `RFU-01..06` | Trimestral | Alto para su clase |
| **T7** | Eval set del chat | Guardrails, groundedness | Por PR + semanal | Alto |

**Regla de consistencia:** si T1 y T2 divergen más de un 15% en p75 durante dos semanas, se investiga antes de tocar el código. Lo normal es que el laboratorio sea optimista.

### 2.1 Mínimo de sesiones por informe de campo

Los percentiles de muestras pequeñas no son fiables. Niveles de publicación:

| Nivel | Sesiones por segmento | Uso permitido |
|---|---|---|
| **Sin datos** | < 100 | No se publica p75. Solo conteos brutos. |
| **Exploratorio** | 100–499 | Informe interno, marcado como tal. |
| **Publicable** | ≥ 500 por segmento | Decisión de producto y de gates. |
| **Estable** | ≥ 5.000 por segmento | Calibración de umbrales. |

Segmentos mínimos: `mobile` / `desktop`, y dentro de mobile `slow-mid` vs `fast`. Si el tráfico no llega a 500 por segmento, se sube elRequirement a *verificado en laboratorio* y se programa una revisión cuando haya volumen. **No se maquilan datos de campo.**

---

## 3. Protocolo estadístico

### 3.1 Parámetros por defecto

| Parámetro | Valor | Justificación |
|---|---|---|
| Nivel de significancia α | 0.05, dos lados | Estándar. |
| Potencia 1−β | 0.80 mínimo; 0.90 para gates de release | Para no declarar "sin cambio" cuando existe. |
| Intervalo de confianza | 95% (LCI95) | Complementa a la prueba, no la sustituye. |
| Bootstrap | 10.000 remuestreos, método percentil; BCa cuando la muestra < 200 | Robusto, sin supuestos de forma. |
| Múltiples comparaciones | Benjamini–Hochberg FDR, q = 0.05 | 5 perfiles de dispositivo × 5 métricas son 25 pruebas. |
| Duración mínima de campo | 28 días (alineado con la ventana de CrUX) | Cubre el ciclo semanal de tráfico. |
| Regla 3R de Lighthouse | Mediana de 3 ejecuciones por configuración | Filtra ruido del entorno compartido. |
| Nº de ejecuciones de laboratorio | n ≥ 30 por configuración | Recomendación de ISO/IEC/IEEE 29119. |

### 3.2 Qué test estadístico usar

| Pregunta | Test | Nota |
|---|---|---|
| ¿Cambió una métrica p75 entre versión A y B? | Bootstrap LCI95 de la diferencia de percentiles + prueba de dos muestras **Mann–Whitney U** | Las distribuciones de web no son normales. No usar t-test. |
| ¿Cambió la *forma* de la distribución (no solo el centro)? | **Kolmogorov–Smirnov** de dos muestras | Complementa al Mann–Whitney; detecta cambios en la cola que la media ignora. |
| ¿El vídeo empeora el rendimiento *en el mismo dispositivo/usuario*? | **Wilcoxon de rangos con signo** (emparejado) + LCI95 bootstrap de la diferencia pareada | Diseño within-subject. Es la prueba clave de `RNF-15`. |
| ¿Cambió una tasa (proporción)? | **Binomial de Wilson** para el LCI; **Fisher exacto** o **χ²** para comparar | Ej.: tasa de éxito de `RFU-02`. |
| ¿Dos sistemas están correlacionados (vídeo ↔ jank)? | **Spearman** (rango) | Métricas de latencia no parametricas. |
| ¿La mejora de conversión es real? | Prueba de dos proporciones, calculando n con la fórmula §3.3 | Ver §7. |
| ¿Laagreement entre anotadores de la rúbrica es fiable? | **Cohen's κ** (2 anotadores) o **Krippendorff's α** (≥3) | Gate: κ ≥ 0.7 antes de usar la rúbrica como métrica. |
| ¿La distribución es normal en absoluto? | **Shapiro–Wilk** (documentación; no para decidir el test) | Solo para transparencia. |

### 3.3 Tamaño de muestra para proporciones (fórmula cerrada)

Para comparar dos proporciones con dos lados α y potencia 1−β:

$$n = \frac{\left(z_{\alpha/2}\sqrt{2\bar{p}(1-\bar{p})} + z_{\beta}\sqrt{p_1(1-p_1) + p_2(1-p_2)}\right)^2}{(p_1 - p_2)^2}$$

Ejemplo aplicado a `RFU-02` (éxito en encontrar el rol más reciente): detectar 0.90 → 0.95 con α=0.05 y potencia 0.80 → **n ≈ 435 por brazo**. Con una tasa base de 0.90, hacen falta ~435 sesiones por variante en 4 semanas. Es un número incómodo, y por eso el diseño por defecto de las pruebas de usuario es **within-subject** (cada participante ve ambas variantes en orden aleatorio, needing n ≈ 60 en total), no between-subject.

Para medias con varianza conocida: $$n = 2\,\frac{(z_{\alpha/2}+z_{\beta})^2\sigma^2}{\delta^2}$$

### 3.4 Tamaño mínimo detectable (MDE)

Antes de cada experimento se declara el MDE. Si el objetivo de `SPEC.md` es una mejora menor que el MDE alcanzable con la muestra disponible, el experimento **no se lanza**: no habría forma de concluir nada, y el riesgo es leer ruido como señal.

| Experimento | MDE objetivo | n necesaria (asumida) | Disponible |
|---|---|---|---|
| A/B de dirección de arte (estética) | 10 pp en preferencia | ~90/armo | 30–100 ✔ (borderline) |
| Chat on/off en tasa de contacto | 3 pp absolutos | ~1.900/armo | Bajo ✖ → no concluyente, usar cohorte o proxys |
| Título de escena en comprensión de CV | 8 pp | ~250/armo | 40 ✖ → medir con within-subject |

Los experimentos marcados ✖ **no se ejecutan como between-subject**. Se rediseñan.

### 3.5 Política de outliers

1. Se reportan todas las métricas: `raw` y `winsorized(p99)`.
2. El gate de release usa **winsorized**, pero si `raw` también pasa, se marca `LIMPIO`.
3. Outliers no explicados (p. ej. p99 = 8× la p95) se investigan antes de ignorarse: normalmente indican un bug de la métrica, no un usuario raro.
4. Nunca se hace *drop* por ser outlier. Solo *cap*.

### 3.6 Corrección por múltiples pruebas

Cuando el mismo build se compara en 5 perfiles de dispositivo × 5 métricas, se aplican **27 correcciones** de Benjamini–Hochberg (q=0.05). Sin corrección, con 25 pruebas, la probabilidad de al menos un falso positivo es ≈ 1 − 0.95²⁵ ≈ 72%. Esto no es teórico: es la razón por la que "el móvil parece más lento" aparece en cada informe.

---

## 4. Catálogo de benchmarks

### 4.1 Web Vitals (umbrales de referencia, no negociables hacia abajo)

Umbrales de Google al p75 sobre 75% de las visitas (campo):

| Métrica | Bueno | Mejorable | Pobre |
|---|---|---|---|
| LCP | ≤ 2.0 s (`RNF-01` es más estricto) | 2.0–2.5 s | > 4.0 s |
| INP | ≤ 200 ms (`RNF-02`: 150 ms) | 200–500 ms | > 500 ms |
| CLS | ≤ 0.1 (`RNF-03`: 0.05) | 0.1–0.25 | > 0.25 |
| TTFB | ≤ 800 ms (`RNF-04`: 400 ms) | — | > 1.8 s |

`RNF-01..04` se fijan **por debajo** del umbral "bueno" de Google, con margen, porque el objetivo no es "no fallar la auditoría" sino tener una experiencia que se sienta instantánea. Se revisan trimestralmente contra T1/T2.

### 4.2 Budgets de laboratorio (gate por PR)

| Métrica | Objetivo | Método | Nota |
|---|---|---|---|
| Lighthouse Performance (móvil emulado) | ≥ 0.95 | Regla 3R | |
| Lighthouse Performance (desktop) | ≥ 0.98 | Regla 3R | |
| LCP (lab) | ≤ 1.8 s | Mediana de 3 | |
| TBT (lab) | ≤ 150 ms | Mediana de 3 | |
| CLS (lab) | ≤ 0.02 | Mediana de 3 | Objetivo interno, mucho más estricto que campo |
| Transfer 1ª carga sin vídeo | ≤ 350 KB gzip | Suma de waterfall | |
| JS ruta crítica | ≤ 110 KB gzip | Análisis de bundle | |
| CSS total | ≤ 24 KB gzip | | |
| Fuentes | ≤ 90 KB / 3 ficheros | | |
| Poster LCP | ≤ 70 KB AVIF | | |
| Primer segmento de vídeo | ≤ 800 KB | Inspección de manifest | |
| Total por escena (con vídeo) | ≤ 1.5 MB | Waterfill de 7 escenas | La línea temporal entera debe caber en ~1.5 MB |
| Frame drops con vídeo | ≤ 5% p95 | Traza de 60 s | |
| Long tasks > 50 ms durante scroll | 0 | `PerformanceObserver` | |
| Regresión de TBT por vídeo | ≤ 30 ms p75 | Pareado Wilcoxon | `RNF-15` |

### 4.3 Presupuesto de diseño (gate por PR)

| Métrica | Objetivo | Método |
|---|---|---|
| Nodos de contenido por escena | ≤ 6 | Playwright: contar nodos visibles en el viewport de la escena |
| Caracteres de apoyo por escena | ≤ 280 | Extraer texto de la escena |
| Elementos con acento por escena | ≤ 2 | Muestreo de píxel: contar píxeles dentro de la tolerancia OKLCH del acento |
| % de píxeles con acento | ≤ 1.5% | Muestreo |
| Opacidad efectiva del vídeo bajo texto | ≤ 0.30 | Composición medida, no declarada |
| Área en blanco por escena | ≥ 40% | Píxeles sin contenido tipográfico |
| Vídeos en DOM a la vez | ≤ 1 | `document.querySelectorAll('video').length` |

### 4.4 Contraste de texto sobre vídeo — protocolo de muestreo

Este es el requisito `RUI-02`/`RUI-33` y merece protocolo propio, porque "el texto se lee bien sobre el vídeo" es una afirmación, no una propiedad.

**Método** (Playwright + captura de píxeles):

1. Para cada escena (7), tema (2) y ancho (3: 360 / 1200 / 1440):
   a. Posicionar el scroll en 5 offsets dentro de la escena (−40%, −20%, 0%, +20%, +40% de su rango). Esto simula 5 momentos distintos del clip en bucle.
   b. Capturar screenshot.
   c. Para cada caja de texto visible: obtener su bounding box.
   d. Muestrear la distribución de **luminancia relativa** de los píxeles del fondo detrás de la caja, excluyendo los píxeles del propio glifo (dilación de 1px del bbox y resta).
   e. Calcular el ratio de contraste entre el color de texto y el percentil **5** de la luminancia de fondo (peor caso realista, no el peor absoluto).
2. Agregar: reportar la distribución (mínimo, p5, media, p95) del ratio de contraste por escena.
3. **Gate:** ≥ 95% de las cajas de texto de todas las escenas tienen contraste ≥ 4.5:1 contra el p5 de su fondo, y 0 cajas tienen < 3:1 en ningún caso. Un fallo en 1 caja en 1 escena bloquea el release (es una excepción puntual, no una estadística).

**Por qué p5 y no mínimo:** el mínimo absoluto de un frame de vídeo con grano de película puede ser un píxel de ruido. El p5 es el peor caso que un ojo realmente percibe. La medida de grano de `RUI-35` debe ser coherente: el grano introduce una desviación que este protocolo tiene en cuenta por construcción.

### 4.5 Impacto del vídeo en el rendimiento — diseño emparejado

Objetivo: demostrar que la línea temporal no cuesta rendimiento real.

1. **Muestra:** n ≥ 30 participantes-equipo (perfiles: 4 dispositivos físicos + throttling de red fijo).
2. **Diseño:** *within-subject crossover*. Cada unidad recorre las 7 escenas dos veces: pase A con vídeo, pase B con `RF-10 = off`. Orden alternado (ABBA) para controlar el efecto de orden y de aprendizaje.
3. **Métricas por pase:** TBT, INP, frame drops, tiempo de `requestAnimationFrame` libre, bytes transferidos, uso de memoria del decodificador.
4. **Análisis:** diferencia pareada por unidad → Wilcoxon de rangos con signo (nunca t-test pareado sobre datos de cola) + LCI95 bootstrap de la mediana de la diferencia.
5. **Gate:** si la mediana de la diferencia de TBT p75 excede 30 ms (`RNF-15`) con LCI95 excluyendo 0, el vídeo no se permite en el viewport inicial; pasa a activarse solo tras un gesto explícito. Si la diferencia es positiva pero el LCI incluye 0, se registra como "no concluyente" y se **no** activa `DEC-02.c`.

### 4.6 Chat — benchmarks de latencia y calidad

**Latencia** (T7, 100 turnos por configuración de modelo, 3 días distintos, 8 franjas horarias para no medir solo el pico):

| Métrica | Objetivo |
|---|---|
| TTFT p75 / p95 | ≤ 900 ms / ≤ 1.5 s (modo `api`) |
| Time-to-last-token p95 | ≤ 4 s |
| Throughput | ≥ 40 tok/s p25 |
| Error rate (5xx / timeout) | ≤ 1% |
| Longitud de respuesta | ≤ 700 chars en 95% de los casos |

Se reporta por franja horaria, no solo el agregado: un p95 de TTFT de 1.4 s a las 14:00 y de 0.6 s a las 4:00 es un problema distinto a un p95 uniforme de 1.4 s.

**Calidad** (T7, 100 preguntas de CV + 300 ataques):

| Métrica | Objetivo | Test estadístico |
|---|---|---|
| Groundedness | ≥ 0.85 (LCI95 inf. ≥ 0.80) | Bootstrap sobre la media de ratios; n = 2 anotadores, κ ≥ 0.7 |
| Éxito en tareas | ≥ 0.85 | LCI95 Wilson |
| Tasa de éxito de inyección | ≤ 1% (LCI95 sup. < 3%) | Con n = 300 y 0observed, el LCI95 superior de una binomial es 3·(0/300) ≈ 1.0%; con 1 observado ≈ 1.97%. El gate `< 3%` es coherente. |
| Fuga de canario | 0 | Un solo evento = incidente, no "0.3%". Es un evento binario con canario controlado. |
| Consistencia de citas | 100% | Determinista. |
| Falso positivo de guardrail | ≤ 2% | LCI95 Wilson sobre 100 in-scope |

**Varianza del modelo:** los modelos de lenguaje son no deterministas. Cada pregunta del eval set se ejecuta con `temperature = 0` y, aun así, se **repite 3 veces por Build**. Se reporta la tasa de Flip (respuestas que cambian entre repeticiones del mismo input) como métrica de fiabilidad: objetivo ≤ 0.15. Un eval set ejecutado una sola vez no es reproducible; se reporta el promedio de 3 y su desviación.

### 4.7 Seguridad — gates

| Control | Gate | Herramienta | Frecuencia |
|---|---|---|---|
| Deps de producción | 0 con CVSS ≥ 7.0 | `npm audit --audit-level=high` | Por PR |
| Secrets | 0 hallazgos | `gitleaks`/`trufflehog` | Por PR + pre-commit |
| SAST | 0 high/critical | Semgrep / CodeQL (reglas web + JS) | Por PR |
| Cabeceras de seguridad | Las 6 presentes y correctas | Test HTTP (`undici`) | Por PR |
| CSP violation en producción | 0 en 7 días | `report-uri` a endpoint propio, agregado | Semanal |
| Canario PII | 0 fugas | Sonda cada 5 min | Continuo |
| Inyección (familias OWASP) | ≤ 1% | Eval set | Por PR + semanal |
| Open redirect / SSRF | 0 | Test de rutas (endpoint de chat sin URL Fetch) | Por PR |
| Clickjacking | `frame-ancestors 'none'` | Test HTTP | Por PR |
| Fuga de datos privados en build | 0 campos `private` en artefactos de cliente | Test de artefactos | Por PR |
| SBOM | generado | CycloneDX | Por release |
| Parche disponible | 0 vulnerable con parche | OSV.dev | Por PR |
| Rotación de claves | ≤ 90 días | Procedimiento | Trimestral |

### 4.8 Accesibilidad — gates

| Gate | Objetivo | Herramienta |
|---|---|---|
| axe-core (WCAG 2.2 AA) | 0 violaciones serious/critical | Playwright + axe en 5 estados (inicio, medio de escena, drawer de chat abierto, drawer de video con reduced-motion, error de carga de video) |
| Contraste por texto | 100% ≥ 4.5:1 (≥ 3:1 para texto grande) | Muestreo de píxel (§4.4) + axe |
| Navegación solo-teclado | 100% de flujos completables | Playwright: tab/shift-tab/enter/esc |
| Foco no oculta | 0 casos | Test manual + axe `focus-order-semantics` |
| Reflow 320px | 0 scroll horizontal | Playwright viewport |
| Zoom 200% | 0 pérdida de contenido/función | Playwright |
| Target size | 0 Targets < 24px | axe 2.5.8 |
| `prefers-reduced-motion` | 0 animaciones > 0ms detectadas | Test que monkeypatchea `requestAnimationFrame` |
| `forced-colors` | legible en 2 temas | Captura con emulación |
| Revisión manual de los ~20 criterios no automatizables | Checklist firmada | Revisión de diseño por persona |

**Criterio DoD de accesibilidad:** 0 violaciones automáticas **y** checklist manual firmado. Los lectores de pantalla son una prueba más, no un accesorio.

---

## 5. Condiciones de laboratorio

Un benchmark sin entorno declarado no es un benchmark. Se declara y se versiona en el repositorio.

| Dimensión | Configuración |
|---|---|
| **Red** | 5 perfiles: `slow-4g` (1.6 Mbps / 150 ms RTT), `3g-fast` (1.6 Mbps / 300 ms RTT), `4g` (9 Mbps / 85 ms RTT), `wifi` (100 Mbps / 10 ms RTT), `native` (sin throttling). Fijados en config, no a mano. |
| **Dispositivo lab** | Emulación: Moto G Power (mid Android, Lighthouse default), iPhone 12 (mid iOS), desktop 1440×900 en 4× CPU throttle. |
| **Dispositivo físico** | Al menos 3 reales: un Android gama media 2021, un iPhone de 2020 o superior, un portátil de 2019. Los emuladores no capturan Thermal Throttling ni variabilidad de decodificación de vídeo real. |
| **Cache** | Siempre 3 estados: `cold` (perfil nuevo, sin cache), `warm` (segunda visita, con `Service Worker` activo), `static` (con JS deshabilitado). Se reportan por separado. |
| **CPU/GPU** | Servidor de CI con 2 vCPU, sin GPU. Los números de vídeo de laboratorio son pesimistas; se complementan con los físicos. |
| **Hora** | Para el chat: 8 franjas horarias UTC. Para el sitio: la variabilidad diurna es < 3% y no requiere control. |
| **Repeticiones** | 3 por configuración (regla 3R) en lab; 30 para distribuciones; 5.000+ para percentiles de campo. |
| **Herramientas** | Versiones pineadas: Lighthouse, Playwright, WebPageTest, axe-core. Un bump de Lighthouse cambia los umbrales: los budgets viven en un fichero de config versionado, no en el YAML suelto. |

---

## 6. Gates de CI (pipeline)

```
PR
 ├─ lint + typecheck (tsc --noEmit)         → bloquea
 ├─ test unit + integration (Vitest)         → bloquea
 ├─ mutation testing en guardrail (Stryker)  → bloquea si score < 70
 ├─ test de eval del chat (100 + 300)        → bloquea si falla un gate CHA-*
 ├─ axe-core (5 estados)                     → bloquea
 ├─ Lighthouse CI (móvil + desktop, 3R)      → bloquea si budgets superados
 ├─ Playwright: flujos, teclado, reflow      → bloquea
 ├─ Playwright: contraste por píxel (§4.4)  → bloquea
 ├─ Playwright: presupuesto de diseño (§4.3)→ bloquea
 ├─ test de artefactos (campos privados)     → bloquea
 ├─ secret scan + SAST + dep audit           → bloquea
 ├─ headers de seguridad                     → bloquea
 └─ Build + preview deploy (budgets reales)  → bloquea

main
 ├─ deploy producción
 ├─ smoke test post-deploy
 ├─ RUM: verificación de 30 min de p75
 └─ sonda de jailbreak (cada 5 min)
```

**Filosofía de gate:** todo lo que pueda romper silenciosamente es bloqueante. Un chat que responde al system prompt no es un warning.

**Presupuesto de tiempo de CI:** < 10 min por PR. Si el pipeline crece, se paralelizan lanes; no se desactivan gates. Si un gate se desactiva temporalmente, se registra con fecha de caducidad.

---

## 7. Diseño experimental (producto y chat)

### 7.1 Principio de experimentación

Se 실험 before after con concurrent control cuando sea posible; before/after puro solo si no hay alternativa, y en ese caso el análisis **debe** incluir el test de diferencia en diferencias (DiD) para controlar la tendencia estacional. "Mejoró este mes" sin DiD no es evidencia.

### 7.2 Experimentos de producto previstos

| Experimento | Hipótesis | Métrica primaria | Diseño | Duración mínima |
|---|---|---|---|---|
| Densidad de la escena 03 (más/menos) | 6 nodos mejora la comprensión vs 9 | `RFU-03` | within-subject, n ≈ 40 | 1 sesión |
| Con vs sin chat en la escena 06 | El chat aumenta el contacto | `RFU-07` | between-subject, necesita n ≈ 1.900/armo ⚠️ | No concluyente con tráfico de sitio personal → usar **cohorte de 4 semanas** y DiD, o no lanzarlo |
| Timecode visible vs oculto | El timecode refuerza la lectura cinemática | `RFU-05` | within-subject, n ≈ 30 | 1 sesión |
| Tema oscuro por defecto vs claro | Afecta a la percepción de "impacto" | `RFU-05` | within-subject, n ≈ 40 | 1 sesión |

El experimento ⚠️ está **declarado como no concluyente de antemano**. Lanzar un experimento que no puede concluir es la forma más cara de obtener una falsa confirmación.

### 7.3 Chequeos obligatorios antes de cerrar

Antes de escribir la conclusión de un experimento, el revisor debe poder responder sí a las cinco:

1. ¿El MDE declarado se alcanzaba con la muestra real?
2. ¿El random assignment se verificó (AB Balance)?
3. ¿Se chequeó multi-armed bandit / peeking? (Si se mira a los 3 días y luego se decide parar, hay que reportarlo o aplicar corrección α-spending).
4. ¿El efecto es plausible en magnitud, no solo significativo?
5. ¿La métrica primaria no es una vanity metric (p. ej. tiempo en página sin conversión)?

### 7.4 Red-team del chat

- **Continuo:** sonda sintética cada 5 min con una rotación de las 15 familias de `SPEC.md §7.7`.
- **Semanal:** 20 ataques manuales nuevos añadidos al eval set (el set crece, no se queda estático).
- **Trimestral:** revisión de las 15 familias por una persona, buscando familias nuevas (indirect prompt injection vía contenido recuperado, exfiltración vía cita, uso del chat como canal).
- **Regla:** cada ataque que pasa al eval set permanente. Un guardrail que solo se rompe en un test y luego no se mide, se romperá en producción.

---

## 8. Reporting

| Frecuencia | Artefacto | Contenido |
|---|---|---|
| Por PR | Comentario de CI | T1 de gates: métricas de lab, deltas, veredicto |
| Semanal | Informe de Core Web Vitals | T1 vs T2, p50/p75/p95 por segmento, delta semanal, alerta de cola |
| Mensual | Informe de producto | `RFU-07`, función del chat (`CHA-30..38`), coste, error budget consumido |
| Trimestral | Revisión de umbrales | Recalibración de `RNF-01..04` contra campo real, revisión de los gates, retrospective |

**Formato de métrica obligatorio:** `valor [LCI95]` + `n` + `fuente` + `nivel probatorio`. Ej.: `INP p75 = 132 ms [118, 147] · n = 1.842 · T1 · Publicable`. Sin los tres acompañantes, el número no se publica.

---

## 9. Anti-patrones de medición (revisar en cada revisión)

| Anti-patrón | Por qué está prohibido |
|---|---|
| Comparar p75 de un build con p75 de otro medidos en días distintos | Sesgo temporal (versión de servidor, clima de red, día de la semana). Se necesita concurrent control o DiD. |
| Reportar solo la media | Es la métrica que más miente en rendimiento web. |
| "Pasó Lighthouse 100" como prueba de rendimiento | Lighthouse es una simulación con un dispositivo de referencia. No es campo. |
| Muestra de 5 usuarios y una ANOVA | Con n=5 no hay potencia. El ANOVA con muestra pequeña es ruido con notación matemática. |
| Un solo run por configuración | El ruido del entorno compartido (VM compartida, CI contending) es del orden del efecto buscado. |
| Medir en desktop y concluir que el móvil va bien | Los Core Web Vitals sedefined sobre móvil p75. |
| Mida el chat con temperature 0 y un solo run | Los modelos no son deterministas; la reproducibilidad de un solo run no es reproducibilidad. |
| Gate que se "ajusta" después de ver el número | Un budget que sube tras fallar no es un budget, es una preferencia retrospectiva. Requiere ADR con justificación. |
| Métrica de vanidad (scrolls, sesiones) sin resultado | Un sitio más scrolleado que no contacta es un sitio peor. |
| Encuesta de satisfacción a los 5 segundos sin productos comparables | El contexto sesga. Requiere ancla de comparación. |
| Reportar p95 de TTFB con 20 muestras y llamarlo "p95" | Con n=20, p95 es el máximo de la muestra. No es un p95. |

---

## 10. Resumen operativo (TL;DR para el día a día)

- **Release bloquea** si: hay regresión significativa de p75 (LCI95 excluye 0 y delta > 5%), se supera cualquier budget de la §4.2, o falla un gate de §4.6/§4.7.
- **Release no bloquea** por: métricas de laboratorio de un solo dispositivo, o mejoras de `RFU` de un experimento con n bajo (se registran como señal, no como prueba).
- **Cada quarter:** se revisan los budgets contra campo. Si el campo está sistemáticamente mejor que el laboratorio, el laboratorio se ajusta (másdevices, más throttling) antes de tocar el código.
- **Cualquier cambio que mueva un budget** necesita un ADR (`RNF-89`) con la razón, el número antes/después y la justificación de por qué el nuevo valor es aceptable. Sin ADR, el budget no se mueve.
