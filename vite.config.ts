import { defineConfig } from 'vite';
import { createApi } from './server/api.mjs';

export default defineConfig({
  plugins: [{
    name: 'family-garage-api',
    configureServer(server) {
      const api = createApi();
      server.middlewares.use((req, res, next) => {
        api.handle(req, res).then((handled) => { if (!handled) next(); }).catch(next);
      });
      server.httpServer?.once('close', () => api.close());
    },
    configurePreviewServer(server) {
      const api = createApi();
      server.middlewares.use((req, res, next) => {
        api.handle(req, res).then((handled) => { if (!handled) next(); }).catch(next);
      });
      server.httpServer?.once('close', () => api.close());
    },
  }],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
  },
});
