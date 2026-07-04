import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const webRoot = fileURLToPath(new URL('.', import.meta.url));
const monorepoRoot = path.resolve(webRoot, '../..');

// Resolve workspace packages from source in dev/build so the PWA does not depend
// on a separately rebuilt dist/ (avoids stale Docker anonymous volumes).
const workspaceAliases = {
  '@clandestino/shared-contracts': path.resolve(
    monorepoRoot,
    'packages/shared-contracts/src/index.ts',
  ),
  '@clandestino/tournament-engine': path.resolve(
    monorepoRoot,
    'packages/tournament-engine/src/index.ts',
  ),
};

// Permite rodar atrás de um reverse proxy (ex.: Caddy em clandestino.test).
// Sem env definida, o comportamento de dev local (localhost:5173) é mantido.
const allowedHosts = process.env.VITE_ALLOWED_HOSTS
  ? process.env.VITE_ALLOWED_HOSTS.split(',')
      .map((host) => host.trim())
      .filter((host) => host.length > 0)
  : undefined;

const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT
  ? Number(process.env.VITE_HMR_CLIENT_PORT)
  : undefined;

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon-*.png', 'icons/*.png', 'browserconfig.xml'],
      manifest: {
        name: 'Clandestino',
        short_name: 'Clandestino',
        description: 'Campeonato Clandestino de Tênis de Mesa',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts,
    hmr: hmrClientPort ? { clientPort: hmrClientPort } : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
            if (req.headers.accept?.includes('text/event-stream')) {
              proxyRes.headers['x-accel-buffering'] = 'no';
              proxyRes.headers['cache-control'] = 'no-cache, no-transform';
            }
          });
        },
      },
    },
  },
});
