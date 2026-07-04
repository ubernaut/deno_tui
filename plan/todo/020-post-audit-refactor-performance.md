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
- [x] Investigate deferred WebGPU readback latency separately from workbench policy; current probes show deferred
      readback can publish stale grids for many frames at 480/960 cells even when the queue is not saturated.

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
- Extracted Three ASCII raw image-frame construction into a small helper with focused tests so renderer frame
  orchestration owns fewer readback details.
- Retuned the terminal workbench's Three ASCII startup policy to begin at a 480-cell source grid and run visible Three
  panes at the 18 FPS workbench scheduler cap through the normal 960-cell budget.
- Added a benchmark guard for responsive workbench Three header telemetry so cadence/readback diagnostics stay cheap
  while the renderer pane is active.
- Cached per-mode Three header label widths and static geometry widths, roughly halving the new header telemetry
  benchmark on this host without changing responsive row output.
- Extracted Three ASCII ANSI background state into a focused internal helper with direct tests, reducing the grid
  assembler's background/cache responsibility without changing benchmarked output.
- Consolidated repeated Three ASCII ANSI blank-run scans into small helpers while keeping sparse, dense, block, and
  glyph paths benchmarked independently.
- Extracted Three ASCII frame output-selection defaults and empty-frame projection into a focused helper with direct
  tests, leaving `renderFrame` concentrated on render orchestration.
- Extracted Three ASCII indexed color-key caching into a focused helper with direct tests, keeping linear-to-byte
  conversion state out of the ANSI grid assembler while preserving assembly benchmark thresholds.
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
- Added shared workbench terminal projection buffer caches so terminal and browser shell panes retain pane/copy-row
  storage through the same helper instead of owning parallel arrays.
- Added Three ASCII renderer frame revisions so real renderer frames can publish reused mutable grids without hashing
  the full ANSI cell matrix on every update.
- Batched workbench frame row dirty metadata updates for text writes and Three ASCII grid blits, reducing per-cell
  publication overhead in block-heavy workbench frames.
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
- Moved workbench Three terminal-pressure change log formatting into the shared pressure helper so the workbench render
  loop only applies policy, state, and side effects.
- Lowered the API workbench Three startup cap to 480 render cells and slowed automatic recovery to high-detail caps so
  SSH/tmux sessions are not immediately saturated by the default block renderer pane.
- Added sustained terminal byte-rate pressure to the workbench Three policy so continuous moderate-sized frames can
  downshift renderer detail before they overwhelm SSH/tmux links.
- Added terminal byte-rate reporting to the workbench Three pressure probe so renderer tuning can compare output
  pressure against adaptive policy thresholds directly.
- Extracted workbench Three terminal byte-rate calculation into a shared pure helper with direct tests so pressure
  policy, probes, and future diagnostics can stay aligned.
- Routed workbench Three pressure probe byte-rate reporting through the shared pressure helper instead of carrying
  duplicate probe-local math.
- Extracted shared workbench status snapshot line composition so terminal and browser adapters no longer duplicate
  focus/theme/tile-density/diagnostic status-bar wiring.
- Extracted active standard top-menu dropdown projection so terminal and browser workbench adapters share menu
  anchoring, visible slicing, selected-index mapping, and item id defaults.
- Tightened Three workbench pressure adaptation so collapsed observed cadence can downshift even when unrelated
  workbench rows changed in the same flush, and reduced the low-FPS warmup from 24 to 6 renderer updates.
- Raised the workbench Three low-FPS pressure threshold from catastrophic collapse to 60% of target FPS and fixed the
  rescue-tier recovery path so low observed cadence cannot accumulate quiet-output recovery frames at the floor.
- Moved workbench Three cadence-to-pressure telemetry projection into `ApiWorkbenchThreeRuntimeController`, keeping the
  terminal workbench render loop focused on frame composition and side effects.
- Added a reusable `WorkbenchThreeGridProjectionCache` so workbench Three grid row and scale-index scratch buffers live
  with the projection helper instead of the oversized terminal workbench renderer.
- Added a shared `hideWorkbenchThreeRect` geometry helper and routed built-in/dynamic Three panes through it so hidden
  renderer surfaces reuse the same unchanged-write guard as visible rect updates.
- Retuned the default workbench Three block renderer to start at the full 960-cell tier, avoid startup pressure
  collapse, and use deferred readback at the 20 FPS full-resolution cadence after default probes held 960 cells without
  terminal-pressure downshift.
- Moved workbench Three header runtime telemetry composition into the shared header helper so the terminal adapter no
  longer assembles pressure/cadence fields inline.
- Added sustained byte-rate context to workbench Three pressure change logs so adaptive downshifts show the same signal
  used by the policy.
- Lowered the workbench Three sustained terminal byte-rate pressure threshold to make the default block renderer back
  off from 480 to 240 cells after measured ~104KB/s output repeats on slower terminal sessions.
- Added an adaptive mode to the workbench Three pressure probe so it can run the same closed-loop terminal pressure
  controller as the workbench and report per-frame render-cell caps.
- Moved the workbench Three startup budget to 240 cells so the default pane opens in the lower-byte mode immediately
  instead of spending two high-pressure frames at 480 cells before adapting down.
- Fixed the adaptive workbench Three pressure probe to sleep on and report the current frame interval per sample, making
  byte-rate diagnostics reflect actual cadence changes after pressure updates.
- Simplified Three ASCII fill-only ANSI assembly locals so no-edge block/glyph paths avoid dead caller-plumbed state,
  with focused glyph/readback tests and `three-ascii-ansi-grid` benchmarks guarding output and throughput.
- Tightened workbench Three terminal-pressure adaptation for real slow terminals by shortening the low-FPS warmup and
  scoping collapsed-cadence samples even when non-Three rows changed in the same flush.
- Previously tightened workbench Three pressure scoping to avoid non-Three redraw false positives; later slow-terminal
  testing showed collapsed visible Three cadence still needs to downshift even when other rows changed too.
- Optimized workbench frame-row background-space detection with direct suffix checks, keeping Three block-mode span
  flushes benchmarked without adding per-cell cache overhead.
- Extracted process-output row formatting into the shared workbench terminal helper so terminal content sizing and
  future adapters reuse caller-owned row projection instead of local loops.
- Routed the terminal-output window render path through the same shared process-output row projector, keeping visible
  output rendering and content-size measurement aligned.
- Extracted terminal-output status, hint, empty-state, and visible output row ordering into a renderer-neutral projector
  so the API workbench paints shared row commands instead of assembling the terminal body inline.
- Added an intermediate compact Three header telemetry format so narrow workbench panes keep showing measured/target FPS
  before falling back to the bare frame-time and cell-count label.
- Added an optional observed-FPS gate to the workbench Three pressure probe so default and narrow workbench-shaped
  renderer runs can fail fast on the reported low-FPS regression instead of relying on manual ANSI inspection.
- Made high-pressure workbench Three samples downshift immediately, so manually raised 480/960-cell caps do not spend a
  second expensive terminal frame before backing off on slow sessions.
- Retuned workbench Three terminal-pressure thresholds so the default block-mode pane can recover from 240 to 480 cells
  but no longer auto-stabilizes at the 960-cell tier that measured around 150KB/s on app-like probes.
- Added test coverage that locks Kitty/image-only Three panels to `{ ansi: false, image: true }`, guarding against
  accidental ANSI readback/grid work when raster graphics is the selected output.
- Optimized dense block-mode ANSI grid assembly by filling adjacent same-color visible cells as row ranges instead of
  assigning every cell individually, covering the default terminal glyph style.
- Added a focused `three-ascii-ansi-grid-block-runs-96x40` benchmark guard for dense same-color block rows so the
  range-fill path is measured directly instead of only through broader ANSI-grid cases.
- Switched the terminal API workbench Three panel policy back to fresh blocking readback at the 960-cell live quality
  tier, with sustained-pressure thresholds, after probes showed deferred readback could keep the visible grid stale at
  20-30 Hz despite low renderer timings.
- Fixed the Three panel live probe to honor and report `--readback=blocking|deferred`, making the blocking/deferred
  tradeoff measurable directly; serial probes show blocking updates every frame at the 960-cell tier while deferred
  remains lower CPU/GPU wait but can delay visible grid publication.
- Extracted API workbench Three runtime cadence and terminal-pressure state into `ApiWorkbenchThreeRuntimeController`
  with direct tests, reducing inline pressure bookkeeping in the main workbench renderer.
