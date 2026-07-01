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
  - [x] Added `src/app/workbench/mod.ts` as a renderer-neutral facade over the extracted helper modules, with a smoke
        test covering representative frame, viewport, titlebar, and hit-target exports.
  - [x] Routed the public app barrel through `src/app/workbench/mod.ts` so root exports, terminal demos, and web demos
        share one workbench helper boundary without changing the stable API inventory.
  - [x] Extracted renderer-neutral top-menu disclosure/focus state into `WorkbenchTopMenuController` and wired terminal
        plus web workbench adapters through it.
- [x] Move generic frame helpers, hit-target translation, scrollable-window sizing, titlebar button logic, shelf/tab
      logic, and workspace save/load normalization out of `app/api_workbench.ts`.
  - [x] Extracted sparse frame writing, row slicing, text fitting, button labels, and contrast helpers into
        `src/app/workbench_frame.ts` with direct tests.
  - [x] Extracted generic hit-target stack and rectangle geometry helpers into `src/app/hit_targets.ts` with direct
        tests, then migrated API Workbench hit lookup and scroll translation to the stack API.
  - [x] Extracted shared hit-target translation and clipping for virtual workspace/content render passes, replacing
        local terminal and web adapter loops.
  - [x] Extracted reusable New Window option registry helpers into `src/app/workbench_window_registry.ts`, covering
        built-ins, visualization grouping, loaded-state labels, managed visualization ids, and minimum window sizes.
  - [x] Extracted shared dropdown/menu key helpers into `src/app/workbench_menu.ts` and migrated terminal/web workbench
        dropdown handlers to the same movement, activation, and close semantics.
  - [x] Extracted renderer-neutral titlebar control layout into `src/app/workbench_titlebar.ts` and migrated terminal/
        web workbench titlebar button hit geometry to it.
  - [x] Extracted renderer-neutral minimized shelf and fullscreen tab layout into `src/app/workbench_shelf.ts` and
        migrated terminal/web shelf hit geometry to it.
  - [x] Extracted scrollbar-aware content viewport sizing into `src/app/workbench_viewport.ts` with direct coverage for
        coupled horizontal/vertical overflow.
  - [x] Extracted shared active-window reveal scroll math into `src/app/workbench_viewport.ts` and migrated terminal/web
        workspace auto-scroll behavior to it.
  - [x] Extracted per-window Three ASCII config signal ownership and option stepping helpers into
        `src/app/workbench_ascii.ts`, reducing workbench-local renderer config state and making modal control behavior
        directly testable.
- [ ] Make the terminal workbench and web workbench thin render adapters over the same controller/model.
  - [x] Exposed the shared frame and hit-target helpers through `src/app/mod.ts` and migrated the web API Workbench page
        to reuse exported text-fit, ANSI-cell, contrast, and geometry helpers.
  - [x] Migrated web API Workbench tiling through `WindowManagerController` so terminal and web layouts share the same
        fullscreen/minimized/adaptive tile engine.
- [x] Replace duplicated theme/window/menu persistence code with a shared versioned serializer.
  - [x] Extracted shared workbench workspace normalization, panel-state normalization, upsert, rename, delete, lookup,
        and legacy window-entry expansion helpers into `src/app/workbench_workspace.ts`.
  - [x] Promoted the terminal workbench JSON-file fallback store into `JsonFileStore` in `src/runtime/storage.ts`,
        leaving the workbench on the shared `AsyncStore` abstraction instead of demo-local file persistence.
- [x] Add a migration path for existing saved workspace state.

Acceptance checks:

- [x] Terminal and web workbenches consume the same core controller package.
  - [x] `app/api_workbench.ts`, `src/app/mod.ts`, and `examples/web/api_workbench_page.ts` now reach shared workbench
        frame, hit, menu, shelf, titlebar, viewport, window-registry, and workspace helpers through exported facade
        paths.
- [x] Shared unit tests cover focus, minimize/maximize/restore/close, scrollbars, dropdowns, modals, workspace
      open/save, and keyboard-only operation.
  - [x] Coverage now spans `window_manager_usability`, `workbench_menu`, `workbench_titlebar`, `workbench_shelf`,
        `workbench_viewport`, `workbench_workspace`, `workbench_terminal`, and widget command/controller tests.
