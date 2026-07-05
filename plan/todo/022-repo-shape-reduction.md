# Repo Shape Reduction And Runtime-Focused Refactor

## Goal

Reduce repository sprawl and demo/test bloat without weakening the core Deno TUI library. Favor fewer, clearer modules,
runtime probes that catch real failures, and deletion-heavy refactors over adding more narrow implementation tests.

## Current Snapshot

- Tracked files after the current consolidation passes: `666`
- Tracked top-level file counts:
  - `src`: `321`
  - `tests`: `137`
  - `app`: `38`
  - `docs`: `49`
  - `examples`: `42`
  - `scripts`: `27`
  - `plan`: `26`
- Handwritten/code-heavy line counts:
  - `src/app`: `24,231` lines across `89` files
  - `src/runtime`: `11,119` lines across `35` files
  - `src/components`: `10,261` lines across `43` files
  - `src/three_ascii`: `7,201` lines across `35` files
  - `app`: `20,302` lines across `38` files
  - `examples`: `8,732` lines across `41` files
  - `tests`: `49,139` lines across `137` files
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
  - Visualization slot default ordering now lives with the visualization catalog in `app/visualization_catalog.ts`
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
  - system metrics GPU, network, process, and snapshot helper tests are now `tests/system_metrics_core.test.ts`
  - small Three ASCII renderer option/profile/frame/cache helper shards are now bundled into
    `tests/three_ascii_core.test.ts`
  - API workbench window catalog assertions are now bundled into `tests/api_workbench_catalog.test.ts`
  - visualization panel helper assertions are now bundled into `tests/visualization_primitives.test.ts`
  - Three ASCII GPU buffer, uniform, performance, and headless canvas helper assertions are now bundled into
    `tests/three_ascii_core.test.ts`
  - Three panel effect, grid, and graphics helper assertions are now bundled into `tests/three_panel_core.test.ts`
  - Three panel diagnostic assertions are now bundled into `tests/three_panel_core.test.ts`
  - Workbench terminal-size sync assertions are now bundled into `tests/workbench_repaint_policy.test.ts`
  - Workbench diagnostics formatting assertions are now bundled into `tests/workbench_status.test.ts`
  - Workbench prompt-input assertions are now bundled into `tests/workbench_text.test.ts`
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
  - Three ASCII mapped-readback helper assertions are now bundled into `tests/three_ascii_renderer.test.ts`
  - Three ASCII compute dispatch and resource-plan assertions are now bundled into `tests/three_ascii_core.test.ts`
  - Three ASCII compute command and bind-group assertions are now bundled into `tests/three_ascii_core.test.ts`
  - Three ASCII readback assembly adapter assertions are now bundled into `tests/three_ascii_readback.test.ts`
  - Public flex layout export assertions are now bundled into `tests/flex_layout.test.ts`
  - Visualization panel defaults are now bundled into `tests/visualization_launcher.test.ts`
  - Workbench mobile command strip assertions are now bundled into `tests/workbench_control_layout.test.ts`
  - Workbench help and shared modal-content assertions are now bundled into `tests/workbench_facade.test.ts`
  - Web API workbench terminal workspace assertions are now bundled into `tests/web_remote_terminal.test.ts`
  - GPU probe lock assertions are now bundled into `tests/three_ascii_probe.test.ts`
  - Workbench global keymap assertions are now bundled into `tests/workbench_facade.test.ts`
  - Three panel interaction assertions are now bundled into `tests/three_panel_core.test.ts`
- Prefer subsystem-level runtime smoke coverage for workbench, Three ASCII, terminal shell, and web interaction.

### P1: Keep Three ASCII Performance Gated By Real Probes

- Continue using benchmark cases for hot helpers, but treat live probes as required evidence:
  - `deno task three-workbench:startup-probe`
  - `deno task three-ascii:live-probe -- --frames 45 --glyphs blocks --max-cells 960 --check --max-average-ms 40`
- Latest workbench block-mode startup probe after defaulting panel/object demos to deferred readback: `6.76ms` steady
  average, about `147.9 fps` at `53x17` cells with the capped default-workbench probe. Latest standalone block-mode live
  probe now defaults to deferred readback and reports `7.23ms` steady average, about `138.2 fps` at `31x15` cells;
  explicit blocking readback on the same probe reports `18.71ms` steady average, about `53.5 fps`.
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

## Acceptance Checks

- Each refactor checkpoint must reduce or simplify tracked source/test files, or remove duplicated logic.
- `deno task health` must pass before commits that touch shared runtime, workbench, or renderer code.
- Three ASCII checkpoints must pass both live probes above.
- New tests are allowed only when they replace broader missing runtime evidence or protect a refactor boundary.
- Each meaningful checkpoint gets an independent commit.
