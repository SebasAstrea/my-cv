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
    // `tests/` entra en el mismo set type-aware que `src/`, y no por conveniencia.
    //
    // Los presets `strictTypeChecked` se aplican a todos los ficheros, asi que un `.ts` fuera
    // de este bloque recibe reglas que piden informacion de tipos sin proyecto detras y ESLint
    // revienta con un error de `parserServices` en vez de un diagnostico util.
    //
    // Y un test merece el mismo/set mas estricto que el codigo que prueba: un `any` en una
    // asercion es la forma mas facil de escribir un test que no comprueba nada.
    files: ['src/**/*.ts', 'tests/**/*.ts'],
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
    // Excepcion acotada a los ficheros de test, y con motivo concreto.
    //
    // `test()` y `describe()` de `node:test` devuelven una promesa que el runner registra por
    // su cuenta; el uso documentado es declararlos sin `await`. La regla marca esas 42 llamadas
    // como promesas flotantes, asi que activarla aqui solo obligaria a ensuciar cada
    // declaracion con `void`, que es peor: esconderia de verdad las promesas mal esperadas del
    // resto del fichero. El resto de reglas type-aware sigue activa, y un `any` en una
    // asercion —la forma mas facil de escribir un test que no comprueba nada— sigue fallando.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
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
  {
    // Scripts de medicion: `scripts/medir-*.mjs` y `scripts/graficas.mjs`.
    //
    // Mezclan DOS entornos en el mismo fichero, y por eso necesitan los dos juegos de globals:
    // el servidor estatico, el `fs` y el Playwright se ejecutan en Node, mientras que todo lo
    // que va dentro de `page.evaluate()` se serializa y corre en el NAVEGADOR. Sin declarar
    // `window`/`document` aqui, `no-undef` marca como no definido precisamente el codigo que si
    // lo esta. Es mas honesto que un `eslint-disable` por linea: los dos entornos son reales en
    // estos ficheros, no es codigo muerto que hay que silenciar.
    files: [
      'scripts/medir-*.mjs',
      'scripts/graficas.mjs',
      'scripts/gate-keyboard.mjs',
      'scripts/gate-saturation.mjs',
      'scripts/gate-video.mjs',
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
)
