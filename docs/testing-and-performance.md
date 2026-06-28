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
- `Canvas.inspectRender()` reports the most recent render pass, including updated objects, intersection recalculations,
  and flushed cells for repaint regression tests.
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
- `detectTerminalCapabilities()` plus `createTerminalPlan()` / `formatTerminalPlan()` for deterministic color, Unicode,
  mouse protocol, bracketed paste, hyperlink, and alternate-screen decisions.
- `terminalSessionSequences()` and `createTerminalSessionController()` for testable terminal enter/exit setup with an
  injectable writer.
- `RuntimeProfile`, `RuntimeProfileRegistry`, and runtime profile catalog helpers for named, queryable policies such as
  balanced, throughput, portable, and ephemeral execution.
- `inspectRuntimeWorkload()`, `createRuntimeWorkloadReport()`, and `formatRuntimeWorkloadMarkdown()` for scheduler and
  worker-pool pressure telemetry.
- `AsyncScheduler` for bounded, prioritized, and abortable queued async work.
- `RenderLoop` for inspectable terminal frame loops with injectable timers.
- `WorkerPool`, `installWorkerHandler()`, and `workerTransform()` for standards-style worker jobs and pipeline stages.
- `MemoryStore` and `IndexedDbStore` for configurable persistence.
- `CachedAsyncResource` and `CachedDataPipeline` for optional store-backed restore paths before fresh async work
  completes.
- `DataQueryController` plus `queryLocalData()` for cacheable async datasets with normalized search, filter, sort, and
  pagination state.

Prefer this layer over directly branching on globals inside components. Components should stay deterministic and easy to
test; apps and renderers should use runtime and terminal plans to decide whether to use Workers, WebGPU, WebGL,
IndexedDB, Unicode glyphs, mouse protocols, or fallback implementations. `WorkerPool.run(payload, { signal })` can abort
pending callers, `pendingCount()` exposes lightweight backpressure state, and `workerFactory` lets tests inject a
deterministic worker without starting real threads. Use `createRuntimeWorkloadReport()` when a demo, settings pane, or
CI log needs one view over both scheduler queues and worker pools. It reports capacity, running work, queued work,
saturation, idle state, and termination state without requiring callers to special-case each runtime primitive.

`DataQueryController` is the shared runtime primitive for async table, catalog, picker, and dashboard datasets. It wraps
`CachedAsyncResource`, exposes normalized `params`, `state`, and `result` signals, and keeps query, filter, sort, page,
and page-size mutations testable without coupling the data source to a specific widget. Use `queryLocalData()` for
in-memory rows, or provide an async loader that calls a service, worker, IndexedDB store, or WebGPU/WebGL-backed
preprocessor before returning a `DataQueryResult`. `bindDataQueryParams()` connects search/filter/page signals to async
loads, while `bindDataQueryResult()` and `bindDataQueryTable()` project query pages into row signals or
`DataTableController` instances. `bindDataQuerySetting()` persists query params through app settings, and
`bindDataQueryCommands()` exposes reload, restore, cache clearing, query/filter clearing, paging, page-size, and sort
operations to command palettes, menus, and keymaps. `createDataQueryPlugin()` packages those bindings behind the same
rollback-safe app plugin lifecycle used by runtime profiles and themes. Run `deno task data-query` for a cache-backed
process query demo.

`createAppPluginDefinitionRegistry()` keeps plugin catalogs testable when apps discover route, command, keymap, runtime,
theme, or data-query modules dynamically. The registry supports replacement-safe registration, filtered reports, and
Markdown output, so docs, launcher screens, and marketplace-style settings panes can use one source of truth. Run
`deno task app-plugin-catalog` for the built-in plugin registry report.

Runtime profiles let apps expose strategy choices as data instead of hard-coded conditionals. A settings pane can show
`RuntimeProfileRegistry.catalog()`, keep the selected profile in a `RuntimeProfileController`, persist it with
`bindRuntimeProfileSetting()`, and expose `bindRuntimeProfileCommands()` through command palettes or menus.
`createRuntimeProfilePlugin()` installs that controller, command surface, optional keymap mirroring, and setting
persistence through the same disposable app-plugin lifecycle as theme and route modules. Run `deno task capabilities`
for the current capability summary, default plan, and built-in profile table, or `deno task capabilities -- --json` for
machine-readable reports.

`BenchmarkRunner` supports per-case `category`, `description`, `tags`, `iterations`, `warmupIterations`, `maxAverageMs`,
and `maxTotalMs`. Pass `{ now }` in `BenchmarkRunnerOptions` to make benchmark unit tests deterministic, use
`summarize()` or `summarizeBenchmarkResults()` for pass/fail reporting, and format output with
`formatBenchmarkResults()` or `formatBenchmarkSummary()`. Summaries include aggregate `totalMs` and `averageMs` fields
for CLI reports and machine-readable logs. Use `inspect()` plus `createBenchmarkCatalogReport()` or
`formatBenchmarkCatalogMarkdown()` to expose benchmark metadata in docs, settings screens, CI summaries, and launchers
without running workloads. Run `deno task benchmark -- --list` for the readable catalog,
`deno task benchmark -- --list --json` for structured catalog output, or `deno task benchmark -- --json` for structured
timing output; threshold failures exit nonzero.

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
deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=0.25
deno task api-reference > docs/api-reference.md
```

The inventory reports crawled modules, re-export declarations, exported symbol counts, missing local targets, and
duplicate public symbol names. The contributor health gate runs the quiet check with duplicate failure enabled and an
25% documentation coverage baseline that can be raised as public JSDoc coverage improves. The generated
`docs/api-reference.md` file expands that inventory into a complete public module and symbol reference.

Run the worker integration path with permissions:

```bash
deno task test:workers
```
