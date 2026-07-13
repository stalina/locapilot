/// <reference types="vite/client" />

// Build-time constants injected by Vite `define` (see vite.config.ts).
// Declared here so they can be read through `import.meta` without an
// `@ts-ignore` or an `as any` cast. `import.meta.env` (incl. `DEV`) is already
// typed by the `vite/client` reference above.
interface ImportMeta {
  readonly __APP_VERSION__: string;
  readonly __BUILD_SECRET_KEY__: string;
}
