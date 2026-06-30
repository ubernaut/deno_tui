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