- Extracted dynamic workbench Three visualization panel lifecycle into `WorkbenchThreePanelRegistry`, covering lazy
  creation, hide/hideExcept, disposal, and clear behavior without constructing real WebGPU renderers in tests.
- Extracted workbench Three viewport mouse drag and wheel routing into `WorkbenchThreeViewportInteractionController`,
  keeping model rotation/zoom focus behavior tested without starting a TUI session or renderer.
- Moved workbench Three policy, geometry, and cadence helpers into shared `src/app` modules and exported them through
  the workbench facade so app, scripts, and tests no longer import those pure helpers from `app/` internals.
- Retuned the default workbench Three block renderer for slow SSH/tmux terminals: startup now begins at 240 cells,
  sustained byte-rate pressure downshifts after one scoped frame, and live low-detail cadence tiers produce roughly
  12-16KB/s in the adaptive pressure probe instead of sitting near the old 40-60KB/s range.
- Kept blocking readback for the default API workbench Three block renderer after live probes showed deferred readback
  regressing visible publication; dynamic Three visualization panes now feed the shared cadence meter so
  terminal-pressure adaptation sees all live Three windows instead of only the built-in pane.
- Moved workbench Three grid projection and viewport interaction routing into shared `src/app` modules and exported them
  through the workbench facade, keeping terminal probes, benchmarks, and tests off demo-local helper paths.
- Moved the workbench Three runtime pressure/cadence controller into `src/app`, leaving the terminal workbench to wire
  signals and render effects while shared tests own the policy-state transitions.
- Moved Three panel lifecycle state resolution and the serialized render queue into `src/app`, keeping WebGPU frame
  scheduling primitives available to app/demo callers through tested shared modules.
- Moved Three panel blank-grid creation and grid fingerprinting into `src/app`, keeping unchanged-frame publication
  checks available from shared renderer helpers instead of demo-local paths.
- Skipped full-grid fingerprinting when a renderer frame reports the same `gridRevision`, leaving expensive content
  hashing only for unrevisioned frames or revision changes.
- Moved Three panel render policy and diagnostics projection into `src/app`, keeping Kitty/ASCII output selection and
  renderer telemetry formatting available as shared tested helpers.
- Moved Three panel renderer-state/effect comparison into `src/app` using structural effect types, so renderer rebuild
  decisions no longer depend on demo-local ASCII option factories.
- Moved Three panel graphics image ownership into `src/app` with a structural rect type, making Kitty/raster image
  handle lifecycle reusable outside the workbench demo layer.
- Extracted API workbench touch-hit expansion and compact/coarse layout detection into shared hit helpers, so terminal
  and browser workbench adapters use the same enlarged pointer targets on mobile-sized layouts.
- Routed the browser API workbench background canvas through the shared `parseHexColor` helper instead of carrying a
  local hex parser, keeping web theme color parsing aligned with terminal contrast helpers.
- Moved API workbench Three rendered-grid pressure sampling into `ApiWorkbenchThreeRuntimeController`, keeping per-draw
  reset/record/update bookkeeping tested outside the main renderer.
- Lowered the terminal workbench Three startup cap to 240 cells and aligned the live probe default with the workbench's
  blocking readback path; the pressure probe now starts with roughly 26x8 renderer grids and much smaller per-frame
  terminal output while preserving recovery to the 960-cell live quality tier.
- Cached Three ASCII compute pipelines per WebGPU device and shader entry point so multiple renderer windows and
  renderer rebuilds reuse fill/color/edge compute pipelines instead of recreating identical GPU pipelines.
- Added explicit Three ASCII renderer `initMs` telemetry to performance snapshots, diagnostics, workbench headers, and
  probes; serial live probing now separates the first-frame WebGPU init/pipeline stall from steady scene/readback cost.
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
- Lowered the default workbench Three ASCII live tier from 240 to 120 cells and slowed that tier to 24 FPS so the
  startup pane targets roughly 24KB/s of terminal output on the pressure probe instead of the prior 40-60KB/s range,
  while preserving manual recovery to higher detail when terminal output is quiet.
- Routed terminal workspace viewport blitting through the structured frame-cell copier so virtual workspace rows are
  copied directly into the final frame instead of stringifying styled rows and parsing them back into cells.
- Aligned the standalone Three ASCII live probe with the workbench's blocking readback default and added a
  `--readback=blocking|deferred` switch so renderer readback performance can be compared without editing the script.
- Added structured workbench frame viewport blitting so API Workbench windows copy styled cells directly instead of
  stringifying ANSI slices and reparsing them before the final terminal flush, with unit and benchmark coverage for the
  scrolled truecolor blit path.
- Switched the terminal workbench Three default readback strategy back to blocking at the 120-cell startup budget so the
  default block renderer publishes fresh frames every draw; deferred readback remains configurable for lower-wait
  experiments but is no longer the default workbench path.
- Made the shared WebGPU compatibility device cache recoverable: failed `requestDevice` attempts are no longer cached,
  and native `device.lost` signals clear the cached device so later Three ASCII renderer rebuilds can acquire a fresh
  device after transient GPU pressure.
- Extracted workspace save, rename, delete, and active-workspace refresh state transitions into tested pure helpers so
  the terminal workbench renderer no longer owns direct workspace collection mutation details.
- Extracted workspace-load close planning into a typed pure helper so renderer cleanup, selected CPU tile pruning, and
  close counts are computed outside the terminal workbench render/orchestration module.
- Extracted dynamic visualization window registration planning into the shared window registry so id normalization,
  restore/create decisions, minimum dimensions, and order assignment are tested outside the terminal workbench app.
- Extracted single-window close planning into a typed pure helper so visualization renderer disposal, selected CPU tile
  cleanup, and terminal-shell stop decisions are computed outside the terminal workbench app.
- Extracted built-in workbench window toggle decisions into the shared window registry so close/restore action,
  menu-focus behavior, and terminal-shell startup policy are tested outside the terminal workbench app.
- Extracted New Window option dispatch into the shared window registry so built-in versus visualization routing is
  driven by option metadata instead of hard-coded terminal workbench option id checks.
- Extracted dynamic visualization window toggle decisions into the shared window registry so loaded-state checks and
  close/add ids are tested outside the terminal workbench app.
- Routed terminal workbench forward/backward focus cycling through the shared window manager controller and added direct
  wraparound coverage so the app no longer reimplements open-window traversal.
- Extracted standard workbench window action log formatting into the shared controller module and routed terminal
  focus/minimize/maximize/tab wrappers through one sync-and-log helper.
- Fixed deferred Three ASCII readback self-invalidation: normal readback completion no longer advances the invalidation
  generation, so sibling in-flight block-mode frames are consumed instead of discarded. The workbench pressure probe now
  shows live block grids updating every sampled frame at 960/3840 cell caps instead of visibly stalling for many frames.
- Extracted top-menu dropdown keyboard action resolution into the shared workbench menu helper so the terminal workbench
  only applies renderer-specific side effects for quit/help/focus/menu item actions.
- Extracted focused top-menu keyboard action resolution into the same shared menu helper, leaving the terminal workbench
  to dispatch menu movement, active-item selection, close, and focus handoff side effects.
- Extracted global workbench shortcut resolution into a focused keymap helper so the large terminal workbench app
  dispatches tested command actions instead of owning another long key-to-action chain inline.
- Extracted process-output terminal shortcut resolution into the shared terminal helper so the workbench terminal pane
  dispatches the same action ids used by its toolbar projection.
- Extracted shell workbench-mode shortcut resolution into the shared terminal helper, including copy-mode page
  transitions, so the terminal shell pane also dispatches tested toolbar action ids.
- Retuned the default workbench Three ASCII pressure policy for slow terminal links: the default pane now starts at the
  120-cell emergency tier, 240-cell animated output downshifts on sustained byte rates above roughly 35KB/s, and low
  byte-rate recovery remains conservative so SSH/tmux sessions do not immediately climb back into expensive output.
- Cached normalized workbench Three pressure levels behind a mutation-aware source snapshot and added a focused
  `workbench-three-pressure-policy` benchmark so the adaptive controller stays measured alongside frame flushing.
- Reused a timing scratch buffer while projecting Three ASCII probe reports and added a `three-ascii-probe-report-180`
  benchmark so renderer diagnostics stay covered by the performance catalog.
