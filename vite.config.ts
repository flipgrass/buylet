import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['iife'],
      name: 'WTB',
      fileName: () => 'wtb.js',
    },
    target: 'es2020',
  },
});
