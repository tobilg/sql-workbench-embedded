import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import pkg from './package.json';
import { minify as terserMinify } from 'terser';

const banner = `/**
 * SQL Workbench Embedded v${pkg.version}
 * ${pkg.description}
 * https://github.com/tobilg/sql-workbench-embedded
 * (c) ${new Date().getFullYear()} ${pkg.author} - ${pkg.license} License
 */
`;

// Custom plugin to minify ESM build and add banner
const minifyESM = (): Plugin => ({
  name: 'minify-esm',
  apply: 'build',
  async generateBundle(_options, bundle) {
    for (const fileName in bundle) {
      const chunk = bundle[fileName];
      if (chunk.type === 'chunk' && fileName.endsWith('.esm.js')) {
        const minified = await terserMinify(chunk.code, {
          compress: {
            drop_console: true,
          },
          format: {
            comments: false,
            preamble: banner,
          },
          sourceMap: false,
        });
        if (minified.code) {
          chunk.code = minified.code;
        }
      }
    }
  },
});

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true, // Bundle all .d.ts files into a single file
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**', 'examples/**', 'node_modules/**'],
    }),
    minifyESM(),
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
      format: {
        comments: false,
        preamble: banner,
      },
    },
    sourcemap: process.env.NODE_ENV !== 'production',
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
