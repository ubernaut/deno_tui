# Deno TUI Robust Library Plan

This plan tracks the remaining work to make this fork a robust curses-style TUI library for Deno while keeping the
browser build in parity with the terminal interface.

## Operating Rules

- Keep active work items in `plan/todo/`.
- Move completed work items into `plan/todo/done/` when the acceptance checks pass.
- Make a local commit at each clean breaking point.
- Push after externally useful milestones, starting with web parity plus the GitHub Pages build.
- Prefer reusable library APIs over demo-local behavior.

## Current Priorities

1. Bring the standalone web/API workbench experience into practical parity with the console workbench.
2. Build GitHub Pages docs from the updated web demos and push the result.
3. Promote workbench/windowing behavior into reusable curses-grade primitives.
4. Harden terminal portability, interaction contracts, docs, visual regression, forms, theming, performance, and API
   stability.

## Completion Standard

A task is complete when its todo file acceptance checks pass, relevant tests or build checks pass, and the work has a
commit that can be reviewed independently.
