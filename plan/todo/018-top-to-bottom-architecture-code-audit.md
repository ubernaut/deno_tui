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

- [x] Create `src/app/workbench/` for renderer-neutral workbench state, menus, window registry, hit routing, workspace
      persistence, modal lifecycle, dropdown/popover lifecycle, and command dispatch.
  - [x] Added `src/app/workbench/mod.ts` as a renderer-neutral facade over the extracted helper modules, with a smoke
        test covering representative frame, viewport, titlebar, and hit-target exports.
  - [x] Routed the public app barrel through `src/app/workbench/mod.ts` so root exports, terminal demos, and web demos
        share one workbench helper boundary without changing the stable API inventory.
  - [x] Extracted renderer-neutral top-menu disclosure/focus state into `WorkbenchTopMenuController` and wired terminal
        plus web workbench adapters through it.
  - [x] Added an internal `src/app/workbench/controller.ts` coordinator for top-menu state, dropdown indices, and
        `WindowManagerController` ownership; terminal API Workbench now instantiates this shared controller instead of
        constructing menu and window controllers separately.
  - [x] Migrated the web API Workbench top-menu state through the same internal controller while preserving its
        persisted signal-driven layout state.
  - [x] Extracted shared workbench diagnostics log/status formatting into the renderer-neutral workbench facade and
        migrated terminal plus web workbench adapters to it.
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
  - [x] Extracted renderer-neutral workbench text helpers into `src/app/workbench_text.ts`, covering whitespace
        compaction, row measurement, plain text wrapping, and visible menu slices while trimming duplicate helpers from
        the terminal workbench.
  - [x] Extracted workbench control button-line segmentation into `src/app/workbench_control_layout.ts`, keeping
        clickable button backgrounds scoped to the button token and covering clipped narrow rows with focused tests.
  - [x] Extracted workspace save/rename modal body projection into `app/workbench_workspace_menu.ts`, keeping terminal
        modal state local while making the renderer-neutral prompt copy directly testable and reusable by web adapters.
  - [x] Extracted API Workbench static theme/table/docs catalog data into `app/api_workbench_catalog.ts`, reducing
        renderer-local fixture ownership and adding direct catalog coverage.
  - [x] Extracted API Workbench control traversal order into `app/api_workbench_controls.ts`, keeping keyboard wrap and
        edge-aware tab behavior under direct tests.
- [ ] Make the terminal workbench and web workbench thin render adapters over the same controller/model.
  - [x] Exposed the shared frame and hit-target helpers through `src/app/mod.ts` and migrated the web API Workbench page
        to reuse exported text-fit, ANSI-cell, contrast, and geometry helpers.
  - [x] Migrated web API Workbench tiling through `WindowManagerController` so terminal and web layouts share the same
        fullscreen/minimized/adaptive tile engine.
  - [x] Extracted shared Three panel mouse interaction and transform state into `app/three_panel_interaction.ts`, so
        terminal canvas rendering and frame-rendered workbench windows use the same rotate/zoom/reset behavior.
  - [x] Added focused tests for the internal `WorkbenchController` covering top-menu focus/disclosure, bounded menu
        indices, focus cycling, fullscreen, minimize, restore, and close state transitions.
  - [x] Replaced terminal new-window/workspace menu index clamps with shared controller helpers and verified browser
        demo checks plus web runtime tests after the matching web top-menu hookup.
  - [x] Added adapter-parity controller coverage that drives terminal-style multi-menu flows and web-style theme-menu
        flows through the same renderer-neutral workbench controller contract.
  - [x] Shared diagnostics log/status helpers now keep terminal and web degradation display behavior on one adapter
        contract.
  - [x] Extracted shared status-left composition and tile-density labels so terminal and web status bars no longer
        duplicate focus/theme/layout/diagnostic summary logic.
  - [x] Extracted top-menu dropdown anchor layout into `workbench_menu.ts`, keeping terminal and web dropdown placement
        on the same measured menu-item algorithm.
  - [x] Extracted top-menu hit-target layout into `workbench_menu.ts`, keeping terminal and web pointer regions clipped
        by the same measured token sequence.
  - [x] Extracted shared adaptive workbench tile defaults and layout rectangle projection into `workbench_layout.ts`,
        trimming duplicated terminal/web workspace layout math.
  - [x] Extracted shared active-window reveal tracking plus workspace viewport scroll sizing into `workbench_layout.ts`,
        leaving terminal and web adapters to call one scroll/update controller.
  - [x] Added reusable workbench row-buffer preparation helpers and migrated terminal/web workspace virtual frames off
        per-redraw outer row array allocation.
  - [x] Added caller-owned visible menu-slice buffers and migrated terminal top-menu popovers off per-frame slice/index
        allocation.
  - [x] Hoisted static theme menu labels in terminal and browser workbench adapters so repeated redraws reuse measured
        dropdown labels.
  - [x] Moved New Window menu label projection into the shared window registry so render adapters compute loaded-state
        labels with one window-id lookup set.
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
- [x] Add terminal-screen replay benchmarks for PTY-style byte transcripts and common OSC/CSI/SGR screen mutations.
  - [x] Reused terminal input text encoders/decoders across process, PTY, canvas, browser canvas, and remote terminal
        paths so repeated input and dirty-cell flushes do not allocate codecs per message or frame.
