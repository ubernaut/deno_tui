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
