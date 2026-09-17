/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the FastAPI backend, without trailing slash (e.g. http://localhost:8000). */
  readonly VITE_API_URL?: string;
  /** Neon Auth URL of the branch (Neon Console > Auth). Empty = Google / GitHub sign-in hidden. */
  readonly VITE_NEON_AUTH_URL?: string;
  /** Comma-separated OAuth providers configured in Neon Auth: "google", "github" or "google,github". */
  readonly VITE_OAUTH_PROVIDERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
