import { defineConfig } from 'vite';
import { resolve } from 'path';

// Content script build: IIFE, no code splitting
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/content/index.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
        inlineDynamicImports: true,
      },
    },
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tong/core': resolve(__dirname, 'src/lib/core/index.ts'),
      '@tong/subtitles': resolve(__dirname, 'src/lib/subtitles/index.ts'),
      '@tong/romanization': resolve(__dirname, 'src/lib/romanization/index.ts'),
      '@tong/cjk-data': resolve(__dirname, 'src/lib/cjk-data/index.ts'),
    },
  },
});
