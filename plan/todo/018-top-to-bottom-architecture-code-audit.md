# Top-To-Bottom Architecture And Code Audit

## Goal

Turn the current fork from a feature-rich demo-heavy toolkit into a more maintainable, faster, and more reliable
batteries-included Deno TUI library. This item tracks the highest-leverage architecture, performance, reliability, and
test improvements found during the July 2026 top-to-bottom audit.

## Baseline

- Branch audited: `main`
- Head audited: `5f83a2b42fbd5e8624c3ceda75b2abd7e75d7bb1`
- Approximate size, excluding generated/vendor/heavy assets: `414` files, `109,892` total lines, `95,590` estimated code
  lines, with `87,226` TypeScript code lines.
- Test baseline: `62` test files and roughly `600` `Deno.test()` declarations. The full health gate recently passed with
  `627` main-suite tests plus web and worker tests.
- Benchmark baseline: current synthetic benchmarks pass, but coverage is skewed toward helpers and controllers rather
  than full-frame canvas redraws, real workbench interaction, Three ASCII GPU readback, and system monitor sampling.

## High-Level Findings

The library now has strong raw material: controller-first widgets, app primitives, runtime scheduling, theming,
windowing, layout, terminal backends, browser runtime, and Three ASCII rendering are all present and tested. The main
risk is that the richest integrations still live in large demo/application files instead of reusable package modules.
That creates drift between terminal and web behavior, makes usability fixes expensive, and hides performance problems
behind manual demo code.

The most important next step is to extract reusable architecture from the workbench, renderer, and monitor demos while
expanding stress and visual tests around the real integration paths.

## Priority Workstreams

### P1: Extract A Shared Workbench Framework

Current evidence:

- `app/api_workbench.ts` is `5,328` lines with roughly `459` declaration-like blocks.
- `examples/web/api_workbench_page.ts` is `2,374` lines with a second copy of many menu, window, hit-target,
  persistence, theme, scrollbar, and modal behaviors.
- Several fixes over the last iteration had to be made separately in terminal and web paths.

Work:

- [ ] Create `src/app/workbench/` for renderer-neutral workbench state, menus, window registry, hit routing, workspace
      persistence, modal lifecycle, dropdown/popover lifecycle, and command dispatch.
- [ ] Move generic frame helpers, hit-target translation, scrollable-window sizing, titlebar button logic, shelf/tab
      logic, and workspace save/load normalization out of `app/api_workbench.ts`.
  - [x] Extracted sparse frame writing, row slicing, text fitting, button labels, and contrast helpers into
        `src/app/workbench_frame.ts` with direct tests.
  - [x] Extracted generic hit-target stack and rectangle geometry helpers into `src/app/hit_targets.ts` with direct
        tests, then migrated API Workbench hit lookup and scroll translation to the stack API.
- [ ] Make the terminal workbench and web workbench thin render adapters over the same controller/model.
  - [x] Exposed the shared frame and hit-target helpers through `src/app/mod.ts` and migrated the web API Workbench page
        to reuse exported text-fit, ANSI-cell, contrast, and geometry helpers.
  - [x] Migrated web API Workbench tiling through `WindowManagerController` so terminal and web layouts share the same
        fullscreen/minimized/adaptive tile engine.
- [x] Replace duplicated theme/window/menu persistence code with a shared versioned serializer.
  - [x] Extracted shared workbench workspace normalization, panel-state normalization, upsert, rename, delete, lookup,
        and legacy window-entry expansion helpers into `src/app/workbench_workspace.ts`.
- [x] Add a migration path for existing saved workspace state.

Acceptance checks:

- [ ] Terminal and web workbenches consume the same core controller package.
- [ ] Shared unit tests cover focus, minimize/maximize/restore/close, scrollbars, dropdowns, modals, workspace
      open/save, and keyboard-only operation.
- [ ] `deno task api-workbench:check`
- [ ] `deno task web:demo:check`
- [ ] `deno task health`

### P1: Add Real Integration Performance Benchmarks

Current evidence:

- Existing benchmarks cover useful controller/helper paths but do not exercise full canvas invalidation, full workbench
  redraw, real ANSI text measurement in rows, Three ASCII render/readback, or `/proc` monitor sampling.
