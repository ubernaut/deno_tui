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

## Completion Notes

- Split the benchmark catalog into reusable cases that cover large table/list navigation, dense mouse hit testing,
  resize-heavy layout, render-loop stepping, scheduler batch pressure, and standard theme/widget coverage.
- Added scheduler and render-loop telemetry for completed/failed/cancelled work, high-water marks, frame budgets,
  average/max frame duration, and over-budget frame counts.
- Cached mouse-router z-order ordering so repeated hit tests do not re-sort every target, bringing the 500-target
  routing benchmark comfortably under threshold.
- Updated performance docs and README guidance for benchmark thresholds, fallback strategies, and runtime telemetry.
- Verified with
  `deno check mod.ts scripts/benchmark.ts scripts/benchmark_cases.ts examples/runtime_workloads.ts
  examples/theme_workspace.ts examples/app_plugin_catalog.ts`,
  `deno test tests/runtime.test.ts tests/benchmark.test.ts
  tests/dashboard_widgets.test.ts tests/app_primitives.test.ts`,
  `deno task benchmark -- --list`, `deno task benchmark`, and `git diff --check`.
