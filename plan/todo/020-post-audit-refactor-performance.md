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
- [x] Re-run focused and full health checks after each retained milestone.
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
- Lowered the shared workbench titlebar compact-control threshold from 22 to 16 columns so tight/default Three ASCII
  render panes keep minimize, maximize, restore, and close controls visible when the controls physically fit.
- Rechecked the block-mode color path after a regression report: focused tests still confirm source truecolor background
  fills in terminal ANSI and browser Canvas2D sinks; remaining color-depth concerns should be verified visually in the
  exact terminal/browser surface before changing the assembler again.
- Re-ran Three ASCII focused benchmarks after the report; ANSI grid cases returned near prior ranges on a second run,
  while frame diff measured slower than the last committed baseline and needs another isolated sample before further
  hot-loop edits.
- Added an opt-in `deno task benchmark -- --repeat N` mode that reruns selected benchmark cases and reports the best
  average per case, making noisy renderer micro-benchmark checks less dependent on a single local sample while
  preserving the default report format.
- Fixed a block-mode workbench performance regression caused by cumulative SGR style prefixes in styled text splitting;
  repeated truecolor background cells now keep only the active foreground/background state instead of replaying every
  previous color change.
- Added compact live Three ASCII renderer telemetry to the workbench Three pane header so renderer frame, scene,
  readback, assembly, and cell counts are visible during manual profiling.
- Moved SGR state merging into a shared internal utility and routed workbench frame writes through it, so both
  TextObject-style splitting and immediate workbench frame assembly avoid cumulative ANSI growth.
- Extended workbench frame background-run detection to compact cells whose SGR prefix includes both foreground and
  background color parameters.
- Extracted terminal shell copy-mode row projection into `workbenchTerminalCopyRowsInto`, adding stable API coverage for
  reusable line-number, selection, and visible-row metadata while reducing inline terminal-shell renderer logic.
- Added a `runtime/terminal-copy-row-projection` benchmark guard for copy-mode scrollback projection so shared
  terminal/web terminal row metadata stays measured.
- Extracted the workbench line-signal diff into a shared frame helper and benchmarked the unchanged-row skip path so
  terminal output throttling remains guarded.
- Capped workbench Three ASCII terminal blits so render-size limits are not immediately expanded back to full-pane ANSI
  output on large windows.
- Added a same-cell run fast path to workbench frame row assembly, reducing repeated styled fill and line-signal diff
  costs in block-heavy terminal frames.
- Moved repeated benchmark best-of aggregation into the reusable performance API with direct tests and an updated stable
  API baseline.
- Fixed compact monitor/demo window control visibility so minimized panes retain titlebar controls, and normalized Three
  ASCII block-mode blank fill handling so invisible buckets do not render colored foreground spaces.
- Shared terminal-session id and title helpers between terminal and browser workbench adapters, removing duplicated
  session id scans and keeping web/console behavior aligned.
- Added a benchmark-retained Three ASCII ANSI-grid shortcut for block-mode fill-only cells so visible block cells skip
  the fill-glyph table lookup while preserving glyph and mixed modes.
- Extracted workbench Three ASCII grid painting into a focused helper with direct tests so `api_workbench.ts` no longer
  owns the inner grid-copy loop or repeated fallback-cell styling.
- Extracted API workbench Inspector row projection into a focused helper with direct tests, keeping the main renderer
  responsible only for writing projected rows.
- Extracted API workbench Logs row projection into a focused helper that reuses row objects across draws.
- Extracted API workbench Explorer row projection into a focused helper with direct tests for selection, icons, and
  caller-owned row reuse.
- Extracted API workbench Data Table row projection and page-size calculation into a generic helper with direct tests
  for selected rows, wrapped footers, and body-row reuse.
- Extracted text-rendered visualization row styling into the visualization window helper with tests for severity mapping
  and caller-owned row reuse.
- Replaced instrumented workbench row fingerprints with revision metadata so retained terminal line flushing avoids
  pre-render scans; focused line-signal diff now runs around 1.7ms while scaled/capped Three grid blits remain near
  1.2ms/0.5ms.
- Extracted Three ASCII config modal row render command projection into the shared modal helper with tests for command
  ordering, selected-state propagation, and caller-owned command reuse.
- Extracted API workbench scrollable content-size decisions into a renderer-neutral helper with tests for built-ins,
  terminal clamps, visualization delegation, data widths, and reusable text projection.
- Moved process-output window title formatting into the shared terminal status presenter with direct tests, keeping
  shell and process terminal title composition aligned outside the workbench renderer.
- Moved Three ASCII config modal title composition into the shared workbench ASCII helper with direct tests, trimming
  renderer-local preset/glyph label formatting from the terminal workbench.