- `Canvas.updateIntersections()` is object-pair and cell-range heavy; movement or resize can force broad redraws.
- The workbench builds virtual frames and full row strings every scheduled draw.

Work:

- [x] Add benchmarks for `Canvas` with many overlapping windows, moving overlays, full-screen modal open/close, and
      resize churn.
- [x] Add a deterministic API Workbench render benchmark using fixed signals and synthetic windows.
- [x] Add text measurement/cropping benchmarks for ANSI-heavy table/list rows and button-heavy titlebars.
- [x] Add system monitor fixture benchmarks for CPU/process/network parsing without touching live `/proc`.
- [x] Add Three ASCII CPU-side grid assembly/readback benchmarks with an injectable renderer or captured buffers.
- [x] Record thresholds in the benchmark catalog and wire the most useful non-flaky cases into health or e2e.

Acceptance checks:

- [x] `deno task benchmark -- --list` documents the new integration cases.
- [x] `deno task benchmark` passes locally with realistic thresholds.
- [ ] At least one benchmark would fail before a naive full redraw or unbounded process scan regression.

### P1: Harden Signals Against Recursive Update Failures

Current evidence:

- Prior workbench/Three panel regressions produced recursive propagation and stack overflow symptoms.
- `Signal.propagate()` and `Computed.update()` propagate synchronously with no transaction boundary, cycle diagnostics,
  or scheduler hook.
- Effects track dependencies asynchronously, which is flexible but makes lifecycle ordering harder to reason about in
  heavy UI code.

Work:

- [x] Add a batched update/transaction API for groups of related signal mutations.
- [x] Add recursion/cycle detection with actionable diagnostics that include the signal/effect inspection path where
      available.
- [ ] Provide a scheduler-backed propagation mode for UI frame updates so noisy state changes coalesce into one draw.
  - [x] Added `SignalBatchScheduler`, an opt-in microtask-backed signal mutation scheduler that flushes coalesced
        callbacks through `batchSignalUpdates()` without changing default synchronous signal semantics.
- [ ] Audit app/workbench/Three panel code and replace ad hoc `queueMicrotask()` draw coalescing where the signal layer
      can own the behavior.
  - [x] Added a reusable `MicrotaskScheduler` runtime primitive and migrated the API Workbench draw scheduler off its
        local `queueMicrotask()` flag.
- [x] Replace string throws in signal/reactivity internals with typed `Error` subclasses.

Acceptance checks:

- [ ] Tests cover self-updating effects, mutually recursive computed values, dispose during propagation, pause/resume,
      and batched mutation ordering.
  - [x] Added coverage for convergent self-updating effects, computed/effect disposal during propagation, and batched
        mutation flush ordering.
- [ ] Existing `tests/signals.test.ts` stays green.
- [ ] Workbench close/rearrange/resize tests include a regression for previous recursive render crashes.

### P1: Improve Canvas Dirty-Region Rendering

Current evidence:

- `Canvas.render()` tracks dirty cells through per-row `Set<number>` queues.
- `Canvas.updateIntersections()` recalculates omit cells by scanning all drawn objects and writing every intersecting
  cell.
- Erase/move paths can iterate cell-by-cell across rectangles and objects under the removed object.

Work:

- [x] Introduce a `DirtyRegion` or row-segment model alongside cell-level queues.
- [x] Add row-range invalidation helpers on `DrawObject` so rectangle, movement, erase, and dirty-overlap paths share
      one clipping path instead of expanding every caller through duplicate cell loops.
- [x] Add a spatial or layer-indexed structure for overlap queries so moved overlays do not require full object scans.
- [x] Cache z-order/version metadata and invalidate only when object order or geometry changes.
- [x] Add optional render stats for dirty rectangle count, dirty cell count, full redraw count, and intersection query
      cost.
- [x] Keep the current cell sink contract stable while allowing future sinks to consume row ranges.
- [x] Add a dedicated DirtyRegion row-segment merge/probe benchmark.

Acceptance checks:

