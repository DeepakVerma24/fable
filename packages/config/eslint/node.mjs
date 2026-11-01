import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Shared lint preset for Node packages and services.
 * The web app does not use this preset. Next.js ships eslint-config-next,
 * and stacking a second TypeScript preset on the same files duplicates rules.
 */
export function createNodeEslintConfig(tsconfigRootDir) {
  return tseslint.config(
    {
      ignores: ['dist/**', 'coverage/**', 'generated/**', 'src/generated/**'],
    },
    ...tseslint.configs.recommended,
    prettier,
    {
      languageOptions: {
        parserOptions: {
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },
  );
}
