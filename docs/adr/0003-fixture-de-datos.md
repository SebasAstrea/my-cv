# ADR-0003 — Datos semilla con flag de producción para el CV

**Estado** Aceptada · **Fecha** Sprint 1 · **Sprint** 1 · **Requisitos motivadores** `DEC-03.c`, `RF-25`, `RND-05`, `SEG-32`

## Contexto

`DEC-03` establece que `src/data/cv.ts` es la **única fuente de verdad** del CV, y que un schema
Zod lo valida en build y en CI: un CV inválido no despliega. `RF-25` prohíbe placeholders
(`Lorem`, `TODO`, `Ejemplo`) en producción.

El contenido real del CV es del propietario y **aún no está disponible** al empezar el Sprint 1.
Hay una tensión real entre dos cosas:

1. Sin contenido real no se puede validar el schema con datos que se parezcan a la realidad
   (fechas, solapes, métricas), y `RND-03` (coherencia temporal) no se ejercita.
2. Con contenido inventado, `RF-25` se incumple desde el día uno y el gate de placeholders
   tendría que estar apagado, lo que anula el gate.

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| **Fixture con flag** (elegida) | Permite ejercitar el schema, el gate y el render desde ya. El fixture es **explícito y versionado**, no un placeholder escondido. El gate `RF-25` sigue activo, pero armado contra el flag: en producción exige `CV_DATA_SOURCE=real`. | El fixture es un fichero más que hay que borrar. Riesgo de que se cuele en producción si el flag se pone mal. |
| Solo schema, `cv.ts` vacío | Cero riesgo de datos falsos. | No se puede validar ni renderizar nada. El Sprint 1 no tiene entregable verificable, que es justo lo que el DoD §5 exige. |
| Datos reales ya en el Sprint 1 | Estado final desde el principio. | Bloquea el Sprint 1 a la espera del propietario. Anti-SCRUM: el sprint se compromete completo o no se compromete. |
| Fixture sin flag | Simple. | `RF-25` queda inaplicable. Un gate que no puede fallar no es un gate (ver `MEDICION.md` §9). |

## Decisión

**Fixture explícito + flag de entorno `CV_DATA_SOURCE`**, con tres valores:

| Valor | Comportamiento |
|---|---|
| `fixture` (default en dev) | Carga `cv.ts` con datos semilla. La UI muestra un distintivo de datos no reales. |
| `real` | Carga `cv.real.ts`. **Requerido en producción**: el build falla si se despliega en producción sin este flag. |
| `missing` | No hay datos: el build falla. Se usa para probar el camino de error. |

El fixture **está marcado en el propio dato**, no en un comentario:

- Todos sus textos llevan el sufijo de marca `[FIXTURE]` en un campo `fixture: true` del schema.
- El schema exige `fixture: true` **o** `lastReviewed` real en cada rol (`RND-04`).
- El gate `RF-25` rechaza marcadores de placeholder **y** rechaza que el fixture llegue a un
  build de producción.

## Consecuencias

**A favor:** el Sprint 1 entrega algo verificable. `RND-03` (fin > inicio), `RND-05` (campos
requeridos), `RND-02` (años de experiencia sin solapes) se ejercitan con datos que imitan la
complejidad real: solapes entre roles, roles en curso, proyectos con métricas.

**En contra / deuda aceptada:**
- El Sprint 2 empieza con la sustitución del fixture. Es trabajo de un día, planificado.
- El flag es un mecanismo que puede fallar. Se mitiga con dos comprobaciones independientes
  (en `astro.config.mjs` y en el gate de build), no con una sola.
- Un `fixture: true` visible en el esquema es ruido en producción. Se elimina con
  `.refine()` condicional al flag, de modo que el campo desaparece del tipo cuando
  `CV_DATA_SOURCE=real`.

**Impacto en budgets:** ninguno. No se relajan requirements.
