# Top-To-Bottom Architecture And Code Audit

Status: completed in July 2026.

## Goal

Turn the fork from a feature-rich, demo-heavy toolkit into a maintainable and measurable Deno TUI library. The audit
covered architecture, performance, renderer reliability, terminal behavior, public API policy, observability, and
integration testing.

## Baseline

- Audited branch: `main`
- Audited head: `5f83a2b42fbd5e8624c3ceda75b2abd7e75d7bb1`
- Approximate starting shape, excluding generated/vendor/heavy assets: `414` files, `109,892` lines, and `87,226`
  TypeScript code lines.
- Starting test signal: `62` test files and roughly `600` `Deno.test()` declarations.
- Starting benchmark signal: synthetic helper/controller coverage with limited full-frame, workbench, GPU readback, and
  system-monitor evidence.

## Durable Findings

The library had strong controller, app, runtime, layout, theme, terminal, browser, and Three ASCII foundations. Its main
risk was ownership: reusable behavior lived in large demos, terminal and browser adapters implemented parallel policy,
and hot-path confidence depended too heavily on manual observation.

The audit established these rules:

- Renderer-neutral behavior belongs in reusable `src` owners; demos compose it.
- Terminal and browser workbenches share policy and state but retain host-specific painting and input adaptation.
- Performance changes require representative benchmarks or live probes, not only helper microbenchmarks.
- Public entrypoints stay explicit and demo internals do not expand the stable root by default.
- Optional backend, renderer, storage, and platform failures surface through structured diagnostics.
- Integration and visual tests protect workflows that unit tests cannot represent.

## Completed Outcomes

### Shared Workbench

- Added a shared workbench controller/facade and migrated terminal and web adapters onto common window, menu, titlebar,
  shelf, scrollbar, workspace, modal, diagnostics, terminal-pane, and Three ASCII policy.
- Moved renderer-neutral frame, hit-target, layout, workspace persistence, text, control, and window-registry behavior
  out of the terminal demo.
- Added parity and workflow coverage for focus, minimize, fullscreen, restore, close, keyboard navigation, pointer
  routing, persistence, terminal sessions, and adapter state transitions.
- Reduced redraw allocation through retained row, command, hit-target, menu, scrollbar, panel, and Three-grid buffers.

### Performance And Rendering

- Expanded the benchmark catalog to cover full workbench frames, dirty regions, terminal replay/editing, command search,
  system metrics, Three ASCII grids/readback/diffs, window churn, and real data workloads.
- Added benchmark thresholds and retained-buffer paths for canvas, workbench frames, terminal screens, command search,
  layout, theme catalogs, renderer registries, and monitor sampling.
- Hardened signal scheduling, cycle diagnostics, batched updates, and renderer invalidation behavior.
- Reworked canvas dirty-region selection and contiguous sink updates while preserving overlap and modal correctness.

### Three ASCII

- Made renderer generation, frame ownership, resize, deferred readback, stale-frame rejection, and failure recovery
  explicit.
- Added pressure-aware cell budgets, cadence telemetry, retained grid publication/scaling, and full-pane resize
  behavior.
- Added GPU-serialized live probes and PTY/browser visual checks for startup, resize, fullscreen, truecolor coverage,
  and nonblank output.

### Runtime And Terminal

- Introduced provider-backed system metrics with deterministic fixtures, bounded process selection, and degradation
  diagnostics.
- Expanded terminal parsing and screen behavior for realistic shell/curses transcripts, SGR color, scroll regions,
  editing, alternate screens, OSC metadata, hyperlinks, cursor modes, and DEC private modes.
- Added backend registries, capability inspection, shell workspaces, scrollback/copy mode, remote terminal support, and
  worker/storage/runtime diagnostics.
- Recorded the parser-versus-embedded-emulator decision in
  [Terminal Emulation Strategy](../../../docs/terminal-emulation-strategy.md).

### Layout, Themes, And Components

- Added simple/Yoga parity and generated invariant coverage for layout, viewport, selection, and input decoding.
- Consolidated markup parsing, cascade, intrinsic sizing, widget hydration, and worker-backed layout workflows.
- Established theme engines, registries, providers, layers, pipelines, factories, galleries, validation, caching, and
  component bindings with clearer ownership and inspection contracts.
- Expanded controller-first widgets, command adapters, component catalogs, and accessibility/keyboard behavior.

### API And Operations

- Added explicit package entrypoints, stability tiers, baseline drift checks, package checks, generated API references,
  and documentation-coverage gates.
- Added runtime diagnostics, workload telemetry, benchmark catalogs, component/plugin catalogs, e2e reports, and visual
  smoke inspection.
- Kept NGE/Neon scene data and synthetic visualization fixtures under demo ownership rather than stable library APIs.

## Verification

The completed workstreams were accepted through the repository health gate plus subsystem-specific probes. At the July
9, 2026 archival pass, the repository remained green with:

- `87` benchmark cases;
- `1,722` main-suite tests;
- `32` web tests;
- `53` worker/runtime tests;
- package, API inventory, generated-reference, browser build, e2e, and app-entrypoint checks.

Renderer changes additionally used the Three ASCII live/startup probes and workbench PTY/browser visual smoke checks.

## Follow-On Work

- Current repository-shape and ownership policy lives in
  [Repo Shape Reduction And Runtime-Focused Refactor](../022-repo-shape-reduction.md).
- Terminal product workflow history lives in [Terminal Multiplexer Experience](017-terminal-multiplexer-experience.md).
- Detailed implementation chronology remains available in Git history from the audited baseline; it is intentionally not
  duplicated here.

## Completion

All original workstreams and cross-cutting test items were completed. Future refactors should preserve the ownership,
measurement, API, and verification rules above rather than treating file count or extraction volume as success metrics.
