# ADR-0009 — Groq cierra `ABR-01`: el modelo es `openai/gpt-oss-120b` tras `ModelProvider`

> Estado: **Aceptada** · Fecha: Sprint 7 · Cierra: `ABR-01` · Modifica: `DEC-01.b`, `RK-09`, `TD-12`
> (`docs/adr/0004-abr-01-api-gestionada.md` sigue vigente: este ADR **elige** proveedor dentro de la
> opción (b) que aquel dejó abierta.)

## Contexto

`ADR-0004` decidió que el modelo se ejecuta en una **API gestionada** y dejó `ABR-01` abierta en su
última parte: cuál. El Sprint 6 dejó el chat entero funcionando contra un proveedor determinista
(`off`), que responde desde el corpus sin salir a la red. Con eso `G1`–`G4` están probados, pero
`CHA-30` (fuga ≤ 1 %), `CHA-32` (coste) y `CHA-33` (latencia p95) **no se pueden medir**: necesitan
llamadas reales contra un modelo real.

El objetivo del Sprint 7 era el que fijó el PO: **proveedor gratuito y sin tarjeta**, con la clave
en el servidor. El visitante nunca ve una clave.

## Opciones considered

| Opción | Por qué no |
|---|---|
| WebGPU en cliente | Descartada en `ADR-0004`: ~1,8 GB de pesos, TTFT incompatible con `RNF-17`, y el prompt viajaría al dispositivo. Se aplaza detrás de `ModelProvider`, no se descarta. |
| OpenAI / Anthropic | De pago, con clave y con coste por token desde la primera llamada. Contradice la decisión de producto. |
| Gemini Flash | Tiene nivel gratuito, pero la cuota gratuita por minuto es un límite duro para un sitio público y el margen de `RNF-17` es peor que con un modelo de razonamiento pequeño. |
| **Groq** | Elegida. |

## Decisión

`ModelProvider` (`DEC-01.b`) se mantiene como frontera y gana su primera implementación real:

- **Proveedor**: `groq`, modelo `openai/gpt-oss-120b`, endpoint `POST https://api.groq.com/openai/v1/chat/completions`.
- **Parámetros**: `temperature: 0.1` y `reasoning_effort: 'low'`. `gpt-oss` es un modelo de razonamiento
  y emite su razonamiento en un campo aparte; ese campo **se descarta** y no se muestra ni se cita.
  Con `low` se recorta el tiempo y el coste sin perder el orden de la respuesta.
- **Sin reintentos**: un reintento dentro del timeout solo duplica el gasto y **`CHA-32`**. Ante
  error o timeout, el handler cae a `off` y lo marca en `degraded: true`.
- **Timeout 8 s**, con `AbortController`. Es un techo de seguridad, no el presupuesto de `RNF-17`
  (que es p75 ≤ 900 ms / p95 ≤ 1.5 s) — ver «Consecuencias medibles».
- **La clave solo vive en el servidor**, en `GROQ_API_KEY`. `src/lib/env.ts` la lee en el servidor;
  nunca se serializa al cliente y `SEG-25` lo comprueba sobre `dist/`.
- **Sin clave no hay error**: `getProvider('groq', undefined)` devuelve el proveedor de reserva. Un
  despliegue con la variable mal puesta degrada a `off` en vez de romperse.
- Un `MODEL_PROVIDER` desconocido **sí** lanza (500/502). Es configuración, no un fallo de red:
  fallar en silencio a un despliegue mal configurado es peor que no arrancar.

### La ruta sigue siendo una sola

No se toca `ADR-0008`. Groq es el único egress del proyecto, se llama desde la función on-demand, y
el corpus se construye por petición con `PublicCvDocument`: **la PII nunca sale del servidor y el
sitio sigue siendo `output: 'static'`**. Lo que viaja a Groq es el CV público (nombre, rol,
experiencia) más los canarios de `G2`.

## Alternativas y coste

Se asume la dependencia de un tercero con nivel gratuito. La capa gratuita de Groq tiene límites de
ritmo y una cola de prioridad; no hay SLA. El diseño asume que **algún día el proveedor no está**,
y por eso el fallback no es decorativo: `tests/chat-proveedor.test.ts` comprueba que la respuesta de
reserva pasa `G4` y que **no filtra los canarios de `G2`**, que es el fallo que el fallback
introduciría si se limitara a volcar el prompt.

## Consecuencias

- Se **modifica `TD-12`**: la ventana de tasa pasa de identificador de sesión a **IP**, 10/min, que es
  lo que pidió el PO. Sigue siendo **por instancia de serverless** y no es un máximo global.
- Se actualizan `.env.example` y el despliegue: `GROQ_API_KEY`, `MODEL_PROVIDER=groq`,
  `CHAT_RATE_PER_MIN`.
- `RK-09` se mantiene **abierto** con el hueco hecho explícito: los guardrails ya se ejecutan contra
  la forma de respuesta de un modelo real (hay test de ello), pero `CHA-30/32/33` no se declaran
  cumplidos hasta que exista el eval set y haya medición.

## Lo que este ADR NO cierra

- `CHA-30` (fuga ≤ 1 %), `CHA-32` (coste) y `CHA-33` (latencia p95): requieren el eval set.
- `RNF-17` no está demostrado. Las llamadas completas medidas a mano oscilan entre **0,5 s y 0,9 s**,
  pero las primeras llamadas crudas tardaron 1,2–2,0 s y una llegó al timeout. Con **n bajo** eso es
  una observación, no una medición: hace falta el protocolo de `MEDICION.md`.
- `RNF-69` (Turnstile) y la cuota diaria por fingerprint: no forman parte de este ADR.
