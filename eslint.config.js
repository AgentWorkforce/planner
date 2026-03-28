import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.cjs', '**/*.js', '!eslint.config.js'] },

  // Base rules for all TypeScript files
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React hooks rules for frontend packages
  {
    files: ['packages/*-ui/src/**/*.{ts,tsx}', 'packages/shared-ui/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // Prettier must be last to override formatting rules
  prettier,

  // Project-specific rule overrides
  {
    rules: {
      // Allow unused vars prefixed with _
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Allow explicit any for now (too many to fix at once)
      '@typescript-eslint/no-explicit-any': 'warn',
    }
  }
);