- Reworked workbench Three pressure-probe summaries to compute steady samples, telemetry averages, and terminal
  byte-rate averages in one pass, with a focused benchmark guard for the report path.
- Switched workbench Three panes back to deferred readback by default and limited live render cadence to focused or
  fullscreen Three windows, reducing blocking GPU readback and background animation pressure in the startup workbench.
- Added a terminal render profile to the Acerola ASCII node so terminal-only frames can skip edge-analysis passes that
  are not consumed by block/no-edge output; the default workbench pressure probe dropped from roughly 11-12ms steady
  renderer time to roughly 6-7ms while preserving real grid updates.
- Added an already-clipped fast path for structured workbench frame-cell viewport blits, reducing the focused
  `workbench-cell-blit-viewport` benchmark from roughly 3.83ms to 3.62ms on this host while preserving clipped blits.
- Added `--check` validation to the workbench Three pressure probe so future renderer pass-graph optimizations fail fast
  when they return cached/static grids without real renderer telemetry or source-row changes.
- Earlier restored the terminal workbench Three policy to blocking readback after stale-grid probes; the current policy
  now uses deferred readback again because stale-frame and startup-grid guards are covered by focused tests.
- Extended Three panel frame-time adaptation to the internal 120/240/480 pressure tiers so slow blocking-readback
  sessions can downshift below the user-facing 960-cell render setting without mutating saved ASCII config.
- Split Three ASCII renderer telemetry into scene update and WebGPU render phases so probes and slow-frame diagnostics
  can distinguish scene animation cost from GPU render submission and blocking readback wait.
- Cached stable Three ASCII compute dispatch plans so steady-size renderer frames avoid recreating pass/workgroup
  metadata before command encoding.
- Reused the Three ASCII compute dispatch resource adapter so steady frames avoid allocating per-frame command encoder
  lookup closures.
- Reused Three ASCII readback copy descriptors and source maps so blocking/deferred frames avoid per-frame readback
  planning wrapper allocations.
- Reused Three ASCII dispatch, readback-layout, and compute-resource option envelopes so steady frames avoid allocating
  private planner input objects before cache lookups.
- Added shared Three ASCII frame option constants so common ANSI-only and image-only render paths avoid recreating
  output-selection objects.
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
- Extracted Three ASCII color conversion, ANSI truecolor sequence, and linear-byte cache helpers into a focused internal
  module so ANSI grid assembly stays concentrated on frame projection while preserving benchmarked block/glyph output.
- Raised the API workbench's default Three ASCII live render budget from emergency mode to the normal live tier, added
  higher recovery tiers, shortened low-pressure recovery, and raised the global terminal-byte downshift threshold so
  full-screen redraws do not immediately pin the default Three pane to low fidelity.
- Retuned API workbench Three per-grid terminal-pressure thresholds for the new richer cell tiers so normal truecolor
  block frames can remain at 1920/3840 cells while slow terminal writes still downshift through duration pressure.
- Specialized array-backed workbench row/slice assembly so Three block pane flushes avoid per-cell callback dispatch
  while preserving styled-run compaction and clipping behavior.
- Rechecked the reported default workbench Three block-mode slowdown with serial live probes. Deferred readback and the
  terminal profile still produce roughly 6ms steady renderer work on this host; the remaining visible bottleneck was the
  default 60-cell emergency startup tier and 20fps cadence cap. The workbench now starts the default Three pane at the
  120-cell normal live tier with 30fps scheduling, while retaining 60/30-cell downshift tiers for slow SSH/tmux output.
- Added an already-clipped frame-cell writer for renderer projection hot paths and routed Workbench Three grid blits
  through it with a safe fallback for negative columns. Focused grid benchmarks stayed under budget and repeated samples
  improved scaled/capped/vertical projection modes while preserving clipped write behavior in tests.
- Added a single-style ANSI write fast path for workbench frame rows, covering the common full-row
  `SGR + plain text + reset` shape used by workbench backgrounds and block panes while preserving mixed ANSI parsing.
  Repeated flush benchmarks improved `workbench-ansi-screen-flush`, `workbench-ansi-screen-span-flush`, and
  `workbench-three-block-span-flush` on this host.
- Extracted terminal shell status/hint row projection into the shared workbench terminal helper with caller-owned row
  reuse, trimming another presentation slice from `api_workbench.ts` while keeping terminal and future browser shell
  adapters aligned.
- Fixed the default workbench Three ASCII startup cadence regression by treating visible Three panes as live-rendered
  instead of only focused panes, and retuned terminal-pressure thresholds so normal truecolor block frames do not
  immediately collapse to rescue budgets while sustained heavy output still backs off.
- Added caller-owned workspace snapshot projection helpers and routed the API workbench save/prompt/autosave path
  through retained current-window and visualization-id buffers, with a focused benchmark guard for the projection path.
- Extracted Three ASCII Acerola render-profile selection into a pure helper with direct tests, keeping image/ANSI,
  block/glyph, edge, and depth target decisions out of the WebGPU renderer orchestration.
- Extracted Three ASCII readback copy source-map updates into the readback helper layer and made optional fill buffers
  explicit in the type, preventing stale fill/edge GPU sources from carrying across compact block-mode frames.
- Extracted Three ASCII readback layout-option and copy-descriptor updates into caller-owned readback helpers, keeping
  renderer readback planning allocation-light while preserving benchmarked copy and ANSI-grid throughput.
- Reused Three ASCII readback copy source-slot records so blocking and deferred readback copies no longer allocate a
  temporary GPU slot wrapper before updating the retained source map.
- Reused the deferred readback queue inspection snapshot on saturated early-return frames, avoiding a second queue
  inspection/allocation while preserving saturated-frame telemetry.
- Allowed image-only Three ASCII render-profile selection to skip effect-state projection, avoiding unnecessary Acerola
  uniform reads on raster-only frames while preserving ANSI and mixed output behavior.
- Added caller-owned Three ASCII frame-selection resolution and routed the renderer through a retained selection record,
  removing a common per-frame output-selection object allocation.
- Cached the deferred readback queue's last completed grid while resolving bootstrap/submission state, removing a
  duplicate last-grid lookup in the no-completed-grid deferred path.
- Added summary-aware workbench Three pressure-probe validation and formatting paths, letting the live probe reuse one
  computed renderer summary for report output and `--check` validation.
- Reused prepared fallback rows while projecting workbench-hosted Three grids, avoiding repeated fallback row rebuilds
  when sparse or empty source rows are painted into larger terminal panes.
- Added a focused `workbench-sparse-three-grid-220x70` benchmark so sparse/fallback Three grid projection remains
  covered alongside scaled, capped, and vertical-only workbench projection paths.
- Switched workbench Three fallback row preparation to the native array fill path, keeping sparse/fallback projection
  covered by the new focused benchmark.
- Added a Three panel idle render-cell cap and wired the API workbench to render background Three panes at the rescue
  budget, reducing shared WebGPU queue contention when multiple 3D widgets are open while preserving the active pane's
  live quality budget.
- Re-aligned API workbench Three runtime tests with the current sustained-pressure policy so startup recovery,
  multi-frame downshift thresholds, and pressure inspection diagnostics are covered by a passing focused suite again.
- Extracted API workbench Three panel construction behind a shared factory so built-in and dynamic Three panes use the
  same idle rescue cap and deferred readback defaults, with injected-renderer test coverage for the resolved options.
- Added a reusable API workbench Three pressure-change projection path and routed the runtime controller through a
  retained scratch result, avoiding per-frame pressure-change result allocation while keeping the public pure helper.
- Retained workbench frame row metadata across `prepareWorkbenchFrame()` clears by marking existing metadata dirty
  instead of deleting it, reducing row metadata churn in repeated Three/workbench frame projection while preserving
  stale-row clearing behavior.
- Split workbench styled-cell tokenization and row/slice assembly into `workbench_frame_rows.ts`, preserving the
  existing frame facade while keeping the terminal hot path independently testable and benchmarked.
- Extracted ThreePanelFrameView graphics-image handle ownership into `ThreePanelGraphicsImageController` with direct
  tests for replace, stale-frame cleanup, clear, and diagnostics while preserving Kitty/image frame behavior.
- Changed workbench Three cadence so any visible normal/fullscreen Three-backed pane uses the live interval instead of
  being throttled to idle just because focus is elsewhere.
- Tightened API workbench Three terminal-pressure adaptation to step down on the first heavy terminal flush, improving
  responsiveness over slow SSH/tmux truecolor block-output paths.
