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
- Extracted shared workbench status-line shortcut/profile composition so terminal and browser workbench adapters render
  bottom status bars through the same tested helper.
- Extracted shared workbench help-row profiles so terminal and browser help modals use the same tested navigation
  guidance source.
- Extracted shared modal action button projection so terminal and browser workbench modals use one tested mapping from
  `ModalInspection` actions to renderer-neutral button rows.
- Extracted workspace modal content projection into tested pure helpers so the terminal workbench keeps only state,
  persistence, and side-effect orchestration for workspace save/rename/delete flows.
- Restored the rejected clipped Three ASCII diff experiment, then fixed monitor window control visibility and block-mode
  truecolor output without regressing the Three ASCII benchmark suite.
- Added a standalone Three ASCII demo titlebar shell with mouse-enabled minimize, maximize, restore, and close controls
  so the default renderer launch has the same basic window affordances as the portfolio demos.
- Extracted standalone Three ASCII demo window geometry and titlebar hit testing into a small tested helper instead of
  leaving the new window shell math embedded in the demo.
- Extracted Three ASCII changed-cell diff state and visible rerender queueing into a reusable canvas helper with direct
  tests, preserving the object behavior while making the frame-diff hot path easier to optimize independently.
- Extracted the web workbench mobile command-strip action projection into an internal shared helper and routed it
  through the existing button-row layout so touch/mobile controls no longer carry bespoke wrapping logic.
- Extracted the API Workbench process-output terminal toolbar into a shared renderer-neutral projection helper so
  console rendering no longer mutates fixed local button slots before layout.
- Added a reusable workbench button-row render-command projection and routed terminal/web toolbar and modal button
  rendering through it so clipped labels and hit rectangles are computed once in shared code.
- Changed Three ASCII block-mode fill cells to paint their background with the same truecolor source color as the block
  glyph, improving solid block richness and terminal line-gap coverage without changing glyph or edge modes.
- Extracted terminal session-tab render commands so console and browser workbench adapters share row gap, clipped label,
  active-state, and hit-rectangle projection.
- Extracted workbench scrollbar render commands so console and browser adapters share vertical/horizontal scrollbar cell
  projection and hit rectangles.
- Fixed Three ASCII block-mode color fidelity by keying adjacent-cell reuse on fill buckets and tinting full-height
  partial blocks against the active background without regressing the Three ASCII assembly benchmarks.
- Extracted workbench dropdown overlay render commands so console and browser adapters share clipped popover rows,
  selected-item text, item-index mapping, and hit rectangles.
- Routed the web workbench control dropdown popover through the same shared overlay projection so both top-level and
  control dropdowns share clipping, row text, selected-state, and hit-rectangle math.
- Extracted workbench modal row render commands so console and browser adapters share title/body/action row projection
  while keeping renderer-specific modal paint styles local.
- Simplified Three ASCII block-mode color assembly so full-height block cells preserve source truecolor instead of
  quantizing through fill-bucket background tinting, improving partial-block assembly benchmark throughput.
- Added API workbench control-line render commands so terminal and browser controls share fill/base/button/detail
  segment classification while keeping their paint adapters independent.
- Added API workbench textbox render commands so terminal and browser controls share label/body row assembly with
  configurable cursor and continuation glyphs.
- Switched Three ASCII block-mode cells to source truecolor background fills, removing font-glyph banding and reducing
  per-cell ANSI output on block-heavy frames.
- Added shared API workbench wrapped-option render commands so terminal and browser combo/radio option rows reuse the
  same text and hit geometry projection.
- Added a Three ASCII renderer uniform dirty flag and benchmark guard so unchanged frames skip redundant compute uniform
  buffer uploads.
- Strengthened Three ASCII block-mode output to paint solid cells with matching truecolor foreground/background full
  blocks, and made standalone renderer window controls ASCII-safe and high contrast.
- Split API workbench option/control row projection into `api_workbench_control_rows.ts` while keeping the existing
  controls module as the stable facade for terminal and browser callers.
