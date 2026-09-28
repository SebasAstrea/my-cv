/**
 * Declaraciones para paquetes de Stylelint que no publican tipos.
 *
 * `stylelint-config-standard` es JS puro sin `@types` y no tiene typings en el paquete.
 * Se declara como `Config` de Stylelint — el tipo real — en vez de `any`, para que un uso
 * equivocado en `stylelint.config.mjs` siga produciendo error de tipo.
 */
declare module 'stylelint-config-standard' {
  import type { Config } from 'stylelint'

  const config: Config
  export default config
}