- [x] Record thresholds in the benchmark catalog and wire the most useful non-flaky cases into health or e2e.
  - [x] Added benchmark CLI selectors for filtering by name/search, category, tag, and thresholded status so long
        optimization passes can rerun only the relevant integration workload before the full health gate.
  - [x] Reworked benchmark catalog filtering, aggregate inspection, summary formatting, threshold formatting, and search
        matching to use direct buffers and scanned query terms instead of chained projection/filter pipelines.
  - [x] Removed intermediate sampled-array allocation from `renderSparkline()`, keeping dashboard trend rendering on a
        tight width-bounded loop.
  - [x] Reworked shared visualization grid/matrix primitives to avoid nested `Array.from()` and map/filter chains in
        monitor and Neon panel render paths.
  - [x] Reworked `buildVisualizationDrive()` to avoid temporary source/value arrays, spread min/max calls, and sampled
        `Array.from()` helpers in the dynamic visualization hot path.
  - [x] Reworked CPU legend, network compact trace/history, and GPU memory bank render paths to avoid nested temporary
        arrays in frame-critical monitor widgets.
  - [x] Reworked the chart renderer to scan sampled values in-place and compute component rows once per draw update
        instead of once per rendered line.
  - [x] Reworked CPU hex-grid label measurement, tile layout, row buffers, and selected CPU range projection to avoid
        map/spread/filter allocation in the visual monitor path.
  - [x] Reworked reusable list, virtual-list, context-menu, stepper, radio-group, and log-viewer draw loops to avoid
        discarded `Array.from()` allocations; log viewer now shares one visible-row computation across rendered lines.
  - [x] Reworked toast, empty-state, and label layout rendering to use loop-based row allocation and avoid short-lived
        padding/layout arrays.
  - [x] Reworked empty-state row projection to append visible rows directly instead of building filtered/sliced/mapped
        line arrays on each render.
  - [x] Added a shared internal text-row drawing helper and migrated row-oriented widgets to it, removing duplicated
        `Text` subcomponent wiring while preserving each widget's row projection logic.
  - [x] Reworked responsive tiling, grid track resolution, and window order assignment to avoid temporary map/spread/
        `Array.from()` allocation in layout paths used by the workbench and HTML/CSS solver.
  - [x] Reworked data-table and runtime data-query search matching to avoid per-row `map().join()` haystack arrays and
        added a 25k-row table filter benchmark to catch future search regressions.
  - [x] Reworked terminal screen text/cell snapshot extraction to share loop-based row cloning and avoid nested `map()`
        chains in terminal inspection helpers.
  - [x] Reworked terminal screen private-mode inspection to build sorted DEC mode snapshots directly instead of
        `Array.from(...).sort()` conversion.
  - [x] Reworked API Workbench synthetic source/system generation to reuse loop-based waveform helpers instead of
        repeated `Array.from()` closures in frame-driven demo data.
  - [x] Extracted shared synthetic waveform helpers and migrated API Workbench, Neon suite, and showcase demo data onto
        the same loop-based source/history generation primitive.
  - [x] Reworked Three ASCII mixed glyph table initialization to score candidates with direct loops instead of
        spread/map/reduce allocation while preserving mixed-mode glyph selection behavior.
  - [x] Added frame-boundary cache pruning and stable primitive background reuse to the Three ASCII ANSI grid assembler
        so long-running animated scenes avoid unbounded ANSI/color cache growth without adding per-cell churn.
  - [x] Reworked system monitor history initialization and update helpers to use bounded loop allocation instead of
        repeated `Array.from()`, `slice()`, and `unshift()` churn.
  - [x] Reworked audio meter history updates and synthetic source series generation to avoid steady-state
        `slice()`/`push()` and `range().map()` allocation in live visualization data feeds.
  - [x] Reworked core selection range/value helpers to use direct output buffers instead of temporary `Array.from()`,
        `map()`, and `filter()` chains in reusable list/table/tree selection paths.
  - [x] Extracted shared weighted command-search scoring with allocation-light word/acronym matching, migrated command
        palette, command bindings, and indexed command search to it, and added a 1k-command ranking benchmark.
  - [x] Reworked visible-row projection helpers for lists, virtual lists, context menus, radio groups, terminal output,
        and log viewers to avoid `slice().map()` allocation in scrollable widget viewport paths.
  - [x] Reworked shared Neon Three geometry trace/ribbon/contour builders to use direct point buffers instead of
        setup-time `Array.from()` closures during Three ASCII scene construction.
  - [x] Reworked command palette, command surface, and indexed command search rankers to build explicit match buffers
        instead of `map().filter().sort().map()` pipelines, keeping the 1k-command ranking benchmark under threshold.
  - [x] Removed remaining spread/map field construction from command palette and indexed command-search field
        precomputation, then moved indexed command-search entry projection and inspection counters to one-pass buffers
        so ranking/index refresh no longer allocates intermediate raw field or projection objects for command keywords.
  - [x] Reworked remaining Neon Three scene setup arrays to use pre-sized object buffers instead of `Array.from()`
        closures when constructing Three ASCII demo windows.
  - [x] Reworked shared workbench workspace normalization, serialization, lookup, and menu label projection to use
        loop-based buffers in workspace load/save and redraw-heavy dropdown paths.
  - [x] Reworked workbench window option catalog construction to append built-ins and visualization options into one
        pre-sized buffer instead of spread/map projection during New Window menu setup.
  - [x] Reworked Three ASCII renderer option patching to use explicit typed assignments instead of `Object.entries()`
        reflection when applying live config updates.
  - [x] Extracted API Workbench Kitty/tmux graphics surface ownership into a tested controller with injectable tmux
        passthrough probing, reducing renderer setup logic in the main demo file.
  - [x] Extracted pure API Workbench row builders for Three ASCII headers and data-table footers, with direct tests and
        loop-based footer styling for wrapped rows.
  - [x] Reworked the shared flex layout size solver to avoid active-entry arrays in grow/shrink distribution loops,
        improving the focused `layout/flex-rects-3-pane` benchmark while preserving layout tests.
  - [x] Reworked responsive breakpoint resolution to scan matching breakpoints in one pass instead of allocating and
        sorting match lists on each layout solve.
  - [x] Reworked the simple HTML/CSS layout solver's child splitting, grid placement, flex line sizing, and text
        intrinsic measurement loops to avoid callback pipelines and duplicate line-width scans in layout solve paths.
  - [x] Added a direct sampled-series value helper and migrated compact network monitor traces off temporary RX/TX
        sampled arrays in narrow live-render paths.
  - [x] Added source-array keyed overlay z-order caches and reverse-loop modal hit testing so repeated menu/modal
        pointer checks avoid repeated sorted/filter/reverse arrays inside the overlay controller.
  - [x] Reworked window-manager ordering, state replacement, layout inspection, and z-order projection to use explicit
        output buffers instead of map/filter/spread pipelines in workbench window state paths.
  - [x] Reworked disk, CPU, and NVIDIA GPU metrics parsers to avoid chained filter/map/reduce/sort allocations while
        preserving fixture-backed monitor sampling behavior.
  - [x] Reworked network metrics sampling to parse `/proc/net/dev` rows with a line loop and RX/TX field scanner,
        avoiding trim/map/filter/Number-array pipelines while preserving address-aware sorting and top-eight capping.
  - [x] Reworked visualization source frame generation to use explicit output buffers and bounded detail/series helpers
        for monitor-backed sources instead of per-frame `slice().map()` projections.
  - [x] Reworked shared visualization panel footer, alert, source-name, and warning helpers to use bounded loops instead
        of `some/find/map/flatMap/slice` chains in common render paths.
  - [x] Reworked `buildVisualizationDrive()` source construction and aggregate metrics to use explicit loops instead of
        `map/reduce/filter/some` and closure-based average helpers in every dynamic visualization frame.
  - [x] Reworked terminal workspace session replacement, removal, layout normalization, and inspection cloning to use
        explicit buffers instead of repeated `map/filter` chains in tmux-like workspace state paths.
  - [x] Reworked runtime workload telemetry source snapshots, registry inspection, report construction, and aggregate
        counts to use one-pass loops instead of repeated map/reduce/filter projections.
  - [x] Reworked CPU hex monitor color-stop lookup, hot-core selection, selected-process projection, load-average
        formatting, and compact legends to avoid map/filter/reduce/find/slice chains in the per-frame monitor path.
  - [x] Reworked system monitor visualization row builders for CPU load averages, top cores, temperature rows, disk
        rows, and process rows to use bounded direct buffers instead of `slice().map()` render projections.
  - [x] Extracted table auto-width measurement into a loop-based helper with sparse-row coverage, removing per-column
        `reduce()` callbacks from table layout recomputation while preserving current sizing behavior.
  - [x] Reworked tree row text projection, visible-window slicing, toggle lookup, and inspection rows to avoid
        `map/find/slice` allocation in reusable tree and file-explorer controller paths.
  - [x] Reworked file-explorer path parsing, child lookup, and sorted output projection to avoid split/filter/find/map
        chains while preserving directory-first ordering and empty path segment normalization.
  - [x] Reworked Three ASCII ANSI assembly to resolve terminal glyph style once per frame and use precomputed fill-key
        tables in the inner cell loops instead of per-cell style switching and bucket projection.
  - [x] Reworked Three ASCII preset/config helpers to use explicit loops for ids, filtered clones, summaries, fallback
        lookup, and preset-map construction while preserving cloned preset API boundaries.
  - [x] Reworked data-table filtering, header rendering, row rendering, sortable-column checks, keyed selection lookup,
        and query term parsing to avoid callback pipelines in reusable table view paths.
  - [x] Reworked local data-query filtering, default search scans, exact-filter scans, and page projection to avoid
        filter/slice/Object.entries/Object.values allocation in resource-backed table query paths.
  - [x] Reworked command palette/controller projections, command-surface item projection, and command registry
        list/projection/key-binding/inspection helpers to reuse cached filtered state and avoid map/filter chains in
        command-surface paths.
  - [x] Reworked stacked widget hit-region projection and widget hit testing to use direct buffers and a one-pass
        topmost scan instead of per-pointer copy/filter/sort allocation, with z/id tie-break regression coverage.
  - [x] Reworked log viewer, terminal output, and metric-series bounded buffers to avoid spread/map/slice churn in
        append, trim, snapshot, and inspection paths while preserving dashboard and terminal behavior.
  - [x] Reworked terminal workspace pane collection and nearest-split lookup to use accumulator/search traversal instead
        of recursive spread collection and clone-heavy subtree membership probes.
  - [x] Reworked layout recipe inspection and Markdown formatting helpers to preserve public ordering with loop-based
        breakpoint, slot, and missing-layout projection instead of flatMap/map/filter intermediates.
  - [x] Reworked runtime renderer backend inspection, query, selection, and catalog summaries to use one-pass buffers
        and set accumulation instead of chained map/filter/flatMap scans in startup/report paths.
  - [x] Reworked runtime renderer backend search queries to scan normalized terms directly instead of allocating
        `trim().split().filter()` buffers during catalog filtering.
  - [x] Reworked runtime profile registry inspection, profile lookup, query, and catalog summaries with explicit buffers
        and one-pass strategy/tag accumulation while preserving priority and definition ordering.
  - [x] Reworked runtime and terminal capability entry/summary/format helpers to use stable ID lists and one-pass
        availability counts instead of object-key map/filter chains.
  - [x] Reworked terminal locale and environment diagnostic formatting to avoid array filter/map projections in startup
        capability reports.
  - [x] Reworked theme layer active composition, theme pack inspection, and palette inspection to use direct buffers and
        set scans instead of active-id `filter/map` and inspection `map/filter` chains.
  - [x] Reworked theme engine factory ids, inspections, prewarm selection, catalog aggregation, prewarm result
        projection, token filtering, and search matching to use direct buffers and scanned terms instead of chained
        `map/filter/flatMap` pipelines and joined haystacks.
  - [x] Reworked theme engine pipeline active-id scans, apply ordering, inspection aggregation, prewarm selection,
        prewarm result projection, component-key sorting, and token filtering to avoid active-id `filter/map` and
        `Object.entries().sort()` pipelines.
  - [x] Reworked theme workspace pipeline id/inspection projection and provider validation issue collection to use
        pre-sized buffers, direct issue appends, and a shared registry-options snapshot instead of nested `map/filter`
        chains.
  - [x] Reworked theme provider catalog/preview/report assembly to build themes, layers, component sources, token
        previews, component-state previews, coverage component names, and variant counts with direct buffers instead of
        `map/flatMap/reduce` pipelines.
  - [x] Reworked theme gallery construction, ranked matching, filtered item projection, inactive-theme preview rows,
        component-name extraction, keyword collection, and token/state filtering to use direct buffers and sets instead
        of `map/flatMap/filter/Object.values().flat()` pipelines.
  - [x] Reworked theme coverage aggregation to compute component coverage, variant counts, covered/missing state counts,
        completeness, and covered/missing state arrays in direct passes instead of repeated `map/reduce/filter` scans.
  - [x] Reworked component theme binding group inspection to build binding snapshots plus component and variant sets in
        one pass instead of cloning bindings and then mapping them again for aggregates.
  - [x] Reworked theme catalog component merging to project sorted component entries into a direct output buffer with a
        shared default-first variant comparator.
  - [x] Reworked EventEmitter aggregate counting, event-name projection, and inspection to avoid Object.values/entries
        pipelines in core canvas/component/web host event paths.
  - [x] Reworked runtime diagnostics bounded trimming, cloning, status counting, and text formatting to avoid map/filter
        pipelines in degradation-reporting paths.
  - [x] Reworked SettingsController key projection and ready/flush/reset aggregation to use explicit sorted buffers and
        promise lists instead of spread/map chains across persistent app settings.
  - [x] Reworked app settings binding sanitizers for data-query filters and theme pipeline step ids to use direct copies
        instead of `Object.entries().filter()` and active-id `filter()` chains.
  - [x] Reworked focus application/scope snapshots and ActionBus middleware dispatch snapshots with explicit buffers,
        preserving focus restore and middleware ordering while avoiding callback/spread allocation.
  - [x] Reworked RouteManager lookup, registration, removal, navigation, and inspection helpers to use indexed scans and
        explicit cloned route buffers instead of map/filter/find pipelines.
  - [x] Reworked app plugin definition inspection, query, catalog summaries, registry cloning, and registry inspection
        to use explicit id buffers and one-pass count/tag accumulation.
  - [x] Reworked app plugin catalog search matching to scan normalized query terms directly instead of
        `trim().split().filter()` token buffers.
  - [x] Reworked MemoryCanvasSink update and range recording to clone inspection buffers with direct loops instead of
        spread/map projection.
  - [x] Reworked DirtyRegion inspection and row-segment merge setup to use explicit row/segment buffers and avoid
        entries/flatMap/spread projection in canvas invalidation helpers.
  - [x] Reworked TerminalBackendRegistry id/provider projection, explicit-id resolution, and sorted provider buffers to
        avoid singleton filter arrays and spread/map cloning in shell backend selection.
  - [x] Reworked OverlayStackController initialization, register/update/remove, visible z-order projection, inspection,
        and modal close-tree handling around explicit buffers to reduce popover/modal state churn.
  - [x] Reworked WorkbenchController inspection to bucket all window ids in one pass for terminal and web adapter
        diagnostics.
  - [x] Reworked TuiApp plugin metadata, route ids, command enabled counts, and command/keymap groups to avoid repeated
        map/filter scans during app inspection.
  - [x] Reworked component catalog lookup, query, category/capability projection, inspection, and markdown summary
        helpers to avoid filter/map/flatMap pipelines in docs and demo discovery paths.
  - [x] Reworked TerminalScrollbackController row aggregation, search matching, visible row snapshots, match cloning,
        and selection copying to avoid spread/slice/map/filter churn in shell copy mode.
  - [x] Reworked WindowManagerController id/open-window lookup, active/fullscreen repair, and minimize/close focus
        fallback paths around explicit helper scans without changing tiling geometry.
  - [x] Reworked workbench shelf and fullscreen tab layout to derive button labels and state in one pass instead of
        mapping source entries into intermediate button descriptors each redraw.
  - [x] Reworked TerminalWorkspaceController session id lookups, mutation indices, active inspection lookup, close-pane
        fallback, and session reordering to avoid repeated find/some/findIndex and spread/splice paths.
  - [x] Reworked terminal workspace descriptor duplication to populate id sets directly instead of mapping session ids.
  - [x] Reworked MouseInteractionRouter inspection, hit testing, target snapshots, and ordered target cache population
        to avoid map/find/spread allocation in input dispatch paths.
  - [x] Reworked HitTargetStack inspection snapshots to clone target rectangles with a preallocated buffer.
  - [x] Reworked workbench text width and wrapping helpers to avoid reduce callbacks and redundant filter passes in
        frequent menu/panel text measurement.
  - [x] Reworked terminal parameter parsing to scan CSI parameter strings directly instead of split/map/filter chains.
  - [x] Reworked Kitty graphics control cleaning, deterministic key ordering, and command control serialization to use
        explicit buffers instead of Object.entries/fromEntries/map/filter pipelines.
  - [x] Reworked initial workbench diagnostic log rows to use bounded append buffers instead of spread/map/slice
        projection.
  - [x] Reworked FormController validation, value updates, snapshots, inspection buckets, error summaries, record
        cloning, and group inspection around one-pass loops instead of repeated map/filter/some/reduce chains.
  - [x] Reworked process command-line formatting to append quoted command arguments directly without building an
        intermediate token array.
  - [x] Reworked pad content measurement, modal body/action rendering, and toast inspection cloning to avoid short-lived
        map/reduce/flatMap/filter buffers in reusable widget helper paths.
  - [x] Reworked tabs, menu bar, radio group, stepper, and file-explorer entry projection to use explicit render and
        clone buffers instead of map/find chains in common controller inspection and draw helpers.
  - [x] Reworked browser DOM HTML serialization and ANSI-cell SGR parsing to avoid child/style/attribute map chains and
        split/map parameter buffers in web runtime render paths.
  - [x] Reworked live process stat sampling to build settled read promises and failed-read counts with direct buffers
        instead of map/filter chains while preserving the bounded scan behavior.
  - [x] Reworked HTML-like markup tree conversion to collect meaningful children, text, classes, layout children, and
        node counts with direct passes instead of repeated filter/map/reduce scans before layout solving.
  - [x] Reworked CSS cascade matching, child recursion, variable normalization, declaration parsing, selector-list
        parsing, and specificity tag counting to avoid repeated filter/map pipelines during markup layout.
  - [x] Reworked CSS selector-part parsing to scan child and descendant combinators directly instead of
        `replace().split().filter()` tokenization, with direct tests for compact and spaced child selectors.
  - [x] Added `MarkupLayoutCache`, a bounded cloned-result cache for parsed markup and CSS stylesheets, and wired
        `createMarkupLayout()` through a default cache with opt-out support for callers that need uncached parsing.
  - [x] Reworked layout style cloning, grid track/area parsing, placement parsing, box edge parsing, and CSS shorthand
        tokenization to share loop-based helpers instead of repeated split/map/filter fallback paths.
  - [x] Reworked markup widget hydration lookup, focus order, inspection snapshots, option extraction, tabs, trees, and
        recursive text projection to use direct buffers instead of map/filter chains.
  - [x] Reworked terminal workspace command payload and detached-session lookup helpers to avoid repeated inline
        `find/every` scans while keeping tmux-like command actions renderer-neutral.
  - [x] Reworked terminal-window resize sync to populate visible-window lookup maps directly instead of constructing
        tuple arrays with `layout.visible.map()`.
  - [x] Reworked Yoga layout child projection, Yoga text measurement, simple-solver intrinsic cache signatures, and grid
        track shrinking to use direct accumulation instead of map/reduce/spread pipelines in layout solve paths.
  - [x] Reworked shared layout-node cloning and class-list parsing to use explicit child/string buffers instead of
        `children.map()` and `split().filter()` during markup cascade and hydration.
  - [x] Added a worker-compatible markup layout adapter so browser and console callers can run parse/cascade/layout jobs
        through `WorkerPool` while keeping widget-controller hydration on the UI thread.
  - [x] Reworked route binding source projection, route command keywords, and visible-route shifting to use shared
        direct lookup/projection helpers instead of repeated nested `some/filter/map/findIndex` scans.
  - [x] Reworked command key lookup, keymap synchronization, key-binding inspection, conflict grouping, conflict
        markdown, and command-surface search field construction to use explicit buffers instead of callback pipelines.
  - [x] Reworked standalone keymap registry list, group, and inspection helpers to use direct buffers and set
        accumulation instead of `filter/map` projection chains.
  - [x] Reworked component catalog command projection and data-table sort command keyword creation to use direct command
        and keyword buffers instead of `map()` and short-lived `filter(Boolean)` arrays.
  - [x] Reworked theme plugin inspection and theme-engine factory command projection to use direct buffers for pipeline
        inspections, persisted pipeline ids, command definitions, and variant keywords instead of `map/filter` and
        `Object.values().flat()` pipelines.
  - [x] Reworked scheduler and worker batch helpers to build promise buffers explicitly instead of per-item `map(async)`
        closures while preserving ordered results and abort behavior.

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
  - [x] Tightened row-indexed canvas spatial queries with horizontal overlap filtering, reducing candidate checks for
        dense but non-overlapping columns while preserving unique row-overlap behavior.
