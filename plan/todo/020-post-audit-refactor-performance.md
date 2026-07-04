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
- Made high-pressure workbench Three samples downshift immediately, so manually raised 480/960-cell caps do not spend a
  second expensive terminal frame before backing off on slow sessions.
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
- Extracted Three ASCII color conversion, ANSI truecolor sequence, and linear-byte cache helpers into a focused internal
  module so ANSI grid assembly stays concentrated on frame projection while preserving benchmarked block/glyph output.
- Raised the API workbench's default Three ASCII live render budget from emergency mode to the normal live tier, added
  higher recovery tiers, shortened low-pressure recovery, and raised the global terminal-byte downshift threshold so
  full-screen redraws do not immediately pin the default Three pane to low fidelity.
- Retuned API workbench Three per-grid terminal-pressure thresholds for the new richer cell tiers so normal truecolor
  block frames can remain at 1920/3840 cells while slow terminal writes still downshift through duration pressure.
- Specialized array-backed workbench row/slice assembly so Three block pane flushes avoid per-cell callback dispatch
  while preserving styled-run compaction and clipping behavior.
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
