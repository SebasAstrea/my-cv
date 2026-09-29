# ADR-0007 — Los clips se reproducen una vez y congelan el último frame (no bucle)

**Estado** Aceptada · **Fecha** Sprint 5 · **Sprint** 5
**Requisitos motivadores** `RF-42`, `RF-41`, `DEC-02`, `RUI-60.b`
**Afecta** `RF-42` ("clips silenciosos, **en bucle** y con corte en frame clave", `SPEC.md` §4.3)

## Contexto

`RF-42` especificaba clips en **bucle**. En la práctica, repetir el mismo movimiento cada 5 s en
una escena que el usuario mira con calma resulta cansino y "de vídeo de fondo de plantilla": el
ojo nota el reinicio y la escena pierde la sensación de proyección que busca la dirección de
arte. El propietario (PO) pidió el comportamiento contrario: **cada clip se reproduce una vez y
se congela en su último frame**; al bajar, pasa al siguiente clip; y el ciclo se **reinicia** si
el usuario vuelve del final al principio o refresca la página.

`DEC-02.b` no cambia: sigue habiendo **un solo `<video>`** en el DOM.

## Decisión

1. Los clips **no** llevan `loop`. Se reproducen **una vez**; al terminar, el navegador mantiene
   el **último frame** (el elemento queda `paused` y `ended`).
2. El estado de reproducción se lleva por **ciclo**: cada escena se reproduce una vez. Al volver
   a una escena ya reproducida se muestra su **último frame congelado** (no se repite).
3. **Reinicio del ciclo:** al pasar a la escena `00` viniendo de una escena posterior, o al
   **refrescar** la página, se limpia el estado: cada clip vuelve a reproducirse una vez en el
   mismo patrón.
4. `RF-42` se mantiene en lo demás: clips **silenciosos** (sin pista de audio) y **corte en frame
   clave**. Lo único que cambia es "en bucle" → "una vez y congelar".

## Consecuencias

- **A favor:** la escena se "asienta" en lugar de reiniciar; el movimiento es un gesto, no un
  latido; encaja con "proyección técnica" y con la idea de un documento que se lee.
- **En contra y aceptado:** el vídeo pasa a ser casi estático tras el primer segundo y medio;
  quien llegue tarde a la escena ve el último frame en vez del movimiento. Se acepta: el vídeo es
  decorativo (`RF-43`) y el contenido nunca depende de él.
- `RUI-96` (destruir el clip al salir) se mantiene; al volver a una escena reproducida se recarga
  el clip y se busca su final para congelarlo.
- **`RUI-60.b`** (los timecodes corresponden a los clips) sigue pendiente: los clips definitivos
  duran ~5,17 s y el `storyboard.ts` declara 7/8/10/12/7/6/8 s. Alinear esa tabla es un cambio
  de `SPEC.md` §5.9 y se decide aparte.

## Alternativas descartadas

- **Mantener el bucle** (`RF-42` original): descartado por el motivo del contexto.
- **Pausar en el primer frame** en vez del último: pierde la sensación de "el plano ya ocurrió".
- **Reproducir en cada reentrada** a la escena: convierte cada subida/bajada en un reinicio
  constante, que es justo lo que se quiere evitar.
