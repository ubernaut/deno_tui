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
- `createRuntimePlan()` / `formatRuntimePlan()` for deterministic worker, storage, and renderer fallback decisions.
- `RuntimeProfile`, `RuntimeProfileRegistry`, and runtime profile catalog helpers for named, queryable policies such as
  balanced, throughput, portable, and ephemeral execution.
- `AsyncScheduler` for bounded, prioritized, and abortable queued async work.
- `RenderLoop` for inspectable terminal frame loops with injectable timers.
- `WorkerPool`, `installWorkerHandler()`, and `workerTransform()` for standards-style worker jobs and pipeline stages.
- `MemoryStore` and `IndexedDbStore` for configurable persistence.
- `CachedAsyncResource` and `CachedDataPipeline` for optional store-backed restore paths before fresh async work
  completes.

Prefer this layer over directly branching on globals inside components. Components should stay deterministic and easy to
test; apps and renderers should use a runtime plan to decide whether to use Workers, WebGPU, WebGL, IndexedDB, or
fallback implementations. `WorkerPool.run(payload, { signal })` can abort pending callers, `pendingCount()` exposes
lightweight backpressure state, and `workerFactory` lets tests inject a deterministic worker without starting real
threads.

Runtime profiles let apps expose strategy choices as data instead of hard-coded conditionals. A settings pane can show
`RuntimeProfileRegistry.catalog()`, keep the selected profile in a `RuntimeProfileController`, persist it with
`bindRuntimeProfileSetting()`, and expose `bindRuntimeProfileCommands()` through command palettes or menus.
`createRuntimeProfilePlugin()` installs that controller, command surface, optional keymap mirroring, and setting
persistence through the same disposable app-plugin lifecycle as theme and route modules. Run `deno task capabilities`
for the current capability summary, default plan, and built-in profile table, or `deno task capabilities -- --json` for
machine-readable reports.

`BenchmarkRunner` supports per-case `iterations`, `warmupIterations`, `maxAverageMs`, and `maxTotalMs`. Pass `{ now }`
in `BenchmarkRunnerOptions` to make benchmark unit tests deterministic, use `summarize()` or
`summarizeBenchmarkResults()` for pass/fail reporting, and format output with `formatBenchmarkResults()` or
`formatBenchmarkSummary()`. Summaries include aggregate `totalMs` and `averageMs` fields for CLI reports and
machine-readable logs. Run `deno task benchmark -- --json` for structured output; threshold failures exit nonzero.

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
deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=0.18
```

The inventory reports crawled modules, re-export declarations, exported symbol counts, missing local targets, and
duplicate public symbol names. The contributor health gate runs the quiet check with duplicate failure enabled and an
18% documentation coverage baseline that can be raised as public JSDoc coverage improves.

Run the worker integration path with permissions:

```bash
deno task test:workers
```
