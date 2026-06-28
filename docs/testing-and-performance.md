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
- `createTestStdout()` captures canvas writes in memory.
- `createTestCanvas({ size })` creates a canvas with deterministic in-memory stdout.
- `canvasSnapshot(canvas)` and `canvasRowText(canvas, row, width)` read rendered output from a canvas frame buffer.
- `compareTerminalSnapshot(actual, expected)` returns normalized text plus bounded line/column mismatches.
- `formatTerminalSnapshotDiff(comparison)` formats those mismatches for readable test failures.
- `assertTerminalSnapshot(actual, expected)` throws that formatted diagnostic when snapshots differ.
- `createTestKeyPress()` and `createTestMouseScroll()` build deterministic input events without reading from a TTY.
- `createTestFocusable()` and `TestKeyPressTarget` make focus/navigation tests independent of real components.

These helpers are intentionally small and do not choose a test framework. They work with Deno's built-in test runner.

## Runtime Performance Layer

`src/runtime/mod.ts` exposes:

- `detectRuntimeCapabilities()` plus `summarizeRuntimeCapabilities()` / `formatRuntimeCapabilities()` for Workers,
  WebGPU, WebGL, OffscreenCanvas, and IndexedDB diagnostics.
- `AsyncScheduler` for bounded, prioritized, and abortable queued async work.
- `WorkerPool`, `installWorkerHandler()`, and `workerTransform()` for standards-style worker jobs and pipeline stages.
- `MemoryStore` and `IndexedDbStore` for configurable persistence.

Prefer this layer over directly branching on globals inside components. Components should stay deterministic and easy to
test; apps and renderers should decide whether to use Workers, WebGPU, WebGL, IndexedDB, or fallback implementations.
`WorkerPool.run(payload, { signal })` can abort pending callers, `pendingCount()` exposes lightweight backpressure
state, and `workerFactory` lets tests inject a deterministic worker without starting real threads.

`BenchmarkRunner` supports per-case `iterations`, `warmupIterations`, `maxAverageMs`, and `maxTotalMs`. Pass `{ now }`
in `BenchmarkRunnerOptions` to make benchmark unit tests deterministic, use `summarize()` or
`summarizeBenchmarkResults()` for pass/fail reporting, and format output with `formatBenchmarkResults()`.

Run the default suite without broad permissions:

```bash
deno test
```

Run the contributor health gate:

```bash
deno task health
```

Inspect the public re-export graph before release:

```bash
deno task api-inventory
deno task api-inventory -- --json
deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=0.09
```

The inventory reports crawled modules, re-export declarations, exported symbol counts, missing local targets, and
duplicate public symbol names. The contributor health gate runs the quiet check with duplicate failure enabled and a 9%
documentation coverage baseline that can be raised as public JSDoc coverage improves.

Run the worker integration path with permissions:

```bash
deno task test:workers
```
