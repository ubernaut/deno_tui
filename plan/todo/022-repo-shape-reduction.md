# Repo Shape Reduction And Runtime-Focused Refactor

## Goal

Reduce repository sprawl and demo/test bloat without weakening the core Deno TUI library. Favor fewer, clearer modules,
runtime probes that catch real failures, and deletion-heavy refactors over adding more narrow implementation tests.

## Current Snapshot

- Tracked files after the current consolidation passes: `761`
- Tracked top-level file counts:
  - `src`: `361`
  - `tests`: `181`
  - `app`: `48`
  - `docs`: `50`
  - `examples`: `42`
  - `scripts`: `27`
  - `plan`: `26`
- Handwritten/code-heavy line counts:
  - `src/app`: `24,266` lines across `119` files
  - `src/runtime`: `11,119` lines across `35` files
  - `src/components`: `10,241` lines across `43` files
  - `src/three_ascii`: `7,195` lines across `45` files
  - `app`: `20,428` lines across `48` files
  - `examples`: `8,732` lines across `42` files
  - `tests`: `49,296` lines across `181` files
- Generated/docs weight:
  - `docs/screenshots`: roughly `24MB`
  - `docs/assets/api-workbench.js`: roughly `728KB`
  - `docs/assets/api-workbench.js.map`: roughly `2MB`
  - `docs/api-reference.md`: roughly `528KB`

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
  - visualization Three fallback/signal helpers are bundled in `app/visualization_three.ts`
  - the app ASCII options shim was removed in favor of direct `src/three_ascii/*` imports
  - system metric diagnostics are folded into `app/system_metrics.ts`
  - system metrics network parsing is folded into `app/system_metrics_sources.ts`
  - API workbench control styles and wrapped-option projection are folded into `app/api_workbench_controls.ts`
  - API workbench primitive control ids and hit types are folded into `app/api_workbench_control_line.ts`
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
  - visualization Three fallback/signal tests are now `tests/visualization_three.test.ts`
  - system metric diagnostics tests are part of `tests/system_metrics.test.ts`
  - tiny theme catalog, ANSI facade, manifest, and validation tests are now `tests/theme_core.test.ts`
  - theme provider inspection, preview, and report tests are now `tests/theme_provider_workflows.test.ts`
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
- Prefer subsystem-level runtime smoke coverage for workbench, Three ASCII, terminal shell, and web interaction.

### P1: Keep Three ASCII Performance Gated By Real Probes

- Continue using benchmark cases for hot helpers, but treat live probes as required evidence:
  - `deno task three-workbench:startup-probe`
  - `deno task three-ascii:live-probe -- --frames 45 --glyphs blocks --max-cells 960 --check --max-average-ms 40`
- Latest workbench block-mode startup probe after the Three runtime consolidations: `6.69ms` steady average, about
  `149.5 fps` at `53x17` cells with the capped default-workbench probe.
- Avoid speculative micro-optimizations unless they improve measured workbench/default-demo behavior.

### P2: Split Demo Framework From Library Framework

- Audit `app/api_workbench.ts`, `examples/web/api_workbench_page.ts`, and `app/main.ts` for reusable model/controller
  code that should live in `src/app/workbench`.
- Do not add new feature surfaces until the adapter/model split is smaller and easier to reason about.

### P2: Rationalize Docs Artifacts

- Decide which generated docs artifacts must remain tracked for GitHub Pages.
- If a generated artifact can be rebuilt deterministically in CI or by `deno task`, stop treating it as source.
- Keep screenshots only when they are referenced and useful.

### P3: Reduce Barrel And Compatibility Noise

- Review tiny `mod.ts` and compatibility facade files.
- Keep public package entrypoints stable, but collapse internal-only barrels that merely forward one or two helpers.

## Acceptance Checks

- Each refactor checkpoint must reduce or simplify tracked source/test files, or remove duplicated logic.
- `deno task health` must pass before commits that touch shared runtime, workbench, or renderer code.
- Three ASCII checkpoints must pass both live probes above.
- New tests are allowed only when they replace broader missing runtime evidence or protect a refactor boundary.
- Each meaningful checkpoint gets an independent commit.