- [x] Cache z-order/version metadata and invalidate only when object order or geometry changes.
- [x] Add optional render stats for dirty rectangle count, dirty cell count, full redraw count, and intersection query
      cost.
- [x] Keep the current cell sink contract stable while allowing future sinks to consume row ranges.
  - [x] Add a dedicated DirtyRegion row-segment merge/probe benchmark.
  - [x] Optimized bulk dirty-region construction to collect row segments first and merge each row once, reducing the
        400-rectangle dirty-region benchmark without changing incremental `addRectangle()` behavior.
  - [x] Reworked `DirtyRegion.intersects()` to scan row segments with early exit instead of allocating clipped
        intersection arrays for boolean probes.
  - [x] Reworked workbench frame color parsing and luminance conversion to avoid temporary channel arrays in
        theme/button contrast helpers.

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
- [x] Replaced the standalone ANSI grid factory's `Array.from()` construction with explicit row allocation so one-shot
      assembler calls avoid callback allocation while preserving fresh output rows.
- [x] Replaced Three panel fallback-grid nested `Array.from()` construction with explicit row allocation for
      Kitty/fallback transitions.
- [x] Replaced canvas Three ASCII fallback-grid nested `Array.from()` construction with explicit row allocation for
      renderer-unavailable paths.
- [x] Build ANSI grids directly from mapped GPU readback views in `ThreeAsciiRenderer`, eliminating the per-frame
      fill/edge/color CPU array copy before terminal grid assembly.
