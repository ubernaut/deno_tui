# Repo Shape Reduction And Runtime-Focused Refactor

## Goal

Reduce repository sprawl and demo/test bloat without weakening the core Deno TUI library. Favor fewer, clearer modules,
runtime probes that catch real failures, and deletion-heavy refactors over adding more narrow implementation tests.

## Current Snapshot

- Tracked files after the current consolidation passes: `575`
- Tracked top-level file counts:
  - `src`: `296`
  - `tests`: `79`
  - `app`: `29`
  - `docs`: `50`
  - `examples`: `42`
  - `scripts`: `27`
  - `plan`: `26`
- Handwritten/code-heavy line counts:
  - `src/app`: `24,839` lines across `77` files
  - `src/runtime`: `11,152` lines across `34` files
  - `src/components`: `10,304` lines across `43` files
  - `src/three_ascii`: `7,000` lines across `25` files
  - `app`: `20,381` lines across `29` files
  - `examples`: `8,814` lines across `42` files
  - `tests`: `49,631` lines across `79` files
- Generated/docs weight:
  - `docs/screenshots`: roughly `26MB`
  - `docs/assets/api-workbench.js`: roughly `728KB`
  - `docs/api-reference.md`: roughly `556KB`
  - `docs/assets/api-workbench.js.map` is no longer tracked; `deno task web:pages:build` omits sourcemaps and removes
    stale map artifacts.

## Findings

The biggest maintainability issue is not one oversized file alone. The repo has accumulated many small feature, adapter,
parser, and test files around demo-specific behavior. That increases import churn, makes runtime breakage easy to miss,
and creates the impression of broad coverage even when the real failure mode is interactive workbench behavior.

The library core is real and valuable, but it needs clearer boundaries:

- `src` should hold reusable APIs and renderer/runtime internals.
- `app` should be a thin demo/application layer, not a second framework.
- `examples` should demonstrate package APIs, not carry parallel app frameworks.
- `tests` should protect behavior and runtime contracts, not every tiny implementation shard.
- checked-in docs artifacts should be intentional GitHub Pages inputs, not unexamined bulk.

## Priority Reductions

### P1: Collapse App-Only Helper Shards

