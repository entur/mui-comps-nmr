/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

/**
 * Vite "library mode" build config.
 *
 * Emits the public entry (`src/index.ts`) as both modern ES modules (`.js`,
 * imported with `import`) and CommonJS (`.cjs`, loaded with `require`), plus
 * TypeScript declaration files (`.d.ts`) for consumer type-checking. React,
 * MUI, and Emotion are externalised (treated as peer dependencies) so the host
 * app supplies a single shared copy instead of bundling duplicates.
 */
const EXTERNAL = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@mui/material',
  '@mui/icons-material',
  '@mui/x-data-grid',
  '@emotion/react',
  '@emotion/styled',
];

export default defineConfig({
  plugins: [react(), dts({ rollupTypes: true, tsconfigPath: './tsconfig.json' })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: fmt => (fmt === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: id => EXTERNAL.some(p => id === p || id.startsWith(`${p}/`)),
    },
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
