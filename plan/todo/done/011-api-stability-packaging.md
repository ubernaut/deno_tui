# API Stability And Packaging

## Goal

Make the public surface easier to adopt by separating stable, experimental, demo, terminal-only, and web-only APIs.

## Work

- Mark experimental APIs.
- Add release/changelog policy.
- Clarify package entrypoints and import guidance.
- Keep generated API inventory duplicate-free.

## Acceptance Checks

- `deno task api-inventory -- --check --quiet --fail-duplicates`
- README and docs updated.

## Completion Notes

- Added a package stability manifest that distinguishes the stable terminal entrypoint, beta standalone web entrypoint,
  experimental remote bridge, experimental Three ASCII renderer surface, and internal demo/script surfaces.
- Added the Deno export map for `.`, `./web`, and `./remote`, plus `deno task package-check` to verify the export map
  against the manifest.
- Added API stability, release, and changelog policy docs; created `CHANGELOG.md`; and updated README/repo docs.
- Tightened the health API inventory gate to 100% JSDoc coverage and regenerated `docs/api-reference.md`.
- Verified with `deno task package-check -- --quiet`,
  `deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=1`,
  `deno check mod.ts mod.web.ts mod.remote.ts scripts/package_check.ts scripts/health.ts`,
  `deno test tests/api_stability.test.ts tests/api_inventory.test.ts tests/health_script.test.ts
  tests/web_runtime.test.ts tests/web_remote_terminal.test.ts`,
  `deno task benchmark`, and `git diff --check`.
