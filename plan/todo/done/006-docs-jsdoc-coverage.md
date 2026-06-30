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

## Completed

- Added JSDoc coverage across public app, component, runtime, layout, theme, canvas, testing, utility, and Three ASCII
  modules.
- Regenerated `docs/api-reference.md` from the public re-export graph.
- Raised API inventory documentation coverage from 27.29% to 100.00% for the current exported symbol set.
- Preserved zero duplicate public symbols and zero missing re-export targets.

## Verification

- `deno task api-reference > docs/api-reference.md`
- `deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=0.50`
- `deno check mod.ts`
