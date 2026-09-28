// @ts-check
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * ESLint — RNF-80 (`strict` + `noUncheckedIndexedAccess`, 0 `any` implicito) y
 * `SEG-14` (nada de HTML inyectado con datos del modelo: no hay React aqui, pero la regla
 * equivalente es "el contenido del CV se renderiza como nodos de texto").
 *
 * Reparto de rigor, y por que:
 *
 * - `src/**` recibe el set type-aware completo. Ahi vive la logica de negocio y el schema;
 *   es donde un `any` implicito se convierte de verdad en un bug (`RNF-80`).
 * - Los `.mjs` (scripts de gate, configs) se configuran con `disableTypeChecked`. Sigue siendo
 *   `// @ts-check`, asi que `pnpm typecheck` los compila igual y les pilla errores de tipo;
 *   lo que hacen las reglas type-aware ahi es ruido sobre `JSON.parse` y `import.meta`, que
 *   son `any` por diseno de la plataforma, no por descuido.
 */
export default tseslint.config(
  {
    // `.astro` queda fuera a proposito: lo valida `astro check` (que usa el compilador real y
    // entiende el template); el parser de TS de ESLint solo veria el frontmatter y daria una
    // imagen falsa del fichero. Los `.ts` que ese frontmatter importa si se lintan.
    ignores: [
      'dist/**',
      'node_modules/**',
      '.astro/**',
      'coverage/**',
      'playwright-report/**',
      '**/*.astro',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      // El CV es dato, no codigo: todo lo que venga del documento es `unknown` para el linter
      // hasta que Zod lo valida. La regla obligaria a comprobar `undefined` en cada campo
      // ya validado, que es redundante con la validacion.
      '@typescript-eslint/no-unnecessary-condition': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // Tooling de Node: se comprueba con `tsc` en `pnpm typecheck`, no con reglas type-aware.
    files: ['scripts/**/*.mjs', '*.mjs', '*.config.mjs', 'astro.config.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      // Los scripts de gate son CLI: necesitan stdout y exit codes.
      'no-console': 'off',
    },
  },
)