- [x] Snapshot tests prove no stale cells after erase, move, resize, and overlapping z-index changes.
- [x] New benchmarks show improved behavior for many overlapping panes and modal open/close.
- [x] Browser canvas sink and ANSI stdout sink both pass the same render invalidation tests.

### P1: Stabilize Three ASCII Lifecycle And Readback Performance

Current evidence:

- `ThreePanelFrameView` manages renderer visibility, rebuilds, pending destroy/rebuild/sync flags, Kitty graphics, and
  frame timers in one complex class.
- `ThreeAsciiRenderer.computeAnsiGrid()` reads fill, edge, and color GPU buffers every frame and then assembles ANSI
  strings cell-by-cell.
- Renderer lifecycle bugs have appeared when windows close or rearrange while a frame is rendering.

Work:

- [ ] Split Three panel lifecycle into a small state machine with explicit states: idle, initializing, rendering,
      stopping, failed, disposed.
  - [x] Added an inspectable lifecycle state surface covering idle, initializing, rendering, stopping, failed, and
        disposed states before deeper state-machine extraction.
- [x] Add cancel tokens/generation ids so stale frames cannot update disposed or rebuilt panels.
- [x] Pool GPU readback buffers and avoid recreating CPU arrays when size is unchanged.
- [x] Explore packing fill/edge/color output into fewer readbacks or a single mapped buffer.
- [x] Cache repeated ANSI foreground/background sequences within a frame.
- [x] Move Kitty image/ASCII dual-render policy into a reusable renderer option object rather than workbench-local
      conditionals.
- [x] Cache repeated linear-to-sRGB byte conversion during ANSI grid assembly to reduce CPU work on repeated material
      colors without changing terminal output.

Acceptance checks:

- [x] Tests close, resize, hide, maximize, and reconfigure Three windows while frames are in flight.
- [x] Three ASCII benchmarks track CPU grid assembly and GPU readback cost separately.
  - [x] Added a separate deterministic readback-copy benchmark for fill, edge, and color buffer payloads.
- [ ] Workbench and standalone Three demos share the same config normalization and lifecycle helpers.
  - [x] Clamped normalized ASCII numeric config values to the same ranges exposed by shared controls, including
        wireframe thickness `0.5..32`, so saved per-widget configs cannot restore invalid renderer settings.

### P2: Make System Metrics Provider-Based And Testable

Current evidence:

- `app/system_metrics.ts` directly reads Linux `/proc`, `/sys`, `df`, `nvidia-smi`, `Deno.systemMemoryInfo()`, and
  `Deno.networkInterfaces()`.
- Sampling errors are mostly swallowed to keep the UI alive, which hides degraded monitors.
- Process sampling scans all numeric `/proc` entries every interval and sorts the full process list.

Work:

- [x] Extract provider interfaces for CPU, memory, process, disk, network, temperature, and GPU metrics.
- [x] Add Linux provider implementations plus fixture providers for tests and demos.
- [ ] Add structured sampler diagnostics: unavailable source, permission denied, command missing, timeout, stale data,
      and sample duration.
  - [x] Added command-throw degradation for disk sampling and process scan durations in source diagnostics.
- [x] Keep monitor snapshots advancing when required `/proc` reads or process scans fail, with structured per-source
      diagnostics for unavailable CPU, uptime, network, and process data.
- [x] Bound expensive process scans and support configurable process limits, sort keys, and refresh cadence.
- [x] Add GPU provider abstraction for NVIDIA now and future AMD/Intel support later.

Acceptance checks:

- [x] Unit tests use fixture files instead of live `/proc`.
- [x] Workbench monitor windows can display source availability and stale data.
- [x] Process monitor still exposes top 100 rows when configured, but sampler cost is bounded.

### P2: Upgrade Terminal Emulation Toward Real Shell Workflows

Current evidence:

- `TerminalScreenController` supports a useful but small ANSI subset: basic cursor movement, erase, simple SGR, and
  alternate screen.
- `plan/todo/017-terminal-multiplexer-experience.md` already tracks richer tmux-like shell needs.
- Current shell rendering will struggle with full-screen terminal apps, scroll regions, insertion/deletion, OSC title,
  hyperlinks, and truecolor SGR.

