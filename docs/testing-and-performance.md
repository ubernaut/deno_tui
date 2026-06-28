# Testing And Performance

This fork treats demos, tests, and runtime capability checks as part of the public surface.

## Feature Checklist

Every new feature cluster should include:

- A focused public API with small modules and pure helpers where possible.
- Unit tests for helper behavior.
- A runnable demo when the feature changes visible UI behavior.
- Runtime capability detection when using Workers, WebGPU, WebGL, IndexedDB, or other optional platform APIs.
- A fallback path or clear constructor-time failure for unavailable platform APIs.

## Snapshot Helpers

`src/testing/mod.ts` exports helpers for terminal-output tests:

- `stripAnsi(value)` removes ANSI control sequences.
- `normalizeTerminalSnapshot(value)` strips ANSI and trailing cell whitespace.
- `frameBufferToSnapshot(frameBuffer)` turns a canvas frame buffer into normalized text.

These helpers are intentionally small and do not choose a test framework. They work with Deno's built-in test runner.

## Runtime Performance Layer

`src/runtime/mod.ts` exposes:

- `detectRuntimeCapabilities()` for Workers, WebGPU, WebGL, OffscreenCanvas, and IndexedDB.
- `AsyncScheduler` for bounded concurrent async work.
- `WorkerPool` and `installWorkerHandler()` for standards-style worker jobs.
- `MemoryStore` and `IndexedDbStore` for configurable persistence.

Prefer this layer over directly branching on globals inside components. Components should stay deterministic and easy to
test; apps and renderers should decide whether to use Workers, WebGPU, WebGL, IndexedDB, or fallback implementations.
