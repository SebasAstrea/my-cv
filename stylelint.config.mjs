// @ts-check
import standard from 'stylelint-config-standard'

/**
 * Stylelint — correccion sintactica y de convencion estandar.
 *
 * `RNF-87` (0 literales de color o de escala en componentes) NO se implementa aqui.
 * Una regla de regex sobre el valor de `declaration-property-value-disallowed-list` es
 * demasiado fragil: no distingue `transparent` de `oklch(...)`, no entiende `@media`,
 * y falla en silencio cuando el valor viene de un custom property. En su lugar la
 * implementa `scripts/gate-tokens.mjs`, que es determinista y se puede testear.
 *
 * Ver ADR-0002 para el reparto de responsabilidades.
 */
export default {
  extends: [standard],
  ignoreFiles: ['dist/**', 'node_modules/**', '.astro/**'],
  rules: {
    'custom-property-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
      { message: 'RNF-87: los tokens son kebab-case (--surface-0, --dur-fast)' },
    ],
    // BEM, no `kebab-case` plano: el `__` separa bloque de elemento y sin el los selectores
    // `.scene__heading` y `.scene-meta` son indistinguibles al leer la hoja. `stylelint-config
    // -standard` impone `kebab-case`, que no es el convenio del proyecto.
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z][a-z0-9]*(-[a-z0-9]+)*)?(--[a-z][a-z0-9]*(-[a-z0-9]+)*)?$',
      {
        message:
          'Usa BEM: bloque `mi-bloque`, elemento `mi-bloque__elemento`, modificador `mi-bloque__elemento--mod`',
        resolveNestedSelectors: true,
      },
    ],
    'declaration-block-no-redundant-longhand-properties': null,
    'no-descending-specificity': null,
    'comment-empty-line-before': null,
  },
}
