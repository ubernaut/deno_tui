# Docs And JSDoc Coverage

## Goal

Raise public API documentation from the current 25% floor toward adopter-ready coverage.

## Work

- Prioritize public app, component, runtime, layout, theme, and renderer modules.
- Add examples to complex controller and app APIs.
- Regenerate `docs/api-reference.md`.

## Acceptance Checks

- `deno task api-reference > docs/api-reference.md`
- `deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=0.50`