- [x] Skipped edge compute/copy/readback work entirely for block-style renderer configs with edges disabled, reducing
      mapped readback bytes and CPU grid inputs for the default solid/block visualization path.
- [x] Extracted Three ASCII readback byte packing and mapped-range view construction into `src/three_ascii/readback.ts`,
      with focused tests for edge-disabled packing and Float32 alignment so future GPU copy policy changes have a narrow
      correctness boundary.
- [x] Flattened repeated ANSI cell caching to numeric foreground/glyph keys and split fill-only grid assembly into a
      branch-free hot loop, improving the focused Three ASCII assembly benchmark subset while preserving style-switch
      cache correctness.
- [x] Added adjacent raw-color/glyph reuse inside edged and fill-only ANSI grid hot loops so solid geometry skips
      repeated linear-to-sRGB conversion, block blending, ANSI lookup, and cell string assembly.
- [x] Made edge compute output resources lazy so default block-style renderers do not allocate the Sobel edge storage
      buffer or bind group until an edge-enabled ASCII config actually needs them.

Acceptance checks:

- [x] Tests close, resize, hide, maximize, and reconfigure Three windows while frames are in flight.
- [x] Three ASCII benchmarks track CPU grid assembly and GPU readback cost separately.
  - [x] Added a separate deterministic readback-copy benchmark for fill, edge, and color buffer payloads.
  - [x] Added a sparse ANSI grid benchmark that exercises blank-cell skipping separately from dense geometry.
  - [x] Added a solid repeated-color ANSI grid benchmark for block-heavy scenes that benefit from cell string reuse.
  - [x] Added a fill-only ANSI grid benchmark and fast path so block-style scenes that do not need edge buffers avoid
        edge-glyph lookup and promotion work.
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
  - [x] Split the system provider contract and Deno-backed provider implementation into
        `app/system_metrics_provider.ts`, leaving `app/system_metrics.ts` focused on sampling, diagnostics, and snapshot
        assembly while preserving compatibility re-exports.