Work:

- [ ] Decide whether to embed a maintained VT parser or continue expanding the local parser.
- [ ] Add 256-color and truecolor SGR, cursor visibility/style, save/restore cursor, scroll regions, insert/delete
      line/character, OSC title, hyperlinks, and common DEC private modes.
- [ ] Add parser fuzz/regression fixtures from real shell output, not just hand-authored strings.
- [x] Connect terminal title/OSC state to workbench tabs.
- [ ] Keep process fallback clearly labeled separately from PTY-backed sessions.

Acceptance checks:

- [ ] Terminal screen fixture tests cover common shell prompts, curses apps, alternate screen enter/exit, resize, and
      truecolor output.
- [ ] Workbench shell smoke can run common commands and a simple full-screen app through PTY when available.
- [ ] This todo and `017-terminal-multiplexer-experience.md` have non-overlapping scopes or are merged cleanly.

### P2: Consolidate Layout, Markup, And Widget Hydration

Current evidence:

- The HTML/CSS layout engine has parser, CSS cascade, simple solver, optional Yoga solver, widget hydration, and demo
  code spread across `src/markup/`, `src/layout/`, and `app/html_css_layout_demo.ts`.
- `SimpleLayoutSolver` is already featureful but still approximate compared with CSS flex/grid expectations.
- Layout result boxes include hit regions, overflow dimensions, and z-index, which overlaps with workbench/window hit
  routing concepts.

Work:

- [x] Create a compatibility suite of markup/CSS fixtures with expected terminal-cell boxes.
- [x] Add intrinsic text and widget measurement caches keyed by content, style, and available width.
- [x] Define one overflow/scroll contract shared by layout boxes, pads, scroll areas, and workbench windows.
  - [x] Added policy-aware viewport overflow inspection and shared scrollbar pointer mapping in `src/viewport.ts`, then
        exposed the contract through `ScrollAreaController.inspectOverflow()` while preserving existing inspection
        output.
  - [x] Wired layout result boxes, markup scroll-area hydration, and terminal/web workbench scrollbar rendering directly
        to the shared overflow inspection.
- [x] Move demo-specific hydrated widget examples into reusable fixture/demo modules.
- [x] Expand Yoga parity tests and document unsupported CSS explicitly.

Acceptance checks:

- [x] Layout fixtures run against the simple solver and Yoga solver where supported.
- [x] Workbench can host a markup-created panel using the same scroll and hit routing semantics as hand-built panels.

### P2: Split Theme Architecture Into Smaller Modules

Current evidence:

- `src/theme.ts` is `2,204` lines and owns ANSI styles, tokens, manifests, validation, previews, registries, providers,
  standard component definitions, and reports.
- Theme performance is benchmarked only through standard component coverage generation.

Work:

- [ ] Split theme code by responsibility: ANSI/style primitives, component definitions, manifest parsing/validation,
      provider/registry, previews/reports, and standard packs.
  - [x] Extracted standalone ANSI style primitives into `src/theme_ansi.ts` while preserving `src/theme.ts` re-exports.
- [ ] Add caches for resolved style chains and preview generation with explicit invalidation tests.
- [ ] Add tests that verify theme layer changes invalidate only affected component/token lookups.
- [ ] Keep public exports stable through re-export shims and package-check coverage.

Acceptance checks:

- [ ] `deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=1`
- [ ] Theme tests cover module split compatibility and cache invalidation.
- [ ] No app/demo imports need to reach into internal theme modules.

### P2: Improve Public API Curation

Current evidence:

- Public entrypoints use broad star exports. A quick scan found roughly `268` export lines across package and source
  modules.
- The stability manifest is strong, but broad exports still make accidental surface growth easy.

Work:

- [ ] Keep `mod.ts`, `mod.web.ts`, and `mod.remote.ts` stable, but consider curated subpath modules for advanced areas:
      `layout`, `runtime`, `theme`, `terminal`, `three-ascii`, `testing`, and `experimental`.
- [x] Add an API diff report that groups new exports by stability tier before release.
- [ ] Add package docs that show preferred imports for apps versus framework authors.
- [ ] Reduce accidental demo-only exports from stable entrypoints where possible without breaking current users.