- Consolidate small app-only parser/helper modules that have one runtime caller and direct tests.
- Completed first passes:
  - system metrics parser shards are now in `app/system_metrics_sources.ts`
  - workbench buffer caches are now in `src/app/workbench_buffers.ts`
  - workbench ANSI cursor/span caches are now private helpers inside `src/app/workbench_ansi_screen.ts`
  - standalone visualization app navigation and monitor-window helpers are local to `app/main.ts`
  - API workbench explorer, inspector, and log row projectors are bundled in `app/workbench_panels.ts`
  - visualization Three fallback/signal helpers are bundled behind `app/visualizations.ts`
  - the app ASCII options shim was removed in favor of direct `src/three_ascii/*` imports
  - system metric diagnostics are folded into `app/system_metrics.ts`
  - system metrics network parsing is folded into `app/system_metrics_sources.ts`
  - API workbench content-size projection is folded into `app/workbench_panels.ts`
  - input-widget command helpers are folded into `src/app/widget_commands.ts`
  - terminal scrollback command helpers are folded into `src/app/terminal_commands.ts`
  - modal focus binding is folded into `src/focus.ts`
  - form field binding is folded into `src/app/forms.ts`
  - runtime profile, renderer, and workload command helpers are folded into `src/app/runtime_commands.ts`
  - settings reset command helpers are folded into `src/app/settings.ts`
  - history route and command bindings are folded into `src/app/history.ts`
  - terminal window layout bindings are folded into `src/app/terminal_commands.ts`
  - theme pipeline command helpers are folded into `src/app/theme_commands.ts`
  - theme engine command helpers are folded into `src/app/theme_commands.ts`
  - data query params/result/table bindings are folded into `src/app/data_query_commands.ts`
  - route signal, index, and command bindings are folded into `src/app/router.ts`
  - runtime profile plugin wiring is folded into `src/app/runtime_commands.ts`
  - runtime renderer backend plugin wiring is folded into `src/app/runtime_commands.ts`
  - data query plugin wiring is folded into `src/app/data_query_commands.ts`
  - theme workspace plugin wiring is folded into `src/app/theme_plugin.ts`
  - API workbench control styles and wrapped-option projection are folded into `app/api_workbench_controls.ts`
  - API workbench primitive control ids and hit types are folded into `app/api_workbench_controls.ts`
  - API workbench control row projection is folded into `app/api_workbench_controls.ts`
  - API workbench textbox projection is folded into `app/api_workbench_controls.ts`
  - API workbench window catalog construction is folded into `app/api_workbench_catalog.ts`
  - Neon Three ASCII wire overlays are folded into `app/neon_three.ts`
  - Three panel value, lifecycle, and frame-update helpers are folded into `src/app/three_panel_core.ts`
  - Workbench Three panel defaults are folded into `src/app/workbench_three_policy.ts`
  - Workbench terminal size synchronization is folded into `src/app/workbench_repaint_policy.ts`
  - Workbench Three overlay pressure gating is folded into `src/app/workbench_three_runtime.ts`
  - Three panel render queue serialization is folded into `src/app/three_panel_core.ts`
  - Workbench Three cadence telemetry is folded into `src/app/workbench_three_runtime.ts`
  - app sorted-string insertion is folded into `src/app/commands.ts`
  - Three ASCII deferred readback staleness now lives in `src/three_ascii/deferred_frame.ts`
  - Three ASCII deferred readback submission and failure handling now live in `src/three_ascii/renderer.ts`
  - Three ASCII camera-aspect, image-frame, and mapped-readback helpers now live in `src/three_ascii/renderer.ts`
  - Three ASCII compute dispatch command encoding now lives in `src/three_ascii/compute_plan.ts`
  - Three ASCII compute bind-group assembly now lives in `src/three_ascii/compute_resources.ts`
  - Workbench viewport sizing and active-window reveal scroll math now live in `src/app/workbench_layout.ts`
  - Workbench frame row assembly now lives in `src/app/workbench_frame.ts`
  - Workbench ANSI output flushing now lives in `src/app/workbench_ansi_screen.ts`
  - Workbench diagnostic status/log formatting now lives in `src/app/workbench_status.ts`
  - Workbench Three window-state resolution now lives in `src/app/workbench_three_policy.ts`
  - Workbench Three fullscreen/runtime ASCII budget policy now lives in `src/app/workbench_three_policy.ts`
  - Neon Three scene catalog labels now live with the scene factory in `app/neon_three.ts`
  - Workbench mobile command strip projection now lives in `src/app/workbench_control_layout.ts`
  - Visualization slot default ordering now lives with the visualization facade in `app/visualizations.ts`
  - System monitor process parsing and sorting now live in `app/system_metrics.ts`
  - Showcase demo rendering now reuses the Neon suite render context and synthetic snapshot path in `app/neon_suite.ts`
  - Monitor visualization renderers now share the truncation helper from `app/visualization_primitives.ts`
  - Neon showcase and Neon Exodus now share their empty panel fallback through `app/neon_suite.ts`
  - CPU monitor and CPU hex grid now share load-average and severity helpers through `app/visualization_primitives.ts`
  - source-frame detail formatting now reuses compact byte and nullable-number helpers from `app/styles.ts`
  - visualization panel source/alert summary helpers are folded into `app/visualization_primitives.ts`
  - API workbench control-line projection is folded into `app/api_workbench_controls.ts`
  - network monitor rendering is folded into the visualization catalog module that owns its only caller
  - synthetic waveform helpers are folded into `app/visualization_primitives.ts` so Neon and workbench synthetic data
    share the existing visualization helper module instead of a standalone app shard
  - CPU hex-grid monitor layout, interaction, and render helpers are folded into `app/visualization_system.ts`, keeping
    the public `app/visualizations.ts` facade stable while removing the standalone CPU hex app shard
  - GPU monitor render helpers are folded into `app/visualization_system.ts` so CPU, memory, disk, process, and GPU
    resource panels share one system monitor visualization module behind the stable `app/visualizations.ts` facade
  - Three visualization fallback/signal helpers are folded into `app/visualizations.ts`, keeping renderer selection and
    fallback behavior behind the same visualization facade instead of a standalone app-only shard
  - Workbench ANSI span diff helpers are folded into `src/app/workbench_ansi_screen.ts`, keeping retained row diffing
    inside the screen painter module that owns its only runtime path
  - API workbench workspace storage defaults are folded into `src/app/workbench_workspace_menu.ts`, keeping workspace
    menu behavior and persistence policy together instead of in a separate app-only config shard
  - Three panel graphics-handle and grid-publication helpers are folded into `src/app/three_panel_core.ts`, keeping
    frame ownership, grid publishing, and raster-image lifecycle logic in one Three panel core module
  - API workbench terminal paint helpers are now private to `app/api_workbench.ts`, avoiding a reusable `src/app` shard
    for renderer-specific color mapping that is not part of the public terminal API
  - API workbench terminal status and output-line colors now live in `app/api_workbench_catalog.ts`, keeping shared
    console/browser presentation policy app-local without adding public terminal API surface
  - the unused allocating `resolveSourceFrames` app wrapper was removed; runtime paths use the reusable
    `resolveSourceFramesInto` buffer API directly
  - Three ASCII compute-mode resolution is folded into `src/three_ascii/effect_state.ts`, removing an internal renderer
    shard while keeping the compute pass decision covered by the existing Three ASCII core tests
  - Three ASCII compute-pipeline creation and caching is folded into `src/three_ascii/compute_resources.ts`, keeping
    WebGPU pipeline and bind-group resource helpers together instead of in a standalone internal shard
  - Three ASCII readback grid assembly is folded into `src/three_ascii/readback.ts`, keeping packed readback layout,
    typed view caching, and ANSI grid assembly adaptation in one internal readback module
  - Three ASCII indexed ANSI color-key caching is folded into `src/three_ascii/colors.ts`, keeping linear-to-byte color
    conversion and per-cell color-key reuse together instead of in a standalone internal shard
  - Three ASCII GPU buffer slot helpers are folded into `src/three_ascii/compute_resources.ts`, keeping WebGPU buffer
    lifecycle, pipeline caching, and bind-group resource helpers in one internal resource module
  - Three ASCII compute uniform packing is folded into `src/three_ascii/compute_resources.ts`, keeping uniform buffer
    layout and compute resource lifecycle in the same internal renderer module
  - Three ASCII effect option patching is folded into `src/three_ascii/effect_state.ts`, keeping effect defaults, option
    mutation, uniform dirtiness, and compute-mode decisions in one internal effect module
  - Three ASCII deferred pre-scene and stale-frame policy is folded into `src/three_ascii/deferred_readback.ts`, keeping
    deferred queue ownership and readback freshness decisions in one internal module
  - Three ASCII ANSI background state is folded into `src/three_ascii/colors.ts`, keeping truecolor conversion,
    background SGR state, and color-key caches in one internal color module
  - Three ASCII probe CLI helpers are folded into `src/three_ascii/probe.ts`, keeping probe option parsing, summaries,
    timing formatting, and CLI argument helpers in one probe-support module
  - Three ASCII panel probe summaries and validation are folded into `src/three_ascii/probe.ts`, keeping renderer and
    panel live-probe support together instead of split across tiny internal probe shards
  - Three ASCII direct range copies now collapse repeated output cells through the existing range helper, reducing
    per-cell work in block-heavy workbench panes without adding another renderer module
  - ANSI canvas range flushing now caches parsed SGR prefix state, reducing repeated string scans while compacting
    truecolor Three ASCII block spans across warm frames
  - Workbench Three pressure probe support now lives in `src/app/workbench_three_pressure_probe.ts`, keeping
    app-specific terminal pressure analysis out of the reusable Three ASCII renderer package boundary
  - System metrics provider contracts and the Deno-backed provider are folded into `app/system_metrics_sources.ts`,
    keeping app-only OS sampling sources together and removing a standalone provider shard without public API drift
  - NVIDIA GPU sampling contracts, parser, and provider are folded into `app/system_metrics_sources.ts`, keeping GPU
    command sampling with the other app-only system metric source adapters
  - System snapshot history, alert, and empty-snapshot helpers are folded into `app/system_metrics.ts`, keeping monitor
    state projection with the monitor controller and removing another app-only helper shard
  - API workbench data-table row projection is folded into `app/workbench_panels.ts`, keeping panel content projection
    together and removing a single-purpose app helper used only by the console and browser workbench demos
  - API workbench modal content helpers are folded into `app/workbench_panels.ts`, keeping shared terminal/browser
    presentation helpers together and removing another single-purpose app helper shard
  - Neon Three geometry helpers are folded into `app/neon_three.ts`, keeping primitive scene builders with the scene
    factory that owns them and removing a standalone app-only geometry shard
  - Visualization catalog metadata and slot ordering are folded into `app/visualizations.ts`, keeping catalog, family
    lookup, ordering, and render dispatch behind one stable visualization facade
  - app multiline text and list views now share one private retained-line lifecycle helper in `app/ui.ts`, removing
    duplicated resize/draw growth code without adding another app module
  - Neon Three colors now derive from the shared app palette, removing a duplicated app-only color table while
    preserving the existing Neon scene facade
  - Workbench navigation help rows are folded into `src/app/workbench_status.ts`, keeping shortcut/help copy with the
    status presentation helpers while preserving the public workbench facade export
  - Workbench prompt-input helpers are folded into `src/app/workbench_text.ts`, keeping single-line prompt editing with
    the shared text utilities that already own the corresponding tests and facade export
  - Workbench Three viewport mouse routing is folded into `src/app/workbench_three_panel_registry.ts`, keeping panel
    lifecycle and pointer interaction ownership together without widening the public workbench facade
  - Standalone Three ASCII demo window geometry is folded into the app-local type surface in `app/types.ts`, keeping
    terminal and web Three demo layout helpers out of a standalone app-only shard without widening the stable package
    API
  - Three panel rotate/zoom interaction state is folded into `src/app/three_panel_core.ts`, keeping frame lifecycle,
    grid publication, graphics handles, and renderer interaction ownership in one core helper module while removing a
    standalone internal shard
  - Workbench global key resolution is folded into `src/app/workbench_menu.ts`, keeping top-level menu and shortcut
    behavior in one stable facade module while removing the standalone keymap shard