- Added a dense-row fast path for fully visible Three ASCII grid diffing, reducing the focused
  `three-ascii-frame-diff-96x40` best-of benchmark from 1.881ms to 1.762ms while preserving sparse-row fallback cells.
- Tightened retained-cell access in Three ASCII grid diff loops through local state references, keeping clipped and
  fractional paths behavior-compatible while measuring the focused frame-diff case at 1.785ms after the follow-up pass.
- Routed the browser API workbench panel chrome through the shared frame-box projection instead of bespoke border string
  assembly, keeping terminal and web window framing behavior closer together.
- Routed the browser API workbench explorer panel through the same tested row projection used by the terminal adapter,
  removing duplicated icon, selection, and theme styling logic from the web renderer.
- Routed the browser API workbench data table through the shared data-table row/page-size projection so footer wrapping,
  selected-row contrast, and caller-owned row buffers stay aligned with the terminal adapter.
- Extended the workbench log-row projection to consume multiple sources without concatenation and routed browser logs
  through it so docs/runtime log styling shares the terminal adapter path.
- Added a styled ANSI split benchmark and routed `getStyledCharacters` through the existing ASCII fast path so
  block-mode workbench rows no longer run the Unicode grapheme regex for every styled space.
- Added rate-limited Three ASCII slow-frame diagnostics that report total, scene, ANSI/readback, and assembly timings
  into the existing workbench diagnostics stream.
- Fixed the default workbench Three ASCII frame cadence regression by forcing redraw notifications for renderer-owned
  mutable grid reuse, preserving the low-allocation grid path while keeping animation visible.
- Added visible Three ASCII startup grids for both standalone canvas objects and workbench panel frames so first-frame
  WebGPU initialization shows progress instead of a blank renderer area.
- Reduced default workbench `studio` scene geometry density for ASCII rendering by lowering the torus knot and sphere
  segment counts while preserving the same objects and motion.
- Fixed the Three ASCII block-rendering throughput regression by making blank block cells background-only and compacting
  repeated styled frame cells into row spans; added a terminal-row benchmark that covers the real ANSI output path
  missed by the grid-only microbenchmarks.
- Compacted repeated styled cells in the terminal ANSI canvas sink itself, covering the default API Workbench Three
  window path where `TextObject` splits rows back into styled cells before flushing to stdout.
- Routed the browser API workbench inspector through the shared inspector row projection so API-surface rows, theme
  labels, and recent-action wrapping match the terminal adapter.
- Removed the now-unreachable browser workbench generic panel fallback after all current panel ids moved onto focused
  renderers or shared row projections.
- Repaired the standalone web Three ASCII window chrome so it uses the same compact titlebar control projection as the
  terminal demo; block-mode color paths still emit 24-bit background fills, so remaining color complaints should be
  verified against terminal/browser rendering rather than ANSI grid quantization.
- Shared the HTML/CSS layout demo summary copy through a terminal/web profile helper so both workbench hosts use the
  same renderer-neutral projection path without duplicating inline explanatory rows.
- Matched the terminal API workbench log panel to the browser panel by projecting static documentation and live command
  log rows through the same multi-source log adapter.
- Added a shared `projectWorkbenchButton()` helper and routed terminal/browser workbench button writers through it so
  button label clipping and theme-derived paint stay consistent across renderers.
- Added a shared `projectWorkbenchButtonCommand()` helper and routed terminal/browser command-button paint loops through
  it while keeping renderer-specific writes and hit registration local.
- Consolidated API workbench checkbox, radio, and combo row projection behind shared append helpers so focused control
  helpers and the aggregate controls panel cannot drift.
- Routed shell and process-output terminal toolbar item projection through one private reusable action loop while
  preserving each toolbar's public state rules and caller-owned item reuse.
- Added caller-owned workspace menu entry projection and routed the terminal workbench through it so workspace menu
  labels and item counts no longer rebuild a fresh entry list on every draw.
- Added caller-owned source-frame resolution for monitor visualization contexts and routed real workbench monitor
  windows through it so redraws reuse the frame array while keeping sampled source payloads fresh.
- Added a direct fully visible range enqueue path for Three ASCII grid diffs, avoiding redundant clipping/allocation in
  the default object path and reducing the focused frame-diff benchmark to about 1.48ms.
- Extracted shared workbench text-prompt input handling for modal drafts and routed terminal search plus workspace-name
  prompts through it, reducing duplicate key handling while adding stable API coverage.
- Routed the standalone visualization monitor through per-slot source-frame buffers so each panel reuses its source
  array without sharing mutable context across sibling slots.
- Added caller-owned synthetic workbench source projection and routed non-monitor workbench visualization contexts
  through it, avoiding the per-frame source descriptor and frame-list allocations.
