# ADR-0014 — El techo del resumen sube de 280 a 320 caracteres

> Estado: **Aceptada** · Sprint 7 · Relaja: el límite de `RND-06` sobre el resumen

## Contexto

El resumen del CV (`cv.summary`) tenía un techo de **280 caracteres**, aplicado en dos sitios:

- `src/data/schema.ts` — `z.string().min(10).max(280)`.
- `src/lib/cv/validate.ts` — aviso `RND-06` si supera 280.

Ese techo viene de `RND-06` («relevancia: cada línea cabe en el presupuesto de la escena»), no de
un número escrito en `SPEC.md`: el SPEC describe el campo, no su longitud. El propietario añadió
contenido al resumen y **el texto resultante mide 308 caracteres**, así que 280 se queda corto.

## Decisión

Subir el techo a **320 caracteres**, no a 300: 300 no llegaba (el texto mide 308) y quedaba sin
margen para la siguiente corrección.

| | Antes | Ahora |
|---|---|---|
| `cv.summary` | ≤ 280 | ≤ **320** |

**Son caracteres, no palabras.** 300 palabras serían del orden de 1.800 caracteres, muy por encima
del presupuesto de la escena 01 (`RUI-52`: 1.064 caracteres visibles), y el gate de saturación lo
rechazaría. El número que se sube es el del schema.

## Por qué no rompe nada

- La escena 01 (Perfil) midió **4 nodos / 274 caracteres** con los datos reales antes de este
  cambio. Con 320 sigue muy por debajo del techo de saturación (29 nodos / 1.064 car.), así que
  `RUI-52` no se toca. Se verificó con el resumen real de 308.
- El resumen también alimenta el `meta description`, el PDF y el corpus del chat (`chunks.ts`).
  40 caracteres más no cambian ninguno de esos consumidores: el corpus tiene su propio presupuesto
  por chunk, mucho mayor.

## Consecuencias

- `SPEC.md` **no** cambia: no fija el número, así que no hay bump de versión.
- El aviso de `RND-06` en `check:cv` pasa a decir «supera los 320 caracteres». Ese aviso es la red
  que evita que el resumen crezca hasta romper la escena; se mantiene, solo cambia el umbral.
- Si en el futuro hace falta más, el camino no es subir el número otra vez, sino mover parte del
  texto a una entrada propia: el resumen es el apoyo de la escena 00, no un campo libre.
