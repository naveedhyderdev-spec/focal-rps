import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The engine is consumed as source via an alias (no build step), matching the
// monorepo layout in spec §11 (packages/engine is an isolated, tested module).
export default defineConfig({
  // Relative base so the static build works under GitHub Pages' /<repo>/ subpath
  // (and any host) without knowing the repo name.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
