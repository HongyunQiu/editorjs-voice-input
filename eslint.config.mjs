import CodeX from 'eslint-config-codex'
import { plugin as TsPlugin, parser as TsParser } from 'typescript-eslint'

export default [
  ...CodeX,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: TsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': TsPlugin,
    },
    rules: {
      'n/no-missing-import': ['off'],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: ['dist/**', 'dev/**', 'eslint.config.mjs', 'vite.config.js'],
  },
]
