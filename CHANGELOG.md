# Changelog

This project follows a semver-oriented changelog policy. Stable public APIs should only break in a major release, or
with explicit pre-1.0 breaking-change notes while this fork stabilizes. Beta and experimental surfaces may change more
quickly, but the affected entrypoint or module family should be named here.

## Unreleased

### Added

- Added a package stability manifest for terminal, browser, remote, experimental, and demo-only surfaces.
- Added `deno task package-check` to verify the Deno export map stays aligned with the stability manifest.

### Changed

- Tightened the contributor API inventory gate to require duplicate-free public exports and 100% JSDoc coverage.