- Added a dedicated `workbench-three-block-span-flush` benchmark that exercises animated truecolor block grids through
  the retained workbench terminal painter.
- Added a compact workbench log diagnostic when Three terminal pressure changes the render-cell budget so manual
  profiling can distinguish renderer slowdown from terminal-output throttling.
- Lowered the API workbench Three startup render-cell budget to the documented 480-cell policy while preserving 960 as
  the slow-recovery high-quality cap.
- Extracted the workbench Three block flush benchmark fixture into a focused helper module so the benchmark catalog no
  longer owns its painter, frame, and animated truecolor fixture state inline.
- Extracted Three ASCII renderer performance record projection into a focused helper with direct tests, keeping
  saturated deferred-readback telemetry out of the WebGPU orchestration path.
- Extracted Three ASCII compute dispatch planning into a tested helper so renderer GPU orchestration executes a small
  pass plan instead of owning edge/no-edge workgroup sequencing inline.
- Extracted Three ASCII compute resource sizing and edge-buffer transition decisions into a tested helper, keeping
  buffer byte lengths and dirty-resource classification outside the renderer allocation path.
- Extracted readback copy-plan execution into the Three ASCII readback module with fake-command tests, leaving the
  renderer to provide GPU buffers while the shared helper validates target/source availability and copy offsets.
- Moved the Three ASCII WGSL fill, edge, and color shader sources plus shared shader dimensions into a focused shader
  module with direct tests, reducing the renderer orchestration file by more than 200 inline shader lines.
- Reused the canvas row spatial index across intersection-dirty renders and retained row buckets between rebuilds,
  reducing the focused `canvas-overlap-modal-churn` benchmark from roughly 17ms to 14.5ms on this host.
- Fixed the workbench Three pressure probe sampling order so it mutates scene state before waiting for the next frame;
  the probe now validates real renderer frames instead of sampling stale fallback grids with zero performance telemetry.
- Lowered the Three panel adaptive slow-frame floor from 100ms to 50ms so 70-90ms renderer frames at 24-30fps targets
  downshift quality after sustained pressure instead of remaining visibly sluggish.
- Made `three-panel:live-probe -- --check` enforce real validation for steady renderer frames, grid updates, and average
  frame time, so future live renderer checks fail on stale/zero-telemetry probes instead of silently passing.
- Extracted CPU hex-grid selection map updates and selected-tile scroll targeting into the visualization module with
  direct tests, keeping API workbench CPU selection code focused on focus, scroll application, and logging side effects.
- Reused workbench ANSI changed-span scratch buffers and span objects across flushes, keeping sparse terminal output
  allocation-light; focused `workbench-ansi-screen-span-flush-168x54` measured around 2.16ms after the change.
- Tuned the terminal-hosted workbench Three ASCII startup budget to begin at 480 cells and drop to 240 after the first
  high-byte terminal flush, reducing the default startup pane cost for slow SSH/tmux sessions while still allowing slow
  recovery to the 960-cell high-quality cap.
- Made `ThreePanelFrameView` accept a reactive frame interval and wired workbench-hosted Three panes to lower FPS as
  terminal pressure rises, reducing truecolor block-mode bytes per second in SSH/tmux sessions.
- Made the workbench Three ASCII cadence focus-aware so background Three panes idle at lower FPS while focused Three
  windows keep the normal pressure-adjusted cadence.
- Corrected the workbench cadence gate to treat any visible Three-rendered window as live, so the default startup Three
  pane no longer gets idle-throttled just because Inspector has keyboard focus.
- Added terminal flush-duration telemetry to the workbench screen painter and wired Three ASCII pressure control to slow
  real terminal writes, including a 120-cell emergency tier for SSH/tmux sessions that block despite moderate byte
  counts.
- Added a source-column-index fast path for workbench Three grid projection so scaled rectangular Three panes avoid the
  generic per-cell fallback branch while copying into frame rows.
- Reused consecutive projected Three grid rows when scaling maps multiple target rows to the same source row, trimming
  repeated row reconstruction in enlarged low-resolution workbench Three panes.
- Moved restore-next-minimized-window behavior into `WindowManagerController`, replacing renderer-local inspection scans
  with a tested shared window-manager method.
- Extracted API workbench window-title composition into the shared catalog helper with direct tests, keeping terminal,
  visualization, built-in, and fallback titles aligned outside the renderer.
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
- Extracted retained titlebar layout/render-command buffers into a shared cache used by terminal and browser workbench
  hosts, removing duplicate mutable map helpers from both large demo adapters.
- Extracted retained modal row/action-button buffers into a shared cache used by terminal and browser workbench hosts,
  trimming duplicate overlay buffer plumbing while preserving renderer-local paint and hit registration.
- Added a retained Three ASCII config modal buffer cache and routed terminal/browser config modals through it so row
  placements, row commands, and action buttons reuse one tested buffer shape.
- Routed the standalone visualization monitor through per-slot source-frame buffers so each panel reuses its source
  array without sharing mutable context across sibling slots.
- Added caller-owned synthetic workbench source projection and routed non-monitor workbench visualization contexts
  through it, avoiding the per-frame source descriptor and frame-list allocations.
- Added caller-owned CPU hex tile layout projection and routed workbench tile hit/reveal paths through reusable buffers
  so CPU hex interaction geometry stops allocating tile arrays on every draw or selection reveal.
- Extracted the browser API workbench default terminal workspace fixture and guarded snapshot normalizer into a focused
  module with direct tests, keeping browser restore defaults out of the large page renderer.
- Switched workbench-hosted Three ASCII panes back to bounded deferred readback after probes showed blocking WebGPU
  readback could stall real frame publication on this host while deferred kept steady post-warmup renderer timings.
- Added source-grid row change and panel update counters to the Three workbench pressure probe, then raised the default
  startup render budget to the 960-cell live cap because the 240-cell tier was too coarse to show regular source changes
  for the default scene even though the renderer was submitting frames.
- Extracted workbench Three pressure-probe grid snapshot, source-row diffing, and line formatting helpers into the
  shared probe module with direct tests so CLI profiling output stays renderer-aware and script-local code stays small.
- Extracted API workbench control-row snapshot projection into a tested helper so `renderControls` no longer owns
  checkbox/radio option buffer assembly before painting and hit registration.
- Changed workbench Three terminal-pressure policy to downshift on the first scoped high-pressure frame, so slow
  SSH/tmux sessions that spend hundreds of milliseconds flushing the default Three pane do not wait through repeated bad
  frames before dropping to the emergency render budget; local pressure probes still hold the 240-cell tier when steady
  output stays under threshold.
- Extended Three terminal-pressure scoping so fast unrelated full-screen redraws remain ignored, but slow full-screen
  flushes with visible Three output can still trigger the emergency budget immediately on constrained terminals.
- Added a shared terminal session-tab source projector and routed console plus browser workbench shell tabs through it,
  removing duplicate session-state loops while preserving retained tab buffers.
- Returned Three grid projection metadata from the workbench grid writer and routed terminal-pressure row accounting
  through the actual rendered target height, keeping capped/scaled grid pressure measurement aligned with paint output.
- Extracted the workbench Three terminal-pressure flush update into a pure resolver that combines live-cap resync,
  sample scoping, and budget adaptation with focused tests for unrelated redraws and current-cap recovery.
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
- Replaced retained `TextObject` rows in the API workbench with a direct ANSI screen painter for terminal draws, so
  unchanged full-screen rows skip both signal propagation and canvas object churn while keeping a benchmark guard for
  the 168x54 workbench flush path.
- Routed API workbench terminal draws through changed-span flushing so animated Three ASCII windows update only the
  modified row intervals instead of repainting every full terminal row; added benchmark and regression coverage for span
  bytes, span/full-mode transitions, and disjoint retained edits.
- Split changed ANSI screen rows into bounded sparse spans instead of one wide bounding span, reducing terminal bytes
  for sparse same-row animation while preserving full-row fallback and retained snapshot correctness.
- Lowered the API workbench-hosted live Three ASCII render cap to 960 cells for unsaved defaults, reducing SSH/tmux
  truecolor block payload pressure while keeping standalone/package renderer defaults and saved per-widget overrides
  unchanged.
- Made workbench-hosted Three panel render caps reactive and connected them to terminal flush byte pressure, so live
  terminal sessions can step down to a smaller source grid when SSH/tmux truecolor output gets too heavy without
  mutating per-widget ASCII configuration.