- Next app-layer candidates:
  - tiny control/window constants that are only consumed by workbench demos
  - app-only visualization fallback helpers with a single consumer
  - narrow tests that only defend one private app helper file
- Keep monitor behavior and tests intact, but reduce file count and import surface.

### P1: Replace Test Shard Proliferation With Behavioral Bundles

- Merge tiny tests when they cover the same subsystem and do not need separate fixtures.
- Preserve meaningful assertions, but stop creating one test file per one tiny helper.
- Completed first passes:
  - `tests/utils/*` are now `tests/utils.test.ts`
  - API workbench explorer, inspector, and log projector tests are now `tests/workbench_panels.test.ts`
  - visualization Three fallback/signal and renderer fallback tests are now `tests/visualization_three.test.ts`
  - Neon Three scene catalog and geometry helper tests are now bundled into `tests/neon_suite.test.ts`
  - system metric diagnostics tests are part of `tests/system_metrics.test.ts`
  - storage fallback diagnostics tests are part of `tests/runtime.test.ts`
  - tiny theme catalog, ANSI facade, layer stack, registry, engine, diff, coverage, manifest, and validation tests are
    now `tests/theme_core.test.ts`
  - theme provider facade, inspection, preview, and report tests are now `tests/theme_provider_workflows.test.ts`
  - Three ASCII shader, LUT, color, and glyph-key tests are now `tests/three_ascii_core.test.ts`
  - Three panel timing, value, frame-update, and lifecycle helper tests are now `tests/three_panel_core.test.ts`
  - Three panel cadence and render-queue helper tests are now bundled into `tests/three_panel_core.test.ts`
  - Three ASCII probe CLI helper tests are now bundled into `tests/three_ascii_probe.test.ts`
  - generic visual smoke assertions are now bundled into `tests/workbench_visual_smoke.test.ts`
  - system metrics source/parser assertions are now bundled into `tests/system_metrics_core.test.ts`
  - terminal status presentation tests are now bundled into `tests/terminal_process.test.ts`, keeping process/session
    behavior and presentation assertions in one terminal suite
  - HTML/CSS layout fixtures and generated simple/Yoga parity checks are now bundled into
    `tests/html_css_layout.test.ts`, keeping markup/CSS solver coverage with the owning layout suite
  - Workbench Three pressure-probe summary, validation, CLI, and grid snapshot assertions are bundled into
    `tests/workbench_three_terminal_pressure.test.ts`
  - Terminal scrollback controller and command assertions are now bundled into `tests/terminal_screen.test.ts`, keeping
    scrollback copy-mode/search/selection behavior with the runtime terminal screen coverage.
  - Terminal workspace layout helper assertions are now bundled into `tests/terminal_workspace.test.ts`, keeping pane
    creation, clone/prune, replace/remove/resize, title projection, and rect projection with workspace behavior.
  - EventEmitter behavior tests are now bundled into `tests/app_primitives.test.ts`, removing the standalone root
    primitive test shard without adding narrower coverage.
  - HitTargetStack and rectangle-helper behavior tests are now bundled into `tests/app_primitives.test.ts`, removing
    another standalone app-primitive shard without changing the covered assertions.
  - system metrics GPU, network, process, and snapshot helper tests are now `tests/system_metrics_core.test.ts`
  - small Three ASCII renderer option/profile/frame/cache helper shards are now bundled into
    `tests/three_ascii_core.test.ts`
  - API workbench window catalog assertions are now bundled into `tests/workbench_panels.test.ts`
  - visualization panel helper assertions are now bundled into `tests/visualization_primitives.test.ts`
  - Three ASCII GPU buffer, uniform, performance, and headless canvas helper assertions are now bundled into
    `tests/three_ascii_core.test.ts`
  - Three panel effect, grid, and graphics helper assertions are now bundled into `tests/three_panel_core.test.ts`
  - Three panel diagnostic assertions are now bundled into `tests/three_panel_core.test.ts`
  - Workbench terminal-size sync assertions are now bundled into `tests/workbench_repaint_policy.test.ts`
  - Workbench diagnostics formatting assertions are now bundled into `tests/workbench_status.test.ts`
  - Workbench text helper and prompt-input assertions are now bundled into `tests/workbench_facade.test.ts`
  - Workbench styled-row render assertions are now bundled into `tests/workbench_rows.test.ts`
  - Workbench terminal style assertions are now bundled into `tests/workbench_terminal.test.ts`
  - Workbench viewport helper assertions are now bundled into `tests/workbench_layout.test.ts`
  - Workbench Three window-state assertions are now bundled into `tests/workbench_three_policy.test.ts`
  - Workbench Three fullscreen/runtime ASCII budget assertions are now bundled into
    `tests/workbench_three_policy.test.ts`
  - App style helper assertions are now bundled into `tests/app_primitives.test.ts`
  - Three ASCII deferred pre-scene, staleness, submission, and failure assertions are now bundled into
    `tests/three_ascii_core.test.ts`
  - Three ASCII effect option and effect state assertions are now bundled into `tests/three_ascii_core.test.ts`
  - Three ASCII compute pipeline assertions are now bundled into `tests/three_ascii_core.test.ts`
  - Three ASCII renderer lifecycle, deferred fallback, and mapped-readback helper assertions are now bundled into
    `tests/three_ascii_core.test.ts`
  - Three ASCII compute dispatch and resource-plan assertions are now bundled into `tests/three_ascii_core.test.ts`
  - Three ASCII compute command and bind-group assertions are now bundled into `tests/three_ascii_core.test.ts`
  - Three ASCII readback layout, copy-plan, view-cache, and assembly adapter assertions are now bundled into
    `tests/three_ascii_core.test.ts`
  - Three ASCII canvas rerender range assertions are now bundled into `tests/three_ascii_diff.test.ts`
  - Three ASCII deferred readback queue assertions are now bundled into `tests/three_ascii_core.test.ts`
  - layout recipe, breakpoint markdown, slot inspection, and signal-backed recipe controller assertions are now bundled
    into `tests/responsive_layout.test.ts`, keeping responsive layout recipe coverage with the layout primitives and
    window-manager suite.
  - Three ASCII WebGPU compatibility retry/lost-device assertions are now bundled into `tests/three_ascii_core.test.ts`
  - Three ASCII preset/default option assertions are now bundled into `tests/workbench_ascii.test.ts`
  - Standalone Three ASCII demo window geometry assertions are now bundled into `tests/three_ascii_glyphs.test.ts`
  - Workbench Kitty graphics status and tmux passthrough assertions are now bundled into
    `tests/graphics_surface.test.ts`
  - Simple grid solver helper assertions are now bundled into `tests/html_css_layout.test.ts`, keeping private grid
    placement coverage with the HTML/CSS simple solver behavior
  - Split-pane rect, resize, ratio, and controller assertions are now bundled into `tests/responsive_layout.test.ts`,
    keeping split-pane behavior with the rest of the layout primitive and window-manager coverage.
  - Signal-driven legacy `HorizontalLayout`, `VerticalLayout`, and `GridLayout` assertions are now bundled into
    `tests/responsive_layout.test.ts`, keeping old and new layout primitive coverage in one subsystem suite.
  - API workbench data-table panel projection and page-size assertions are now bundled into
    `tests/workbench_panels.test.ts`, keeping data-table panel rows with the rest of the workbench panel projectors.
  - Workbench titlebar layout and button render-command assertions are now bundled into `tests/workbench_frame.test.ts`,
    keeping renderer-neutral window chrome coverage with frame and frame-box projection behavior.
  - Workbench full-repaint and terminal-size synchronization assertions are now bundled into
    `tests/workbench_layout.test.ts`, keeping resize/repaint policy checks with the workbench viewport and layout suite.
  - Workbench Three header, data footer, and styled-row render-command assertions are now bundled into
    `tests/workbench_status.test.ts`, keeping status, header, footer, and row presentation coverage together.
  - Workbench Three header telemetry assertions are now bundled into `tests/workbench_three_panel.test.ts`
  - flex layout assertions are now bundled into `tests/responsive_layout.test.ts`
  - Visualization panel defaults are now bundled into `tests/visualization_launcher.test.ts`
  - Workbench mobile command strip assertions are now bundled into `tests/workbench_control_layout.test.ts`
  - Workspace launcher catalog, file-explorer, window-preview, wrapped-bar, and quit-modal assertions are now bundled
    into `tests/visualization_launcher.test.ts`, keeping demo launcher behavior in one subsystem suite.
  - API workbench hit resolution, scrollbar offsets, and touch-target expansion assertions are now bundled into
    `tests/api_workbench_controls.test.ts`, keeping keyboard, control, pointer, and hit behavior together.
  - Workbench help and shared modal-content assertions are now bundled into `tests/workbench_facade.test.ts`
  - Web API workbench terminal workspace assertions are now bundled into `tests/web_remote_terminal.test.ts`
  - GPU probe lock assertions are now bundled into `tests/three_ascii_probe.test.ts`
  - Three panel live-probe summary and validation assertions are now bundled into `tests/three_ascii_probe.test.ts`
  - Workbench global keymap assertions are now bundled into `tests/workbench_facade.test.ts`
  - Three panel interaction assertions are now bundled into `tests/three_panel_core.test.ts`
  - Workbench Three viewport interaction assertions are now bundled into `tests/workbench_three_panel.test.ts`
  - Workbench Three overlay pressure gate assertions are now bundled into `tests/workbench_three_runtime.test.ts`
  - Workbench Three panel registry assertions are now bundled into `tests/workbench_three_panel.test.ts`
  - Workbench Three geometry/rectangle projection assertions are now bundled into `tests/workbench_three_panel.test.ts`
  - Workbench Three scene projection and equality assertions are now bundled into `tests/workbench_three_panel.test.ts`
  - Three panel adaptive render-cell budgeting is folded into `src/app/three_panel_policy.ts`, with its assertions now
    bundled into `tests/three_panel_core.test.ts`
  - Three panel diagnostics are folded into `src/app/three_panel_core.ts`, keeping slow-frame, adaptive-budget, and
    Kitty fallback reporting with the panel runtime helpers instead of a standalone module
  - Three panel renderer-state/effect comparison helpers are folded into `src/app/three_panel_core.ts`, keeping renderer
    update decisions with the panel runtime helpers instead of a standalone module
  - Workbench frame render-command assertions are now bundled into `tests/workbench_frame.test.ts`
  - Workbench content-size assertions are now bundled into `tests/workbench_panels.test.ts`
  - Workbench button style assertions are now bundled into `tests/workbench_control_layout.test.ts`
  - Workbench ANSI span-diff assertions are now covered through `tests/workbench_ansi_screen.test.ts`, and the redundant
    private-helper microbenchmark was removed in favor of the retained screen-painter span flush benchmark
  - Canvas spatial-index assertions are now bundled into `tests/canvas_intersections.test.ts`
  - Canvas rerender-queue assertions are now bundled into `tests/canvas_dirty_region.test.ts`, keeping dirty-region and
    rerender invalidation helper coverage together
  - duplicate mouse interaction router assertions were removed from `tests/mouse_bindings.test.ts`; the remaining
    dynamic-bounds assertion now lives with the existing app interaction coverage in `tests/app_primitives.test.ts`
  - duplicate Three panel lifecycle-state assertions were removed from `tests/three_panel_frame.test.ts`; the pure
    helper behavior remains covered in `tests/three_panel_core.test.ts`, keeping frame tests focused on live view
    behavior.
  - duplicate Three panel render-policy, render-size, and adaptive-budget assertions were removed from
    `tests/three_panel_frame.test.ts`, then the standalone policy test shard was folded into
    `tests/three_panel_core.test.ts`; the frame suite stays focused on live panel behavior and renderer lifecycle
    scenarios.
  - terminal status tone color mapping is now resolved by the shared API Workbench catalog and covered in
    `tests/workbench_panels.test.ts`, removing another renderer-local presentation switch without widening the stable
    package surface.
  - `app/three_panel.ts` no longer re-exports pure Three panel policy/core helpers for test convenience; tests import
    those helpers from `src/app/*` directly, keeping the app facade focused on the view classes and factory.
  - app audio discovery and meter-failure assertions are now bundled into `tests/visualizations_dynamic.test.ts`,
    keeping app-only audio source behavior with the dynamic visualization/source-frame coverage that consumes it.
  - visualization field renderer assertions are now bundled into `tests/visualization_primitives.test.ts`, keeping
    bounded ASCII field coverage with the lower-level visualization drawing helpers.
  - workbench synthetic source/system assertions are now bundled into `tests/visualizations_dynamic.test.ts`, keeping
    synthetic monitor fixture behavior with the source-frame and visualization dynamic coverage that consumes it.
  - API reference markdown formatter assertions are now bundled into `tests/api_inventory.test.ts`, keeping generated
    package reference coverage with the inventory script behavior that feeds it.
  - terminal sequence parser assertions are now bundled into `tests/terminal_screen.test.ts`, keeping low-level
    CSI/OSC/ESC parser coverage with the terminal screen replay behavior that consumes it.
  - Terminal workspace session descriptor assertions are now bundled into `tests/terminal_workspace.test.ts`, keeping
    template materialization, clone/duplicate behavior, and runtime-title adoption with terminal workspace behavior.
  - Terminal shell workspace controller and command assertions are now bundled into `tests/terminal_workspace.test.ts`,
    keeping live shell coordination with the workspace controller behavior it extends.
  - GPU monitor helper and renderer assertions are now bundled into `tests/visualization_system.test.ts`, keeping GPU,
    CPU, memory, disk, thermal, and process monitor rendering coverage with the system visualization module.
  - HTML/CSS layout view projection assertions are now bundled into `tests/html_css_layout.test.ts`, keeping the demo
    render-command surface with the parser, cascade, solver, worker, and widget hydration coverage it presents.
  - standalone visualization app layout and retained panel resize assertions are now bundled into
    `tests/visualization_primitives.test.ts`, keeping app-local monitor layout and panel rendering coverage with the
    lower-level visualization drawing helpers that use them.
  - Health script catalog and result-formatting assertions are now bundled into `tests/e2e_script.test.ts`, keeping repo
    gate script coverage together and removing another standalone script micro-suite.
