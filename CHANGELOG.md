# Changelog

This project follows a semver-oriented changelog policy. Stable public APIs should only break in a major release, or
with explicit pre-1.0 breaking-change notes while this fork stabilizes. Beta and experimental surfaces may change more
quickly, but the affected entrypoint or module family should be named here.

## Unreleased

### Added

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

### Changed

- Tightened the contributor API inventory gate to require duplicate-free public exports and 100% JSDoc coverage.
