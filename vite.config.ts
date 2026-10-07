import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { serviceWorkerPlugin } from './tools/vite-sw-plugin.ts';

// Relative base so the build works on GitHub Pages (/<repo>/), on any static host,
// and inside a Capacitor WebView.
export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  plugins: [serviceWorkerPlugin()],
});
