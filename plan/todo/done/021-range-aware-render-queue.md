# Range-Aware Render Queue

## Goal

Reduce renderer-side CPU overhead for dense or bursty redraws by allowing canvas objects to queue dirty column ranges
without immediately expanding every changed cell into a `Set<number>`.

## Motivation

Three ASCII frame diffing is now one of the slower CPU-side renderer paths. Focused runs keep the
`render/three-ascii-frame-diff-96x40` case under budget, but profiling by inspection shows the hot path still scans the
grid and expands each changed cell into the legacy per-row `Set<number>` queue. Dense changed runs would be cheaper as
row ranges until the final sink flush.

## Proposed Shape

- Add a renderer-neutral row dirty queue abstraction that can represent sparse cells and contiguous ranges.
- Keep the existing `Set<number>` compatibility path during migration so current `DrawObject` implementations do not
  break.
- Route `DrawObject.queueRerenderRange`, canvas dirty-region routing, and Three ASCII changed-cell diffing through the
  abstraction.
- Teach memory, ANSI stdout, and browser canvas sinks to consume coalesced row ranges without losing per-cell fallback
  behavior.
- Add benchmarks for sparse, dense, clipped, and fractional dirty queues before replacing the legacy set expansion.

## Verification

- `deno task benchmark -- --query three-ascii-frame-diff --repeat 8`
- `deno task benchmark -- --query canvas --repeat 5`
- `deno test -A tests/canvas_* tests/three_ascii_diff.test.ts tests/three_panel_frame.test.ts`
- `deno task health`

## Progress

- Added a tested `queueRerenderRangeInto` helper that centralizes canvas/view clipping and legacy row-set insertion.
- Routed `DrawObject.queueRerenderRange()` through the helper so future range storage can be introduced behind one queue
  boundary.
- Routed the Three ASCII fractional fallback queueing path through the helper to keep clipping behavior shared.
- Added a range-only queue path for dense Three ASCII changed-row runs, plus canvas-side direct range flush support for
  range-aware sinks.
- Updated the Three ASCII frame-diff benchmark cleanup to clear both legacy cell queues and range queues. Focused
  `render/three-ascii-frame-diff-96x40` improved to `1.745ms avg` over 8 repeats on this machine.
- Added `BrowserCellCanvasSink.flushRanges()` so browser-hosted canvases can consume row ranges directly and skip legacy
  cell update allocation for range-aware renderers.
- Added benchmark guardrails for dense range insertion, sparse single-cell insertion, clipped range insertion, and
  fractional clipped cell insertion so queue representation changes can be measured independently from full Three ASCII
  frame diffing.