- Extracted workbench Three terminal-pressure budgeting into a tested pure helper and expanded it to stepped source-grid
  levels so slow SSH/tmux sessions can continue reducing payload beyond the initial 960-cell default.
- Shifted terminal Three pressure policy toward smaller source grids at steadier live cadence: pressure now trades
  detail for smoother motion, with tested frame-interval selection for live and idle workbench Three panes.
- Made workbench Three cadence focus-aware through a shared tested helper so background Three panes use idle timing
  while focused or fullscreen Three panes keep interactive timing.
- Extracted workbench Three rectangle write suppression and graphics-surface clipping into a focused tested helper,
  trimming inline resize/Kitty geometry logic from the large API workbench module.
- Reduced ThreePanelFrameView renderer startup churn by resolving the initial adaptive render size once and reusing it
  for renderer construction, applied-state capture, and the startup fallback grid.
- Extracted ThreePanelFrameView blank-grid allocation and unchanged-grid fingerprinting into a focused helper with
  direct tests, keeping the no-redundant-redraw path easier to benchmark and optimize independently.
- Extracted ThreePanelFrameView slow-frame and adaptive-render diagnostic payload construction into a focused tested
  helper so renderer telemetry formatting can evolve independently from the render loop.
- Moved Kitty graphics fallback reason and diagnostic payload construction into the tested Three panel diagnostics
  helper, leaving the panel render loop to own only fallback state and rate limiting.
- Restored the API workbench startup Three pane to a 960-cell live block-render budget, made it the initially focused
  window, and prevented terminal-pressure downshifts from warm-up placeholder frames.
- Added a real WebGPU `three-ascii:probe` timing task and hardened deferred readback failures so unsupported or rejected
  deferred maps demote to blocking readback instead of forcing ThreePanelFrameView into fallback/rebuild loops.
- Added per-Three-grid terminal byte thresholds to the workbench pressure policy so SSH/tmux sessions can downshift
  medium-but-expensive ASCII panes before whole-screen flushes become visibly slow.
- Extracted the real WebGPU Three ASCII probe parser and timing report projection into a tested helper so renderer
  performance measurements can be evolved independently from the script entrypoint.
- Moved the workbench Three grid benchmark fixture out of the main benchmark catalog, keeping the scaled/capped terminal
  grid guards reusable while continuing to track the 220x70 performance envelopes.
- Split the Three ASCII benchmark family out of the main benchmark catalog, so readback, image compaction,
  uniform-clean, ANSI grid assembly, and frame-diff guards live with their synthetic buffers instead of inflating the
  shared registry.
- Moved API-workbench-specific Three render-cell budgets, pressure thresholds, and live/idle cadence mapping into a
  tested policy module so tuning the default Three pane no longer requires editing the large interactive app file.
- Extracted the API workbench built-in window ids, launcher option catalog, visualization option ids, and lookup map
  into a tested window catalog module, reducing static menu setup in the large interactive workbench file.
- Added a shared tested terminal search modal body projector so console and future web workbench shells can reuse the
  same copy-mode search prompt text without embedding it in the large API workbench renderer.
- Extracted the Three panel ASCII effect option comparator into a focused tested helper, keeping renderer state update
  gating separate from the large frame lifecycle class.
- Moved Three panel adaptive render-cell budget policy into a focused tested module, preserving the existing re-export
  while separating performance downshift/recovery tuning from the frame lifecycle implementation.
- Moved Three panel render-size capping and Kitty/ASCII frame policy into a focused tested module, keeping graphics
  transport decisions separate from the frame lifecycle implementation while preserving compatibility re-exports.
- Extracted Three ASCII renderer option, render-size, and terminal-edge-bias normalization into a focused tested module,
  reducing duplicate clamps in the renderer constructor and mutators without changing benchmarked frame paths.
- Extracted Three ASCII perspective-camera aspect math into a focused tested helper, preserving resize behavior while
  making terminal pixel-ratio aspect decisions independently testable.
- Hardened deferred Three ASCII readback failure handling so failed deferred maps return the cached grid, discard the
  bad queue, and retry deferred mode instead of falling into a blocking map/rebuild path; the real WebGPU probe now
  clamps tight-loop runs to a one-tick cadence and completes short/default deferred block probes without crashing.
- Lowered the API workbench's unsaved startup Three ASCII budget from 480 to 240 cells, kept 480 as a recovery step, and
  raised the small-budget live cadence so slow terminal transports start with less truecolor block payload pressure.
- Optimized workbench frame styled-cell splitting for the common Three block-mode truecolor cell shape, avoiding
  per-cell `Array.from()` parsing in large ANSI rows; the `workbench-three-block-span-flush-168x54` guard now averages
  roughly 2.5ms on this host.
- Extracted retained ANSI screen changed-span detection and snapshot updates into a focused tested helper, keeping the
  Three block span flush path independently tunable while preserving the roughly 2.2-2.3ms benchmark guard on this host.
- Extracted retained ANSI screen output joining, encoding, writing, and flush-stat construction into a focused tested
  helper, removing duplicated output code from full-row and changed-span painter paths without benchmark regression.
- Added a focused `render/workbench-changed-span-detection-168` microbenchmark for retained terminal row span diffing,
  giving the extracted span detector a tight performance guard before further terminal-output tuning.
- Extracted Three ASCII deferred readback failure handling into a focused tested helper, preserving cached-grid retry
  behavior while keeping the renderer catch path small and the real WebGPU probe non-saturated.
- Extracted Three ASCII readback grid assembly into a focused tested helper so blocking and deferred readback paths
  share the same view-resolution, assembler wiring, and timing logic without duplicating renderer code.
- Retuned the API workbench startup Three ASCII policy to start at the 120-cell emergency tier, recover much more
  slowly, and reduce high-detail live cadences so SSH/tmux truecolor block rendering favors smooth motion by default
  while retaining higher-detail per-widget configuration.
- Added a 30-cell rescue render tier and shared Three panel render queue so multiple workbench-hosted Three panes do not
  compete for WebGPU/readback work; focused probes now show live deferred block frames at roughly 4.7KB/s for the
  30-cell tier and 9.6KB/s for the 60-cell tier after startup while keeping panel concurrency covered by direct tests.
- Paused workbench-hosted Three scenes behind generic modal dialogs while preserving live rendering for the dedicated
  ASCII config overlay; manual PTY verification showed the quit modal stops the animated truecolor stream instead of
  continuing background renderer output under a blocking dialog.
- Moved the default workbench Three startup cap to the 30-cell rescue tier so slow SSH/tmux terminals start on the
  lowest-bandwidth live profile immediately; the default pressure probe now reports roughly 9x3 source grids at about
  4.6KB/s steady terminal output after startup.
- Moved modal-blocked Three cadence/interactivity decisions into the shared terminal-pressure helper so workbench hosts
  can pause renderer work behind blocking overlays through the same tested policy path instead of carrying
  renderer-local early returns.
- Extracted the API workbench's static studio Three scene projection into the shared Three scene helper, covering
  control-to-scene signal mapping and blocked/minimized/unavailable gates with direct tests while preserving the default
  30-cell pressure-probe behavior.
- Cached the background-run classification inside split workbench frame cells, avoiding repeated ANSI-prefix scans while
  assembling animated Three block rows and preserving exact truecolor output.
- Added a dedicated Three ASCII block-mode grid assembly path that skips glyph/edge selection for full-cell block
  rendering while preserving exact truecolor backgrounds; block assembly benchmarks now sit around 0.04-0.07ms for
  common 96x40 block cases on this host.
- Deferred terminal fill-key and edge-bias setup until glyph/mixed assembly needs it, keeping default block-mode frames
  on the shortest setup path.
- Replaced block-mode per-cell fill bucket rounding with the equivalent 5.5 visibility threshold, preserving rounded
  boundary and NaN behavior while trimming work from dense block frame assembly.
- Removed the now-dead block-mode branches from generic fill-only glyph assembly so the default block fast path stays
  isolated and glyph/mixed assembly no longer pays for block-mode conditionals.
- Added an awaited first-frame deferred readback bootstrap for Three ASCII renderers so deferred mode publishes a real
  ANSI grid on startup instead of returning blank cached frames until an async map happens to resolve; steady-state
  frames continue to use nonblocking deferred readback slots.
