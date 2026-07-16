import { defineConfig } from 'eslint/config';
import baseConfig from '../../eslint.config.js';

export default defineConfig([
  ...baseConfig,
  {
    files: ['src/**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
