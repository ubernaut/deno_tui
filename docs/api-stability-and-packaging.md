# API Stability And Packaging

This fork now treats the package surface as an explicit contract. The source of truth is `src/api_stability.ts`; the
Deno export map in `deno.jsonc`, README guidance, and release notes should stay aligned with that manifest.

## Entrypoints

| Import target   | Source                       | Runtime  | Stability    | Use it for                                                                                                                     |
| --------------- | ---------------------------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `.`             | `mod.ts`                     | terminal | stable       | Full Deno terminal apps, reusable widgets, app primitives, themes, runtime helpers, tests, and benchmarks.                     |
| `./web`         | `mod.web.ts`                 | browser  | beta         | Standalone browser bundles, GitHub Pages demos, Canvas2D/DOM hosts, browser input, IndexedDB, Workers, and shared controllers. |
| `./remote`      | `mod.remote.ts`              | remote   | experimental | Browser clients and server bridges that connect transports to hosted terminal session handles.                                 |
| `./three-ascii` | `mod.three_ascii.ts`         | shared   | experimental | Focused Acerola-style Three.js/WebGPU ASCII renderer APIs, glyph/block/mixed modes, presets, and renderer options.             |
| `./layout/yoga` | `src/layout/solvers/yoga.ts` | shared   | experimental | Optional Yoga-backed Flexbox solving for HTML/CSS-style layout trees.                                                          |

Local development imports use relative paths:

```ts
import { createThemeProvider, Tui } from "./mod.ts";
import { createWebTui } from "./mod.web.ts";
import { RemoteTerminalClient } from "./mod.remote.ts";
import { createDefaultAsciiOptions } from "./mod.three_ascii.ts";
import { yogaLayoutSolver } from "./src/layout/solvers/yoga.ts";
```

Published package imports should use the same subpaths:

```ts
import { Tui } from "jsr:@scope/package";
import { createWebTui } from "jsr:@scope/package/web";
import { RemoteTerminalClient } from "jsr:@scope/package/remote";
import { createDefaultAsciiOptions } from "jsr:@scope/package/three-ascii";
import { yogaLayoutSolver } from "jsr:@scope/package/layout/yoga";
```

The package is not pinned to a public JSR scope in this repository yet. Choose the final scope during publication, then
update the import examples and release notes.

## Import Guidance

Application authors should start with the narrowest runtime entrypoint that matches where their app runs:

- Use `.` for Deno terminal applications, reusable terminal widgets, themes, app commands, testing helpers, and
  terminal-rendered Three ASCII widgets.
- Use `./web` for standalone browser packages, GitHub Pages demos, Canvas2D/DOM hosts, browser input, IndexedDB-backed
  state, and Worker-friendly controllers.
- Use `./remote` only when building a browser client or bridge for a hosted terminal session.
- Use `./three-ascii` for renderer-focused integrations that need the Acerola-style node, glyph/block/mixed modes,
  presets, or shared ASCII options without importing the full terminal package.
- Use `./layout/yoga` only when the optional Yoga dependency is acceptable and Flexbox parity matters more than a
  dependency-free layout solver.

Framework authors can import the same entrypoints, then layer their own submodules behind project-local shims. Avoid
importing from `app/*`, `examples/*`, or `scripts/*`; those files demonstrate behavior and are intentionally not
semver-protected package surfaces.

## Stability Tiers

- **Stable:** Semver-protected public API. Breaking changes require a major release, or an explicit pre-1.0 breaking
  change note while this fork is still stabilizing.
- **Beta:** Intended for adoption, but still expected to evolve. Breaking changes are allowed in minor releases when the
  changelog includes migration notes.
- **Experimental:** Useful and public, but not yet contract-stable. The changelog must call out affected experimental
  surfaces when behavior changes.
- **Internal:** Demo apps, examples, scripts, generated assets, and contributor tooling. These are not package
  entrypoints and may change to support the library.

Current marked surfaces:

- `mod.ts`: stable terminal package.
- `mod.web.ts`: beta standalone browser package.
- `mod.remote.ts`: experimental remote-terminal client and bridge.
- `mod.three_ascii.ts`: experimental focused Three ASCII renderer package.
- `src/layout/solvers/yoga.ts`: experimental optional Yoga-backed Flexbox solver.
- `src/three_ascii/*`: experimental renderer internals and presets, even when re-exported for demos.
- `src/runtime/graphics_surface.ts`: experimental raster graphics surface abstraction.
- `src/runtime/kitty_graphics.ts`: experimental Kitty terminal graphics protocol helpers.
- `src/runtime/pty_backend.ts`: experimental optional PTY adapter over Sigma PTY FFI. It is lazy and provider-based so
  normal terminal imports do not require native FFI setup.
- `app/*`, `examples/*`, and `scripts/*`: internal/demo surfaces.

## Release Policy

Every externally useful release should update `CHANGELOG.md`. Use these sections when relevant:

- `Added` for new public APIs, widgets, demos, package subpaths, and platform support.
- `Changed` for behavioral updates and beta/experimental API movement.
- `Deprecated` for stable APIs that will be removed or renamed later.
- `Removed` for public removals.
- `Fixed` for bug fixes and compatibility repairs.
- `Security` for security-sensitive changes.

Before a release, run:

```bash
deno fmt --check
deno check mod.ts mod.web.ts mod.remote.ts
deno task package-check -- --quiet
deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=1 --baseline=docs/api-stable-baseline.json
deno task benchmark
deno test
```

`deno task package-check` compares `deno.jsonc` exports with `packageEntrypoints`, verifies the entrypoint files exist,
and reports drift separately for stable, beta, experimental, and internal tiers.
`deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=1
--baseline=docs/api-stable-baseline.json`
enforces a duplicate-free stable re-export graph with 100% JSDoc coverage and fails if the stable root API changes
without an intentional baseline update. `deno task api-reference > docs/api-reference.md` generates the full
stable/beta/experimental reference and should continue to show 100% documentation coverage for every public entrypoint.

## Adding A Public API

1. Add implementation under the owning module family.
2. Add focused tests for behavior and any cross-runtime expectations.
3. Add JSDoc before exporting; public docs coverage is expected to remain 100%.
4. Re-export through the appropriate module entrypoint.
5. If the API creates a new package surface or changes stability expectations, update `src/api_stability.ts`,
   `deno.jsonc`, this document, and `CHANGELOG.md`.
6. If the change intentionally adds or removes a stable root export, regenerate `docs/api-stable-baseline.json` with
   `deno run -A ./scripts/api_inventory.ts mod.ts --update-baseline=docs/api-stable-baseline.json --quiet`.
7. Regenerate `docs/api-reference.md` with `deno task api-reference > docs/api-reference.md`.
