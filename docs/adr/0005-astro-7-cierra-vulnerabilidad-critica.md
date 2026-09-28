# ADR-0005 — Astro 7: cerrar la vulnerabilidad crítica en vez de asumir la deuda

**Estado** Aceptada · **Fecha** Sprint 2 · **Sprint** 2 · **Cierra** `TD-06` (abierta por la
medición T4/T5 del Sprint 1) · **Revisa** `ADR-0001` (que fijó Astro 5)
**Requisitos motivadores** `RNF-33`, `RF-07`, `RNF-08`, `DEC-03`

## Contexto

La medición de calidad del Sprint 1 (`docs/reportes-calidad/1-fundacion-y-toolchain/REPORTE.md`
§6) cerró `pnpm audit` con **13 vulnerabilidades: 1 crítica, 4 altas, 5 moderadas, 3 bajas**. La
crítica es RCE (CVSS 9,8) en `astro@5.18.2` a través del optimizador de imágenes AVIF
(`GHSA-...`, afectadas `< 7.2.8`).

El análisis de aquella medición concluyó que **hoy no es explotable** y que se arma en el
Sprint 5:

- el sitio tiene 0 imágenes y no importa `<Image>` de `astro:assets`,
- las únicas ranuras de imagen son literales (`slot=` con contenido fijo),
- `output: 'static'`, así que el optimizador no se ejecuta en ruta de despliegue.

Es decir: la deuda era real pero **inaccesible**. Eso es exactamente el escenario que `SPEC.md`
§9 describe como tentación de aceptar la deuda en silencio. La tentación concreta era dejar
`astro@5` y cerrar `TD-06` como "riesgo aceptado, mitigado por no usar imágenes".

## Por qué no se acepta la deuda

El argumento de mitigación dependía de una premisa frágil: *este proyecto no tendrá imágenes*.
Pero el Sprint 5 las trae, y cuando las traiga nadie remembers por qué la versión del framework
está dos majors por detrás — salvo que esté escrito. Un ADR que dice "lo dejamos así" porque hoy
no duele es un ADR que sólo se lee cuando ya duele.

El coste de la alternativa resultaba asimétrico: `astro` 5.18.2 → 7.3.5 contra **13
vulnerabilidades a 0**, con un build de un comando como criterio de aceptación.

## Opciones consideradas

| Opción | CVE crítica | Coste real | Veredicto |
|---|---|---|---|
| **Subir a Astro 7 ahora** | Cerrada (`audit` → 0) | Un build. Superficie de cambios acotada (§ análisis). | **Elegida** |
| Escribir el ADR y migrar más tarde | Abierta dos majors | Un ADR, y una migración igual de difícil dentro de un año, con un CV a 2 majors más | Descartada: aplaza el coste sin reducirlo |
| No tocar dependencias, cerrar `TD-06` | Abierta | 0 hoy; deuda justificada por una premisa que el Sprint 5 va a contradecir | Descartada: contra `SPEC.md` §9 |
| Fijar Astro 6.x como punto medio | Abierta (el fix es `>= 7.2.8`) | Un salto de major en lugar de dos | Descartada: no cierra la crítica |

La opción "Astro 6 como punto medio" merece nota porque parece un compromiso razonable y **no lo
es**: el advisory exige `>= 7.2.8`, así que 6.x no cierra nada. Habría sido el peor resultado
— un major upgrade ejecutado, coste pagado, y la crítica intacta.

## Análisis previo: superficie de cambios

Antes de tocar nada se auditó la guía de migración contra el uso **real** del repo, no contra el
uso hypothetical. Los cambios de Astro 7 que no aplican aquí:

