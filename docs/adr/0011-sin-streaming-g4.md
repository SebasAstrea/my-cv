# ADR-0011 — El chat no hace streaming de tokens: `RF-55` se aplaza detrás de G4

> Estado: **Aceptada** · Sprint 7 · Aplaza: `RF-55` (prioridad S) · Refuerza: `CHA-05`, `CHA-31`,
> `CHA-37` y el contrato `chatResponse`

## Contexto

`RF-55` pide «streaming de tokens con indicador de progreso y botón de parar», y que parar aborte
el stream **y la petición de red**. Tiene prioridad **S** (should): no es un requisito de los que
bloquean la aceptación del sprint, a diferencia de los `M` que lo rodean.

`G4` es el guardrail de salida de `guardrails.ts`. Su contrato es explícito y está probado:

- la respuesta entera se valida contra un schema Zod `.strict()` antes de salir;
- cada cita se comprueba contra la allowlist derivada del corpus (`CHA-05`, `CHA-36`);
- se buscan canarios de PII (`CHA-31`) y firmas de fuga del prompt;
- si algo falla, **nada** de esa respuesta llega al cliente: se sustituye por texto fijo.

Esa propiedad —«ninguna salida llega al cliente sin pasar por G4»— es la que hace que el chat se
pueda publicar sin revisar cada respuesta. No es una capa de estilo.

## El conflicto

Streamear tokens del modelo al navegador significa enviar texto que **todavía no se ha validado**:

- un token suelto no es JSON parseable, así que el schema no puede validarse por partes;
- las citas van en un campo aparte y no se conocen hasta el final, así que la allowlist no se
  puede comprobar sobre el prefijo;
- si al final G4 rechaza la respuesta, el visitante ya ha leído el texto crudo. No se puede
  «des-ver»: el guardrail llegaría tarde por definición.

Las salidas posibles eran tres, y ninguna es gratis:

| Opción | Por qué no |
|---|---|
| Streamear crudo y validar al final | Es renunciar a G4. El guardrail deja de ser un control y pasa a ser una recomendación. Rompe `CHA-05`, `CHA-31` y `CHA-37`, que hoy están en verde |
| Streamear en el servidor, validar, y emitir el texto validado «a trozos» | No reduce la latencia percibida (el primer trozo no sale hasta que el modelo termina, 0,5–0,9 s), y el botón de parar no ahorra la llamada al modelo porque ya se hizo. Es streaming de mentira que complica el transporte para nada |
| No streamear y mostrar un indicador de progreso | Renuncia a `RF-55`, que es `S`, y conserva todo lo demás |

## Decisión

**Se aplaza `RF-55`.** El panel muestra un indicador de progreso mientras espera la respuesta
completa y validada, y no ofrece botón de parar.

Se elige la tercera opción porque es la única que mantiene la propiedad que da valor al producto.
El orden de prioridades ya estaba en el propio spec: `G4` es `M` y `RF-55` es `S`. Cuando un `S`
sólo se puede cumplir rompiendo un `M`, se aplaza el `S`, se dice, y no se disimula.

## Consecuencias

- `RF-55` queda **declarado como no cumplido** en `TRACEABILITY.md`, con este ADR como motivo. No
  se marca como hecho ni se implementa a medias.
- El contrato `chatResponse` no cambia: sigue siendo un JSON completo y validado. La UI no depende
  de un formato de transporte distinto, así que el día que se quiera streaming **no** habrá que
  rehacer el cliente entero.
- `RF-54` (estado de degradación explícito) cubre la parte de «indicador» de `RF-55`. Lo que falta
  es el progreso token a token y el botón de parar, que son las dos cosas que chocan con G4.

## Cuándo se podría cerrar

Si el modelo pasara a emitir un formato validable por partes (por ejemplo, un JSON con el campo
`answer` primero y las citas después, en un orden garantizado), o si `G4` pudiera validar sobre
prefijos con una allowlist que no dependa del final. Ninguna de las dos cosas es cierta hoy, y
diseñarlas es un sprint, no un detalle de UI. Si alguien lo intenta: el criterio para aceptarlo es
que **un token nunca llegue al DOM antes de que G4 haya dado el visto bueno a la respuesta
completa**, y que el botón de parar aborte de verdad la llamada al proveedor. Sin esas dos, no es
`RF-55`.
