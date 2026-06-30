# End-To-End Web And Console Suite

## Goal

Add an end-to-end suite that exercises full console and browser-facing interfaces through their public launch paths, not
only isolated unit controllers.

## Work

- Add reusable helpers for running Deno tasks, CLIs, and deterministic demo entrypoints.
- Cover console apps, report-style demos, web entrypoints, generated Pages assets, and remote/web protocol surfaces.
- Make the suite deterministic enough for CI and health checks.
- Run the suite, fix discovered issues, and document the new workflow.

## Acceptance Checks

- `deno task e2e`
- `deno task web:pages:build`
- `deno task health`

## Completion Notes

- Added `deno task e2e`, a deterministic end-to-end command and artifact gate for finite console reports, web type
  checks/tests, GitHub Pages generation, generated browser bundles, and Three ASCII LUT assets.
- Added reusable e2e inspection/report helpers with Markdown and JSON output.
- Wired the e2e gate into contributor health and documented it in README/testing docs.
- Verified with `deno test tests/e2e_script.test.ts tests/health_script.test.ts`, `deno task e2e`, and
  `deno task health`.
