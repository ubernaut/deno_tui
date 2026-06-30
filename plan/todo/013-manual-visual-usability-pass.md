# Manual Visual Usability Pass

## Goal

Drive the main terminal and web interfaces visually and manually, record usability issues, and fix the highest-impact
problems found during real interaction.

## Work

- Exercise API Workbench, visualization launcher, system monitor, Neon Exodus, Three ASCII, and GitHub Pages demos.
- Capture terminal/browser screenshots or deterministic visual output before and after fixes where practical.
- Fix keyboard, mouse, resize, focus, menu, modal, and visual hierarchy issues that appear during the pass.
- Update screenshots or docs if visible output changes materially.

## Acceptance Checks

- Manual/visual findings documented in completion notes.
- Relevant targeted tests added or updated for each fixed issue.
- `deno task visual-smoke`
- `deno task screenshots`
- `deno task health`
