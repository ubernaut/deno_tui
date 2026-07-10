# Post-Audit Refactor And Performance Pass

## Outcome

This pass established the measurement and runtime safeguards used by the completed repository-shape work in
`plan/todo/done/022-repo-shape-reduction.md`; the detailed milestone history remains available in Git.

## Retained Results

- Added exact benchmark selectors, repeat support, missing-selector failures, and focused renderer/workbench cases.
- Added live Three ASCII, Three panel, pressure, resize, and PTY visual probes so renderer changes are checked on real
  frame publication rather than helper timings alone.
- Added retained frame, ANSI span, structured-cell blit, grid scaling, and readback caches on measured hot paths.
- Shared renderer-neutral workbench projections across terminal and browser adapters for frames, menus, overlays,
  controls, terminal panes, rows, workspaces, and Three panel policy.
- Moved reusable Three panel lifecycle, pressure, interaction, and projection policy into `src/app`.
- Fixed resize, fullscreen, deferred readback, grid revision, truecolor block output, terminal pressure, and workspace
  persistence regressions encountered during the pass.
- Kept speculative Three ASCII micro-optimizations only when focused benchmarks and live probes supported them.

## Verification Contract Carried Forward

- `deno task health`
- `deno task three-workbench:startup-probe`
- `deno task three-ascii:live-probe -- --frames 45 --glyphs blocks --max-cells 960 --check --max-average-ms 40`
- Relevant API Workbench PTY resize/fullscreen visual smoke tasks for layout or rendering changes

## Follow-Up

The work produced strong runtime evidence but also accumulated an append-only progress log and too many narrow helper
boundaries. Repository-shape reduction now uses net deletion, ownership, public-surface reduction, and measured runtime
improvement as its gates instead of file count alone.
