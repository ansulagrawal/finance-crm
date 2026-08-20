import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // See core-crm/vite.config.ts for why loadEnv (not process.env) is required
  // here, and why only the proxy target is read from it.
  const env = loadEnv(mode, import.meta.dirname, '');
  const apiTarget =
    env.VITE_API_TARGET ??
    process.env.VITE_API_TARGET ??
    'http://localhost:8080';

  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      proxy: {
        // Same reasoning as core-crm: proxying through the gateway keeps
        // requests same-origin so the SameSite=lax/strict auth cookies work.
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
