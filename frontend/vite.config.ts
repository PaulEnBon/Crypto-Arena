/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split heavy libraries from the app bundle for better caching. The Neon Auth SDK is only
        // imported dynamically, so its chunk is downloaded when a Google / GitHub sign-in starts.
        manualChunks: { recharts: ['recharts'], 'neon-auth': ['@neondatabase/auth'] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
