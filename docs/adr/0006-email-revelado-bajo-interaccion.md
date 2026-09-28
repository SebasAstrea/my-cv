# ADR-0006 — Email de contacto: revelado bajo interacción (`RF-27`) y excepción acotada de `SEG-32`

**Estado** Aceptada · **Fecha** Sprint 4 · **Sprint** 4
**Requisitos motivadores** `RF-26`, `RF-27`, `SEG-30`, `SEG-31`, `SEG-32`
**Afecta** regla 6 de `AGENTS.md` ("la PII no se ofusca, se elimina en build")

## Contexto

`SPEC.md` ofrece dos vías para el email de contacto y prohíbe mantenerlas a la vez:

- `RF-26`: ofuscación por composición en cliente (partes del email en nodos distintos).
- `RF-27`: revelado bajo interacción — botón real ("Ver email") que monta la dirección al
  pulsarlo, accesible y copiable, **sin el email en el HTML inicial**.

La regla 6 de `AGENTS.md` dice que un campo `private` "no se oculta, se elimina", y `SEG-32`
convierte eso en gate: si un artefacto de cliente contiene un valor `private` del CV, el build
falla. En un sitio **estático** (`ADR-0001`) no hay servidor que sirva el email en el momento de
la interacción, así que "revelar sin que el valor esté en ningún artefacto" es imposible: la
dirección tiene que viajar al cliente. El conflicto es real, no de matiz.

## Decisión

Se implementa **`RF-27`**, con estos límites:

1. El email que se revela **no** es `contact.email` del CV. Es un **canal de contacto público
   designado**, `PUBLIC_CONTACT_EMAIL`, declarado como variable de entorno en build. El
   `contact.email` del CV sigue `private` y se elimina en build (`SEG-31`).
2. Vite inyecta `PUBLIC_CONTACT_EMAIL` en el **bundle JS del cliente**, nunca en el HTML: el
   marcado solo lleva el botón "Ver email". Un scraper que lee HTML no obtiene la dirección.
3. `SEG-32` mantiene su escaneo **con una única excepción**: no trata como fuga el valor que
   coincide exactamente con `PUBLIC_CONTACT_EMAIL`. El resto de valores `private` (email real,
   ubicación precisa, salario, nodos `private`) siguen bloqueando el build.
4. Si `PUBLIC_CONTACT_EMAIL` no está definido, no se renderiza el botón y no hay email en
   ningún artefacto: el sitio ofrece solo LinkedIn/GitHub y `/cv.txt`.

## Consecuencias

- **A favor:** contacto accesible (botón real, `aria-expanded`), copiable tras revelar, y sin el
  email en el HTML. Es la variante que el propio `SPEC.md` marca como la que "sí resuelve el
  problema".
- **En contra y aceptado conscientemente:** la dirección vive en el bundle JS, así que un scraper
  que lee JavaScript —y no solo HTML— puede extraerla. Es el techo de rendimiento que
  `SPEC.md` documenta en la advertencia de `RF-26`; no se finge que la ofuscación sea
  criptografía. Por eso se usa un **email público**, no el personal: si se filtra, el coste es
  spam, no exposición de una identidad privada.
- La regla 6 de `AGENTS.md` queda **acotada**, no derogada: sigue prohibido ofuscar el email del
  CV y ocultar PII con CSS. Lo que se admite es un canal de contacto público, explícito y
  separado del documento.
- **Riesgo operativo:** si el operador pone en `PUBLIC_CONTACT_EMAIL` el mismo valor que
  `contact.email`, `SEG-32` lo tratará como canal público y dejará de vigilar ese valor. La
  decisión de qué dirección es pública es del propietario del CV; por defecto se recomienda una
  distinta de la personal.

## Alternativas descartadas

- **Sin email** (solo LinkedIn/GitHub): respeta la regla 6 al pie de la letra, pero descarta
  `RF-26/27` y empeora el contacto.
- **Ofuscación con CSS** (`display:none`, partes en nodos): peor accesibilidad y copia, y un
  no-op contra scrapers. Es exactamente lo que la regla 6 prohíbe.
- **Endpoint serverless** que sirva el email: rompe `ADR-0001` (salida estática) por una función
  de contacto.