- [x] Add Linux provider implementations plus fixture providers for tests and demos.
- [x] Add structured sampler diagnostics: unavailable source, permission denied, command missing, timeout, stale data,
      and sample duration.
  - [x] Added command-throw degradation for disk sampling and process scan durations in source diagnostics.
  - [x] Added command timeout support for command-backed disk/GPU samplers and fixture coverage for hung `df` and
        `nvidia-smi`.
  - [x] Extracted system metric diagnostic ordering and process scan diagnostic formatting into
        `app/system_metrics_diagnostics.ts` with direct status-priority tests.
  - [x] Extracted `df -B1P` disk row parsing into `app/system_metrics_disk.ts`, covering virtual filesystem filtering,
        pressure sorting, and row limits with focused tests.
  - [x] Extracted `/proc/stat` CPU row parsing into `app/system_metrics_cpu.ts`, covering first-sample seeding, delta
        math, per-core labels, and fallback core preservation with focused tests.
  - [x] Extracted `/proc/net/dev` network parsing and rate calculation into `app/system_metrics_network.ts`, covering
        loopback exclusion, address-aware filtering, negative-delta clamping, and counter rollover state with focused
        tests.
  - [x] Extracted thermal zone scanning into `app/system_metrics_temperature.ts`, covering millidegree conversion,
        fallback labels, hottest-first sorting, invalid readings, and scan failure diagnostics with focused tests.