- [x] `deno task api-workbench:check`
- [x] `deno task web:demo:check`
- [x] `deno task health`

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
- [x] At least one benchmark would fail before a naive full redraw or unbounded process scan regression.

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
- [x] Provide a scheduler-backed propagation mode for UI frame updates so noisy state changes coalesce into one draw.
  - [x] Added `SignalBatchScheduler`, an opt-in microtask-backed signal mutation scheduler that flushes coalesced
        callbacks through `batchSignalUpdates()` without changing default synchronous signal semantics.
- [x] Audit app/workbench/Three panel code and replace ad hoc `queueMicrotask()` draw coalescing where the signal layer
      can own the behavior.
  - [x] Added a reusable `MicrotaskScheduler` runtime primitive and migrated the API Workbench draw scheduler off its
        local `queueMicrotask()` flag.
  - [x] Moved `ThreePanelFrameView` signal-driven sync requests onto `SignalBatchScheduler` with stable same-tick
        coalescing.
- [x] Replace string throws in signal/reactivity internals with typed `Error` subclasses.

Acceptance checks:

- [x] Tests cover self-updating effects, mutually recursive computed values, dispose during propagation, pause/resume,
      and batched mutation ordering.
  - [x] Added coverage for convergent self-updating effects, computed/effect disposal during propagation, mutually
        recursive computed graph cycles, effect pause/resume, and batched mutation flush ordering.
- [x] Existing `tests/signals.test.ts` stays green.
- [x] Workbench close/rearrange/resize tests include a regression for previous recursive render crashes.
  - [x] Added a shared `WindowManagerController` churn test that repeatedly fullscreen toggles, reorders, minimizes,
        restores, closes, reopens, and relayouts windows while asserting active/fullscreen/z-order invariants.

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

- [x] Split Three panel lifecycle into a small state machine with explicit states: idle, initializing, rendering,
      resizing, reconfiguring, stopping, failed, disposed.
  - [x] Added an inspectable lifecycle state surface covering idle, initializing, rendering, stopping, failed, and
        disposed states before deeper state-machine extraction.
  - [x] Extracted `resolveThreePanelLifecycleState()` and added focused tests for resize/reconfigure priorities while
        keeping frame-view race tests on the same lifecycle vocabulary.
- [x] Add cancel tokens/generation ids so stale frames cannot update disposed or rebuilt panels.
- [x] Pool GPU readback buffers and avoid recreating CPU arrays when size is unchanged.
- [x] Explore packing fill/edge/color output into fewer readbacks or a single mapped buffer.
- [x] Cache repeated ANSI foreground/background sequences within a frame.
- [x] Move Kitty image/ASCII dual-render policy into a reusable renderer option object rather than workbench-local
      conditionals.
- [x] Cache repeated linear-to-sRGB byte conversion during ANSI grid assembly to reduce CPU work on repeated material
      colors without changing terminal output.
- [x] Add a proven-blank-cell fast path in ANSI grid assembly so sparse Three scenes skip glyph/color conversion work
      for background cells.
- [x] Add a cheap adjacent-cell ANSI string cache for repeated block/material runs without regressing varied dense or
      sparse grid assembly.
- [x] Add a frame-local ANSI cell string cache for recurring non-adjacent glyph/color pairs, with a patterned Three
      ASCII benchmark covering repeated material palettes beyond adjacent runs.
- [x] Promote ANSI grid assembly into a reusable cache-owning renderer primitive so long-lived Three renderers keep
      linear RGB, foreground ANSI, and repeated cell strings warm across stable frames.
- [x] Let long-lived Three renderers opt into reusable ANSI grid row storage, avoiding per-frame grid/row allocation
      while preserving fresh output arrays for standalone assembler callers.
- [x] Build ANSI grids directly from mapped GPU readback views in `ThreeAsciiRenderer`, eliminating the per-frame
      fill/edge/color CPU array copy before terminal grid assembly.

Acceptance checks:

- [x] Tests close, resize, hide, maximize, and reconfigure Three windows while frames are in flight.
- [x] Three ASCII benchmarks track CPU grid assembly and GPU readback cost separately.
  - [x] Added a separate deterministic readback-copy benchmark for fill, edge, and color buffer payloads.
  - [x] Added a sparse ANSI grid benchmark that exercises blank-cell skipping separately from dense geometry.
  - [x] Added a solid repeated-color ANSI grid benchmark for block-heavy scenes that benefit from cell string reuse.
- [x] Workbench and standalone Three demos share the same config normalization and lifecycle helpers.
  - [x] Clamped normalized ASCII numeric config values to the same ranges exposed by shared controls, including
        wireframe thickness `0.5..32`, so saved per-widget configs cannot restore invalid renderer settings.
  - [x] Moved ASCII renderer config defaults, preset application, control ranges, and normalization into
        `src/three_ascii/options.ts` with an app-level compatibility shim, so console, web, and workbench demos share
        one option contract.
  - [x] Refactored standalone terminal and web Three ASCII demos to drive presets, glyph style, edge bias, and effect
        options from the shared option contract instead of duplicating preset merge state locally.

### P2: Make System Metrics Provider-Based And Testable

Current evidence:

- `app/system_metrics.ts` directly reads Linux `/proc`, `/sys`, `df`, `nvidia-smi`, `Deno.systemMemoryInfo()`, and
  `Deno.networkInterfaces()`.
- Sampling errors are mostly swallowed to keep the UI alive, which hides degraded monitors.
- Process sampling scans all numeric `/proc` entries every interval and sorts the full process list.

Work:

- [x] Extract provider interfaces for CPU, memory, process, disk, network, temperature, and GPU metrics.
- [x] Add Linux provider implementations plus fixture providers for tests and demos.
- [x] Add structured sampler diagnostics: unavailable source, permission denied, command missing, timeout, stale data,
      and sample duration.
  - [x] Added command-throw degradation for disk sampling and process scan durations in source diagnostics.
  - [x] Added command timeout support for command-backed disk/GPU samplers and fixture coverage for hung `df` and
        `nvidia-smi`.
- [x] Keep monitor snapshots advancing when required `/proc` reads or process scans fail, with structured per-source
      diagnostics for unavailable CPU, uptime, network, and process data.
- [x] Bound expensive process scans and support configurable process limits, sort keys, and refresh cadence.
- [x] Add GPU provider abstraction for NVIDIA now and future AMD/Intel support later.
- [x] Extract GPU monitor visualization rendering into a dedicated module with injected chart/meter primitives and
      focused tests for offline, pressure, alert, and narrow-panel behavior.
- [x] Extract CPU, memory, disk, temperature, and process monitor visualization rendering into a dedicated module with
      focused tests for empty sources, alert states, CPU legend coverage, and top-100 process output limits.

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

- [x] Decide whether to embed a maintained VT parser or continue expanding the local parser.
- [x] Add 256-color and truecolor SGR, cursor visibility/style, save/restore cursor, scroll regions, insert/delete
      line/character, OSC title, hyperlinks, and common DEC private modes.
- [x] Add parser fuzz/regression fixtures from real shell output, not just hand-authored strings.
  - [x] Added shell transcript and full-screen curses-style alternate-screen fixtures covering OSC title, DEC private
        modes, SGR, scroll regions, and alternate-screen restore.
- [x] Connect terminal title/OSC state to workbench tabs.
- [x] Keep process fallback clearly labeled separately from PTY-backed sessions.

Acceptance checks:

- [x] Terminal screen fixture tests cover common shell prompts, curses apps, alternate screen enter/exit, resize, and
      truecolor output.
- [x] Workbench shell smoke can run common commands and a simple full-screen app through PTY when available.
  - [x] Added `TerminalShellController` smoke coverage for PTY-style command writes, shell output, and a full-screen
        alternate-screen transcript before wiring the same path into a workbench-level smoke.
  - [x] Routed the console workbench through the shared `src/app/workbench/mod.ts` facade so the PTY shell window,
        window chrome, shelf, menu, workspace, and viewport helpers are exercised through one renderer-neutral boundary.
  - [x] Extracted the workbench shell backend resolver and covered the PTY-first/process-fallback path with focused
        tests so the interactive workbench shell window no longer owns that availability policy directly.
  - [x] Added `createWorkbenchShellSession` and a workbench-boundary PTY smoke covering shell writes plus an
        alternate-screen fullscreen transcript.
