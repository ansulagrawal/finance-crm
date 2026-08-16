/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute origin of the API, baked in at build time — see `lib/api.ts`.
   * Leave unset for local development, where Vite proxies `/api` itself.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
