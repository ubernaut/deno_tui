# Repo Shape Reduction And Runtime-Focused Refactor

Status: completed July 9, 2026.

## Outcome

This pass reduced repository and implementation bloat while preserving the repaired workspace routing, Neon/Three
renderer ownership, console-sized ASCII output, and resize behavior. It is closed because the remaining large adapters
are composition-focused, shared workbench decisions have one owner, generated documentation weight is intentional, and
the broad runtime gates pass.

The final ownership audit found no further high-value production duplication that could be removed without adding
callback-heavy indirection or moving host-specific paint and input code behind generic wrappers. Those rejected
extractions are intentionally not follow-up work unless new callers or measurements change the tradeoff.

## Measured Reduction

Relative to routing/rendering repair commit `346ccda1`:

- `205` files changed with `7,881` insertions and `54,778` deletions: net `-46,897` lines.
- `33` files were deleted and `11` added: net `-22` files.
- The completed tree contains `499` tracked files totaling `13,102,765` bytes.
- The generated API stability baseline fell from `399,882` bytes / `16,141` lines to `296,157` bytes / `2,311` lines
  without changing its canonical JSON hash.
- The latest six-line production clone scan fell from `83` clones / `917` duplicated lines to `78` clones / `841`
  duplicated lines after common settings-binding lifecycle ownership was established.

## Retained Results

- Renderer-neutral workbench models and policy live in `src/app`; terminal and browser adapters retain host paint,
  focus, input, and renderer orchestration.
- `WorkbenchController` remains the single owner of workspace/window state, including active, minimized, fullscreen, and
  restored windows.
- Three panel lifecycle, pressure, grid sizing, interaction, publication, and display policy are shared by the
  workbench, Showcase, and Neon hosts.
- Three ASCII resolution follows the available console surface and republishes the correctly sized grid after terminal
  resize and fullscreen transitions.
- Repeated command construction, selection navigation, overlay hit testing, component and command option shapes,
  settings bindings, projections, and intrinsic layout signatures now use their established shared owners.
- Generated API references and the stability baseline have deterministic generation and health-gate drift checks.
- The screenshot catalog remains limited to six distinct interactive surfaces; the checked-in Pages bundle remains
  because deployment consumes it.

## Verification

- `DENO_NO_PACKAGE_JSON=1 deno task health`: `1,731` core tests, `32` web tests, and `53` worker tests passed with all
  package, API, documentation, application, and benchmark checks green.
- `deno task three-workbench:startup-probe`: passed at `96x32`, `901` cells, and `11.88ms` steady average.
- `deno task three-ascii:live-probe -- --frames 45 --glyphs blocks --max-cells 960 --check --max-average-ms 40`: passed
  at `31x15`, `12.06ms` steady average, and `82.9` FPS.
- Default workbench resize smoke passed from `100x30` to `160x48`, with all `157/157` Three pane columns populated.
- Fullscreen resize smoke passed from `112x34` to `154x48`, with `5,738/5,738` cells and all `151/151` Three pane
  columns populated.

## Deliberate Boundaries

The terminal and browser hosts remain separate where their event systems, focus handling, rendering, and I/O differ.
Showcase and Neon keep their own app composition and presentation. Theme resolver classes remain ownership-specific
until a cycle-free boundary removes implementation rather than adding forwarding layers. Large cohesive files remain
review signals, not extraction targets by themselves.
