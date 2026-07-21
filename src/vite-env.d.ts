/// <reference types="vite/client" />

// Build-time constants injected by Vite `define` (see vite.config.ts).
// Declared here so they can be read through `import.meta` without an
// `@ts-ignore` or an `as any` cast. `import.meta.env` (incl. `DEV`) is already
// typed by the `vite/client` reference above.
//
// Typed as `string | undefined`: Vite's `define` keys on bare identifiers and
// does NOT substitute these `import.meta.__X__` member accesses, so at runtime
// they resolve to `undefined` (then coerced via `|| ''`). The declared type
// deliberately does not overstate a runtime guarantee. (Fixing the `define`
// keys is a separate, pre-existing concern, out of scope for issue #63.)
interface ImportMeta {
  readonly __APP_VERSION__: string | undefined;
}
