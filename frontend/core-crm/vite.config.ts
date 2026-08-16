import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `loadEnv` is required, not optional: Vite exposes .env values to app code
  // through `import.meta.env`, but this config file runs in Node before that
  // exists, and .env is NOT merged into `process.env`. Reading
  // `process.env.VITE_API_TARGET` alone would silently ignore .env.local and
  // only ever see a variable typed on the command line.
  //
  // The '' prefix loads every key, not just VITE_-prefixed ones. That is safe
  // here because nothing from `env` is handed to client code — it only picks
  // the dev-server proxy target below.
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
        // Routed through the gateway (nginx), not core-api directly — the
        // gateway is the only backend port docker-compose actually publishes
        // to the host (core-api/reporting-api/integrations-api are internal
        // `expose`-only), and it's also what path-routes /api/v1/reporting/*
        // and /api/v1/integrations/* to their own services.
        //
        // Set VITE_API_TARGET in .env.local (see .env.example) to run this
        // dev server against a deployed box instead.
        //
        // Proxying rather than pointing the browser at the remote origin is
        // what makes login work at all: the auth cookies are
        // SameSite=lax/strict, which a browser will not store or send on a
        // cross-site request. Going through this proxy keeps everything
        // same-origin on localhost as far as the browser is concerned.
        // `secure: false` tolerates the self-signed certificate the dev box
        // serves until Let's Encrypt issuance is unblocked.
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
