# Post-Audit Refactor And Performance Pass

## Goal

Continue the post-audit hardening work after the first architecture audit was completed. Prioritize measured renderer
performance, shared terminal/web workbench projections, and oversized module reduction without destabilizing demos.

## Initial Findings

- `app/api_workbench.ts` remains the largest app source at roughly 5.1k lines.
- `examples/web/api_workbench_page.ts` still mirrors substantial terminal workbench behavior at roughly 2.7k lines.
- Three ASCII hot-loop micro-optimizations must be benchmarked carefully; dense-edge branch splits and no-edge ternary
  fast paths regressed local `three-ascii-ansi-grid` benchmarks and were not retained.
- Benchmark tooling should make targeted performance runs harder to misuse.

## Tasks

- [x] Add benchmark selector ergonomics and coverage for `--query` as a search alias.
- [x] Extract another shared renderer-neutral workbench projection from terminal/web duplication.
- [ ] Re-run focused and full health checks after each retained milestone.
- [ ] Continue reducing oversized app/demo modules only at clean abstraction points.
- [ ] Keep Three ASCII performance changes benchmark-gated; revert any micro-optimization that loses on focused cases.

## Progress

- Extracted shared adaptive workbench window layout through `workbenchAdaptiveWindowLayout`.
- Extracted shared header menu/close-button geometry through `layoutWorkbenchHeader`.
- Extracted shared empty-workspace message classification through `workbenchEmptyWorkspaceMessage`.
- Extracted terminal status tone and input-mode label presentation helpers out of the terminal workbench renderer.
- Extracted live shell status-line composition out of the terminal workbench renderer.
- Moved terminal status tone color mapping into the shared workbench terminal style helper.
- Cached unchanged Kitty-only blank terminal grids so image-mode Three panels stop reallocating no-op ASCII cells every
  frame.
- Extracted process-output and live-shell keyboard hint text into shared terminal status presenters.
- Extracted responsive workbench header help text into a shared status helper.
- Skipped unchanged Three panel grid publication so Kitty-only image frames do not request terminal redraws for the same
  cached blank grid.
- Added a cached Three ASCII readback layout helper so renderer ANSI frames can reuse stable GPU readback metadata until
  the output shape or edge payload changes.
- Extracted workbench workspace persistence into a reusable storage adapter with normalized load/persist helpers and
  recoverable storage diagnostics.
- Extracted browser panel workspace cache, hydrate, and persist helpers so the web workbench can share tested storage
  diagnostics for localStorage and async stores.
- Added a tight-row fast path for Three ASCII image readback compaction and covered Kitty/image RGBA compaction in the
  benchmark catalog.
- Consolidated CPU hex-grid keyboard navigation and process sample labeling inside the visualization module so the
  workbench renderer only owns focus, scrolling, and logging side effects.
- Extracted shared workbench frame-box border/title projection so terminal and web workbench demos use the same
  renderer-neutral window-frame geometry.
- Reduced wrapped control option layout overhead by tracking row width incrementally and counting required rows without
  allocating full option projections.
- Added a reusable textbox projection path for API workbench controls so terminal and web renderers keep caller-owned
  row buffers across draws.
- Added `wrapTextBoxLinesInto` so multiline textbox wrapping can reuse caller-owned visual-line objects, and wired the
  API workbench textbox projection through it.
- Added a benchmark case for reusable textbox wrapping so future multiline text changes have a measured guardrail.
- Added `wrapPlainTextInto` and routed API workbench recent-action wrapping through caller-owned rows.
- Consolidated repeated settings-binding reentrancy guards behind a shared internal sync gate.
- Added a reusable Three ASCII readback view cache and routed renderer readback assembly through it.
- Added reusable shelf/tab layout buffers and routed terminal and web workbench shelf rendering through them.
- Added reusable top-menu hit layout projection and routed terminal and web workbench menu hit rendering through it.
- Added reusable header layout projection and routed terminal and web workbench header rendering through it.
- Added reusable titlebar layout projection and routed terminal and web workbench titlebar rendering through per-window
  buffers so hit rectangles remain stable for each draw.
- Added expanded hit-target lookup to support touch-friendly web hit expansion without cloning the full hit stack on
  every pointer lookup.
- Added a string-backed full-row write fast path for browser workbench frames plus a benchmark guard for styled row
  replacement.
- Tightened Three ASCII readback cache keys so disabled-edge layouts ignore unused edge bytes and equivalent packed
  layouts reuse typed readback views.
