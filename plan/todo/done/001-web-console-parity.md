# Web Console Parity

## Goal

Bring the web build, especially the API workbench, into practical parity with the terminal workbench for layout,
controls, mouse interactions, keyboard interactions, theming, window controls, modals, and Three ASCII surfaces.

## Work

- Compare `app/api_workbench.ts` with `examples/web/api_workbench_page.ts`.
- Port missing interaction behaviors where practical.
- Ensure clicks, keyboard focus, control manipulation, window-like panes, modals, theme selection, and responsive sizing
  behave consistently.
- Keep browser-specific rendering code modular.

## Acceptance Checks

- `deno task web:demo:check`
- `deno task web:test`
- Targeted `deno check` for touched web files.
- Manual or scripted smoke of the browser build where practical.

## Completion Notes

- Web API workbench now includes Explorer, Inspector, Data, Controls, Logs, and Three ASCII preview panes.
- Browser workbench uses the shared tiled layout solver instead of the older split-only layout.
- Added top menu hit targets, theme dropdown, modal/help/quit workflows, unified button styling, vertical radio and
  checkbox controls, and popover dropdown behavior.
- Verified with `deno task web:demo:check`, `deno task web:test`, and `deno check examples/web/api_workbench_page.ts`.
