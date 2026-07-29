// Copyright 2023 Im-Beast. MIT license.

// Sole entry point for the Three.js-backed ASCII renderer. Everything that
// reaches `npm:three` lives behind this specifier so the core barrels stay
// free of it; the canvas object and component are re-exported here because
// `src/canvas/mod.ts` and `src/components/mod.ts` no longer carry them.
export * from "./src/three_ascii/mod.ts";
export * from "./src/canvas/three_ascii.ts";
export * from "./src/components/three_ascii.ts";