- Prefer subsystem-level runtime smoke coverage for workbench, Three ASCII, terminal shell, and web interaction.

### P1: Keep Three ASCII Performance Gated By Real Probes

- Continue using benchmark cases for hot helpers, but treat live probes as required evidence:
  - `deno task three-workbench:startup-probe`
  - `deno task three-ascii:live-probe -- --frames 45 --glyphs blocks --max-cells 960 --check --max-average-ms 40`
- Latest workbench block-mode startup probe after the Three panel interaction-core consolidation: `7.05ms` steady
  average, about `141.8 fps` at `53x17` cells with the capped default-workbench probe. Latest standalone block-mode live
  probe defaults to deferred readback and reports `7.11ms` steady average, about `140.6 fps` at `31x15` cells; explicit
  blocking readback on the same probe previously reported `18.71ms` steady average, about `53.5 fps`.
- Avoid speculative micro-optimizations unless they improve measured workbench/default-demo behavior.

### P2: Split Demo Framework From Library Framework

- Audit `app/api_workbench.ts`, `examples/web/api_workbench_page.ts`, and `app/main.ts` for reusable model/controller
  code that should live in `src/app/workbench`.
- Do not add new feature surfaces until the adapter/model split is smaller and easier to reason about.

### P2: Rationalize Docs Artifacts