- [x] Keep monitor snapshots advancing when required `/proc` reads or process scans fail, with structured per-source
      diagnostics for unavailable CPU, uptime, network, and process data.
  - [x] Extracted monitor history padding, empty snapshot construction, and alert derivation into
        `app/system_metrics_snapshot.ts` with direct tests for clamping, initialization, and alert priority.
- [x] Bound expensive process scans and support configurable process limits, sort keys, and refresh cadence.
  - [x] Replaced allocation-heavy `/proc/<pid>/stat` tail splitting with targeted field scanning for process state, CPU
        time, RSS, and processor id in the sampler hot path.
  - [x] Extracted process stat parsing and process sort comparators into `app/system_metrics_process.ts` with focused
        tests, keeping the main monitor module closer to sampling orchestration.
- [x] Add GPU provider abstraction for NVIDIA now and future AMD/Intel support later.
  - [x] Extracted the NVIDIA GPU provider, row parser, and unavailable GPU snapshot factory into
        `app/system_metrics_gpu.ts` with direct parser tests for nullable telemetry and clamped utilization.
- [x] Extract GPU monitor visualization rendering into a dedicated module with injected chart/meter primitives and
      focused tests for offline, pressure, alert, and narrow-panel behavior.
- [x] Extract CPU, memory, disk, temperature, and process monitor visualization rendering into a dedicated module with
      focused tests for empty sources, alert states, CPU legend coverage, and top-100 process output limits.
- [x] Extract shared visualization drawing primitives for meters, charts, text cropping, and matrix drawing into a
      dedicated helper module with direct tests.
- [x] Extract Three visualization signal mapping and per-mode motion biases into a dedicated helper module with direct
      tests for normalized signals, alarm press state, and mode bias stability.

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
  - [x] Reused a `TextDecoder` inside `TerminalScreenController` for byte-buffer writes and added a terminal-screen
        replay benchmark to keep PTY transcript handling bounded.
  - [x] Replaced per-cell blank-row callbacks with filled frozen blank-cell rows, cutting terminal transcript replay
        allocation overhead while keeping cell mutation tests green.
  - [x] Preallocated terminal screen outer row arrays during resize/reset paths so replay-heavy workloads avoid
        incremental row-array growth.

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
  - [x] Added simple-solver support for named CSS Grid template areas (`grid-template-areas` + `grid-area`), keeping
        Yoga named-area parity documented as an unsupported gap.
  - [x] Added CSS `visibility` inheritance in the markup cascade so hidden containers suppress descendant hit regions by
        default while explicit `visibility: visible` descendants can opt back in.

Acceptance checks:

- [x] Layout fixtures run against the simple solver and Yoga solver where supported.
- [x] Workbench can host a markup-created panel using the same scroll and hit routing semantics as hand-built panels.
- [x] Markup parse/cascade/layout has a worker-friendly adapter and fixture-backed WorkerPool test coverage.

### P2: Split Theme Architecture Into Smaller Modules

Current evidence:

- `src/theme.ts` is now `971` lines after extracting ANSI styles, palettes, core composition, coverage, diff, registry,
  provider, preview/report, validation, and standard-component helpers into focused `src/theme_*` modules.
- Theme performance is benchmarked only through standard component coverage generation.

Work:

- [x] Split theme code by responsibility: ANSI/style primitives, component definitions, manifest parsing/validation,
      provider/registry, previews/reports, and standard packs.
  - [x] Extracted standalone ANSI style primitives into `src/theme_ansi.ts` while preserving `src/theme.ts` re-exports.
  - [x] Moved ANSI token-map construction into `src/theme_ansi.ts` as a generic `createAnsiStyleMap()` helper, removing
        duplicate token-building loops from the public facade and built-in palette module.
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
  - [x] Removed the last dead helper left behind in `src/theme.ts` after palette extraction and updated the audit
        evidence to reflect the current facade size.
  - [x] Extracted serializable manifest compilation primitives into `src/theme_manifest_core.ts`, keeping public
        `src/theme.ts` wrappers stable while giving manifest parsing a focused testable boundary.
  - [x] Extracted component validation and inheritance cycle checks into `src/theme_validation_core.ts`, keeping the
        public validation facade stable while making token/reference diagnostics independently testable.
  - [x] Extracted the concrete `ThemeEngine` implementation and inheritance error into `src/theme_engine.ts`, leaving
        `src/theme.ts` as the compatibility facade while covering the module boundary with direct tests.
  - [x] Extracted ordered theme layer composition into `src/theme_layer_stack.ts`, preserving the stable facade class
        while making layer enablement, composition, and inspection directly testable.
  - [x] Extracted theme pack registry storage and lookup into `src/theme_registry.ts`, preserving facade class and error
        identity while making pack inspection, overrides, and missing-pack behavior directly testable.
  - [x] Extracted provider active-option and validation issue inspection into `src/theme_provider_inspection.ts`,
        keeping theme/layer source attribution directly covered outside the facade.
  - [x] Extracted provider catalog and active-engine preview assembly into `src/theme_provider_preview.ts`, keeping
        catalog merging and preview filtering directly testable outside the facade.
  - [x] Extracted provider report aggregation into `src/theme_provider_report_builder.ts`, injecting coverage, preview,
        and validation collectors so report semantics can be tested without the public facade doing all the work.
  - [x] Extracted provider active-theme state, persistence, cycling, and inspection mechanics into
        `src/theme_provider.ts`, leaving `src/theme.ts` as the public facade and factory boundary.
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
  - [x] Hardened the API inventory CLI argument parser so unknown flags and extra positionals fail clearly instead of
        being mistaken for public entrypoint paths.
