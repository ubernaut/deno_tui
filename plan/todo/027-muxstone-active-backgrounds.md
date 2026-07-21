# Muxstone Active Background Program

Status: specified July 21, 2026; implementation starting. Extends the existing metaball desktop background
(`examples/showcases/muxstone/metaball_background.ts`) into a selectable family of animated, theme-aware desktop
backgrounds.

## Requirements (from user direction, July 21 2026)

1. **Matrix glyph rain** — falling glyph columns with brightness tails.
2. **Procedural circuitboard** — snake-like traces routed to large square chips, with animated "bits" (pulses)
   traveling along the traces; the layout itself slowly shifts/re-routes over time.
3. **Biomechanical** — H.R. Giger / T-800 inspired: ribbed spines, undulating membranes, moving pistons.
4. **Jungle leaves** — overlapping foliage layers that sway as if in a breeze and additionally react to window
   movement and mouse position.

Cross-cutting rules:

- Every background inherits the active Muxstone theme (13 themes) — colors derive only from `MuxstoneThemeSpec`
  fields (background, surface, accent, muted, warning, danger, text, border); no hardcoded palettes.
- Every background animates continuously ("move and shift around") but respects the existing input-priority
  throttle (`muxstoneMetaballsMayAdvance`-style gating) so animation never competes with typing or SSH latency.
- Pointer awareness: all fields accept `setPointer`/`clearPointer`; jungle additionally reacts to window rects
  (already provided to `advance` for the metaball window-aversion behavior).
- Deterministic: fields take an injectable seed and clock; no `Math.random()`/`Date.now()` in the hot path so
  frame tests are reproducible.

## Architecture

- Shared cell contract: each background renders to a cell grid `{ char, foreground, bold? }` over the theme
  background color for a given `Rectangle`, mirroring `MuxstoneMetaballField.rasterize` → paint split. One generic
  painter in `app.ts` consumes the grid.
- One module per background in `examples/showcases/muxstone/`:
  `matrix_background.ts`, `circuit_background.ts`, `biomech_background.ts`, `jungle_background.ts`.
- Background registry + selection: `backgroundId` joins `MuxstoneWorkspaceState` (persisted like `themeId`),
  cycled from the UI (prefix command and/or Theme menu neighbor) with `metaballs` remaining the default.
- Tests per module: fake-clock advance determinism, theme-derived colors only, bounded frame cost, pointer/window
  reaction assertions; plus a registry cycle/persistence test.

## Art-direction update (user, July 21 2026)

- Biomech re-targeted to a dense H.R. Giger biomechanical wall: full-coverage interlocking vertebral columns, rib
  arcs, tube bundles, embedded pistons; coverage ≥70% of cells, everything undulating.
- Jungle re-targeted to a dense seamless tropical palm-frond pattern: arcing ribs with fanned leaflets across three
  overlapping depth layers, vibrant success/accent palette, coverage ≥75%.
- New `vaporwave` background (BG-007): outrun sunset — scanline half-disc sun that slowly rises/sets on a ~40s
  cycle, gradient sky with stars and haze bands, and a perspective grid whose horizontal lines continuously drive
  toward the viewer, with pointer parallax on the vanishing point.
- Matrix and circuit densified: roughly one rain drop per column with much faster glyph mutation; circuit chip
  count scales with area (up to 12), 2–8 traces per chip, 2–4 pulses per trace, faster rewires and chip drift.

## Feature ledger

| ID | Feature | Status |
|---|---|---|
| BG-001 | Shared background cell-grid contract + generic painter + registry + persisted `backgroundId` | done (July 21 2026: `background.ts`, `paintAnimatedBackground`, `MuxstoneWorkspaceState.backgroundId`) |
| BG-002 | Matrix glyph rain field | done (`matrix_background.ts`, tested) |
| BG-003 | Procedural circuitboard field (traces, chips, traveling bits, slow re-route) | done (`circuit_background.ts`, tested) |
| BG-004 | Biomechanical field (spines, membranes, pistons) | done (`biomech_background.ts`, tested) |
| BG-005 | Jungle leaves field (breeze sway + window/mouse reaction) | done (`jungle_background.ts`, tested) |
| BG-006 | Selection UI and docs/changelog sync | done for prefix `b` cycle + status feedback + changelog; a Theme-menu background picker remains open |
| BG-007 | Vaporwave/outrun background (scanline sun rise/set cycle, driving grid, pointer parallax, block-glyph style) | done (`vaporwave_background.ts`, tested) |
| BG-008 | Circuit window integration: keep-out routing around windows, staggered re-route on window move, border taps with vias, active-window emphasis (brighter + 2× pulses) | done (`circuit_background.ts`, tested) |
| BG-009 | Skull machine background (comic biomech skull recreation: amber mouse-tracking eyes with seeded blinks, pulsating tube tangle, breathing shading) | in progress (`skull_background.ts`) |