- Decide which generated docs artifacts must remain tracked for GitHub Pages.
- If a generated artifact can be rebuilt deterministically in CI or by `deno task`, stop treating it as source.
- Keep screenshots only when they are referenced and useful.
- Completed first pass:
  - removed the unreferenced `docs/assets/api-workbench.js.map` source map and changed the Pages build to omit future
    sourcemaps while still tracking the runnable `docs/assets/api-workbench.js` bundle.

### P3: Reduce Barrel And Compatibility Noise

- Review tiny `mod.ts` and compatibility facade files.
- Keep public package entrypoints stable, but collapse internal-only barrels that merely forward one or two helpers.
- The largest API-shape problem is the default stable `mod.ts` path exporting `src/app/mod.ts`, which in turn exports
  the renderer-neutral Workbench facade and many command helper modules. Removing those exports directly would be a
  breaking package change, so the next safe cleanup should introduce a focused migration path: keep stable imports
  working, add clearer package docs around focused entrypoints, and stop promoting new Workbench implementation helpers
  through `src/app/workbench/mod.ts` unless they are intentionally public.
- Package checks now grandfather the current stable `src/app/*` module set in `docs/api-stable-app-modules.json` and
  fail future stable root leaks of new app or Workbench implementation modules unless the allowlist is intentionally
  updated with migration rationale. The same check now fails stale allowlist entries so compatibility policy shrinks
  with future export cleanup.

## Acceptance Checks

- Each refactor checkpoint must reduce or simplify tracked source/test files, or remove duplicated logic.
- `deno task health` must pass before commits that touch shared runtime, workbench, or renderer code.
- Three ASCII checkpoints must pass both live probes above.
- New tests are allowed only when they replace broader missing runtime evidence or protect a refactor boundary.
- Each meaningful checkpoint gets an independent commit.
