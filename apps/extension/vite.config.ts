import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

// Main build: background service worker (ESM), popup & options HTML pages
// Content script is built separately via vite.content.config.ts
// because Chrome content scripts can't use ES module imports.
export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[ext]',
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
