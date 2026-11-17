import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['iife'],
      name: 'WTB',
      fileName: () => 'wtb.js',
    },
    minify: 'esbuild',
    target: 'es2020',
  },
});
