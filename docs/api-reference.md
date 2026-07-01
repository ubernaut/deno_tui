# API Reference

This document is generated from every public package entrypoint in the Deno export map. It is intended as a complete map
of stable, beta, and experimental modules and exported symbols that make up the package API.

## Summary

- Entrypoints: 5
- Module visits: 437
- Re-export declarations: 432
- Exported symbols: 3690
- Documented symbols: 3690
- Documentation coverage: 100.00%
- Duplicate symbol groups: 0
- Missing targets: 0

## Entrypoints

| Specifier       | Path                           | Runtime  | Stability    | Modules | Symbols |    Docs |
| --------------- | ------------------------------ | -------- | ------------ | ------: | ------: | ------: |
| `.`             | `./mod.ts`                     | terminal | stable       |     222 |    1864 | 100.00% |
| `./web`         | `./mod.web.ts`                 | browser  | beta         |     202 |    1732 | 100.00% |
| `./remote`      | `./mod.remote.ts`              | remote   | experimental |       4 |      38 | 100.00% |
| `./three-ascii` | `./mod.three_ascii.ts`         | shared   | experimental |       8 |      53 | 100.00% |
| `./layout/yoga` | `./src/layout/solvers/yoga.ts` | shared   | experimental |       1 |       3 | 100.00% |

## Entrypoint .

Full terminal package with core TUI runtime, widgets, app primitives, themes, runtime helpers, and demos.

- Path: `./mod.ts`
- Runtime: terminal
- Stability: stable

### Summary

- Entrypoint: `mod.ts`
- Modules: 222
- Re-export declarations: 221
- Exported symbols: 1864
- Documented symbols: 1864
- Documentation coverage: 100.00%
- Duplicate symbols: 0
- Missing targets: 0

### Module Index

| Module                                                                                  | Re-exports | Symbols | Documented |
| --------------------------------------------------------------------------------------- | ---------: | ------: | ---------: |
| [`mod.ts`](#mod-ts)                                                                     |         33 |       0 |          0 |
| [`src/api_stability.ts`](#src-api-stability-ts)                                         |          0 |      14 |         14 |
| [`src/app/actions.ts`](#src-app-actions-ts)                                             |          0 |       7 |          7 |
| [`src/app/app.ts`](#src-app-app-ts)                                                     |          0 |      13 |         13 |
| [`src/app/button_commands.ts`](#src-app-button-commands-ts)                             |          0 |       6 |          6 |
| [`src/app/checkbox_commands.ts`](#src-app-checkbox-commands-ts)                         |          0 |       6 |          6 |
| [`src/app/combobox_commands.ts`](#src-app-combobox-commands-ts)                         |          0 |       6 |          6 |
| [`src/app/command_bindings.ts`](#src-app-command-bindings-ts)                           |          0 |      26 |         26 |
| [`src/app/command_search_index.ts`](#src-app-command-search-index-ts)                   |          0 |      11 |         11 |
| [`src/app/commands.ts`](#src-app-commands-ts)                                           |          0 |       8 |          8 |
| [`src/app/component_commands.ts`](#src-app-component-commands-ts)                       |          0 |       5 |          5 |
| [`src/app/data_query_bindings.ts`](#src-app-data-query-bindings-ts)                     |          0 |      12 |         12 |
| [`src/app/data_query_commands.ts`](#src-app-data-query-commands-ts)                     |          0 |       7 |          7 |
| [`src/app/data_query_plugin.ts`](#src-app-data-query-plugin-ts)                         |          0 |       5 |          5 |
| [`src/app/data_table_commands.ts`](#src-app-data-table-commands-ts)                     |          0 |       4 |          4 |
| [`src/app/disposables.ts`](#src-app-disposables-ts)                                     |          0 |       6 |          6 |
| [`src/app/focus_commands.ts`](#src-app-focus-commands-ts)                               |          0 |       7 |          7 |
| [`src/app/form_bindings.ts`](#src-app-form-bindings-ts)                                 |          0 |       2 |          2 |
| [`src/app/form_commands.ts`](#src-app-form-commands-ts)                                 |          0 |       7 |          7 |
| [`src/app/forms.ts`](#src-app-forms-ts)                                                 |          0 |      17 |         17 |
| [`src/app/history_bindings.ts`](#src-app-history-bindings-ts)                           |          0 |       6 |          6 |
| [`src/app/history.ts`](#src-app-history-ts)                                             |          0 |       5 |          5 |
| [`src/app/hit_targets.ts`](#src-app-hit-targets-ts)                                     |          0 |       6 |          6 |
| [`src/app/input_commands.ts`](#src-app-input-commands-ts)                               |          0 |       6 |          6 |
| [`src/app/list_commands.ts`](#src-app-list-commands-ts)                                 |          0 |       6 |          6 |
| [`src/app/log_viewer_commands.ts`](#src-app-log-viewer-commands-ts)                     |          0 |       6 |          6 |
| [`src/app/menu_bar_commands.ts`](#src-app-menu-bar-commands-ts)                         |          0 |       6 |          6 |
| [`src/app/metric_series_commands.ts`](#src-app-metric-series-commands-ts)               |          0 |       6 |          6 |
| [`src/app/mod.ts`](#src-app-mod-ts)                                                     |         65 |       0 |          0 |
| [`src/app/mouse_bindings.ts`](#src-app-mouse-bindings-ts)                               |          0 |      10 |         10 |
| [`src/app/pad_commands.ts`](#src-app-pad-commands-ts)                                   |          0 |       6 |          6 |
| [`src/app/plugins.ts`](#src-app-plugins-ts)                                             |          0 |      17 |         17 |
| [`src/app/progress_bar_commands.ts`](#src-app-progress-bar-commands-ts)                 |          0 |       6 |          6 |
| [`src/app/radio_group_commands.ts`](#src-app-radio-group-commands-ts)                   |          0 |       6 |          6 |
| [`src/app/route_bindings.ts`](#src-app-route-bindings-ts)                               |          0 |       9 |          9 |
| [`src/app/router.ts`](#src-app-router-ts)                                               |          0 |       5 |          5 |
| [`src/app/runtime_profile_commands.ts`](#src-app-runtime-profile-commands-ts)           |          0 |       5 |          5 |
| [`src/app/runtime_profile_plugin.ts`](#src-app-runtime-profile-plugin-ts)               |          0 |       5 |          5 |
| [`src/app/runtime_renderer_commands.ts`](#src-app-runtime-renderer-commands-ts)         |          0 |       5 |          5 |
| [`src/app/runtime_renderer_plugin.ts`](#src-app-runtime-renderer-plugin-ts)             |          0 |       5 |          5 |
| [`src/app/runtime_workload_commands.ts`](#src-app-runtime-workload-commands-ts)         |          0 |       5 |          5 |
| [`src/app/scroll_area_commands.ts`](#src-app-scroll-area-commands-ts)                   |          0 |       6 |          6 |
| [`src/app/selection_bindings.ts`](#src-app-selection-bindings-ts)                       |          0 |       8 |          8 |
| [`src/app/settings_bindings.ts`](#src-app-settings-bindings-ts)                         |          0 |      21 |         21 |
| [`src/app/settings_commands.ts`](#src-app-settings-commands-ts)                         |          0 |       5 |          5 |
| [`src/app/settings.ts`](#src-app-settings-ts)                                           |          0 |       5 |          5 |
| [`src/app/slider_commands.ts`](#src-app-slider-commands-ts)                             |          0 |       6 |          6 |
| [`src/app/split_pane_commands.ts`](#src-app-split-pane-commands-ts)                     |          0 |       7 |          7 |
| [`src/app/stepper_commands.ts`](#src-app-stepper-commands-ts)                           |          0 |       6 |          6 |
| [`src/app/surface_bindings.ts`](#src-app-surface-bindings-ts)                           |          0 |       2 |          2 |
| [`src/app/table_commands.ts`](#src-app-table-commands-ts)                               |          0 |       6 |          6 |
| [`src/app/tabs_commands.ts`](#src-app-tabs-commands-ts)                                 |          0 |       6 |          6 |
| [`src/app/terminal_commands.ts`](#src-app-terminal-commands-ts)                         |          0 |      12 |         12 |
| [`src/app/terminal_input.ts`](#src-app-terminal-input-ts)                               |          0 |       9 |          9 |
| [`src/app/terminal_window_bindings.ts`](#src-app-terminal-window-bindings-ts)           |          0 |       5 |          5 |
| [`src/app/textbox_commands.ts`](#src-app-textbox-commands-ts)                           |          0 |       6 |          6 |
| [`src/app/theme_commands.ts`](#src-app-theme-commands-ts)                               |          0 |      10 |         10 |
| [`src/app/theme_engine_commands.ts`](#src-app-theme-engine-commands-ts)                 |          0 |       9 |          9 |
| [`src/app/theme_pipeline_commands.ts`](#src-app-theme-pipeline-commands-ts)             |          0 |       5 |          5 |
| [`src/app/theme_plugin.ts`](#src-app-theme-plugin-ts)                                   |          0 |       8 |          8 |
| [`src/app/theme_workspace_plugin.ts`](#src-app-theme-workspace-plugin-ts)               |          0 |       5 |          5 |
| [`src/app/toast_commands.ts`](#src-app-toast-commands-ts)                               |          0 |       6 |          6 |
| [`src/app/tree_commands.ts`](#src-app-tree-commands-ts)                                 |          0 |       6 |          6 |
| [`src/app/window_manager_commands.ts`](#src-app-window-manager-commands-ts)             |          0 |       8 |          8 |
| [`src/app/workbench_frame.ts`](#src-app-workbench-frame-ts)                             |          0 |      13 |         13 |
| [`src/app/workbench_menu.ts`](#src-app-workbench-menu-ts)                               |          0 |       5 |          5 |
| [`src/app/workbench_window_registry.ts`](#src-app-workbench-window-registry-ts)         |          0 |      13 |         13 |
| [`src/app/workbench_workspace.ts`](#src-app-workbench-workspace-ts)                     |          0 |      18 |         18 |
| [`src/canvas/box.ts`](#src-canvas-box-ts)                                               |          0 |       2 |          2 |
| [`src/canvas/canvas.ts`](#src-canvas-canvas-ts)                                         |          0 |       4 |          4 |
| [`src/canvas/dirty_region.ts`](#src-canvas-dirty-region-ts)                             |          0 |       2 |          2 |
| [`src/canvas/draw_object.ts`](#src-canvas-draw-object-ts)                               |          0 |       2 |          2 |
| [`src/canvas/mod.ts`](#src-canvas-mod-ts)                                               |          8 |       0 |          0 |
| [`src/canvas/sink.ts`](#src-canvas-sink-ts)                                             |          0 |       8 |          8 |
| [`src/canvas/spatial_index.ts`](#src-canvas-spatial-index-ts)                           |          0 |       2 |          2 |
| [`src/canvas/text.ts`](#src-canvas-text-ts)                                             |          0 |       3 |          3 |
| [`src/canvas/three_ascii.ts`](#src-canvas-three-ascii-ts)                               |          0 |       6 |          6 |
| [`src/component.ts`](#src-component-ts)                                                 |          0 |       4 |          4 |
| [`src/components/box.ts`](#src-components-box-ts)                                       |          0 |       1 |          1 |
| [`src/components/breadcrumbs.ts`](#src-components-breadcrumbs-ts)                       |          0 |       4 |          4 |
| [`src/components/button.ts`](#src-components-button-ts)                                 |          0 |       5 |          5 |
| [`src/components/catalog.ts`](#src-components-catalog-ts)                               |          0 |      19 |         19 |
| [`src/components/chart.ts`](#src-components-chart-ts)                                   |          0 |       3 |          3 |
| [`src/components/checkbox.ts`](#src-components-checkbox-ts)                             |          0 |       7 |          7 |
| [`src/components/combobox.ts`](#src-components-combobox-ts)                             |          0 |       7 |          7 |
| [`src/components/command_palette.ts`](#src-components-command-palette-ts)               |          0 |      12 |         12 |
| [`src/components/context_menu.ts`](#src-components-context-menu-ts)                     |          0 |      10 |         10 |
| [`src/components/data_table.ts`](#src-components-data-table-ts)                         |          0 |      15 |         15 |
| [`src/components/empty_state.ts`](#src-components-empty-state-ts)                       |          0 |       4 |          4 |
| [`src/components/file_explorer.ts`](#src-components-file-explorer-ts)                   |          0 |       7 |          7 |
| [`src/components/frame.ts`](#src-components-frame-ts)                                   |          0 |       4 |          4 |
| [`src/components/gauge.ts`](#src-components-gauge-ts)                                   |          0 |       3 |          3 |
| [`src/components/input.ts`](#src-components-input-ts)                                   |          0 |       8 |          8 |
| [`src/components/interaction.ts`](#src-components-interaction-ts)                       |          0 |       7 |          7 |
| [`src/components/key_help.ts`](#src-components-key-help-ts)                             |          0 |       3 |          3 |
| [`src/components/label.ts`](#src-components-label-ts)                                   |          0 |       6 |          6 |
| [`src/components/list.ts`](#src-components-list-ts)                                     |          0 |       8 |          8 |
| [`src/components/log_viewer.ts`](#src-components-log-viewer-ts)                         |          0 |       6 |          6 |
| [`src/components/menu_bar.ts`](#src-components-menu-bar-ts)                             |          0 |      10 |         10 |
| [`src/components/metric_series.ts`](#src-components-metric-series-ts)                   |          0 |      10 |         10 |
| [`src/components/mod.ts`](#src-components-mod-ts)                                       |         41 |       0 |          0 |
| [`src/components/modal.ts`](#src-components-modal-ts)                                   |          0 |      11 |         11 |
| [`src/components/pad.ts`](#src-components-pad-ts)                                       |          0 |      13 |         13 |
| [`src/components/progressbar.ts`](#src-components-progressbar-ts)                       |          0 |      15 |         15 |
| [`src/components/radio_group.ts`](#src-components-radio-group-ts)                       |          0 |      11 |         11 |
| [`src/components/scroll_area.ts`](#src-components-scroll-area-ts)                       |          0 |      13 |         13 |
| [`src/components/slider.ts`](#src-components-slider-ts)                                 |          0 |      14 |         14 |
| [`src/components/sparkline.ts`](#src-components-sparkline-ts)                           |          0 |       3 |          3 |
| [`src/components/spinner.ts`](#src-components-spinner-ts)                               |          0 |       6 |          6 |
| [`src/components/statusbar.ts`](#src-components-statusbar-ts)                           |          0 |       3 |          3 |
| [`src/components/stepper.ts`](#src-components-stepper-ts)                               |          0 |      11 |         11 |
| [`src/components/table.ts`](#src-components-table-ts)                                   |          0 |      12 |         12 |
| [`src/components/tabs.ts`](#src-components-tabs-ts)                                     |          0 |      10 |         10 |
| [`src/components/terminal_output.ts`](#src-components-terminal-output-ts)               |          0 |       7 |          7 |
| [`src/components/text.ts`](#src-components-text-ts)                                     |          0 |       2 |          2 |
| [`src/components/textbox.ts`](#src-components-textbox-ts)                               |          0 |      14 |         14 |
| [`src/components/three_ascii.ts`](#src-components-three-ascii-ts)                       |          0 |       2 |          2 |
| [`src/components/toast.ts`](#src-components-toast-ts)                                   |          0 |       8 |          8 |
| [`src/components/tree.ts`](#src-components-tree-ts)                                     |          0 |      11 |         11 |
| [`src/components/virtual_list.ts`](#src-components-virtual-list-ts)                     |          0 |       8 |          8 |
| [`src/controls.ts`](#src-controls-ts)                                                   |          0 |       2 |          2 |
| [`src/event_emitter.ts`](#src-event-emitter-ts)                                         |          0 |       5 |          5 |
| [`src/focus.ts`](#src-focus-ts)                                                         |          0 |       7 |          7 |
| [`src/grwizard_themes.ts`](#src-grwizard-themes-ts)                                     |          0 |       5 |          5 |
| [`src/input_reader/mod.ts`](#src-input-reader-mod-ts)                                   |          0 |       2 |          2 |
| [`src/input.ts`](#src-input-ts)                                                         |          0 |       1 |          1 |
| [`src/keymap.ts`](#src-keymap-ts)                                                       |          0 |       6 |          6 |
| [`src/layout/engine.ts`](#src-layout-engine-ts)                                         |          0 |       6 |          6 |
| [`src/layout/errors.ts`](#src-layout-errors-ts)                                         |          0 |       2 |          2 |
| [`src/layout/flex_layout.ts`](#src-layout-flex-layout-ts)                               |          0 |       3 |          3 |
| [`src/layout/grid_layout.ts`](#src-layout-grid-layout-ts)                               |          0 |       3 |          3 |
| [`src/layout/horizontal_layout.ts`](#src-layout-horizontal-layout-ts)                   |          0 |       1 |          1 |
| [`src/layout/measurement.ts`](#src-layout-measurement-ts)                               |          0 |       4 |          4 |
| [`src/layout/mod.ts`](#src-layout-mod-ts)                                               |         16 |       0 |          0 |
| [`src/layout/overlay.ts`](#src-layout-overlay-ts)                                       |          0 |      19 |         19 |
| [`src/layout/recipe.ts`](#src-layout-recipe-ts)                                         |          0 |      18 |         18 |
| [`src/layout/responsive.ts`](#src-layout-responsive-ts)                                 |          0 |      14 |         14 |
| [`src/layout/solver.ts`](#src-layout-solver-ts)                                         |          0 |      13 |         13 |
| [`src/layout/solvers/simple.ts`](#src-layout-solvers-simple-ts)                         |          0 |       3 |          3 |
| [`src/layout/split_pane.ts`](#src-layout-split-pane-ts)                                 |          0 |      10 |         10 |
| [`src/layout/style.ts`](#src-layout-style-ts)                                           |          0 |      31 |         31 |
| [`src/layout/types.ts`](#src-layout-types-ts)                                           |          0 |       3 |          3 |
| [`src/layout/vertical_layout.ts`](#src-layout-vertical-layout-ts)                       |          0 |       1 |          1 |
| [`src/layout/window_manager.ts`](#src-layout-window-manager-ts)                         |          0 |      10 |         10 |
| [`src/markup/cascade.ts`](#src-markup-cascade-ts)                                       |          0 |       7 |          7 |
| [`src/markup/css.ts`](#src-markup-css-ts)                                               |          0 |      11 |         11 |
| [`src/markup/demo_fixtures.ts`](#src-markup-demo-fixtures-ts)                           |          0 |       7 |          7 |
| [`src/markup/html.ts`](#src-markup-html-ts)                                             |          0 |       3 |          3 |
| [`src/markup/hydrate.ts`](#src-markup-hydrate-ts)                                       |          0 |       3 |          3 |
| [`src/markup/mod.ts`](#src-markup-mod-ts)                                               |          6 |       0 |          0 |
| [`src/markup/widgets.ts`](#src-markup-widgets-ts)                                       |          0 |      15 |         15 |
| [`src/perf/benchmark.ts`](#src-perf-benchmark-ts)                                       |          0 |      19 |         19 |
| [`src/perf/mod.ts`](#src-perf-mod-ts)                                                   |          1 |       0 |          0 |
| [`src/runtime/capabilities.ts`](#src-runtime-capabilities-ts)                           |          0 |      16 |         16 |
| [`src/runtime/data_pipeline_bindings.ts`](#src-runtime-data-pipeline-bindings-ts)       |          0 |       4 |          4 |
| [`src/runtime/data_pipeline.ts`](#src-runtime-data-pipeline-ts)                         |          0 |      19 |         19 |
| [`src/runtime/data_query.ts`](#src-runtime-data-query-ts)                               |          0 |      15 |         15 |
| [`src/runtime/diagnostics.ts`](#src-runtime-diagnostics-ts)                             |          0 |      12 |         12 |
| [`src/runtime/graphics_surface.ts`](#src-runtime-graphics-surface-ts)                   |          0 |      15 |         15 |
| [`src/runtime/kitty_graphics.ts`](#src-runtime-kitty-graphics-ts)                       |          0 |      25 |         25 |
| [`src/runtime/mod.ts`](#src-runtime-mod-ts)                                             |         27 |       0 |          0 |
| [`src/runtime/process_session.ts`](#src-runtime-process-session-ts)                     |          0 |       9 |          9 |
| [`src/runtime/profiles.ts`](#src-runtime-profiles-ts)                                   |          0 |      24 |         24 |
| [`src/runtime/pty_backend.ts`](#src-runtime-pty-backend-ts)                             |          0 |      12 |         12 |
| [`src/runtime/render_loop.ts`](#src-runtime-render-loop-ts)                             |          0 |      10 |         10 |
| [`src/runtime/renderer_backends.ts`](#src-runtime-renderer-backends-ts)                 |          0 |      24 |         24 |
| [`src/runtime/resource_bindings.ts`](#src-runtime-resource-bindings-ts)                 |          0 |       4 |          4 |
| [`src/runtime/resource.ts`](#src-runtime-resource-ts)                                   |          0 |      14 |         14 |
| [`src/runtime/scheduler.ts`](#src-runtime-scheduler-ts)                                 |          0 |      13 |         13 |
| [`src/runtime/storage.ts`](#src-runtime-storage-ts)                                     |          0 |       9 |          9 |
| [`src/runtime/telemetry.ts`](#src-runtime-telemetry-ts)                                 |          0 |      15 |         15 |
| [`src/runtime/terminal_backend_registry.ts`](#src-runtime-terminal-backend-registry-ts) |          0 |       9 |          9 |
| [`src/runtime/terminal_backend.ts`](#src-runtime-terminal-backend-ts)                   |          0 |       9 |          9 |
| [`src/runtime/terminal_capabilities.ts`](#src-runtime-terminal-capabilities-ts)         |          0 |      27 |         27 |
| [`src/runtime/terminal_screen.ts`](#src-runtime-terminal-screen-ts)                     |          0 |       6 |          6 |
| [`src/runtime/terminal_session.ts`](#src-runtime-terminal-session-ts)                   |          0 |       8 |          8 |
| [`src/runtime/terminal_shell.ts`](#src-runtime-terminal-shell-ts)                       |          0 |       3 |          3 |
| [`src/runtime/terminal_status.ts`](#src-runtime-terminal-status-ts)                     |          0 |       8 |          8 |
| [`src/runtime/terminal_templates.ts`](#src-runtime-terminal-templates-ts)               |          0 |      22 |         22 |
| [`src/runtime/terminal_workspace.ts`](#src-runtime-terminal-workspace-ts)               |          0 |      18 |         18 |
| [`src/runtime/worker_pool.ts`](#src-runtime-worker-pool-ts)                             |          0 |      12 |         12 |
| [`src/selection.ts`](#src-selection-ts)                                                 |          0 |      16 |         16 |
| [`src/signals/computed.ts`](#src-signals-computed-ts)                                   |          0 |       3 |          3 |
| [`src/signals/dependency_tracking.ts`](#src-signals-dependency-tracking-ts)             |          0 |       3 |          3 |
| [`src/signals/effect.ts`](#src-signals-effect-ts)                                       |          0 |       3 |          3 |
| [`src/signals/flusher.ts`](#src-signals-flusher-ts)                                     |          0 |       1 |          1 |
| [`src/signals/lazy_computed.ts`](#src-signals-lazy-computed-ts)                         |          0 |       1 |          1 |
| [`src/signals/lazy_effect.ts`](#src-signals-lazy-effect-ts)                             |          0 |       1 |          1 |
| [`src/signals/mod.ts`](#src-signals-mod-ts)                                             |          9 |       0 |          0 |
| [`src/signals/reactivity.ts`](#src-signals-reactivity-ts)                               |          0 |      13 |         13 |
| [`src/signals/signal.ts`](#src-signals-signal-ts)                                       |          0 |      11 |         11 |
| [`src/signals/types.ts`](#src-signals-types-ts)                                         |          0 |       4 |          4 |
| [`src/testing/input.ts`](#src-testing-input-ts)                                         |          0 |       7 |          7 |
| [`src/testing/mod.ts`](#src-testing-mod-ts)                                             |          2 |       0 |          0 |
| [`src/testing/snapshot.ts`](#src-testing-snapshot-ts)                                   |          0 |      15 |         15 |
| [`src/theme_binding.ts`](#src-theme-binding-ts)                                         |          0 |       8 |          8 |
| [`src/theme_engine_cache.ts`](#src-theme-engine-cache-ts)                               |          0 |       6 |          6 |
| [`src/theme_engine_factory.ts`](#src-theme-engine-factory-ts)                           |          0 |      19 |         19 |
| [`src/theme_engine_pipeline.ts`](#src-theme-engine-pipeline-ts)                         |          0 |      12 |         12 |
| [`src/theme_gallery.ts`](#src-theme-gallery-ts)                                         |          0 |      11 |         11 |
| [`src/theme_resolver.ts`](#src-theme-resolver-ts)                                       |          0 |      15 |         15 |
| [`src/theme_workspace.ts`](#src-theme-workspace-ts)                                     |          0 |       7 |          7 |
| [`src/theme.ts`](#src-theme-ts)                                                         |          0 |     115 |        115 |
| [`src/three_ascii/AcerolaAsciiNode.ts`](#src-three-ascii-acerolaasciinode-ts)           |          0 |       2 |          2 |
| [`src/three_ascii/demo_presets.ts`](#src-three-ascii-demo-presets-ts)                   |          0 |      14 |         14 |
| [`src/three_ascii/glyphs.ts`](#src-three-ascii-glyphs-ts)                               |          0 |      13 |         13 |
| [`src/three_ascii/mod.ts`](#src-three-ascii-mod-ts)                                     |          6 |       0 |          0 |
| [`src/three_ascii/options.ts`](#src-three-ascii-options-ts)                             |          0 |      15 |         15 |
| [`src/three_ascii/renderer.ts`](#src-three-ascii-renderer-ts)                           |          0 |       7 |          7 |
| [`src/three_ascii/webgpu_compat.ts`](#src-three-ascii-webgpu-compat-ts)                 |          0 |       2 |          2 |
| [`src/tui.ts`](#src-tui-ts)                                                             |          0 |       2 |          2 |
| [`src/types.ts`](#src-types-ts)                                                         |          0 |       8 |          8 |
| [`src/utils/ansi_codes.ts`](#src-utils-ansi-codes-ts)                                   |          0 |      12 |         12 |
| [`src/utils/async.ts`](#src-utils-async-ts)                                             |          0 |       1 |          1 |
| [`src/utils/component.ts`](#src-utils-component-ts)                                     |          0 |       2 |          2 |
| [`src/utils/mod.ts`](#src-utils-mod-ts)                                                 |          7 |       0 |          0 |
| [`src/utils/numbers.ts`](#src-utils-numbers-ts)                                         |          0 |       6 |          6 |
| [`src/utils/signals.ts`](#src-utils-signals-ts)                                         |          0 |       1 |          1 |
| [`src/utils/sorted_array.ts`](#src-utils-sorted-array-ts)                               |          0 |       2 |          2 |
| [`src/utils/strings.ts`](#src-utils-strings-ts)                                         |          0 |       9 |          9 |
| [`src/view.ts`](#src-view-ts)                                                           |          0 |       1 |          1 |
| [`src/viewport.ts`](#src-viewport-ts)                                                   |          0 |      18 |         18 |

### Modules

#### mod.ts

| Re-export Target               | Kind | Names |
| ------------------------------ | ---- | ----- |
| `src/component.ts`             | star | -     |
| `src/controls.ts`              | star | -     |
| `src/event_emitter.ts`         | star | -     |
| `src/focus.ts`                 | star | -     |
| `src/input.ts`                 | star | -     |
| `src/keymap.ts`                | star | -     |
| `src/selection.ts`             | star | -     |
| `src/theme.ts`                 | star | -     |
| `src/theme_binding.ts`         | star | -     |
| `src/theme_engine_cache.ts`    | star | -     |
| `src/theme_engine_factory.ts`  | star | -     |
| `src/theme_engine_pipeline.ts` | star | -     |
| `src/theme_gallery.ts`         | star | -     |
| `src/grwizard_themes.ts`       | star | -     |
| `src/theme_resolver.ts`        | star | -     |
| `src/theme_workspace.ts`       | star | -     |
| `src/api_stability.ts`         | star | -     |
| `src/types.ts`                 | star | -     |
| `src/view.ts`                  | star | -     |
| `src/viewport.ts`              | star | -     |
| `src/tui.ts`                   | star | -     |
| `src/signals/mod.ts`           | star | -     |
| `src/layout/mod.ts`            | star | -     |
| `src/markup/mod.ts`            | star | -     |
| `src/components/mod.ts`        | star | -     |
| `src/canvas/mod.ts`            | star | -     |
| `src/three_ascii/mod.ts`       | star | -     |
| `src/utils/mod.ts`             | star | -     |
| `src/input_reader/mod.ts`      | star | -     |
| `src/app/mod.ts`               | star | -     |
| `src/runtime/mod.ts`           | star | -     |
| `src/testing/mod.ts`           | star | -     |
| `src/perf/mod.ts`              | star | -     |

_No direct exported symbols._

#### src/api_stability.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `ApiStabilityTier`                | type      | yes       | yes   |
| `apiSurfacePolicies`              | const     | no        | yes   |
| `ApiSurfacePolicy`                | interface | yes       | yes   |
| `ApiSurfacePolicyQuery`           | interface | yes       | yes   |
| `filterApiSurfacePolicies`        | function  | no        | yes   |
| `filterPackageEntrypoints`        | function  | no        | yes   |
| `formatPackageEntrypointMarkdown` | function  | no        | yes   |
| `packageEntrypointFor`            | function  | no        | yes   |
| `PackageEntrypointManifest`       | interface | yes       | yes   |
| `PackageEntrypointQuery`          | interface | yes       | yes   |
| `packageEntrypoints`              | const     | no        | yes   |
| `packageReleasePolicy`            | const     | no        | yes   |
| `PackageReleasePolicy`            | interface | yes       | yes   |
| `PackageRuntime`                  | type      | yes       | yes   |

#### src/app/actions.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `Action`              | interface | yes       | yes   |
| `ActionBus`           | class     | no        | yes   |
| `ActionBusInspection` | interface | yes       | yes   |
| `ActionDispatch`      | type      | yes       | yes   |
| `ActionHandler`       | type      | yes       | yes   |
| `ActionMiddleware`    | type      | yes       | yes   |
| `ActionOfType`        | type      | yes       | yes   |

#### src/app/app.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `AppCommandInspection` | interface | yes       | yes   |
| `AppKeymapInspection`  | interface | yes       | yes   |
| `AppPlugin`            | interface | yes       | yes   |
| `AppPluginDisposer`    | type      | yes       | yes   |
| `AppPluginFactory`     | type      | yes       | yes   |
| `AppPluginInspection`  | interface | yes       | yes   |
| `AppPluginInstaller`   | type      | yes       | yes   |
| `AppPluginUseOptions`  | interface | yes       | yes   |
| `AppRouteInspection`   | interface | yes       | yes   |
| `createApp`            | function  | no        | yes   |
| `TuiApp`               | class     | no        | yes   |
| `TuiAppInspection`     | interface | yes       | yes   |
| `TuiAppOptions`        | interface | yes       | yes   |

#### src/app/button_commands.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `bindButtonCommands`   | function  | no        | yes   |
| `ButtonCommandAction`  | type      | yes       | yes   |
| `ButtonCommandKind`    | type      | yes       | yes   |
| `ButtonCommandOptions` | interface | yes       | yes   |
| `ButtonCommandPayload` | interface | yes       | yes   |
| `buttonCommands`       | function  | no        | yes   |

#### src/app/checkbox_commands.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindCheckBoxCommands`   | function  | no        | yes   |
| `CheckBoxCommandAction`  | type      | yes       | yes   |
| `CheckBoxCommandKind`    | type      | yes       | yes   |
| `CheckBoxCommandOptions` | interface | yes       | yes   |
| `CheckBoxCommandPayload` | interface | yes       | yes   |
| `checkBoxCommands`       | function  | no        | yes   |

#### src/app/combobox_commands.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindComboBoxCommands`   | function  | no        | yes   |
| `ComboBoxCommandAction`  | type      | yes       | yes   |
| `ComboBoxCommandKind`    | type      | yes       | yes   |
| `ComboBoxCommandOptions` | interface | yes       | yes   |
| `ComboBoxCommandPayload` | interface | yes       | yes   |
| `comboBoxCommands`       | function  | no        | yes   |

#### src/app/command_bindings.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `bindCommandKeymap`                 | function  | no        | yes   |
| `bindCommandKeys`                   | function  | no        | yes   |
| `bindCommandSurface`                | function  | no        | yes   |
| `commandForKeyEvent`                | function  | no        | yes   |
| `CommandKeyBindingConflict`         | interface | yes       | yes   |
| `CommandKeyBindingInspection`       | interface | yes       | yes   |
| `CommandKeyBindingMarkdownOptions`  | interface | yes       | yes   |
| `CommandKeyBindingOptions`          | interface | yes       | yes   |
| `CommandKeyBindingReport`           | interface | yes       | yes   |
| `CommandKeyBindingReportInspection` | interface | yes       | yes   |
| `CommandKeyBindingReportOptions`    | interface | yes       | yes   |
| `CommandKeymapBindingOptions`       | interface | yes       | yes   |
| `CommandKeyTarget`                  | interface | yes       | yes   |
| `CommandSearchMatch`                | interface | yes       | yes   |
| `CommandSearchOptions`              | interface | yes       | yes   |
| `CommandSurfaceController`          | interface | yes       | yes   |
| `CommandSurfaceItem`                | interface | yes       | yes   |
| `commandSurfaceItems`               | function  | no        | yes   |
| `CommandSurfaceOptions`             | interface | yes       | yes   |
| `createCommandKeyBindingReport`     | function  | no        | yes   |
| `createCommandSurface`              | function  | no        | yes   |
| `executeCommandSurfaceItem`         | function  | no        | yes   |
| `formatCommandKeyBindingMarkdown`   | function  | no        | yes   |
| `inspectCommandKeyBindings`         | function  | no        | yes   |
| `rankCommandSurfaceItems`           | function  | no        | yes   |
| `searchCommandSurfaceItems`         | function  | no        | yes   |

#### src/app/command_search_index.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `CommandSearchIndex`              | interface | yes       | yes   |
| `CommandSearchIndexEntry`         | interface | yes       | yes   |
| `CommandSearchIndexField`         | interface | yes       | yes   |
| `CommandSearchIndexInspection`    | interface | yes       | yes   |
| `CommandSearchIndexOptions`       | interface | yes       | yes   |
| `createCommandSearchIndex`        | function  | no        | yes   |
| `createIndexedCommandSurface`     | function  | no        | yes   |
| `IndexedCommandSearchOptions`     | interface | yes       | yes   |
| `IndexedCommandSurfaceController` | interface | yes       | yes   |
| `IndexedCommandSurfaceInspection` | interface | yes       | yes   |
| `searchCommandSearchIndex`        | function  | no        | yes   |

#### src/app/commands.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `Command`                   | interface | yes       | yes   |
| `CommandActionFactory`      | type      | yes       | yes   |
| `CommandDispatch`           | type      | yes       | yes   |
| `CommandInspection`         | interface | yes       | yes   |
| `CommandProjection`         | interface | yes       | yes   |
| `CommandRegistry`           | class     | no        | yes   |
| `CommandRegistryInspection` | interface | yes       | yes   |
| `CommandRegistryListener`   | type      | yes       | yes   |

#### src/app/component_commands.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindComponentCatalogCommands`    | function  | no        | yes   |
| `ComponentCatalogCommandAction`   | type      | yes       | yes   |
| `ComponentCatalogCommandOptions`  | interface | yes       | yes   |
| `componentCatalogCommands`        | function  | no        | yes   |
| `inspectComponentCatalogCommands` | function  | no        | yes   |

#### src/app/data_query_bindings.ts

| Symbol                             | Kind      | Type Only | JSDoc |
| ---------------------------------- | --------- | --------- | ----- |
| `bindDataQueryParams`              | function  | no        | yes   |
| `bindDataQueryResult`              | function  | no        | yes   |
| `bindDataQueryTable`               | function  | no        | yes   |
| `DataQueryParamsBindingHandle`     | type      | yes       | yes   |
| `DataQueryParamsBindingInspection` | interface | yes       | yes   |
| `DataQueryParamsBindingOptions`    | interface | yes       | yes   |
| `DataQueryResultBindingHandle`     | type      | yes       | yes   |
| `DataQueryResultBindingInspection` | interface | yes       | yes   |
| `DataQueryResultBindingOptions`    | interface | yes       | yes   |
| `DataQueryTableBindingHandle`      | type      | yes       | yes   |
| `DataQueryTableBindingInspection`  | interface | yes       | yes   |
| `DataQueryTableBindingOptions`     | interface | yes       | yes   |

#### src/app/data_query_commands.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindDataQueryCommands`   | function  | no        | yes   |
| `DataQueryCommandAction`  | type      | yes       | yes   |
| `DataQueryCommandKind`    | type      | yes       | yes   |
| `DataQueryCommandOptions` | interface | yes       | yes   |
| `DataQueryCommandPayload` | interface | yes       | yes   |
| `dataQueryCommands`       | function  | no        | yes   |
| `DataQuerySortCommand`    | interface | yes       | yes   |

#### src/app/data_query_plugin.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `createDataQueryPlugin`         | function  | no        | yes   |
| `DataQueryAppPlugin`            | interface | yes       | yes   |
| `DataQueryPluginInspection`     | interface | yes       | yes   |
| `DataQueryPluginInstallContext` | interface | yes       | yes   |
| `DataQueryPluginOptions`        | interface | yes       | yes   |

#### src/app/data_table_commands.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindDataTableCommands`   | function  | no        | yes   |
| `DataTableCommandKind`    | type      | yes       | yes   |
| `DataTableCommandOptions` | interface | yes       | yes   |
| `dataTableCommands`       | function  | no        | yes   |

#### src/app/disposables.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `createDisposableStack`     | function  | no        | yes   |
| `DisposableStack`           | class     | no        | yes   |
| `DisposableStackInspection` | interface | yes       | yes   |
| `Disposer`                  | type      | yes       | yes   |
| `disposeReverse`            | function  | no        | yes   |
| `MaybeDisposer`             | type      | yes       | yes   |

#### src/app/focus_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindFocusCommands`   | function  | no        | yes   |
| `FocusCommandAction`  | type      | yes       | yes   |
| `FocusCommandKind`    | type      | yes       | yes   |
| `FocusCommandOptions` | interface | yes       | yes   |
| `FocusCommandPayload` | interface | yes       | yes   |
| `focusCommands`       | function  | no        | yes   |
| `FocusCommandTarget`  | interface | yes       | yes   |

#### src/app/form_bindings.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindFormField`           | function  | no        | yes   |
| `FormFieldBindingOptions` | interface | yes       | yes   |

#### src/app/form_commands.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindFormCommands`           | function  | no        | yes   |
| `FormCommandAction`          | type      | yes       | yes   |
| `FormCommandKind`            | type      | yes       | yes   |
| `FormCommandOptions`         | interface | yes       | yes   |
| `formCommands`               | function  | no        | yes   |
| `FormCommandSnapshotPayload` | interface | yes       | yes   |
| `FormFieldCommandPayload`    | interface | yes       | yes   |

#### src/app/forms.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `FieldName`                  | type      | yes       | yes   |
| `FieldValidator`             | type      | yes       | yes   |
| `FormController`             | class     | no        | yes   |
| `FormControllerOptions`      | interface | yes       | yes   |
| `FormErrorSummaryItem`       | interface | yes       | yes   |
| `FormField`                  | interface | yes       | yes   |
| `FormFieldInspection`        | interface | yes       | yes   |
| `FormFieldState`             | type      | yes       | yes   |
| `FormGroupInspection`        | interface | yes       | yes   |
| `FormInspection`             | interface | yes       | yes   |
| `FormSchemaAdapter`          | interface | yes       | yes   |
| `FormSchemaValidationErrors` | type      | yes       | yes   |
| `FormSnapshot`               | interface | yes       | yes   |
| `FormSubmitResult`           | interface | yes       | yes   |
| `FormValues`                 | type      | yes       | yes   |
| `minLength`                  | function  | no        | yes   |
| `required`                   | function  | no        | yes   |

#### src/app/history_bindings.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindHistoryCommands`        | function  | no        | yes   |
| `bindRouteHistory`           | function  | no        | yes   |
| `HistoryCommandKind`         | type      | yes       | yes   |
| `HistoryCommandOptions`      | interface | yes       | yes   |
| `historyCommands`            | function  | no        | yes   |
| `RouteHistoryBindingOptions` | interface | yes       | yes   |

#### src/app/history.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `HistoryEntryInspection` | interface | yes       | yes   |
| `HistoryInspection`      | interface | yes       | yes   |
| `HistoryStack`           | class     | no        | yes   |
| `HistoryStackOptions`    | interface | yes       | yes   |
| `HistoryTransaction`     | interface | yes       | yes   |

#### src/app/hit_targets.ts

| Symbol           | Kind      | Type Only | JSDoc |
| ---------------- | --------- | --------- | ----- |
| `clipRect`       | function  | no        | yes   |
| `contains`       | function  | no        | yes   |
| `HitTarget`      | interface | yes       | yes   |
| `HitTargetStack` | class     | no        | yes   |
| `inset`          | function  | no        | yes   |
| `intersects`     | function  | no        | yes   |

#### src/app/input_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindInputCommands`   | function  | no        | yes   |
| `InputCommandAction`  | type      | yes       | yes   |
| `InputCommandKind`    | type      | yes       | yes   |
| `InputCommandOptions` | interface | yes       | yes   |
| `InputCommandPayload` | interface | yes       | yes   |
| `inputCommands`       | function  | no        | yes   |

#### src/app/list_commands.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `bindListCommands`   | function  | no        | yes   |
| `ListCommandAction`  | type      | yes       | yes   |
| `ListCommandKind`    | type      | yes       | yes   |
| `ListCommandOptions` | interface | yes       | yes   |
| `ListCommandPayload` | interface | yes       | yes   |
| `listCommands`       | function  | no        | yes   |

#### src/app/log_viewer_commands.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindLogViewerCommands`   | function  | no        | yes   |
| `LogViewerCommandAction`  | type      | yes       | yes   |
| `LogViewerCommandKind`    | type      | yes       | yes   |
| `LogViewerCommandOptions` | interface | yes       | yes   |
| `LogViewerCommandPayload` | interface | yes       | yes   |
| `logViewerCommands`       | function  | no        | yes   |

#### src/app/menu_bar_commands.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `bindMenuBarCommands`   | function  | no        | yes   |
| `MenuBarCommandAction`  | type      | yes       | yes   |
| `MenuBarCommandKind`    | type      | yes       | yes   |
| `MenuBarCommandOptions` | interface | yes       | yes   |
| `MenuBarCommandPayload` | interface | yes       | yes   |
| `menuBarCommands`       | function  | no        | yes   |

#### src/app/metric_series_commands.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindMetricSeriesCommands`   | function  | no        | yes   |
| `MetricSeriesCommandAction`  | type      | yes       | yes   |
| `MetricSeriesCommandKind`    | type      | yes       | yes   |
| `MetricSeriesCommandOptions` | interface | yes       | yes   |
| `MetricSeriesCommandPayload` | interface | yes       | yes   |
| `metricSeriesCommands`       | function  | no        | yes   |

#### src/app/mod.ts

| Re-export Target                       | Kind | Names |
| -------------------------------------- | ---- | ----- |
| `src/app/actions.ts`                   | star | -     |
| `src/app/app.ts`                       | star | -     |
| `src/app/button_commands.ts`           | star | -     |
| `src/app/checkbox_commands.ts`         | star | -     |
| `src/app/combobox_commands.ts`         | star | -     |
| `src/app/component_commands.ts`        | star | -     |
| `src/app/command_bindings.ts`          | star | -     |
| `src/app/command_search_index.ts`      | star | -     |
| `src/app/commands.ts`                  | star | -     |
| `src/app/data_query_bindings.ts`       | star | -     |
| `src/app/data_query_commands.ts`       | star | -     |
| `src/app/data_query_plugin.ts`         | star | -     |
| `src/app/data_table_commands.ts`       | star | -     |
| `src/app/disposables.ts`               | star | -     |
| `src/app/form_bindings.ts`             | star | -     |
| `src/app/form_commands.ts`             | star | -     |
| `src/app/focus_commands.ts`            | star | -     |
| `src/app/forms.ts`                     | star | -     |
| `src/app/history_bindings.ts`          | star | -     |
| `src/app/history.ts`                   | star | -     |
| `src/app/hit_targets.ts`               | star | -     |
| `src/app/input_commands.ts`            | star | -     |
| `src/app/list_commands.ts`             | star | -     |
| `src/app/log_viewer_commands.ts`       | star | -     |
| `src/app/menu_bar_commands.ts`         | star | -     |
| `src/app/metric_series_commands.ts`    | star | -     |
| `src/app/mouse_bindings.ts`            | star | -     |
| `src/app/pad_commands.ts`              | star | -     |
| `src/app/plugins.ts`                   | star | -     |
| `src/app/progress_bar_commands.ts`     | star | -     |
| `src/app/radio_group_commands.ts`      | star | -     |
| `src/app/route_bindings.ts`            | star | -     |
| `src/app/router.ts`                    | star | -     |
| `src/app/runtime_profile_commands.ts`  | star | -     |
| `src/app/runtime_profile_plugin.ts`    | star | -     |
| `src/app/runtime_renderer_commands.ts` | star | -     |
| `src/app/runtime_renderer_plugin.ts`   | star | -     |
| `src/app/runtime_workload_commands.ts` | star | -     |
| `src/app/scroll_area_commands.ts`      | star | -     |
| `src/app/selection_bindings.ts`        | star | -     |
| `src/app/settings_commands.ts`         | star | -     |
| `src/app/settings_bindings.ts`         | star | -     |
| `src/app/settings.ts`                  | star | -     |
| `src/app/slider_commands.ts`           | star | -     |
| `src/app/split_pane_commands.ts`       | star | -     |
| `src/app/stepper_commands.ts`          | star | -     |
| `src/app/surface_bindings.ts`          | star | -     |
| `src/app/table_commands.ts`            | star | -     |
| `src/app/tabs_commands.ts`             | star | -     |
| `src/app/terminal_commands.ts`         | star | -     |
| `src/app/terminal_input.ts`            | star | -     |
| `src/app/terminal_window_bindings.ts`  | star | -     |
| `src/app/textbox_commands.ts`          | star | -     |
| `src/app/theme_commands.ts`            | star | -     |
| `src/app/theme_engine_commands.ts`     | star | -     |
| `src/app/theme_pipeline_commands.ts`   | star | -     |
| `src/app/theme_plugin.ts`              | star | -     |
| `src/app/theme_workspace_plugin.ts`    | star | -     |
| `src/app/toast_commands.ts`            | star | -     |
| `src/app/tree_commands.ts`             | star | -     |
| `src/app/window_manager_commands.ts`   | star | -     |
| `src/app/workbench_frame.ts`           | star | -     |
| `src/app/workbench_menu.ts`            | star | -     |
| `src/app/workbench_window_registry.ts` | star | -     |
| `src/app/workbench_workspace.ts`       | star | -     |

_No direct exported symbols._

#### src/app/mouse_bindings.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `bindMouseInteractions`          | function  | no        | yes   |
| `createMouseInteractionRouter`   | function  | no        | yes   |
| `MouseInteractionContext`        | interface | yes       | yes   |
| `MouseInteractionDispatchResult` | interface | yes       | yes   |
| `MouseInteractionEvent`          | type      | yes       | yes   |
| `MouseInteractionHandler`        | type      | yes       | yes   |
| `MouseInteractionInspection`     | interface | yes       | yes   |
| `MouseInteractionKind`           | type      | yes       | yes   |
| `MouseInteractionRouter`         | class     | no        | yes   |
| `MouseInteractionTarget`         | interface | yes       | yes   |

#### src/app/pad_commands.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `bindPadCommands`   | function  | no        | yes   |
| `PadCommandAction`  | type      | yes       | yes   |
| `PadCommandKind`    | type      | yes       | yes   |
| `PadCommandOptions` | interface | yes       | yes   |
| `PadCommandPayload` | interface | yes       | yes   |
| `padCommands`       | function  | no        | yes   |

#### src/app/plugins.ts

| Symbol                                  | Kind      | Type Only | JSDoc |
| --------------------------------------- | --------- | --------- | ----- |
| `AppPluginCatalogInspection`            | interface | yes       | yes   |
| `AppPluginCatalogMarkdownOptions`       | interface | yes       | yes   |
| `AppPluginCatalogQuery`                 | interface | yes       | yes   |
| `AppPluginCatalogReport`                | interface | yes       | yes   |
| `AppPluginCatalogReportOptions`         | interface | yes       | yes   |
| `AppPluginDefinition`                   | interface | yes       | yes   |
| `AppPluginDefinitionInspection`         | interface | yes       | yes   |
| `AppPluginDefinitionRegistry`           | class     | no        | yes   |
| `AppPluginDefinitionRegistryInspection` | interface | yes       | yes   |
| `AppPluginRoute`                        | interface | yes       | yes   |
| `createAppPlugin`                       | function  | no        | yes   |
| `createAppPluginCatalogReport`          | function  | no        | yes   |
| `createAppPluginDefinitionRegistry`     | function  | no        | yes   |
| `formatAppPluginCatalogMarkdown`        | function  | no        | yes   |
| `inspectAppPluginCatalog`               | function  | no        | yes   |
| `inspectAppPluginDefinition`            | function  | no        | yes   |
| `queryAppPluginDefinitions`             | function  | no        | yes   |

#### src/app/progress_bar_commands.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `bindProgressBarCommands`   | function  | no        | yes   |
| `ProgressBarCommandAction`  | type      | yes       | yes   |
| `ProgressBarCommandKind`    | type      | yes       | yes   |
| `ProgressBarCommandOptions` | interface | yes       | yes   |
| `ProgressBarCommandPayload` | interface | yes       | yes   |
| `progressBarCommands`       | function  | no        | yes   |

#### src/app/radio_group_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindRadioGroupCommands`   | function  | no        | yes   |
| `RadioGroupCommandAction`  | type      | yes       | yes   |
| `RadioGroupCommandKind`    | type      | yes       | yes   |
| `RadioGroupCommandOptions` | interface | yes       | yes   |
| `RadioGroupCommandPayload` | interface | yes       | yes   |
| `radioGroupCommands`       | function  | no        | yes   |

#### src/app/route_bindings.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `bindRouteCommands`         | function  | no        | yes   |
| `bindRouteIndex`            | function  | no        | yes   |
| `bindRouteSignal`           | function  | no        | yes   |
| `RouteCommandKind`          | type      | yes       | yes   |
| `RouteCommandOptions`       | interface | yes       | yes   |
| `routeCommands`             | function  | no        | yes   |
| `RouteIdSource`             | type      | yes       | yes   |
| `RouteIndexBindingOptions`  | interface | yes       | yes   |
| `RouteSignalBindingOptions` | interface | yes       | yes   |

#### src/app/router.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `Route`                  | interface | yes       | yes   |
| `RouteInspection`        | interface | yes       | yes   |
| `RouteManager`           | class     | no        | yes   |
| `RouteRegisterOptions`   | interface | yes       | yes   |
| `RouteUnregisterOptions` | interface | yes       | yes   |

#### src/app/runtime_profile_commands.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `bindRuntimeProfileCommands`   | function  | no        | yes   |
| `RuntimeProfileChangedPayload` | interface | yes       | yes   |
| `RuntimeProfileCommandAction`  | type      | yes       | yes   |
| `RuntimeProfileCommandOptions` | interface | yes       | yes   |
| `runtimeProfileCommands`       | function  | no        | yes   |

#### src/app/runtime_profile_plugin.ts

| Symbol                               | Kind      | Type Only | JSDoc |
| ------------------------------------ | --------- | --------- | ----- |
| `createRuntimeProfilePlugin`         | function  | no        | yes   |
| `RuntimeProfileAppPlugin`            | interface | yes       | yes   |
| `RuntimeProfilePluginInspection`     | interface | yes       | yes   |
| `RuntimeProfilePluginInstallContext` | interface | yes       | yes   |
| `RuntimeProfilePluginOptions`        | interface | yes       | yes   |

#### src/app/runtime_renderer_commands.ts

| Symbol                                 | Kind      | Type Only | JSDoc |
| -------------------------------------- | --------- | --------- | ----- |
| `bindRuntimeRendererBackendCommands`   | function  | no        | yes   |
| `RuntimeRendererBackendChangedPayload` | interface | yes       | yes   |
| `RuntimeRendererBackendCommandAction`  | type      | yes       | yes   |
| `RuntimeRendererBackendCommandOptions` | interface | yes       | yes   |
| `runtimeRendererBackendCommands`       | function  | no        | yes   |

#### src/app/runtime_renderer_plugin.ts

| Symbol                                       | Kind      | Type Only | JSDoc |
| -------------------------------------------- | --------- | --------- | ----- |
| `createRuntimeRendererBackendPlugin`         | function  | no        | yes   |
| `RuntimeRendererBackendAppPlugin`            | interface | yes       | yes   |
| `RuntimeRendererBackendPluginInspection`     | interface | yes       | yes   |
| `RuntimeRendererBackendPluginInstallContext` | interface | yes       | yes   |
| `RuntimeRendererBackendPluginOptions`        | interface | yes       | yes   |

#### src/app/runtime_workload_commands.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `bindRuntimeWorkloadCommands`    | function  | no        | yes   |
| `RuntimeWorkloadCommandAction`   | type      | yes       | yes   |
| `RuntimeWorkloadCommandOptions`  | interface | yes       | yes   |
| `runtimeWorkloadCommands`        | function  | no        | yes   |
| `RuntimeWorkloadReportedPayload` | interface | yes       | yes   |

#### src/app/scroll_area_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindScrollAreaCommands`   | function  | no        | yes   |
| `ScrollAreaCommandAction`  | type      | yes       | yes   |
| `ScrollAreaCommandKind`    | type      | yes       | yes   |
| `ScrollAreaCommandOptions` | interface | yes       | yes   |
| `ScrollAreaCommandPayload` | interface | yes       | yes   |
| `scrollAreaCommands`       | function  | no        | yes   |

#### src/app/selection_bindings.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `bindSelectionCommands`        | function  | no        | yes   |
| `bindSelectionValue`           | function  | no        | yes   |
| `SelectionCommandKind`         | type      | yes       | yes   |
| `SelectionCommandOptions`      | interface | yes       | yes   |
| `selectionCommands`            | function  | no        | yes   |
| `SelectionItemsSource`         | type      | yes       | yes   |
| `SelectionPageSize`            | type      | yes       | yes   |
| `SelectionValueBindingOptions` | interface | yes       | yes   |

#### src/app/settings_bindings.ts

| Symbol                                        | Kind      | Type Only | JSDoc |
| --------------------------------------------- | --------- | --------- | ----- |
| `bindDataQuerySetting`                        | function  | no        | yes   |
| `bindDataTableSetting`                        | function  | no        | yes   |
| `bindRouteSetting`                            | function  | no        | yes   |
| `bindRuntimeProfileSetting`                   | function  | no        | yes   |
| `bindRuntimeRendererBackendSetting`           | function  | no        | yes   |
| `bindSettingSignal`                           | function  | no        | yes   |
| `bindSplitPaneSetting`                        | function  | no        | yes   |
| `bindThemeLayerSetting`                       | function  | no        | yes   |
| `bindThemePipelineSetting`                    | function  | no        | yes   |
| `bindThemeSetting`                            | function  | no        | yes   |
| `DataQuerySettingBindingOptions`              | interface | yes       | yes   |
| `DataTableSettingBindingOptions`              | interface | yes       | yes   |
| `RouteSettingBindingOptions`                  | interface | yes       | yes   |
| `RuntimeProfileSettingBindingOptions`         | interface | yes       | yes   |
| `RuntimeRendererBackendSettingBindingOptions` | interface | yes       | yes   |
| `SettingBinding`                              | interface | yes       | yes   |
| `SettingSignalBindingOptions`                 | interface | yes       | yes   |
| `SplitPaneSettingBindingOptions`              | interface | yes       | yes   |
| `ThemeLayerSettingBindingOptions`             | interface | yes       | yes   |
| `ThemePipelineSettingBindingOptions`          | interface | yes       | yes   |
| `ThemeSettingBindingOptions`                  | interface | yes       | yes   |

#### src/app/settings_commands.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindSettingsCommands`   | function  | no        | yes   |
| `SettingsCommandAction`  | type      | yes       | yes   |
| `SettingsCommandKind`    | type      | yes       | yes   |
| `SettingsCommandOptions` | interface | yes       | yes   |
| `settingsCommands`       | function  | no        | yes   |

#### src/app/settings.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `AppSettingDefinition`         | interface | yes       | yes   |
| `createSettingsController`     | function  | no        | yes   |
| `SettingsController`           | class     | no        | yes   |
| `SettingsControllerInspection` | interface | yes       | yes   |
| `SettingsControllerOptions`    | interface | yes       | yes   |

#### src/app/slider_commands.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `bindSliderCommands`   | function  | no        | yes   |
| `SliderCommandAction`  | type      | yes       | yes   |
| `SliderCommandKind`    | type      | yes       | yes   |
| `SliderCommandOptions` | interface | yes       | yes   |
| `SliderCommandPayload` | interface | yes       | yes   |
| `sliderCommands`       | function  | no        | yes   |

#### src/app/split_pane_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindSplitPaneCommands`    | function  | no        | yes   |
| `SplitPaneBoundsSource`    | type      | yes       | yes   |
| `SplitPaneCommandAction`   | type      | yes       | yes   |
| `SplitPaneCommandKind`     | type      | yes       | yes   |
| `SplitPaneCommandOptions`  | interface | yes       | yes   |
| `splitPaneCommands`        | function  | no        | yes   |
| `SplitPaneSnapshotPayload` | interface | yes       | yes   |

#### src/app/stepper_commands.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `bindStepperCommands`   | function  | no        | yes   |
| `StepperCommandAction`  | type      | yes       | yes   |
| `StepperCommandKind`    | type      | yes       | yes   |
| `StepperCommandOptions` | interface | yes       | yes   |
| `StepperCommandPayload` | interface | yes       | yes   |
| `stepperCommands`       | function  | no        | yes   |

#### src/app/surface_bindings.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindModalFocus`           | function  | no        | yes   |
| `ModalFocusBindingOptions` | interface | yes       | yes   |

#### src/app/table_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindTableCommands`   | function  | no        | yes   |
| `TableCommandAction`  | type      | yes       | yes   |
| `TableCommandKind`    | type      | yes       | yes   |
| `TableCommandOptions` | interface | yes       | yes   |
| `TableCommandPayload` | interface | yes       | yes   |
| `tableCommands`       | function  | no        | yes   |

#### src/app/tabs_commands.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `bindTabsCommands`   | function  | no        | yes   |
| `TabsCommandAction`  | type      | yes       | yes   |
| `TabsCommandKind`    | type      | yes       | yes   |
| `TabsCommandOptions` | interface | yes       | yes   |
| `TabsCommandPayload` | interface | yes       | yes   |
| `tabsCommands`       | function  | no        | yes   |

#### src/app/terminal_commands.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindTerminalCommands`            | function  | no        | yes   |
| `bindTerminalWorkspaceCommands`   | function  | no        | yes   |
| `TerminalCommandAction`           | type      | yes       | yes   |
| `TerminalCommandKind`             | type      | yes       | yes   |
| `TerminalCommandOptions`          | interface | yes       | yes   |
| `TerminalCommandPayload`          | interface | yes       | yes   |
| `terminalCommands`                | function  | no        | yes   |
| `TerminalWorkspaceCommandAction`  | type      | yes       | yes   |
| `TerminalWorkspaceCommandKind`    | type      | yes       | yes   |
| `TerminalWorkspaceCommandOptions` | interface | yes       | yes   |
| `TerminalWorkspaceCommandPayload` | interface | yes       | yes   |
| `terminalWorkspaceCommands`       | function  | no        | yes   |

#### src/app/terminal_input.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `encodeTerminalKeyPress`      | function  | no        | yes   |
| `encodeTerminalPaste`         | function  | no        | yes   |
| `isReservedTerminalKey`       | function  | no        | yes   |
| `routeTerminalKeyPress`       | function  | no        | yes   |
| `routeTerminalPaste`          | function  | no        | yes   |
| `TerminalInputMode`           | type      | yes       | yes   |
| `TerminalInputRouteDecision`  | interface | yes       | yes   |
| `TerminalInputRoutingOptions` | interface | yes       | yes   |
| `TerminalInputTarget`         | interface | yes       | yes   |

#### src/app/terminal_window_bindings.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `syncTerminalWindowLayout`        | function  | no        | yes   |
| `TerminalWindowBinding`           | interface | yes       | yes   |
| `terminalWindowContentSize`       | function  | no        | yes   |
| `TerminalWindowLayoutSyncOptions` | interface | yes       | yes   |
| `TerminalWindowLayoutSyncResult`  | interface | yes       | yes   |

#### src/app/textbox_commands.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `bindTextBoxCommands`   | function  | no        | yes   |
| `TextBoxCommandAction`  | type      | yes       | yes   |
| `TextBoxCommandKind`    | type      | yes       | yes   |
| `TextBoxCommandOptions` | interface | yes       | yes   |
| `TextBoxCommandPayload` | interface | yes       | yes   |
| `textBoxCommands`       | function  | no        | yes   |

#### src/app/theme_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindThemeCommands`        | function  | no        | yes   |
| `ThemeChangedPayload`      | interface | yes       | yes   |
| `ThemeCommandAction`       | type      | yes       | yes   |
| `ThemeCommandOptions`      | interface | yes       | yes   |
| `themeCommands`            | function  | no        | yes   |
| `ThemeLayerChangedPayload` | interface | yes       | yes   |
| `themeLayerCommands`       | function  | no        | yes   |
| `themePreviewCommands`     | function  | no        | yes   |
| `ThemePreviewPayload`      | interface | yes       | yes   |
| `themeSelectionCommands`   | function  | no        | yes   |

#### src/app/theme_engine_commands.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindThemeEngineCommands`    | function  | no        | yes   |
| `themeEngineCatalogCommands` | function  | no        | yes   |
| `ThemeEngineCatalogPayload`  | interface | yes       | yes   |
| `ThemeEngineCommandAction`   | type      | yes       | yes   |
| `ThemeEngineCommandOptions`  | interface | yes       | yes   |
| `themeEngineCommands`        | function  | no        | yes   |
| `ThemeEngineCommandSource`   | type      | yes       | yes   |
| `themeEngineFactoryCommands` | function  | no        | yes   |
| `ThemeEnginePreviewPayload`  | interface | yes       | yes   |

#### src/app/theme_pipeline_commands.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindThemePipelineCommands`       | function  | no        | yes   |
| `ThemePipelineCommandAction`      | type      | yes       | yes   |
| `ThemePipelineCommandOptions`     | interface | yes       | yes   |
| `themePipelineCommands`           | function  | no        | yes   |
| `ThemePipelineStepChangedPayload` | interface | yes       | yes   |

#### src/app/theme_plugin.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createThemePlugin`                 | function  | no        | yes   |
| `ThemeAppPlugin`                    | interface | yes       | yes   |
| `ThemePluginInspection`             | interface | yes       | yes   |
| `ThemePluginInstallContext`         | interface | yes       | yes   |
| `ThemePluginOptions`                | interface | yes       | yes   |
| `ThemePluginPipelineCommandOptions` | type      | yes       | yes   |
| `ThemePluginPipelineSettingOption`  | type      | yes       | yes   |
| `ThemePluginPipelineSettingOptions` | type      | yes       | yes   |

#### src/app/theme_workspace_plugin.ts

| Symbol                               | Kind      | Type Only | JSDoc |
| ------------------------------------ | --------- | --------- | ----- |
| `createThemeWorkspacePlugin`         | function  | no        | yes   |
| `ThemeWorkspaceAppPlugin`            | interface | yes       | yes   |
| `ThemeWorkspacePluginInspection`     | interface | yes       | yes   |
| `ThemeWorkspacePluginInstallContext` | interface | yes       | yes   |
| `ThemeWorkspacePluginOptions`        | interface | yes       | yes   |

#### src/app/toast_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindToastCommands`   | function  | no        | yes   |
| `ToastCommandAction`  | type      | yes       | yes   |
| `ToastCommandKind`    | type      | yes       | yes   |
| `ToastCommandOptions` | interface | yes       | yes   |
| `ToastCommandPayload` | interface | yes       | yes   |
| `toastCommands`       | function  | no        | yes   |

#### src/app/tree_commands.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `bindTreeCommands`   | function  | no        | yes   |
| `TreeCommandAction`  | type      | yes       | yes   |
| `TreeCommandKind`    | type      | yes       | yes   |
| `TreeCommandOptions` | interface | yes       | yes   |
| `TreeCommandPayload` | interface | yes       | yes   |
| `treeCommands`       | function  | no        | yes   |

#### src/app/window_manager_commands.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `bindWindowManagerCommands`   | function  | no        | yes   |
| `WindowManagerCommandAction`  | type      | yes       | yes   |
| `WindowManagerCommandKind`    | type      | yes       | yes   |
| `WindowManagerCommandOptions` | interface | yes       | yes   |
| `WindowManagerCommandPayload` | interface | yes       | yes   |
| `windowManagerCommands`       | function  | no        | yes   |
| `WindowManagerRenameFactory`  | type      | yes       | yes   |
| `WindowManagerWindowFactory`  | type      | yes       | yes   |

#### src/app/workbench_frame.ts

| Symbol                | Kind     | Type Only | JSDoc |
| --------------------- | -------- | --------- | ----- |
| `buttonText`          | function | no        | yes   |
| `centerCellText`      | function | no        | yes   |
| `contrastText`        | function | no        | yes   |
| `fillFrameRect`       | function | no        | yes   |
| `fillFrameRow`        | function | no        | yes   |
| `fitCellText`         | function | no        | yes   |
| `parseHexColor`       | function | no        | yes   |
| `renderFrameRow`      | function | no        | yes   |
| `renderFrameSlice`    | function | no        | yes   |
| `toStyledCells`       | function | no        | yes   |
| `WorkbenchFrame`      | type     | yes       | yes   |
| `WorkbenchFrameStyle` | type     | yes       | yes   |
| `writeFrame`          | function | no        | yes   |

#### src/app/workbench_menu.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `isWorkbenchMenuActivationKey`  | function  | no        | yes   |
| `isWorkbenchMenuCloseKey`       | function  | no        | yes   |
| `moveWorkbenchMenuIndex`        | function  | no        | yes   |
| `MoveWorkbenchMenuIndexOptions` | interface | yes       | yes   |
| `WorkbenchMenuKey`              | interface | yes       | yes   |

#### src/app/workbench_window_registry.ts

| Symbol                                      | Kind      | Type Only | JSDoc |
| ------------------------------------------- | --------- | --------- | ----- |
| `createWorkbenchVisualizationWindowOptions` | function  | no        | yes   |
| `createWorkbenchWindowOptions`              | function  | no        | yes   |
| `isWorkbenchVisualizationWindowId`          | function  | no        | yes   |
| `isWorkbenchWindowOptionLoaded`             | function  | no        | yes   |
| `workbenchVisualizationIdFromWindowId`      | function  | no        | yes   |
| `WorkbenchVisualizationOptionSource`        | interface | yes       | yes   |
| `workbenchVisualizationWindowId`            | function  | no        | yes   |
| `WorkbenchWindowOption`                     | interface | yes       | yes   |
| `WorkbenchWindowOptionCatalogInput`         | interface | yes       | yes   |
| `WorkbenchWindowOptionGroup`                | type      | yes       | yes   |
| `workbenchWindowOptionMenuLabel`            | function  | no        | yes   |
| `workbenchWindowOptionMinimums`             | function  | no        | yes   |
| `WorkbenchWindowOptionMinimums`             | interface | yes       | yes   |

#### src/app/workbench_workspace.ts

| Symbol                                         | Kind      | Type Only | JSDoc |
| ---------------------------------------------- | --------- | --------- | ----- |
| `defaultWorkbenchMinimizedState`               | function  | no        | yes   |
| `deleteWorkbenchWorkspace`                     | function  | no        | yes   |
| `findWorkbenchWorkspace`                       | function  | no        | yes   |
| `normalizeWorkbenchPanelWorkspaceState`        | function  | no        | yes   |
| `NormalizeWorkbenchPanelWorkspaceStateOptions` | interface | yes       | yes   |
| `normalizeWorkbenchWorkspaceName`              | function  | no        | yes   |
| `normalizeWorkbenchWorkspaces`                 | function  | no        | yes   |
| `NormalizeWorkbenchWorkspacesOptions`          | interface | yes       | yes   |
| `normalizeWorkbenchWorkspaceStorage`           | function  | no        | yes   |
| `renameWorkbenchWorkspace`                     | function  | no        | yes   |
| `serializeWorkbenchWorkspaces`                 | function  | no        | yes   |
| `upsertWorkbenchWorkspace`                     | function  | no        | yes   |
| `WORKBENCH_WORKSPACE_STORAGE_VERSION`          | const     | no        | yes   |
| `WorkbenchPanelWorkspaceState`                 | interface | yes       | yes   |
| `WorkbenchWorkspace`                           | interface | yes       | yes   |
| `WorkbenchWorkspaceStorage`                    | interface | yes       | yes   |
| `WorkbenchWorkspaceWindow`                     | interface | yes       | yes   |
| `workbenchWorkspaceWindowEntries`              | function  | no        | yes   |

#### src/canvas/box.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `BoxObject`        | class     | no        | yes   |
| `BoxObjectOptions` | interface | yes       | yes   |

#### src/canvas/canvas.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `Canvas`            | class     | no        | yes   |
| `CanvasEventMap`    | type      | yes       | yes   |
| `CanvasOptions`     | interface | yes       | yes   |
| `CanvasRenderStats` | interface | yes       | yes   |

#### src/canvas/dirty_region.ts

| Symbol            | Kind      | Type Only | JSDoc |
| ----------------- | --------- | --------- | ----- |
| `DirtyRegion`     | class     | no        | yes   |
| `DirtyRowSegment` | interface | yes       | yes   |

#### src/canvas/draw_object.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `DrawObject`        | class     | no        | yes   |
| `DrawObjectOptions` | interface | yes       | yes   |

#### src/canvas/mod.ts

| Re-export Target              | Kind | Names |
| ----------------------------- | ---- | ----- |
| `src/canvas/box.ts`           | star | -     |
| `src/canvas/text.ts`          | star | -     |
| `src/canvas/canvas.ts`        | star | -     |
| `src/canvas/dirty_region.ts`  | star | -     |
| `src/canvas/draw_object.ts`   | star | -     |
| `src/canvas/sink.ts`          | star | -     |
| `src/canvas/spatial_index.ts` | star | -     |
| `src/canvas/three_ascii.ts`   | star | -     |

_No direct exported symbols._

#### src/canvas/sink.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `AnsiCanvasSink`          | class     | no        | yes   |
| `AnsiCanvasSinkOptions`   | interface | yes       | yes   |
| `CanvasCellSink`          | interface | yes       | yes   |
| `CanvasCellUpdate`        | interface | yes       | yes   |
| `CanvasRowRangeUpdate`    | interface | yes       | yes   |
| `CanvasStdout`            | interface | yes       | yes   |
| `coalesceCanvasRowRanges` | function  | no        | yes   |
| `MemoryCanvasSink`        | class     | no        | yes   |

#### src/canvas/spatial_index.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `DrawObjectSpatialIndex`      | class     | no        | yes   |
| `DrawObjectSpatialIndexStats` | interface | yes       | yes   |

#### src/canvas/text.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `TextObject`        | class     | no        | yes   |
| `TextObjectOptions` | interface | yes       | yes   |
| `TextRectangle`     | type      | yes       | yes   |

#### src/canvas/three_ascii.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `buildFallbackGrid`              | function  | no        | yes   |
| `formatThreeAsciiFallbackDetail` | function  | no        | yes   |
| `ThreeAsciiGridRenderer`         | interface | yes       | yes   |
| `ThreeAsciiObject`               | class     | no        | yes   |
| `ThreeAsciiObjectOptions`        | interface | yes       | yes   |
| `ThreeAsciiRendererFactory`      | type      | yes       | yes   |

#### src/component.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `Component`        | class     | no        | yes   |
| `ComponentOptions` | interface | yes       | yes   |
| `ComponentState`   | type      | yes       | yes   |
| `Interaction`      | interface | yes       | yes   |

#### src/components/box.ts

| Symbol | Kind  | Type Only | JSDoc |
| ------ | ----- | --------- | ----- |
| `Box`  | class | no        | yes   |

#### src/components/breadcrumbs.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `BreadcrumbItem`     | interface | yes       | yes   |
| `Breadcrumbs`        | class     | no        | yes   |
| `BreadcrumbsOptions` | interface | yes       | yes   |
| `renderBreadcrumbs`  | function  | no        | yes   |

#### src/components/button.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `Button`                  | class     | no        | yes   |
| `ButtonController`        | class     | no        | yes   |
| `ButtonControllerOptions` | interface | yes       | yes   |
| `ButtonInspection`        | interface | yes       | yes   |
| `ButtonOptions`           | interface | yes       | yes   |

#### src/components/catalog.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `componentCapabilities`           | function  | no        | yes   |
| `ComponentCapability`             | type      | yes       | yes   |
| `componentCatalog`                | const     | no        | yes   |
| `ComponentCatalogEntry`           | interface | yes       | yes   |
| `ComponentCatalogInspection`      | interface | yes       | yes   |
| `ComponentCatalogMarkdownOptions` | interface | yes       | yes   |
| `ComponentCatalogQuery`           | interface | yes       | yes   |
| `ComponentCatalogReport`          | interface | yes       | yes   |
| `ComponentCatalogReportOptions`   | interface | yes       | yes   |
| `componentCategories`             | function  | no        | yes   |
| `ComponentCategory`               | type      | yes       | yes   |
| `componentsByCategory`            | function  | no        | yes   |
| `componentsWithCapability`        | function  | no        | yes   |
| `createComponentCatalogReport`    | function  | no        | yes   |
| `findComponent`                   | function  | no        | yes   |
| `formatComponentCatalogMarkdown`  | function  | no        | yes   |
| `inspectComponentCatalog`         | function  | no        | yes   |
| `listComponents`                  | function  | no        | yes   |
| `queryComponents`                 | function  | no        | yes   |

#### src/components/chart.ts

| Symbol           | Kind      | Type Only | JSDoc |
| ---------------- | --------- | --------- | ----- |
| `Chart`          | class     | no        | yes   |
| `ChartOptions`   | interface | yes       | yes   |
| `renderBarChart` | function  | no        | yes   |

#### src/components/checkbox.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `CheckBox`                  | class     | no        | yes   |
| `CheckBoxController`        | class     | no        | yes   |
| `CheckBoxControllerOptions` | interface | yes       | yes   |
| `CheckBoxInspection`        | interface | yes       | yes   |
| `CheckBoxOptions`           | interface | yes       | yes   |
| `Mark`                      | enum      | no        | yes   |
| `renderCheckBoxMark`        | function  | no        | yes   |

#### src/components/combobox.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `clampComboBoxIndex`        | function  | no        | yes   |
| `ComboBox`                  | class     | no        | yes   |
| `ComboBoxController`        | class     | no        | yes   |
| `ComboBoxControllerOptions` | interface | yes       | yes   |
| `ComboBoxInspection`        | interface | yes       | yes   |
| `comboBoxLabel`             | function  | no        | yes   |
| `ComboBoxOptions`           | interface | yes       | yes   |

#### src/components/command_palette.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `clampCommandPaletteSelection`    | function  | no        | yes   |
| `CommandPalette`                  | class     | no        | yes   |
| `CommandPaletteController`        | class     | no        | yes   |
| `CommandPaletteControllerOptions` | interface | yes       | yes   |
| `CommandPaletteInspection`        | interface | yes       | yes   |
| `CommandPaletteItem`              | interface | yes       | yes   |
| `CommandPaletteMatch`             | interface | yes       | yes   |
| `CommandPaletteOptions`           | interface | yes       | yes   |
| `filterCommandPaletteItems`       | function  | no        | yes   |
| `rankCommandPaletteItems`         | function  | no        | yes   |
| `renderCommandPaletteRows`        | function  | no        | yes   |
| `shiftCommandPaletteSelection`    | function  | no        | yes   |

#### src/components/context_menu.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `clampContextMenuSelection`    | function  | no        | yes   |
| `ContextMenu`                  | class     | no        | yes   |
| `ContextMenuController`        | class     | no        | yes   |
| `ContextMenuControllerOptions` | interface | yes       | yes   |
| `ContextMenuInspection`        | interface | yes       | yes   |
| `ContextMenuItem`              | interface | yes       | yes   |
| `ContextMenuOptions`           | interface | yes       | yes   |
| `renderContextMenuRows`        | function  | no        | yes   |
| `shiftContextMenuSelection`    | function  | no        | yes   |
| `visibleContextMenuItems`      | function  | no        | yes   |

#### src/components/data_table.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `canSortColumn`              | function  | no        | yes   |
| `createDataTableView`        | function  | no        | yes   |
| `DataColumn`                 | interface | yes       | yes   |
| `DataSort`                   | interface | yes       | yes   |
| `DataTableController`        | class     | no        | yes   |
| `DataTableControllerOptions` | interface | yes       | yes   |
| `DataTableInspection`        | interface | yes       | yes   |
| `DataTableState`             | interface | yes       | yes   |
| `DataTableView`              | interface | yes       | yes   |
| `filterDataRows`             | function  | no        | yes   |
| `nextSort`                   | function  | no        | yes   |
| `renderDataTableHeader`      | function  | no        | yes   |
| `renderDataTableRows`        | function  | no        | yes   |
| `sortDataRows`               | function  | no        | yes   |
| `SortDirection`              | type      | yes       | yes   |

#### src/components/empty_state.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `EmptyState`        | class     | no        | yes   |
| `EmptyStateContent` | interface | yes       | yes   |
| `EmptyStateOptions` | interface | yes       | yes   |
| `renderEmptyState`  | function  | no        | yes   |

#### src/components/file_explorer.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `createFileExplorerTree`        | function  | no        | yes   |
| `FileExplorerController`        | class     | no        | yes   |
| `FileExplorerControllerOptions` | interface | yes       | yes   |
| `FileExplorerEntry`             | interface | yes       | yes   |
| `FileExplorerInspection`        | interface | yes       | yes   |
| `FileExplorerNode`              | interface | yes       | yes   |
| `FileExplorerNodeKind`          | type      | yes       | yes   |

#### src/components/frame.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `Frame`                      | class     | no        | yes   |
| `FrameOptions`               | interface | yes       | yes   |
| `FrameUnicodeCharacters`     | const     | no        | yes   |
| `FrameUnicodeCharactersType` | type      | yes       | yes   |

#### src/components/gauge.ts

| Symbol         | Kind      | Type Only | JSDoc |
| -------------- | --------- | --------- | ----- |
| `Gauge`        | class     | no        | yes   |
| `GaugeOptions` | interface | yes       | yes   |
| `renderGauge`  | function  | no        | yes   |

#### src/components/input.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `Input`                  | class     | no        | yes   |
| `InputController`        | class     | no        | yes   |
| `InputControllerOptions` | interface | yes       | yes   |
| `InputEditResult`        | type      | yes       | yes   |
| `InputInspection`        | interface | yes       | yes   |
| `InputOptions`           | interface | yes       | yes   |
| `InputRectangle`         | interface | yes       | yes   |
| `InputTheme`             | interface | yes       | yes   |

#### src/components/interaction.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `hitTestWidgetRegions`    | function  | no        | yes   |
| `pointInWidgetRegion`     | function  | no        | yes   |
| `stackedRowHitRegions`    | function  | no        | yes   |
| `stackedRowIndexAt`       | function  | no        | yes   |
| `WidgetHit`               | interface | yes       | yes   |
| `WidgetHitRegion`         | interface | yes       | yes   |
| `WidgetInteractionMethod` | type      | yes       | yes   |

#### src/components/key_help.ts

| Symbol           | Kind      | Type Only | JSDoc |
| ---------------- | --------- | --------- | ----- |
| `KeyHelp`        | class     | no        | yes   |
| `KeyHelpOptions` | interface | yes       | yes   |
| `renderKeyHelp`  | function  | no        | yes   |

#### src/components/label.ts

| Symbol            | Kind      | Type Only | JSDoc |
| ----------------- | --------- | --------- | ----- |
| `Label`           | class     | no        | yes   |
| `LabelAlign`      | interface | yes       | yes   |
| `labelLineLayout` | function  | no        | yes   |
| `LabelLineLayout` | interface | yes       | yes   |
| `LabelOptions`    | interface | yes       | yes   |
| `LabelRectangle`  | type      | yes       | yes   |

#### src/components/list.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `List`                  | class     | no        | yes   |
| `ListController`        | class     | no        | yes   |
| `ListControllerOptions` | interface | yes       | yes   |
| `ListInspection`        | interface | yes       | yes   |
| `ListOptions`           | interface | yes       | yes   |
| `VirtualRow`            | interface | yes       | yes   |
| `virtualRows`           | function  | no        | yes   |
| `visibleListRows`       | function  | no        | yes   |

#### src/components/log_viewer.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `LogViewer`                  | class     | no        | yes   |
| `LogViewerController`        | class     | no        | yes   |
| `LogViewerControllerOptions` | interface | yes       | yes   |
| `LogViewerInspection`        | interface | yes       | yes   |
| `LogViewerOptions`           | interface | yes       | yes   |
| `visibleLogLines`            | function  | no        | yes   |

#### src/components/menu_bar.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `clampMenuIndex`           | function  | no        | yes   |
| `MenuBar`                  | class     | no        | yes   |
| `MenuBarController`        | class     | no        | yes   |
| `MenuBarControllerOptions` | interface | yes       | yes   |
| `MenuBarInspection`        | interface | yes       | yes   |
| `MenuBarItem`              | interface | yes       | yes   |
| `MenuBarOptions`           | interface | yes       | yes   |
| `menuItemForIndex`         | function  | no        | yes   |
| `renderMenuBar`            | function  | no        | yes   |
| `shiftMenuIndex`           | function  | no        | yes   |

#### src/components/metric_series.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `DEFAULT_METRIC_SERIES_LIMIT`   | const     | no        | yes   |
| `MetricClampRange`              | interface | yes       | yes   |
| `MetricSeriesController`        | class     | no        | yes   |
| `MetricSeriesControllerOptions` | interface | yes       | yes   |
| `MetricSeriesInspection`        | interface | yes       | yes   |
| `metricSeriesStats`             | function  | no        | yes   |
| `MetricSeriesStats`             | interface | yes       | yes   |
| `normalizeMetricLimit`          | function  | no        | yes   |
| `normalizeMetricValue`          | function  | no        | yes   |
| `pushMetricValue`               | function  | no        | yes   |

#### src/components/mod.ts

| Re-export Target                    | Kind | Names |
| ----------------------------------- | ---- | ----- |
| `src/components/box.ts`             | star | -     |
| `src/components/breadcrumbs.ts`     | star | -     |
| `src/components/button.ts`          | star | -     |
| `src/components/catalog.ts`         | star | -     |
| `src/components/chart.ts`           | star | -     |
| `src/components/checkbox.ts`        | star | -     |
| `src/components/command_palette.ts` | star | -     |
| `src/components/combobox.ts`        | star | -     |
| `src/components/context_menu.ts`    | star | -     |
| `src/components/data_table.ts`      | star | -     |
| `src/components/empty_state.ts`     | star | -     |
| `src/components/file_explorer.ts`   | star | -     |
| `src/components/frame.ts`           | star | -     |
| `src/components/gauge.ts`           | star | -     |
| `src/components/input.ts`           | star | -     |
| `src/components/interaction.ts`     | star | -     |
| `src/components/label.ts`           | star | -     |
| `src/components/key_help.ts`        | star | -     |
| `src/components/list.ts`            | star | -     |
| `src/components/log_viewer.ts`      | star | -     |
| `src/components/menu_bar.ts`        | star | -     |
| `src/components/metric_series.ts`   | star | -     |
| `src/components/modal.ts`           | star | -     |
| `src/components/pad.ts`             | star | -     |
| `src/components/progressbar.ts`     | star | -     |
| `src/components/radio_group.ts`     | star | -     |
| `src/components/scroll_area.ts`     | star | -     |
| `src/components/slider.ts`          | star | -     |
| `src/components/sparkline.ts`       | star | -     |
| `src/components/spinner.ts`         | star | -     |
| `src/components/statusbar.ts`       | star | -     |
| `src/components/stepper.ts`         | star | -     |
| `src/components/table.ts`           | star | -     |
| `src/components/tabs.ts`            | star | -     |
| `src/components/terminal_output.ts` | star | -     |
| `src/components/text.ts`            | star | -     |
| `src/components/textbox.ts`         | star | -     |
| `src/components/three_ascii.ts`     | star | -     |
| `src/components/toast.ts`           | star | -     |
| `src/components/tree.ts`            | star | -     |
| `src/components/virtual_list.ts`    | star | -     |

_No direct exported symbols._

#### src/components/modal.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `Modal`                  | class     | no        | yes   |
| `ModalAction`            | interface | yes       | yes   |
| `ModalContent`           | interface | yes       | yes   |
| `modalContentHeight`     | function  | no        | yes   |
| `ModalController`        | class     | no        | yes   |
| `ModalControllerOptions` | interface | yes       | yes   |
| `ModalInspection`        | interface | yes       | yes   |
| `ModalOptions`           | interface | yes       | yes   |
| `ModalTone`              | type      | yes       | yes   |
| `renderModalRows`        | function  | no        | yes   |
| `RenderModalRowsOptions` | interface | yes       | yes   |

#### src/components/pad.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `clampPadCursor`       | function  | no        | yes   |
| `measurePadContent`    | function  | no        | yes   |
| `normalizePadLines`    | function  | no        | yes   |
| `PadContent`           | type      | yes       | yes   |
| `PadContentSize`       | interface | yes       | yes   |
| `PadController`        | class     | no        | yes   |
| `PadControllerOptions` | interface | yes       | yes   |
| `PadCursor`            | interface | yes       | yes   |
| `PadInspection`        | interface | yes       | yes   |
| `PadRevealOptions`     | interface | yes       | yes   |
| `PadViewportRow`       | interface | yes       | yes   |
| `renderPadRows`        | function  | no        | yes   |
| `RenderPadRowsOptions` | interface | yes       | yes   |

#### src/components/progressbar.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `clampProgressValue`           | function  | no        | yes   |
| `ProgressBar`                  | class     | no        | yes   |
| `progressBarCharMap`           | const     | no        | yes   |
| `ProgressBarCharMapType`       | type      | yes       | yes   |
| `ProgressBarController`        | class     | no        | yes   |
| `ProgressBarControllerOptions` | interface | yes       | yes   |
| `ProgressBarDirection`         | type      | yes       | yes   |
| `ProgressBarInspection`        | interface | yes       | yes   |
| `ProgressBarOptions`           | interface | yes       | yes   |
| `ProgressBarOrientation`       | type      | yes       | yes   |
| `ProgressBarTheme`             | interface | yes       | yes   |
| `ProgressBarTrackRectangle`    | interface | yes       | yes   |
| `progressRatio`                | function  | no        | yes   |
| `progressRectangle`            | function  | no        | yes   |
| `progressSmoothLine`           | function  | no        | yes   |

#### src/components/radio_group.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `clampRadioIndex`             | function  | no        | yes   |
| `optionForValue`              | function  | no        | yes   |
| `RadioGroup`                  | class     | no        | yes   |
| `RadioGroupController`        | class     | no        | yes   |
| `RadioGroupControllerOptions` | interface | yes       | yes   |
| `RadioGroupInspection`        | interface | yes       | yes   |
| `RadioGroupOptions`           | interface | yes       | yes   |
| `RadioOption`                 | interface | yes       | yes   |
| `renderRadioGroupRows`        | function  | no        | yes   |
| `shiftRadioIndex`             | function  | no        | yes   |
| `visibleRadioOptions`         | function  | no        | yes   |

#### src/components/scroll_area.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `clampScrollOffset`            | function  | no        | yes   |
| `maxScrollOffset`              | function  | no        | yes   |
| `ScrollArea`                   | class     | no        | yes   |
| `ScrollAreaController`         | class     | no        | yes   |
| `ScrollAreaControllerOptions`  | interface | yes       | yes   |
| `ScrollAreaInspection`         | interface | yes       | yes   |
| `ScrollAreaOptions`            | interface | yes       | yes   |
| `ScrollAreaOverflowInspection` | interface | yes       | yes   |
| `scrollbarGlyph`               | function  | no        | yes   |
| `scrollbarOffsetForPointer`    | function  | no        | yes   |
| `scrollbarThumb`               | function  | no        | yes   |
| `ScrollbarThumb`               | type      | yes       | yes   |
| `scrollOffsetBy`               | function  | no        | yes   |

#### src/components/slider.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `clampSliderValue`        | function  | no        | yes   |
| `Slider`                  | class     | no        | yes   |
| `SliderController`        | class     | no        | yes   |
| `SliderControllerOptions` | interface | yes       | yes   |
| `SliderInspection`        | interface | yes       | yes   |
| `SliderOptions`           | interface | yes       | yes   |
| `SliderOrientation`       | type      | yes       | yes   |
| `SliderTheme`             | interface | yes       | yes   |
| `sliderThumbRectangle`    | function  | no        | yes   |
| `SliderThumbRectangle`    | interface | yes       | yes   |
| `SliderTrackRectangle`    | interface | yes       | yes   |
| `sliderValueAt`           | function  | no        | yes   |
| `sliderValueBy`           | function  | no        | yes   |
| `snapSliderValue`         | function  | no        | yes   |

#### src/components/sparkline.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `renderSparkline`  | function  | no        | yes   |
| `Sparkline`        | class     | no        | yes   |
| `SparklineOptions` | interface | yes       | yes   |

#### src/components/spinner.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `DEFAULT_SPINNER_FRAMES` | const     | no        | yes   |
| `renderSpinner`          | function  | no        | yes   |
| `Spinner`                | class     | no        | yes   |
| `spinnerGlyph`           | function  | no        | yes   |
| `SpinnerOptions`         | interface | yes       | yes   |
| `SpinnerStatus`          | type      | yes       | yes   |

#### src/components/statusbar.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `renderStatusBar`  | function  | no        | yes   |
| `StatusBar`        | class     | no        | yes   |
| `StatusBarOptions` | interface | yes       | yes   |

#### src/components/stepper.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `clampStepperIndex`        | function  | no        | yes   |
| `renderStepper`            | function  | no        | yes   |
| `shiftStepperIndex`        | function  | no        | yes   |
| `stepForIndex`             | function  | no        | yes   |
| `Stepper`                  | class     | no        | yes   |
| `StepperController`        | class     | no        | yes   |
| `StepperControllerOptions` | interface | yes       | yes   |
| `StepperInspection`        | interface | yes       | yes   |
| `StepperOptions`           | interface | yes       | yes   |
| `StepperOrientation`       | type      | yes       | yes   |
| `StepperStep`              | interface | yes       | yes   |

#### src/components/table.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `clampTableRow`              | function  | no        | yes   |
| `Table`                      | class     | no        | yes   |
| `TableController`            | class     | no        | yes   |
| `TableControllerOptions`     | interface | yes       | yes   |
| `TableHeader`                | type      | yes       | yes   |
| `TableInspection`            | interface | yes       | yes   |
| `tableMaxOffset`             | function  | no        | yes   |
| `TableOptions`               | interface | yes       | yes   |
| `TableTheme`                 | interface | yes       | yes   |
| `TableUnicodeCharacters`     | const     | no        | yes   |
| `TableUnicodeCharactersType` | type      | yes       | yes   |
| `tableVisibleCapacity`       | function  | no        | yes   |

#### src/components/tabs.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `clampTabIndex`         | function  | no        | yes   |
| `renderTabs`            | function  | no        | yes   |
| `shiftTabIndex`         | function  | no        | yes   |
| `tabForIndex`           | function  | no        | yes   |
| `TabItem`               | interface | yes       | yes   |
| `Tabs`                  | class     | no        | yes   |
| `TabsController`        | class     | no        | yes   |
| `TabsControllerOptions` | interface | yes       | yes   |
| `TabsInspection`        | interface | yes       | yes   |
| `TabsOptions`           | interface | yes       | yes   |

#### src/components/terminal_output.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `formatTerminalOutputLine`        | function  | no        | yes   |
| `TerminalOutputController`        | class     | no        | yes   |
| `TerminalOutputControllerOptions` | interface | yes       | yes   |
| `TerminalOutputInspection`        | interface | yes       | yes   |
| `TerminalOutputLine`              | interface | yes       | yes   |
| `TerminalOutputSource`            | type      | yes       | yes   |
| `visibleTerminalOutputLines`      | function  | no        | yes   |

#### src/components/text.ts

| Symbol        | Kind      | Type Only | JSDoc |
| ------------- | --------- | --------- | ----- |
| `Text`        | class     | no        | yes   |
| `TextOptions` | interface | yes       | yes   |

#### src/components/textbox.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `CursorPosition`           | interface | yes       | yes   |
| `TextBox`                  | class     | no        | yes   |
| `TextBoxController`        | class     | no        | yes   |
| `TextBoxControllerOptions` | interface | yes       | yes   |
| `TextBoxEditResult`        | type      | yes       | yes   |
| `TextBoxInspection`        | interface | yes       | yes   |
| `TextBoxOptions`           | interface | yes       | yes   |
| `TextBoxTheme`             | interface | yes       | yes   |
| `textBoxVisualCursor`      | function  | no        | yes   |
| `TextBoxVisualCursor`      | interface | yes       | yes   |
| `TextBoxVisualLine`        | interface | yes       | yes   |
| `TextLineCache`            | class     | no        | yes   |
| `TextLineCacheInspection`  | interface | yes       | yes   |
| `wrapTextBoxLines`         | function  | no        | yes   |

#### src/components/three_ascii.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `ThreeAscii`        | class     | no        | yes   |
| `ThreeAsciiOptions` | interface | yes       | yes   |

#### src/components/toast.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `renderToast`                 | function  | no        | yes   |
| `ToastLevel`                  | type      | yes       | yes   |
| `ToastMessage`                | interface | yes       | yes   |
| `ToastStack`                  | class     | no        | yes   |
| `ToastStackController`        | class     | no        | yes   |
| `ToastStackControllerOptions` | interface | yes       | yes   |
| `ToastStackInspection`        | interface | yes       | yes   |
| `ToastStackOptions`           | interface | yes       | yes   |

#### src/components/tree.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `flattenTree`           | function  | no        | yes   |
| `flattenTreeRows`       | function  | no        | yes   |
| `inspectTreeRow`        | function  | no        | yes   |
| `Tree`                  | class     | no        | yes   |
| `TreeController`        | class     | no        | yes   |
| `TreeControllerOptions` | interface | yes       | yes   |
| `TreeInspection`        | interface | yes       | yes   |
| `TreeNode`              | interface | yes       | yes   |
| `TreeOptions`           | interface | yes       | yes   |
| `TreeRow`               | interface | yes       | yes   |
| `TreeRowInspection`     | interface | yes       | yes   |

#### src/components/virtual_list.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `renderVirtualListRows`        | function  | no        | yes   |
| `VirtualList`                  | class     | no        | yes   |
| `VirtualListController`        | class     | no        | yes   |
| `VirtualListControllerOptions` | interface | yes       | yes   |
| `VirtualListInspection`        | interface | yes       | yes   |
| `VirtualListOptions`           | interface | yes       | yes   |
| `VirtualListRow`               | interface | yes       | yes   |
| `virtualListRows`              | function  | no        | yes   |

#### src/controls.ts

| Symbol                   | Kind     | Type Only | JSDoc |
| ------------------------ | -------- | --------- | ----- |
| `handleKeyboardControls` | function | no        | yes   |
| `handleMouseControls`    | function | no        | yes   |

#### src/event_emitter.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `EmitterEvent`           | type      | yes       | yes   |
| `EventEmitter`           | class     | no        | yes   |
| `EventEmitterInspection` | interface | yes       | yes   |
| `EventListener`          | type      | yes       | yes   |
| `EventRecord`            | type      | yes       | yes   |

#### src/focus.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindFocusNavigation`    | function  | no        | yes   |
| `Focusable`              | interface | yes       | yes   |
| `FocusManager`           | class     | no        | yes   |
| `FocusManagerInspection` | interface | yes       | yes   |
| `FocusNavigationOptions` | interface | yes       | yes   |
| `FocusNavigationTarget`  | interface | yes       | yes   |
| `FocusScope`             | class     | no        | yes   |

#### src/grwizard_themes.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `grWizardThemeOptions`           | function  | no        | yes   |
| `grWizardThemePacks`             | const     | no        | yes   |
| `GrWizardThemePalette`           | interface | yes       | yes   |
| `grWizardThemePaletteDefinition` | function  | no        | yes   |
| `grWizardThemePalettes`          | const     | no        | yes   |

#### src/input_reader/mod.ts

| Symbol             | Kind     | Type Only | JSDoc |
| ------------------ | -------- | --------- | ----- |
| `emitInputEvents`  | function | no        | yes   |
| `InputEventRecord` | type     | yes       | yes   |

#### src/input.ts

| Symbol        | Kind     | Type Only | JSDoc |
| ------------- | -------- | --------- | ----- |
| `handleInput` | function | no        | yes   |

#### src/keymap.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `bindingId`            | function  | no        | yes   |
| `formatKeyBinding`     | function  | no        | yes   |
| `KeyBinding`           | interface | yes       | yes   |
| `KeyBindingInspection` | interface | yes       | yes   |
| `KeymapInspection`     | interface | yes       | yes   |
| `KeymapRegistry`       | class     | no        | yes   |

#### src/layout/engine.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createLayoutEngine`           | function  | no        | yes   |
| `LayoutEngine`                 | class     | no        | yes   |
| `LayoutEngineOptions`          | interface | yes       | yes   |
| `LayoutRunOptions`             | interface | yes       | yes   |
| `LayoutSolverUnsupportedError` | class     | no        | yes   |
| `layoutTree`                   | function  | no        | yes   |

#### src/layout/errors.ts

| Symbol                              | Kind  | Type Only | JSDoc |
| ----------------------------------- | ----- | --------- | ----- |
| `LayoutInvalidElementsPatternError` | class | no        | yes   |
| `LayoutMissingElementError`         | class | no        | yes   |

#### src/layout/flex_layout.ts

| Symbol          | Kind      | Type Only | JSDoc |
| --------------- | --------- | --------- | ----- |
| `FlexDirection` | type      | yes       | yes   |
| `FlexItem`      | interface | yes       | yes   |
| `flexRects`     | function  | no        | yes   |

#### src/layout/grid_layout.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `GridLayout`        | class     | no        | yes   |
| `GridLayoutElement` | interface | yes       | yes   |
| `GridLayoutOptions` | interface | yes       | yes   |

#### src/layout/horizontal_layout.ts

| Symbol             | Kind  | Type Only | JSDoc |
| ------------------ | ----- | --------- | ----- |
| `HorizontalLayout` | class | no        | yes   |

#### src/layout/measurement.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `LayoutMeasurementCache`        | class     | no        | yes   |
| `LayoutMeasurementCacheEntry`   | interface | yes       | yes   |
| `LayoutMeasurementCacheOptions` | interface | yes       | yes   |
| `LayoutMeasurementCacheStats`   | interface | yes       | yes   |

#### src/layout/mod.ts

| Re-export Target                  | Kind | Names |
| --------------------------------- | ---- | ----- |
| `src/layout/errors.ts`            | star | -     |
| `src/layout/horizontal_layout.ts` | star | -     |
| `src/layout/types.ts`             | star | -     |
| `src/layout/vertical_layout.ts`   | star | -     |
| `src/layout/grid_layout.ts`       | star | -     |
| `src/layout/flex_layout.ts`       | star | -     |
| `src/layout/responsive.ts`        | star | -     |
| `src/layout/split_pane.ts`        | star | -     |
| `src/layout/recipe.ts`            | star | -     |
| `src/layout/window_manager.ts`    | star | -     |
| `src/layout/overlay.ts`           | star | -     |
| `src/layout/style.ts`             | star | -     |
| `src/layout/solver.ts`            | star | -     |
| `src/layout/engine.ts`            | star | -     |
| `src/layout/measurement.ts`       | star | -     |
| `src/layout/solvers/simple.ts`    | star | -     |

_No direct exported symbols._

#### src/layout/overlay.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `clampRectToBounds`        | function  | no        | yes   |
| `hitTestOverlaySurfaces`   | function  | no        | yes   |
| `OverlayHit`               | interface | yes       | yes   |
| `OverlayKind`              | type      | yes       | yes   |
| `OverlayLayer`             | type      | yes       | yes   |
| `overlayLayerZIndex`       | function  | no        | yes   |
| `OverlayPoint`             | interface | yes       | yes   |
| `OverlayPointerResult`     | interface | yes       | yes   |
| `OverlaySize`              | interface | yes       | yes   |
| `OverlayStackController`   | class     | no        | yes   |
| `OverlayStackInspection`   | interface | yes       | yes   |
| `OverlayStackOptions`      | interface | yes       | yes   |
| `OverlaySurface`           | interface | yes       | yes   |
| `OverlaySurfaceInspection` | interface | yes       | yes   |
| `placePopover`             | function  | no        | yes   |
| `pointInRect`              | function  | no        | yes   |
| `PopoverPlacement`         | type      | yes       | yes   |
| `PopoverPlacementOptions`  | interface | yes       | yes   |
| `sortOverlaySurfaces`      | function  | no        | yes   |

#### src/layout/recipe.ts

| Symbol                             | Kind      | Type Only | JSDoc |
| ---------------------------------- | --------- | --------- | ----- |
| `createLayoutRecipeController`     | function  | no        | yes   |
| `formatLayoutRecipeMarkdown`       | function  | no        | yes   |
| `inspectLayoutRecipe`              | function  | no        | yes   |
| `LayoutRecipeBreakpointInspection` | interface | yes       | yes   |
| `LayoutRecipeController`           | class     | no        | yes   |
| `LayoutRecipeControllerInspection` | interface | yes       | yes   |
| `LayoutRecipeInspection`           | interface | yes       | yes   |
| `LayoutRecipeMarkdownOptions`      | interface | yes       | yes   |
| `layoutRecipeSlots`                | function  | no        | yes   |
| `LayoutRegion`                     | type      | yes       | yes   |
| `LayoutRegionDirection`            | type      | yes       | yes   |
| `LayoutRegionDock`                 | interface | yes       | yes   |
| `LayoutRegionEdge`                 | type      | yes       | yes   |
| `LayoutRegionLeaf`                 | interface | yes       | yes   |
| `LayoutRegionSplit`                | interface | yes       | yes   |
| `ResolvedLayoutRecipe`             | interface | yes       | yes   |
| `resolveLayoutRecipe`              | function  | no        | yes   |
| `ResponsiveLayoutRecipe`           | interface | yes       | yes   |

#### src/layout/responsive.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `adaptiveGrid`         | function  | no        | yes   |
| `AdaptiveGrid`         | interface | yes       | yes   |
| `adaptiveGridItemRect` | function  | no        | yes   |
| `AdaptiveGridOptions`  | interface | yes       | yes   |
| `adaptiveGridPage`     | function  | no        | yes   |
| `AdaptiveGridPage`     | interface | yes       | yes   |
| `Breakpoint`           | interface | yes       | yes   |
| `dockRect`             | function  | no        | yes   |
| `insetRect`            | function  | no        | yes   |
| `resolveBreakpoint`    | function  | no        | yes   |
| `splitRect`            | function  | no        | yes   |
| `TileLayout`           | interface | yes       | yes   |
| `TileLayoutOptions`    | interface | yes       | yes   |
| `tileRects`            | function  | no        | yes   |

#### src/layout/solver.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `cloneLayoutNode`            | function  | no        | yes   |
| `ComputedLayoutBox`          | interface | yes       | yes   |
| `computedLayoutBoxOverflow`  | function  | no        | yes   |
| `createLayoutNode`           | function  | no        | yes   |
| `flattenComputedLayoutBoxes` | function  | no        | yes   |
| `LayoutIntrinsicSize`        | interface | yes       | yes   |
| `LayoutNode`                 | interface | yes       | yes   |
| `LayoutNodeOptions`          | interface | yes       | yes   |
| `LayoutSolver`               | interface | yes       | yes   |
| `LayoutSolverInput`          | interface | yes       | yes   |
| `LayoutSolverResult`         | interface | yes       | yes   |
| `mapLayoutBoxes`             | function  | no        | yes   |
| `walkLayoutNodes`            | function  | no        | yes   |

#### src/layout/solvers/simple.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `simpleLayoutSolver`        | function  | no        | yes   |
| `SimpleLayoutSolver`        | class     | no        | yes   |
| `SimpleLayoutSolverOptions` | interface | yes       | yes   |

#### src/layout/split_pane.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `createSplitPaneController`  | function  | no        | yes   |
| `resizeSplitPane`            | function  | no        | yes   |
| `resizeSplitPaneRatio`       | function  | no        | yes   |
| `SplitPaneController`        | class     | no        | yes   |
| `SplitPaneControllerOptions` | interface | yes       | yes   |
| `SplitPaneDirection`         | type      | yes       | yes   |
| `SplitPaneOptions`           | interface | yes       | yes   |
| `splitPaneRects`             | function  | no        | yes   |
| `SplitPaneRects`             | interface | yes       | yes   |
| `SplitPaneResizeMode`        | type      | yes       | yes   |

#### src/layout/style.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `applyLayoutDeclaration`     | function  | no        | yes   |
| `applyLayoutDeclarations`    | function  | no        | yes   |
| `AUTO_LAYOUT_LENGTH`         | const     | no        | yes   |
| `autoLength`                 | function  | no        | yes   |
| `BoxEdges`                   | interface | yes       | yes   |
| `cellLength`                 | function  | no        | yes   |
| `clampLayoutSize`            | function  | no        | yes   |
| `cloneComputedLayoutStyle`   | function  | no        | yes   |
| `ComputedLayoutStyle`        | interface | yes       | yes   |
| `defaultComputedLayoutStyle` | function  | no        | yes   |
| `frLength`                   | function  | no        | yes   |
| `LayoutAlignItems`           | type      | yes       | yes   |
| `LayoutDisplay`              | type      | yes       | yes   |
| `LayoutFlexDirection`        | type      | yes       | yes   |
| `LayoutFlexWrap`             | type      | yes       | yes   |
| `LayoutGridAutoFlow`         | type      | yes       | yes   |
| `LayoutGridPlacement`        | interface | yes       | yes   |
| `LayoutJustifyContent`       | type      | yes       | yes   |
| `LayoutLengthValue`          | interface | yes       | yes   |
| `LayoutOverflow`             | type      | yes       | yes   |
| `LayoutPosition`             | type      | yes       | yes   |
| `LayoutSelfAlignment`        | type      | yes       | yes   |
| `LayoutVisibility`           | type      | yes       | yes   |
| `parseBoxEdges`              | function  | no        | yes   |
| `parseGridPlacement`         | function  | no        | yes   |
| `parseGridTrackList`         | function  | no        | yes   |
| `parseLayoutInteger`         | function  | no        | yes   |
| `parseLayoutLength`          | function  | no        | yes   |
| `percentLength`              | function  | no        | yes   |
| `resolveLayoutLength`        | function  | no        | yes   |
| `ZERO_BOX_EDGES`             | const     | no        | yes   |

#### src/layout/types.ts

| Symbol          | Kind      | Type Only | JSDoc |
| --------------- | --------- | --------- | ----- |
| `Layout`        | interface | yes       | yes   |
| `LayoutElement` | interface | yes       | yes   |
| `LayoutOptions` | interface | yes       | yes   |

#### src/layout/vertical_layout.ts

| Symbol           | Kind  | Type Only | JSDoc |
| ---------------- | ----- | --------- | ----- |
| `VerticalLayout` | class | no        | yes   |

#### src/layout/window_manager.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `WINDOW_MANAGER_LAYER_Z_INDEX`  | const     | no        | yes   |
| `WindowManagerController`       | class     | no        | yes   |
| `WindowManagerLayer`            | type      | yes       | yes   |
| `WindowManagerLayoutInspection` | interface | yes       | yes   |
| `WindowManagerLayoutOptions`    | interface | yes       | yes   |
| `WindowManagerOptions`          | interface | yes       | yes   |
| `WindowManagerWindow`           | interface | yes       | yes   |
| `WindowManagerWindowInspection` | interface | yes       | yes   |
| `WindowManagerWindowState`      | type      | yes       | yes   |
| `windowManagerZOrder`           | function  | no        | yes   |

#### src/markup/cascade.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `applyCssCascade`        | function  | no        | yes   |
| `ApplyCssCascadeOptions` | interface | yes       | yes   |
| `matchesCssMedia`        | function  | no        | yes   |
| `matchesCssSelector`     | function  | no        | yes   |
| `resolveCssVariables`    | function  | no        | yes   |
| `TuiCssNodeState`        | type      | yes       | yes   |
| `TuiCssViewport`         | interface | yes       | yes   |

#### src/markup/css.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `cssSelectorSpecificity` | function  | no        | yes   |
| `parseCssDeclarations`   | function  | no        | yes   |
| `parseCssMediaQuery`     | function  | no        | yes   |
| `parseCssStylesheet`     | function  | no        | yes   |
| `selectorParts`          | function  | no        | yes   |
| `TuiCssDeclaration`      | interface | yes       | yes   |
| `TuiCssMediaCondition`   | interface | yes       | yes   |
| `TuiCssMediaFeature`     | type      | yes       | yes   |
| `TuiCssMediaQuery`       | interface | yes       | yes   |
| `TuiCssRule`             | interface | yes       | yes   |
| `TuiCssStylesheet`       | interface | yes       | yes   |

#### src/markup/demo_fixtures.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `createHtmlCssLayoutDemo`   | function  | no        | yes   |
| `HTML_CSS_LAYOUT_OPTION_ID` | const     | no        | yes   |
| `HTML_CSS_LAYOUT_WINDOW_ID` | const     | no        | yes   |
| `htmlCssLayoutDemoBoxLabel` | function  | no        | yes   |
| `htmlCssLayoutDemoCss`      | const     | no        | yes   |
| `htmlCssLayoutDemoMarkup`   | const     | no        | yes   |
| `HtmlCssLayoutDemoOptions`  | interface | yes       | yes   |

#### src/markup/html.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `parseTuiMarkup`        | function  | no        | yes   |
| `TuiMarkupDocument`     | interface | yes       | yes   |
| `TuiMarkupParseOptions` | interface | yes       | yes   |

#### src/markup/hydrate.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `createMarkupLayout`  | function  | no        | yes   |
| `MarkupLayoutOptions` | interface | yes       | yes   |
| `MarkupLayoutResult`  | interface | yes       | yes   |

#### src/markup/mod.ts

| Re-export Target              | Kind | Names |
| ----------------------------- | ---- | ----- |
| `src/markup/cascade.ts`       | star | -     |
| `src/markup/css.ts`           | star | -     |
| `src/markup/demo_fixtures.ts` | star | -     |
| `src/markup/html.ts`          | star | -     |
| `src/markup/hydrate.ts`       | star | -     |
| `src/markup/widgets.ts`       | star | -     |

_No direct exported symbols._

#### src/markup/widgets.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createDefaultMarkupWidgetRegistry` | function  | no        | yes   |
| `dispatchMarkupWidgetEvent`         | function  | no        | yes   |
| `HydratedMarkupWidget`              | interface | yes       | yes   |
| `HydratedMarkupWidgetInspection`    | interface | yes       | yes   |
| `hydrateMarkupWidgets`              | function  | no        | yes   |
| `MarkupWidgetController`            | type      | yes       | yes   |
| `MarkupWidgetDescriptor`            | interface | yes       | yes   |
| `MarkupWidgetEvent`                 | type      | yes       | yes   |
| `MarkupWidgetFactory`               | type      | yes       | yes   |
| `MarkupWidgetFactoryContext`        | interface | yes       | yes   |
| `MarkupWidgetHydration`             | class     | no        | yes   |
| `MarkupWidgetHydrationInspection`   | interface | yes       | yes   |
| `MarkupWidgetHydrationOptions`      | interface | yes       | yes   |
| `MarkupWidgetHydrationRegistry`     | class     | no        | yes   |
| `MarkupWidgetKind`                  | type      | yes       | yes   |

#### src/perf/benchmark.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `BenchmarkCase`                   | interface | yes       | yes   |
| `BenchmarkCaseInspection`         | interface | yes       | yes   |
| `BenchmarkCatalogInspection`      | interface | yes       | yes   |
| `BenchmarkCatalogMarkdownOptions` | interface | yes       | yes   |
| `BenchmarkCatalogQuery`           | interface | yes       | yes   |
| `BenchmarkCatalogReport`          | interface | yes       | yes   |
| `BenchmarkCatalogReportOptions`   | interface | yes       | yes   |
| `BenchmarkResult`                 | interface | yes       | yes   |
| `BenchmarkRunner`                 | class     | no        | yes   |
| `BenchmarkRunnerOptions`          | interface | yes       | yes   |
| `BenchmarkSummary`                | interface | yes       | yes   |
| `createBenchmarkCatalogReport`    | function  | no        | yes   |
| `formatBenchmarkCatalogMarkdown`  | function  | no        | yes   |
| `formatBenchmarkResults`          | function  | no        | yes   |
| `formatBenchmarkSummary`          | function  | no        | yes   |
| `inspectBenchmarkCase`            | function  | no        | yes   |
| `inspectBenchmarkCatalog`         | function  | no        | yes   |
| `queryBenchmarkCases`             | function  | no        | yes   |
| `summarizeBenchmarkResults`       | function  | no        | yes   |

#### src/perf/mod.ts

| Re-export Target        | Kind | Names |
| ----------------------- | ---- | ----- |
| `src/perf/benchmark.ts` | star | -     |

_No direct exported symbols._

#### src/runtime/capabilities.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createRuntimePlan`            | function  | no        | yes   |
| `detectRuntimeCapabilities`    | function  | no        | yes   |
| `formatRuntimeCapabilities`    | function  | no        | yes   |
| `formatRuntimePlan`            | function  | no        | yes   |
| `RuntimeCapabilities`          | interface | yes       | yes   |
| `runtimeCapabilityEntries`     | function  | no        | yes   |
| `RuntimeCapabilityEntry`       | interface | yes       | yes   |
| `RuntimeCapabilityId`          | type      | yes       | yes   |
| `RuntimeCapabilitySummary`     | interface | yes       | yes   |
| `RuntimePlan`                  | interface | yes       | yes   |
| `RuntimePlanDecision`          | interface | yes       | yes   |
| `RuntimePlanOptions`           | interface | yes       | yes   |
| `RuntimeRendererStrategy`      | type      | yes       | yes   |
| `RuntimeStorageStrategy`       | type      | yes       | yes   |
| `RuntimeWorkerStrategy`        | type      | yes       | yes   |
| `summarizeRuntimeCapabilities` | function  | no        | yes   |

#### src/runtime/data_pipeline_bindings.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `bindDataPipeline`              | function  | no        | yes   |
| `DataPipelineBinding`           | interface | yes       | yes   |
| `DataPipelineBindingInspection` | interface | yes       | yes   |
| `DataPipelineBindingOptions`    | interface | yes       | yes   |

#### src/runtime/data_pipeline.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `CachedDataPipeline`           | class     | no        | yes   |
| `CachedDataPipelineInspection` | interface | yes       | yes   |
| `CachedDataPipelineOptions`    | interface | yes       | yes   |
| `createCachedDataPipeline`     | function  | no        | yes   |
| `DataPipelineAbortError`       | class     | no        | yes   |
| `DataPipelineCacheKey`         | type      | yes       | yes   |
| `DataPipelineContext`          | interface | yes       | yes   |
| `DataPipelineOptions`          | interface | yes       | yes   |
| `DataTransform`                | type      | yes       | yes   |
| `filterRows`                   | function  | no        | yes   |
| `LatestDataPipeline`           | class     | no        | yes   |
| `LatestPipelineResult`         | interface | yes       | yes   |
| `mapRows`                      | function  | no        | yes   |
| `runDataPipeline`              | function  | no        | yes   |
| `sliceRows`                    | function  | no        | yes   |
| `sortRows`                     | function  | no        | yes   |
| `WorkerPayloadMapper`          | type      | yes       | yes   |
| `WorkerTaskRunner`             | interface | yes       | yes   |
| `workerTransform`              | function  | no        | yes   |

#### src/runtime/data_query.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `createDataQueryController`  | function  | no        | yes   |
| `DataQueryController`        | class     | no        | yes   |
| `DataQueryControllerOptions` | interface | yes       | yes   |
| `DataQueryFilters`           | type      | yes       | yes   |
| `DataQueryInspection`        | interface | yes       | yes   |
| `DataQueryParams`            | interface | yes       | yes   |
| `DataQueryResult`            | interface | yes       | yes   |
| `DataQuerySort`              | interface | yes       | yes   |
| `DataQuerySortDirection`     | type      | yes       | yes   |
| `LocalDataQueryOptions`      | interface | yes       | yes   |
| `nextDataQuerySort`          | function  | no        | yes   |
| `normalizeDataQueryParams`   | function  | no        | yes   |
| `NormalizedDataQueryParams`  | interface | yes       | yes   |
| `pageDataQueryRows`          | function  | no        | yes   |
| `queryLocalData`             | function  | no        | yes   |

#### src/runtime/diagnostics.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `DiagnosticEntry`               | interface | yes       | yes   |
| `DiagnosticInput`               | type      | yes       | yes   |
| `DiagnosticListener`            | type      | yes       | yes   |
| `DiagnosticsCollector`          | class     | no        | yes   |
| `DiagnosticSeverity`            | type      | yes       | yes   |
| `DiagnosticsInspection`         | interface | yes       | yes   |
| `DiagnosticStatusFormatOptions` | interface | yes       | yes   |
| `DiagnosticStatusSummary`       | interface | yes       | yes   |
| `formatDiagnostics`             | function  | no        | yes   |
| `formatDiagnosticsMarkdown`     | function  | no        | yes   |
| `formatDiagnosticStatus`        | function  | no        | yes   |
| `summarizeDiagnostics`          | function  | no        | yes   |

#### src/runtime/graphics_surface.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `createKittyGraphicsSurface`  | function  | no        | yes   |
| `createNoopGraphicsSurface`   | function  | no        | yes   |
| `GraphicsClearScope`          | type      | yes       | yes   |
| `GraphicsDeleteMode`          | type      | yes       | yes   |
| `GraphicsHandle`              | interface | yes       | yes   |
| `GraphicsImage`               | interface | yes       | yes   |
| `GraphicsImageEncoding`       | type      | yes       | yes   |
| `GraphicsPlacement`           | interface | yes       | yes   |
| `GraphicsSurface`             | interface | yes       | yes   |
| `GraphicsSurfaceInspection`   | interface | yes       | yes   |
| `GraphicsSurfaceKind`         | type      | yes       | yes   |
| `GraphicsSurfaceWriter`       | interface | yes       | yes   |
| `KittyGraphicsSurface`        | class     | no        | yes   |
| `KittyGraphicsSurfaceOptions` | interface | yes       | yes   |
| `NoopGraphicsSurface`         | class     | no        | yes   |

#### src/runtime/kitty_graphics.ts

| Symbol                                | Kind      | Type Only | JSDoc |
| ------------------------------------- | --------- | --------- | ----- |
| `chunkKittyGraphicsCommand`           | function  | no        | yes   |
| `createKittyGraphicsDeleteCommand`    | function  | no        | yes   |
| `createKittyGraphicsTransmitCommands` | function  | no        | yes   |
| `detectKittyGraphicsCapability`       | function  | no        | yes   |
| `encodeKittyGraphicsCommand`          | function  | no        | yes   |
| `encodeKittyGraphicsControl`          | function  | no        | yes   |
| `encodeKittyGraphicsPayload`          | function  | no        | yes   |
| `inspectKittyGraphicsCommand`         | function  | no        | yes   |
| `KITTY_GRAPHICS_END`                  | const     | no        | yes   |
| `KITTY_GRAPHICS_START`                | const     | no        | yes   |
| `KittyGraphicsAction`                 | type      | yes       | yes   |
| `KittyGraphicsCapability`             | interface | yes       | yes   |
| `KittyGraphicsChunkOptions`           | interface | yes       | yes   |
| `KittyGraphicsCommandInspection`      | interface | yes       | yes   |
| `KittyGraphicsCommandOptions`         | interface | yes       | yes   |
| `KittyGraphicsControl`                | type      | yes       | yes   |
| `KittyGraphicsControlValue`           | type      | yes       | yes   |
| `KittyGraphicsDeleteOptions`          | interface | yes       | yes   |
| `KittyGraphicsDetectionOptions`       | interface | yes       | yes   |
| `KittyGraphicsFormat`                 | type      | yes       | yes   |
| `KittyGraphicsMode`                   | type      | yes       | yes   |
| `KittyGraphicsQuietMode`              | type      | yes       | yes   |
| `KittyGraphicsTransmissionMedium`     | type      | yes       | yes   |
| `KittyGraphicsTransmitOptions`        | interface | yes       | yes   |
| `wrapKittyGraphicsForTmux`            | function  | no        | yes   |

#### src/runtime/mod.ts

| Re-export Target                           | Kind | Names |
| ------------------------------------------ | ---- | ----- |
| `src/runtime/capabilities.ts`              | star | -     |
| `src/runtime/data_pipeline.ts`             | star | -     |
| `src/runtime/data_pipeline_bindings.ts`    | star | -     |
| `src/runtime/data_query.ts`                | star | -     |
| `src/runtime/diagnostics.ts`               | star | -     |
| `src/runtime/graphics_surface.ts`          | star | -     |
| `src/runtime/kitty_graphics.ts`            | star | -     |
| `src/runtime/profiles.ts`                  | star | -     |
| `src/runtime/renderer_backends.ts`         | star | -     |
| `src/runtime/resource.ts`                  | star | -     |
| `src/runtime/resource_bindings.ts`         | star | -     |
| `src/runtime/render_loop.ts`               | star | -     |
| `src/runtime/scheduler.ts`                 | star | -     |
| `src/runtime/storage.ts`                   | star | -     |
| `src/runtime/telemetry.ts`                 | star | -     |
| `src/runtime/terminal_capabilities.ts`     | star | -     |
| `src/runtime/terminal_backend.ts`          | star | -     |
| `src/runtime/terminal_backend_registry.ts` | star | -     |
| `src/runtime/pty_backend.ts`               | star | -     |
| `src/runtime/terminal_templates.ts`        | star | -     |
| `src/runtime/terminal_status.ts`           | star | -     |
| `src/runtime/process_session.ts`           | star | -     |
| `src/runtime/terminal_screen.ts`           | star | -     |
| `src/runtime/terminal_shell.ts`            | star | -     |
| `src/runtime/terminal_session.ts`          | star | -     |
| `src/runtime/terminal_workspace.ts`        | star | -     |
| `src/runtime/worker_pool.ts`               | star | -     |

_No direct exported symbols._

#### src/runtime/process_session.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `formatProcessCommandLine`        | function  | no        | yes   |
| `ProcessSessionChild`             | interface | yes       | yes   |
| `ProcessSessionCommand`           | interface | yes       | yes   |
| `ProcessSessionController`        | class     | no        | yes   |
| `ProcessSessionControllerOptions` | interface | yes       | yes   |
| `ProcessSessionExit`              | interface | yes       | yes   |
| `ProcessSessionInspection`        | interface | yes       | yes   |
| `ProcessSessionSpawner`           | type      | yes       | yes   |
| `ProcessSessionStatus`            | type      | yes       | yes   |

#### src/runtime/profiles.ts

| Symbol                                 | Kind      | Type Only | JSDoc |
| -------------------------------------- | --------- | --------- | ----- |
| `createRuntimeProfile`                 | function  | no        | yes   |
| `createRuntimeProfileCatalogReport`    | function  | no        | yes   |
| `createRuntimeProfileController`       | function  | no        | yes   |
| `createRuntimeProfileRegistry`         | function  | no        | yes   |
| `findRuntimeProfile`                   | function  | no        | yes   |
| `formatRuntimeProfileCatalogMarkdown`  | function  | no        | yes   |
| `inspectRuntimeProfileCatalog`         | function  | no        | yes   |
| `queryRuntimeProfiles`                 | function  | no        | yes   |
| `RuntimeProfile`                       | class     | no        | yes   |
| `RuntimeProfileCatalogInspection`      | interface | yes       | yes   |
| `RuntimeProfileCatalogMarkdownOptions` | interface | yes       | yes   |
| `RuntimeProfileCatalogQuery`           | interface | yes       | yes   |
| `RuntimeProfileCatalogReport`          | interface | yes       | yes   |
| `RuntimeProfileCatalogReportOptions`   | interface | yes       | yes   |
| `RuntimeProfileController`             | class     | no        | yes   |
| `RuntimeProfileControllerInspection`   | interface | yes       | yes   |
| `RuntimeProfileControllerOptions`      | interface | yes       | yes   |
| `RuntimeProfileDefinition`             | interface | yes       | yes   |
| `runtimeProfileDefinitions`            | const     | no        | yes   |
| `RuntimeProfileInspection`             | interface | yes       | yes   |
| `RuntimeProfileNotFoundError`          | class     | no        | yes   |
| `RuntimeProfilePlanInspection`         | interface | yes       | yes   |
| `RuntimeProfileRegistry`               | class     | no        | yes   |
| `runtimeProfiles`                      | function  | no        | yes   |

#### src/runtime/pty_backend.ts

| Symbol                                         | Kind      | Type Only | JSDoc |
| ---------------------------------------------- | --------- | --------- | ----- |
| `createSigmaPtyTerminalBackend`                | function  | no        | yes   |
| `createSigmaPtyTerminalBackendFromConstructor` | function  | no        | yes   |
| `createSigmaPtyTerminalBackendProvider`        | function  | no        | yes   |
| `loadSigmaPtyModule`                           | function  | no        | yes   |
| `LoadSigmaPtyModuleOptions`                    | interface | yes       | yes   |
| `probeSigmaPtyAvailability`                    | function  | no        | yes   |
| `SigmaPtyCommandOptions`                       | interface | yes       | yes   |
| `SigmaPtyConstructor`                          | interface | yes       | yes   |
| `SigmaPtyLike`                                 | interface | yes       | yes   |
| `SigmaPtyModule`                               | interface | yes       | yes   |
| `SigmaPtySize`                                 | interface | yes       | yes   |
| `SigmaPtyTerminalBackendOptions`               | interface | yes       | yes   |

#### src/runtime/render_loop.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createRenderLoop`             | function  | no        | yes   |
| `defaultRenderLoopTimer`       | const     | no        | yes   |
| `MicrotaskScheduler`           | class     | no        | yes   |
| `MicrotaskSchedulerInspection` | interface | yes       | yes   |
| `MicrotaskSchedulerOptions`    | interface | yes       | yes   |
| `RenderLoop`                   | class     | no        | yes   |
| `RenderLoopFrame`              | interface | yes       | yes   |
| `RenderLoopInspection`         | interface | yes       | yes   |
| `RenderLoopOptions`            | interface | yes       | yes   |
| `RenderLoopTimer`              | interface | yes       | yes   |

#### src/runtime/renderer_backends.ts

| Symbol                                        | Kind      | Type Only | JSDoc |
| --------------------------------------------- | --------- | --------- | ----- |
| `createRuntimeRendererBackend`                | function  | no        | yes   |
| `createRuntimeRendererBackendCatalogReport`   | function  | no        | yes   |
| `createRuntimeRendererBackendController`      | function  | no        | yes   |
| `createRuntimeRendererBackendRegistry`        | function  | no        | yes   |
| `formatRuntimeRendererBackendCatalogMarkdown` | function  | no        | yes   |
| `inspectRuntimeRendererBackendCatalog`        | function  | no        | yes   |
| `inspectRuntimeRendererBackends`              | function  | no        | yes   |
| `queryRuntimeRendererBackends`                | function  | no        | yes   |
| `RuntimeRendererBackend`                      | class     | no        | yes   |
| `RuntimeRendererBackendCatalogInspection`     | interface | yes       | yes   |
| `RuntimeRendererBackendCatalogOptions`        | interface | yes       | yes   |
| `RuntimeRendererBackendCatalogReport`         | interface | yes       | yes   |
| `RuntimeRendererBackendController`            | class     | no        | yes   |
| `RuntimeRendererBackendControllerInspection`  | interface | yes       | yes   |
| `RuntimeRendererBackendControllerOptions`     | interface | yes       | yes   |
| `RuntimeRendererBackendDefinition`            | interface | yes       | yes   |
| `runtimeRendererBackendDefinitions`           | const     | no        | yes   |
| `RuntimeRendererBackendInspection`            | interface | yes       | yes   |
| `RuntimeRendererBackendMarkdownOptions`       | interface | yes       | yes   |
| `RuntimeRendererBackendQuery`                 | interface | yes       | yes   |
| `RuntimeRendererBackendRegistry`              | class     | no        | yes   |
| `runtimeRendererBackends`                     | function  | no        | yes   |
| `RuntimeRendererBackendSelectionOptions`      | interface | yes       | yes   |
| `selectRuntimeRendererBackend`                | function  | no        | yes   |

#### src/runtime/resource_bindings.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindResourceParams`              | function  | no        | yes   |
| `ResourceParamsBindingHandle`     | type      | yes       | yes   |
| `ResourceParamsBindingInspection` | interface | yes       | yes   |
| `ResourceParamsBindingOptions`    | interface | yes       | yes   |

#### src/runtime/resource.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `AsyncResource`                 | class     | no        | yes   |
| `AsyncResourceCacheKey`         | type      | yes       | yes   |
| `AsyncResourceContext`          | interface | yes       | yes   |
| `AsyncResourceInspection`       | interface | yes       | yes   |
| `AsyncResourceLoader`           | type      | yes       | yes   |
| `AsyncResourceOptions`          | interface | yes       | yes   |
| `AsyncResourceParamsError`      | class     | no        | yes   |
| `AsyncResourceState`            | interface | yes       | yes   |
| `AsyncResourceStatus`           | type      | yes       | yes   |
| `CachedAsyncResource`           | class     | no        | yes   |
| `CachedAsyncResourceInspection` | interface | yes       | yes   |
| `CachedAsyncResourceOptions`    | interface | yes       | yes   |
| `createAsyncResource`           | function  | no        | yes   |
| `createCachedAsyncResource`     | function  | no        | yes   |

#### src/runtime/scheduler.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `AsyncScheduler`           | class     | no        | yes   |
| `AsyncSchedulerInspection` | interface | yes       | yes   |
| `nextFrame`                | function  | no        | yes   |
| `runTaskBatch`             | function  | no        | yes   |
| `ScheduledTask`            | type      | yes       | yes   |
| `ScheduledTaskHandle`      | interface | yes       | yes   |
| `ScheduledTaskInspection`  | interface | yes       | yes   |
| `ScheduledTaskOptions`     | interface | yes       | yes   |
| `ScheduledTaskStatus`      | type      | yes       | yes   |
| `SchedulerOptions`         | interface | yes       | yes   |
| `TaskBatchItem`            | interface | yes       | yes   |
| `TaskBatchOptions`         | interface | yes       | yes   |
| `TaskBatchResult`          | interface | yes       | yes   |

#### src/runtime/storage.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `AsyncStore`              | interface | yes       | yes   |
| `createPersistentSignal`  | function  | no        | yes   |
| `createRuntimeStore`      | function  | no        | yes   |
| `IndexedDbStore`          | class     | no        | yes   |
| `IndexedDbStoreOptions`   | interface | yes       | yes   |
| `MemoryStore`             | class     | no        | yes   |
| `PersistentSignal`        | class     | no        | yes   |
| `PersistentSignalOptions` | interface | yes       | yes   |
| `RuntimeStoreOptions`     | interface | yes       | yes   |

#### src/runtime/telemetry.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createRuntimeWorkloadRegistry`     | function  | no        | yes   |
| `createRuntimeWorkloadReport`       | function  | no        | yes   |
| `formatRuntimeWorkloadMarkdown`     | function  | no        | yes   |
| `inspectRuntimeWorkload`            | function  | no        | yes   |
| `inspectRuntimeWorkloadReport`      | function  | no        | yes   |
| `RuntimeWorkloadInspection`         | interface | yes       | yes   |
| `RuntimeWorkloadKind`               | type      | yes       | yes   |
| `RuntimeWorkloadMarkdownOptions`    | interface | yes       | yes   |
| `RuntimeWorkloadRegistry`           | class     | no        | yes   |
| `RuntimeWorkloadRegistryInspection` | interface | yes       | yes   |
| `RuntimeWorkloadReport`             | interface | yes       | yes   |
| `RuntimeWorkloadReportInspection`   | interface | yes       | yes   |
| `RuntimeWorkloadReportOptions`      | interface | yes       | yes   |
| `RuntimeWorkloadSource`             | interface | yes       | yes   |
| `RuntimeWorkloadState`              | type      | yes       | yes   |

#### src/runtime/terminal_backend_registry.ts

| Symbol                                  | Kind      | Type Only | JSDoc |
| --------------------------------------- | --------- | --------- | ----- |
| `createDefaultTerminalBackendRegistry`  | function  | no        | yes   |
| `createProcessTerminalBackendProvider`  | function  | no        | yes   |
| `DefaultTerminalBackendRegistryOptions` | interface | yes       | yes   |
| `probeTerminalBackendProvider`          | function  | no        | yes   |
| `TerminalBackendAvailability`           | interface | yes       | yes   |
| `TerminalBackendProvider`               | interface | yes       | yes   |
| `TerminalBackendProviderInspection`     | interface | yes       | yes   |
| `TerminalBackendRegistry`               | class     | no        | yes   |
| `TerminalBackendResolveOptions`         | interface | yes       | yes   |

#### src/runtime/terminal_backend.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `createProcessTerminalBackend`    | function  | no        | yes   |
| `ProcessTerminalBackend`          | class     | no        | yes   |
| `ProcessTerminalBackendOptions`   | interface | yes       | yes   |
| `TerminalBackend`                 | interface | yes       | yes   |
| `TerminalBackendAttachOptions`    | interface | yes       | yes   |
| `TerminalBackendSpawnOptions`     | interface | yes       | yes   |
| `TerminalDetachedSession`         | interface | yes       | yes   |
| `TerminalSessionHandle`           | interface | yes       | yes   |
| `TerminalSessionHandleInspection` | interface | yes       | yes   |

#### src/runtime/terminal_capabilities.ts

| Symbol                               | Kind      | Type Only | JSDoc |
| ------------------------------------ | --------- | --------- | ----- |
| `createTerminalPlan`                 | function  | no        | yes   |
| `createTerminalPortabilityReport`    | function  | no        | yes   |
| `detectTerminalCapabilities`         | function  | no        | yes   |
| `detectTerminalEnvironment`          | function  | no        | yes   |
| `formatTerminalCapabilities`         | function  | no        | yes   |
| `formatTerminalEnvironment`          | function  | no        | yes   |
| `formatTerminalPlan`                 | function  | no        | yes   |
| `formatTerminalPortabilityReport`    | function  | no        | yes   |
| `summarizeTerminalCapabilities`      | function  | no        | yes   |
| `TerminalCapabilities`               | interface | yes       | yes   |
| `TerminalCapabilityDetectionOptions` | interface | yes       | yes   |
| `terminalCapabilityEntries`          | function  | no        | yes   |
| `TerminalCapabilityEntry`            | interface | yes       | yes   |
| `TerminalCapabilityId`               | type      | yes       | yes   |
| `TerminalCapabilitySummary`          | interface | yes       | yes   |
| `TerminalColorDepth`                 | type      | yes       | yes   |
| `TerminalDiagnostic`                 | interface | yes       | yes   |
| `TerminalDiagnosticSeverity`         | type      | yes       | yes   |
| `TerminalEnvironment`                | interface | yes       | yes   |
| `terminalEnvironmentDiagnostics`     | function  | no        | yes   |
| `TerminalMouseProtocol`              | type      | yes       | yes   |
| `TerminalMultiplexer`                | type      | yes       | yes   |
| `TerminalPlan`                       | interface | yes       | yes   |
| `TerminalPlanOptions`                | interface | yes       | yes   |
| `TerminalPortabilityReport`          | interface | yes       | yes   |
| `TerminalPortabilityReportOptions`   | interface | yes       | yes   |
| `TerminalTextMode`                   | type      | yes       | yes   |

#### src/runtime/terminal_screen.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `TerminalScreenCell`              | interface | yes       | yes   |
| `TerminalScreenController`        | class     | no        | yes   |
| `TerminalScreenControllerOptions` | interface | yes       | yes   |
| `TerminalScreenCursor`            | interface | yes       | yes   |
| `TerminalScreenCursorStyle`       | interface | yes       | yes   |
| `TerminalScreenInspection`        | interface | yes       | yes   |

#### src/runtime/terminal_session.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `createTerminalSessionController` | function  | no        | yes   |
| `terminalMouseSequences`          | function  | no        | yes   |
| `TerminalSessionController`       | class     | no        | yes   |
| `TerminalSessionInspection`       | interface | yes       | yes   |
| `TerminalSessionOptions`          | interface | yes       | yes   |
| `terminalSessionSequences`        | function  | no        | yes   |
| `TerminalSessionSequences`        | interface | yes       | yes   |
| `TerminalSessionWriter`           | interface | yes       | yes   |

#### src/runtime/terminal_shell.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `TerminalShellController`        | class     | no        | yes   |
| `TerminalShellControllerOptions` | interface | yes       | yes   |
| `TerminalShellInspection`        | interface | yes       | yes   |

#### src/runtime/terminal_status.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `formatTerminalShellWindowTitle`  | function  | no        | yes   |
| `summarizeTerminalStatus`         | function  | no        | yes   |
| `terminalBackendKindLabel`        | function  | no        | yes   |
| `TerminalShellWindowTitleOptions` | interface | yes       | yes   |
| `terminalStatusFields`            | function  | no        | yes   |
| `TerminalStatusSource`            | type      | yes       | yes   |
| `TerminalStatusSummary`           | interface | yes       | yes   |
| `TerminalStatusSummaryOptions`    | interface | yes       | yes   |

#### src/runtime/terminal_templates.ts

| Symbol                                 | Kind      | Type Only | JSDoc |
| -------------------------------------- | --------- | --------- | ----- |
| `attachTerminalTemplate`               | function  | no        | yes   |
| `AttachTerminalTemplate`               | interface | yes       | yes   |
| `commandTerminalTemplate`              | function  | no        | yes   |
| `CommandTerminalTemplateOptions`       | interface | yes       | yes   |
| `createTerminalTemplateSession`        | function  | no        | yes   |
| `CreateTerminalTemplateSessionOptions` | interface | yes       | yes   |
| `denoTaskTerminalTemplate`             | function  | no        | yes   |
| `DenoTaskTerminalTemplateOptions`      | interface | yes       | yes   |
| `describeAttachTerminalTemplate`       | function  | no        | yes   |
| `describeTerminalTemplateSession`      | function  | no        | yes   |
| `isSpawnTerminalTemplate`              | function  | no        | yes   |
| `projectTaskTerminalTemplate`          | function  | no        | yes   |
| `shellTerminalTemplate`                | function  | no        | yes   |
| `ShellTerminalTemplateOptions`         | interface | yes       | yes   |
| `SpawnTerminalTemplate`                | interface | yes       | yes   |
| `SpawnTerminalTemplateKind`            | type      | yes       | yes   |
| `TerminalRestartPolicy`                | type      | yes       | yes   |
| `TerminalSessionDescriptor`            | interface | yes       | yes   |
| `TerminalTemplate`                     | type      | yes       | yes   |
| `TerminalTemplateOptions`              | interface | yes       | yes   |
| `TerminalTemplateSession`              | interface | yes       | yes   |
| `terminalTemplateToSpawnOptions`       | function  | no        | yes   |

#### src/runtime/terminal_workspace.ts

| Symbol                                  | Kind      | Type Only | JSDoc |
| --------------------------------------- | --------- | --------- | ----- |
| `AddTerminalWorkspaceSessionOptions`    | interface | yes       | yes   |
| `createTerminalWorkspaceController`     | function  | no        | yes   |
| `SplitTerminalWorkspacePaneOptions`     | interface | yes       | yes   |
| `TerminalWorkspaceController`           | class     | no        | yes   |
| `TerminalWorkspaceControllerOptions`    | interface | yes       | yes   |
| `TerminalWorkspaceInspection`           | interface | yes       | yes   |
| `TerminalWorkspaceLayoutInspection`     | interface | yes       | yes   |
| `TerminalWorkspaceLayoutNode`           | type      | yes       | yes   |
| `TerminalWorkspaceLayoutState`          | interface | yes       | yes   |
| `TerminalWorkspacePaneInspection`       | interface | yes       | yes   |
| `TerminalWorkspacePaneNode`             | interface | yes       | yes   |
| `TerminalWorkspacePanePlacement`        | type      | yes       | yes   |
| `TerminalWorkspacePaneRect`             | interface | yes       | yes   |
| `TerminalWorkspacePaneRectOptions`      | interface | yes       | yes   |
| `terminalWorkspacePaneRects`            | function  | no        | yes   |
| `TerminalWorkspaceSplitDirection`       | type      | yes       | yes   |
| `TerminalWorkspaceSplitNode`            | interface | yes       | yes   |
| `UpsertTerminalWorkspaceSessionOptions` | interface | yes       | yes   |

#### src/runtime/worker_pool.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `installWorkerHandler`      | function  | no        | yes   |
| `runWorkerBatch`            | function  | no        | yes   |
| `WorkerBatchOptions`        | interface | yes       | yes   |
| `WorkerBatchResult`         | interface | yes       | yes   |
| `WorkerFactory`             | type      | yes       | yes   |
| `WorkerHandler`             | type      | yes       | yes   |
| `WorkerLike`                | interface | yes       | yes   |
| `WorkerPool`                | class     | no        | yes   |
| `WorkerPoolInspection`      | interface | yes       | yes   |
| `WorkerPoolOptions`         | interface | yes       | yes   |
| `WorkerPoolRunOptions`      | interface | yes       | yes   |
| `WorkerPoolTerminatedError` | class     | no        | yes   |

#### src/selection.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `clampSelectionIndex`        | function  | no        | yes   |
| `createSelection`            | function  | no        | yes   |
| `moveSelection`              | function  | no        | yes   |
| `normalizeSelection`         | function  | no        | yes   |
| `selectedValues`             | function  | no        | yes   |
| `selectIndex`                | function  | no        | yes   |
| `SelectionController`        | class     | no        | yes   |
| `SelectionControllerOptions` | interface | yes       | yes   |
| `selectionFromValues`        | function  | no        | yes   |
| `SelectionMode`              | type      | yes       | yes   |
| `SelectionMoveOptions`       | interface | yes       | yes   |
| `SelectionState`             | interface | yes       | yes   |
| `SelectionValueOptions`      | interface | yes       | yes   |
| `selectionWindow`            | function  | no        | yes   |
| `selectRange`                | function  | no        | yes   |
| `toggleSelection`            | function  | no        | yes   |

#### src/signals/computed.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `Computable`            | interface | yes       | yes   |
| `Computed`              | class     | no        | yes   |
| `ComputedReadOnlyError` | class     | no        | yes   |

#### src/signals/dependency_tracking.ts

| Symbol                 | Kind     | Type Only | JSDoc |
| ---------------------- | -------- | --------- | ----- |
| `activeSignals`        | variable | no        | yes   |
| `optimizeDependencies` | function | no        | yes   |
| `trackDependencies`    | function | no        | yes   |

#### src/signals/effect.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `Effect`                  | class     | no        | yes   |
| `Effectable`              | interface | yes       | yes   |
| `EffectPausedUpdateError` | class     | no        | yes   |

#### src/signals/flusher.ts

| Symbol    | Kind  | Type Only | JSDoc |
| --------- | ----- | --------- | ----- |
| `Flusher` | class | no        | yes   |

#### src/signals/lazy_computed.ts

| Symbol         | Kind  | Type Only | JSDoc |
| -------------- | ----- | --------- | ----- |
| `LazyComputed` | class | no        | yes   |

#### src/signals/lazy_effect.ts

| Symbol       | Kind  | Type Only | JSDoc |
| ------------ | ----- | --------- | ----- |
| `LazyEffect` | class | no        | yes   |

#### src/signals/mod.ts

| Re-export Target                     | Kind | Names |
| ------------------------------------ | ---- | ----- |
| `src/signals/signal.ts`              | star | -     |
| `src/signals/computed.ts`            | star | -     |
| `src/signals/effect.ts`              | star | -     |
| `src/signals/flusher.ts`             | star | -     |
| `src/signals/lazy_computed.ts`       | star | -     |
| `src/signals/lazy_effect.ts`         | star | -     |
| `src/signals/dependency_tracking.ts` | star | -     |
| `src/signals/reactivity.ts`          | star | -     |
| `src/signals/types.ts`               | star | -     |

_No direct exported symbols._

#### src/signals/reactivity.ts

| Symbol                           | Kind     | Type Only | JSDoc |
| -------------------------------- | -------- | --------- | ----- |
| `CONNECTED_SIGNAL`               | const    | no        | yes   |
| `getConnectedSignal`             | function | no        | yes   |
| `getOriginalRef`                 | function | no        | yes   |
| `IS_REACTIVE`                    | const    | no        | yes   |
| `isReactive`                     | function | no        | yes   |
| `makeArrayMethodsReactive`       | function | no        | yes   |
| `makeMapMethodsReactive`         | function | no        | yes   |
| `makeObjectPropertiesReactive`   | function | no        | yes   |
| `makeSetMethodsReactive`         | function | no        | yes   |
| `ORIGINAL_REF`                   | const    | no        | yes   |
| `Reactive`                       | type     | yes       | yes   |
| `ReactiveOriginalRefAccessError` | class    | no        | yes   |
| `ReactiveSignalAccessError`      | class    | no        | yes   |

#### src/signals/signal.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `batchSignalUpdates`             | function  | no        | yes   |
| `isSignalBatching`               | function  | no        | yes   |
| `Signal`                         | class     | no        | yes   |
| `SignalBatchScheduler`           | class     | no        | yes   |
| `SignalBatchSchedulerInspection` | interface | yes       | yes   |
| `SignalBatchSchedulerOptions`    | interface | yes       | yes   |
| `SignalDeepObserveTypeofError`   | class     | no        | yes   |
| `SignalInspection`               | interface | yes       | yes   |
| `SignalOfObject`                 | type      | yes       | yes   |
| `SignalOptions`                  | interface | yes       | yes   |
| `SignalRecursiveUpdateError`     | class     | no        | yes   |

#### src/signals/types.ts

| Symbol          | Kind      | Type Only | JSDoc |
| --------------- | --------- | --------- | ----- |
| `Dependant`     | interface | yes       | yes   |
| `Dependency`    | interface | yes       | yes   |
| `LazyDependant` | interface | yes       | yes   |
| `Subscription`  | interface | yes       | yes   |

#### src/testing/input.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `createTestFocusable`   | function  | no        | yes   |
| `createTestKeyPress`    | function  | no        | yes   |
| `createTestMousePress`  | function  | no        | yes   |
| `createTestMouseScroll` | function  | no        | yes   |
| `TestKeyPressOptions`   | interface | yes       | yes   |
| `TestKeyPressTarget`    | class     | no        | yes   |
| `TestMouseTarget`       | class     | no        | yes   |

#### src/testing/mod.ts

| Re-export Target          | Kind | Names |
| ------------------------- | ---- | ----- |
| `src/testing/input.ts`    | star | -     |
| `src/testing/snapshot.ts` | star | -     |

_No direct exported symbols._

#### src/testing/snapshot.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `assertTerminalSnapshot`      | function  | no        | yes   |
| `canvasRowText`               | function  | no        | yes   |
| `canvasSnapshot`              | function  | no        | yes   |
| `compareTerminalSnapshot`     | function  | no        | yes   |
| `createTestCanvas`            | function  | no        | yes   |
| `createTestStdout`            | function  | no        | yes   |
| `formatTerminalSnapshotDiff`  | function  | no        | yes   |
| `frameBufferToSnapshot`       | function  | no        | yes   |
| `normalizeTerminalSnapshot`   | function  | no        | yes   |
| `stripAnsi`                   | function  | no        | yes   |
| `TerminalSnapshotComparison`  | interface | yes       | yes   |
| `TerminalSnapshotDiffOptions` | interface | yes       | yes   |
| `TerminalSnapshotMismatch`    | interface | yes       | yes   |
| `TestCanvasOptions`           | interface | yes       | yes   |
| `TestStdout`                  | interface | yes       | yes   |

#### src/theme_binding.ts

| Symbol                                 | Kind      | Type Only | JSDoc |
| -------------------------------------- | --------- | --------- | ----- |
| `bindComponentTheme`                   | function  | no        | yes   |
| `bindComponentThemes`                  | function  | no        | yes   |
| `ComponentThemeBindingEntry`           | interface | yes       | yes   |
| `ComponentThemeBindingGroup`           | class     | no        | yes   |
| `ComponentThemeBindingGroupInspection` | interface | yes       | yes   |
| `ComponentThemeBindingInspection`      | interface | yes       | yes   |
| `ComponentThemeBindingOptions`         | interface | yes       | yes   |
| `ThemeBindable`                        | interface | yes       | yes   |

#### src/theme_engine_cache.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createThemeEngineCache`       | function  | no        | yes   |
| `createThemeProviderCache`     | function  | no        | yes   |
| `ThemeEngineCache`             | class     | no        | yes   |
| `ThemeEngineCacheInspection`   | interface | yes       | yes   |
| `ThemeProviderCache`           | class     | no        | yes   |
| `ThemeProviderCacheInspection` | interface | yes       | yes   |

#### src/theme_engine_factory.ts

| Symbol                                     | Kind      | Type Only | JSDoc |
| ------------------------------------------ | --------- | --------- | ----- |
| `createThemeEngineFactory`                 | function  | no        | yes   |
| `createThemeEngineFactoryCatalogReport`    | function  | no        | yes   |
| `createThemeEngineFactoryRegistry`         | function  | no        | yes   |
| `formatThemeEngineFactoryCatalogMarkdown`  | function  | no        | yes   |
| `inspectThemeEngineFactoryCatalog`         | function  | no        | yes   |
| `prewarmThemeEngines`                      | function  | no        | yes   |
| `queryThemeEngineFactories`                | function  | no        | yes   |
| `ThemeEngineFactory`                       | class     | no        | yes   |
| `ThemeEngineFactoryBuildResult`            | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogInspection`      | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogMarkdownOptions` | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogQuery`           | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogReport`          | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogReportOptions`   | interface | yes       | yes   |
| `ThemeEngineFactoryDefinition`             | interface | yes       | yes   |
| `ThemeEngineFactoryInspection`             | interface | yes       | yes   |
| `ThemeEngineFactoryNotFoundError`          | class     | no        | yes   |
| `ThemeEngineFactoryRegistry`               | class     | no        | yes   |
| `ThemeEnginePrewarmOptions`                | interface | yes       | yes   |

#### src/theme_engine_pipeline.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createThemeEnginePipeline`         | function  | no        | yes   |
| `prewarmThemeEnginePipelines`       | function  | no        | yes   |
| `ThemeEnginePipeline`               | class     | no        | yes   |
| `ThemeEnginePipelineBuildResult`    | interface | yes       | yes   |
| `ThemeEnginePipelineContext`        | interface | yes       | yes   |
| `ThemeEnginePipelineDefinition`     | interface | yes       | yes   |
| `ThemeEnginePipelineInspection`     | interface | yes       | yes   |
| `ThemeEnginePipelineListener`       | type      | yes       | yes   |
| `ThemeEnginePipelinePrewarmOptions` | interface | yes       | yes   |
| `ThemeEnginePipelineStepDefinition` | interface | yes       | yes   |
| `ThemeEnginePipelineStepInspection` | interface | yes       | yes   |
| `ThemeEnginePipelineTransform`      | type      | yes       | yes   |

#### src/theme_gallery.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createThemeGallery`                | function  | no        | yes   |
| `filterThemeGalleryItems`           | function  | no        | yes   |
| `rankThemeGalleryItems`             | function  | no        | yes   |
| `selectThemeGalleryItem`            | function  | no        | yes   |
| `ThemeGallery`                      | interface | yes       | yes   |
| `ThemeGalleryComponentStatePreview` | interface | yes       | yes   |
| `ThemeGalleryItem`                  | interface | yes       | yes   |
| `ThemeGalleryMatch`                 | interface | yes       | yes   |
| `ThemeGalleryOptions`               | interface | yes       | yes   |
| `ThemeGallerySelection`             | interface | yes       | yes   |
| `ThemeGalleryTokenPreview`          | interface | yes       | yes   |

#### src/theme_resolver.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `componentThemeStyleRequests`    | function  | no        | yes   |
| `createThemeEngineResolver`      | function  | no        | yes   |
| `createThemeProviderResolver`    | function  | no        | yes   |
| `createThemeResolutionSnapshot`  | function  | no        | yes   |
| `formatThemeResolutionMarkdown`  | function  | no        | yes   |
| `ThemeEngineResolver`            | class     | no        | yes   |
| `ThemeProviderResolver`          | class     | no        | yes   |
| `ThemeResolutionSnapshot`        | interface | yes       | yes   |
| `ThemeResolutionSnapshotOptions` | interface | yes       | yes   |
| `ThemeResolver`                  | interface | yes       | yes   |
| `ThemeResolverMarkdownOptions`   | interface | yes       | yes   |
| `ThemeStyleRequest`              | interface | yes       | yes   |
| `ThemeStyleResolution`           | interface | yes       | yes   |
| `ThemeTokenRequest`              | interface | yes       | yes   |
| `ThemeTokenResolution`           | interface | yes       | yes   |

#### src/theme_workspace.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createThemeWorkspace`         | function  | no        | yes   |
| `ThemeWorkspace`               | class     | no        | yes   |
| `ThemeWorkspaceEngineOptions`  | interface | yes       | yes   |
| `ThemeWorkspaceInspection`     | interface | yes       | yes   |
| `ThemeWorkspaceOptions`        | interface | yes       | yes   |
| `ThemeWorkspacePrewarmOptions` | interface | yes       | yes   |
| `ThemeWorkspacePrewarmResult`  | interface | yes       | yes   |

#### src/theme.ts

| Symbol                                    | Kind      | Type Only | JSDoc |
| ----------------------------------------- | --------- | --------- | ----- |
| `AnsiColor`                               | type      | yes       | yes   |
| `AnsiColorName`                           | type      | yes       | yes   |
| `AnsiRgbColor`                            | type      | yes       | yes   |
| `AnsiStyleSpec`                           | type      | yes       | yes   |
| `AnsiThemeTokenSpecs`                     | type      | yes       | yes   |
| `assertThemeOptions`                      | function  | no        | yes   |
| `compileThemeManifestOptions`             | function  | no        | yes   |
| `compileThemeManifestStateDefinition`     | function  | no        | yes   |
| `compileThemeManifestStyleReference`      | function  | no        | yes   |
| `ComponentThemeDefinition`                | interface | yes       | yes   |
| `composeStandardThemeOptions`             | function  | no        | yes   |
| `composeStyles`                           | function  | no        | yes   |
| `composeThemeOptions`                     | function  | no        | yes   |
| `createAnsiStyle`                         | function  | no        | yes   |
| `createAnsiThemeTokens`                   | function  | no        | yes   |
| `createStandardComponentThemeDefinitions` | function  | no        | yes   |
| `createTheme`                             | function  | no        | yes   |
| `createThemeCatalog`                      | function  | no        | yes   |
| `createThemeEngine`                       | function  | no        | yes   |
| `createThemeEngineFromManifest`           | function  | no        | yes   |
| `createThemeEngineFromPalette`            | function  | no        | yes   |
| `createThemeLayerStack`                   | function  | no        | yes   |
| `createThemePaletteRegistry`              | function  | no        | yes   |
| `createThemeProvider`                     | function  | no        | yes   |
| `createThemeProviderReport`               | function  | no        | yes   |
| `createThemeRegistry`                     | function  | no        | yes   |
| `createThemeRegistryFromManifests`        | function  | no        | yes   |
| `defaultThemePacks`                       | const     | no        | yes   |
| `defaultThemePaletteDefinitions`          | function  | no        | yes   |
| `diffThemeEngines`                        | function  | no        | yes   |
| `emptyStyle`                              | const     | no        | yes   |
| `formatThemeProviderReportMarkdown`       | function  | no        | yes   |
| `hierarchizeTheme`                        | function  | no        | yes   |
| `inspectThemeCoverage`                    | function  | no        | yes   |
| `inspectThemeManifest`                    | function  | no        | yes   |
| `inspectThemeStandardization`             | function  | no        | yes   |
| `mergeComponentThemeDefinition`           | function  | no        | yes   |
| `previewThemeManifest`                    | function  | no        | yes   |
| `previewThemeProvider`                    | function  | no        | yes   |
| `replaceEmptyStyle`                       | function  | no        | yes   |
| `resolveThemeStateDefinition`             | function  | no        | yes   |
| `resolveThemeStyleReference`              | function  | no        | yes   |
| `StandardComponentThemeOptions`           | interface | yes       | yes   |
| `standardThemeComponentNames`             | function  | no        | yes   |
| `Style`                                   | type      | yes       | yes   |
| `Theme`                                   | interface | yes       | yes   |
| `ThemeCatalog`                            | interface | yes       | yes   |
| `ThemeCatalogComponent`                   | interface | yes       | yes   |
| `ThemeCatalogLayer`                       | interface | yes       | yes   |
| `ThemeCatalogTheme`                       | interface | yes       | yes   |
| `ThemeComponentCoverageInspection`        | interface | yes       | yes   |
| `ThemeComponentInspection`                | interface | yes       | yes   |
| `ThemeComponentStateDiff`                 | interface | yes       | yes   |
| `ThemeCoverageInspection`                 | interface | yes       | yes   |
| `ThemeCoverageOptions`                    | interface | yes       | yes   |
| `ThemeEngine`                             | class     | no        | yes   |
| `ThemeEngineDiff`                         | interface | yes       | yes   |
| `ThemeEngineDiffOptions`                  | interface | yes       | yes   |
| `ThemeEngineOptions`                      | interface | yes       | yes   |
| `ThemeInheritanceError`                   | class     | no        | yes   |
| `ThemeInspection`                         | interface | yes       | yes   |
| `ThemeLayer`                              | interface | yes       | yes   |
| `ThemeLayerInspection`                    | interface | yes       | yes   |
| `ThemeLayerStack`                         | class     | no        | yes   |
| `ThemeManifestComponentDefinition`        | interface | yes       | yes   |
| `ThemeManifestComponentInspection`        | interface | yes       | yes   |
| `ThemeManifestComponentStatePreview`      | interface | yes       | yes   |
| `ThemeManifestInspection`                 | interface | yes       | yes   |
| `ThemeManifestOptions`                    | interface | yes       | yes   |
| `ThemeManifestPreview`                    | interface | yes       | yes   |
| `ThemeManifestPreviewOptions`             | interface | yes       | yes   |
| `ThemeManifestStateDefinition`            | type      | yes       | yes   |
| `ThemeManifestStyleReference`             | type      | yes       | yes   |
| `ThemeManifestTokenPreview`               | interface | yes       | yes   |
| `ThemeManifestVariantInspection`          | interface | yes       | yes   |
| `ThemePack`                               | interface | yes       | yes   |
| `themePackFromManifest`                   | function  | no        | yes   |
| `ThemePackInspection`                     | interface | yes       | yes   |
| `ThemePackManifest`                       | interface | yes       | yes   |
| `ThemePackNotFoundError`                  | class     | no        | yes   |
| `ThemePalette`                            | interface | yes       | yes   |
| `ThemePaletteInspection`                  | interface | yes       | yes   |
| `ThemePaletteName`                        | type      | yes       | yes   |
| `ThemePaletteNotFoundError`               | class     | no        | yes   |
| `ThemePaletteReference`                   | type      | yes       | yes   |
| `ThemePaletteRegistry`                    | class     | no        | yes   |
| `themePalettes`                           | const     | no        | yes   |
| `ThemeProvider`                           | class     | no        | yes   |
| `ThemeProviderComponentStatePreview`      | interface | yes       | yes   |
| `ThemeProviderInspection`                 | interface | yes       | yes   |
| `ThemeProviderOptions`                    | interface | yes       | yes   |
| `ThemeProviderPreview`                    | interface | yes       | yes   |
| `ThemeProviderPreviewOptions`             | interface | yes       | yes   |
| `ThemeProviderReport`                     | interface | yes       | yes   |
| `ThemeProviderReportIssue`                | interface | yes       | yes   |
| `ThemeProviderReportIssueSource`          | type      | yes       | yes   |
| `ThemeProviderReportOptions`              | interface | yes       | yes   |
| `ThemeProviderReportSummary`              | interface | yes       | yes   |
| `ThemeProviderTokenPreview`               | interface | yes       | yes   |
| `ThemeRegistry`                           | class     | no        | yes   |
| `ThemeStandardizationInspection`          | interface | yes       | yes   |
| `ThemeState`                              | type      | yes       | yes   |
| `ThemeStateDefinition`                    | type      | yes       | yes   |
| `themeStates`                             | const     | no        | yes   |
| `ThemeStylePreview`                       | interface | yes       | yes   |
| `ThemeStyleReference`                     | type      | yes       | yes   |
| `ThemeTokenDiff`                          | interface | yes       | yes   |
| `ThemeTokenName`                          | type      | yes       | yes   |
| `themeTokenNames`                         | const     | no        | yes   |
| `ThemeTokens`                             | interface | yes       | yes   |
| `ThemeValidationError`                    | class     | no        | yes   |
| `ThemeValidationIssue`                    | interface | yes       | yes   |
| `ThemeValidationIssueKind`                | type      | yes       | yes   |
| `ThemeVariantCoverageInspection`          | interface | yes       | yes   |
| `validateThemeOptions`                    | function  | no        | yes   |

#### src/three_ascii/AcerolaAsciiNode.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `AcerolaAsciiNode`        | class     | no        | yes   |
| `AcerolaAsciiNodeOptions` | interface | yes       | yes   |

#### src/three_ascii/demo_presets.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `ASCII_DEMO_PRESETS`            | const     | no        | yes   |
| `ASCII_NUMERIC_CONTROLS`        | const     | no        | yes   |
| `ASCII_TOGGLE_CONTROLS`         | const     | no        | yes   |
| `AsciiDemoPreset`               | interface | yes       | yes   |
| `asciiDemoPresetIds`            | function  | no        | yes   |
| `asciiDemoPresets`              | function  | no        | yes   |
| `asciiDemoPresetSummaries`      | function  | no        | yes   |
| `AsciiDemoPresetSummary`        | interface | yes       | yes   |
| `AsciiNumericControlDefinition` | interface | yes       | yes   |
| `AsciiNumericControlKey`        | type      | yes       | yes   |
| `AsciiToggleControlDefinition`  | interface | yes       | yes   |
| `AsciiToggleControlKey`         | type      | yes       | yes   |
| `DEFAULT_ASCII_DEMO_EFFECT`     | const     | no        | yes   |
| `findAsciiDemoPreset`           | function  | no        | yes   |

#### src/three_ascii/glyphs.ts

| Symbol                      | Kind     | Type Only | JSDoc |
| --------------------------- | -------- | --------- | ----- |
| `ASCII_FILL_GLYPHS`         | const    | no        | yes   |
| `BLOCK_FILL_GLYPHS`         | const    | no        | yes   |
| `blockFillGlyphForBucket`   | function | no        | yes   |
| `bucketAsciiLuminance`      | function | no        | yes   |
| `classifyEdgeDirection`     | function | no        | yes   |
| `EDGE_GLYPHS`               | const    | no        | yes   |
| `EdgeDirection`             | type     | yes       | yes   |
| `FILL_GLYPHS`               | const    | no        | yes   |
| `glyphForTile`              | function | no        | yes   |
| `pickDominantEdgeDirection` | function | no        | yes   |
| `TERMINAL_GLYPH_STYLES`     | const    | no        | yes   |
| `TERMINAL_GLYPHS`           | const    | no        | yes   |
| `TerminalGlyphStyle`        | type     | yes       | yes   |

#### src/three_ascii/mod.ts

| Re-export Target                      | Kind | Names |
| ------------------------------------- | ---- | ----- |
| `src/three_ascii/AcerolaAsciiNode.ts` | star | -     |
| `src/three_ascii/demo_presets.ts`     | star | -     |
| `src/three_ascii/glyphs.ts`           | star | -     |
| `src/three_ascii/options.ts`          | star | -     |
| `src/three_ascii/renderer.ts`         | star | -     |
| `src/three_ascii/webgpu_compat.ts`    | star | -     |

_No direct exported symbols._

#### src/three_ascii/options.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `applyAsciiPreset`                  | function  | no        | yes   |
| `asciiControlValues`                | function  | no        | yes   |
| `asciiEffectOptions`                | function  | no        | yes   |
| `asciiPresetLabel`                  | function  | no        | yes   |
| `buildAsciiOptionsFromPreset`       | function  | no        | yes   |
| `clampAsciiControlValue`            | function  | no        | yes   |
| `cloneAsciiOptions`                 | function  | no        | yes   |
| `createDefaultAsciiOptions`         | function  | no        | yes   |
| `formatAsciiControlValue`           | function  | no        | yes   |
| `normalizeAsciiOptions`             | function  | no        | yes   |
| `terminalGlyphStyleLabel`           | function  | no        | yes   |
| `THREE_ASCII_BORDER_MODES`          | const     | no        | yes   |
| `ThreeAsciiBorderMode`              | type      | yes       | yes   |
| `ThreeAsciiConfigOptions`           | interface | yes       | yes   |
| `ThreeAsciiOptionNumericControlKey` | type      | yes       | yes   |

#### src/three_ascii/renderer.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `buildThreeAsciiAnsiGrid`      | function  | no        | yes   |
| `ThreeAsciiAnsiGridInput`      | interface | yes       | yes   |
| `ThreeAsciiImageFrame`         | interface | yes       | yes   |
| `ThreeAsciiRenderer`           | class     | no        | yes   |
| `ThreeAsciiRendererOptions`    | interface | yes       | yes   |
| `ThreeAsciiRenderFrame`        | interface | yes       | yes   |
| `ThreeAsciiRenderFrameOptions` | interface | yes       | yes   |

#### src/three_ascii/webgpu_compat.ts

| Symbol                        | Kind     | Type Only | JSDoc |
| ----------------------------- | -------- | --------- | ----- |
| `getCompatibleWebGPUDevice`   | function | no        | yes   |
| `probeCompatibleWebGPUDevice` | function | no        | yes   |

#### src/tui.ts

| Symbol       | Kind      | Type Only | JSDoc |
| ------------ | --------- | --------- | ----- |
| `Tui`        | class     | no        | yes   |
| `TuiOptions` | interface | yes       | yes   |

#### src/types.ts

| Symbol        | Kind      | Type Only | JSDoc |
| ------------- | --------- | --------- | ----- |
| `ConsoleSize` | type      | yes       | yes   |
| `DeepPartial` | type      | yes       | yes   |
| `Margin`      | interface | yes       | yes   |
| `Offset`      | interface | yes       | yes   |
| `Range`       | type      | yes       | yes   |
| `Rectangle`   | interface | yes       | yes   |
| `Stdin`       | type      | yes       | yes   |
| `Stdout`      | type      | yes       | yes   |

#### src/utils/ansi_codes.ts

| Symbol                    | Kind     | Type Only | JSDoc |
| ------------------------- | -------- | --------- | ----- |
| `CLEAR_SCREEN`            | const    | no        | yes   |
| `DISABLE_BRACKETED_PASTE` | const    | no        | yes   |
| `DISABLE_FOCUS_EVENTS`    | const    | no        | yes   |
| `DISABLE_MOUSE`           | const    | no        | yes   |
| `ENABLE_BRACKETED_PASTE`  | const    | no        | yes   |
| `ENABLE_FOCUS_EVENTS`     | const    | no        | yes   |
| `ENABLE_MOUSE`            | const    | no        | yes   |
| `HIDE_CURSOR`             | const    | no        | yes   |
| `moveCursor`              | function | no        | yes   |
| `SHOW_CURSOR`             | const    | no        | yes   |
| `USE_PRIMARY_BUFFER`      | const    | no        | yes   |
| `USE_SECONDARY_BUFFER`    | const    | no        | yes   |

#### src/utils/async.ts

| Symbol  | Kind     | Type Only | JSDoc |
| ------- | -------- | --------- | ----- |
| `sleep` | function | no        | yes   |

#### src/utils/component.ts

| Symbol                               | Kind     | Type Only | JSDoc |
| ------------------------------------ | -------- | --------- | ----- |
| `getComponentClosestToTopLeftCorner` | function | no        | yes   |
| `isInteractable`                     | function | no        | yes   |

#### src/utils/mod.ts

| Re-export Target            | Kind | Names |
| --------------------------- | ---- | ----- |
| `src/utils/ansi_codes.ts`   | star | -     |
| `src/utils/async.ts`        | star | -     |
| `src/utils/numbers.ts`      | star | -     |
| `src/utils/sorted_array.ts` | star | -     |
| `src/utils/strings.ts`      | star | -     |
| `src/utils/component.ts`    | star | -     |
| `src/utils/signals.ts`      | star | -     |

_No direct exported symbols._

#### src/utils/numbers.ts

| Symbol                  | Kind     | Type Only | JSDoc |
| ----------------------- | -------- | --------- | ----- |
| `clamp`                 | function | no        | yes   |
| `fits`                  | function | no        | yes   |
| `fitsInRectangle`       | function | no        | yes   |
| `normalize`             | function | no        | yes   |
| `rectangleEquals`       | function | no        | yes   |
| `rectangleIntersection` | function | no        | yes   |

#### src/utils/signals.ts

| Symbol      | Kind     | Type Only | JSDoc |
| ----------- | -------- | --------- | ----- |
| `signalify` | function | no        | yes   |

#### src/utils/sorted_array.ts

| Symbol        | Kind  | Type Only | JSDoc |
| ------------- | ----- | --------- | ----- |
| `CompareFn`   | type  | yes       | yes   |
| `SortedArray` | class | no        | yes   |

#### src/utils/strings.ts

| Symbol                        | Kind     | Type Only | JSDoc |
| ----------------------------- | -------- | --------- | ----- |
| `capitalize`                  | function | no        | yes   |
| `characterWidth`              | function | no        | yes   |
| `cropToWidth`                 | function | no        | yes   |
| `getMultiCodePointCharacters` | function | no        | yes   |
| `insertAt`                    | function | no        | yes   |
| `isFinalAnsiByte`             | function | no        | yes   |
| `stripStyles`                 | function | no        | yes   |
| `textWidth`                   | function | no        | yes   |
| `UNICODE_CHAR_REGEXP`         | const    | no        | yes   |

#### src/view.ts

| Symbol | Kind  | Type Only | JSDoc |
| ------ | ----- | --------- | ----- |
| `View` | class | no        | yes   |

#### src/viewport.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `clampViewportOffset`         | function  | no        | yes   |
| `inspectViewport`             | function  | no        | yes   |
| `inspectViewportAxisOverflow` | function  | no        | yes   |
| `inspectViewportOverflow`     | function  | no        | yes   |
| `maxViewportOffset`           | function  | no        | yes   |
| `ViewportAxisOverflow`        | interface | yes       | yes   |
| `ViewportAxisOverflowOptions` | interface | yes       | yes   |
| `ViewportInspection`          | interface | yes       | yes   |
| `viewportOffsetBy`            | function  | no        | yes   |
| `viewportOffsetForPointer`    | function  | no        | yes   |
| `ViewportOverflowInspection`  | interface | yes       | yes   |
| `ViewportOverflowMode`        | type      | yes       | yes   |
| `ViewportOverflowOptions`     | interface | yes       | yes   |
| `viewportThumb`               | function  | no        | yes   |
| `ViewportThumb`               | interface | yes       | yes   |
| `viewportThumbGlyph`          | function  | no        | yes   |
| `viewportWindow`              | function  | no        | yes   |
| `ViewportWindow`              | interface | yes       | yes   |

## Entrypoint ./web

Standalone browser-safe package for shared controllers, themes, layout, canvas sinks, and web hosts.

- Path: `./mod.web.ts`
- Runtime: browser
- Stability: beta

### Summary

- Entrypoint: `mod.web.ts`
- Modules: 202
- Re-export declarations: 201
- Exported symbols: 1732
- Documented symbols: 1732
- Documentation coverage: 100.00%
- Duplicate symbols: 0
- Missing targets: 0

### Module Index

| Module                                                                            | Re-exports | Symbols | Documented |
| --------------------------------------------------------------------------------- | ---------: | ------: | ---------: |
| [`mod.web.ts`](#mod-web-ts)                                                       |         51 |       0 |          0 |
| [`src/api_stability.ts`](#src-api-stability-ts)                                   |          0 |      14 |         14 |
| [`src/app/actions.ts`](#src-app-actions-ts)                                       |          0 |       7 |          7 |
| [`src/app/app.ts`](#src-app-app-ts)                                               |          0 |      13 |         13 |
| [`src/app/button_commands.ts`](#src-app-button-commands-ts)                       |          0 |       6 |          6 |
| [`src/app/checkbox_commands.ts`](#src-app-checkbox-commands-ts)                   |          0 |       6 |          6 |
| [`src/app/combobox_commands.ts`](#src-app-combobox-commands-ts)                   |          0 |       6 |          6 |
| [`src/app/command_bindings.ts`](#src-app-command-bindings-ts)                     |          0 |      26 |         26 |
| [`src/app/command_search_index.ts`](#src-app-command-search-index-ts)             |          0 |      11 |         11 |
| [`src/app/commands.ts`](#src-app-commands-ts)                                     |          0 |       8 |          8 |
| [`src/app/component_commands.ts`](#src-app-component-commands-ts)                 |          0 |       5 |          5 |
| [`src/app/data_query_bindings.ts`](#src-app-data-query-bindings-ts)               |          0 |      12 |         12 |
| [`src/app/data_query_commands.ts`](#src-app-data-query-commands-ts)               |          0 |       7 |          7 |
| [`src/app/data_query_plugin.ts`](#src-app-data-query-plugin-ts)                   |          0 |       5 |          5 |
| [`src/app/data_table_commands.ts`](#src-app-data-table-commands-ts)               |          0 |       4 |          4 |
| [`src/app/disposables.ts`](#src-app-disposables-ts)                               |          0 |       6 |          6 |
| [`src/app/focus_commands.ts`](#src-app-focus-commands-ts)                         |          0 |       7 |          7 |
| [`src/app/form_bindings.ts`](#src-app-form-bindings-ts)                           |          0 |       2 |          2 |
| [`src/app/form_commands.ts`](#src-app-form-commands-ts)                           |          0 |       7 |          7 |
| [`src/app/forms.ts`](#src-app-forms-ts)                                           |          0 |      17 |         17 |
| [`src/app/history_bindings.ts`](#src-app-history-bindings-ts)                     |          0 |       6 |          6 |
| [`src/app/history.ts`](#src-app-history-ts)                                       |          0 |       5 |          5 |
| [`src/app/hit_targets.ts`](#src-app-hit-targets-ts)                               |          0 |       6 |          6 |
| [`src/app/input_commands.ts`](#src-app-input-commands-ts)                         |          0 |       6 |          6 |
| [`src/app/list_commands.ts`](#src-app-list-commands-ts)                           |          0 |       6 |          6 |
| [`src/app/log_viewer_commands.ts`](#src-app-log-viewer-commands-ts)               |          0 |       6 |          6 |
| [`src/app/menu_bar_commands.ts`](#src-app-menu-bar-commands-ts)                   |          0 |       6 |          6 |
| [`src/app/metric_series_commands.ts`](#src-app-metric-series-commands-ts)         |          0 |       6 |          6 |
| [`src/app/mod.ts`](#src-app-mod-ts)                                               |         65 |       0 |          0 |
| [`src/app/mouse_bindings.ts`](#src-app-mouse-bindings-ts)                         |          0 |      10 |         10 |
| [`src/app/pad_commands.ts`](#src-app-pad-commands-ts)                             |          0 |       6 |          6 |
| [`src/app/plugins.ts`](#src-app-plugins-ts)                                       |          0 |      17 |         17 |
| [`src/app/progress_bar_commands.ts`](#src-app-progress-bar-commands-ts)           |          0 |       6 |          6 |
| [`src/app/radio_group_commands.ts`](#src-app-radio-group-commands-ts)             |          0 |       6 |          6 |
| [`src/app/route_bindings.ts`](#src-app-route-bindings-ts)                         |          0 |       9 |          9 |
| [`src/app/router.ts`](#src-app-router-ts)                                         |          0 |       5 |          5 |
| [`src/app/runtime_profile_commands.ts`](#src-app-runtime-profile-commands-ts)     |          0 |       5 |          5 |
| [`src/app/runtime_profile_plugin.ts`](#src-app-runtime-profile-plugin-ts)         |          0 |       5 |          5 |
| [`src/app/runtime_renderer_commands.ts`](#src-app-runtime-renderer-commands-ts)   |          0 |       5 |          5 |
| [`src/app/runtime_renderer_plugin.ts`](#src-app-runtime-renderer-plugin-ts)       |          0 |       5 |          5 |
| [`src/app/runtime_workload_commands.ts`](#src-app-runtime-workload-commands-ts)   |          0 |       5 |          5 |
| [`src/app/scroll_area_commands.ts`](#src-app-scroll-area-commands-ts)             |          0 |       6 |          6 |
| [`src/app/selection_bindings.ts`](#src-app-selection-bindings-ts)                 |          0 |       8 |          8 |
| [`src/app/settings_bindings.ts`](#src-app-settings-bindings-ts)                   |          0 |      21 |         21 |
| [`src/app/settings_commands.ts`](#src-app-settings-commands-ts)                   |          0 |       5 |          5 |
| [`src/app/settings.ts`](#src-app-settings-ts)                                     |          0 |       5 |          5 |
| [`src/app/slider_commands.ts`](#src-app-slider-commands-ts)                       |          0 |       6 |          6 |
| [`src/app/split_pane_commands.ts`](#src-app-split-pane-commands-ts)               |          0 |       7 |          7 |
| [`src/app/stepper_commands.ts`](#src-app-stepper-commands-ts)                     |          0 |       6 |          6 |
| [`src/app/surface_bindings.ts`](#src-app-surface-bindings-ts)                     |          0 |       2 |          2 |
| [`src/app/table_commands.ts`](#src-app-table-commands-ts)                         |          0 |       6 |          6 |
| [`src/app/tabs_commands.ts`](#src-app-tabs-commands-ts)                           |          0 |       6 |          6 |
| [`src/app/terminal_commands.ts`](#src-app-terminal-commands-ts)                   |          0 |      12 |         12 |
| [`src/app/terminal_input.ts`](#src-app-terminal-input-ts)                         |          0 |       9 |          9 |
| [`src/app/terminal_window_bindings.ts`](#src-app-terminal-window-bindings-ts)     |          0 |       5 |          5 |
| [`src/app/textbox_commands.ts`](#src-app-textbox-commands-ts)                     |          0 |       6 |          6 |
| [`src/app/theme_commands.ts`](#src-app-theme-commands-ts)                         |          0 |      10 |         10 |
| [`src/app/theme_engine_commands.ts`](#src-app-theme-engine-commands-ts)           |          0 |       9 |          9 |
| [`src/app/theme_pipeline_commands.ts`](#src-app-theme-pipeline-commands-ts)       |          0 |       5 |          5 |
| [`src/app/theme_plugin.ts`](#src-app-theme-plugin-ts)                             |          0 |       8 |          8 |
| [`src/app/theme_workspace_plugin.ts`](#src-app-theme-workspace-plugin-ts)         |          0 |       5 |          5 |
| [`src/app/toast_commands.ts`](#src-app-toast-commands-ts)                         |          0 |       6 |          6 |
| [`src/app/tree_commands.ts`](#src-app-tree-commands-ts)                           |          0 |       6 |          6 |
| [`src/app/window_manager_commands.ts`](#src-app-window-manager-commands-ts)       |          0 |       8 |          8 |
| [`src/app/workbench_frame.ts`](#src-app-workbench-frame-ts)                       |          0 |      13 |         13 |
| [`src/app/workbench_menu.ts`](#src-app-workbench-menu-ts)                         |          0 |       5 |          5 |
| [`src/app/workbench_window_registry.ts`](#src-app-workbench-window-registry-ts)   |          0 |      13 |         13 |
| [`src/app/workbench_workspace.ts`](#src-app-workbench-workspace-ts)               |          0 |      18 |         18 |
| [`src/canvas/box.ts`](#src-canvas-box-ts)                                         |          0 |       2 |          2 |
| [`src/canvas/canvas.ts`](#src-canvas-canvas-ts)                                   |          0 |       4 |          4 |
| [`src/canvas/draw_object.ts`](#src-canvas-draw-object-ts)                         |          0 |       2 |          2 |
| [`src/canvas/sink.ts`](#src-canvas-sink-ts)                                       |          0 |       8 |          8 |
| [`src/canvas/text.ts`](#src-canvas-text-ts)                                       |          0 |       3 |          3 |
| [`src/canvas/three_ascii.ts`](#src-canvas-three-ascii-ts)                         |          0 |       6 |          6 |
| [`src/components/box.ts`](#src-components-box-ts)                                 |          0 |       1 |          1 |
| [`src/components/breadcrumbs.ts`](#src-components-breadcrumbs-ts)                 |          0 |       4 |          4 |
| [`src/components/button.ts`](#src-components-button-ts)                           |          0 |       5 |          5 |
| [`src/components/catalog.ts`](#src-components-catalog-ts)                         |          0 |      19 |         19 |
| [`src/components/chart.ts`](#src-components-chart-ts)                             |          0 |       3 |          3 |
| [`src/components/checkbox.ts`](#src-components-checkbox-ts)                       |          0 |       7 |          7 |
| [`src/components/combobox.ts`](#src-components-combobox-ts)                       |          0 |       7 |          7 |
| [`src/components/command_palette.ts`](#src-components-command-palette-ts)         |          0 |      12 |         12 |
| [`src/components/context_menu.ts`](#src-components-context-menu-ts)               |          0 |      10 |         10 |
| [`src/components/data_table.ts`](#src-components-data-table-ts)                   |          0 |      15 |         15 |
| [`src/components/empty_state.ts`](#src-components-empty-state-ts)                 |          0 |       4 |          4 |
| [`src/components/file_explorer.ts`](#src-components-file-explorer-ts)             |          0 |       7 |          7 |
| [`src/components/frame.ts`](#src-components-frame-ts)                             |          0 |       4 |          4 |
| [`src/components/gauge.ts`](#src-components-gauge-ts)                             |          0 |       3 |          3 |
| [`src/components/input.ts`](#src-components-input-ts)                             |          0 |       8 |          8 |
| [`src/components/interaction.ts`](#src-components-interaction-ts)                 |          0 |       7 |          7 |
| [`src/components/key_help.ts`](#src-components-key-help-ts)                       |          0 |       3 |          3 |
| [`src/components/label.ts`](#src-components-label-ts)                             |          0 |       6 |          6 |
| [`src/components/list.ts`](#src-components-list-ts)                               |          0 |       8 |          8 |
| [`src/components/log_viewer.ts`](#src-components-log-viewer-ts)                   |          0 |       6 |          6 |
| [`src/components/menu_bar.ts`](#src-components-menu-bar-ts)                       |          0 |      10 |         10 |
| [`src/components/metric_series.ts`](#src-components-metric-series-ts)             |          0 |      10 |         10 |
| [`src/components/mod.ts`](#src-components-mod-ts)                                 |         41 |       0 |          0 |
| [`src/components/modal.ts`](#src-components-modal-ts)                             |          0 |      11 |         11 |
| [`src/components/pad.ts`](#src-components-pad-ts)                                 |          0 |      13 |         13 |
| [`src/components/progressbar.ts`](#src-components-progressbar-ts)                 |          0 |      15 |         15 |
| [`src/components/radio_group.ts`](#src-components-radio-group-ts)                 |          0 |      11 |         11 |
| [`src/components/scroll_area.ts`](#src-components-scroll-area-ts)                 |          0 |      13 |         13 |
| [`src/components/slider.ts`](#src-components-slider-ts)                           |          0 |      14 |         14 |
| [`src/components/sparkline.ts`](#src-components-sparkline-ts)                     |          0 |       3 |          3 |
| [`src/components/spinner.ts`](#src-components-spinner-ts)                         |          0 |       6 |          6 |
| [`src/components/statusbar.ts`](#src-components-statusbar-ts)                     |          0 |       3 |          3 |
| [`src/components/stepper.ts`](#src-components-stepper-ts)                         |          0 |      11 |         11 |
| [`src/components/table.ts`](#src-components-table-ts)                             |          0 |      12 |         12 |
| [`src/components/tabs.ts`](#src-components-tabs-ts)                               |          0 |      10 |         10 |
| [`src/components/terminal_output.ts`](#src-components-terminal-output-ts)         |          0 |       7 |          7 |
| [`src/components/text.ts`](#src-components-text-ts)                               |          0 |       2 |          2 |
| [`src/components/textbox.ts`](#src-components-textbox-ts)                         |          0 |      14 |         14 |
| [`src/components/three_ascii.ts`](#src-components-three-ascii-ts)                 |          0 |       2 |          2 |
| [`src/components/toast.ts`](#src-components-toast-ts)                             |          0 |       8 |          8 |
| [`src/components/tree.ts`](#src-components-tree-ts)                               |          0 |      11 |         11 |
| [`src/components/virtual_list.ts`](#src-components-virtual-list-ts)               |          0 |       8 |          8 |
| [`src/event_emitter.ts`](#src-event-emitter-ts)                                   |          0 |       5 |          5 |
| [`src/focus.ts`](#src-focus-ts)                                                   |          0 |       7 |          7 |
| [`src/grwizard_themes.ts`](#src-grwizard-themes-ts)                               |          0 |       5 |          5 |
| [`src/layout/engine.ts`](#src-layout-engine-ts)                                   |          0 |       6 |          6 |
| [`src/layout/errors.ts`](#src-layout-errors-ts)                                   |          0 |       2 |          2 |
| [`src/layout/flex_layout.ts`](#src-layout-flex-layout-ts)                         |          0 |       3 |          3 |
| [`src/layout/grid_layout.ts`](#src-layout-grid-layout-ts)                         |          0 |       3 |          3 |
| [`src/layout/horizontal_layout.ts`](#src-layout-horizontal-layout-ts)             |          0 |       1 |          1 |
| [`src/layout/measurement.ts`](#src-layout-measurement-ts)                         |          0 |       4 |          4 |
| [`src/layout/mod.ts`](#src-layout-mod-ts)                                         |         16 |       0 |          0 |
| [`src/layout/overlay.ts`](#src-layout-overlay-ts)                                 |          0 |      19 |         19 |
| [`src/layout/recipe.ts`](#src-layout-recipe-ts)                                   |          0 |      18 |         18 |
| [`src/layout/responsive.ts`](#src-layout-responsive-ts)                           |          0 |      14 |         14 |
| [`src/layout/solver.ts`](#src-layout-solver-ts)                                   |          0 |      13 |         13 |
| [`src/layout/solvers/simple.ts`](#src-layout-solvers-simple-ts)                   |          0 |       3 |          3 |
| [`src/layout/split_pane.ts`](#src-layout-split-pane-ts)                           |          0 |      10 |         10 |
| [`src/layout/style.ts`](#src-layout-style-ts)                                     |          0 |      31 |         31 |
| [`src/layout/types.ts`](#src-layout-types-ts)                                     |          0 |       3 |          3 |
| [`src/layout/vertical_layout.ts`](#src-layout-vertical-layout-ts)                 |          0 |       1 |          1 |
| [`src/layout/window_manager.ts`](#src-layout-window-manager-ts)                   |          0 |      10 |         10 |
| [`src/markup/cascade.ts`](#src-markup-cascade-ts)                                 |          0 |       7 |          7 |
| [`src/markup/css.ts`](#src-markup-css-ts)                                         |          0 |      11 |         11 |
| [`src/markup/demo_fixtures.ts`](#src-markup-demo-fixtures-ts)                     |          0 |       7 |          7 |
| [`src/markup/html.ts`](#src-markup-html-ts)                                       |          0 |       3 |          3 |
| [`src/markup/hydrate.ts`](#src-markup-hydrate-ts)                                 |          0 |       3 |          3 |
| [`src/markup/mod.ts`](#src-markup-mod-ts)                                         |          6 |       0 |          0 |
| [`src/markup/widgets.ts`](#src-markup-widgets-ts)                                 |          0 |      15 |         15 |
| [`src/perf/benchmark.ts`](#src-perf-benchmark-ts)                                 |          0 |      19 |         19 |
| [`src/perf/mod.ts`](#src-perf-mod-ts)                                             |          1 |       0 |          0 |
| [`src/platform/mod.ts`](#src-platform-mod-ts)                                     |          1 |       0 |          0 |
| [`src/platform/types.ts`](#src-platform-types-ts)                                 |          0 |      10 |         10 |
| [`src/runtime/capabilities.ts`](#src-runtime-capabilities-ts)                     |          0 |      16 |         16 |
| [`src/runtime/data_pipeline_bindings.ts`](#src-runtime-data-pipeline-bindings-ts) |          0 |       4 |          4 |
| [`src/runtime/data_pipeline.ts`](#src-runtime-data-pipeline-ts)                   |          0 |      19 |         19 |
| [`src/runtime/data_query.ts`](#src-runtime-data-query-ts)                         |          0 |      15 |         15 |
| [`src/runtime/graphics_surface.ts`](#src-runtime-graphics-surface-ts)             |          0 |      15 |         15 |
| [`src/runtime/kitty_graphics.ts`](#src-runtime-kitty-graphics-ts)                 |          0 |      25 |         25 |
| [`src/runtime/profiles.ts`](#src-runtime-profiles-ts)                             |          0 |      24 |         24 |
| [`src/runtime/render_loop.ts`](#src-runtime-render-loop-ts)                       |          0 |      10 |         10 |
| [`src/runtime/renderer_backends.ts`](#src-runtime-renderer-backends-ts)           |          0 |      24 |         24 |
| [`src/runtime/resource_bindings.ts`](#src-runtime-resource-bindings-ts)           |          0 |       4 |          4 |
| [`src/runtime/resource.ts`](#src-runtime-resource-ts)                             |          0 |      14 |         14 |
| [`src/runtime/scheduler.ts`](#src-runtime-scheduler-ts)                           |          0 |      13 |         13 |
| [`src/runtime/storage.ts`](#src-runtime-storage-ts)                               |          0 |       9 |          9 |
| [`src/runtime/telemetry.ts`](#src-runtime-telemetry-ts)                           |          0 |      15 |         15 |
| [`src/runtime/terminal_screen.ts`](#src-runtime-terminal-screen-ts)               |          0 |       6 |          6 |
| [`src/runtime/terminal_workspace.ts`](#src-runtime-terminal-workspace-ts)         |          0 |      18 |         18 |
| [`src/runtime/worker_pool.ts`](#src-runtime-worker-pool-ts)                       |          0 |      12 |         12 |
| [`src/selection.ts`](#src-selection-ts)                                           |          0 |      16 |         16 |
| [`src/signals/computed.ts`](#src-signals-computed-ts)                             |          0 |       3 |          3 |
| [`src/signals/dependency_tracking.ts`](#src-signals-dependency-tracking-ts)       |          0 |       3 |          3 |
| [`src/signals/effect.ts`](#src-signals-effect-ts)                                 |          0 |       3 |          3 |
| [`src/signals/flusher.ts`](#src-signals-flusher-ts)                               |          0 |       1 |          1 |
| [`src/signals/lazy_computed.ts`](#src-signals-lazy-computed-ts)                   |          0 |       1 |          1 |
| [`src/signals/lazy_effect.ts`](#src-signals-lazy-effect-ts)                       |          0 |       1 |          1 |
| [`src/signals/mod.ts`](#src-signals-mod-ts)                                       |          9 |       0 |          0 |
| [`src/signals/reactivity.ts`](#src-signals-reactivity-ts)                         |          0 |      13 |         13 |
| [`src/signals/signal.ts`](#src-signals-signal-ts)                                 |          0 |      11 |         11 |
| [`src/signals/types.ts`](#src-signals-types-ts)                                   |          0 |       4 |          4 |
| [`src/theme_binding.ts`](#src-theme-binding-ts)                                   |          0 |       8 |          8 |
| [`src/theme_engine_cache.ts`](#src-theme-engine-cache-ts)                         |          0 |       6 |          6 |
| [`src/theme_engine_factory.ts`](#src-theme-engine-factory-ts)                     |          0 |      19 |         19 |
| [`src/theme_engine_pipeline.ts`](#src-theme-engine-pipeline-ts)                   |          0 |      12 |         12 |
| [`src/theme_gallery.ts`](#src-theme-gallery-ts)                                   |          0 |      11 |         11 |
| [`src/theme_resolver.ts`](#src-theme-resolver-ts)                                 |          0 |      15 |         15 |
| [`src/theme_workspace.ts`](#src-theme-workspace-ts)                               |          0 |       7 |          7 |
| [`src/theme.ts`](#src-theme-ts)                                                   |          0 |     115 |        115 |
| [`src/three_ascii/AcerolaAsciiNode.ts`](#src-three-ascii-acerolaasciinode-ts)     |          0 |       2 |          2 |
| [`src/three_ascii/demo_presets.ts`](#src-three-ascii-demo-presets-ts)             |          0 |      14 |         14 |
| [`src/three_ascii/glyphs.ts`](#src-three-ascii-glyphs-ts)                         |          0 |      13 |         13 |
| [`src/three_ascii/mod.ts`](#src-three-ascii-mod-ts)                               |          6 |       0 |          0 |
| [`src/three_ascii/options.ts`](#src-three-ascii-options-ts)                       |          0 |      15 |         15 |
| [`src/three_ascii/renderer.ts`](#src-three-ascii-renderer-ts)                     |          0 |       7 |          7 |
| [`src/three_ascii/webgpu_compat.ts`](#src-three-ascii-webgpu-compat-ts)           |          0 |       2 |          2 |
| [`src/utils/async.ts`](#src-utils-async-ts)                                       |          0 |       1 |          1 |
| [`src/utils/numbers.ts`](#src-utils-numbers-ts)                                   |          0 |       6 |          6 |
| [`src/utils/sorted_array.ts`](#src-utils-sorted-array-ts)                         |          0 |       2 |          2 |
| [`src/utils/strings.ts`](#src-utils-strings-ts)                                   |          0 |       9 |          9 |
| [`src/view.ts`](#src-view-ts)                                                     |          0 |       1 |          1 |
| [`src/viewport.ts`](#src-viewport-ts)                                             |          0 |      18 |         18 |
| [`src/web/cell_canvas_sink.ts`](#src-web-cell-canvas-sink-ts)                     |          0 |       5 |          5 |
| [`src/web/dom_renderer.ts`](#src-web-dom-renderer-ts)                             |          0 |       7 |          7 |
| [`src/web/host.ts`](#src-web-host-ts)                                             |          0 |       5 |          5 |
| [`src/web/mod.ts`](#src-web-mod-ts)                                               |          5 |       0 |          0 |
| [`src/web/platform.ts`](#src-web-platform-ts)                                     |          0 |       7 |          7 |
| [`src/web/remote_terminal.ts`](#src-web-remote-terminal-ts)                       |          0 |      19 |         19 |

### Modules

#### mod.web.ts

| Re-export Target                        | Kind | Names |
| --------------------------------------- | ---- | ----- |
| `src/event_emitter.ts`                  | star | -     |
| `src/focus.ts`                          | star | -     |
| `src/selection.ts`                      | star | -     |
| `src/theme.ts`                          | star | -     |
| `src/theme_binding.ts`                  | star | -     |
| `src/theme_engine_cache.ts`             | star | -     |
| `src/theme_engine_factory.ts`           | star | -     |
| `src/theme_engine_pipeline.ts`          | star | -     |
| `src/theme_gallery.ts`                  | star | -     |
| `src/grwizard_themes.ts`                | star | -     |
| `src/theme_resolver.ts`                 | star | -     |
| `src/theme_workspace.ts`                | star | -     |
| `src/api_stability.ts`                  | star | -     |
| `src/viewport.ts`                       | star | -     |
| `src/view.ts`                           | star | -     |
| `src/signals/mod.ts`                    | star | -     |
| `src/layout/mod.ts`                     | star | -     |
| `src/markup/mod.ts`                     | star | -     |
| `src/components/mod.ts`                 | star | -     |
| `src/platform/mod.ts`                   | star | -     |
| `src/web/mod.ts`                        | star | -     |
| `src/perf/mod.ts`                       | star | -     |
| `src/canvas/box.ts`                     | star | -     |
| `src/canvas/canvas.ts`                  | star | -     |
| `src/canvas/draw_object.ts`             | star | -     |
| `src/canvas/sink.ts`                    | star | -     |
| `src/canvas/text.ts`                    | star | -     |
| `src/canvas/three_ascii.ts`             | star | -     |
| `src/app/mod.ts`                        | star | -     |
| `src/runtime/capabilities.ts`           | star | -     |
| `src/runtime/data_pipeline.ts`          | star | -     |
| `src/runtime/data_pipeline_bindings.ts` | star | -     |
| `src/runtime/data_query.ts`             | star | -     |
| `src/runtime/graphics_surface.ts`       | star | -     |
| `src/runtime/kitty_graphics.ts`         | star | -     |
| `src/runtime/profiles.ts`               | star | -     |
| `src/runtime/renderer_backends.ts`      | star | -     |
| `src/runtime/resource.ts`               | star | -     |
| `src/runtime/resource_bindings.ts`      | star | -     |
| `src/runtime/render_loop.ts`            | star | -     |
| `src/runtime/scheduler.ts`              | star | -     |
| `src/runtime/storage.ts`                | star | -     |
| `src/runtime/telemetry.ts`              | star | -     |
| `src/runtime/terminal_screen.ts`        | star | -     |
| `src/runtime/terminal_workspace.ts`     | star | -     |
| `src/runtime/worker_pool.ts`            | star | -     |
| `src/three_ascii/mod.ts`                | star | -     |
| `src/utils/async.ts`                    | star | -     |
| `src/utils/numbers.ts`                  | star | -     |
| `src/utils/sorted_array.ts`             | star | -     |
| `src/utils/strings.ts`                  | star | -     |

_No direct exported symbols._

#### src/api_stability.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `ApiStabilityTier`                | type      | yes       | yes   |
| `apiSurfacePolicies`              | const     | no        | yes   |
| `ApiSurfacePolicy`                | interface | yes       | yes   |
| `ApiSurfacePolicyQuery`           | interface | yes       | yes   |
| `filterApiSurfacePolicies`        | function  | no        | yes   |
| `filterPackageEntrypoints`        | function  | no        | yes   |
| `formatPackageEntrypointMarkdown` | function  | no        | yes   |
| `packageEntrypointFor`            | function  | no        | yes   |
| `PackageEntrypointManifest`       | interface | yes       | yes   |
| `PackageEntrypointQuery`          | interface | yes       | yes   |
| `packageEntrypoints`              | const     | no        | yes   |
| `packageReleasePolicy`            | const     | no        | yes   |
| `PackageReleasePolicy`            | interface | yes       | yes   |
| `PackageRuntime`                  | type      | yes       | yes   |

#### src/app/actions.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `Action`              | interface | yes       | yes   |
| `ActionBus`           | class     | no        | yes   |
| `ActionBusInspection` | interface | yes       | yes   |
| `ActionDispatch`      | type      | yes       | yes   |
| `ActionHandler`       | type      | yes       | yes   |
| `ActionMiddleware`    | type      | yes       | yes   |
| `ActionOfType`        | type      | yes       | yes   |

#### src/app/app.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `AppCommandInspection` | interface | yes       | yes   |
| `AppKeymapInspection`  | interface | yes       | yes   |
| `AppPlugin`            | interface | yes       | yes   |
| `AppPluginDisposer`    | type      | yes       | yes   |
| `AppPluginFactory`     | type      | yes       | yes   |
| `AppPluginInspection`  | interface | yes       | yes   |
| `AppPluginInstaller`   | type      | yes       | yes   |
| `AppPluginUseOptions`  | interface | yes       | yes   |
| `AppRouteInspection`   | interface | yes       | yes   |
| `createApp`            | function  | no        | yes   |
| `TuiApp`               | class     | no        | yes   |
| `TuiAppInspection`     | interface | yes       | yes   |
| `TuiAppOptions`        | interface | yes       | yes   |

#### src/app/button_commands.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `bindButtonCommands`   | function  | no        | yes   |
| `ButtonCommandAction`  | type      | yes       | yes   |
| `ButtonCommandKind`    | type      | yes       | yes   |
| `ButtonCommandOptions` | interface | yes       | yes   |
| `ButtonCommandPayload` | interface | yes       | yes   |
| `buttonCommands`       | function  | no        | yes   |

#### src/app/checkbox_commands.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindCheckBoxCommands`   | function  | no        | yes   |
| `CheckBoxCommandAction`  | type      | yes       | yes   |
| `CheckBoxCommandKind`    | type      | yes       | yes   |
| `CheckBoxCommandOptions` | interface | yes       | yes   |
| `CheckBoxCommandPayload` | interface | yes       | yes   |
| `checkBoxCommands`       | function  | no        | yes   |

#### src/app/combobox_commands.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindComboBoxCommands`   | function  | no        | yes   |
| `ComboBoxCommandAction`  | type      | yes       | yes   |
| `ComboBoxCommandKind`    | type      | yes       | yes   |
| `ComboBoxCommandOptions` | interface | yes       | yes   |
| `ComboBoxCommandPayload` | interface | yes       | yes   |
| `comboBoxCommands`       | function  | no        | yes   |

#### src/app/command_bindings.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `bindCommandKeymap`                 | function  | no        | yes   |
| `bindCommandKeys`                   | function  | no        | yes   |
| `bindCommandSurface`                | function  | no        | yes   |
| `commandForKeyEvent`                | function  | no        | yes   |
| `CommandKeyBindingConflict`         | interface | yes       | yes   |
| `CommandKeyBindingInspection`       | interface | yes       | yes   |
| `CommandKeyBindingMarkdownOptions`  | interface | yes       | yes   |
| `CommandKeyBindingOptions`          | interface | yes       | yes   |
| `CommandKeyBindingReport`           | interface | yes       | yes   |
| `CommandKeyBindingReportInspection` | interface | yes       | yes   |
| `CommandKeyBindingReportOptions`    | interface | yes       | yes   |
| `CommandKeymapBindingOptions`       | interface | yes       | yes   |
| `CommandKeyTarget`                  | interface | yes       | yes   |
| `CommandSearchMatch`                | interface | yes       | yes   |
| `CommandSearchOptions`              | interface | yes       | yes   |
| `CommandSurfaceController`          | interface | yes       | yes   |
| `CommandSurfaceItem`                | interface | yes       | yes   |
| `commandSurfaceItems`               | function  | no        | yes   |
| `CommandSurfaceOptions`             | interface | yes       | yes   |
| `createCommandKeyBindingReport`     | function  | no        | yes   |
| `createCommandSurface`              | function  | no        | yes   |
| `executeCommandSurfaceItem`         | function  | no        | yes   |
| `formatCommandKeyBindingMarkdown`   | function  | no        | yes   |
| `inspectCommandKeyBindings`         | function  | no        | yes   |
| `rankCommandSurfaceItems`           | function  | no        | yes   |
| `searchCommandSurfaceItems`         | function  | no        | yes   |

#### src/app/command_search_index.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `CommandSearchIndex`              | interface | yes       | yes   |
| `CommandSearchIndexEntry`         | interface | yes       | yes   |
| `CommandSearchIndexField`         | interface | yes       | yes   |
| `CommandSearchIndexInspection`    | interface | yes       | yes   |
| `CommandSearchIndexOptions`       | interface | yes       | yes   |
| `createCommandSearchIndex`        | function  | no        | yes   |
| `createIndexedCommandSurface`     | function  | no        | yes   |
| `IndexedCommandSearchOptions`     | interface | yes       | yes   |
| `IndexedCommandSurfaceController` | interface | yes       | yes   |
| `IndexedCommandSurfaceInspection` | interface | yes       | yes   |
| `searchCommandSearchIndex`        | function  | no        | yes   |

#### src/app/commands.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `Command`                   | interface | yes       | yes   |
| `CommandActionFactory`      | type      | yes       | yes   |
| `CommandDispatch`           | type      | yes       | yes   |
| `CommandInspection`         | interface | yes       | yes   |
| `CommandProjection`         | interface | yes       | yes   |
| `CommandRegistry`           | class     | no        | yes   |
| `CommandRegistryInspection` | interface | yes       | yes   |
| `CommandRegistryListener`   | type      | yes       | yes   |

#### src/app/component_commands.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindComponentCatalogCommands`    | function  | no        | yes   |
| `ComponentCatalogCommandAction`   | type      | yes       | yes   |
| `ComponentCatalogCommandOptions`  | interface | yes       | yes   |
| `componentCatalogCommands`        | function  | no        | yes   |
| `inspectComponentCatalogCommands` | function  | no        | yes   |

#### src/app/data_query_bindings.ts

| Symbol                             | Kind      | Type Only | JSDoc |
| ---------------------------------- | --------- | --------- | ----- |
| `bindDataQueryParams`              | function  | no        | yes   |
| `bindDataQueryResult`              | function  | no        | yes   |
| `bindDataQueryTable`               | function  | no        | yes   |
| `DataQueryParamsBindingHandle`     | type      | yes       | yes   |
| `DataQueryParamsBindingInspection` | interface | yes       | yes   |
| `DataQueryParamsBindingOptions`    | interface | yes       | yes   |
| `DataQueryResultBindingHandle`     | type      | yes       | yes   |
| `DataQueryResultBindingInspection` | interface | yes       | yes   |
| `DataQueryResultBindingOptions`    | interface | yes       | yes   |
| `DataQueryTableBindingHandle`      | type      | yes       | yes   |
| `DataQueryTableBindingInspection`  | interface | yes       | yes   |
| `DataQueryTableBindingOptions`     | interface | yes       | yes   |

#### src/app/data_query_commands.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindDataQueryCommands`   | function  | no        | yes   |
| `DataQueryCommandAction`  | type      | yes       | yes   |
| `DataQueryCommandKind`    | type      | yes       | yes   |
| `DataQueryCommandOptions` | interface | yes       | yes   |
| `DataQueryCommandPayload` | interface | yes       | yes   |
| `dataQueryCommands`       | function  | no        | yes   |
| `DataQuerySortCommand`    | interface | yes       | yes   |

#### src/app/data_query_plugin.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `createDataQueryPlugin`         | function  | no        | yes   |
| `DataQueryAppPlugin`            | interface | yes       | yes   |
| `DataQueryPluginInspection`     | interface | yes       | yes   |
| `DataQueryPluginInstallContext` | interface | yes       | yes   |
| `DataQueryPluginOptions`        | interface | yes       | yes   |

#### src/app/data_table_commands.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindDataTableCommands`   | function  | no        | yes   |
| `DataTableCommandKind`    | type      | yes       | yes   |
| `DataTableCommandOptions` | interface | yes       | yes   |
| `dataTableCommands`       | function  | no        | yes   |

#### src/app/disposables.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `createDisposableStack`     | function  | no        | yes   |
| `DisposableStack`           | class     | no        | yes   |
| `DisposableStackInspection` | interface | yes       | yes   |
| `Disposer`                  | type      | yes       | yes   |
| `disposeReverse`            | function  | no        | yes   |
| `MaybeDisposer`             | type      | yes       | yes   |

#### src/app/focus_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindFocusCommands`   | function  | no        | yes   |
| `FocusCommandAction`  | type      | yes       | yes   |
| `FocusCommandKind`    | type      | yes       | yes   |
| `FocusCommandOptions` | interface | yes       | yes   |
| `FocusCommandPayload` | interface | yes       | yes   |
| `focusCommands`       | function  | no        | yes   |
| `FocusCommandTarget`  | interface | yes       | yes   |

#### src/app/form_bindings.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindFormField`           | function  | no        | yes   |
| `FormFieldBindingOptions` | interface | yes       | yes   |

#### src/app/form_commands.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindFormCommands`           | function  | no        | yes   |
| `FormCommandAction`          | type      | yes       | yes   |
| `FormCommandKind`            | type      | yes       | yes   |
| `FormCommandOptions`         | interface | yes       | yes   |
| `formCommands`               | function  | no        | yes   |
| `FormCommandSnapshotPayload` | interface | yes       | yes   |
| `FormFieldCommandPayload`    | interface | yes       | yes   |

#### src/app/forms.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `FieldName`                  | type      | yes       | yes   |
| `FieldValidator`             | type      | yes       | yes   |
| `FormController`             | class     | no        | yes   |
| `FormControllerOptions`      | interface | yes       | yes   |
| `FormErrorSummaryItem`       | interface | yes       | yes   |
| `FormField`                  | interface | yes       | yes   |
| `FormFieldInspection`        | interface | yes       | yes   |
| `FormFieldState`             | type      | yes       | yes   |
| `FormGroupInspection`        | interface | yes       | yes   |
| `FormInspection`             | interface | yes       | yes   |
| `FormSchemaAdapter`          | interface | yes       | yes   |
| `FormSchemaValidationErrors` | type      | yes       | yes   |
| `FormSnapshot`               | interface | yes       | yes   |
| `FormSubmitResult`           | interface | yes       | yes   |
| `FormValues`                 | type      | yes       | yes   |
| `minLength`                  | function  | no        | yes   |
| `required`                   | function  | no        | yes   |

#### src/app/history_bindings.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindHistoryCommands`        | function  | no        | yes   |
| `bindRouteHistory`           | function  | no        | yes   |
| `HistoryCommandKind`         | type      | yes       | yes   |
| `HistoryCommandOptions`      | interface | yes       | yes   |
| `historyCommands`            | function  | no        | yes   |
| `RouteHistoryBindingOptions` | interface | yes       | yes   |

#### src/app/history.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `HistoryEntryInspection` | interface | yes       | yes   |
| `HistoryInspection`      | interface | yes       | yes   |
| `HistoryStack`           | class     | no        | yes   |
| `HistoryStackOptions`    | interface | yes       | yes   |
| `HistoryTransaction`     | interface | yes       | yes   |

#### src/app/hit_targets.ts

| Symbol           | Kind      | Type Only | JSDoc |
| ---------------- | --------- | --------- | ----- |
| `clipRect`       | function  | no        | yes   |
| `contains`       | function  | no        | yes   |
| `HitTarget`      | interface | yes       | yes   |
| `HitTargetStack` | class     | no        | yes   |
| `inset`          | function  | no        | yes   |
| `intersects`     | function  | no        | yes   |

#### src/app/input_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindInputCommands`   | function  | no        | yes   |
| `InputCommandAction`  | type      | yes       | yes   |
| `InputCommandKind`    | type      | yes       | yes   |
| `InputCommandOptions` | interface | yes       | yes   |
| `InputCommandPayload` | interface | yes       | yes   |
| `inputCommands`       | function  | no        | yes   |

#### src/app/list_commands.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `bindListCommands`   | function  | no        | yes   |
| `ListCommandAction`  | type      | yes       | yes   |
| `ListCommandKind`    | type      | yes       | yes   |
| `ListCommandOptions` | interface | yes       | yes   |
| `ListCommandPayload` | interface | yes       | yes   |
| `listCommands`       | function  | no        | yes   |

#### src/app/log_viewer_commands.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindLogViewerCommands`   | function  | no        | yes   |
| `LogViewerCommandAction`  | type      | yes       | yes   |
| `LogViewerCommandKind`    | type      | yes       | yes   |
| `LogViewerCommandOptions` | interface | yes       | yes   |
| `LogViewerCommandPayload` | interface | yes       | yes   |
| `logViewerCommands`       | function  | no        | yes   |

#### src/app/menu_bar_commands.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `bindMenuBarCommands`   | function  | no        | yes   |
| `MenuBarCommandAction`  | type      | yes       | yes   |
| `MenuBarCommandKind`    | type      | yes       | yes   |
| `MenuBarCommandOptions` | interface | yes       | yes   |
| `MenuBarCommandPayload` | interface | yes       | yes   |
| `menuBarCommands`       | function  | no        | yes   |

#### src/app/metric_series_commands.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindMetricSeriesCommands`   | function  | no        | yes   |
| `MetricSeriesCommandAction`  | type      | yes       | yes   |
| `MetricSeriesCommandKind`    | type      | yes       | yes   |
| `MetricSeriesCommandOptions` | interface | yes       | yes   |
| `MetricSeriesCommandPayload` | interface | yes       | yes   |
| `metricSeriesCommands`       | function  | no        | yes   |

#### src/app/mod.ts

| Re-export Target                       | Kind | Names |
| -------------------------------------- | ---- | ----- |
| `src/app/actions.ts`                   | star | -     |
| `src/app/app.ts`                       | star | -     |
| `src/app/button_commands.ts`           | star | -     |
| `src/app/checkbox_commands.ts`         | star | -     |
| `src/app/combobox_commands.ts`         | star | -     |
| `src/app/component_commands.ts`        | star | -     |
| `src/app/command_bindings.ts`          | star | -     |
| `src/app/command_search_index.ts`      | star | -     |
| `src/app/commands.ts`                  | star | -     |
| `src/app/data_query_bindings.ts`       | star | -     |
| `src/app/data_query_commands.ts`       | star | -     |
| `src/app/data_query_plugin.ts`         | star | -     |
| `src/app/data_table_commands.ts`       | star | -     |
| `src/app/disposables.ts`               | star | -     |
| `src/app/form_bindings.ts`             | star | -     |
| `src/app/form_commands.ts`             | star | -     |
| `src/app/focus_commands.ts`            | star | -     |
| `src/app/forms.ts`                     | star | -     |
| `src/app/history_bindings.ts`          | star | -     |
| `src/app/history.ts`                   | star | -     |
| `src/app/hit_targets.ts`               | star | -     |
| `src/app/input_commands.ts`            | star | -     |
| `src/app/list_commands.ts`             | star | -     |
| `src/app/log_viewer_commands.ts`       | star | -     |
| `src/app/menu_bar_commands.ts`         | star | -     |
| `src/app/metric_series_commands.ts`    | star | -     |
| `src/app/mouse_bindings.ts`            | star | -     |
| `src/app/pad_commands.ts`              | star | -     |
| `src/app/plugins.ts`                   | star | -     |
| `src/app/progress_bar_commands.ts`     | star | -     |
| `src/app/radio_group_commands.ts`      | star | -     |
| `src/app/route_bindings.ts`            | star | -     |
| `src/app/router.ts`                    | star | -     |
| `src/app/runtime_profile_commands.ts`  | star | -     |
| `src/app/runtime_profile_plugin.ts`    | star | -     |
| `src/app/runtime_renderer_commands.ts` | star | -     |
| `src/app/runtime_renderer_plugin.ts`   | star | -     |
| `src/app/runtime_workload_commands.ts` | star | -     |
| `src/app/scroll_area_commands.ts`      | star | -     |
| `src/app/selection_bindings.ts`        | star | -     |
| `src/app/settings_commands.ts`         | star | -     |
| `src/app/settings_bindings.ts`         | star | -     |
| `src/app/settings.ts`                  | star | -     |
| `src/app/slider_commands.ts`           | star | -     |
| `src/app/split_pane_commands.ts`       | star | -     |
| `src/app/stepper_commands.ts`          | star | -     |
| `src/app/surface_bindings.ts`          | star | -     |
| `src/app/table_commands.ts`            | star | -     |
| `src/app/tabs_commands.ts`             | star | -     |
| `src/app/terminal_commands.ts`         | star | -     |
| `src/app/terminal_input.ts`            | star | -     |
| `src/app/terminal_window_bindings.ts`  | star | -     |
| `src/app/textbox_commands.ts`          | star | -     |
| `src/app/theme_commands.ts`            | star | -     |
| `src/app/theme_engine_commands.ts`     | star | -     |
| `src/app/theme_pipeline_commands.ts`   | star | -     |
| `src/app/theme_plugin.ts`              | star | -     |
| `src/app/theme_workspace_plugin.ts`    | star | -     |
| `src/app/toast_commands.ts`            | star | -     |
| `src/app/tree_commands.ts`             | star | -     |
| `src/app/window_manager_commands.ts`   | star | -     |
| `src/app/workbench_frame.ts`           | star | -     |
| `src/app/workbench_menu.ts`            | star | -     |
| `src/app/workbench_window_registry.ts` | star | -     |
| `src/app/workbench_workspace.ts`       | star | -     |

_No direct exported symbols._

#### src/app/mouse_bindings.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `bindMouseInteractions`          | function  | no        | yes   |
| `createMouseInteractionRouter`   | function  | no        | yes   |
| `MouseInteractionContext`        | interface | yes       | yes   |
| `MouseInteractionDispatchResult` | interface | yes       | yes   |
| `MouseInteractionEvent`          | type      | yes       | yes   |
| `MouseInteractionHandler`        | type      | yes       | yes   |
| `MouseInteractionInspection`     | interface | yes       | yes   |
| `MouseInteractionKind`           | type      | yes       | yes   |
| `MouseInteractionRouter`         | class     | no        | yes   |
| `MouseInteractionTarget`         | interface | yes       | yes   |

#### src/app/pad_commands.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `bindPadCommands`   | function  | no        | yes   |
| `PadCommandAction`  | type      | yes       | yes   |
| `PadCommandKind`    | type      | yes       | yes   |
| `PadCommandOptions` | interface | yes       | yes   |
| `PadCommandPayload` | interface | yes       | yes   |
| `padCommands`       | function  | no        | yes   |

#### src/app/plugins.ts

| Symbol                                  | Kind      | Type Only | JSDoc |
| --------------------------------------- | --------- | --------- | ----- |
| `AppPluginCatalogInspection`            | interface | yes       | yes   |
| `AppPluginCatalogMarkdownOptions`       | interface | yes       | yes   |
| `AppPluginCatalogQuery`                 | interface | yes       | yes   |
| `AppPluginCatalogReport`                | interface | yes       | yes   |
| `AppPluginCatalogReportOptions`         | interface | yes       | yes   |
| `AppPluginDefinition`                   | interface | yes       | yes   |
| `AppPluginDefinitionInspection`         | interface | yes       | yes   |
| `AppPluginDefinitionRegistry`           | class     | no        | yes   |
| `AppPluginDefinitionRegistryInspection` | interface | yes       | yes   |
| `AppPluginRoute`                        | interface | yes       | yes   |
| `createAppPlugin`                       | function  | no        | yes   |
| `createAppPluginCatalogReport`          | function  | no        | yes   |
| `createAppPluginDefinitionRegistry`     | function  | no        | yes   |
| `formatAppPluginCatalogMarkdown`        | function  | no        | yes   |
| `inspectAppPluginCatalog`               | function  | no        | yes   |
| `inspectAppPluginDefinition`            | function  | no        | yes   |
| `queryAppPluginDefinitions`             | function  | no        | yes   |

#### src/app/progress_bar_commands.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `bindProgressBarCommands`   | function  | no        | yes   |
| `ProgressBarCommandAction`  | type      | yes       | yes   |
| `ProgressBarCommandKind`    | type      | yes       | yes   |
| `ProgressBarCommandOptions` | interface | yes       | yes   |
| `ProgressBarCommandPayload` | interface | yes       | yes   |
| `progressBarCommands`       | function  | no        | yes   |

#### src/app/radio_group_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindRadioGroupCommands`   | function  | no        | yes   |
| `RadioGroupCommandAction`  | type      | yes       | yes   |
| `RadioGroupCommandKind`    | type      | yes       | yes   |
| `RadioGroupCommandOptions` | interface | yes       | yes   |
| `RadioGroupCommandPayload` | interface | yes       | yes   |
| `radioGroupCommands`       | function  | no        | yes   |

#### src/app/route_bindings.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `bindRouteCommands`         | function  | no        | yes   |
| `bindRouteIndex`            | function  | no        | yes   |
| `bindRouteSignal`           | function  | no        | yes   |
| `RouteCommandKind`          | type      | yes       | yes   |
| `RouteCommandOptions`       | interface | yes       | yes   |
| `routeCommands`             | function  | no        | yes   |
| `RouteIdSource`             | type      | yes       | yes   |
| `RouteIndexBindingOptions`  | interface | yes       | yes   |
| `RouteSignalBindingOptions` | interface | yes       | yes   |

#### src/app/router.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `Route`                  | interface | yes       | yes   |
| `RouteInspection`        | interface | yes       | yes   |
| `RouteManager`           | class     | no        | yes   |
| `RouteRegisterOptions`   | interface | yes       | yes   |
| `RouteUnregisterOptions` | interface | yes       | yes   |

#### src/app/runtime_profile_commands.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `bindRuntimeProfileCommands`   | function  | no        | yes   |
| `RuntimeProfileChangedPayload` | interface | yes       | yes   |
| `RuntimeProfileCommandAction`  | type      | yes       | yes   |
| `RuntimeProfileCommandOptions` | interface | yes       | yes   |
| `runtimeProfileCommands`       | function  | no        | yes   |

#### src/app/runtime_profile_plugin.ts

| Symbol                               | Kind      | Type Only | JSDoc |
| ------------------------------------ | --------- | --------- | ----- |
| `createRuntimeProfilePlugin`         | function  | no        | yes   |
| `RuntimeProfileAppPlugin`            | interface | yes       | yes   |
| `RuntimeProfilePluginInspection`     | interface | yes       | yes   |
| `RuntimeProfilePluginInstallContext` | interface | yes       | yes   |
| `RuntimeProfilePluginOptions`        | interface | yes       | yes   |

#### src/app/runtime_renderer_commands.ts

| Symbol                                 | Kind      | Type Only | JSDoc |
| -------------------------------------- | --------- | --------- | ----- |
| `bindRuntimeRendererBackendCommands`   | function  | no        | yes   |
| `RuntimeRendererBackendChangedPayload` | interface | yes       | yes   |
| `RuntimeRendererBackendCommandAction`  | type      | yes       | yes   |
| `RuntimeRendererBackendCommandOptions` | interface | yes       | yes   |
| `runtimeRendererBackendCommands`       | function  | no        | yes   |

#### src/app/runtime_renderer_plugin.ts

| Symbol                                       | Kind      | Type Only | JSDoc |
| -------------------------------------------- | --------- | --------- | ----- |
| `createRuntimeRendererBackendPlugin`         | function  | no        | yes   |
| `RuntimeRendererBackendAppPlugin`            | interface | yes       | yes   |
| `RuntimeRendererBackendPluginInspection`     | interface | yes       | yes   |
| `RuntimeRendererBackendPluginInstallContext` | interface | yes       | yes   |
| `RuntimeRendererBackendPluginOptions`        | interface | yes       | yes   |

#### src/app/runtime_workload_commands.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `bindRuntimeWorkloadCommands`    | function  | no        | yes   |
| `RuntimeWorkloadCommandAction`   | type      | yes       | yes   |
| `RuntimeWorkloadCommandOptions`  | interface | yes       | yes   |
| `runtimeWorkloadCommands`        | function  | no        | yes   |
| `RuntimeWorkloadReportedPayload` | interface | yes       | yes   |

#### src/app/scroll_area_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindScrollAreaCommands`   | function  | no        | yes   |
| `ScrollAreaCommandAction`  | type      | yes       | yes   |
| `ScrollAreaCommandKind`    | type      | yes       | yes   |
| `ScrollAreaCommandOptions` | interface | yes       | yes   |
| `ScrollAreaCommandPayload` | interface | yes       | yes   |
| `scrollAreaCommands`       | function  | no        | yes   |

#### src/app/selection_bindings.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `bindSelectionCommands`        | function  | no        | yes   |
| `bindSelectionValue`           | function  | no        | yes   |
| `SelectionCommandKind`         | type      | yes       | yes   |
| `SelectionCommandOptions`      | interface | yes       | yes   |
| `selectionCommands`            | function  | no        | yes   |
| `SelectionItemsSource`         | type      | yes       | yes   |
| `SelectionPageSize`            | type      | yes       | yes   |
| `SelectionValueBindingOptions` | interface | yes       | yes   |

#### src/app/settings_bindings.ts

| Symbol                                        | Kind      | Type Only | JSDoc |
| --------------------------------------------- | --------- | --------- | ----- |
| `bindDataQuerySetting`                        | function  | no        | yes   |
| `bindDataTableSetting`                        | function  | no        | yes   |
| `bindRouteSetting`                            | function  | no        | yes   |
| `bindRuntimeProfileSetting`                   | function  | no        | yes   |
| `bindRuntimeRendererBackendSetting`           | function  | no        | yes   |
| `bindSettingSignal`                           | function  | no        | yes   |
| `bindSplitPaneSetting`                        | function  | no        | yes   |
| `bindThemeLayerSetting`                       | function  | no        | yes   |
| `bindThemePipelineSetting`                    | function  | no        | yes   |
| `bindThemeSetting`                            | function  | no        | yes   |
| `DataQuerySettingBindingOptions`              | interface | yes       | yes   |
| `DataTableSettingBindingOptions`              | interface | yes       | yes   |
| `RouteSettingBindingOptions`                  | interface | yes       | yes   |
| `RuntimeProfileSettingBindingOptions`         | interface | yes       | yes   |
| `RuntimeRendererBackendSettingBindingOptions` | interface | yes       | yes   |
| `SettingBinding`                              | interface | yes       | yes   |
| `SettingSignalBindingOptions`                 | interface | yes       | yes   |
| `SplitPaneSettingBindingOptions`              | interface | yes       | yes   |
| `ThemeLayerSettingBindingOptions`             | interface | yes       | yes   |
| `ThemePipelineSettingBindingOptions`          | interface | yes       | yes   |
| `ThemeSettingBindingOptions`                  | interface | yes       | yes   |

#### src/app/settings_commands.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindSettingsCommands`   | function  | no        | yes   |
| `SettingsCommandAction`  | type      | yes       | yes   |
| `SettingsCommandKind`    | type      | yes       | yes   |
| `SettingsCommandOptions` | interface | yes       | yes   |
| `settingsCommands`       | function  | no        | yes   |

#### src/app/settings.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `AppSettingDefinition`         | interface | yes       | yes   |
| `createSettingsController`     | function  | no        | yes   |
| `SettingsController`           | class     | no        | yes   |
| `SettingsControllerInspection` | interface | yes       | yes   |
| `SettingsControllerOptions`    | interface | yes       | yes   |

#### src/app/slider_commands.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `bindSliderCommands`   | function  | no        | yes   |
| `SliderCommandAction`  | type      | yes       | yes   |
| `SliderCommandKind`    | type      | yes       | yes   |
| `SliderCommandOptions` | interface | yes       | yes   |
| `SliderCommandPayload` | interface | yes       | yes   |
| `sliderCommands`       | function  | no        | yes   |

#### src/app/split_pane_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindSplitPaneCommands`    | function  | no        | yes   |
| `SplitPaneBoundsSource`    | type      | yes       | yes   |
| `SplitPaneCommandAction`   | type      | yes       | yes   |
| `SplitPaneCommandKind`     | type      | yes       | yes   |
| `SplitPaneCommandOptions`  | interface | yes       | yes   |
| `splitPaneCommands`        | function  | no        | yes   |
| `SplitPaneSnapshotPayload` | interface | yes       | yes   |

#### src/app/stepper_commands.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `bindStepperCommands`   | function  | no        | yes   |
| `StepperCommandAction`  | type      | yes       | yes   |
| `StepperCommandKind`    | type      | yes       | yes   |
| `StepperCommandOptions` | interface | yes       | yes   |
| `StepperCommandPayload` | interface | yes       | yes   |
| `stepperCommands`       | function  | no        | yes   |

#### src/app/surface_bindings.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindModalFocus`           | function  | no        | yes   |
| `ModalFocusBindingOptions` | interface | yes       | yes   |

#### src/app/table_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindTableCommands`   | function  | no        | yes   |
| `TableCommandAction`  | type      | yes       | yes   |
| `TableCommandKind`    | type      | yes       | yes   |
| `TableCommandOptions` | interface | yes       | yes   |
| `TableCommandPayload` | interface | yes       | yes   |
| `tableCommands`       | function  | no        | yes   |

#### src/app/tabs_commands.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `bindTabsCommands`   | function  | no        | yes   |
| `TabsCommandAction`  | type      | yes       | yes   |
| `TabsCommandKind`    | type      | yes       | yes   |
| `TabsCommandOptions` | interface | yes       | yes   |
| `TabsCommandPayload` | interface | yes       | yes   |
| `tabsCommands`       | function  | no        | yes   |

#### src/app/terminal_commands.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindTerminalCommands`            | function  | no        | yes   |
| `bindTerminalWorkspaceCommands`   | function  | no        | yes   |
| `TerminalCommandAction`           | type      | yes       | yes   |
| `TerminalCommandKind`             | type      | yes       | yes   |
| `TerminalCommandOptions`          | interface | yes       | yes   |
| `TerminalCommandPayload`          | interface | yes       | yes   |
| `terminalCommands`                | function  | no        | yes   |
| `TerminalWorkspaceCommandAction`  | type      | yes       | yes   |
| `TerminalWorkspaceCommandKind`    | type      | yes       | yes   |
| `TerminalWorkspaceCommandOptions` | interface | yes       | yes   |
| `TerminalWorkspaceCommandPayload` | interface | yes       | yes   |
| `terminalWorkspaceCommands`       | function  | no        | yes   |

#### src/app/terminal_input.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `encodeTerminalKeyPress`      | function  | no        | yes   |
| `encodeTerminalPaste`         | function  | no        | yes   |
| `isReservedTerminalKey`       | function  | no        | yes   |
| `routeTerminalKeyPress`       | function  | no        | yes   |
| `routeTerminalPaste`          | function  | no        | yes   |
| `TerminalInputMode`           | type      | yes       | yes   |
| `TerminalInputRouteDecision`  | interface | yes       | yes   |
| `TerminalInputRoutingOptions` | interface | yes       | yes   |
| `TerminalInputTarget`         | interface | yes       | yes   |

#### src/app/terminal_window_bindings.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `syncTerminalWindowLayout`        | function  | no        | yes   |
| `TerminalWindowBinding`           | interface | yes       | yes   |
| `terminalWindowContentSize`       | function  | no        | yes   |
| `TerminalWindowLayoutSyncOptions` | interface | yes       | yes   |
| `TerminalWindowLayoutSyncResult`  | interface | yes       | yes   |

#### src/app/textbox_commands.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `bindTextBoxCommands`   | function  | no        | yes   |
| `TextBoxCommandAction`  | type      | yes       | yes   |
| `TextBoxCommandKind`    | type      | yes       | yes   |
| `TextBoxCommandOptions` | interface | yes       | yes   |
| `TextBoxCommandPayload` | interface | yes       | yes   |
| `textBoxCommands`       | function  | no        | yes   |

#### src/app/theme_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindThemeCommands`        | function  | no        | yes   |
| `ThemeChangedPayload`      | interface | yes       | yes   |
| `ThemeCommandAction`       | type      | yes       | yes   |
| `ThemeCommandOptions`      | interface | yes       | yes   |
| `themeCommands`            | function  | no        | yes   |
| `ThemeLayerChangedPayload` | interface | yes       | yes   |
| `themeLayerCommands`       | function  | no        | yes   |
| `themePreviewCommands`     | function  | no        | yes   |
| `ThemePreviewPayload`      | interface | yes       | yes   |
| `themeSelectionCommands`   | function  | no        | yes   |

#### src/app/theme_engine_commands.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindThemeEngineCommands`    | function  | no        | yes   |
| `themeEngineCatalogCommands` | function  | no        | yes   |
| `ThemeEngineCatalogPayload`  | interface | yes       | yes   |
| `ThemeEngineCommandAction`   | type      | yes       | yes   |
| `ThemeEngineCommandOptions`  | interface | yes       | yes   |
| `themeEngineCommands`        | function  | no        | yes   |
| `ThemeEngineCommandSource`   | type      | yes       | yes   |
| `themeEngineFactoryCommands` | function  | no        | yes   |
| `ThemeEnginePreviewPayload`  | interface | yes       | yes   |

#### src/app/theme_pipeline_commands.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindThemePipelineCommands`       | function  | no        | yes   |
| `ThemePipelineCommandAction`      | type      | yes       | yes   |
| `ThemePipelineCommandOptions`     | interface | yes       | yes   |
| `themePipelineCommands`           | function  | no        | yes   |
| `ThemePipelineStepChangedPayload` | interface | yes       | yes   |

#### src/app/theme_plugin.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createThemePlugin`                 | function  | no        | yes   |
| `ThemeAppPlugin`                    | interface | yes       | yes   |
| `ThemePluginInspection`             | interface | yes       | yes   |
| `ThemePluginInstallContext`         | interface | yes       | yes   |
| `ThemePluginOptions`                | interface | yes       | yes   |
| `ThemePluginPipelineCommandOptions` | type      | yes       | yes   |
| `ThemePluginPipelineSettingOption`  | type      | yes       | yes   |
| `ThemePluginPipelineSettingOptions` | type      | yes       | yes   |

#### src/app/theme_workspace_plugin.ts

| Symbol                               | Kind      | Type Only | JSDoc |
| ------------------------------------ | --------- | --------- | ----- |
| `createThemeWorkspacePlugin`         | function  | no        | yes   |
| `ThemeWorkspaceAppPlugin`            | interface | yes       | yes   |
| `ThemeWorkspacePluginInspection`     | interface | yes       | yes   |
| `ThemeWorkspacePluginInstallContext` | interface | yes       | yes   |
| `ThemeWorkspacePluginOptions`        | interface | yes       | yes   |

#### src/app/toast_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindToastCommands`   | function  | no        | yes   |
| `ToastCommandAction`  | type      | yes       | yes   |
| `ToastCommandKind`    | type      | yes       | yes   |
| `ToastCommandOptions` | interface | yes       | yes   |
| `ToastCommandPayload` | interface | yes       | yes   |
| `toastCommands`       | function  | no        | yes   |

#### src/app/tree_commands.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `bindTreeCommands`   | function  | no        | yes   |
| `TreeCommandAction`  | type      | yes       | yes   |
| `TreeCommandKind`    | type      | yes       | yes   |
| `TreeCommandOptions` | interface | yes       | yes   |
| `TreeCommandPayload` | interface | yes       | yes   |
| `treeCommands`       | function  | no        | yes   |

#### src/app/window_manager_commands.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `bindWindowManagerCommands`   | function  | no        | yes   |
| `WindowManagerCommandAction`  | type      | yes       | yes   |
| `WindowManagerCommandKind`    | type      | yes       | yes   |
| `WindowManagerCommandOptions` | interface | yes       | yes   |
| `WindowManagerCommandPayload` | interface | yes       | yes   |
| `windowManagerCommands`       | function  | no        | yes   |
| `WindowManagerRenameFactory`  | type      | yes       | yes   |
| `WindowManagerWindowFactory`  | type      | yes       | yes   |

#### src/app/workbench_frame.ts

| Symbol                | Kind     | Type Only | JSDoc |
| --------------------- | -------- | --------- | ----- |
| `buttonText`          | function | no        | yes   |
| `centerCellText`      | function | no        | yes   |
| `contrastText`        | function | no        | yes   |
| `fillFrameRect`       | function | no        | yes   |
| `fillFrameRow`        | function | no        | yes   |
| `fitCellText`         | function | no        | yes   |
| `parseHexColor`       | function | no        | yes   |
| `renderFrameRow`      | function | no        | yes   |
| `renderFrameSlice`    | function | no        | yes   |
| `toStyledCells`       | function | no        | yes   |
| `WorkbenchFrame`      | type     | yes       | yes   |
| `WorkbenchFrameStyle` | type     | yes       | yes   |
| `writeFrame`          | function | no        | yes   |

#### src/app/workbench_menu.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `isWorkbenchMenuActivationKey`  | function  | no        | yes   |
| `isWorkbenchMenuCloseKey`       | function  | no        | yes   |
| `moveWorkbenchMenuIndex`        | function  | no        | yes   |
| `MoveWorkbenchMenuIndexOptions` | interface | yes       | yes   |
| `WorkbenchMenuKey`              | interface | yes       | yes   |

#### src/app/workbench_window_registry.ts

| Symbol                                      | Kind      | Type Only | JSDoc |
| ------------------------------------------- | --------- | --------- | ----- |
| `createWorkbenchVisualizationWindowOptions` | function  | no        | yes   |
| `createWorkbenchWindowOptions`              | function  | no        | yes   |
| `isWorkbenchVisualizationWindowId`          | function  | no        | yes   |
| `isWorkbenchWindowOptionLoaded`             | function  | no        | yes   |
| `workbenchVisualizationIdFromWindowId`      | function  | no        | yes   |
| `WorkbenchVisualizationOptionSource`        | interface | yes       | yes   |
| `workbenchVisualizationWindowId`            | function  | no        | yes   |
| `WorkbenchWindowOption`                     | interface | yes       | yes   |
| `WorkbenchWindowOptionCatalogInput`         | interface | yes       | yes   |
| `WorkbenchWindowOptionGroup`                | type      | yes       | yes   |
| `workbenchWindowOptionMenuLabel`            | function  | no        | yes   |
| `workbenchWindowOptionMinimums`             | function  | no        | yes   |
| `WorkbenchWindowOptionMinimums`             | interface | yes       | yes   |

#### src/app/workbench_workspace.ts

| Symbol                                         | Kind      | Type Only | JSDoc |
| ---------------------------------------------- | --------- | --------- | ----- |
| `defaultWorkbenchMinimizedState`               | function  | no        | yes   |
| `deleteWorkbenchWorkspace`                     | function  | no        | yes   |
| `findWorkbenchWorkspace`                       | function  | no        | yes   |
| `normalizeWorkbenchPanelWorkspaceState`        | function  | no        | yes   |
| `NormalizeWorkbenchPanelWorkspaceStateOptions` | interface | yes       | yes   |
| `normalizeWorkbenchWorkspaceName`              | function  | no        | yes   |
| `normalizeWorkbenchWorkspaces`                 | function  | no        | yes   |
| `NormalizeWorkbenchWorkspacesOptions`          | interface | yes       | yes   |
| `normalizeWorkbenchWorkspaceStorage`           | function  | no        | yes   |
| `renameWorkbenchWorkspace`                     | function  | no        | yes   |
| `serializeWorkbenchWorkspaces`                 | function  | no        | yes   |
| `upsertWorkbenchWorkspace`                     | function  | no        | yes   |
| `WORKBENCH_WORKSPACE_STORAGE_VERSION`          | const     | no        | yes   |
| `WorkbenchPanelWorkspaceState`                 | interface | yes       | yes   |
| `WorkbenchWorkspace`                           | interface | yes       | yes   |
| `WorkbenchWorkspaceStorage`                    | interface | yes       | yes   |
| `WorkbenchWorkspaceWindow`                     | interface | yes       | yes   |
| `workbenchWorkspaceWindowEntries`              | function  | no        | yes   |

#### src/canvas/box.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `BoxObject`        | class     | no        | yes   |
| `BoxObjectOptions` | interface | yes       | yes   |

#### src/canvas/canvas.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `Canvas`            | class     | no        | yes   |
| `CanvasEventMap`    | type      | yes       | yes   |
| `CanvasOptions`     | interface | yes       | yes   |
| `CanvasRenderStats` | interface | yes       | yes   |

#### src/canvas/draw_object.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `DrawObject`        | class     | no        | yes   |
| `DrawObjectOptions` | interface | yes       | yes   |

#### src/canvas/sink.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `AnsiCanvasSink`          | class     | no        | yes   |
| `AnsiCanvasSinkOptions`   | interface | yes       | yes   |
| `CanvasCellSink`          | interface | yes       | yes   |
| `CanvasCellUpdate`        | interface | yes       | yes   |
| `CanvasRowRangeUpdate`    | interface | yes       | yes   |
| `CanvasStdout`            | interface | yes       | yes   |
| `coalesceCanvasRowRanges` | function  | no        | yes   |
| `MemoryCanvasSink`        | class     | no        | yes   |

#### src/canvas/text.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `TextObject`        | class     | no        | yes   |
| `TextObjectOptions` | interface | yes       | yes   |
| `TextRectangle`     | type      | yes       | yes   |

#### src/canvas/three_ascii.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `buildFallbackGrid`              | function  | no        | yes   |
| `formatThreeAsciiFallbackDetail` | function  | no        | yes   |
| `ThreeAsciiGridRenderer`         | interface | yes       | yes   |
| `ThreeAsciiObject`               | class     | no        | yes   |
| `ThreeAsciiObjectOptions`        | interface | yes       | yes   |
| `ThreeAsciiRendererFactory`      | type      | yes       | yes   |

#### src/components/box.ts

| Symbol | Kind  | Type Only | JSDoc |
| ------ | ----- | --------- | ----- |
| `Box`  | class | no        | yes   |

#### src/components/breadcrumbs.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `BreadcrumbItem`     | interface | yes       | yes   |
| `Breadcrumbs`        | class     | no        | yes   |
| `BreadcrumbsOptions` | interface | yes       | yes   |
| `renderBreadcrumbs`  | function  | no        | yes   |

#### src/components/button.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `Button`                  | class     | no        | yes   |
| `ButtonController`        | class     | no        | yes   |
| `ButtonControllerOptions` | interface | yes       | yes   |
| `ButtonInspection`        | interface | yes       | yes   |
| `ButtonOptions`           | interface | yes       | yes   |

#### src/components/catalog.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `componentCapabilities`           | function  | no        | yes   |
| `ComponentCapability`             | type      | yes       | yes   |
| `componentCatalog`                | const     | no        | yes   |
| `ComponentCatalogEntry`           | interface | yes       | yes   |
| `ComponentCatalogInspection`      | interface | yes       | yes   |
| `ComponentCatalogMarkdownOptions` | interface | yes       | yes   |
| `ComponentCatalogQuery`           | interface | yes       | yes   |
| `ComponentCatalogReport`          | interface | yes       | yes   |
| `ComponentCatalogReportOptions`   | interface | yes       | yes   |
| `componentCategories`             | function  | no        | yes   |
| `ComponentCategory`               | type      | yes       | yes   |
| `componentsByCategory`            | function  | no        | yes   |
| `componentsWithCapability`        | function  | no        | yes   |
| `createComponentCatalogReport`    | function  | no        | yes   |
| `findComponent`                   | function  | no        | yes   |
| `formatComponentCatalogMarkdown`  | function  | no        | yes   |
| `inspectComponentCatalog`         | function  | no        | yes   |
| `listComponents`                  | function  | no        | yes   |
| `queryComponents`                 | function  | no        | yes   |

#### src/components/chart.ts

| Symbol           | Kind      | Type Only | JSDoc |
| ---------------- | --------- | --------- | ----- |
| `Chart`          | class     | no        | yes   |
| `ChartOptions`   | interface | yes       | yes   |
| `renderBarChart` | function  | no        | yes   |

#### src/components/checkbox.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `CheckBox`                  | class     | no        | yes   |
| `CheckBoxController`        | class     | no        | yes   |
| `CheckBoxControllerOptions` | interface | yes       | yes   |
| `CheckBoxInspection`        | interface | yes       | yes   |
| `CheckBoxOptions`           | interface | yes       | yes   |
| `Mark`                      | enum      | no        | yes   |
| `renderCheckBoxMark`        | function  | no        | yes   |

#### src/components/combobox.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `clampComboBoxIndex`        | function  | no        | yes   |
| `ComboBox`                  | class     | no        | yes   |
| `ComboBoxController`        | class     | no        | yes   |
| `ComboBoxControllerOptions` | interface | yes       | yes   |
| `ComboBoxInspection`        | interface | yes       | yes   |
| `comboBoxLabel`             | function  | no        | yes   |
| `ComboBoxOptions`           | interface | yes       | yes   |

#### src/components/command_palette.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `clampCommandPaletteSelection`    | function  | no        | yes   |
| `CommandPalette`                  | class     | no        | yes   |
| `CommandPaletteController`        | class     | no        | yes   |
| `CommandPaletteControllerOptions` | interface | yes       | yes   |
| `CommandPaletteInspection`        | interface | yes       | yes   |
| `CommandPaletteItem`              | interface | yes       | yes   |
| `CommandPaletteMatch`             | interface | yes       | yes   |
| `CommandPaletteOptions`           | interface | yes       | yes   |
| `filterCommandPaletteItems`       | function  | no        | yes   |
| `rankCommandPaletteItems`         | function  | no        | yes   |
| `renderCommandPaletteRows`        | function  | no        | yes   |
| `shiftCommandPaletteSelection`    | function  | no        | yes   |

#### src/components/context_menu.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `clampContextMenuSelection`    | function  | no        | yes   |
| `ContextMenu`                  | class     | no        | yes   |
| `ContextMenuController`        | class     | no        | yes   |
| `ContextMenuControllerOptions` | interface | yes       | yes   |
| `ContextMenuInspection`        | interface | yes       | yes   |
| `ContextMenuItem`              | interface | yes       | yes   |
| `ContextMenuOptions`           | interface | yes       | yes   |
| `renderContextMenuRows`        | function  | no        | yes   |
| `shiftContextMenuSelection`    | function  | no        | yes   |
| `visibleContextMenuItems`      | function  | no        | yes   |

#### src/components/data_table.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `canSortColumn`              | function  | no        | yes   |
| `createDataTableView`        | function  | no        | yes   |
| `DataColumn`                 | interface | yes       | yes   |
| `DataSort`                   | interface | yes       | yes   |
| `DataTableController`        | class     | no        | yes   |
| `DataTableControllerOptions` | interface | yes       | yes   |
| `DataTableInspection`        | interface | yes       | yes   |
| `DataTableState`             | interface | yes       | yes   |
| `DataTableView`              | interface | yes       | yes   |
| `filterDataRows`             | function  | no        | yes   |
| `nextSort`                   | function  | no        | yes   |
| `renderDataTableHeader`      | function  | no        | yes   |
| `renderDataTableRows`        | function  | no        | yes   |
| `sortDataRows`               | function  | no        | yes   |
| `SortDirection`              | type      | yes       | yes   |

#### src/components/empty_state.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `EmptyState`        | class     | no        | yes   |
| `EmptyStateContent` | interface | yes       | yes   |
| `EmptyStateOptions` | interface | yes       | yes   |
| `renderEmptyState`  | function  | no        | yes   |

#### src/components/file_explorer.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `createFileExplorerTree`        | function  | no        | yes   |
| `FileExplorerController`        | class     | no        | yes   |
| `FileExplorerControllerOptions` | interface | yes       | yes   |
| `FileExplorerEntry`             | interface | yes       | yes   |
| `FileExplorerInspection`        | interface | yes       | yes   |
| `FileExplorerNode`              | interface | yes       | yes   |
| `FileExplorerNodeKind`          | type      | yes       | yes   |

#### src/components/frame.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `Frame`                      | class     | no        | yes   |
| `FrameOptions`               | interface | yes       | yes   |
| `FrameUnicodeCharacters`     | const     | no        | yes   |
| `FrameUnicodeCharactersType` | type      | yes       | yes   |

#### src/components/gauge.ts

| Symbol         | Kind      | Type Only | JSDoc |
| -------------- | --------- | --------- | ----- |
| `Gauge`        | class     | no        | yes   |
| `GaugeOptions` | interface | yes       | yes   |
| `renderGauge`  | function  | no        | yes   |

#### src/components/input.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `Input`                  | class     | no        | yes   |
| `InputController`        | class     | no        | yes   |
| `InputControllerOptions` | interface | yes       | yes   |
| `InputEditResult`        | type      | yes       | yes   |
| `InputInspection`        | interface | yes       | yes   |
| `InputOptions`           | interface | yes       | yes   |
| `InputRectangle`         | interface | yes       | yes   |
| `InputTheme`             | interface | yes       | yes   |

#### src/components/interaction.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `hitTestWidgetRegions`    | function  | no        | yes   |
| `pointInWidgetRegion`     | function  | no        | yes   |
| `stackedRowHitRegions`    | function  | no        | yes   |
| `stackedRowIndexAt`       | function  | no        | yes   |
| `WidgetHit`               | interface | yes       | yes   |
| `WidgetHitRegion`         | interface | yes       | yes   |
| `WidgetInteractionMethod` | type      | yes       | yes   |

#### src/components/key_help.ts

| Symbol           | Kind      | Type Only | JSDoc |
| ---------------- | --------- | --------- | ----- |
| `KeyHelp`        | class     | no        | yes   |
| `KeyHelpOptions` | interface | yes       | yes   |
| `renderKeyHelp`  | function  | no        | yes   |

#### src/components/label.ts

| Symbol            | Kind      | Type Only | JSDoc |
| ----------------- | --------- | --------- | ----- |
| `Label`           | class     | no        | yes   |
| `LabelAlign`      | interface | yes       | yes   |
| `labelLineLayout` | function  | no        | yes   |
| `LabelLineLayout` | interface | yes       | yes   |
| `LabelOptions`    | interface | yes       | yes   |
| `LabelRectangle`  | type      | yes       | yes   |

#### src/components/list.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `List`                  | class     | no        | yes   |
| `ListController`        | class     | no        | yes   |
| `ListControllerOptions` | interface | yes       | yes   |
| `ListInspection`        | interface | yes       | yes   |
| `ListOptions`           | interface | yes       | yes   |
| `VirtualRow`            | interface | yes       | yes   |
| `virtualRows`           | function  | no        | yes   |
| `visibleListRows`       | function  | no        | yes   |

#### src/components/log_viewer.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `LogViewer`                  | class     | no        | yes   |
| `LogViewerController`        | class     | no        | yes   |
| `LogViewerControllerOptions` | interface | yes       | yes   |
| `LogViewerInspection`        | interface | yes       | yes   |
| `LogViewerOptions`           | interface | yes       | yes   |
| `visibleLogLines`            | function  | no        | yes   |

#### src/components/menu_bar.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `clampMenuIndex`           | function  | no        | yes   |
| `MenuBar`                  | class     | no        | yes   |
| `MenuBarController`        | class     | no        | yes   |
| `MenuBarControllerOptions` | interface | yes       | yes   |
| `MenuBarInspection`        | interface | yes       | yes   |
| `MenuBarItem`              | interface | yes       | yes   |
| `MenuBarOptions`           | interface | yes       | yes   |
| `menuItemForIndex`         | function  | no        | yes   |
| `renderMenuBar`            | function  | no        | yes   |
| `shiftMenuIndex`           | function  | no        | yes   |

#### src/components/metric_series.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `DEFAULT_METRIC_SERIES_LIMIT`   | const     | no        | yes   |
| `MetricClampRange`              | interface | yes       | yes   |
| `MetricSeriesController`        | class     | no        | yes   |
| `MetricSeriesControllerOptions` | interface | yes       | yes   |
| `MetricSeriesInspection`        | interface | yes       | yes   |
| `metricSeriesStats`             | function  | no        | yes   |
| `MetricSeriesStats`             | interface | yes       | yes   |
| `normalizeMetricLimit`          | function  | no        | yes   |
| `normalizeMetricValue`          | function  | no        | yes   |
| `pushMetricValue`               | function  | no        | yes   |

#### src/components/mod.ts

| Re-export Target                    | Kind | Names |
| ----------------------------------- | ---- | ----- |
| `src/components/box.ts`             | star | -     |
| `src/components/breadcrumbs.ts`     | star | -     |
| `src/components/button.ts`          | star | -     |
| `src/components/catalog.ts`         | star | -     |
| `src/components/chart.ts`           | star | -     |
| `src/components/checkbox.ts`        | star | -     |
| `src/components/command_palette.ts` | star | -     |
| `src/components/combobox.ts`        | star | -     |
| `src/components/context_menu.ts`    | star | -     |
| `src/components/data_table.ts`      | star | -     |
| `src/components/empty_state.ts`     | star | -     |
| `src/components/file_explorer.ts`   | star | -     |
| `src/components/frame.ts`           | star | -     |
| `src/components/gauge.ts`           | star | -     |
| `src/components/input.ts`           | star | -     |
| `src/components/interaction.ts`     | star | -     |
| `src/components/label.ts`           | star | -     |
| `src/components/key_help.ts`        | star | -     |
| `src/components/list.ts`            | star | -     |
| `src/components/log_viewer.ts`      | star | -     |
| `src/components/menu_bar.ts`        | star | -     |
| `src/components/metric_series.ts`   | star | -     |
| `src/components/modal.ts`           | star | -     |
| `src/components/pad.ts`             | star | -     |
| `src/components/progressbar.ts`     | star | -     |
| `src/components/radio_group.ts`     | star | -     |
| `src/components/scroll_area.ts`     | star | -     |
| `src/components/slider.ts`          | star | -     |
| `src/components/sparkline.ts`       | star | -     |
| `src/components/spinner.ts`         | star | -     |
| `src/components/statusbar.ts`       | star | -     |
| `src/components/stepper.ts`         | star | -     |
| `src/components/table.ts`           | star | -     |
| `src/components/tabs.ts`            | star | -     |
| `src/components/terminal_output.ts` | star | -     |
| `src/components/text.ts`            | star | -     |
| `src/components/textbox.ts`         | star | -     |
| `src/components/three_ascii.ts`     | star | -     |
| `src/components/toast.ts`           | star | -     |
| `src/components/tree.ts`            | star | -     |
| `src/components/virtual_list.ts`    | star | -     |

_No direct exported symbols._

#### src/components/modal.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `Modal`                  | class     | no        | yes   |
| `ModalAction`            | interface | yes       | yes   |
| `ModalContent`           | interface | yes       | yes   |
| `modalContentHeight`     | function  | no        | yes   |
| `ModalController`        | class     | no        | yes   |
| `ModalControllerOptions` | interface | yes       | yes   |
| `ModalInspection`        | interface | yes       | yes   |
| `ModalOptions`           | interface | yes       | yes   |
| `ModalTone`              | type      | yes       | yes   |
| `renderModalRows`        | function  | no        | yes   |
| `RenderModalRowsOptions` | interface | yes       | yes   |

#### src/components/pad.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `clampPadCursor`       | function  | no        | yes   |
| `measurePadContent`    | function  | no        | yes   |
| `normalizePadLines`    | function  | no        | yes   |
| `PadContent`           | type      | yes       | yes   |
| `PadContentSize`       | interface | yes       | yes   |
| `PadController`        | class     | no        | yes   |
| `PadControllerOptions` | interface | yes       | yes   |
| `PadCursor`            | interface | yes       | yes   |
| `PadInspection`        | interface | yes       | yes   |
| `PadRevealOptions`     | interface | yes       | yes   |
| `PadViewportRow`       | interface | yes       | yes   |
| `renderPadRows`        | function  | no        | yes   |
| `RenderPadRowsOptions` | interface | yes       | yes   |

#### src/components/progressbar.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `clampProgressValue`           | function  | no        | yes   |
| `ProgressBar`                  | class     | no        | yes   |
| `progressBarCharMap`           | const     | no        | yes   |
| `ProgressBarCharMapType`       | type      | yes       | yes   |
| `ProgressBarController`        | class     | no        | yes   |
| `ProgressBarControllerOptions` | interface | yes       | yes   |
| `ProgressBarDirection`         | type      | yes       | yes   |
| `ProgressBarInspection`        | interface | yes       | yes   |
| `ProgressBarOptions`           | interface | yes       | yes   |
| `ProgressBarOrientation`       | type      | yes       | yes   |
| `ProgressBarTheme`             | interface | yes       | yes   |
| `ProgressBarTrackRectangle`    | interface | yes       | yes   |
| `progressRatio`                | function  | no        | yes   |
| `progressRectangle`            | function  | no        | yes   |
| `progressSmoothLine`           | function  | no        | yes   |

#### src/components/radio_group.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `clampRadioIndex`             | function  | no        | yes   |
| `optionForValue`              | function  | no        | yes   |
| `RadioGroup`                  | class     | no        | yes   |
| `RadioGroupController`        | class     | no        | yes   |
| `RadioGroupControllerOptions` | interface | yes       | yes   |
| `RadioGroupInspection`        | interface | yes       | yes   |
| `RadioGroupOptions`           | interface | yes       | yes   |
| `RadioOption`                 | interface | yes       | yes   |
| `renderRadioGroupRows`        | function  | no        | yes   |
| `shiftRadioIndex`             | function  | no        | yes   |
| `visibleRadioOptions`         | function  | no        | yes   |

#### src/components/scroll_area.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `clampScrollOffset`            | function  | no        | yes   |
| `maxScrollOffset`              | function  | no        | yes   |
| `ScrollArea`                   | class     | no        | yes   |
| `ScrollAreaController`         | class     | no        | yes   |
| `ScrollAreaControllerOptions`  | interface | yes       | yes   |
| `ScrollAreaInspection`         | interface | yes       | yes   |
| `ScrollAreaOptions`            | interface | yes       | yes   |
| `ScrollAreaOverflowInspection` | interface | yes       | yes   |
| `scrollbarGlyph`               | function  | no        | yes   |
| `scrollbarOffsetForPointer`    | function  | no        | yes   |
| `scrollbarThumb`               | function  | no        | yes   |
| `ScrollbarThumb`               | type      | yes       | yes   |
| `scrollOffsetBy`               | function  | no        | yes   |

#### src/components/slider.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `clampSliderValue`        | function  | no        | yes   |
| `Slider`                  | class     | no        | yes   |
| `SliderController`        | class     | no        | yes   |
| `SliderControllerOptions` | interface | yes       | yes   |
| `SliderInspection`        | interface | yes       | yes   |
| `SliderOptions`           | interface | yes       | yes   |
| `SliderOrientation`       | type      | yes       | yes   |
| `SliderTheme`             | interface | yes       | yes   |
| `sliderThumbRectangle`    | function  | no        | yes   |
| `SliderThumbRectangle`    | interface | yes       | yes   |
| `SliderTrackRectangle`    | interface | yes       | yes   |
| `sliderValueAt`           | function  | no        | yes   |
| `sliderValueBy`           | function  | no        | yes   |
| `snapSliderValue`         | function  | no        | yes   |

#### src/components/sparkline.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `renderSparkline`  | function  | no        | yes   |
| `Sparkline`        | class     | no        | yes   |
| `SparklineOptions` | interface | yes       | yes   |

#### src/components/spinner.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `DEFAULT_SPINNER_FRAMES` | const     | no        | yes   |
| `renderSpinner`          | function  | no        | yes   |
| `Spinner`                | class     | no        | yes   |
| `spinnerGlyph`           | function  | no        | yes   |
| `SpinnerOptions`         | interface | yes       | yes   |
| `SpinnerStatus`          | type      | yes       | yes   |

#### src/components/statusbar.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `renderStatusBar`  | function  | no        | yes   |
| `StatusBar`        | class     | no        | yes   |
| `StatusBarOptions` | interface | yes       | yes   |

#### src/components/stepper.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `clampStepperIndex`        | function  | no        | yes   |
| `renderStepper`            | function  | no        | yes   |
| `shiftStepperIndex`        | function  | no        | yes   |
| `stepForIndex`             | function  | no        | yes   |
| `Stepper`                  | class     | no        | yes   |
| `StepperController`        | class     | no        | yes   |
| `StepperControllerOptions` | interface | yes       | yes   |
| `StepperInspection`        | interface | yes       | yes   |
| `StepperOptions`           | interface | yes       | yes   |
| `StepperOrientation`       | type      | yes       | yes   |
| `StepperStep`              | interface | yes       | yes   |

#### src/components/table.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `clampTableRow`              | function  | no        | yes   |
| `Table`                      | class     | no        | yes   |
| `TableController`            | class     | no        | yes   |
| `TableControllerOptions`     | interface | yes       | yes   |
| `TableHeader`                | type      | yes       | yes   |
| `TableInspection`            | interface | yes       | yes   |
| `tableMaxOffset`             | function  | no        | yes   |
| `TableOptions`               | interface | yes       | yes   |
| `TableTheme`                 | interface | yes       | yes   |
| `TableUnicodeCharacters`     | const     | no        | yes   |
| `TableUnicodeCharactersType` | type      | yes       | yes   |
| `tableVisibleCapacity`       | function  | no        | yes   |

#### src/components/tabs.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `clampTabIndex`         | function  | no        | yes   |
| `renderTabs`            | function  | no        | yes   |
| `shiftTabIndex`         | function  | no        | yes   |
| `tabForIndex`           | function  | no        | yes   |
| `TabItem`               | interface | yes       | yes   |
| `Tabs`                  | class     | no        | yes   |
| `TabsController`        | class     | no        | yes   |
| `TabsControllerOptions` | interface | yes       | yes   |
| `TabsInspection`        | interface | yes       | yes   |
| `TabsOptions`           | interface | yes       | yes   |

#### src/components/terminal_output.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `formatTerminalOutputLine`        | function  | no        | yes   |
| `TerminalOutputController`        | class     | no        | yes   |
| `TerminalOutputControllerOptions` | interface | yes       | yes   |
| `TerminalOutputInspection`        | interface | yes       | yes   |
| `TerminalOutputLine`              | interface | yes       | yes   |
| `TerminalOutputSource`            | type      | yes       | yes   |
| `visibleTerminalOutputLines`      | function  | no        | yes   |

#### src/components/text.ts

| Symbol        | Kind      | Type Only | JSDoc |
| ------------- | --------- | --------- | ----- |
| `Text`        | class     | no        | yes   |
| `TextOptions` | interface | yes       | yes   |

#### src/components/textbox.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `CursorPosition`           | interface | yes       | yes   |
| `TextBox`                  | class     | no        | yes   |
| `TextBoxController`        | class     | no        | yes   |
| `TextBoxControllerOptions` | interface | yes       | yes   |
| `TextBoxEditResult`        | type      | yes       | yes   |
| `TextBoxInspection`        | interface | yes       | yes   |
| `TextBoxOptions`           | interface | yes       | yes   |
| `TextBoxTheme`             | interface | yes       | yes   |
| `textBoxVisualCursor`      | function  | no        | yes   |
| `TextBoxVisualCursor`      | interface | yes       | yes   |
| `TextBoxVisualLine`        | interface | yes       | yes   |
| `TextLineCache`            | class     | no        | yes   |
| `TextLineCacheInspection`  | interface | yes       | yes   |
| `wrapTextBoxLines`         | function  | no        | yes   |

#### src/components/three_ascii.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `ThreeAscii`        | class     | no        | yes   |
| `ThreeAsciiOptions` | interface | yes       | yes   |

#### src/components/toast.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `renderToast`                 | function  | no        | yes   |
| `ToastLevel`                  | type      | yes       | yes   |
| `ToastMessage`                | interface | yes       | yes   |
| `ToastStack`                  | class     | no        | yes   |
| `ToastStackController`        | class     | no        | yes   |
| `ToastStackControllerOptions` | interface | yes       | yes   |
| `ToastStackInspection`        | interface | yes       | yes   |
| `ToastStackOptions`           | interface | yes       | yes   |

#### src/components/tree.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `flattenTree`           | function  | no        | yes   |
| `flattenTreeRows`       | function  | no        | yes   |
| `inspectTreeRow`        | function  | no        | yes   |
| `Tree`                  | class     | no        | yes   |
| `TreeController`        | class     | no        | yes   |
| `TreeControllerOptions` | interface | yes       | yes   |
| `TreeInspection`        | interface | yes       | yes   |
| `TreeNode`              | interface | yes       | yes   |
| `TreeOptions`           | interface | yes       | yes   |
| `TreeRow`               | interface | yes       | yes   |
| `TreeRowInspection`     | interface | yes       | yes   |

#### src/components/virtual_list.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `renderVirtualListRows`        | function  | no        | yes   |
| `VirtualList`                  | class     | no        | yes   |
| `VirtualListController`        | class     | no        | yes   |
| `VirtualListControllerOptions` | interface | yes       | yes   |
| `VirtualListInspection`        | interface | yes       | yes   |
| `VirtualListOptions`           | interface | yes       | yes   |
| `VirtualListRow`               | interface | yes       | yes   |
| `virtualListRows`              | function  | no        | yes   |

#### src/event_emitter.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `EmitterEvent`           | type      | yes       | yes   |
| `EventEmitter`           | class     | no        | yes   |
| `EventEmitterInspection` | interface | yes       | yes   |
| `EventListener`          | type      | yes       | yes   |
| `EventRecord`            | type      | yes       | yes   |

#### src/focus.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindFocusNavigation`    | function  | no        | yes   |
| `Focusable`              | interface | yes       | yes   |
| `FocusManager`           | class     | no        | yes   |
| `FocusManagerInspection` | interface | yes       | yes   |
| `FocusNavigationOptions` | interface | yes       | yes   |
| `FocusNavigationTarget`  | interface | yes       | yes   |
| `FocusScope`             | class     | no        | yes   |

#### src/grwizard_themes.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `grWizardThemeOptions`           | function  | no        | yes   |
| `grWizardThemePacks`             | const     | no        | yes   |
| `GrWizardThemePalette`           | interface | yes       | yes   |
| `grWizardThemePaletteDefinition` | function  | no        | yes   |
| `grWizardThemePalettes`          | const     | no        | yes   |

#### src/layout/engine.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createLayoutEngine`           | function  | no        | yes   |
| `LayoutEngine`                 | class     | no        | yes   |
| `LayoutEngineOptions`          | interface | yes       | yes   |
| `LayoutRunOptions`             | interface | yes       | yes   |
| `LayoutSolverUnsupportedError` | class     | no        | yes   |
| `layoutTree`                   | function  | no        | yes   |

#### src/layout/errors.ts

| Symbol                              | Kind  | Type Only | JSDoc |
| ----------------------------------- | ----- | --------- | ----- |
| `LayoutInvalidElementsPatternError` | class | no        | yes   |
| `LayoutMissingElementError`         | class | no        | yes   |

#### src/layout/flex_layout.ts

| Symbol          | Kind      | Type Only | JSDoc |
| --------------- | --------- | --------- | ----- |
| `FlexDirection` | type      | yes       | yes   |
| `FlexItem`      | interface | yes       | yes   |
| `flexRects`     | function  | no        | yes   |

#### src/layout/grid_layout.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `GridLayout`        | class     | no        | yes   |
| `GridLayoutElement` | interface | yes       | yes   |
| `GridLayoutOptions` | interface | yes       | yes   |

#### src/layout/horizontal_layout.ts

| Symbol             | Kind  | Type Only | JSDoc |
| ------------------ | ----- | --------- | ----- |
| `HorizontalLayout` | class | no        | yes   |

#### src/layout/measurement.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `LayoutMeasurementCache`        | class     | no        | yes   |
| `LayoutMeasurementCacheEntry`   | interface | yes       | yes   |
| `LayoutMeasurementCacheOptions` | interface | yes       | yes   |
| `LayoutMeasurementCacheStats`   | interface | yes       | yes   |

#### src/layout/mod.ts

| Re-export Target                  | Kind | Names |
| --------------------------------- | ---- | ----- |
| `src/layout/errors.ts`            | star | -     |
| `src/layout/horizontal_layout.ts` | star | -     |
| `src/layout/types.ts`             | star | -     |
| `src/layout/vertical_layout.ts`   | star | -     |
| `src/layout/grid_layout.ts`       | star | -     |
| `src/layout/flex_layout.ts`       | star | -     |
| `src/layout/responsive.ts`        | star | -     |
| `src/layout/split_pane.ts`        | star | -     |
| `src/layout/recipe.ts`            | star | -     |
| `src/layout/window_manager.ts`    | star | -     |
| `src/layout/overlay.ts`           | star | -     |
| `src/layout/style.ts`             | star | -     |
| `src/layout/solver.ts`            | star | -     |
| `src/layout/engine.ts`            | star | -     |
| `src/layout/measurement.ts`       | star | -     |
| `src/layout/solvers/simple.ts`    | star | -     |

_No direct exported symbols._

#### src/layout/overlay.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `clampRectToBounds`        | function  | no        | yes   |
| `hitTestOverlaySurfaces`   | function  | no        | yes   |
| `OverlayHit`               | interface | yes       | yes   |
| `OverlayKind`              | type      | yes       | yes   |
| `OverlayLayer`             | type      | yes       | yes   |
| `overlayLayerZIndex`       | function  | no        | yes   |
| `OverlayPoint`             | interface | yes       | yes   |
| `OverlayPointerResult`     | interface | yes       | yes   |
| `OverlaySize`              | interface | yes       | yes   |
| `OverlayStackController`   | class     | no        | yes   |
| `OverlayStackInspection`   | interface | yes       | yes   |
| `OverlayStackOptions`      | interface | yes       | yes   |
| `OverlaySurface`           | interface | yes       | yes   |
| `OverlaySurfaceInspection` | interface | yes       | yes   |
| `placePopover`             | function  | no        | yes   |
| `pointInRect`              | function  | no        | yes   |
| `PopoverPlacement`         | type      | yes       | yes   |
| `PopoverPlacementOptions`  | interface | yes       | yes   |
| `sortOverlaySurfaces`      | function  | no        | yes   |

#### src/layout/recipe.ts

| Symbol                             | Kind      | Type Only | JSDoc |
| ---------------------------------- | --------- | --------- | ----- |
| `createLayoutRecipeController`     | function  | no        | yes   |
| `formatLayoutRecipeMarkdown`       | function  | no        | yes   |
| `inspectLayoutRecipe`              | function  | no        | yes   |
| `LayoutRecipeBreakpointInspection` | interface | yes       | yes   |
| `LayoutRecipeController`           | class     | no        | yes   |
| `LayoutRecipeControllerInspection` | interface | yes       | yes   |
| `LayoutRecipeInspection`           | interface | yes       | yes   |
| `LayoutRecipeMarkdownOptions`      | interface | yes       | yes   |
| `layoutRecipeSlots`                | function  | no        | yes   |
| `LayoutRegion`                     | type      | yes       | yes   |
| `LayoutRegionDirection`            | type      | yes       | yes   |
| `LayoutRegionDock`                 | interface | yes       | yes   |
| `LayoutRegionEdge`                 | type      | yes       | yes   |
| `LayoutRegionLeaf`                 | interface | yes       | yes   |
| `LayoutRegionSplit`                | interface | yes       | yes   |
| `ResolvedLayoutRecipe`             | interface | yes       | yes   |
| `resolveLayoutRecipe`              | function  | no        | yes   |
| `ResponsiveLayoutRecipe`           | interface | yes       | yes   |

#### src/layout/responsive.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `adaptiveGrid`         | function  | no        | yes   |
| `AdaptiveGrid`         | interface | yes       | yes   |
| `adaptiveGridItemRect` | function  | no        | yes   |
| `AdaptiveGridOptions`  | interface | yes       | yes   |
| `adaptiveGridPage`     | function  | no        | yes   |
| `AdaptiveGridPage`     | interface | yes       | yes   |
| `Breakpoint`           | interface | yes       | yes   |
| `dockRect`             | function  | no        | yes   |
| `insetRect`            | function  | no        | yes   |
| `resolveBreakpoint`    | function  | no        | yes   |
| `splitRect`            | function  | no        | yes   |
| `TileLayout`           | interface | yes       | yes   |
| `TileLayoutOptions`    | interface | yes       | yes   |
| `tileRects`            | function  | no        | yes   |

#### src/layout/solver.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `cloneLayoutNode`            | function  | no        | yes   |
| `ComputedLayoutBox`          | interface | yes       | yes   |
| `computedLayoutBoxOverflow`  | function  | no        | yes   |
| `createLayoutNode`           | function  | no        | yes   |
| `flattenComputedLayoutBoxes` | function  | no        | yes   |
| `LayoutIntrinsicSize`        | interface | yes       | yes   |
| `LayoutNode`                 | interface | yes       | yes   |
| `LayoutNodeOptions`          | interface | yes       | yes   |
| `LayoutSolver`               | interface | yes       | yes   |
| `LayoutSolverInput`          | interface | yes       | yes   |
| `LayoutSolverResult`         | interface | yes       | yes   |
| `mapLayoutBoxes`             | function  | no        | yes   |
| `walkLayoutNodes`            | function  | no        | yes   |

#### src/layout/solvers/simple.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `simpleLayoutSolver`        | function  | no        | yes   |
| `SimpleLayoutSolver`        | class     | no        | yes   |
| `SimpleLayoutSolverOptions` | interface | yes       | yes   |

#### src/layout/split_pane.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `createSplitPaneController`  | function  | no        | yes   |
| `resizeSplitPane`            | function  | no        | yes   |
| `resizeSplitPaneRatio`       | function  | no        | yes   |
| `SplitPaneController`        | class     | no        | yes   |
| `SplitPaneControllerOptions` | interface | yes       | yes   |
| `SplitPaneDirection`         | type      | yes       | yes   |
| `SplitPaneOptions`           | interface | yes       | yes   |
| `splitPaneRects`             | function  | no        | yes   |
| `SplitPaneRects`             | interface | yes       | yes   |
| `SplitPaneResizeMode`        | type      | yes       | yes   |

#### src/layout/style.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `applyLayoutDeclaration`     | function  | no        | yes   |
| `applyLayoutDeclarations`    | function  | no        | yes   |
| `AUTO_LAYOUT_LENGTH`         | const     | no        | yes   |
| `autoLength`                 | function  | no        | yes   |
| `BoxEdges`                   | interface | yes       | yes   |
| `cellLength`                 | function  | no        | yes   |
| `clampLayoutSize`            | function  | no        | yes   |
| `cloneComputedLayoutStyle`   | function  | no        | yes   |
| `ComputedLayoutStyle`        | interface | yes       | yes   |
| `defaultComputedLayoutStyle` | function  | no        | yes   |
| `frLength`                   | function  | no        | yes   |
| `LayoutAlignItems`           | type      | yes       | yes   |
| `LayoutDisplay`              | type      | yes       | yes   |
| `LayoutFlexDirection`        | type      | yes       | yes   |
| `LayoutFlexWrap`             | type      | yes       | yes   |
| `LayoutGridAutoFlow`         | type      | yes       | yes   |
| `LayoutGridPlacement`        | interface | yes       | yes   |
| `LayoutJustifyContent`       | type      | yes       | yes   |
| `LayoutLengthValue`          | interface | yes       | yes   |
| `LayoutOverflow`             | type      | yes       | yes   |
| `LayoutPosition`             | type      | yes       | yes   |
| `LayoutSelfAlignment`        | type      | yes       | yes   |
| `LayoutVisibility`           | type      | yes       | yes   |
| `parseBoxEdges`              | function  | no        | yes   |
| `parseGridPlacement`         | function  | no        | yes   |
| `parseGridTrackList`         | function  | no        | yes   |
| `parseLayoutInteger`         | function  | no        | yes   |
| `parseLayoutLength`          | function  | no        | yes   |
| `percentLength`              | function  | no        | yes   |
| `resolveLayoutLength`        | function  | no        | yes   |
| `ZERO_BOX_EDGES`             | const     | no        | yes   |

#### src/layout/types.ts

| Symbol          | Kind      | Type Only | JSDoc |
| --------------- | --------- | --------- | ----- |
| `Layout`        | interface | yes       | yes   |
| `LayoutElement` | interface | yes       | yes   |
| `LayoutOptions` | interface | yes       | yes   |

#### src/layout/vertical_layout.ts

| Symbol           | Kind  | Type Only | JSDoc |
| ---------------- | ----- | --------- | ----- |
| `VerticalLayout` | class | no        | yes   |

#### src/layout/window_manager.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `WINDOW_MANAGER_LAYER_Z_INDEX`  | const     | no        | yes   |
| `WindowManagerController`       | class     | no        | yes   |
| `WindowManagerLayer`            | type      | yes       | yes   |
| `WindowManagerLayoutInspection` | interface | yes       | yes   |
| `WindowManagerLayoutOptions`    | interface | yes       | yes   |
| `WindowManagerOptions`          | interface | yes       | yes   |
| `WindowManagerWindow`           | interface | yes       | yes   |
| `WindowManagerWindowInspection` | interface | yes       | yes   |
| `WindowManagerWindowState`      | type      | yes       | yes   |
| `windowManagerZOrder`           | function  | no        | yes   |

#### src/markup/cascade.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `applyCssCascade`        | function  | no        | yes   |
| `ApplyCssCascadeOptions` | interface | yes       | yes   |
| `matchesCssMedia`        | function  | no        | yes   |
| `matchesCssSelector`     | function  | no        | yes   |
| `resolveCssVariables`    | function  | no        | yes   |
| `TuiCssNodeState`        | type      | yes       | yes   |
| `TuiCssViewport`         | interface | yes       | yes   |

#### src/markup/css.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `cssSelectorSpecificity` | function  | no        | yes   |
| `parseCssDeclarations`   | function  | no        | yes   |
| `parseCssMediaQuery`     | function  | no        | yes   |
| `parseCssStylesheet`     | function  | no        | yes   |
| `selectorParts`          | function  | no        | yes   |
| `TuiCssDeclaration`      | interface | yes       | yes   |
| `TuiCssMediaCondition`   | interface | yes       | yes   |
| `TuiCssMediaFeature`     | type      | yes       | yes   |
| `TuiCssMediaQuery`       | interface | yes       | yes   |
| `TuiCssRule`             | interface | yes       | yes   |
| `TuiCssStylesheet`       | interface | yes       | yes   |

#### src/markup/demo_fixtures.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `createHtmlCssLayoutDemo`   | function  | no        | yes   |
| `HTML_CSS_LAYOUT_OPTION_ID` | const     | no        | yes   |
| `HTML_CSS_LAYOUT_WINDOW_ID` | const     | no        | yes   |
| `htmlCssLayoutDemoBoxLabel` | function  | no        | yes   |
| `htmlCssLayoutDemoCss`      | const     | no        | yes   |
| `htmlCssLayoutDemoMarkup`   | const     | no        | yes   |
| `HtmlCssLayoutDemoOptions`  | interface | yes       | yes   |

#### src/markup/html.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `parseTuiMarkup`        | function  | no        | yes   |
| `TuiMarkupDocument`     | interface | yes       | yes   |
| `TuiMarkupParseOptions` | interface | yes       | yes   |

#### src/markup/hydrate.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `createMarkupLayout`  | function  | no        | yes   |
| `MarkupLayoutOptions` | interface | yes       | yes   |
| `MarkupLayoutResult`  | interface | yes       | yes   |

#### src/markup/mod.ts

| Re-export Target              | Kind | Names |
| ----------------------------- | ---- | ----- |
| `src/markup/cascade.ts`       | star | -     |
| `src/markup/css.ts`           | star | -     |
| `src/markup/demo_fixtures.ts` | star | -     |
| `src/markup/html.ts`          | star | -     |
| `src/markup/hydrate.ts`       | star | -     |
| `src/markup/widgets.ts`       | star | -     |

_No direct exported symbols._

#### src/markup/widgets.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createDefaultMarkupWidgetRegistry` | function  | no        | yes   |
| `dispatchMarkupWidgetEvent`         | function  | no        | yes   |
| `HydratedMarkupWidget`              | interface | yes       | yes   |
| `HydratedMarkupWidgetInspection`    | interface | yes       | yes   |
| `hydrateMarkupWidgets`              | function  | no        | yes   |
| `MarkupWidgetController`            | type      | yes       | yes   |
| `MarkupWidgetDescriptor`            | interface | yes       | yes   |
| `MarkupWidgetEvent`                 | type      | yes       | yes   |
| `MarkupWidgetFactory`               | type      | yes       | yes   |
| `MarkupWidgetFactoryContext`        | interface | yes       | yes   |
| `MarkupWidgetHydration`             | class     | no        | yes   |
| `MarkupWidgetHydrationInspection`   | interface | yes       | yes   |
| `MarkupWidgetHydrationOptions`      | interface | yes       | yes   |
| `MarkupWidgetHydrationRegistry`     | class     | no        | yes   |
| `MarkupWidgetKind`                  | type      | yes       | yes   |

#### src/perf/benchmark.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `BenchmarkCase`                   | interface | yes       | yes   |
| `BenchmarkCaseInspection`         | interface | yes       | yes   |
| `BenchmarkCatalogInspection`      | interface | yes       | yes   |
| `BenchmarkCatalogMarkdownOptions` | interface | yes       | yes   |
| `BenchmarkCatalogQuery`           | interface | yes       | yes   |
| `BenchmarkCatalogReport`          | interface | yes       | yes   |
| `BenchmarkCatalogReportOptions`   | interface | yes       | yes   |
| `BenchmarkResult`                 | interface | yes       | yes   |
| `BenchmarkRunner`                 | class     | no        | yes   |
| `BenchmarkRunnerOptions`          | interface | yes       | yes   |
| `BenchmarkSummary`                | interface | yes       | yes   |
| `createBenchmarkCatalogReport`    | function  | no        | yes   |
| `formatBenchmarkCatalogMarkdown`  | function  | no        | yes   |
| `formatBenchmarkResults`          | function  | no        | yes   |
| `formatBenchmarkSummary`          | function  | no        | yes   |
| `inspectBenchmarkCase`            | function  | no        | yes   |
| `inspectBenchmarkCatalog`         | function  | no        | yes   |
| `queryBenchmarkCases`             | function  | no        | yes   |
| `summarizeBenchmarkResults`       | function  | no        | yes   |

#### src/perf/mod.ts

| Re-export Target        | Kind | Names |
| ----------------------- | ---- | ----- |
| `src/perf/benchmark.ts` | star | -     |

_No direct exported symbols._

#### src/platform/mod.ts

| Re-export Target        | Kind | Names |
| ----------------------- | ---- | ----- |
| `src/platform/types.ts` | star | -     |

_No direct exported symbols._

#### src/platform/types.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `Disposable`              | interface | yes       | yes   |
| `InputSource`             | interface | yes       | yes   |
| `InputSourceInspection`   | interface | yes       | yes   |
| `LifecycleController`     | interface | yes       | yes   |
| `LifecycleInspection`     | interface | yes       | yes   |
| `NoopInputSource`         | class     | no        | yes   |
| `NoopLifecycleController` | class     | no        | yes   |
| `PlatformInputEmitter`    | type      | yes       | yes   |
| `PlatformInputEvents`     | interface | yes       | yes   |
| `TuiPlatform`             | interface | yes       | yes   |

#### src/runtime/capabilities.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createRuntimePlan`            | function  | no        | yes   |
| `detectRuntimeCapabilities`    | function  | no        | yes   |
| `formatRuntimeCapabilities`    | function  | no        | yes   |
| `formatRuntimePlan`            | function  | no        | yes   |
| `RuntimeCapabilities`          | interface | yes       | yes   |
| `runtimeCapabilityEntries`     | function  | no        | yes   |
| `RuntimeCapabilityEntry`       | interface | yes       | yes   |
| `RuntimeCapabilityId`          | type      | yes       | yes   |
| `RuntimeCapabilitySummary`     | interface | yes       | yes   |
| `RuntimePlan`                  | interface | yes       | yes   |
| `RuntimePlanDecision`          | interface | yes       | yes   |
| `RuntimePlanOptions`           | interface | yes       | yes   |
| `RuntimeRendererStrategy`      | type      | yes       | yes   |
| `RuntimeStorageStrategy`       | type      | yes       | yes   |
| `RuntimeWorkerStrategy`        | type      | yes       | yes   |
| `summarizeRuntimeCapabilities` | function  | no        | yes   |

#### src/runtime/data_pipeline_bindings.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `bindDataPipeline`              | function  | no        | yes   |
| `DataPipelineBinding`           | interface | yes       | yes   |
| `DataPipelineBindingInspection` | interface | yes       | yes   |
| `DataPipelineBindingOptions`    | interface | yes       | yes   |

#### src/runtime/data_pipeline.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `CachedDataPipeline`           | class     | no        | yes   |
| `CachedDataPipelineInspection` | interface | yes       | yes   |
| `CachedDataPipelineOptions`    | interface | yes       | yes   |
| `createCachedDataPipeline`     | function  | no        | yes   |
| `DataPipelineAbortError`       | class     | no        | yes   |
| `DataPipelineCacheKey`         | type      | yes       | yes   |
| `DataPipelineContext`          | interface | yes       | yes   |
| `DataPipelineOptions`          | interface | yes       | yes   |
| `DataTransform`                | type      | yes       | yes   |
| `filterRows`                   | function  | no        | yes   |
| `LatestDataPipeline`           | class     | no        | yes   |
| `LatestPipelineResult`         | interface | yes       | yes   |
| `mapRows`                      | function  | no        | yes   |
| `runDataPipeline`              | function  | no        | yes   |
| `sliceRows`                    | function  | no        | yes   |
| `sortRows`                     | function  | no        | yes   |
| `WorkerPayloadMapper`          | type      | yes       | yes   |
| `WorkerTaskRunner`             | interface | yes       | yes   |
| `workerTransform`              | function  | no        | yes   |

#### src/runtime/data_query.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `createDataQueryController`  | function  | no        | yes   |
| `DataQueryController`        | class     | no        | yes   |
| `DataQueryControllerOptions` | interface | yes       | yes   |
| `DataQueryFilters`           | type      | yes       | yes   |
| `DataQueryInspection`        | interface | yes       | yes   |
| `DataQueryParams`            | interface | yes       | yes   |
| `DataQueryResult`            | interface | yes       | yes   |
| `DataQuerySort`              | interface | yes       | yes   |
| `DataQuerySortDirection`     | type      | yes       | yes   |
| `LocalDataQueryOptions`      | interface | yes       | yes   |
| `nextDataQuerySort`          | function  | no        | yes   |
| `normalizeDataQueryParams`   | function  | no        | yes   |
| `NormalizedDataQueryParams`  | interface | yes       | yes   |
| `pageDataQueryRows`          | function  | no        | yes   |
| `queryLocalData`             | function  | no        | yes   |

#### src/runtime/graphics_surface.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `createKittyGraphicsSurface`  | function  | no        | yes   |
| `createNoopGraphicsSurface`   | function  | no        | yes   |
| `GraphicsClearScope`          | type      | yes       | yes   |
| `GraphicsDeleteMode`          | type      | yes       | yes   |
| `GraphicsHandle`              | interface | yes       | yes   |
| `GraphicsImage`               | interface | yes       | yes   |
| `GraphicsImageEncoding`       | type      | yes       | yes   |
| `GraphicsPlacement`           | interface | yes       | yes   |
| `GraphicsSurface`             | interface | yes       | yes   |
| `GraphicsSurfaceInspection`   | interface | yes       | yes   |
| `GraphicsSurfaceKind`         | type      | yes       | yes   |
| `GraphicsSurfaceWriter`       | interface | yes       | yes   |
| `KittyGraphicsSurface`        | class     | no        | yes   |
| `KittyGraphicsSurfaceOptions` | interface | yes       | yes   |
| `NoopGraphicsSurface`         | class     | no        | yes   |

#### src/runtime/kitty_graphics.ts

| Symbol                                | Kind      | Type Only | JSDoc |
| ------------------------------------- | --------- | --------- | ----- |
| `chunkKittyGraphicsCommand`           | function  | no        | yes   |
| `createKittyGraphicsDeleteCommand`    | function  | no        | yes   |
| `createKittyGraphicsTransmitCommands` | function  | no        | yes   |
| `detectKittyGraphicsCapability`       | function  | no        | yes   |
| `encodeKittyGraphicsCommand`          | function  | no        | yes   |
| `encodeKittyGraphicsControl`          | function  | no        | yes   |
| `encodeKittyGraphicsPayload`          | function  | no        | yes   |
| `inspectKittyGraphicsCommand`         | function  | no        | yes   |
| `KITTY_GRAPHICS_END`                  | const     | no        | yes   |
| `KITTY_GRAPHICS_START`                | const     | no        | yes   |
| `KittyGraphicsAction`                 | type      | yes       | yes   |
| `KittyGraphicsCapability`             | interface | yes       | yes   |
| `KittyGraphicsChunkOptions`           | interface | yes       | yes   |
| `KittyGraphicsCommandInspection`      | interface | yes       | yes   |
| `KittyGraphicsCommandOptions`         | interface | yes       | yes   |
| `KittyGraphicsControl`                | type      | yes       | yes   |
| `KittyGraphicsControlValue`           | type      | yes       | yes   |
| `KittyGraphicsDeleteOptions`          | interface | yes       | yes   |
| `KittyGraphicsDetectionOptions`       | interface | yes       | yes   |
| `KittyGraphicsFormat`                 | type      | yes       | yes   |
| `KittyGraphicsMode`                   | type      | yes       | yes   |
| `KittyGraphicsQuietMode`              | type      | yes       | yes   |
| `KittyGraphicsTransmissionMedium`     | type      | yes       | yes   |
| `KittyGraphicsTransmitOptions`        | interface | yes       | yes   |
| `wrapKittyGraphicsForTmux`            | function  | no        | yes   |

#### src/runtime/profiles.ts

| Symbol                                 | Kind      | Type Only | JSDoc |
| -------------------------------------- | --------- | --------- | ----- |
| `createRuntimeProfile`                 | function  | no        | yes   |
| `createRuntimeProfileCatalogReport`    | function  | no        | yes   |
| `createRuntimeProfileController`       | function  | no        | yes   |
| `createRuntimeProfileRegistry`         | function  | no        | yes   |
| `findRuntimeProfile`                   | function  | no        | yes   |
| `formatRuntimeProfileCatalogMarkdown`  | function  | no        | yes   |
| `inspectRuntimeProfileCatalog`         | function  | no        | yes   |
| `queryRuntimeProfiles`                 | function  | no        | yes   |
| `RuntimeProfile`                       | class     | no        | yes   |
| `RuntimeProfileCatalogInspection`      | interface | yes       | yes   |
| `RuntimeProfileCatalogMarkdownOptions` | interface | yes       | yes   |
| `RuntimeProfileCatalogQuery`           | interface | yes       | yes   |
| `RuntimeProfileCatalogReport`          | interface | yes       | yes   |
| `RuntimeProfileCatalogReportOptions`   | interface | yes       | yes   |
| `RuntimeProfileController`             | class     | no        | yes   |
| `RuntimeProfileControllerInspection`   | interface | yes       | yes   |
| `RuntimeProfileControllerOptions`      | interface | yes       | yes   |
| `RuntimeProfileDefinition`             | interface | yes       | yes   |
| `runtimeProfileDefinitions`            | const     | no        | yes   |
| `RuntimeProfileInspection`             | interface | yes       | yes   |
| `RuntimeProfileNotFoundError`          | class     | no        | yes   |
| `RuntimeProfilePlanInspection`         | interface | yes       | yes   |
| `RuntimeProfileRegistry`               | class     | no        | yes   |
| `runtimeProfiles`                      | function  | no        | yes   |

#### src/runtime/render_loop.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createRenderLoop`             | function  | no        | yes   |
| `defaultRenderLoopTimer`       | const     | no        | yes   |
| `MicrotaskScheduler`           | class     | no        | yes   |
| `MicrotaskSchedulerInspection` | interface | yes       | yes   |
| `MicrotaskSchedulerOptions`    | interface | yes       | yes   |
| `RenderLoop`                   | class     | no        | yes   |
| `RenderLoopFrame`              | interface | yes       | yes   |
| `RenderLoopInspection`         | interface | yes       | yes   |
| `RenderLoopOptions`            | interface | yes       | yes   |
| `RenderLoopTimer`              | interface | yes       | yes   |

#### src/runtime/renderer_backends.ts

| Symbol                                        | Kind      | Type Only | JSDoc |
| --------------------------------------------- | --------- | --------- | ----- |
| `createRuntimeRendererBackend`                | function  | no        | yes   |
| `createRuntimeRendererBackendCatalogReport`   | function  | no        | yes   |
| `createRuntimeRendererBackendController`      | function  | no        | yes   |
| `createRuntimeRendererBackendRegistry`        | function  | no        | yes   |
| `formatRuntimeRendererBackendCatalogMarkdown` | function  | no        | yes   |
| `inspectRuntimeRendererBackendCatalog`        | function  | no        | yes   |
| `inspectRuntimeRendererBackends`              | function  | no        | yes   |
| `queryRuntimeRendererBackends`                | function  | no        | yes   |
| `RuntimeRendererBackend`                      | class     | no        | yes   |
| `RuntimeRendererBackendCatalogInspection`     | interface | yes       | yes   |
| `RuntimeRendererBackendCatalogOptions`        | interface | yes       | yes   |
| `RuntimeRendererBackendCatalogReport`         | interface | yes       | yes   |
| `RuntimeRendererBackendController`            | class     | no        | yes   |
| `RuntimeRendererBackendControllerInspection`  | interface | yes       | yes   |
| `RuntimeRendererBackendControllerOptions`     | interface | yes       | yes   |
| `RuntimeRendererBackendDefinition`            | interface | yes       | yes   |
| `runtimeRendererBackendDefinitions`           | const     | no        | yes   |
| `RuntimeRendererBackendInspection`            | interface | yes       | yes   |
| `RuntimeRendererBackendMarkdownOptions`       | interface | yes       | yes   |
| `RuntimeRendererBackendQuery`                 | interface | yes       | yes   |
| `RuntimeRendererBackendRegistry`              | class     | no        | yes   |
| `runtimeRendererBackends`                     | function  | no        | yes   |
| `RuntimeRendererBackendSelectionOptions`      | interface | yes       | yes   |
| `selectRuntimeRendererBackend`                | function  | no        | yes   |

#### src/runtime/resource_bindings.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindResourceParams`              | function  | no        | yes   |
| `ResourceParamsBindingHandle`     | type      | yes       | yes   |
| `ResourceParamsBindingInspection` | interface | yes       | yes   |
| `ResourceParamsBindingOptions`    | interface | yes       | yes   |

#### src/runtime/resource.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `AsyncResource`                 | class     | no        | yes   |
| `AsyncResourceCacheKey`         | type      | yes       | yes   |
| `AsyncResourceContext`          | interface | yes       | yes   |
| `AsyncResourceInspection`       | interface | yes       | yes   |
| `AsyncResourceLoader`           | type      | yes       | yes   |
| `AsyncResourceOptions`          | interface | yes       | yes   |
| `AsyncResourceParamsError`      | class     | no        | yes   |
| `AsyncResourceState`            | interface | yes       | yes   |
| `AsyncResourceStatus`           | type      | yes       | yes   |
| `CachedAsyncResource`           | class     | no        | yes   |
| `CachedAsyncResourceInspection` | interface | yes       | yes   |
| `CachedAsyncResourceOptions`    | interface | yes       | yes   |
| `createAsyncResource`           | function  | no        | yes   |
| `createCachedAsyncResource`     | function  | no        | yes   |

#### src/runtime/scheduler.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `AsyncScheduler`           | class     | no        | yes   |
| `AsyncSchedulerInspection` | interface | yes       | yes   |
| `nextFrame`                | function  | no        | yes   |
| `runTaskBatch`             | function  | no        | yes   |
| `ScheduledTask`            | type      | yes       | yes   |
| `ScheduledTaskHandle`      | interface | yes       | yes   |
| `ScheduledTaskInspection`  | interface | yes       | yes   |
| `ScheduledTaskOptions`     | interface | yes       | yes   |
| `ScheduledTaskStatus`      | type      | yes       | yes   |
| `SchedulerOptions`         | interface | yes       | yes   |
| `TaskBatchItem`            | interface | yes       | yes   |
| `TaskBatchOptions`         | interface | yes       | yes   |
| `TaskBatchResult`          | interface | yes       | yes   |

#### src/runtime/storage.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `AsyncStore`              | interface | yes       | yes   |
| `createPersistentSignal`  | function  | no        | yes   |
| `createRuntimeStore`      | function  | no        | yes   |
| `IndexedDbStore`          | class     | no        | yes   |
| `IndexedDbStoreOptions`   | interface | yes       | yes   |
| `MemoryStore`             | class     | no        | yes   |
| `PersistentSignal`        | class     | no        | yes   |
| `PersistentSignalOptions` | interface | yes       | yes   |
| `RuntimeStoreOptions`     | interface | yes       | yes   |

#### src/runtime/telemetry.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createRuntimeWorkloadRegistry`     | function  | no        | yes   |
| `createRuntimeWorkloadReport`       | function  | no        | yes   |
| `formatRuntimeWorkloadMarkdown`     | function  | no        | yes   |
| `inspectRuntimeWorkload`            | function  | no        | yes   |
| `inspectRuntimeWorkloadReport`      | function  | no        | yes   |
| `RuntimeWorkloadInspection`         | interface | yes       | yes   |
| `RuntimeWorkloadKind`               | type      | yes       | yes   |
| `RuntimeWorkloadMarkdownOptions`    | interface | yes       | yes   |
| `RuntimeWorkloadRegistry`           | class     | no        | yes   |
| `RuntimeWorkloadRegistryInspection` | interface | yes       | yes   |
| `RuntimeWorkloadReport`             | interface | yes       | yes   |
| `RuntimeWorkloadReportInspection`   | interface | yes       | yes   |
| `RuntimeWorkloadReportOptions`      | interface | yes       | yes   |
| `RuntimeWorkloadSource`             | interface | yes       | yes   |
| `RuntimeWorkloadState`              | type      | yes       | yes   |

#### src/runtime/terminal_screen.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `TerminalScreenCell`              | interface | yes       | yes   |
| `TerminalScreenController`        | class     | no        | yes   |
| `TerminalScreenControllerOptions` | interface | yes       | yes   |
| `TerminalScreenCursor`            | interface | yes       | yes   |
| `TerminalScreenCursorStyle`       | interface | yes       | yes   |
| `TerminalScreenInspection`        | interface | yes       | yes   |

#### src/runtime/terminal_workspace.ts

| Symbol                                  | Kind      | Type Only | JSDoc |
| --------------------------------------- | --------- | --------- | ----- |
| `AddTerminalWorkspaceSessionOptions`    | interface | yes       | yes   |
| `createTerminalWorkspaceController`     | function  | no        | yes   |
| `SplitTerminalWorkspacePaneOptions`     | interface | yes       | yes   |
| `TerminalWorkspaceController`           | class     | no        | yes   |
| `TerminalWorkspaceControllerOptions`    | interface | yes       | yes   |
| `TerminalWorkspaceInspection`           | interface | yes       | yes   |
| `TerminalWorkspaceLayoutInspection`     | interface | yes       | yes   |
| `TerminalWorkspaceLayoutNode`           | type      | yes       | yes   |
| `TerminalWorkspaceLayoutState`          | interface | yes       | yes   |
| `TerminalWorkspacePaneInspection`       | interface | yes       | yes   |
| `TerminalWorkspacePaneNode`             | interface | yes       | yes   |
| `TerminalWorkspacePanePlacement`        | type      | yes       | yes   |
| `TerminalWorkspacePaneRect`             | interface | yes       | yes   |
| `TerminalWorkspacePaneRectOptions`      | interface | yes       | yes   |
| `terminalWorkspacePaneRects`            | function  | no        | yes   |
| `TerminalWorkspaceSplitDirection`       | type      | yes       | yes   |
| `TerminalWorkspaceSplitNode`            | interface | yes       | yes   |
| `UpsertTerminalWorkspaceSessionOptions` | interface | yes       | yes   |

#### src/runtime/worker_pool.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `installWorkerHandler`      | function  | no        | yes   |
| `runWorkerBatch`            | function  | no        | yes   |
| `WorkerBatchOptions`        | interface | yes       | yes   |
| `WorkerBatchResult`         | interface | yes       | yes   |
| `WorkerFactory`             | type      | yes       | yes   |
| `WorkerHandler`             | type      | yes       | yes   |
| `WorkerLike`                | interface | yes       | yes   |
| `WorkerPool`                | class     | no        | yes   |
| `WorkerPoolInspection`      | interface | yes       | yes   |
| `WorkerPoolOptions`         | interface | yes       | yes   |
| `WorkerPoolRunOptions`      | interface | yes       | yes   |
| `WorkerPoolTerminatedError` | class     | no        | yes   |

#### src/selection.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `clampSelectionIndex`        | function  | no        | yes   |
| `createSelection`            | function  | no        | yes   |
| `moveSelection`              | function  | no        | yes   |
| `normalizeSelection`         | function  | no        | yes   |
| `selectedValues`             | function  | no        | yes   |
| `selectIndex`                | function  | no        | yes   |
| `SelectionController`        | class     | no        | yes   |
| `SelectionControllerOptions` | interface | yes       | yes   |
| `selectionFromValues`        | function  | no        | yes   |
| `SelectionMode`              | type      | yes       | yes   |
| `SelectionMoveOptions`       | interface | yes       | yes   |
| `SelectionState`             | interface | yes       | yes   |
| `SelectionValueOptions`      | interface | yes       | yes   |
| `selectionWindow`            | function  | no        | yes   |
| `selectRange`                | function  | no        | yes   |
| `toggleSelection`            | function  | no        | yes   |

#### src/signals/computed.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `Computable`            | interface | yes       | yes   |
| `Computed`              | class     | no        | yes   |
| `ComputedReadOnlyError` | class     | no        | yes   |

#### src/signals/dependency_tracking.ts

| Symbol                 | Kind     | Type Only | JSDoc |
| ---------------------- | -------- | --------- | ----- |
| `activeSignals`        | variable | no        | yes   |
| `optimizeDependencies` | function | no        | yes   |
| `trackDependencies`    | function | no        | yes   |

#### src/signals/effect.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `Effect`                  | class     | no        | yes   |
| `Effectable`              | interface | yes       | yes   |
| `EffectPausedUpdateError` | class     | no        | yes   |

#### src/signals/flusher.ts

| Symbol    | Kind  | Type Only | JSDoc |
| --------- | ----- | --------- | ----- |
| `Flusher` | class | no        | yes   |

#### src/signals/lazy_computed.ts

| Symbol         | Kind  | Type Only | JSDoc |
| -------------- | ----- | --------- | ----- |
| `LazyComputed` | class | no        | yes   |

#### src/signals/lazy_effect.ts

| Symbol       | Kind  | Type Only | JSDoc |
| ------------ | ----- | --------- | ----- |
| `LazyEffect` | class | no        | yes   |

#### src/signals/mod.ts

| Re-export Target                     | Kind | Names |
| ------------------------------------ | ---- | ----- |
| `src/signals/signal.ts`              | star | -     |
| `src/signals/computed.ts`            | star | -     |
| `src/signals/effect.ts`              | star | -     |
| `src/signals/flusher.ts`             | star | -     |
| `src/signals/lazy_computed.ts`       | star | -     |
| `src/signals/lazy_effect.ts`         | star | -     |
| `src/signals/dependency_tracking.ts` | star | -     |
| `src/signals/reactivity.ts`          | star | -     |
| `src/signals/types.ts`               | star | -     |

_No direct exported symbols._

#### src/signals/reactivity.ts

| Symbol                           | Kind     | Type Only | JSDoc |
| -------------------------------- | -------- | --------- | ----- |
| `CONNECTED_SIGNAL`               | const    | no        | yes   |
| `getConnectedSignal`             | function | no        | yes   |
| `getOriginalRef`                 | function | no        | yes   |
| `IS_REACTIVE`                    | const    | no        | yes   |
| `isReactive`                     | function | no        | yes   |
| `makeArrayMethodsReactive`       | function | no        | yes   |
| `makeMapMethodsReactive`         | function | no        | yes   |
| `makeObjectPropertiesReactive`   | function | no        | yes   |
| `makeSetMethodsReactive`         | function | no        | yes   |
| `ORIGINAL_REF`                   | const    | no        | yes   |
| `Reactive`                       | type     | yes       | yes   |
| `ReactiveOriginalRefAccessError` | class    | no        | yes   |
| `ReactiveSignalAccessError`      | class    | no        | yes   |

#### src/signals/signal.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `batchSignalUpdates`             | function  | no        | yes   |
| `isSignalBatching`               | function  | no        | yes   |
| `Signal`                         | class     | no        | yes   |
| `SignalBatchScheduler`           | class     | no        | yes   |
| `SignalBatchSchedulerInspection` | interface | yes       | yes   |
| `SignalBatchSchedulerOptions`    | interface | yes       | yes   |
| `SignalDeepObserveTypeofError`   | class     | no        | yes   |
| `SignalInspection`               | interface | yes       | yes   |
| `SignalOfObject`                 | type      | yes       | yes   |
| `SignalOptions`                  | interface | yes       | yes   |
| `SignalRecursiveUpdateError`     | class     | no        | yes   |

#### src/signals/types.ts

| Symbol          | Kind      | Type Only | JSDoc |
| --------------- | --------- | --------- | ----- |
| `Dependant`     | interface | yes       | yes   |
| `Dependency`    | interface | yes       | yes   |
| `LazyDependant` | interface | yes       | yes   |
| `Subscription`  | interface | yes       | yes   |

#### src/theme_binding.ts

| Symbol                                 | Kind      | Type Only | JSDoc |
| -------------------------------------- | --------- | --------- | ----- |
| `bindComponentTheme`                   | function  | no        | yes   |
| `bindComponentThemes`                  | function  | no        | yes   |
| `ComponentThemeBindingEntry`           | interface | yes       | yes   |
| `ComponentThemeBindingGroup`           | class     | no        | yes   |
| `ComponentThemeBindingGroupInspection` | interface | yes       | yes   |
| `ComponentThemeBindingInspection`      | interface | yes       | yes   |
| `ComponentThemeBindingOptions`         | interface | yes       | yes   |
| `ThemeBindable`                        | interface | yes       | yes   |

#### src/theme_engine_cache.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createThemeEngineCache`       | function  | no        | yes   |
| `createThemeProviderCache`     | function  | no        | yes   |
| `ThemeEngineCache`             | class     | no        | yes   |
| `ThemeEngineCacheInspection`   | interface | yes       | yes   |
| `ThemeProviderCache`           | class     | no        | yes   |
| `ThemeProviderCacheInspection` | interface | yes       | yes   |

#### src/theme_engine_factory.ts

| Symbol                                     | Kind      | Type Only | JSDoc |
| ------------------------------------------ | --------- | --------- | ----- |
| `createThemeEngineFactory`                 | function  | no        | yes   |
| `createThemeEngineFactoryCatalogReport`    | function  | no        | yes   |
| `createThemeEngineFactoryRegistry`         | function  | no        | yes   |
| `formatThemeEngineFactoryCatalogMarkdown`  | function  | no        | yes   |
| `inspectThemeEngineFactoryCatalog`         | function  | no        | yes   |
| `prewarmThemeEngines`                      | function  | no        | yes   |
| `queryThemeEngineFactories`                | function  | no        | yes   |
| `ThemeEngineFactory`                       | class     | no        | yes   |
| `ThemeEngineFactoryBuildResult`            | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogInspection`      | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogMarkdownOptions` | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogQuery`           | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogReport`          | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogReportOptions`   | interface | yes       | yes   |
| `ThemeEngineFactoryDefinition`             | interface | yes       | yes   |
| `ThemeEngineFactoryInspection`             | interface | yes       | yes   |
| `ThemeEngineFactoryNotFoundError`          | class     | no        | yes   |
| `ThemeEngineFactoryRegistry`               | class     | no        | yes   |
| `ThemeEnginePrewarmOptions`                | interface | yes       | yes   |

#### src/theme_engine_pipeline.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createThemeEnginePipeline`         | function  | no        | yes   |
| `prewarmThemeEnginePipelines`       | function  | no        | yes   |
| `ThemeEnginePipeline`               | class     | no        | yes   |
| `ThemeEnginePipelineBuildResult`    | interface | yes       | yes   |
| `ThemeEnginePipelineContext`        | interface | yes       | yes   |
| `ThemeEnginePipelineDefinition`     | interface | yes       | yes   |
| `ThemeEnginePipelineInspection`     | interface | yes       | yes   |
| `ThemeEnginePipelineListener`       | type      | yes       | yes   |
| `ThemeEnginePipelinePrewarmOptions` | interface | yes       | yes   |
| `ThemeEnginePipelineStepDefinition` | interface | yes       | yes   |
| `ThemeEnginePipelineStepInspection` | interface | yes       | yes   |
| `ThemeEnginePipelineTransform`      | type      | yes       | yes   |

#### src/theme_gallery.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createThemeGallery`                | function  | no        | yes   |
| `filterThemeGalleryItems`           | function  | no        | yes   |
| `rankThemeGalleryItems`             | function  | no        | yes   |
| `selectThemeGalleryItem`            | function  | no        | yes   |
| `ThemeGallery`                      | interface | yes       | yes   |
| `ThemeGalleryComponentStatePreview` | interface | yes       | yes   |
| `ThemeGalleryItem`                  | interface | yes       | yes   |
| `ThemeGalleryMatch`                 | interface | yes       | yes   |
| `ThemeGalleryOptions`               | interface | yes       | yes   |
| `ThemeGallerySelection`             | interface | yes       | yes   |
| `ThemeGalleryTokenPreview`          | interface | yes       | yes   |

#### src/theme_resolver.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `componentThemeStyleRequests`    | function  | no        | yes   |
| `createThemeEngineResolver`      | function  | no        | yes   |
| `createThemeProviderResolver`    | function  | no        | yes   |
| `createThemeResolutionSnapshot`  | function  | no        | yes   |
| `formatThemeResolutionMarkdown`  | function  | no        | yes   |
| `ThemeEngineResolver`            | class     | no        | yes   |
| `ThemeProviderResolver`          | class     | no        | yes   |
| `ThemeResolutionSnapshot`        | interface | yes       | yes   |
| `ThemeResolutionSnapshotOptions` | interface | yes       | yes   |
| `ThemeResolver`                  | interface | yes       | yes   |
| `ThemeResolverMarkdownOptions`   | interface | yes       | yes   |
| `ThemeStyleRequest`              | interface | yes       | yes   |
| `ThemeStyleResolution`           | interface | yes       | yes   |
| `ThemeTokenRequest`              | interface | yes       | yes   |
| `ThemeTokenResolution`           | interface | yes       | yes   |

#### src/theme_workspace.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createThemeWorkspace`         | function  | no        | yes   |
| `ThemeWorkspace`               | class     | no        | yes   |
| `ThemeWorkspaceEngineOptions`  | interface | yes       | yes   |
| `ThemeWorkspaceInspection`     | interface | yes       | yes   |
| `ThemeWorkspaceOptions`        | interface | yes       | yes   |
| `ThemeWorkspacePrewarmOptions` | interface | yes       | yes   |
| `ThemeWorkspacePrewarmResult`  | interface | yes       | yes   |

#### src/theme.ts

| Symbol                                    | Kind      | Type Only | JSDoc |
| ----------------------------------------- | --------- | --------- | ----- |
| `AnsiColor`                               | type      | yes       | yes   |
| `AnsiColorName`                           | type      | yes       | yes   |
| `AnsiRgbColor`                            | type      | yes       | yes   |
| `AnsiStyleSpec`                           | type      | yes       | yes   |
| `AnsiThemeTokenSpecs`                     | type      | yes       | yes   |
| `assertThemeOptions`                      | function  | no        | yes   |
| `compileThemeManifestOptions`             | function  | no        | yes   |
| `compileThemeManifestStateDefinition`     | function  | no        | yes   |
| `compileThemeManifestStyleReference`      | function  | no        | yes   |
| `ComponentThemeDefinition`                | interface | yes       | yes   |
| `composeStandardThemeOptions`             | function  | no        | yes   |
| `composeStyles`                           | function  | no        | yes   |
| `composeThemeOptions`                     | function  | no        | yes   |
| `createAnsiStyle`                         | function  | no        | yes   |
| `createAnsiThemeTokens`                   | function  | no        | yes   |
| `createStandardComponentThemeDefinitions` | function  | no        | yes   |
| `createTheme`                             | function  | no        | yes   |
| `createThemeCatalog`                      | function  | no        | yes   |
| `createThemeEngine`                       | function  | no        | yes   |
| `createThemeEngineFromManifest`           | function  | no        | yes   |
| `createThemeEngineFromPalette`            | function  | no        | yes   |
| `createThemeLayerStack`                   | function  | no        | yes   |
| `createThemePaletteRegistry`              | function  | no        | yes   |
| `createThemeProvider`                     | function  | no        | yes   |
| `createThemeProviderReport`               | function  | no        | yes   |
| `createThemeRegistry`                     | function  | no        | yes   |
| `createThemeRegistryFromManifests`        | function  | no        | yes   |
| `defaultThemePacks`                       | const     | no        | yes   |
| `defaultThemePaletteDefinitions`          | function  | no        | yes   |
| `diffThemeEngines`                        | function  | no        | yes   |
| `emptyStyle`                              | const     | no        | yes   |
| `formatThemeProviderReportMarkdown`       | function  | no        | yes   |
| `hierarchizeTheme`                        | function  | no        | yes   |
| `inspectThemeCoverage`                    | function  | no        | yes   |
| `inspectThemeManifest`                    | function  | no        | yes   |
| `inspectThemeStandardization`             | function  | no        | yes   |
| `mergeComponentThemeDefinition`           | function  | no        | yes   |
| `previewThemeManifest`                    | function  | no        | yes   |
| `previewThemeProvider`                    | function  | no        | yes   |
| `replaceEmptyStyle`                       | function  | no        | yes   |
| `resolveThemeStateDefinition`             | function  | no        | yes   |
| `resolveThemeStyleReference`              | function  | no        | yes   |
| `StandardComponentThemeOptions`           | interface | yes       | yes   |
| `standardThemeComponentNames`             | function  | no        | yes   |
| `Style`                                   | type      | yes       | yes   |
| `Theme`                                   | interface | yes       | yes   |
| `ThemeCatalog`                            | interface | yes       | yes   |
| `ThemeCatalogComponent`                   | interface | yes       | yes   |
| `ThemeCatalogLayer`                       | interface | yes       | yes   |
| `ThemeCatalogTheme`                       | interface | yes       | yes   |
| `ThemeComponentCoverageInspection`        | interface | yes       | yes   |
| `ThemeComponentInspection`                | interface | yes       | yes   |
| `ThemeComponentStateDiff`                 | interface | yes       | yes   |
| `ThemeCoverageInspection`                 | interface | yes       | yes   |
| `ThemeCoverageOptions`                    | interface | yes       | yes   |
| `ThemeEngine`                             | class     | no        | yes   |
| `ThemeEngineDiff`                         | interface | yes       | yes   |
| `ThemeEngineDiffOptions`                  | interface | yes       | yes   |
| `ThemeEngineOptions`                      | interface | yes       | yes   |
| `ThemeInheritanceError`                   | class     | no        | yes   |
| `ThemeInspection`                         | interface | yes       | yes   |
| `ThemeLayer`                              | interface | yes       | yes   |
| `ThemeLayerInspection`                    | interface | yes       | yes   |
| `ThemeLayerStack`                         | class     | no        | yes   |
| `ThemeManifestComponentDefinition`        | interface | yes       | yes   |
| `ThemeManifestComponentInspection`        | interface | yes       | yes   |
| `ThemeManifestComponentStatePreview`      | interface | yes       | yes   |
| `ThemeManifestInspection`                 | interface | yes       | yes   |
| `ThemeManifestOptions`                    | interface | yes       | yes   |
| `ThemeManifestPreview`                    | interface | yes       | yes   |
| `ThemeManifestPreviewOptions`             | interface | yes       | yes   |
| `ThemeManifestStateDefinition`            | type      | yes       | yes   |
| `ThemeManifestStyleReference`             | type      | yes       | yes   |
| `ThemeManifestTokenPreview`               | interface | yes       | yes   |
| `ThemeManifestVariantInspection`          | interface | yes       | yes   |
| `ThemePack`                               | interface | yes       | yes   |
| `themePackFromManifest`                   | function  | no        | yes   |
| `ThemePackInspection`                     | interface | yes       | yes   |
| `ThemePackManifest`                       | interface | yes       | yes   |
| `ThemePackNotFoundError`                  | class     | no        | yes   |
| `ThemePalette`                            | interface | yes       | yes   |
| `ThemePaletteInspection`                  | interface | yes       | yes   |
| `ThemePaletteName`                        | type      | yes       | yes   |
| `ThemePaletteNotFoundError`               | class     | no        | yes   |
| `ThemePaletteReference`                   | type      | yes       | yes   |
| `ThemePaletteRegistry`                    | class     | no        | yes   |
| `themePalettes`                           | const     | no        | yes   |
| `ThemeProvider`                           | class     | no        | yes   |
| `ThemeProviderComponentStatePreview`      | interface | yes       | yes   |
| `ThemeProviderInspection`                 | interface | yes       | yes   |
| `ThemeProviderOptions`                    | interface | yes       | yes   |
| `ThemeProviderPreview`                    | interface | yes       | yes   |
| `ThemeProviderPreviewOptions`             | interface | yes       | yes   |
| `ThemeProviderReport`                     | interface | yes       | yes   |
| `ThemeProviderReportIssue`                | interface | yes       | yes   |
| `ThemeProviderReportIssueSource`          | type      | yes       | yes   |
| `ThemeProviderReportOptions`              | interface | yes       | yes   |
| `ThemeProviderReportSummary`              | interface | yes       | yes   |
| `ThemeProviderTokenPreview`               | interface | yes       | yes   |
| `ThemeRegistry`                           | class     | no        | yes   |
| `ThemeStandardizationInspection`          | interface | yes       | yes   |
| `ThemeState`                              | type      | yes       | yes   |
| `ThemeStateDefinition`                    | type      | yes       | yes   |
| `themeStates`                             | const     | no        | yes   |
| `ThemeStylePreview`                       | interface | yes       | yes   |
| `ThemeStyleReference`                     | type      | yes       | yes   |
| `ThemeTokenDiff`                          | interface | yes       | yes   |
| `ThemeTokenName`                          | type      | yes       | yes   |
| `themeTokenNames`                         | const     | no        | yes   |
| `ThemeTokens`                             | interface | yes       | yes   |
| `ThemeValidationError`                    | class     | no        | yes   |
| `ThemeValidationIssue`                    | interface | yes       | yes   |
| `ThemeValidationIssueKind`                | type      | yes       | yes   |
| `ThemeVariantCoverageInspection`          | interface | yes       | yes   |
| `validateThemeOptions`                    | function  | no        | yes   |

#### src/three_ascii/AcerolaAsciiNode.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `AcerolaAsciiNode`        | class     | no        | yes   |
| `AcerolaAsciiNodeOptions` | interface | yes       | yes   |

#### src/three_ascii/demo_presets.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `ASCII_DEMO_PRESETS`            | const     | no        | yes   |
| `ASCII_NUMERIC_CONTROLS`        | const     | no        | yes   |
| `ASCII_TOGGLE_CONTROLS`         | const     | no        | yes   |
| `AsciiDemoPreset`               | interface | yes       | yes   |
| `asciiDemoPresetIds`            | function  | no        | yes   |
| `asciiDemoPresets`              | function  | no        | yes   |
| `asciiDemoPresetSummaries`      | function  | no        | yes   |
| `AsciiDemoPresetSummary`        | interface | yes       | yes   |
| `AsciiNumericControlDefinition` | interface | yes       | yes   |
| `AsciiNumericControlKey`        | type      | yes       | yes   |
| `AsciiToggleControlDefinition`  | interface | yes       | yes   |
| `AsciiToggleControlKey`         | type      | yes       | yes   |
| `DEFAULT_ASCII_DEMO_EFFECT`     | const     | no        | yes   |
| `findAsciiDemoPreset`           | function  | no        | yes   |

#### src/three_ascii/glyphs.ts

| Symbol                      | Kind     | Type Only | JSDoc |
| --------------------------- | -------- | --------- | ----- |
| `ASCII_FILL_GLYPHS`         | const    | no        | yes   |
| `BLOCK_FILL_GLYPHS`         | const    | no        | yes   |
| `blockFillGlyphForBucket`   | function | no        | yes   |
| `bucketAsciiLuminance`      | function | no        | yes   |
| `classifyEdgeDirection`     | function | no        | yes   |
| `EDGE_GLYPHS`               | const    | no        | yes   |
| `EdgeDirection`             | type     | yes       | yes   |
| `FILL_GLYPHS`               | const    | no        | yes   |
| `glyphForTile`              | function | no        | yes   |
| `pickDominantEdgeDirection` | function | no        | yes   |
| `TERMINAL_GLYPH_STYLES`     | const    | no        | yes   |
| `TERMINAL_GLYPHS`           | const    | no        | yes   |
| `TerminalGlyphStyle`        | type     | yes       | yes   |

#### src/three_ascii/mod.ts

| Re-export Target                      | Kind | Names |
| ------------------------------------- | ---- | ----- |
| `src/three_ascii/AcerolaAsciiNode.ts` | star | -     |
| `src/three_ascii/demo_presets.ts`     | star | -     |
| `src/three_ascii/glyphs.ts`           | star | -     |
| `src/three_ascii/options.ts`          | star | -     |
| `src/three_ascii/renderer.ts`         | star | -     |
| `src/three_ascii/webgpu_compat.ts`    | star | -     |

_No direct exported symbols._

#### src/three_ascii/options.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `applyAsciiPreset`                  | function  | no        | yes   |
| `asciiControlValues`                | function  | no        | yes   |
| `asciiEffectOptions`                | function  | no        | yes   |
| `asciiPresetLabel`                  | function  | no        | yes   |
| `buildAsciiOptionsFromPreset`       | function  | no        | yes   |
| `clampAsciiControlValue`            | function  | no        | yes   |
| `cloneAsciiOptions`                 | function  | no        | yes   |
| `createDefaultAsciiOptions`         | function  | no        | yes   |
| `formatAsciiControlValue`           | function  | no        | yes   |
| `normalizeAsciiOptions`             | function  | no        | yes   |
| `terminalGlyphStyleLabel`           | function  | no        | yes   |
| `THREE_ASCII_BORDER_MODES`          | const     | no        | yes   |
| `ThreeAsciiBorderMode`              | type      | yes       | yes   |
| `ThreeAsciiConfigOptions`           | interface | yes       | yes   |
| `ThreeAsciiOptionNumericControlKey` | type      | yes       | yes   |

#### src/three_ascii/renderer.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `buildThreeAsciiAnsiGrid`      | function  | no        | yes   |
| `ThreeAsciiAnsiGridInput`      | interface | yes       | yes   |
| `ThreeAsciiImageFrame`         | interface | yes       | yes   |
| `ThreeAsciiRenderer`           | class     | no        | yes   |
| `ThreeAsciiRendererOptions`    | interface | yes       | yes   |
| `ThreeAsciiRenderFrame`        | interface | yes       | yes   |
| `ThreeAsciiRenderFrameOptions` | interface | yes       | yes   |

#### src/three_ascii/webgpu_compat.ts

| Symbol                        | Kind     | Type Only | JSDoc |
| ----------------------------- | -------- | --------- | ----- |
| `getCompatibleWebGPUDevice`   | function | no        | yes   |
| `probeCompatibleWebGPUDevice` | function | no        | yes   |

#### src/utils/async.ts

| Symbol  | Kind     | Type Only | JSDoc |
| ------- | -------- | --------- | ----- |
| `sleep` | function | no        | yes   |

#### src/utils/numbers.ts

| Symbol                  | Kind     | Type Only | JSDoc |
| ----------------------- | -------- | --------- | ----- |
| `clamp`                 | function | no        | yes   |
| `fits`                  | function | no        | yes   |
| `fitsInRectangle`       | function | no        | yes   |
| `normalize`             | function | no        | yes   |
| `rectangleEquals`       | function | no        | yes   |
| `rectangleIntersection` | function | no        | yes   |

#### src/utils/sorted_array.ts

| Symbol        | Kind  | Type Only | JSDoc |
| ------------- | ----- | --------- | ----- |
| `CompareFn`   | type  | yes       | yes   |
| `SortedArray` | class | no        | yes   |

#### src/utils/strings.ts

| Symbol                        | Kind     | Type Only | JSDoc |
| ----------------------------- | -------- | --------- | ----- |
| `capitalize`                  | function | no        | yes   |
| `characterWidth`              | function | no        | yes   |
| `cropToWidth`                 | function | no        | yes   |
| `getMultiCodePointCharacters` | function | no        | yes   |
| `insertAt`                    | function | no        | yes   |
| `isFinalAnsiByte`             | function | no        | yes   |
| `stripStyles`                 | function | no        | yes   |
| `textWidth`                   | function | no        | yes   |
| `UNICODE_CHAR_REGEXP`         | const    | no        | yes   |

#### src/view.ts

| Symbol | Kind  | Type Only | JSDoc |
| ------ | ----- | --------- | ----- |
| `View` | class | no        | yes   |

#### src/viewport.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `clampViewportOffset`         | function  | no        | yes   |
| `inspectViewport`             | function  | no        | yes   |
| `inspectViewportAxisOverflow` | function  | no        | yes   |
| `inspectViewportOverflow`     | function  | no        | yes   |
| `maxViewportOffset`           | function  | no        | yes   |
| `ViewportAxisOverflow`        | interface | yes       | yes   |
| `ViewportAxisOverflowOptions` | interface | yes       | yes   |
| `ViewportInspection`          | interface | yes       | yes   |
| `viewportOffsetBy`            | function  | no        | yes   |
| `viewportOffsetForPointer`    | function  | no        | yes   |
| `ViewportOverflowInspection`  | interface | yes       | yes   |
| `ViewportOverflowMode`        | type      | yes       | yes   |
| `ViewportOverflowOptions`     | interface | yes       | yes   |
| `viewportThumb`               | function  | no        | yes   |
| `ViewportThumb`               | interface | yes       | yes   |
| `viewportThumbGlyph`          | function  | no        | yes   |
| `viewportWindow`              | function  | no        | yes   |
| `ViewportWindow`              | interface | yes       | yes   |

#### src/web/cell_canvas_sink.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `BrowserCellCanvasSink`           | class     | no        | yes   |
| `BrowserCellCanvasSinkInspection` | interface | yes       | yes   |
| `BrowserCellCanvasSinkOptions`    | interface | yes       | yes   |
| `parseAnsiCell`                   | function  | no        | yes   |
| `ParsedAnsiCell`                  | interface | yes       | yes   |

#### src/web/dom_renderer.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `applyCssVariables`         | function  | no        | yes   |
| `DomNodeStyle`              | type      | yes       | yes   |
| `DomRenderNode`             | interface | yes       | yes   |
| `DomRenderTarget`           | class     | no        | yes   |
| `DomRenderTargetInspection` | interface | yes       | yes   |
| `renderDomNodeToHtml`       | function  | no        | yes   |
| `themeTokensToCssVariables` | function  | no        | yes   |

#### src/web/host.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `createWebTui`         | function  | no        | yes   |
| `WebTuiHost`           | class     | no        | yes   |
| `WebTuiHostEvents`     | type      | yes       | yes   |
| `WebTuiHostInspection` | interface | yes       | yes   |
| `WebTuiHostOptions`    | interface | yes       | yes   |

#### src/web/mod.ts

| Re-export Target              | Kind | Names |
| ----------------------------- | ---- | ----- |
| `src/web/cell_canvas_sink.ts` | star | -     |
| `src/web/dom_renderer.ts`     | star | -     |
| `src/web/host.ts`             | star | -     |
| `src/web/platform.ts`         | star | -     |
| `src/web/remote_terminal.ts`  | star | -     |

_No direct exported symbols._

#### src/web/platform.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `BrowserFrameScheduler`     | interface | yes       | yes   |
| `BrowserInputSource`        | class     | no        | yes   |
| `BrowserInputSourceOptions` | interface | yes       | yes   |
| `BrowserPlatform`           | class     | no        | yes   |
| `BrowserPlatformOptions`    | interface | yes       | yes   |
| `BrowserTextInputMode`      | type      | yes       | yes   |
| `createBrowserPlatform`     | function  | no        | yes   |

#### src/web/remote_terminal.ts

| Symbol                                | Kind      | Type Only | JSDoc |
| ------------------------------------- | --------- | --------- | ----- |
| `createRemoteTerminalBridge`          | function  | no        | yes   |
| `createRemoteTerminalClient`          | function  | no        | yes   |
| `createWebSocketRemoteTerminalClient` | function  | no        | yes   |
| `decodeRemoteTerminalClientMessage`   | function  | no        | yes   |
| `decodeRemoteTerminalServerMessage`   | function  | no        | yes   |
| `encodeRemoteTerminalInput`           | function  | no        | yes   |
| `encodeRemoteTerminalMessage`         | function  | no        | yes   |
| `encodeRemoteTerminalServerMessage`   | function  | no        | yes   |
| `RemoteTerminalBridge`                | class     | no        | yes   |
| `RemoteTerminalBridgeInspection`      | interface | yes       | yes   |
| `RemoteTerminalBridgeOptions`         | interface | yes       | yes   |
| `RemoteTerminalClient`                | class     | no        | yes   |
| `RemoteTerminalClientEvents`          | type      | yes       | yes   |
| `RemoteTerminalClientInspection`      | interface | yes       | yes   |
| `RemoteTerminalClientMessage`         | type      | yes       | yes   |
| `RemoteTerminalInputEvent`            | type      | yes       | yes   |
| `RemoteTerminalServerMessage`         | type      | yes       | yes   |
| `RemoteTerminalTransport`             | interface | yes       | yes   |
| `WebSocketRemoteTerminalTransport`    | class     | no        | yes   |

## Entrypoint ./remote

Hosted terminal/client bridge protocol and browser WebSocket transport.

- Path: `./mod.remote.ts`
- Runtime: remote
- Stability: experimental

### Summary

- Entrypoint: `mod.remote.ts`
- Modules: 4
- Re-export declarations: 3
- Exported symbols: 38
- Documented symbols: 38
- Documentation coverage: 100.00%
- Duplicate symbols: 0
- Missing targets: 0

### Module Index

| Module                                                      | Re-exports | Symbols | Documented |
| ----------------------------------------------------------- | ---------: | ------: | ---------: |
| [`mod.remote.ts`](#mod-remote-ts)                           |          3 |       0 |          0 |
| [`src/input_reader/types.ts`](#src-input-reader-types-ts)   |          0 |      11 |         11 |
| [`src/types.ts`](#src-types-ts)                             |          0 |       8 |          8 |
| [`src/web/remote_terminal.ts`](#src-web-remote-terminal-ts) |          0 |      19 |         19 |

### Modules

#### mod.remote.ts

| Re-export Target             | Kind  | Names                                                                                                               |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| `src/web/remote_terminal.ts` | star  | -                                                                                                                   |
| `src/types.ts`               | named | `type ConsoleSize`                                                                                                  |
| `src/input_reader/types.ts`  | named | `type KeyPressEvent`, `type MousePressEvent`, `type MouseScrollEvent`, `type PasteEvent`, `type TerminalFocusEvent` |

_No direct exported symbols._

#### src/input_reader/types.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `Alphabet`           | type      | yes       | yes   |
| `Chars`              | type      | yes       | yes   |
| `InputEvent`         | type      | yes       | yes   |
| `Key`                | type      | yes       | yes   |
| `KeyPressEvent`      | interface | yes       | yes   |
| `MouseEvent`         | interface | yes       | yes   |
| `MousePressEvent`    | interface | yes       | yes   |
| `MouseScrollEvent`   | interface | yes       | yes   |
| `PasteEvent`         | interface | yes       | yes   |
| `SpecialKeys`        | type      | yes       | yes   |
| `TerminalFocusEvent` | interface | yes       | yes   |

#### src/types.ts

| Symbol        | Kind      | Type Only | JSDoc |
| ------------- | --------- | --------- | ----- |
| `ConsoleSize` | type      | yes       | yes   |
| `DeepPartial` | type      | yes       | yes   |
| `Margin`      | interface | yes       | yes   |
| `Offset`      | interface | yes       | yes   |
| `Range`       | type      | yes       | yes   |
| `Rectangle`   | interface | yes       | yes   |
| `Stdin`       | type      | yes       | yes   |
| `Stdout`      | type      | yes       | yes   |

#### src/web/remote_terminal.ts

| Symbol                                | Kind      | Type Only | JSDoc |
| ------------------------------------- | --------- | --------- | ----- |
| `createRemoteTerminalBridge`          | function  | no        | yes   |
| `createRemoteTerminalClient`          | function  | no        | yes   |
| `createWebSocketRemoteTerminalClient` | function  | no        | yes   |
| `decodeRemoteTerminalClientMessage`   | function  | no        | yes   |
| `decodeRemoteTerminalServerMessage`   | function  | no        | yes   |
| `encodeRemoteTerminalInput`           | function  | no        | yes   |
| `encodeRemoteTerminalMessage`         | function  | no        | yes   |
| `encodeRemoteTerminalServerMessage`   | function  | no        | yes   |
| `RemoteTerminalBridge`                | class     | no        | yes   |
| `RemoteTerminalBridgeInspection`      | interface | yes       | yes   |
| `RemoteTerminalBridgeOptions`         | interface | yes       | yes   |
| `RemoteTerminalClient`                | class     | no        | yes   |
| `RemoteTerminalClientEvents`          | type      | yes       | yes   |
| `RemoteTerminalClientInspection`      | interface | yes       | yes   |
| `RemoteTerminalClientMessage`         | type      | yes       | yes   |
| `RemoteTerminalInputEvent`            | type      | yes       | yes   |
| `RemoteTerminalServerMessage`         | type      | yes       | yes   |
| `RemoteTerminalTransport`             | interface | yes       | yes   |
| `WebSocketRemoteTerminalTransport`    | class     | no        | yes   |

## Entrypoint ./three-ascii

Focused Three.js/WebGPU ASCII renderer package for glyph, block, mixed, and Kitty-capable scenes.

- Path: `./mod.three_ascii.ts`
- Runtime: shared
- Stability: experimental

### Summary

- Entrypoint: `mod.three_ascii.ts`
- Modules: 8
- Re-export declarations: 7
- Exported symbols: 53
- Documented symbols: 53
- Documentation coverage: 100.00%
- Duplicate symbols: 0
- Missing targets: 0

### Module Index

| Module                                                                        | Re-exports | Symbols | Documented |
| ----------------------------------------------------------------------------- | ---------: | ------: | ---------: |
| [`mod.three_ascii.ts`](#mod-three-ascii-ts)                                   |          1 |       0 |          0 |
| [`src/three_ascii/AcerolaAsciiNode.ts`](#src-three-ascii-acerolaasciinode-ts) |          0 |       2 |          2 |
| [`src/three_ascii/demo_presets.ts`](#src-three-ascii-demo-presets-ts)         |          0 |      14 |         14 |
| [`src/three_ascii/glyphs.ts`](#src-three-ascii-glyphs-ts)                     |          0 |      13 |         13 |
| [`src/three_ascii/mod.ts`](#src-three-ascii-mod-ts)                           |          6 |       0 |          0 |
| [`src/three_ascii/options.ts`](#src-three-ascii-options-ts)                   |          0 |      15 |         15 |
| [`src/three_ascii/renderer.ts`](#src-three-ascii-renderer-ts)                 |          0 |       7 |          7 |
| [`src/three_ascii/webgpu_compat.ts`](#src-three-ascii-webgpu-compat-ts)       |          0 |       2 |          2 |

### Modules

#### mod.three_ascii.ts

| Re-export Target         | Kind | Names |
| ------------------------ | ---- | ----- |
| `src/three_ascii/mod.ts` | star | -     |

_No direct exported symbols._

#### src/three_ascii/AcerolaAsciiNode.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `AcerolaAsciiNode`        | class     | no        | yes   |
| `AcerolaAsciiNodeOptions` | interface | yes       | yes   |

#### src/three_ascii/demo_presets.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `ASCII_DEMO_PRESETS`            | const     | no        | yes   |
| `ASCII_NUMERIC_CONTROLS`        | const     | no        | yes   |
| `ASCII_TOGGLE_CONTROLS`         | const     | no        | yes   |
| `AsciiDemoPreset`               | interface | yes       | yes   |
| `asciiDemoPresetIds`            | function  | no        | yes   |
| `asciiDemoPresets`              | function  | no        | yes   |
| `asciiDemoPresetSummaries`      | function  | no        | yes   |
| `AsciiDemoPresetSummary`        | interface | yes       | yes   |
| `AsciiNumericControlDefinition` | interface | yes       | yes   |
| `AsciiNumericControlKey`        | type      | yes       | yes   |
| `AsciiToggleControlDefinition`  | interface | yes       | yes   |
| `AsciiToggleControlKey`         | type      | yes       | yes   |
| `DEFAULT_ASCII_DEMO_EFFECT`     | const     | no        | yes   |
| `findAsciiDemoPreset`           | function  | no        | yes   |

#### src/three_ascii/glyphs.ts

| Symbol                      | Kind     | Type Only | JSDoc |
| --------------------------- | -------- | --------- | ----- |
| `ASCII_FILL_GLYPHS`         | const    | no        | yes   |
| `BLOCK_FILL_GLYPHS`         | const    | no        | yes   |
| `blockFillGlyphForBucket`   | function | no        | yes   |
| `bucketAsciiLuminance`      | function | no        | yes   |
| `classifyEdgeDirection`     | function | no        | yes   |
| `EDGE_GLYPHS`               | const    | no        | yes   |
| `EdgeDirection`             | type     | yes       | yes   |
| `FILL_GLYPHS`               | const    | no        | yes   |
| `glyphForTile`              | function | no        | yes   |
| `pickDominantEdgeDirection` | function | no        | yes   |
| `TERMINAL_GLYPH_STYLES`     | const    | no        | yes   |
| `TERMINAL_GLYPHS`           | const    | no        | yes   |
| `TerminalGlyphStyle`        | type     | yes       | yes   |

#### src/three_ascii/mod.ts

| Re-export Target                      | Kind | Names |
| ------------------------------------- | ---- | ----- |
| `src/three_ascii/AcerolaAsciiNode.ts` | star | -     |
| `src/three_ascii/demo_presets.ts`     | star | -     |
| `src/three_ascii/glyphs.ts`           | star | -     |
| `src/three_ascii/options.ts`          | star | -     |
| `src/three_ascii/renderer.ts`         | star | -     |
| `src/three_ascii/webgpu_compat.ts`    | star | -     |

_No direct exported symbols._

#### src/three_ascii/options.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `applyAsciiPreset`                  | function  | no        | yes   |
| `asciiControlValues`                | function  | no        | yes   |
| `asciiEffectOptions`                | function  | no        | yes   |
| `asciiPresetLabel`                  | function  | no        | yes   |
| `buildAsciiOptionsFromPreset`       | function  | no        | yes   |
| `clampAsciiControlValue`            | function  | no        | yes   |
| `cloneAsciiOptions`                 | function  | no        | yes   |
| `createDefaultAsciiOptions`         | function  | no        | yes   |
| `formatAsciiControlValue`           | function  | no        | yes   |
| `normalizeAsciiOptions`             | function  | no        | yes   |
| `terminalGlyphStyleLabel`           | function  | no        | yes   |
| `THREE_ASCII_BORDER_MODES`          | const     | no        | yes   |
| `ThreeAsciiBorderMode`              | type      | yes       | yes   |
| `ThreeAsciiConfigOptions`           | interface | yes       | yes   |
| `ThreeAsciiOptionNumericControlKey` | type      | yes       | yes   |

#### src/three_ascii/renderer.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `buildThreeAsciiAnsiGrid`      | function  | no        | yes   |
| `ThreeAsciiAnsiGridInput`      | interface | yes       | yes   |
| `ThreeAsciiImageFrame`         | interface | yes       | yes   |
| `ThreeAsciiRenderer`           | class     | no        | yes   |
| `ThreeAsciiRendererOptions`    | interface | yes       | yes   |
| `ThreeAsciiRenderFrame`        | interface | yes       | yes   |
| `ThreeAsciiRenderFrameOptions` | interface | yes       | yes   |

#### src/three_ascii/webgpu_compat.ts

| Symbol                        | Kind     | Type Only | JSDoc |
| ----------------------------- | -------- | --------- | ----- |
| `getCompatibleWebGPUDevice`   | function | no        | yes   |
| `probeCompatibleWebGPUDevice` | function | no        | yes   |

## Entrypoint ./layout/yoga

Optional Yoga-backed Flexbox solver for HTML/CSS-style layout trees.

- Path: `./src/layout/solvers/yoga.ts`
- Runtime: shared
- Stability: experimental

### Summary

- Entrypoint: `src/layout/solvers/yoga.ts`
- Modules: 1
- Re-export declarations: 0
- Exported symbols: 3
- Documented symbols: 3
- Documentation coverage: 100.00%
- Duplicate symbols: 0
- Missing targets: 0

### Module Index

| Module                                                      | Re-exports | Symbols | Documented |
| ----------------------------------------------------------- | ---------: | ------: | ---------: |
| [`src/layout/solvers/yoga.ts`](#src-layout-solvers-yoga-ts) |          0 |       3 |          3 |

### Modules

#### src/layout/solvers/yoga.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `yogaLayoutSolver`        | function  | no        | yes   |
| `YogaLayoutSolver`        | class     | no        | yes   |
| `YogaLayoutSolverOptions` | interface | yes       | yes   |
