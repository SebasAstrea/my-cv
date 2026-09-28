# AGENTS.md — cómo trabajar en este repo

Instrucciones para agentes y para personas. Léete esto junto con `docs/STATUS.md`, que es la
fuente de verdad del **avance**. Aquí está el **cómo**.

> `docs/STATUS.md` = qué está hecho y qué toca ahora.
> Este fichero = las reglas que, si no se siguen, rompen el repo.

## El proyecto en una línea

CV con ritmo de vídeo: 7 escenas, scroll-snap, HTML estático accesible, cero JS en ruta
crítica, budgets de bytes verificados en CI, y un chat RAG en el Sprint 6+. Astro 5 + CSS
nativo. `SPEC.md` tiene ~240 requisitos; casi todo lleva un ID (`RF`, `RNF`, `RUI`, `SEG`,
`CHA`, `RND`, `RFU`, `RK`, `ABR`, `DEC`).

## Antes de tocar nada

```bash
pnpm status      # milisegundos. Si falla, el repo está inconsistente con STATUS.md
pnpm gate        # la cadena completa. 10 pasos, exit 0
```

`pnpm status` es el primer paso de `pnpm gate` a propósito: comprueba que `STATUS.md` describe
el repo de verdad. Si falla, **arregla el documento antes de escribir código**, o el siguiente
agente (''tú'', en 20 minutos) partirá de información falsa.

## Reglas que no se negocian

1. **Un sprint a la vez.** `SCRUM.md` §6. Un requisito nuevo a mitad de sprint no entra; va al
   siguiente, con bump de versión de `SPEC.md`.
2. **Nada se marca hecho sin gate.** Requisito = código + comando que sale distinto de 0 + fila
   en `TRACEABILITY.md` §12 bis. Si no hay comando, no hay requisito: primero el gate.
3. **Un gate desactivado es un ADR.** No se relaja un budget sin escribir el número antes/después
   y la justificación. Ajustar el budget después de ver el número está prohibido
   (`MEDICION.md` §9).
4. **`pnpm gate` en verde antes de commitear.** Los tres pasos de seguridad (fixture, placeholders,
   PII) no se saltan porque «aquí no aplica».
5. **Nada de literales de color o de escala fuera de `src/styles/tokens.css`.** Ni en CSS, ni en
   `.astro`, ni en `<style>`. `pnpm gate:tokens` falla. Esto es `RNF-87` y es lo que mantiene el
   tema oscuro coherente.
6. **`Private` no se oculta, se elimina.** Nada de `display: none` sobre PII, nada de ofuscar el
   email en el HTML (es un no-op contra scrapers y un sí contra accesibilidad y copy-paste). El
   campo desaparece en build. `SEG-31`.
7. **El email nunca está en el HTML inicial.** Sale por revelado bajo interacción (`RF-27`), y
   el tipo `PublicCvDocument` está para que ni siquiera compile si lo intentas.
8. **Fixture solo en dev.** `CV_DATA_SOURCE=real` es obligatorio para desplegar; el fixture no
   puede llegar a un artefacto público (`ADR-0003`, `RF-25`). `src/data/cv.real.ts` está
   gitignored: es PII (`SEG-30`).

## Convenciones

|                |                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Imports        | Extensión explícita (`.ts`, `.astro`). `verbatimModuleSyntax` + `allowImportingTsExtensions` lo exige.  |
| Tipos          | `import { type X }` en línea, no `import type` separado (`@typescript-eslint/consistent-type-imports`). |
| Tipos de datos | `type` para el dominio, `interface` para objetos con comportamiento.                                    |
| CSS            | BEM: `.scene__heading`, `.rail__item--active`. Lo valida `selector-class-pattern`.                      |
| Tokens         | kebab-case, `--surface-0`, `--dur-fast`. Lo valida `custom-property-pattern`.                           |
| Errores        | Español, sin tildes en el texto de los mensajes de error (se loguean mucho). Comentarios con tildes.    |
| Sin            | `any`, `@ts-ignore`, `eslint-disable`, `!` sin comentario. `RNF-80` los prohíbe.                        |
| Números        | Punto decimal con coma en la prosa, punto en el código.                                                 |

## Dónde va cada cosa

