# Repo Shape Reduction And Runtime-Focused Refactor

## Goal

Reduce repository sprawl and demo/test bloat without weakening the core Deno TUI library. Favor fewer, clearer modules,
runtime probes that catch real failures, and deletion-heavy refactors over adding more narrow implementation tests.

## Current Snapshot

- Tracked files: `836`
- Tracked top-level file counts:
  - `src`: `370`
  - `tests`: `227`
  - `app`: `69`
  - `docs`: `50`
  - `examples`: `42`
  - `scripts`: `27`
  - `plan`: `25`
- Handwritten/code-heavy line counts:
  - `src/app`: `24,495` lines across `130` files
  - `src/runtime`: `11,119` lines across `35` files
  - `src/components`: `10,241` lines across `43` files
  - `src/three_ascii`: `7,195` lines across `45` files
  - `app`: `20,508` lines across `69` files
  - `examples`: `8,773` lines across `42` files
  - `tests`: `49,556` lines across `227` files
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
- Start with system metrics parser shards:
  - `app/system_metrics_cpu.ts`
  - `app/system_metrics_disk.ts`
  - `app/system_metrics_temperature.ts`
- Keep monitor behavior and tests intact, but reduce file count and import surface.

### P1: Replace Test Shard Proliferation With Behavioral Bundles

- Merge tiny tests when they cover the same subsystem and do not need separate fixtures.
- Preserve meaningful assertions, but stop creating one test file per one tiny helper.
- Prefer subsystem-level runtime smoke coverage for workbench, Three ASCII, terminal shell, and web interaction.

### P1: Keep Three ASCII Performance Gated By Real Probes

- Continue using benchmark cases for hot helpers, but treat live probes as required evidence:
  - `deno task three-workbench:startup-probe`
  - `deno task three-ascii:live-probe -- --frames 45 --glyphs blocks --max-cells 960 --check --max-average-ms 40`
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