- Retuned the API workbench default Three ASCII startup budget from 480 to 240 cells after the pressure probe showed
  roughly half the terminal payload at the same live cadence, while preserving 480/960 as recovery/detail levels.
- Extracted standard workbench top-menu item-id mapping and signal-state projection into the shared menu helper so the
  API workbench no longer owns that renderer-neutral disclosure bookkeeping inline.
- Extracted Kitty graphics modal status formatting into the workbench Kitty controller module with focused coverage,
  leaving the API workbench to supply only current selection and surface inspection.
- Extracted Three ASCII config modal key resolution into the shared ASCII config helper so the API workbench owns only
  state mutation and side effects.
- Fixed the ThreePanelFrameView deferred-readback startup path so empty deferred frames no longer replace the visible
  startup/current grid; the live probe now reports real `26x8` block grids instead of staying at `0x0` initializing.
- Hardened the Three ASCII probe CLI helpers to accept both `--flag=value` and `--flag value`, preventing performance
  probes from silently falling back to default cell budgets during renderer investigations.
- Fixed ThreePanelFrameView sync handling so signal-only scene updates no longer invalidate in-flight renderer frames,
  and expanded the live panel probe with deferred queue telemetry to distinguish static grids from readback saturation.
- Extracted ThreePanelFrameView renderer-state matching into the tested Three panel effect helper, keeping signal-churn
  sync policy reusable and easier to reason about outside the large frame lifecycle class.
- Extracted the workbench Three pressure-probe summary into a tested helper and separated placeholder/startup renderer
  samples from steady-state averages, so warm WebGPU frames are not misreported as 3-13 FPS renderer regressions.
- Cached retained ANSI painter blank rows per terminal width so resize/shrink clears do not rebuild identical blank
  strings for every stale row; added coverage for width changes and reset behavior.
- Cached plain ASCII frame-cell split descriptors in the workbench row assembler and added a dedicated
  `render/workbench-plain-frame-row-168` benchmark guard for dense text rows.
- Raised the API workbench Three draw cadence for small live block-rendering panes, made workbench-hosted Three panels
  use explicit blocking readback, and updated the pressure probe to match that policy. The default 240-cell probe now
  publishes changed Three rows every frame at roughly 20ms renderer time against a 33ms target, while 480/960-cell
  probes publish every frame around 23-24ms instead of returning stale deferred grids for many frames.
- Added a bounded stale-grid fallback to deferred Three ASCII readback: after a configurable number of cached-grid
  frames, the renderer performs one blocking readback, replaces the deferred queue's displayed grid, invalidates older
  pending maps, and resumes deferred mode. The workbench pressure probe now accepts `--readback`, and the 960-cell
  deferred probe publishes changed rows every frame at roughly 12.7ms renderer time versus roughly 24ms blocking.
- Extracted deferred readback stale-frame threshold policy into a focused tested helper so renderer lifecycle code
  delegates the force-blocking decision instead of owning another inline state machine.
- Extracted browser/remote terminal protocol header projection into the shared workbench terminal helper, letting the
  web API workbench reuse caller-owned header rows instead of rebuilding the strings inline every draw.
- Moved the default workbench Three startup budget back to the 120-cell emergency tier after the current pressure probe
  measured roughly 25-32KB/s steady terminal output at 120 cells versus roughly 45-55KB/s at 240 cells, preserving
  automatic recovery to higher tiers when terminal output stays cheap.
- Added a shared terminal toolbar state normalizer and routed console plus browser shell toolbars through it, keeping
  scrollback/search match state projection out of renderer-specific toolbar loops.
- Extracted ThreeAsciiObject range application into a focused helper with direct tests, keeping the range-copy hot loop
  independently covered while preserving frame-diff and rerender-range benchmark guardrails.
- Added `render/three-ascii-range-apply-160` to the benchmark catalog so the extracted Three ASCII range-copy path is
  measured directly; the guard currently runs around 0.001ms on this host.
- Extracted ThreeAsciiObject per-cell rerender application into the same focused helper with direct clipped, omitted,
  and sparse-cell coverage while preserving existing frame-diff and range benchmark guardrails.
- Tightened API workbench Three terminal-pressure recovery after an accurate probe showed the default saved
  `renderMaxCells` could auto-climb from the 120-cell startup cap into 480/960-cell output over SSH; the probe now
  models saved ASCII cells separately and the tuned policy settles around the 240-cell tier for animated output.
- Extracted workbench Three pressure-probe CLI parsing into the shared probe helper with tests for separate pressure
  caps and saved ASCII cell budgets, keeping future renderer tuning measurements aligned with the real workbench startup
  path.
- Extracted API workbench Three pressure-change resolution out of the runtime controller into a directly tested helper,
  leaving the controller to apply signal mutations while pressure policy, cadence, and log projection stay inspectable.
- Switched the API workbench Three startup renderer policy back to deferred readback after the bounded stale-grid
  fallback made it safe for live panes; the default 240-cell startup pressure probe now uses `readback=deferred` and
  measured roughly 9.8ms average renderer frames versus roughly 20.9ms with blocking readback on this host.
- Added a low byte-rate recovery gate to the workbench Three terminal-pressure model so animated 120-cell output does
  not auto-climb back to 240 cells unless the terminal is sustaining less than 20KB/s; the 80-frame startup probe now
  stays at the 18x6 emergency grid instead of recovering into a larger payload on moderate animated output.
- Extracted Three panel effective render-budget and frame-interval normalization into the renderer policy module with
  direct tests, leaving `ThreePanelFrameView` to read signals while pressure-cap clamping remains reusable and
  independently covered.
- Extracted the Three ASCII renderer's pre-scene deferred-readback decision into a focused helper, covering unavailable
  readbacks, saturated queues, and stale-frame force-blocking without moving GPU submission code out of the renderer.
- Added a vertical-only workbench Three grid projection fast path that direct-copies same-width source rows while still
  scaling rows, plus a benchmark guard for the 109x70 vertical projection workload.
- Added a retained ANSI cursor-position cache for workbench screen flushes so repeated full-row, clear-row, and span
  updates reuse cursor escape strings instead of rebuilding them throughout animated Three block frames.
- Reused the retained workbench ANSI output chunk array across full-row and changed-span flushes, trimming per-frame
  allocation in terminal screen writes while preserving synchronous write stats.
- Fixed deferred Three ASCII readback publication by advancing the deferred queue generation whenever a completed
  readback becomes the visible cached grid; the workbench pressure probe now publishes live deferred updates at the
  120/240-cell tiers instead of reusing a stale revision.
- Hardened the benchmark CLI so targeted runs with no matching cases fail with a selector diagnostic instead of
  returning a green zero-case summary, making renderer performance checks harder to misuse.
- Added a direct Three ASCII grid-diff benchmark for `queueChangedThreeAsciiGridCells`, separating pure diff-helper cost
  from `ThreeAsciiObject` lifecycle overhead before further canvas update tuning.
- Split the fully visible Three ASCII grid-diff path into dedicated range and cell-queue implementations so the common
  unclipped direct-range path avoids per-run queue-mode dispatch; the object-level frame-diff guard now stays near the
  direct helper cost.
- Removed the default options-object allocation from `changedSpansInto`, keeping the retained workbench ANSI span
  detector allocation-light for default terminal flushes while preserving configured merge/cap behavior.
- Consolidated canvas dirty row range merging into `mergeDirtyRowSegmentsInPlace`, replacing duplicate canvas, box, and
  text object implementations with one tested helper for future render invalidation tuning.
- Reused `DirtyRegion` row segment arrays during incremental and batched merges instead of cloning and replacing them,
  trimming allocation in canvas invalidation while preserving cloned public inspection output.
- Added a 60-cell emergency tier for API workbench Three panes and exposed low render-cell values in the ASCII config
  controls. The guarded default pressure probe now starts at `13x4` cells and steady terminal output is roughly
  12-16KB/s on this host while still publishing real changing deferred renderer frames.
- Added per-panel idle cadence support to `ThreePanelFrameView` and wired API workbench Three panes to focus/fullscreen
  interactivity, so extra visible Three-rendered windows no longer all run at live cadence just because one Three pane
  is active.
- Added a flat Three ASCII color compute shader and bind-group path for terminal frames without depth tinting, avoiding
  an unused normals texture binding/sample in default block rendering while preserving the depth-aware path for configs
  with fog/depth falloff. Focused shader/resource tests and 60/960-cell guarded workbench probes passed.