- [x] This todo and `017-terminal-multiplexer-experience.md` have non-overlapping scopes or are merged cleanly.
  - [x] Extracted OSC/CSI/single-character ESC parsing and numeric parameter parsing into
        `src/runtime/terminal_sequences.ts` with direct parser tests, leaving `TerminalScreenController` focused on
        screen state mutation.
  - [x] Made terminal sequence parsing offset-aware so the screen write loop no longer allocates `text.slice(index)` for
        every escape/control sequence.
  - [x] Removed repeated substring allocation from ANSI and Unicode scanning in shared string measurement/cropping and
        workbench frame cell splitting utilities.

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
  - [x] Added `inspectTuiCssSupport()` as a canonical programmatic support report covering CSS properties, selectors,
        media features, widget tags, and unsupported browser-CSS gaps so docs and demos do not need to scrape prose.

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
  - [x] Extracted catalog-driven standard component definitions into `src/theme_standard_components.ts` behind the
        existing `src/theme.ts` facade.
  - [x] Extracted built-in palette token construction and palette normalization helpers into `src/theme_palettes.ts`,
        keeping the public `src/theme.ts` palette facade and registry API stable.
  - [x] Extracted the custom palette registry and unknown-palette error into `src/theme_palette_registry.ts`, leaving
        `src/theme.ts` as the compatibility facade for palette APIs.
  - [x] Extracted foundational theme composition helpers into `src/theme_core.ts` while preserving public facade
        functions from `src/theme.ts`.
  - [x] Extracted generic theme coverage inspection into `src/theme_coverage_core.ts`, preserving
        `inspectThemeCoverage()` behavior while isolating inheritance/variant accounting tests.
  - [x] Extracted generic theme engine diff/preview logic into `src/theme_diff_core.ts`, keeping the public
        `diffThemeEngines()` facade stable while making diff semantics independently testable.
  - [x] Extracted serializable manifest compilation primitives into `src/theme_manifest_core.ts`, keeping public
        `src/theme.ts` wrappers stable while giving manifest parsing a focused testable boundary.
  - [x] Extracted component validation and inheritance cycle checks into `src/theme_validation_core.ts`, keeping the
        public validation facade stable while making token/reference diagnostics independently testable.
- [x] Add caches for resolved style chains and preview generation with explicit invalidation tests.
  - [x] Extended `ThemeProviderCache` with preview caching, active theme/layer invalidation, and uncached
        function-variant previews.
- [x] Add tests that verify theme layer changes invalidate only affected component/token lookups.
  - [x] `ThemeProviderCache` now swaps provider engines without flushing unrelated component-only layer entries and
        falls back to a full rebuild for token layer changes where style dependencies cannot be inferred safely.
- [x] Keep public exports stable through re-export shims and package-check coverage.

Acceptance checks:

- [x] `deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=1`
- [x] Theme tests cover module split compatibility and cache invalidation.
- [x] No app/demo imports need to reach into internal theme modules.

### P2: Improve Public API Curation

Current evidence:

- Public entrypoints use broad star exports. A quick scan found roughly `268` export lines across package and source
  modules.
- The stability manifest is strong, but broad exports still make accidental surface growth easy.

Work:

- [x] Keep `mod.ts`, `mod.web.ts`, and `mod.remote.ts` stable, but consider curated subpath modules for advanced areas:
      `layout`, `runtime`, `theme`, `terminal`, `three-ascii`, `testing`, and `experimental`.
  - [x] Add focused `./three-ascii` experimental export for renderer consumers.
  - [x] Added focused `./theme`, `./runtime`, `./terminal`, and `./testing` beta export targets so framework authors can
        avoid the broad root entrypoint.
- [x] Add an API diff report that groups new exports by stability tier before release.
- [x] Add package docs that show preferred imports for apps versus framework authors.
- [ ] Reduce accidental demo-only exports from stable entrypoints where possible without breaking current users.

Acceptance checks:

