// @ts-check
import { defineConfig } from 'astro/config'
import vercel from '@astrojs/vercel'
import { dataSource, isDeployBuild } from './src/lib/env.ts'

/**
 * Configuracion de Astro — ADR-0001.
 *
 * `output: 'static'` es una decision, no un default: cumple `RNF-33` (HTML semantico
 * renderizado en servidor, parseable por ATS) y `RF-07` (CV legible sin JS) por
 * construccion. El JS de ruta critica queda en 0 KB; las islas se anaden caso a caso
 * y se contabilizan aparte contra `RNF-08`.
 *
 * La guarda de `ADR-0003` se dispara solo cuando el build VA A DESPLEGARSE (Vercel presente),
 * no con cualquier `NODE_ENV=production`. `astro build` en local pone esa variable, y sin
 * esta distincion seria imposible compilar con el fixture, que es lo que el ADR habilita.
 */

// `CV_DATA_SOURCE` gobierna el origen del CV (ADR-0003).
const source = dataSource()
const deploying = isDeployBuild()

if (deploying && source !== 'real') {
  throw new Error(
    `[ADR-0003] Despliegue con CV_DATA_SOURCE="${source}". Se exige "real".\n` +
      `  El fixture no puede llegar a un artefacto publico: RF-25 y SEG-31 lo tratan como fallo.`,
  )
}

export default defineConfig({
  // `output: 'static'` **se mantiene** (`ADR-0001`). El adaptador no convierte el sitio en SSR:
  // solo habilita que exista una ruta con `prerender = false`, que es lo unico on-demand
  // (`POST /api/chat`, `ADR-0008`). Todas las paginas siguen saliendo como HTML estatico en
  // build, y `gate:ats` sigue encontrando las cuatro exportaciones y el JSON-LD igual que antes.
  //
  // Sin adaptador, Astro da error al encontrar una ruta no prerenderizada, que es exactamente
  // la proteccion que se quiere: no se puede añadir una ruta server sin decidirlo.
  adapter: vercel(),
  output: 'static',
  trailingSlash: 'never',
  build: {
    // Presupuesto de CSS: RNF-09 pide <= 24 KB gzip. El budget real se verifica en
    // `scripts/gate-budgets.mjs`, que mide los artefactos; aqui solo se evita el inline.
    inlineStylesheets: 'never',
  },
  compressHTML: true,
  devToolbar: { enabled: false },
  vite: {
    build: {
      // Minificador por defecto de Vite. `lightningcss` da ~3% menos, a cambio de una
      // dependencia nativa mas; con un budget de 24 KB de CSS no es el cuello de botella.
      assetsInlineLimit: 0,
    },
  },
})