Acceptance checks:

- [ ] Package-check reports stable/beta/experimental export drift separately.
- [ ] API reference groups exports by entrypoint and stability tier.
- [ ] Health fails on accidental stable export growth unless explicitly acknowledged.

### P2: Add Observability And Error Reporting

Current evidence:

- There are many defensive `catch {}` blocks in app/runtime/demo code. Some are appropriate fallback paths, but several
  hide availability or performance issues from users.
- Runtime plans and diagnostics exist, but apps do not consistently surface degraded states.

Work:

- [x] Add a small `DiagnosticsCollector` or app-level logger interface that can be injected into demos and reusable
      controllers.
- [ ] Convert silent fallback paths in system metrics, graphics/Kitty surfaces, storage, audio, and browser storage into
      structured diagnostics where practical.
- [x] Add status-bar and report helpers for degraded backends.
- [x] Add tests that assert expected diagnostics for missing `nvidia-smi`, blocked IndexedDB, unsupported Kitty
      graphics, and failed process spawns.

Acceptance checks:

- [ ] Demos stay usable when optional capabilities are unavailable, but the user can inspect why a feature degraded.
- [ ] Diagnostic output avoids noisy logs in normal operation.

### P3: Modularize Demo-Owned Visualization And Workbench Content

Current evidence:

- `app/visualizations.ts` is `2,375` lines.
- `app/neon_three.ts` is `1,302` lines.
- `app/grwizard_immediate.ts` is `2,490` lines.
- Demo modules contain reusable catalog, rendering, and widget patterns that could be package examples or fixtures.

Work:

- [ ] Split visualization definitions by family: monitor, Neon text, Neon 3D, terminal/workspace, and layout.
- [ ] Move shared visualization metadata and source wiring into a registry module with typed capabilities.
- [ ] Keep rendering functions pure and fixture-testable.
- [ ] Make demo-only assets and NGE-inspired primitives clearly separate from library APIs.

Acceptance checks:

- [ ] Visualization dynamic tests can target individual families.
- [ ] Workbench New Window menu derives from registry metadata without demo-local branching.

## Cross-Cutting Test Plan

- [ ] Add full-frame render invalidation tests for overlapping draw objects, scrollable workspaces, and modals.
- [ ] Add real workbench controller tests after extraction, covering both terminal and web adapters.
- [x] Add browser interaction tests for pointer, touch/coarse pointer, software keyboard text input, and resize
      observer.
- [x] Add terminal parser fixture tests from real shell output and ANSI sequences.
- [ ] Add fixture-driven system metrics tests for Linux, missing GPU, and unavailable permissions.
- [ ] Add property/fuzz tests for layout, selection, viewport, scrollbar pointer mapping, and terminal input decoding.
  - [x] Added deterministic generated invariant coverage for viewport overflow and scrollbar pointer mapping.
  - [x] Added deterministic generated invariant coverage for selection normalization, movement, range, and toggling.
  - [x] Added deterministic generated mixed-buffer coverage for terminal input decoding and incomplete trailing escapes.
- [x] Add stress tests for repeated window open/close/reconfigure while Three ASCII frames are rendering.

## Suggested Execution Order

1. Add missing integration benchmarks and diagnostics first. This gives objective feedback before major refactors.
2. Extract shared workbench state and persistence from terminal/web demos.
3. Introduce signal batching/cycle diagnostics and dirty-region canvas rendering.
4. Stabilize Three ASCII lifecycle and readback performance.
5. Providerize system metrics and upgrade terminal emulation.
6. Split theme/layout/visualization modules once the high-risk behavior has better tests.

## Definition Of Done

- The largest demo/application files shrink because reusable behavior moved into package modules.
- Terminal and web workbenches share core behavior and tests.
- Integration benchmarks cover the actual hot paths users exercise.
- Renderer, signal, and canvas lifecycle regressions have deterministic tests.
- Optional platform failures are visible through diagnostics instead of silent fallback.
- `deno task health`, `deno task benchmark`, web checks, and updated e2e/visual smoke checks all pass.
