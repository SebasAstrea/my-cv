# Reporte EDoS — simulación de carga contra sebasastrea-cv.vercel.app

| Campo              | Valor                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Fecha              | 2026-10-10                                                                                                  |
| Objetivo           | `https://sebasastrea-cv.vercel.app` (plan Vercel Hobby, sitio propio)                                       |
| Tipo               | EDoS (económico): agotar invocaciones de función, CPU o transferencia de la cuenta víctima                  |
| Presupuesto        | ≤ 100.000 peticiones (gastadas: 83.000 en la simulación + 212 de sondas)                                     |
| Entorno            | Node v24 · `fetch` nativo HTTP/2 · una sola IP de origen (equipo local)                                      |
| Reproducir         | `node /tmp/opencode/edos.mjs` (script de una sola vez, fuera del repo; fases `FASE_A`/`FASE_B` por env)      |
| Nivel probatorio   | **T1** (producción real, tráfico real contra el despliegue real)                                             |

> **Veredicto en una línea:** el muro de Vercel (Security Checkpoint) absorbio el **99,55 %**
> del ataque en el borde, la función on-demand no gasto ni una invocacion, y aun asi el
> endurecimiento de `RNF-68` se hizo porque una sonda lenta y distribuida **si** esquivaba los
> limites de la aplicacion (51 % de peticiones admitidas bajo concurrencia).

---

## 1. Metodología

Dos fases con presupuesto duro sumado (`FASE_A + FASE_B ≤ 100_000`), contra el sitio
desplegado, sin tocar nada del codigo en la fase de medida:

| Fase | Que | Como |
| --- | --- | --- |
| A — estatica | 75.000 `GET /`, concurrencia 100 | `user-agent` de navegador real, `cache: 'no-store'` |
| B — API | 8.000 `POST /api/chat`, concurrencia 40 | `Origin` propio, 90 % con `x-session` rotado (uuid) y 10 % con sesion fija, `x-forwarded-for` rotado por rango de prueba |

Previamente, una **sonda** (200 `POST`, concurrencia 50, sesiones unicas) midio el comportamiento
del rate limit de la aplicacion aislado del muro.

## 2. Resultados

### 2.1 Sonda previa — el limit de la aplicacion (antes del refuerzo)

| Metrica | Valor |
| --- | --- |
| Admitidas (200) | **102 / 200 (51 %)** pese al limite de 10/min por IP |
| Rechazadas (429 `tasa`) | 92 |
| `Retry-After` observado | 56–58 s (entero, presente) |
| Latencia p50 / p90 / p99 | 173 ms / 6,4 s / 7,9 s |

**Causa:** en serverless cada instancia lleva su propio `Map` en memoria (`TD-12`). La
concurrencia reparte las peticiones entre instancias y cada una admite sus 10 por minuto; el
token de sesion, ademas, lo elige el cliente. Es la fuga que motive el refuerzo.

### 2.2 Simulacion — fase A (estatica)

| Metrica | Valor |
| --- | --- |
| Respuestas | 200: 370 · **403: 74.564** · errores de red: 66 |
| Cuerpo de los 403 | `Vercel Security Checkpoint` (HTML de 33.985 B, servido por el **borde**, no por la funcion) |
| Latencia p50 / p90 / p99 | 319 ms / 6,4 s / 1,6 s |
| Bytes servidos | 2.423,7 MB (1,4 GB reales + 2,4 GB de checkpoints) |

### 2.3 Simulacion — fase B (API)

| Metrica | Valor |
| --- | --- |
| Respuestas | **403: 8.000 / 8.000** (checkpoint del borde) |
| Llegaron a la funcion | **0** |
| Invocaciones de funcion consumidas por el ataque | **0** |
| Latencia p50 | 139 ms (el borde contesta, no hay frio ni cola) |

El checkpoint se activo a mitad de la fase A y se mantuvo para toda la fase B. Es un estado
**por visitante** (por IP): el sitio sigue sirviendo con normalidad a cualquier otra IP, y la
IP del atacante se queda desafiada hasta que pasa el desafio o caduca.

## 3. Impacto en la cuota Hobby del experimento completo

| Cuota Hobby | Consumida | Techo |
| --- | --- | --- |
| Invocaciones de funcion | ~212 (sondas + fases admitidas) | 1.000.000/mes |
| Fast Data Transfer | ~2,6 GB (mayoritariamente el propio checkpoint) | 100 GB/mes |
| Active CPU | minutos (las pocas llamadas reales al modelo) | 4 h/mes |

**El escenario que si agota cuota** no es este: es un ataque *slow-and-low* que se mantenga
por debajo del umbral del checkpoint. A 10 req/min por IP repartidos entre N instancias vivas,
un atacante llegaria a cientos de miles de invocaciones al dia sin que el borde se activara.
Ese es el hueco que cierra el refuerzo de aplicacion.

## 4. Refuerzo aplicado (`RNF-68` completo)

| Limite | Antes | Despues | Por que |
| --- | --- | --- | --- |
| Sesion | 12/min | **5/min** (`RNF-68`) | el SPEC decia 5 y el codigo 12 |
| Fingerprint diario | **no existia** | **200/dia** por `sha256(IP \\| User-Agent)` | el techo economico que pide `RNF-68`; cuenta **tambien** las rechazadas por el minuto, que es lo que acota el gasto real |
| `Retry-After` | solo en el 429 de IP | **en los tres 429** (IP, sesion, diario) | sin el, el cliente reintentaria en bucle |
| Motivo | `tasa` | `tasa` + **`cuota-diaria`** | distingue el corte del dia del corte del minuto, con texto fijo propio |

Verificado con: `pnpm gate:chat` **46/46** (antes 40), `pnpm test` **105** tests, y la
prueba en negativo del chequeo nuevo (sin el corte diario, `exit 1` nombrando `RNF-68`).

## 5. Limites del experimento

- **Una sola IP de origen.** El checkpoint se activo rapido; una botnet real no lo activaria
  tan pronto, pero tampoco llegaria lejos por instancia: la aplicacion ya no admite mas de
  5/min por sesion ni 200/dia por huella en cada instancia.
- **`x-forwarded-for` spoofeable: no verificado en vivo** (la fase B nunca llego al origen).
  El handler lee `x-vercel-forwarded-for` primero, que lo pone Vercel y no el cliente, pero
  esto es una lectura de codigo, no una medida de esta simulacion.
- **Los limites de la aplicacion siguen siendo por instancia** (`TD-12`): sin un contador
  compartido, el tope real es el limite multiplicado por las instancias vivas. Se documenta,
  no se promete otra cosa.
