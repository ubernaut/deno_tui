# Repository Overview

This fork has grown into a full terminal application toolkit for Deno. It keeps the original reactive TUI foundation,
then layers a modern app framework, richer widgets, runtime planning, theming engines, concurrency primitives, testing
helpers, and visualization demos on top.

## Module Families

| Path                                                                                                        | Purpose                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mod.ts`, `mod.web.ts`, `mod.remote.ts`                                                                     | Public package entrypoints for the stable terminal package, beta standalone browser package, and experimental remote terminal client/bridge.                                                                                    |
| `src/tui.ts`, `src/canvas/`, `src/component.ts`, `src/view.ts`                                              | Terminal rendering foundation: TUI lifecycle, canvas buffering, draw objects, base components, and scrollable views.                                                                                                            |
| `src/input_reader/`, `src/input.ts`, `src/focus.ts`, `src/keymap.ts`, `src/selection.ts`, `src/viewport.ts` | Input decoding, keyboard/mouse/paste/focus events, focus traversal, key registries, selection helpers, and viewport math.                                                                                                       |
| `src/components/`                                                                                           | Widget library and controllers: inputs, menus, tables, virtual lists, pads, trees, dashboards, feedback components, and `ThreeAscii`.                                                                                           |
| `src/layout/`                                                                                               | Flex, split pane, responsive breakpoint, and layout recipe helpers.                                                                                                                                                             |
| `src/app/`                                                                                                  | High-level app primitives: `TuiApp`, actions, routes, commands, settings, plugins, mouse routing, command surfaces, and component-specific command adapters.                                                                    |
| `src/runtime/`                                                                                              | Capability detection, runtime/terminal plans, terminal session setup, scheduler, render loop, worker pool, stores, cached resources, data pipelines, data queries, renderer backend registry, profiles, and workload telemetry. |
| `src/theme*.ts`                                                                                             | Theme tokens, palettes, packs, provider/layer orchestration, engine factories, pipelines, resolver/cache helpers, workspace composition, gallery previews, and component bindings.                                              |
| `src/three_ascii/`                                                                                          | Three.js ASCII renderer backend, Acerola-style node, glyph/block/mixed terminal glyph mapping, presets, and WebGPU compatibility helpers.                                                                                       |
| `src/testing/`                                                                                              | Snapshot, test canvas/stdout, deterministic input, and focus test helpers.                                                                                                                                                      |
| `src/perf/`                                                                                                 | Benchmark runner, summaries, threshold checks, and benchmark catalog reports.                                                                                                                                                   |
| `src/api_stability.ts`                                                                                      | Package entrypoint manifest, source-tree stability policy, and release checklist metadata.                                                                                                                                      |
| `app/`                                                                                                      | Full-screen demos and applications, including the system monitor, showcase, API Workbench, Neon Three scenes, and panel/source models.                                                                                          |
| `examples/`                                                                                                 | Focused runnable examples and report-style demos for individual subsystems.                                                                                                                                                     |
| `scripts/`                                                                                                  | Contributor tooling: health gate, API inventory, benchmark runner, capability report, component catalog, and visualization launcher metadata.                                                                                   |

For a complete generated list of public modules, re-exports, and symbols, see [API Reference](./api-reference.md). For
terminal parser and PTY/process backend scope, see [Terminal Emulation Strategy](./terminal-emulation-strategy.md).

## Core Capabilities

- Reactive rendering with `Signal`, `Computed`, `Effect`, lazy computed/effect variants, and component bindings.
- Canvas-based terminal drawing with z-ordering, intersection-aware repainting, render inspection, and snapshot helpers.
- Keyboard and mouse input with xterm-style function key decoding, SGR/VT mouse support, drag/release routing, bracketed
  paste payloads, terminal focus events, browser parity events, and test event factories.
- Grapheme-aware text measurement and ANSI-preserving cropping for CJK wide cells, combining marks, emoji, and styled
  table/list content.
- Controller-first widgets so state, command wiring, rendering, and tests remain separable, including curses-style pads
  for large off-screen text surfaces.
- App-level composition through `TuiApp`, `ActionBus`, `RouteManager`, `CommandRegistry`, focus/keymap/mouse managers,
  settings bindings, undo/redo history, and rollback-safe plugins.
- Catalog/report APIs for components, app plugins, runtime workloads, runtime profiles, renderer backends, theme
  factories, benchmarks, launch targets, and public exports.
- Runtime plans for Workers, WebGPU, WebGL, OffscreenCanvas, IndexedDB, terminal color depth, Unicode, mouse protocols,
  bracketed paste, focus events, hyperlinks, alternate screen, and terminal setup/teardown sequences.
- Process output sessions for managed command windows with stdout/stderr scrollback, exit metadata, cancellation,
  restart, and command-surface bindings.
- Concurrent and cacheable data primitives: `AsyncScheduler`, `WorkerPool`, `AsyncResource`, `CachedAsyncResource`,
  `DataQueryController`, `runDataPipeline()`, `LatestDataPipeline`, and `CachedDataPipeline`.
- Theme system with semantic tokens, palette presets, theme packs, provider layers, engine factories, pipelines,
  workspace orchestration, resolver caches, validation, previews, and component binding groups.
- Three.js ASCII rendering with block, glyph, and mixed terminal modes, preset reports, WebGPU/WebGL/CPU backend
  planning, and system-monitor integration.

## Demos And Reports

Use the root launcher for the most common demos:

```sh
./visualization showcase
./visualization neon
./visualization monitor
./visualization polygons
./visualization dashboard
./visualization adopter
./visualization components
./visualization plugins
./visualization window-manager
./visualization workspace-launcher
./visualization gallery
./visualization batteries
./visualization health
```

Direct Deno tasks expose the same surfaces:

```sh
deno task showcase
deno task neon-exodus
deno task viz
deno task three-ascii
deno task dashboard
deno task form-workflow
deno task table-selection
deno task window-manager
deno task workspace-launcher
deno task terminal-command
deno task capabilities
deno task component-catalog
deno task app-plugin-catalog
deno task adopter-workbench
deno task demo-gallery
deno task batteries
deno task screenshots
deno task benchmark
deno task health
```

`./visualization neon` is the dedicated Neon Exodus suite. It starts with the OpenTUI implementation's 24-demo deck,
adds a web-ordering mode for the browser demo layout, and includes an extended mode with this fork's Acerola ASCII
studio scene. The app uses this library's raw TUI canvas, panel views, synthetic source drives, and three.js ASCII
renderer instead of React/OpenTUI or browser DOM primitives.

The report-style examples are intended for adopters and CI because they type-check quickly and print deterministic
Markdown/text output. `examples/adopter_workbench.ts` is the broadest example: it combines terminal planning, terminal
session sequences, component catalog queries, plugin registry reports, theme gallery matching, and local data query
pagination in one short integration path. `examples/demo_gallery.ts` is the quick tour report: it summarizes the
launcher catalog, widget catalog, renderer backends, theme provider, plugin packs, runtime capabilities, terminal
capabilities, and recommended demo path. `examples/batteries_included.ts` is the phase 1-6 readiness report and ties
each phase to proof commands. `examples/form_workflow.ts`, `examples/table_selection_workflow.ts`, and
`examples/terminal_command_workflow.ts` are API capability demos for form bindings, command adapters, data table state,
selection state, command search/dispatch, and terminal session setup. `deno task screenshots` regenerates the JPEG
terminal screenshots used by the README under `docs/screenshots/`. `app/api_workbench.ts` is the interactive portfolio
for the same APIs and now includes a New-menu `Terminal Output` window that runs a real subprocess inside the managed
window layout. The terminal-window layer also exposes backend handles, a lazy backend registry, an optional Sigma PTY
FFI adapter, spawn templates for shell/Deno/project commands, attach-session metadata, screen cells, and
`syncTerminalWindowLayout()` for propagating window-manager geometry into terminal session dimensions.
`summarizeTerminalStatus()` turns process inspections, backend handles, and persisted terminal descriptors into compact
status-bar rows. `WindowManagerController` now supports explicit upsert, rename, and reorder operations, and
`windowManagerCommands()` binds those window actions into the same command-registry system as the rest of the app
surface. The API Workbench Terminal Output window exposes workbench/raw input modes so focused terminal panes can either
keep global shortcuts active or route printable keys to child stdin with visible mode/status indicators.

Remote terminal support lives in `src/web/remote_terminal.ts`: clients encode browser input and resize events, while
`RemoteTerminalBridge` connects an explicit transport to a `TerminalSessionHandle` and forwards output, binary frames,
errors, and close messages over the same protocol.

## Quality Gates

The default contributor gate is:

```sh
deno task health
```

It checks formatting, public API exports, API inventory uniqueness, package export-map drift, documentation coverage,
examples, apps, the full test suite, and worker-enabled runtime tests. `deno task package-check -- --quiet` also
prevents new `src/app/*` and Workbench implementation modules from being added to the stable root export graph by
accident. Existing app helpers are grandfathered for compatibility, but new app/demo internals should use focused
entrypoints or direct local imports until they are intentionally promoted.

The API inventory gate currently enforces duplicate-free public exports and 100% JSDoc coverage:

```sh
deno task package-check -- --quiet
deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=1 --baseline=docs/api-stable-baseline.json
```

Regenerate the full public API reference with:

```sh
deno task api-reference > docs/api-reference.md
```

Regenerate README screenshots with:

```sh
deno task screenshots
```

Use `deno task benchmark` for timing smoke checks, `deno task benchmark -- --list` for the benchmark catalog, and
`deno task benchmark -- --json` for structured threshold-aware output.

## Where To Extend

- Add reusable components in `src/components/`, then register metadata in `src/components/catalog.ts`.
- Add app-wide behavior as plugin definitions in `src/app/` and expose reportable metadata through app plugin catalogs.
- Add optional platform behavior through `src/runtime/` with injected dependencies and deterministic tests.
- Add theme packs, factories, pipelines, or workspace orchestration through the theme modules rather than hard-coding
  styles in widgets.
- Add visualization scenes under `app/` or renderer primitives under `src/three_ascii/`, then expose launch metadata via
  `scripts/visualization_launcher.ts`.
- Add runnable examples under `examples/` and wire important ones into `deno task health`.