- Extracted built-in Three fallback row projection into `workbench_visualization_window.ts` with direct tests so the
  main API workbench renderer keeps less static presentation logic.
- Extracted the browser API workbench Three preview row projection and ASCII orb generation into the shared
  visualization-window helper with direct tests, leaving the web page to handle paint only.
- Routed terminal and web API workbench slider pointer updates through `SliderController.handlePointer`, removing
  duplicated renderer-local pointer math.
- Split API workbench TextBox projection and render commands into a focused module behind the existing controls facade,
  with shared control IDs/hit types in an acyclic base module.
- Split API workbench wrapped combo/radio option render commands into a focused module while preserving the existing
  controls facade export surface.
- Split API workbench one-line control projection, render commands, track geometry, and slider hit placement into a
  focused module behind the existing controls facade.
- Split API workbench table-sort, dropdown popover, and stepper hit helpers into focused modules so
  `api_workbench_controls.ts` is now a compatibility barrel plus keyboard traversal.
- Extracted Three ASCII GPU buffer slot allocation/reuse/destruction into a small tested helper so renderer resource
  lifecycle logic is isolated from scene orchestration.
- Extracted shared workbench modal content helpers for generic modal demos, help, quit confirmation, details, and
  confirmation states so terminal and browser workbench adapters no longer duplicate those modal definitions.
- Extracted Three ASCII ANSI glyph-key selection and edge-promotion heuristics into a focused internal helper with
  direct tests, leaving grid assembly responsible for row/cell caches.
- Fixed the standalone Three ASCII demo window layer order so the renderer/fallback body is no longer hidden behind the
  window background, switched the standalone titlebar controls to ASCII-safe labels, and added a Deno WebGPU
  mapped-at-creation buffer compatibility shim for Three.js geometry uploads.
- Extracted the HTML/CSS layout demo box, outline, label, detail, and summary projection into shared renderer-neutral
  commands so terminal and web workbench adapters no longer duplicate that paint logic.
- Extracted shared API workbench control/textbox/wrapped-option paint-style helpers so terminal and browser workbench
  adapters keep theme-highlight behavior aligned behind focused tests.
- Wrapped Three ASCII GPU readback mapping failures in a stable `ThreeAsciiReadbackError` so Deno/WebGPU readback
  limitations surface as deterministic fallback/diagnostic failures instead of raw validation exceptions.
- Extracted Three ASCII compute uniform packing into a focused internal helper with direct tests, keeping renderer GPU
  orchestration separate from byte-level uniform layout.
- Extracted Three ASCII readback copy planning and then cached unchanged copy plans so renderer frames do not allocate
  copy command arrays on stable output shapes.
- Stabilized default Three ASCII block rendering by using ASCII-safe shared window controls and removing fog from the
  default block preset so truecolor block cells keep source color depth.
- Extracted the workbench Three ASCII config modal geometry into a tested internal layout helper, reducing inline modal
  math in `app/api_workbench.ts`.
- Added a real browser workbench Three ASCII config modal, persisted its renderer options in the web workspace snapshot,
  and shared config row action/selection helpers across terminal and browser adapters with direct tests.
- Extracted Three ASCII config modal row placements into the shared modal helper so terminal and browser adapters reuse
  selected-row windowing and previous/next hit rectangle projection.
- Extracted the Three ASCII config modal action buttons into the shared modal helper and routed terminal/browser
  adapters through the standard reusable button-row render commands.
- Added standalone browser Three ASCII render-window chrome using the shared demo window geometry, and pinned browser
  block-mode truecolor cells so Canvas2D preserves full-background color instead of glyph/text quantization.
- Added a fully visible integer-rectangle fast path to Three ASCII frame diffing, reducing the focused
  `three-ascii-frame-diff-96x40` benchmark from roughly 2.32ms to 2.15ms without changing clipped or fractional paths.
- Extracted Three ASCII config modal action-button render-command projection into the shared modal helper so terminal
  and browser workbench adapters no longer duplicate the standard Cancel/Apply/OK layout sequence.
