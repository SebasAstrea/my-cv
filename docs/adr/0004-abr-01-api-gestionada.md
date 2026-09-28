# ADR-0004 — `ABR-01` resuelta: inferencia solo por API gestionada

**Estado** Aceptada · **Fecha** Sprint 1 · **Sprint** 1 · **Cierra** `ABR-01` (abierta en `SPEC.md` §9.2)
**Requisitos motivadores** `RNF-17`, `RNF-16`, `SEG-25`, `CHA-33`, `RNF-21`, `RK-05`

## Contexto

`ABR-01` era la única decisión abierta de `SPEC.md` §9.2 y bloqueaba el diseño de los sprints
6 y 7. Las cuatro opciones guardadas eran:

- **(a)** Ambos con selector: WebGPU en cliente (Qwen3-1.7B / Llama-3.2-3B Q4, ~1.8 GB) como
  opción privada, con API gestionada como respaldo.
- **(b)** Solo API gestionada (Groq / OpenRouter / Gemini Flash).
- **(c)** Solo WebGPU en cliente.
- **(d)** Sin modelo: RAG con respuestas extractivas.

`DEC-01` ya había establecido la arquitectura: el modelo es *commodity*, el guardrail es
*producto*, y la inferencia **no** corre en el runtime de Vercel (`DEC-01.a`).

## Evaluación

El criterio decisivo, según el propio `SPEC.md` §9.2, es la calidad medida en el eval set
(`CHA-33` groundedness ≥ 0.85, `CHA-35` éxito en tareas ≥ 0.85). La comparación:

| Opción | `RNF-17` TTFT p75 ≤ 900 ms | `RNF-16` cold start | `SEG-25` prompt server-only | `RNF-21` coste | Groundedness esperado | Complejidad |
|---|---|---|---|---|---|---|
| (a) ambos | Cumple (API) | 1.8 GB de descarga en el modo webgpu | Parcial: se rompe si el usuario elige webgpu | Coste del API | El 1.7B en cliente es el que arriesga el gate | **Alta**: 2 code paths, 2× eval set, 2× red-team |
| **(b) solo API** | **Cumple** | N/A | **Cumple** | ~€0–2/mes (`RNF-20`) | El más alto: un modelo de servidor de tamaño suficiente es el único que llega a 0.85 | **Baja**: 1 code path |
| (c) solo WebGPU | **No cumple**: 1.8 GB antes del primer token | ≤ 6 s solo si está cacheado | **No cumple**: el prompt viaja al cliente | €0 | El más bajo: un 1.7B en cliente ronda 0.60–0.70 | Media |
| (d) RAG extractivo | Cumple (holgado) | N/A | Cumple | €0 | ~1.0 por construcción | Media, pero pierde `CHA-20` |

Tres argumentos cierran la decisión:

1. **Un 1.7B en cliente con groundedness 0.60 es un problema en producción, no un ahorro.**
   `CHA-33` exige ≥ 0.85 con LCI95 inferior ≥ 0.80. El modo webgpu no puede pasar el eval set
   con un modelo de ese tamaño, y `DEC-01.d` ya dice que el modo webgpu solo se habilita
   *después* de superar el eval set. Es decir: la opción (a) o (c) promete una función que su
   propio spec prohíbe habilitar hasta que se demuestre que funciona. Se estaría construyendo algo
   que no se puede encender.
2. **La privacidad no es un argumento a favor de webgpu.** `SUP-01` establece que el contenido
   del CV es público. Lo que hay que proteger es el *system prompt* (`SEG-25`) y los campos
   `private` (`SEG-31`), y ambos están resueltos por arquitectura en el modo API, no por el
   lugar donde corre el modelo.
3. **El coste real no es el dinheiro.** (b) cuesta del orden de €0–2/mes (`RNF-20`) y está bajo
   el 5% del presupuesto mensual (`RNF-21`). El coste real de (a) es mantener dos code paths
   con el doble de superficie de guardrail, el doble de eval set y el doble de red-team, para
   una opción que no puede pasar su propio gate.

## Decisión

**Opción (b): inferencia exclusivamente por API gestionada.**

- `ModelProvider` (`DEC-01.b`) se implementa **solo** con la variante `api` en la v1. La
  interfaz se conserva intacta, con `off` como valor de degradación (`DEC-01.f`).
- El modo `webgpu` **no se implementa**. No es "se difiere": se descarta, con la razón escrita
  aquí para que nadie lo reintroduzca sin responder a los tres argumentos de arriba.
- `DEC-01.d` (prompt server-only) pasa a ser **invariante**: en `api` el cliente nunca compone ni
  ve el prompt. `SEG-25` deja de ser un control condicional.
- `RK-05` (el modo webgpu expone el prompt) se **cierra**: el riesgo desaparece con la opción.

## Consecuencias

**A favor:** un solo camino de ejecución, un un solo eval set, un solo juego de guardrails. Se
puede exigir el 100% de cobertura en G1–G4 (`RNF-81`) sin duplicar. `RNF-17` es alcanzable.
`SEG-25` y `RK-05` quedan cerrados por construcción.

**En contra / deuda aceptada:**
- Coste recurrente externo. Mitigado con `RNF-21` (corte duro mensual), `RNF-58` (circuit
  breaker) y el kill switch `DEC-01.f`.
- Dependencia de un proveedor externo. Mitigado con `RNF-103`: cambiar de proveedor es un
  cambio de variable de entorno, no de código de guardrails.
- **Egress a un tercero.** `DEC-01.e` lo restringe a un único host, y `SEG-24` obliga a
  documentar la política de red. Se resuelve en el Sprint 9.
- Se pierde la opción "privado y local" como argumento de venta. No era un requisito
  (`SUP-01` ya declaraba el CV público), así que no es una relaxing.

**Impacto en `SPEC.md`:** `ABR-01` pasa a la tabla de cerradas de §9.1 con esta decisión.
`RK-05` se elimina de `TRACEABILITY.md` §12. `RNF-16` (cold start en navegador) queda **fuera de
alcance v1** por no haber cliente. Se requiere bump de versión de `SPEC.md` (§10), que se
acompaña de la entrada en el changelog.