- [x] Add package docs that show preferred imports for apps versus framework authors.
- [x] Reduce accidental demo-only exports from stable entrypoints where possible without breaking current users.
  - [x] Added a `package-check` guard that scans the stable root inventory, allowlists the two legacy demo-named modules
        already in the baseline, and fails if new demo/fixture/sample modules leak into stable exports.
  - [x] Rechecked the stable inventory after the guard: remaining demo-like symbols are confined to the two legacy
        allowlisted modules, so the nonbreaking curation boundary is now enforced by `deno task package-check`.

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
- [x] Convert silent fallback paths in system metrics, graphics/Kitty surfaces, storage, audio, and browser storage into
      structured diagnostics where practical.
  - [x] Converted audio source discovery and meter startup/stream/stop failures to optional `DiagnosticsCollector`
        reports with injectable command fixtures for deterministic tests.
  - [x] Converted web workbench `localStorage` and IndexedDB fallback paths to deduplicated structured diagnostics
        surfaced through the in-demo log panel.
  - [x] Converted Three/Kitty graphics image cleanup failures to optional debug diagnostics instead of silent catches.
  - [x] Converted system monitor hostname and OS-release fallback paths to optional structured diagnostics so degraded
        monitor identity is inspectable without breaking snapshot creation.
  - [x] Converted process-session stdin close failures to structured diagnostics, matching existing spawn, stop, and
        input-write failure reporting.
  - [x] Converted API workbench workspace storage load/persist fallbacks to shared storage diagnostic formatting before
        surfacing them in the demo log panel.
  - [x] Added optional `TerminalShellController` diagnostics for shell startup and backend close-watcher failures, so
        workbench shell degradation can be surfaced outside the terminal text stream.
  - [x] Added optional terminal backend registry diagnostics for provider probe exceptions, preserving normalized
        availability inspection while making broken PTY providers visible to app-level status/report surfaces.
  - [x] Added deduplicated Three panel Kitty fallback diagnostics so "Kitty-only" renderer requests still show ASCII
        output and report unavailable raster graphics surfaces instead of failing silently.
  - [x] Added optional Sigma PTY backend diagnostics for input, resize, and read-stream failures while preserving the
        existing terminal-visible system lines.
- [x] Add status-bar and report helpers for degraded backends.
- [x] Add tests that assert expected diagnostics for missing `nvidia-smi`, blocked IndexedDB, unsupported Kitty
      graphics, and failed process spawns.

Acceptance checks:

- [x] Demos stay usable when optional capabilities are unavailable, but the user can inspect why a feature degraded.
  - [x] Terminal API Workbench now injects one `DiagnosticsCollector` into system metrics, process output, PTY shell,
        Kitty graphics, and Three ASCII panels; diagnostics appear in Recent actions and the bottom status bar without
        disabling fallback rendering.
- [x] Diagnostic output avoids noisy logs in normal operation.

### P3: Modularize Demo-Owned Visualization And Workbench Content

Current evidence:

- `app/visualizations.ts` is now `466` lines after family/renderer extraction.
- `app/neon_three.ts` is now `999` lines after catalog and geometry extraction.
- `app/grwizard_immediate.ts` is `2,490` lines.
- Demo modules contain reusable catalog, rendering, and widget patterns that could be package examples or fixtures.

Work:

- [x] Split visualization definitions by family: monitor, Neon text, Neon 3D, terminal/workspace, and layout.
  - [x] Added family query helpers for Monitor, Neon text, and Neon 3D visualization catalogs so demos/tests can target
        families without duplicating id filters. Terminal/workspace and layout remain built-in workbench window groups.
- [x] Move shared visualization metadata and source wiring into a registry module with typed capabilities.
  - [x] Added `app/visualization_catalog.ts` with Monitor, Neon text, and Neon 3D family metadata; the workbench New
        Window menu now classifies visualization options from this metadata before falling back to legacy id heuristics.