| Cambio en Astro 7 | ¿Aplica? | Motivo |
|---|---|---|
| Vite 8 | No | Sin plugins ni config específica de Vite |
| Flags experimentales eliminados | No | `astro.config.mjs` no declara ninguno |
| Markdown: Sätteri en vez de remark/rehype | No | 0 páginas `.md`/`.mdx`, 0 plugins remark/rehype |
| `src/fetch.ts` reservado | No | El fichero no existe |
| `@astrojs/db` eliminado | No | Nunca se usó |
| Internals de `astro:transitions` eliminados | No | No hay transiciones de vista |
| Compilador Rust (Go → Rust) | **Sí** | Único riesgo real: valida HTML más estrictamente |
| `compressHTML` pasa a `'jsx'` | **No** | `astro.config.mjs` ya fija `compressHTML: true` explícitamente |

El cambio de `compressHTML` merecía atención porque `true → 'jsx'` altera el espacio entre
elementos inline (`<span>a</span><em>b</em>` → `ab`). Este proyecto tiene prosa con 11 elementos
inline y muestra fechas calculadas, así que un cambio de espacios habría alterado el texto
visible **y** las mediciones de caracteres de §4.3. Al tener `compressHTML: true` ya declarado,
el comportamiento de v6 se conserva de forma explícita y el riesgo desaparece.

## Criterio de aceptación

La migración no se aceptaba por "el build pasa". Se exigía **que el HTML servido no cambie**, ya
que `RNF-33` y `RNF-100` dependen de que el documento sea el mismo para ATS y para los
exportadores.

## Resultado

- `astro@7.3.5`, `@astrojs/check@0.9.10`.
- Build limpio con el compilador Rust: **0 errores**. El compilador previo toleraba HTML mal
  cerrado; el nuevo no lo hace, y el proyecto no tenía ninguno (0 `<p>` con `<div>` dentro,
  `<p>` abiertos y cerrados en balance).
- **El HTML servido es semánticamente idéntico.** Comparación normalizada entre el artefacto de
  Astro 5 y el de Astro 7: la única diferencia en toda la página es **un espacio** entre
  `</body>` y `</html>`. Contenido, orden de nodos, `id` de escena, headings y texto: idénticos.
- `pnpm gate` (10 pasos) en verde.
- `pnpm audit` → **`No known vulnerabilities found`**. De 13 a 0.
- `esbuild` sigue funcional pese al aviso de pnpm por script de build ignorado: el paquete
  nativo `@esbuild/linux-x64` está instalado y las tres versiones del árbol transforman bien. No
  se añadió `onlyBuiltDependencies` porque no hacía falta y sólo habría ampliado la superficie de
  ejecución de scripts.

## Consecuencias

**A favor:**

- `TD-06` cerrada: la única vulnerabilidad crítica del proyecto es historia.
- `RNF-100` (exportadores) se construye sobre un origen de verdad sin vulnerabilidad activa en la
  capa de render, que es exactamente donde se serializa el CV a JSON/Markdown/PDF.
- El coste real fue **un build**, medido y no estimado.

**En contra / a asumir:**

- `ADR-0001` decía "Astro 5". Este ADR la **revisa**, sin negar su decisión de fondo: la elección de
  Astro y de `output: 'static'` sigue siendo correcta; lo que cambió es la versión, y la
  justificación de por qué seguir en Astro se renforcece con la evidencia de que la migración fue
  barata.
- La deuda de seguridad no era "Astro está viejo" sino "el fix exige dos majors". Eso deja de ser
  una amenaza genérica y pasa a tener fecha: la próxima versión con fix relevante se evalúa con
  este mismo criterio, contra el build, no contra la versión declarada.

## Trazabilidad

- Cierra `TD-06` en `docs/BACKLOG.md`.
- `pnpm audit` pasa de 13 vulnerabilidades a 0, registrado en `docs/TRACEABILITY.md` §12 bis y en
  el reporte de calidad del Sprint 2.
- Requisito afectado: ninguno por el cambio de comportamiento; `RNF-33`, `RF-07` y `RNF-08`
  verificados tras la migración con `pnpm gate`.