- Extracted per-window Three pane interactivity into the shared terminal-pressure helper with direct tests, keeping the
  API workbench's inactive-pane idle cadence policy out of renderer-local inline logic.
- Threaded a single Three ASCII effect-state snapshot through `renderFrame`, `renderScene`, and ANSI compute assembly so
  terminal frames do not inspect the same effect uniforms twice while preserving deferred stale-frame fallback behavior.
- Extracted Three ASCII terminal compute-mode resolution into a pure helper covering block/glyph edge and depth-color
  pass selection. Focused compute-mode tests, renderer/resource tests, the default workbench pressure probe, and the
  `three-ascii` benchmark suite passed.
- Lowered the workbench Three emergency 60-cell live cadence from 30fps to 20fps to reduce remote terminal backlog at
  startup. The default saved-config pressure probe still published live frames while steady output dropped from roughly
  14KB/s to roughly 9KB/s on this host.
- Added a 30-cell rescue pressure tier for constrained terminals and aligned the Three panel adaptive budget floor with
  that tier. Sequential probes show the normal 60-cell startup tier remains live around 9.5KB/s, while the rescue tier
  still publishes changing frames at roughly 4.6KB/s.
- Extracted dynamic visualization Three-scene gating into the shared workbench Three scene helper so modal blocking,
  renderer availability, and minimum live-render dimensions are tested outside the main workbench renderer.
- Added a shared visible-window-rectangle filter and routed the terminal workbench through it so scrolled-off workspace
  windows, including Three panes, are not rendered or kept live while outside the visible workspace viewport.
- Added a `render/workbench-visible-window-rects-60` benchmark guard for the visible-window filter; it runs around
  0.002ms average on this host.
- Routed the browser API workbench through the same visible-window filter as the terminal adapter so web parity keeps
  scrolled-off panels out of the render loop.
- Switched `FrameScheduler` throttling to measure frame spacing from callback completion instead of callback start,
  preventing slow terminal flushes from immediately draining queued invalidations and compounding perceived lag.
- Promoted API workbench Three panes from the 30-cell rescue startup tier to the 60-cell emergency tier while keeping
  the 30-cell fallback available under terminal pressure. Normal animated block output now stays at `13x4/52c` and 20fps
  cadence instead of starting at `9x3/27c`; recovery into 120 cells requires quieter output below 10KB/s to avoid
  periodic expensive up/down oscillation.
- Added a compact block-mode Three ASCII readback path: color compute shaders now carry block visibility in alpha, block
  assembly can use that alpha mask, and block terminal frames omit the fill payload from GPU readback while glyph and
  mixed modes keep full fill/edge/color data. The workbench pressure probe stays stable at `13x4/52c`; recovery now
  requires output below 7KB/s so the lower-byte block path does not oscillate into 120-cell frames.
- Added direct benchmark guards for compact block-mode assembly and color-only readback packing. The compact readback
  guard runs around 0.003ms on this host versus roughly 0.007ms for the full fill/edge/color readback-copy workload, and
  the `three-ascii` selector now covers 19 renderer-focused cases.
- Removed the now-redundant fill compute pass and fill storage buffer from compact block-mode terminal frames. Block
  mode dispatches color-only compute while glyph/mixed modes still run fill/edge/color as needed; focused compute policy
  tests, the 90-frame workbench probe, and the `three-ascii` plus `workbench-three` benchmark selectors passed.
- Added blank-run and same-color-run filling to compact alpha-mask block assembly so color-only block frames get the
  same row-fill treatment as the fill-buffer block path. Focused glyph tests and the `three-ascii-ansi-grid` benchmark
  selector passed after the change.
- Fixed deferred readback starvation for saturated queues by honoring stale-frame blocking recovery and counting
  uncached startup frames toward that recovery threshold. Because Deno/WebGPU deferred block readbacks still stall under
  forced synchronization at high cell counts, the API workbench now defaults its Three panes to blocking readback; the
  default 60-cell block probe runs around 58fps renderer-side and a saved 960-cell block probe stays around 55fps on
  this host instead of the deferred 3-5fps path.
- Extracted standard top-menu dropdown overlay projection into the shared menu helper so theme, new-window, and
  workspace dropdowns reuse tested anchoring, visible-slice, width, and selected-index remapping instead of carrying
  that renderer math inline in the terminal workbench.
- Extracted API workbench hit-action-to-window resolution into a focused helper with direct tests, keeping hover/focus
  routing for window chrome, terminal shell content, controls, data rows, and explorer rows out of the large terminal
  renderer.
- Moved API workbench titlebar button hit-action mapping into the same focused hit helper with tests for config,
  minimize, maximize, restore, and close actions.
- Extracted API workbench scrollbar pointer-hit offset resolution into the hit helper with tests for window vertical,
  window horizontal, and workspace scrollbars, removing direct scrollbar math from the large click handler.
- Added workbench Three terminal-pressure inspection to the runtime controller and surfaced compact pressure tier,
  byte-rate, and scoped/wide labels in the built-in Three header. Focused tests, the header/block renderer benchmarks,
  and a 12-frame default blocking pressure probe passed; the probe shows roughly 17-18ms renderer frames at the 60-cell
  startup tier with about 10KB/s terminal output on this host.
- Changed per-window Three interactivity so only the active or fullscreen Three pane renders at foreground cadence;
  background visible Three panes now use idle cadence while the global scheduler still stays warm when any Three pane is
  visible. Focused policy/frame tests and the workbench Three pressure/span benchmarks passed.
- Cached clean retained rows in the ANSI span-mode screen painter so unchanged workbench rows skip repeat span detection
  after they are proven equal to the retained snapshot. Focused painter/frame tests passed, and the repeated workbench
  Three block span benchmark improved to roughly 2.2ms on this host.
- Omitted zero-byte GPU readback copy commands from Three ASCII readback plans so compact or empty payload shapes do not
  submit no-op buffer copies. Focused readback and renderer tests passed; readback-copy benchmarks stayed well under
  guardrails at roughly 0.009ms for full payloads and 0.004ms for compact block payloads.
- Added an empty/out-of-range workbench frame row assembly fast path and benchmark guard so blank terminal rows avoid
  per-column scans. Focused frame and benchmark tests passed; the new `workbench-blank-frame-row-168` benchmark runs at
  roughly 0.001ms on this host.
- Added reusable workbench Three pressure-probe grid snapshots and routed the live probe through them, removing
  per-frame row-array allocation while preserving mutable renderer history comparisons. Focused probe tests, type
  checks, the pressure-probe summary benchmark, and an 8-frame blocking live probe passed.
- Switched the API workbench Three default back to deferred readback after isolating the apparent 3fps regression to GPU
  contention from concurrent WebGPU probes. Sequential default block-mode probes now show the panel path around 6-7ms
  steady renderer work at the 60-cell startup tier, versus roughly 14-17ms with blocking readback; focused policy,
  runtime, frame, renderer-option, and pressure-probe tests passed.
- Added a lightweight workbench Three cadence meter and surfaced observed grid-publication FPS in the built-in Three
  header alongside configured target FPS, making manual renderer profiling distinguish intended cadence from actual
  visible update rate. Focused row/cadence tests and the `workbench-three-header-telemetry` benchmark passed.
- Tightened the cadence meter so stale observed FPS ages out while panes are paused or hidden, and routed the workbench
  header through a primitive `measuredFps()` read instead of allocating an inspection object during render.
- Extracted Three header performance-text projection into `workbench_three_header.ts` with direct tests for detailed,
  compact, and narrow telemetry modes, leaving `workbench_rows.ts` focused on row composition while preserving the
  benchmarked `workbench-three-header-telemetry` path.
- Specialized the extracted Three telemetry formatter for its ASCII-only output so width checks use direct string length
  instead of the general Unicode text-width helper; focused formatter tests and the header telemetry benchmark passed.
- Added a caller-owned workbench Three pressure inspection path and routed the API workbench Three header through it,
  avoiding a render-loop allocation while keeping the snapshot API intact. Runtime tests, type checks, the full
  `api-workbench-frame` benchmark, and the header telemetry benchmark passed.
- Added a renderer-neutral styled-row command projector and routed terminal/web workbench row panels through it so
  explorer, inspector, data table, and log rows share clipping, theme fallback, and scroll-offset behavior. Focused row
  tests, panel projection tests, terminal/web type checks, and the `api-workbench-frame` benchmark passed.