- [x] Keep rendering functions pure and fixture-testable.
  - [x] Extracted pure visualization drive/source normalization into `app/visualization_drive.ts`; render modules now
        consume a fixture-testable data transform instead of owning source sampling and hazard math directly.
  - [x] Extracted visualization dispatch into typed renderer maps so catalog ids, Three scene modes, and direct panel
        renderers are data-driven instead of encoded in one large switch.
  - [x] Extracted the CPU hex-grid visualization into `app/visualization_cpu_hex.ts`, keeping color interpolation,
        layout, selection, and process-detail behavior under the existing visualization dynamic tests.
  - [x] Extracted reusable NGE/Three ASCII field renderers into `app/visualization_fields.ts`, covering harmonic,
        psychograph, circular, heatmap, route-board, tactical-map, topology, live-feed, channel-matrix, telemetry-rack,
        biosignal-strip, and component-index text fields with focused bounded-output tests.
  - [x] Extracted pure visualization panel alert/source formatting helpers into `app/visualization_panel_helpers.ts`,
        keeping source footers, scene alerts, drive alerts, and fallback warnings under direct fixture tests.
  - [x] Extracted the responsive network monitor into `app/visualization_network.ts`, with chart/glyph dependencies
        injected from the visualization renderer instead of duplicating shared drawing utilities.
  - [x] Reworked network visualization row assembly to use bounded direct buffers instead of visible-row `slice`/`map`
        pipelines during redraw.
  - [x] Reduced shared visualization drive and Neon field renderer projection churn by replacing hot aggregate and
        visible-row transformations with direct loops.
  - [x] Extracted Three visualization text fallback body/footer rendering into `app/visualization_three_fallback.ts`,
        keeping primitive-mode fallback output directly fixture-testable outside the main visualization dispatcher.
  - [x] Optimized `ThreeAsciiObject` canvas handoff to queue only changed ASCII cells between frames, with a fake
        renderer regression proving stable frames do not enqueue redundant repaint cells.
  - [x] Removed per-draw `Computed` allocation from `VirtualList` by making formatted display rows part of the component
        lifecycle.
  - [x] Applied the same lifecycle-owned row computation pattern to `Stepper`, `ContextMenu`, and `RadioGroup`.
  - [x] Moved `EmptyState`, `Chart`, `LogViewer`, and `ToastStack` row projections into owned computed fields.
  - [x] Moved base `List` visible-row projection into an owned computed field so list-backed widgets do not allocate it
        from `draw`.
  - [x] Reused `CommandPaletteController.filtered` for component labels instead of creating a duplicate filtered
        projection during draw.
  - [x] Reduced `DataTableController` view churn by avoiding whole-table copies when no filter or sort is active and
        copying only the visible page rows.
  - [x] Added a conservative plain-ASCII fast path for `textWidth` and `cropToWidth`, preserving ANSI/Unicode fallback
        behavior.
  - [x] Reused the canvas spatial index for dirty-region affected object selection, replacing per-object dirty
        intersection checks with indexed candidate membership.
  - [x] Added non-cloning `DirtyRegion` segment traversal for render-path spatial queries while preserving cloned
        inspection output for diagnostics.
  - [x] Added shared bounded top-N ranking for limited command surface and command search index queries, avoiding full
        match sorting when callers request a small result set.
  - [x] Reduced direct command surface search allocation by building weighted search fields in one pass per item.
  - [x] Cached flattened tree rows and row labels in `TreeController`, avoiding repeated full-tree projection during
        selection, inspection, and file-explorer navigation.
  - [x] Added a no-filter local data query fast path and benchmark so paging large unchanged datasets avoids redundant
        filter/sort copies.
  - [x] Cached ordered open/all window projections in `WindowManagerController` and added a resize/state churn benchmark
        covering focus, fullscreen, minimize, restore, ordering, and layout.
  - [x] Reduced terminal workspace split-resize churn by avoiding a pre-update full layout clone and cloning only the
        changed split path.
  - [x] Reused a component-owned textbox visual cursor projection so cursor, line-number, highlight, and wrapped row
        rendering no longer re-wrap the same text independently.
  - [x] Optimized core theme style composition by replacing `filter`/`reduce` pipelines with single-pass composition and
        loop-based application.
  - [x] Removed duplicate option-child scans from markup combobox/select hydration.
  - [x] Cached sorted runtime renderer backend ids and definitions inside the backend registry, avoiding repeated sort
        and projection work during renderer selection, inspection, controller cycling, and catalog rendering.
  - [x] Added static lookup/search/category/capability indexes for the component catalog so docs, command surfaces, and
        demo browsers do not recompute normalized metadata on every query/report.
  - [x] Cached sorted runtime profile ids and profile objects inside the profile registry and added a static profile
        definition lookup so profile cycling, inspection, and catalog rendering avoid repeated sorting and construction.
  - [x] Added an id/label index plus cached inspection ids to the app plugin definition registry, replacing repeated
        linear scans in plugin lookup, replacement, unregister, and registry inspection paths.
  - [x] Cached settings controller key and local-key projections, preserving cloned public inspection output while
        avoiding repeated sort/remap work in settings panes and app inspection.
  - [x] Cached command registry sorted command and group projections, avoiding repeated sorting across command surfaces,
        keymap binding sync, key lookup, palette projection, and command inspection.
  - [x] Cached route id and route-index projections in `RouteManager`, invalidating through the route signal so
        navigation, registration, active lookup, and inspection avoid repeated linear scans.
  - [x] Cached `ActionBus` middleware dispatch snapshots and invalidated them on middleware registration/disposal,
        avoiding per-dispatch array rebuilds while preserving dispatch-order semantics.
  - [x] Removed full terminal workspace layout clones for active-pane and zoom metadata updates, keeping cloned tree
        updates only on pane structure changes.
  - [x] Cached ordered theme engine factory ids and factory lists inside `ThemeEngineFactoryRegistry`, avoiding repeated
        priority sorting across catalogs, inspections, and prewarm selection.
  - [x] Cached sorted theme pack ids inside `ThemeRegistryImplementation`, preserving cloned public ids while reducing
        repeated provider cycle/inspection sorting.
  - [x] Cached `ThemeEngine` component-name and variant metadata per engine, preserving cloned public returns while
        reducing repeated theme inspection and gallery projection work.
  - [x] Cached theme layer stack ids, active ids, and active option projections behind the existing layer revision
        touch, reducing provider signature and layer composition churn.
  - [x] Cached terminal backend registry ids, provider snapshots, and sorted provider lists while keeping availability
        probes live, reducing repeated backend ordering work during inspect and resolve.
  - [x] Cached theme pipeline ids, active ids, and active step entries behind pipeline mutation notifications, reducing
        repeated active-step scans during pipeline apply, prewarm, and settings binding.
  - [x] Cached theme palette registry ids behind palette register/unregister, preserving defensive public array copies
        while reducing repeated sorting in palette inspections and provider setup.
  - [x] Reduced label and key-help render-helper allocations by replacing hot-path `reduce`/`map().join()` formatting
        with bounded loops that preserve existing output.
  - [x] Reduced modal row rendering churn by clipping height in-place and stopping action-row assembly once the visible
        width is filled.
  - [x] Precomputed standard theme component names, sorted catalog entries, and normalized lookup keys so theme preset
        construction no longer re-sorts the static component catalog.
  - [x] Cached installed app plugin ids and inspection metadata behind plugin install/dispose invalidation, while
        preserving defensive copies for public app inspection.
  - [x] Trimmed textbox word-wrap iteration by replacing iterator destructuring with indexed traversal in the visual
        line renderer.
  - [x] Reworked terminal screen character insert/delete/erase paths to shift and blank cells in-place instead of
        allocating temporary blank rows and spreading them into row splices, with a targeted terminal edit-churn
        benchmark added to keep that path measured.
- [x] Make demo-only assets and NGE-inspired primitives clearly separate from library APIs.
  - [x] Added `app/neon_three_catalog.ts` for supported Three scene metadata and labels, keeping demo/NGE catalog data
        separate from the monolithic scene factory and shared by visualization footers plus scene coverage tests.
  - [x] Extracted NGE/Neon Three primitive geometry builders into `app/neon_three_geometry.ts`, keeping scene assembly
        separate from reusable mesh/line/group construction with focused structural tests.
  - [x] Extracted API Workbench synthetic visualization sources, source-id routing, and demo system snapshots into
        `app/workbench_synthetic.ts`, keeping fixture data out of the terminal renderer and under focused tests.

Acceptance checks:

- [x] Visualization dynamic tests can target individual families.
- [x] Workbench New Window menu derives from registry metadata without demo-local branching.

## Cross-Cutting Test Plan

- [x] Add full-frame render invalidation tests for overlapping draw objects, scrollable workspaces, and modals.
  - [x] Added a canvas regression covering a modal overlay opening/closing over scrolled viewport content.
- [x] Add real workbench controller tests after extraction, covering both terminal and web adapters.
  - [x] Added initial internal controller tests around shared menu/window state; adapter-level parity tests still need
        to exercise both the terminal and browser render adapters through the same controller contract.
  - [x] Added adapter-flow parity coverage for terminal and web workbench controller usage, covering menu disclosure,
        menu index movement, focus transfer, and fullscreen selection through one shared inspection contract.
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
