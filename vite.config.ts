import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SQLWorkbenchEmbedded',
      formats: ['umd', 'es'],
      fileName: (format) => {
        if (format === 'umd') return 'sql-workbench-embedded.js';
        if (format === 'es') return 'sql-workbench-embedded.esm.js';
        return `sql-workbench-embedded.${format}.js`;
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    sourcemap: true,
    rollupOptions: {
      // Only externalize in production build, not in dev
      external: process.env.NODE_ENV === 'production' ? ['@duckdb/duckdb-wasm'] : [],
      output: {
        globals: {
          '@duckdb/duckdb-wasm': 'duckdb',
        },
      },
    },
  },
  server: {
    open: '/examples/index.html',
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  preview: {
    open: '/examples/index.html',
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