- Raised the default API workbench Three startup budget from 120 to 480 cells after probes showed 120-cell block grids
  rendered quickly but often produced visually identical frames. The new default publishes visibly changing `37x12` to
  `40x12` block grids around 56-57fps renderer-side on this host while retaining the 30/60/120/240 pressure backoff
  tiers for slow terminals.
- Extracted themed workbench frame fill/title/border rendering into renderer-neutral commands and routed both terminal
  and browser API workbench frame drawing through the shared projection. Focused frame/titlebar tests, terminal/web type
  checks, the direct `workbench-frame-render-commands-96` guard, and the `api-workbench-frame` benchmark passed.
- Extracted terminal workspace pane title rendering into reusable commands and routed terminal/browser shell panes
  through shared title paint and hit geometry. Focused terminal/cache tests, terminal/web type checks, and a new
  `terminal-pane-title-render-commands` benchmark guard passed.
- Retuned the default API workbench Three ASCII pressure policy for tmux/SSH: startup now uses a 240-cell block grid
  instead of 480 cells, sustained byte-rate pressure starts at 60KB/s, and scoped high-pressure samples downshift after
  two frames. Focused policy/runtime/probe tests, default/adaptive pressure probes, and pressure benchmarks passed.
- Lowered the default API workbench Three startup pressure to 120 cells after tmux-side reports still showed poor
  perceived FPS at higher terminal-output rates. Sequential blocking probes now hold roughly 58fps renderer-side with
  about 22KB/s terminal output at an `18x6` block grid, while the live panel probe stays near 58fps at `20x6`.
- Made `ThreePanelFrameView` fingerprint revisioned renderer grids before publishing them to the workbench, so
  revision-only frames that quantize to identical terminal cells do not force a redraw. This keeps mutable-grid updates
  correct and removes wasted terminal flushes for low-resolution block frames that repeat visually.
- Added observed-FPS pressure adaptation for workbench-hosted Three panes. The renderer already responds to byte and
  blocking write pressure; it now also backs off when the UI cadence meter reports a sustained collapse below half the
  target FPS, covering remote/tmux cases where the terminal renders slowly without making `writeSync` block.
- Added a fast parser path for the common truecolor background-space cell shape emitted by block-mode Three ASCII frames
  and themed workbench fills. This keeps foreground-only styled spaces on the general path while cutting the
  `workbench-cell-blit-viewport` benchmark from roughly 3.7ms to 1.7ms and the Three block span flush benchmark from
  roughly 2.0ms to 1.35ms on this host.
- Reused DirtyRegion row buckets across canvas reset batches without changing public `clear()` behavior, keeping the
  dirty-region microbenchmark in its prior range while trimming modal overlap churn to roughly 15ms on this host.
- Added full-row single-style render hints to workbench frame rows so screen flushes can reuse the original assembled
  ANSI line instead of splitting and recombining every cell. The focused full-screen flush benchmark dropped from
  roughly 3.4ms to 0.48ms on this host while neighboring span and Three block flush guards stayed within range.
- Cached raw string-backed workbench rows alongside fitted line-signal output so repeated browser/web rows skip text
  fitting and line hashing while still restoring externally modified signals. The focused string line-signal diff
  benchmark dropped from roughly 2.56ms to 1.32ms on this host.
- Added a full-row fast path for string-backed workbench writes with leading SGR styles and a final reset, avoiding
  per-cell conversion when browser/web rows overwrite the full width. The focused full-row string benchmark dropped from
  roughly 1.82ms to 0.29ms on this host.
- Added row-range flush shortcuts for range-aware sinks and a repeated-cell fast path in ANSI range compaction. The
  dense `TextObject` full-row canvas benchmark dropped from roughly 2.57ms to 2.11ms, and the workbench ANSI screen
  flush benchmark dropped from roughly 0.47ms to 0.39ms on this host.
- Tightened API workbench Three pane interactivity so a single visible Three pane remains live, but multi-Three
  workspaces only keep the focused or fullscreen pane at foreground cadence. Other visible panes now use the existing
  idle 30-cell budget instead of every restored Neon/Three window competing as a live renderer.
- Reused full-row rendered hints in the changed-span ANSI screen painter so rows rewritten with the same full-width
  styled background skip span diffing. The focused Three block span flush benchmark dropped from roughly 1.40ms to
  1.02ms on this host.
- Added a simple leading-SGR ASCII row splitter and avoided duplicate first-cell parsing in ANSI range compaction. The
  focused ANSI styled character split benchmark dropped from roughly 0.006-0.007ms to roughly 0.005ms on this host, with
  dense TextObject full-row canvas remaining around 2.01ms on longer repeats.
- Added an allocation-free frame-row assembly path for truecolor background-space cells, keeping high-cardinality block
  rows off the generic styled-cell splitter. The focused workbench cell blit benchmark held around 1.63ms, and the Three
  block span flush benchmark held around 1.02ms on longer repeats.
- Routed the browser API workbench theme dropdown keyboard handling through the shared screen-dropdown key resolver, so
  web and terminal menus share close/help/quit/focus/navigation semantics instead of maintaining parallel theme-only key
  logic.
- Moved the renderer-neutral workbench content-size estimator from the demo `app/` tree into `src/app` and exported it
  through the shared workbench facade, keeping scrollable window sizing available to terminal and web adapters from the
  same tested module.
- Moved the renderer-neutral workspace menu/state planner from the demo `app/` tree into `src/app` and exported it
  through the workbench facade, reducing demo-owned workspace orchestration while preserving the existing save/open/
  rename/delete tests.
- Moved the renderer-neutral workbench frame render-command projector into `src/app` and exported it through the
  workbench facade, so terminal, browser, and benchmark frame chrome all share the same tested module path.
- Moved shared workbench row projection, styled-row command rendering, and Three header telemetry formatting into
  `src/app`, keeping data table footers, Three headers, terminal rows, browser rows, and benchmarks on the same tested
  facade exports.
- Moved Three panel adaptive render-cell budgeting into `src/app`, keeping startup pressure defaults and recovery logic
  independent of demo-only modules.
- Gated workbench Three FPS-based pressure downshifts behind a minimum observed frame count so startup/stall noise does
  not immediately force the default block renderer into a lower terminal budget.
- Raised the workbench Three sustained byte-rate pressure thresholds so healthy truecolor block animation stays at the
  240-cell startup tier; slow flush duration, collapsed measured FPS, and genuinely heavy frames still back off.
- Added observed-cadence telemetry to the workbench Three pressure probe and fed adaptive probe runs through the same
  FPS-pressure inputs as the live workbench; the FPS pressure path now requires sustained severe collapse so startup
  placeholder cadence no longer knocks healthy 240-cell block rendering down to rescue tiers.
- Moved Three panel mouse interaction state and transform application into `src/app` behind a structural Three transform
  interface, keeping zoom/rotate behavior reusable outside the Neon/workbench demo modules.
- Moved dynamic workbench Three panel registry ownership into `src/app` with generic nullable scene signals, reducing
  API Workbench demo-local lifecycle code while preserving hide/dispose semantics for visualization panes.
- Moved workbench Three scene signal projection/comparison into `src/app` with structural scene mode generics, keeping
  API Workbench-specific scene modes out of shared lifecycle helpers.
- Aligned `ThreePanelFrameView`'s implicit readback strategy with the renderer/workbench blocking default after live
  probes showed deferred readback reproducing the reported ~3fps path on this host.
- Extracted workbench Three panel defaulting into `src/app`, keeping demo-local panel construction thin while making
  idle-cell and readback policy defaults reusable through the shared facade.
- Added named default and narrow API Workbench Three startup probes so block-mode renderer regressions can be checked
  with average renderer-time gates from the same task surface users run locally.
- Switched the default API Workbench Three readback path back to blocking after live panel probes reproduced the
  reported deferred block-mode regression at roughly 3-4fps, while blocking held the same 960-cell block grid around
  18ms average renderer time after warmup. Deferred remains available as an explicit ASCII renderer option.
- Cached the Three ASCII Acerola render-output profile in the renderer and added a caller-owned profile resolver so
  steady block-mode frames avoid per-frame profile object allocation and redundant `setRenderProfile` calls. Focused
  renderer/profile tests, the new `three-ascii-render-profile-1k` benchmark, the uniform cache benchmark, and the
  workbench startup probe passed.
