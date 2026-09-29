/// <reference types="vite/client" />

declare module 'virtual:phosphene-tokens.css';

interface ImportMetaEnv {
  /** Canonical origin, e.g. https://phosphene.example.dev (set at build time). */
  readonly VITE_SITE_URL?: string;
}