- [x] Package-check reports stable/beta/experimental export drift separately.
- [x] API reference groups exports by entrypoint and stability tier.
- [x] Health fails on accidental stable export growth unless explicitly acknowledged.

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
  - [x] Converted audio source discovery and meter startup/stream/stop failures to optional `DiagnosticsCollector`
        reports with injectable command fixtures for deterministic tests.
  - [x] Converted web workbench `localStorage` and IndexedDB fallback paths to deduplicated structured diagnostics
        surfaced through the in-demo log panel.
  - [x] Converted Three/Kitty graphics image cleanup failures to optional debug diagnostics instead of silent catches.
- [x] Add status-bar and report helpers for degraded backends.
- [x] Add tests that assert expected diagnostics for missing `nvidia-smi`, blocked IndexedDB, unsupported Kitty
      graphics, and failed process spawns.

Acceptance checks:

- [ ] Demos stay usable when optional capabilities are unavailable, but the user can inspect why a feature degraded.
- [x] Diagnostic output avoids noisy logs in normal operation.

### P3: Modularize Demo-Owned Visualization And Workbench Content

Current evidence:

- `app/visualizations.ts` is `2,375` lines.
- `app/neon_three.ts` is `1,302` lines.
- `app/grwizard_immediate.ts` is `2,490` lines.
- Demo modules contain reusable catalog, rendering, and widget patterns that could be package examples or fixtures.

Work:

- [x] Split visualization definitions by family: monitor, Neon text, Neon 3D, terminal/workspace, and layout.
  - [x] Added family query helpers for Monitor, Neon text, and Neon 3D visualization catalogs so demos/tests can target
        families without duplicating id filters. Terminal/workspace and layout remain built-in workbench window groups.
- [x] Move shared visualization metadata and source wiring into a registry module with typed capabilities.
  - [x] Added `app/visualization_catalog.ts` with Monitor, Neon text, and Neon 3D family metadata; the workbench New
        Window menu now classifies visualization options from this metadata before falling back to legacy id heuristics.
- [ ] Keep rendering functions pure and fixture-testable.
  - [x] Extracted pure visualization drive/source normalization into `app/visualization_drive.ts`; render modules now
        consume a fixture-testable data transform instead of owning source sampling and hazard math directly.
  - [x] Extracted visualization dispatch into typed renderer maps so catalog ids, Three scene modes, and direct panel
        renderers are data-driven instead of encoded in one large switch.
  - [x] Extracted the CPU hex-grid visualization into `app/visualization_cpu_hex.ts`, keeping color interpolation,
        layout, selection, and process-detail behavior under the existing visualization dynamic tests.
  - [x] Extracted the responsive network monitor into `app/visualization_network.ts`, with chart/glyph dependencies
        injected from the visualization renderer instead of duplicating shared drawing utilities.
- [ ] Make demo-only assets and NGE-inspired primitives clearly separate from library APIs.
  - [x] Added `app/neon_three_catalog.ts` for supported Three scene metadata and labels, keeping demo/NGE catalog data
        separate from the monolithic scene factory and shared by visualization footers plus scene coverage tests.
  - [x] Extracted API Workbench synthetic visualization sources, source-id routing, and demo system snapshots into
        `app/workbench_synthetic.ts`, keeping fixture data out of the terminal renderer and under focused tests.

Acceptance checks:

- [x] Visualization dynamic tests can target individual families.
- [x] Workbench New Window menu derives from registry metadata without demo-local branching.

## Cross-Cutting Test Plan

- [x] Add full-frame render invalidation tests for overlapping draw objects, scrollable workspaces, and modals.
  - [x] Added a canvas regression covering a modal overlay opening/closing over scrolled viewport content.
- [ ] Add real workbench controller tests after extraction, covering both terminal and web adapters.
- [x] Add browser interaction tests for pointer, touch/coarse pointer, software keyboard text input, and resize
      observer.
- [x] Add terminal parser fixture tests from real shell output and ANSI sequences.
- [x] Add fixture-driven system metrics tests for Linux, missing GPU, and unavailable permissions.
- [x] Add property/fuzz tests for layout, selection, viewport, scrollbar pointer mapping, and terminal input decoding.
  - [x] Added deterministic generated parity coverage for supported simple/Yoga flex layout cases.
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
