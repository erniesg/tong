import { defineConfig } from 'vite';
import { resolve } from 'path';

// Interceptor script build: IIFE, runs in YouTube's MAIN world
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/content/interceptor.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'interceptor.js',
        inlineDynamicImports: true,
      },
    },
    sourcemap: false,
    minify: process.env.NODE_ENV === 'production',
  },
});