```
src/data/       schema.ts (contrato Zod) · cv.fixture.ts · index.ts (acceso único) · storyboard.ts
src/lib/        env.ts (CV_DATA_SOURCE) · cv/validate.ts (reglas cruzadas, toPublicCv)
src/components/ Scene.astro · IndexRail.astro · FixtureBanner.astro
src/styles/     tokens.css · reset.css · global.css
src/pages/      index.astro
scripts/        status.mjs · check-cv.mjs · gate-{tokens,placeholders,budgets,artifacts}.mjs
docs/           STATUS.md (avance) · SPEC.md · SCRUM.md · BACKLOG.md · MEDICION.md · TRACEABILITY.md · adr/
```

**Regla de importación:** nadie importa `cv.fixture.ts` salvo `scripts/`. Todo entra por
`src/data/index.ts`; si no, la garantía de `toPublicCv` se desvanece en cuanto alguien escribe
un import.

## Trampas del toolchain

Cada una costó tiempo. No las repitas.

| Trampa                                           | Qué pasa                                                                                                             | Solución ya en el código                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `import.meta.env[algo]`                          | Vite lanza: _Dynamic access of `import.meta.env` is not supported_                                                   | Captura el objeto entero (`src/lib/env.ts`) y usa corchetes en JS normal |
| `NODE_ENV=production`                            | `astro build` lo pone siempre, así que usarlo como «va a desplegarse» bloquea los builds locales con fixture         | `isDeployBuild()` mira Vercel                                            |
| `import('./cv.real.ts')`                         | Rollup resuelve la ruta literal en build y falla siempre: el fichero está gitignored                                 | `import.meta.glob` en `src/data/index.ts`                                |
| `satisfies` dentro de una IIFE                   | El transpulador emite mal los paréntesis; falla en runtime como `X.map(...) is not a function`, sin señalar el sitio | Función declarada (`buildScenes()`)                                      |
| `lightningcss`                                   | No está instalado; Vite no lo trae                                                                                   | Minificador por defecto                                                  |
| `stylelint-config-standard`                      | Sin tipos; `tsc --noEmit` lo rechaza                                                                                 | `src/types/stylelint-config-standard.d.ts`                               |
| Un `rules:` propio sobre `...disableTypeChecked` | Sobrescribe el `rules` del preset y vuelven las reglas type-aware sin información de tipos                           | Fusiona: `rules: { ...disableTypeChecked.rules, ...propio }`             |
| `.astro` en ESLint                               | El parser de TS no lo entiende y da una imagen falsa                                                                 | Fuera de ESLint; lo valida `astro check`                                 |
| Prettier en `docs/`                              | Realinea tablas enteras; diff ilegible                                                                               | `docs/` en `.prettierignore`                                             |

## Al terminar un cambio

```bash
pnpm gate
git add -A && git commit   # mensaje: qué cambió, por qué, y cómo se verifica
```

Y actualiza, **en el mismo commit**:

- `docs/STATUS.md` §1 y §2 — qué sprint, qué estado, qué toca ahora. `pnpm status` falla si no.
- `docs/BACKLOG.md` — fila del requisito con su gate.
- `docs/TRACEABILITY.md` §12 bis — requisito, método, comando, resultado.
- `docs/adr/NNNN-*.md` — solo si el cambio toca una decisión de `SPEC.md` §2 o relaja un budget.

## Si algo falla y no sabes por qué

Los gates dan mensajes accionables a propósito. Léelos enteros antes de tocar nada:

- `[ADR-0003] CV_DATA_SOURCE=real pero falta src/data/cv.real.ts` → el fichero gitignored no
  existe. Cópialo del fixture.
- `[ADR-0003] Despliegue con CV_DATA_SOURCE="fixture"` → estás construyendo con datos semilla
  para producción. Es exactamente lo que tiene que pasar.
- `[DEC-03.c] El CV no valida el schema` → lista todos los problemas, no solo el primero.
- `GATE SEG-32: toPublicCv no eliminó los campos private` → alguien ha filtrado PII al cliente.

No silencies un gate. Si falla de verdad y es un falso positivo, **arregla el gate y prueba que
detecta el caso real** (los negativos de `STATUS.md` §3.1 son el ejemplo a seguir).
