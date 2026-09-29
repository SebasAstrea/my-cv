/**
 * Lectura de entorno que funciona igual en el build de Astro y en un script suelto de Node.
 *
 * `import.meta.env` solo existe cuando Vite lo inyecta. Los gates corre con `node` pelado, y
 * ahi `import.meta.env` es `undefined` y accessing a una propiedad revienta el proceso con
 * un error que no dice nada del problema real.
 *
 * El CV se lee **siempre en build** (es un sitio estatico, `ADR-0001`), nunca en el
 * navegador, asi que `process.env` es la fuente correcta y suficiente. `import.meta.env` se
 * consulta como respaldo por si alguien convierte un modulo de este arbol en algo que corre
 * bajo Vite.
 *
 * Nada de esto llega al bundle del cliente: no se usa ningun prefijo `PUBLIC_` para datos de
 * construccion.
 */

/**
 * Vite reemplaza `import.meta.env` estaticamente y **prohibe el acceso dinamico** a sus
 * propiedades (`import.meta.env[algo]` lanza). Por eso se captura el objeto entero una vez y
 * se leen sus claves con corchetes en JS normal. En Node pelado `import.meta.env` es
 * `undefined`, y eso no lanza: lo dangerouso es la propiedad, no el objeto.
 */
const VITE_ENV: Record<string, string | undefined> | undefined = import.meta.env

function read(name: string): string | undefined {
  const fromVite = VITE_ENV?.[name]
  if (fromVite !== undefined) return fromVite
  if (typeof process !== 'undefined' && process.env !== undefined) {
    return process.env[name]
  }
  return undefined
}

/** Origen del documento CV. `ADR-0003`. Por defecto `fixture` en desarrollo. */
export type DataSource = 'fixture' | 'real' | 'missing'

export function dataSource(): DataSource {
  const raw = read('CV_DATA_SOURCE') ?? 'fixture'
  if (raw === 'fixture' || raw === 'real' || raw === 'missing') return raw
  throw new Error(
    `[ADR-0003] CV_DATA_SOURCE="${raw}" no es valido. Valores: fixture | real | missing.`,
  )
}

export function isProductionBuild(): boolean {
  return read('NODE_ENV') === 'production'
}

/**
 * La unica nocion de "esto va a desplegarse" que usa el proyecto.
 *
 * No es `NODE_ENV=production`: `astro build` lo pone siempre, y eso haria imposible compilar
 * en local con el fixture, que es justamente lo que `ADR-0003` habilita. Es la presencia de un
 * entorno de despliegue (Vercel o Cloudflare Pages), que es donde el fixture seria un problema
 * real. `CF_PAGES` lo fija Cloudflare Pages durante el build; sin esta rama, un despliegue en
 * Pages con `CV_DATA_SOURCE=fixture` no lo bloquearia `astro.config.mjs`.
 */
export function isDeployBuild(): boolean {
  return read('VERCEL') === '1' || read('VERCEL_ENV') !== undefined || read('CF_PAGES') === '1'
}

export function isCi(): boolean {
  return read('CI') === 'true'
}

export function siteUrl(): string {
  return read('PUBLIC_SITE_URL') ?? 'http://localhost:4321'
}

/**
 * Email de contacto para el revelado bajo interaccion (`RF-27`).
 *
 * Es `PUBLIC_` porque Vite lo inyecta en el bundle del cliente; el `contact.email` del CV
 * sigue siendo `private` y se elimina en build (`SEG-31`). Solo se usa si esta declarado.
 * Decision, limites y excepcion de `SEG-32` en `docs/adr/0005`.
 */
export function contactEmail(): string | undefined {
  const value = read('PUBLIC_CONTACT_EMAIL')
  return value !== undefined && value.trim() !== '' ? value.trim() : undefined
}

/**
 * Chat encendido (`RF-50`). Por defecto si: el gate necesita poder llamar al endpoint.
 *
 * Se declara para poder apagar la funcion sin tocar codigo — un despliegue de prueba, o el
 * momento en que se decide que el chat no entra en v1. El apagado devuelve 404, no un 503 con
 * mensaje: si el chat no esta, la ruta no deberia existir desde fuera.
 */
export function chatEnabled(): boolean {
  const value = read('CHAT_ENABLED')
  return value !== '0' && value !== 'false'
}

/**
 * Proveedor de modelo (`ADR-0004`, `ABR-01`).
 *
 * Sin valor declarado se usa `"off"`, que es el unico implementado: responde desde el corpus
 * sin salir a la red. Un valor desconocido **lanza** en vez de caer a `off`, porque caer en
 * silencio convertiria un despliegue mal configurado en un chat que parece funcionar y no
 * responde preguntas.
 */
export function modelProvider(): string {
  return read('MODEL_PROVIDER') ?? 'off'
}
