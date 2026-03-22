import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

/**
 * Dev-only plugin: serves src/sw.ts (transformed by Vite) at /arc-pwa-sw.js
 * so the Service Worker is reachable at a root-scope URL during development.
 */
function swDevPlugin(): Plugin {
  return {
    name: 'arc-pwa-sw-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/arc-pwa-sw.js', async (_req, res, next) => {
        const result = await server.transformRequest('/src/sw.ts');
        if (result) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.end(result.code);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    swDevPlugin(),
    dts({
      include: ['src'],
      exclude: ['src/sw.ts'],  // SW runs in a different global scope
      rollupTypes: true,
      insertTypesEntry: true,
    }),
  ],

  server: {
    port: 3000,
    open: '/examples/basic/',
  },

  build: {
    outDir: 'dist',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        'arc-pwa': resolve(__dirname, 'src/index.ts'),
        'arc-pwa-sw': resolve(__dirname, 'src/sw.ts'),
      },
      preserveEntrySignatures: 'strict',
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
