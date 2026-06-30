# Performance Benchmarks

## Goal

Define practical performance expectations for large tables/lists, heavy mouse movement, frequent resize, and many
widgets.

## Work

- Add benchmark cases for high-volume UI paths.
- Document thresholds and fallback guidance.
- Ensure render loops and schedulers expose useful workload telemetry.

## Acceptance Checks

- `deno task benchmark`
- Benchmark catalog updated.
