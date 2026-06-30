# Windowing And Overlay API

## Goal

Promote the best workbench behavior into reusable APIs for windows, panes, overlays, titlebars, shelves, tabs, modals,
popovers, and scrollable workspaces.

## Work

- Extract reusable window/panel models from demo-local code.
- Define deterministic z-order semantics.
- Provide reusable overlay and popover hit testing.
- Keep rendering backend-agnostic.

## Acceptance Checks

- New or expanded window manager tests.
- Demo updated to consume reusable APIs rather than bespoke logic.

## Completed

- Added `src/layout/overlay.ts` with renderer-neutral overlay surfaces, z-ordered hit testing, modal blockers,
  modal-owned child surfaces, outside-click closure, and popover placement.
- Extended `WindowManagerController.layout()` inspections with deterministic `layer`, `zIndex`, and `zOrder` metadata.
- Exported the overlay API through `src/layout/mod.ts` and the root module.
- Updated `examples/window_manager_demo.ts` to consume `OverlayStackController` and `placePopover()`.
- Documented z-order, popover, and overlay stack usage in the README.

## Verification

- `deno test tests/window_manager_usability.test.ts tests/responsive_layout.test.ts tests/windowing_system_launcher.test.ts`
- `deno check examples/window_manager_demo.ts`
- `deno check mod.ts`
- `deno task window-manager`
