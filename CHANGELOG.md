# Changelog

This project follows a semver-oriented changelog policy. Stable public APIs should only break in a major release, or
with explicit pre-1.0 breaking-change notes while this fork stabilizes. Beta and experimental surfaces may change more
quickly, but the affected entrypoint or module family should be named here.

## Unreleased

### Added

- Added the beta `./app` entrypoint with `TerminalApp`, declarative app definitions, default interaction/lifecycle
  wiring, disposable input handling, component registration, and a focused runnable example.
- Added a headless `TerminalAppPilot` through `./testing` for deterministic key, pointer, paste, focus, resize, command,
  action, settle, wait, and canvas snapshot tests.
- Added parser-backed Markdown documents, terminal rendering, semantic styling, scrolling, and the `Markdown` component
  through the beta `./app` entrypoint.
- Added a renderer-neutral HTML/CSS-style layout foundation with markup parsing, CSS-like cascade, block/flex solving,
  computed layout boxes, and a runnable `deno task html-css-layout` example.
- Added markup widget hydration for common controls, including a default registry, focus order, controller lookup,
  dispatch helpers, and custom registry support.
- Added experimental Kitty graphics protocol helpers for command encoding, payload chunking, tmux passthrough wrapping,
  delete commands, and terminal support detection.
- Added a renderer-neutral graphics surface interface with no-op and Kitty command-surface implementations.
- Added the experimental `./layout/yoga` package subpath for the optional Yoga-backed Flexbox solver.
- Added a package stability manifest for terminal, browser, remote, experimental, and demo-only surfaces.
- Added `deno task package-check` to verify the Deno export map stays aligned with the stability manifest.
- Added `@ubernaut/deno-tui` package metadata, a lean JSR publish allowlist, and `deno task release-check` for strict
  publish dry runs with artifact-size reporting.

### Changed

- Text-row components now allocate and retire visible rows as their terminal height changes, including styled ANSI rows.
- Tightened the contributor API inventory gate to require duplicate-free public exports and 100% JSDoc coverage.
- Made every published entrypoint pass JSR fast-type and declaration-output validation without `--allow-slow-types`.

### Fixed

- Three ASCII now verifies mapped GPU readback before selecting an adapter and falls back to a compatible software
  adapter when the primary device cannot support terminal readback.
- Three ASCII canvas objects keep their startup or last complete grid visible while deferred readback warms, including
  across terminal resizes.
- Screenshot generation serializes GPU access and rejects startup, fallback, sparse, or unavailable renderer captures;
  the Neon Exodus capture now exercises a maximized Three scene.