- Added caller-owned CPU hex tile layout projection and routed workbench tile hit/reveal paths through reusable buffers
  so CPU hex interaction geometry stops allocating tile arrays on every draw or selection reveal.
- Added focused benchmark guards for reusable monitor source-frame resolution and 88-core CPU hex tile layout projection
  so future source/monitor refactors keep those hot paths measured.
- Reused repeated styled cell strings inside ANSI-aware text splitting so block-mode workbench rows avoid rebuilding the
  same truecolor background-space cell across long runs; focused `ansi-styled` and workbench full-row benchmarks
  improved locally after the change.
- Added a plain-ASCII `getMultiCodePointCharacters` fast path and benchmark so unstyled terminal text avoids the large
  Unicode grapheme regexp while preserving the Unicode fallback for non-ASCII content.
- Optimized ANSI range flushing for truecolor block frames by carrying SGR state across cells when the next prefix fully
  overwrites the active color channels; this reduces redundant reset sequences in mixed-background Three ASCII rows and
  adds a benchmark for that terminal-bandwidth-heavy path.
- Added an adaptive workbench Three ASCII render-size cap and scaled grid blitting so large panes keep their visual
  footprint while reducing WebGPU readback cells and terminal truecolor payload; a 220x70 probe dropped full-frame
  output from roughly 303KB to 158KB with a 3,840-cell source cap.
- Fixed the terminal canvas direct-row-range flush path so sinks that disable legacy per-cell updates still flush dense
  range-only rows, and routed overwrite `TextObject` rows through direct row ranges. This targets the default workbench
  Three ASCII path where every visible pane row is published as a full-width text object.
- Added `render/textobject-full-row-canvas-220x70` to benchmark the actual full-width styled `TextObject` + terminal
  canvas path behind the default workbench surface; local best-of workbench runs measured it around 2.55ms per frame.
- Lowered the workbench-specific default Three ASCII render-cell cap from 3,840 to 1,920 while preserving saved
  overrides and the package renderer default, favoring startup interactivity in terminal/SSH sessions.
- Moved the full-row `TextObject` terminal-canvas benchmark fixture out of the main benchmark catalog so the measured
  guard stays reusable while `scripts/benchmark_cases.ts` remains easier to scan.
- Fixed Three ASCII frame pacing so render duration is subtracted from the next timer delay instead of being added on
  top of it; the default workbench Three pane keeps the same 18 FPS cadence as dynamic Three visualization panes.
- Skipped unchanged workbench line-signal assignments so animated Three panes do not force every terminal row through
  `TextObject` propagation and range flushing when only a subset of rows changed.
- Compacted truecolor background-styled workbench frame rows so animated block-mode Three ASCII panes avoid resetting
  ANSI state after every cell while preserving full 24-bit background color fidelity.
- Added Three-backed visualization metadata and routed workbench content sizing through it so 3D visualization windows
  avoid duplicate render passes during layout; dynamic Three scene signal assignment now skips unchanged mode/signal
  payloads.
- Extracted workspace-window snapshot projection from the API workbench into a focused workspace-menu helper so saved
  workspace persistence can be tested independently of the large interactive app module.
- Added adaptive Three panel render-cell budgeting driven by live renderer telemetry; sustained slow frames now step the
  panel down to a lower source grid without mutating saved ASCII settings, and the resize path restarts the render loop
  instead of getting stranded after an adaptive cap change.
- Added an opt-in deferred WebGPU readback strategy for Three ASCII renderer frames and enabled it for workbench-hosted
  Three panels, decoupling terminal frame cadence from same-frame `mapAsync()` stalls while preserving blocking readback
  as the package default.
- Extracted deferred Three ASCII readback queueing into a focused internal helper with direct tests for slot
  backpressure, stale-frame invalidation, mapped-frame consumption, mapped errors, and cleanup.
- Reduced terminal flush pressure for animated workbench rows by changing overwrite-mode `TextObject` updates to queue
  only changed row spans instead of repainting the full terminal row on every value change.
- Added content fingerprinting to workbench-hosted Three panels so deferred readbacks that repeat an unchanged ASCII
  grid do not force redundant workbench redraws while still supporting mutable renderer-owned grids when their cells
  change.
- Added a reusable `FrameScheduler` and routed API workbench invalidations through an 18 FPS global frame gate so
  multiple animated Three panels coalesce into one terminal redraw cadence instead of each panel forcing its own full
  workbench pass.
- Added write-time row metadata for sparse workbench frames so unchanged retained terminal lines can skip full ANSI row
  assembly; the `render/workbench-line-signal-diff-168x54` guard stays under budget after the Three grid blitter was
  routed through the shared cell writer.
- Refined row metadata to cache fingerprints lazily at line-flush time instead of hashing every cell write, restoring
  the scaled/capped Three grid blit benchmarks while retaining unchanged-row skips.
