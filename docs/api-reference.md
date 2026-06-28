# API Reference

This document is generated from the public re-export graph rooted at `mod.ts`. It is intended as a complete map of the
modules and exported symbols that make up the package API.

## Summary

- Entrypoint: `mod.ts`
- Modules: 177
- Re-export declarations: 176
- Exported symbols: 1333
- Documented symbols: 341
- Documentation coverage: 25.58%
- Duplicate symbols: 0
- Missing targets: 0

## Module Index

| Module                                                                            | Re-exports | Symbols | Documented |
| --------------------------------------------------------------------------------- | ---------: | ------: | ---------: |
| [`mod.ts`](#mod-ts)                                                               |         31 |       0 |          0 |
| [`src/app/actions.ts`](#src-app-actions-ts)                                       |          0 |       7 |          7 |
| [`src/app/app.ts`](#src-app-app-ts)                                               |          0 |      13 |         13 |
| [`src/app/button_commands.ts`](#src-app-button-commands-ts)                       |          0 |       6 |          0 |
| [`src/app/checkbox_commands.ts`](#src-app-checkbox-commands-ts)                   |          0 |       6 |          0 |
| [`src/app/combobox_commands.ts`](#src-app-combobox-commands-ts)                   |          0 |       6 |          0 |
| [`src/app/command_bindings.ts`](#src-app-command-bindings-ts)                     |          0 |      26 |          0 |
| [`src/app/command_search_index.ts`](#src-app-command-search-index-ts)             |          0 |      11 |          0 |
| [`src/app/commands.ts`](#src-app-commands-ts)                                     |          0 |       8 |          0 |
| [`src/app/component_commands.ts`](#src-app-component-commands-ts)                 |          0 |       5 |          0 |
| [`src/app/data_query_bindings.ts`](#src-app-data-query-bindings-ts)               |          0 |      12 |          0 |
| [`src/app/data_query_commands.ts`](#src-app-data-query-commands-ts)               |          0 |       7 |          0 |
| [`src/app/data_query_plugin.ts`](#src-app-data-query-plugin-ts)                   |          0 |       5 |          0 |
| [`src/app/data_table_commands.ts`](#src-app-data-table-commands-ts)               |          0 |       4 |          0 |
| [`src/app/disposables.ts`](#src-app-disposables-ts)                               |          0 |       6 |          0 |
| [`src/app/focus_commands.ts`](#src-app-focus-commands-ts)                         |          0 |       7 |          0 |
| [`src/app/form_bindings.ts`](#src-app-form-bindings-ts)                           |          0 |       2 |          0 |
| [`src/app/form_commands.ts`](#src-app-form-commands-ts)                           |          0 |       7 |          0 |
| [`src/app/forms.ts`](#src-app-forms-ts)                                           |          0 |      10 |          0 |
| [`src/app/history_bindings.ts`](#src-app-history-bindings-ts)                     |          0 |       6 |          0 |
| [`src/app/history.ts`](#src-app-history-ts)                                       |          0 |       5 |          0 |
| [`src/app/input_commands.ts`](#src-app-input-commands-ts)                         |          0 |       6 |          0 |
| [`src/app/list_commands.ts`](#src-app-list-commands-ts)                           |          0 |       6 |          0 |
| [`src/app/log_viewer_commands.ts`](#src-app-log-viewer-commands-ts)               |          0 |       6 |          0 |
| [`src/app/menu_bar_commands.ts`](#src-app-menu-bar-commands-ts)                   |          0 |       6 |          0 |
| [`src/app/metric_series_commands.ts`](#src-app-metric-series-commands-ts)         |          0 |       6 |          0 |
| [`src/app/mod.ts`](#src-app-mod-ts)                                               |         55 |       0 |          0 |
| [`src/app/mouse_bindings.ts`](#src-app-mouse-bindings-ts)                         |          0 |      10 |          0 |
| [`src/app/plugins.ts`](#src-app-plugins-ts)                                       |          0 |      17 |          0 |
| [`src/app/progress_bar_commands.ts`](#src-app-progress-bar-commands-ts)           |          0 |       6 |          0 |
| [`src/app/radio_group_commands.ts`](#src-app-radio-group-commands-ts)             |          0 |       6 |          0 |
| [`src/app/route_bindings.ts`](#src-app-route-bindings-ts)                         |          0 |       9 |          0 |
| [`src/app/router.ts`](#src-app-router-ts)                                         |          0 |       5 |          0 |
| [`src/app/runtime_profile_commands.ts`](#src-app-runtime-profile-commands-ts)     |          0 |       5 |          0 |
| [`src/app/runtime_profile_plugin.ts`](#src-app-runtime-profile-plugin-ts)         |          0 |       5 |          0 |
| [`src/app/runtime_renderer_commands.ts`](#src-app-runtime-renderer-commands-ts)   |          0 |       5 |          0 |
| [`src/app/runtime_renderer_plugin.ts`](#src-app-runtime-renderer-plugin-ts)       |          0 |       5 |          0 |
| [`src/app/runtime_workload_commands.ts`](#src-app-runtime-workload-commands-ts)   |          0 |       5 |          0 |
| [`src/app/scroll_area_commands.ts`](#src-app-scroll-area-commands-ts)             |          0 |       6 |          0 |
| [`src/app/selection_bindings.ts`](#src-app-selection-bindings-ts)                 |          0 |       8 |          0 |
| [`src/app/settings_bindings.ts`](#src-app-settings-bindings-ts)                   |          0 |      21 |          4 |
| [`src/app/settings_commands.ts`](#src-app-settings-commands-ts)                   |          0 |       5 |          0 |
| [`src/app/settings.ts`](#src-app-settings-ts)                                     |          0 |       5 |          0 |
| [`src/app/slider_commands.ts`](#src-app-slider-commands-ts)                       |          0 |       6 |          0 |
| [`src/app/split_pane_commands.ts`](#src-app-split-pane-commands-ts)               |          0 |       7 |          0 |
| [`src/app/stepper_commands.ts`](#src-app-stepper-commands-ts)                     |          0 |       6 |          0 |
| [`src/app/surface_bindings.ts`](#src-app-surface-bindings-ts)                     |          0 |       2 |          0 |
| [`src/app/table_commands.ts`](#src-app-table-commands-ts)                         |          0 |       6 |          0 |
| [`src/app/tabs_commands.ts`](#src-app-tabs-commands-ts)                           |          0 |       6 |          0 |
| [`src/app/textbox_commands.ts`](#src-app-textbox-commands-ts)                     |          0 |       6 |          0 |
| [`src/app/theme_commands.ts`](#src-app-theme-commands-ts)                         |          0 |      10 |          0 |
| [`src/app/theme_engine_commands.ts`](#src-app-theme-engine-commands-ts)           |          0 |       9 |          0 |
| [`src/app/theme_pipeline_commands.ts`](#src-app-theme-pipeline-commands-ts)       |          0 |       5 |          0 |
| [`src/app/theme_plugin.ts`](#src-app-theme-plugin-ts)                             |          0 |       8 |          0 |
| [`src/app/theme_workspace_plugin.ts`](#src-app-theme-workspace-plugin-ts)         |          0 |       5 |          0 |
| [`src/app/toast_commands.ts`](#src-app-toast-commands-ts)                         |          0 |       6 |          0 |
| [`src/app/tree_commands.ts`](#src-app-tree-commands-ts)                           |          0 |       6 |          0 |
| [`src/canvas/box.ts`](#src-canvas-box-ts)                                         |          0 |       2 |          1 |
| [`src/canvas/canvas.ts`](#src-canvas-canvas-ts)                                   |          0 |       4 |          4 |
| [`src/canvas/draw_object.ts`](#src-canvas-draw-object-ts)                         |          0 |       2 |          1 |
| [`src/canvas/mod.ts`](#src-canvas-mod-ts)                                         |          6 |       0 |          0 |
| [`src/canvas/sink.ts`](#src-canvas-sink-ts)                                       |          0 |       6 |          1 |
| [`src/canvas/text.ts`](#src-canvas-text-ts)                                       |          0 |       3 |          2 |
| [`src/canvas/three_ascii.ts`](#src-canvas-three-ascii-ts)                         |          0 |       2 |          0 |
| [`src/component.ts`](#src-component-ts)                                           |          0 |       4 |          2 |
| [`src/components/box.ts`](#src-components-box-ts)                                 |          0 |       1 |          1 |
| [`src/components/breadcrumbs.ts`](#src-components-breadcrumbs-ts)                 |          0 |       4 |          0 |
| [`src/components/button.ts`](#src-components-button-ts)                           |          0 |       5 |          1 |
| [`src/components/catalog.ts`](#src-components-catalog-ts)                         |          0 |      19 |         19 |
| [`src/components/chart.ts`](#src-components-chart-ts)                             |          0 |       3 |          0 |
| [`src/components/checkbox.ts`](#src-components-checkbox-ts)                       |          0 |       7 |          1 |
| [`src/components/combobox.ts`](#src-components-combobox-ts)                       |          0 |       7 |          1 |
| [`src/components/command_palette.ts`](#src-components-command-palette-ts)         |          0 |      12 |          0 |
| [`src/components/context_menu.ts`](#src-components-context-menu-ts)               |          0 |      10 |          0 |
| [`src/components/data_table.ts`](#src-components-data-table-ts)                   |          0 |      15 |          0 |
| [`src/components/empty_state.ts`](#src-components-empty-state-ts)                 |          0 |       4 |          0 |
| [`src/components/frame.ts`](#src-components-frame-ts)                             |          0 |       4 |          1 |
| [`src/components/gauge.ts`](#src-components-gauge-ts)                             |          0 |       3 |          0 |
| [`src/components/input.ts`](#src-components-input-ts)                             |          0 |       8 |          1 |
| [`src/components/key_help.ts`](#src-components-key-help-ts)                       |          0 |       3 |          0 |
| [`src/components/label.ts`](#src-components-label-ts)                             |          0 |       6 |          5 |
| [`src/components/list.ts`](#src-components-list-ts)                               |          0 |       8 |          0 |
| [`src/components/log_viewer.ts`](#src-components-log-viewer-ts)                   |          0 |       6 |          0 |
| [`src/components/menu_bar.ts`](#src-components-menu-bar-ts)                       |          0 |      10 |          0 |
| [`src/components/metric_series.ts`](#src-components-metric-series-ts)             |          0 |      10 |          0 |
| [`src/components/mod.ts`](#src-components-mod-ts)                                 |         37 |       0 |          0 |
| [`src/components/modal.ts`](#src-components-modal-ts)                             |          0 |       2 |          0 |
| [`src/components/progressbar.ts`](#src-components-progressbar-ts)                 |          0 |      15 |          1 |
| [`src/components/radio_group.ts`](#src-components-radio-group-ts)                 |          0 |      11 |          0 |
| [`src/components/scroll_area.ts`](#src-components-scroll-area-ts)                 |          0 |      11 |          0 |
| [`src/components/slider.ts`](#src-components-slider-ts)                           |          0 |      12 |          1 |
| [`src/components/sparkline.ts`](#src-components-sparkline-ts)                     |          0 |       3 |          0 |
| [`src/components/spinner.ts`](#src-components-spinner-ts)                         |          0 |       6 |          0 |
| [`src/components/statusbar.ts`](#src-components-statusbar-ts)                     |          0 |       3 |          0 |
| [`src/components/stepper.ts`](#src-components-stepper-ts)                         |          0 |      11 |          0 |
| [`src/components/table.ts`](#src-components-table-ts)                             |          0 |      12 |          1 |
| [`src/components/tabs.ts`](#src-components-tabs-ts)                               |          0 |      10 |          0 |
| [`src/components/text.ts`](#src-components-text-ts)                               |          0 |       2 |          1 |
| [`src/components/textbox.ts`](#src-components-textbox-ts)                         |          0 |      10 |          1 |
| [`src/components/three_ascii.ts`](#src-components-three-ascii-ts)                 |          0 |       2 |          0 |
| [`src/components/toast.ts`](#src-components-toast-ts)                             |          0 |       8 |          0 |
| [`src/components/tree.ts`](#src-components-tree-ts)                               |          0 |      11 |          0 |
| [`src/components/virtual_list.ts`](#src-components-virtual-list-ts)               |          0 |       8 |          0 |
| [`src/controls.ts`](#src-controls-ts)                                             |          0 |       2 |          2 |
| [`src/event_emitter.ts`](#src-event-emitter-ts)                                   |          0 |       5 |          3 |
| [`src/focus.ts`](#src-focus-ts)                                                   |          0 |       7 |          0 |
| [`src/grwizard_themes.ts`](#src-grwizard-themes-ts)                               |          0 |       5 |          5 |
| [`src/input_reader/mod.ts`](#src-input-reader-mod-ts)                             |          0 |       2 |          1 |
| [`src/input.ts`](#src-input-ts)                                                   |          0 |       1 |          1 |
| [`src/keymap.ts`](#src-keymap-ts)                                                 |          0 |       6 |          0 |
| [`src/layout/errors.ts`](#src-layout-errors-ts)                                   |          0 |       2 |          0 |
| [`src/layout/flex_layout.ts`](#src-layout-flex-layout-ts)                         |          0 |       3 |          0 |
| [`src/layout/grid_layout.ts`](#src-layout-grid-layout-ts)                         |          0 |       3 |          1 |
| [`src/layout/horizontal_layout.ts`](#src-layout-horizontal-layout-ts)             |          0 |       1 |          1 |
| [`src/layout/mod.ts`](#src-layout-mod-ts)                                         |          9 |       0 |          0 |
| [`src/layout/recipe.ts`](#src-layout-recipe-ts)                                   |          0 |      18 |          5 |
| [`src/layout/responsive.ts`](#src-layout-responsive-ts)                           |          0 |       5 |          0 |
| [`src/layout/split_pane.ts`](#src-layout-split-pane-ts)                           |          0 |      10 |          0 |
| [`src/layout/types.ts`](#src-layout-types-ts)                                     |          0 |       3 |          0 |
| [`src/layout/vertical_layout.ts`](#src-layout-vertical-layout-ts)                 |          0 |       1 |          1 |
| [`src/perf/benchmark.ts`](#src-perf-benchmark-ts)                                 |          0 |      19 |         19 |
| [`src/perf/mod.ts`](#src-perf-mod-ts)                                             |          1 |       0 |          0 |
| [`src/runtime/capabilities.ts`](#src-runtime-capabilities-ts)                     |          0 |      16 |         13 |
| [`src/runtime/data_pipeline_bindings.ts`](#src-runtime-data-pipeline-bindings-ts) |          0 |       4 |          0 |
| [`src/runtime/data_pipeline.ts`](#src-runtime-data-pipeline-ts)                   |          0 |      19 |         19 |
| [`src/runtime/data_query.ts`](#src-runtime-data-query-ts)                         |          0 |      15 |          0 |
| [`src/runtime/mod.ts`](#src-runtime-mod-ts)                                       |         15 |       0 |          0 |
| [`src/runtime/profiles.ts`](#src-runtime-profiles-ts)                             |          0 |      24 |          3 |
| [`src/runtime/render_loop.ts`](#src-runtime-render-loop-ts)                       |          0 |       7 |          1 |
| [`src/runtime/renderer_backends.ts`](#src-runtime-renderer-backends-ts)           |          0 |      24 |          0 |
| [`src/runtime/resource_bindings.ts`](#src-runtime-resource-bindings-ts)           |          0 |       4 |          0 |
| [`src/runtime/resource.ts`](#src-runtime-resource-ts)                             |          0 |      14 |          0 |
| [`src/runtime/scheduler.ts`](#src-runtime-scheduler-ts)                           |          0 |      13 |         13 |
| [`src/runtime/storage.ts`](#src-runtime-storage-ts)                               |          0 |       9 |          0 |
| [`src/runtime/telemetry.ts`](#src-runtime-telemetry-ts)                           |          0 |      15 |         15 |
| [`src/runtime/terminal_capabilities.ts`](#src-runtime-terminal-capabilities-ts)   |          0 |      16 |         16 |
| [`src/runtime/terminal_session.ts`](#src-runtime-terminal-session-ts)             |          0 |       8 |          8 |
| [`src/runtime/worker_pool.ts`](#src-runtime-worker-pool-ts)                       |          0 |      12 |          0 |
| [`src/selection.ts`](#src-selection-ts)                                           |          0 |      16 |         15 |
| [`src/signals/computed.ts`](#src-signals-computed-ts)                             |          0 |       3 |          3 |
| [`src/signals/dependency_tracking.ts`](#src-signals-dependency-tracking-ts)       |          0 |       3 |          2 |
| [`src/signals/effect.ts`](#src-signals-effect-ts)                                 |          0 |       2 |          2 |
| [`src/signals/flusher.ts`](#src-signals-flusher-ts)                               |          0 |       1 |          1 |
| [`src/signals/lazy_computed.ts`](#src-signals-lazy-computed-ts)                   |          0 |       1 |          1 |
| [`src/signals/lazy_effect.ts`](#src-signals-lazy-effect-ts)                       |          0 |       1 |          1 |
| [`src/signals/mod.ts`](#src-signals-mod-ts)                                       |          9 |       0 |          0 |
| [`src/signals/reactivity.ts`](#src-signals-reactivity-ts)                         |          0 |      11 |          4 |
| [`src/signals/signal.ts`](#src-signals-signal-ts)                                 |          0 |       5 |          4 |
| [`src/signals/types.ts`](#src-signals-types-ts)                                   |          0 |       4 |          4 |
| [`src/testing/input.ts`](#src-testing-input-ts)                                   |          0 |       7 |          0 |
| [`src/testing/mod.ts`](#src-testing-mod-ts)                                       |          2 |       0 |          0 |
| [`src/testing/snapshot.ts`](#src-testing-snapshot-ts)                             |          0 |      15 |          0 |
| [`src/theme_binding.ts`](#src-theme-binding-ts)                                   |          0 |       8 |          6 |
| [`src/theme_engine_cache.ts`](#src-theme-engine-cache-ts)                         |          0 |       6 |          0 |
| [`src/theme_engine_factory.ts`](#src-theme-engine-factory-ts)                     |          0 |      19 |         17 |
| [`src/theme_engine_pipeline.ts`](#src-theme-engine-pipeline-ts)                   |          0 |      12 |          1 |
| [`src/theme_gallery.ts`](#src-theme-gallery-ts)                                   |          0 |      11 |         11 |
| [`src/theme_resolver.ts`](#src-theme-resolver-ts)                                 |          0 |      15 |          0 |
| [`src/theme_workspace.ts`](#src-theme-workspace-ts)                               |          0 |       7 |          7 |
| [`src/theme.ts`](#src-theme-ts)                                                   |          0 |     109 |         20 |
| [`src/three_ascii/AcerolaAsciiNode.ts`](#src-three-ascii-acerolaasciinode-ts)     |          0 |       2 |          0 |
| [`src/three_ascii/demo_presets.ts`](#src-three-ascii-demo-presets-ts)             |          0 |      14 |          0 |
| [`src/three_ascii/glyphs.ts`](#src-three-ascii-glyphs-ts)                         |          0 |      11 |          0 |
| [`src/three_ascii/mod.ts`](#src-three-ascii-mod-ts)                               |          4 |       0 |          0 |
| [`src/three_ascii/renderer.ts`](#src-three-ascii-renderer-ts)                     |          0 |       2 |          0 |
| [`src/tui.ts`](#src-tui-ts)                                                       |          0 |       2 |          1 |
| [`src/types.ts`](#src-types-ts)                                                   |          0 |       8 |          8 |
| [`src/utils/ansi_codes.ts`](#src-utils-ansi-codes-ts)                             |          0 |       8 |          8 |
| [`src/utils/async.ts`](#src-utils-async-ts)                                       |          0 |       1 |          1 |
| [`src/utils/component.ts`](#src-utils-component-ts)                               |          0 |       2 |          2 |
| [`src/utils/mod.ts`](#src-utils-mod-ts)                                           |          7 |       0 |          0 |
| [`src/utils/numbers.ts`](#src-utils-numbers-ts)                                   |          0 |       6 |          5 |
| [`src/utils/signals.ts`](#src-utils-signals-ts)                                   |          0 |       1 |          1 |
| [`src/utils/sorted_array.ts`](#src-utils-sorted-array-ts)                         |          0 |       2 |          1 |
| [`src/utils/strings.ts`](#src-utils-strings-ts)                                   |          0 |       9 |          8 |
| [`src/view.ts`](#src-view-ts)                                                     |          0 |       1 |          0 |
| [`src/viewport.ts`](#src-viewport-ts)                                             |          0 |      10 |         10 |

## Modules

### mod.ts

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
| `src/types.ts`                 | star | -     |
| `src/view.ts`                  | star | -     |
| `src/viewport.ts`              | star | -     |
| `src/tui.ts`                   | star | -     |
| `src/signals/mod.ts`           | star | -     |
| `src/layout/mod.ts`            | star | -     |
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

### src/app/actions.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `Action`              | interface | yes       | yes   |
| `ActionBus`           | class     | no        | yes   |
| `ActionBusInspection` | interface | yes       | yes   |
| `ActionDispatch`      | type      | yes       | yes   |
| `ActionHandler`       | type      | yes       | yes   |
| `ActionMiddleware`    | type      | yes       | yes   |
| `ActionOfType`        | type      | yes       | yes   |

### src/app/app.ts

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

### src/app/button_commands.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `bindButtonCommands`   | function  | no        | no    |
| `ButtonCommandAction`  | type      | yes       | no    |
| `ButtonCommandKind`    | type      | yes       | no    |
| `ButtonCommandOptions` | interface | yes       | no    |
| `ButtonCommandPayload` | interface | yes       | no    |
| `buttonCommands`       | function  | no        | no    |

### src/app/checkbox_commands.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindCheckBoxCommands`   | function  | no        | no    |
| `CheckBoxCommandAction`  | type      | yes       | no    |
| `CheckBoxCommandKind`    | type      | yes       | no    |
| `CheckBoxCommandOptions` | interface | yes       | no    |
| `CheckBoxCommandPayload` | interface | yes       | no    |
| `checkBoxCommands`       | function  | no        | no    |

### src/app/combobox_commands.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindComboBoxCommands`   | function  | no        | no    |
| `ComboBoxCommandAction`  | type      | yes       | no    |
| `ComboBoxCommandKind`    | type      | yes       | no    |
| `ComboBoxCommandOptions` | interface | yes       | no    |
| `ComboBoxCommandPayload` | interface | yes       | no    |
| `comboBoxCommands`       | function  | no        | no    |

### src/app/command_bindings.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `bindCommandKeymap`                 | function  | no        | no    |
| `bindCommandKeys`                   | function  | no        | no    |
| `bindCommandSurface`                | function  | no        | no    |
| `commandForKeyEvent`                | function  | no        | no    |
| `CommandKeyBindingConflict`         | interface | yes       | no    |
| `CommandKeyBindingInspection`       | interface | yes       | no    |
| `CommandKeyBindingMarkdownOptions`  | interface | yes       | no    |
| `CommandKeyBindingOptions`          | interface | yes       | no    |
| `CommandKeyBindingReport`           | interface | yes       | no    |
| `CommandKeyBindingReportInspection` | interface | yes       | no    |
| `CommandKeyBindingReportOptions`    | interface | yes       | no    |
| `CommandKeymapBindingOptions`       | interface | yes       | no    |
| `CommandKeyTarget`                  | interface | yes       | no    |
| `CommandSearchMatch`                | interface | yes       | no    |
| `CommandSearchOptions`              | interface | yes       | no    |
| `CommandSurfaceController`          | interface | yes       | no    |
| `CommandSurfaceItem`                | interface | yes       | no    |
| `commandSurfaceItems`               | function  | no        | no    |
| `CommandSurfaceOptions`             | interface | yes       | no    |
| `createCommandKeyBindingReport`     | function  | no        | no    |
| `createCommandSurface`              | function  | no        | no    |
| `executeCommandSurfaceItem`         | function  | no        | no    |
| `formatCommandKeyBindingMarkdown`   | function  | no        | no    |
| `inspectCommandKeyBindings`         | function  | no        | no    |
| `rankCommandSurfaceItems`           | function  | no        | no    |
| `searchCommandSurfaceItems`         | function  | no        | no    |

### src/app/command_search_index.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `CommandSearchIndex`              | interface | yes       | no    |
| `CommandSearchIndexEntry`         | interface | yes       | no    |
| `CommandSearchIndexField`         | interface | yes       | no    |
| `CommandSearchIndexInspection`    | interface | yes       | no    |
| `CommandSearchIndexOptions`       | interface | yes       | no    |
| `createCommandSearchIndex`        | function  | no        | no    |
| `createIndexedCommandSurface`     | function  | no        | no    |
| `IndexedCommandSearchOptions`     | interface | yes       | no    |
| `IndexedCommandSurfaceController` | interface | yes       | no    |
| `IndexedCommandSurfaceInspection` | interface | yes       | no    |
| `searchCommandSearchIndex`        | function  | no        | no    |

### src/app/commands.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `Command`                   | interface | yes       | no    |
| `CommandActionFactory`      | type      | yes       | no    |
| `CommandDispatch`           | type      | yes       | no    |
| `CommandInspection`         | interface | yes       | no    |
| `CommandProjection`         | interface | yes       | no    |
| `CommandRegistry`           | class     | no        | no    |
| `CommandRegistryInspection` | interface | yes       | no    |
| `CommandRegistryListener`   | type      | yes       | no    |

### src/app/component_commands.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindComponentCatalogCommands`    | function  | no        | no    |
| `ComponentCatalogCommandAction`   | type      | yes       | no    |
| `ComponentCatalogCommandOptions`  | interface | yes       | no    |
| `componentCatalogCommands`        | function  | no        | no    |
| `inspectComponentCatalogCommands` | function  | no        | no    |

### src/app/data_query_bindings.ts

| Symbol                             | Kind      | Type Only | JSDoc |
| ---------------------------------- | --------- | --------- | ----- |
| `bindDataQueryParams`              | function  | no        | no    |
| `bindDataQueryResult`              | function  | no        | no    |
| `bindDataQueryTable`               | function  | no        | no    |
| `DataQueryParamsBindingHandle`     | type      | yes       | no    |
| `DataQueryParamsBindingInspection` | interface | yes       | no    |
| `DataQueryParamsBindingOptions`    | interface | yes       | no    |
| `DataQueryResultBindingHandle`     | type      | yes       | no    |
| `DataQueryResultBindingInspection` | interface | yes       | no    |
| `DataQueryResultBindingOptions`    | interface | yes       | no    |
| `DataQueryTableBindingHandle`      | type      | yes       | no    |
| `DataQueryTableBindingInspection`  | interface | yes       | no    |
| `DataQueryTableBindingOptions`     | interface | yes       | no    |

### src/app/data_query_commands.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindDataQueryCommands`   | function  | no        | no    |
| `DataQueryCommandAction`  | type      | yes       | no    |
| `DataQueryCommandKind`    | type      | yes       | no    |
| `DataQueryCommandOptions` | interface | yes       | no    |
| `DataQueryCommandPayload` | interface | yes       | no    |
| `dataQueryCommands`       | function  | no        | no    |
| `DataQuerySortCommand`    | interface | yes       | no    |

### src/app/data_query_plugin.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `createDataQueryPlugin`         | function  | no        | no    |
| `DataQueryAppPlugin`            | interface | yes       | no    |
| `DataQueryPluginInspection`     | interface | yes       | no    |
| `DataQueryPluginInstallContext` | interface | yes       | no    |
| `DataQueryPluginOptions`        | interface | yes       | no    |

### src/app/data_table_commands.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindDataTableCommands`   | function  | no        | no    |
| `DataTableCommandKind`    | type      | yes       | no    |
| `DataTableCommandOptions` | interface | yes       | no    |
| `dataTableCommands`       | function  | no        | no    |

### src/app/disposables.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `createDisposableStack`     | function  | no        | no    |
| `DisposableStack`           | class     | no        | no    |
| `DisposableStackInspection` | interface | yes       | no    |
| `Disposer`                  | type      | yes       | no    |
| `disposeReverse`            | function  | no        | no    |
| `MaybeDisposer`             | type      | yes       | no    |

### src/app/focus_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindFocusCommands`   | function  | no        | no    |
| `FocusCommandAction`  | type      | yes       | no    |
| `FocusCommandKind`    | type      | yes       | no    |
| `FocusCommandOptions` | interface | yes       | no    |
| `FocusCommandPayload` | interface | yes       | no    |
| `focusCommands`       | function  | no        | no    |
| `FocusCommandTarget`  | interface | yes       | no    |

### src/app/form_bindings.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindFormField`           | function  | no        | no    |
| `FormFieldBindingOptions` | interface | yes       | no    |

### src/app/form_commands.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindFormCommands`           | function  | no        | no    |
| `FormCommandAction`          | type      | yes       | no    |
| `FormCommandKind`            | type      | yes       | no    |
| `FormCommandOptions`         | interface | yes       | no    |
| `formCommands`               | function  | no        | no    |
| `FormCommandSnapshotPayload` | interface | yes       | no    |
| `FormFieldCommandPayload`    | interface | yes       | no    |

### src/app/forms.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `FieldName`           | type      | yes       | no    |
| `FieldValidator`      | type      | yes       | no    |
| `FormController`      | class     | no        | no    |
| `FormField`           | interface | yes       | no    |
| `FormFieldInspection` | interface | yes       | no    |
| `FormInspection`      | interface | yes       | no    |
| `FormSnapshot`        | interface | yes       | no    |
| `FormValues`          | type      | yes       | no    |
| `minLength`           | function  | no        | no    |
| `required`            | function  | no        | no    |

### src/app/history_bindings.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindHistoryCommands`        | function  | no        | no    |
| `bindRouteHistory`           | function  | no        | no    |
| `HistoryCommandKind`         | type      | yes       | no    |
| `HistoryCommandOptions`      | interface | yes       | no    |
| `historyCommands`            | function  | no        | no    |
| `RouteHistoryBindingOptions` | interface | yes       | no    |

### src/app/history.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `HistoryEntryInspection` | interface | yes       | no    |
| `HistoryInspection`      | interface | yes       | no    |
| `HistoryStack`           | class     | no        | no    |
| `HistoryStackOptions`    | interface | yes       | no    |
| `HistoryTransaction`     | interface | yes       | no    |

### src/app/input_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindInputCommands`   | function  | no        | no    |
| `InputCommandAction`  | type      | yes       | no    |
| `InputCommandKind`    | type      | yes       | no    |
| `InputCommandOptions` | interface | yes       | no    |
| `InputCommandPayload` | interface | yes       | no    |
| `inputCommands`       | function  | no        | no    |

### src/app/list_commands.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `bindListCommands`   | function  | no        | no    |
| `ListCommandAction`  | type      | yes       | no    |
| `ListCommandKind`    | type      | yes       | no    |
| `ListCommandOptions` | interface | yes       | no    |
| `ListCommandPayload` | interface | yes       | no    |
| `listCommands`       | function  | no        | no    |

### src/app/log_viewer_commands.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `bindLogViewerCommands`   | function  | no        | no    |
| `LogViewerCommandAction`  | type      | yes       | no    |
| `LogViewerCommandKind`    | type      | yes       | no    |
| `LogViewerCommandOptions` | interface | yes       | no    |
| `LogViewerCommandPayload` | interface | yes       | no    |
| `logViewerCommands`       | function  | no        | no    |

### src/app/menu_bar_commands.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `bindMenuBarCommands`   | function  | no        | no    |
| `MenuBarCommandAction`  | type      | yes       | no    |
| `MenuBarCommandKind`    | type      | yes       | no    |
| `MenuBarCommandOptions` | interface | yes       | no    |
| `MenuBarCommandPayload` | interface | yes       | no    |
| `menuBarCommands`       | function  | no        | no    |

### src/app/metric_series_commands.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindMetricSeriesCommands`   | function  | no        | no    |
| `MetricSeriesCommandAction`  | type      | yes       | no    |
| `MetricSeriesCommandKind`    | type      | yes       | no    |
| `MetricSeriesCommandOptions` | interface | yes       | no    |
| `MetricSeriesCommandPayload` | interface | yes       | no    |
| `metricSeriesCommands`       | function  | no        | no    |

### src/app/mod.ts

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
| `src/app/input_commands.ts`            | star | -     |
| `src/app/list_commands.ts`             | star | -     |
| `src/app/log_viewer_commands.ts`       | star | -     |
| `src/app/menu_bar_commands.ts`         | star | -     |
| `src/app/metric_series_commands.ts`    | star | -     |
| `src/app/mouse_bindings.ts`            | star | -     |
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
| `src/app/textbox_commands.ts`          | star | -     |
| `src/app/theme_commands.ts`            | star | -     |
| `src/app/theme_engine_commands.ts`     | star | -     |
| `src/app/theme_pipeline_commands.ts`   | star | -     |
| `src/app/theme_plugin.ts`              | star | -     |
| `src/app/theme_workspace_plugin.ts`    | star | -     |
| `src/app/toast_commands.ts`            | star | -     |
| `src/app/tree_commands.ts`             | star | -     |

_No direct exported symbols._

### src/app/mouse_bindings.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `bindMouseInteractions`          | function  | no        | no    |
| `createMouseInteractionRouter`   | function  | no        | no    |
| `MouseInteractionContext`        | interface | yes       | no    |
| `MouseInteractionDispatchResult` | interface | yes       | no    |
| `MouseInteractionEvent`          | type      | yes       | no    |
| `MouseInteractionHandler`        | type      | yes       | no    |
| `MouseInteractionInspection`     | interface | yes       | no    |
| `MouseInteractionKind`           | type      | yes       | no    |
| `MouseInteractionRouter`         | class     | no        | no    |
| `MouseInteractionTarget`         | interface | yes       | no    |

### src/app/plugins.ts

| Symbol                                  | Kind      | Type Only | JSDoc |
| --------------------------------------- | --------- | --------- | ----- |
| `AppPluginCatalogInspection`            | interface | yes       | no    |
| `AppPluginCatalogMarkdownOptions`       | interface | yes       | no    |
| `AppPluginCatalogQuery`                 | interface | yes       | no    |
| `AppPluginCatalogReport`                | interface | yes       | no    |
| `AppPluginCatalogReportOptions`         | interface | yes       | no    |
| `AppPluginDefinition`                   | interface | yes       | no    |
| `AppPluginDefinitionInspection`         | interface | yes       | no    |
| `AppPluginDefinitionRegistry`           | class     | no        | no    |
| `AppPluginDefinitionRegistryInspection` | interface | yes       | no    |
| `AppPluginRoute`                        | interface | yes       | no    |
| `createAppPlugin`                       | function  | no        | no    |
| `createAppPluginCatalogReport`          | function  | no        | no    |
| `createAppPluginDefinitionRegistry`     | function  | no        | no    |
| `formatAppPluginCatalogMarkdown`        | function  | no        | no    |
| `inspectAppPluginCatalog`               | function  | no        | no    |
| `inspectAppPluginDefinition`            | function  | no        | no    |
| `queryAppPluginDefinitions`             | function  | no        | no    |

### src/app/progress_bar_commands.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `bindProgressBarCommands`   | function  | no        | no    |
| `ProgressBarCommandAction`  | type      | yes       | no    |
| `ProgressBarCommandKind`    | type      | yes       | no    |
| `ProgressBarCommandOptions` | interface | yes       | no    |
| `ProgressBarCommandPayload` | interface | yes       | no    |
| `progressBarCommands`       | function  | no        | no    |

### src/app/radio_group_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindRadioGroupCommands`   | function  | no        | no    |
| `RadioGroupCommandAction`  | type      | yes       | no    |
| `RadioGroupCommandKind`    | type      | yes       | no    |
| `RadioGroupCommandOptions` | interface | yes       | no    |
| `RadioGroupCommandPayload` | interface | yes       | no    |
| `radioGroupCommands`       | function  | no        | no    |

### src/app/route_bindings.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `bindRouteCommands`         | function  | no        | no    |
| `bindRouteIndex`            | function  | no        | no    |
| `bindRouteSignal`           | function  | no        | no    |
| `RouteCommandKind`          | type      | yes       | no    |
| `RouteCommandOptions`       | interface | yes       | no    |
| `routeCommands`             | function  | no        | no    |
| `RouteIdSource`             | type      | yes       | no    |
| `RouteIndexBindingOptions`  | interface | yes       | no    |
| `RouteSignalBindingOptions` | interface | yes       | no    |

### src/app/router.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `Route`                  | interface | yes       | no    |
| `RouteInspection`        | interface | yes       | no    |
| `RouteManager`           | class     | no        | no    |
| `RouteRegisterOptions`   | interface | yes       | no    |
| `RouteUnregisterOptions` | interface | yes       | no    |

### src/app/runtime_profile_commands.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `bindRuntimeProfileCommands`   | function  | no        | no    |
| `RuntimeProfileChangedPayload` | interface | yes       | no    |
| `RuntimeProfileCommandAction`  | type      | yes       | no    |
| `RuntimeProfileCommandOptions` | interface | yes       | no    |
| `runtimeProfileCommands`       | function  | no        | no    |

### src/app/runtime_profile_plugin.ts

| Symbol                               | Kind      | Type Only | JSDoc |
| ------------------------------------ | --------- | --------- | ----- |
| `createRuntimeProfilePlugin`         | function  | no        | no    |
| `RuntimeProfileAppPlugin`            | interface | yes       | no    |
| `RuntimeProfilePluginInspection`     | interface | yes       | no    |
| `RuntimeProfilePluginInstallContext` | interface | yes       | no    |
| `RuntimeProfilePluginOptions`        | interface | yes       | no    |

### src/app/runtime_renderer_commands.ts

| Symbol                                 | Kind      | Type Only | JSDoc |
| -------------------------------------- | --------- | --------- | ----- |
| `bindRuntimeRendererBackendCommands`   | function  | no        | no    |
| `RuntimeRendererBackendChangedPayload` | interface | yes       | no    |
| `RuntimeRendererBackendCommandAction`  | type      | yes       | no    |
| `RuntimeRendererBackendCommandOptions` | interface | yes       | no    |
| `runtimeRendererBackendCommands`       | function  | no        | no    |

### src/app/runtime_renderer_plugin.ts

| Symbol                                       | Kind      | Type Only | JSDoc |
| -------------------------------------------- | --------- | --------- | ----- |
| `createRuntimeRendererBackendPlugin`         | function  | no        | no    |
| `RuntimeRendererBackendAppPlugin`            | interface | yes       | no    |
| `RuntimeRendererBackendPluginInspection`     | interface | yes       | no    |
| `RuntimeRendererBackendPluginInstallContext` | interface | yes       | no    |
| `RuntimeRendererBackendPluginOptions`        | interface | yes       | no    |

### src/app/runtime_workload_commands.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `bindRuntimeWorkloadCommands`    | function  | no        | no    |
| `RuntimeWorkloadCommandAction`   | type      | yes       | no    |
| `RuntimeWorkloadCommandOptions`  | interface | yes       | no    |
| `runtimeWorkloadCommands`        | function  | no        | no    |
| `RuntimeWorkloadReportedPayload` | interface | yes       | no    |

### src/app/scroll_area_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindScrollAreaCommands`   | function  | no        | no    |
| `ScrollAreaCommandAction`  | type      | yes       | no    |
| `ScrollAreaCommandKind`    | type      | yes       | no    |
| `ScrollAreaCommandOptions` | interface | yes       | no    |
| `ScrollAreaCommandPayload` | interface | yes       | no    |
| `scrollAreaCommands`       | function  | no        | no    |

### src/app/selection_bindings.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `bindSelectionCommands`        | function  | no        | no    |
| `bindSelectionValue`           | function  | no        | no    |
| `SelectionCommandKind`         | type      | yes       | no    |
| `SelectionCommandOptions`      | interface | yes       | no    |
| `selectionCommands`            | function  | no        | no    |
| `SelectionItemsSource`         | type      | yes       | no    |
| `SelectionPageSize`            | type      | yes       | no    |
| `SelectionValueBindingOptions` | interface | yes       | no    |

### src/app/settings_bindings.ts

| Symbol                                        | Kind      | Type Only | JSDoc |
| --------------------------------------------- | --------- | --------- | ----- |
| `bindDataQuerySetting`                        | function  | no        | yes   |
| `bindDataTableSetting`                        | function  | no        | yes   |
| `bindRouteSetting`                            | function  | no        | no    |
| `bindRuntimeProfileSetting`                   | function  | no        | no    |
| `bindRuntimeRendererBackendSetting`           | function  | no        | no    |
| `bindSettingSignal`                           | function  | no        | no    |
| `bindSplitPaneSetting`                        | function  | no        | no    |
| `bindThemeLayerSetting`                       | function  | no        | no    |
| `bindThemePipelineSetting`                    | function  | no        | no    |
| `bindThemeSetting`                            | function  | no        | no    |
| `DataQuerySettingBindingOptions`              | interface | yes       | yes   |
| `DataTableSettingBindingOptions`              | interface | yes       | yes   |
| `RouteSettingBindingOptions`                  | interface | yes       | no    |
| `RuntimeProfileSettingBindingOptions`         | interface | yes       | no    |
| `RuntimeRendererBackendSettingBindingOptions` | interface | yes       | no    |
| `SettingBinding`                              | interface | yes       | no    |
| `SettingSignalBindingOptions`                 | interface | yes       | no    |
| `SplitPaneSettingBindingOptions`              | interface | yes       | no    |
| `ThemeLayerSettingBindingOptions`             | interface | yes       | no    |
| `ThemePipelineSettingBindingOptions`          | interface | yes       | no    |
| `ThemeSettingBindingOptions`                  | interface | yes       | no    |

### src/app/settings_commands.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindSettingsCommands`   | function  | no        | no    |
| `SettingsCommandAction`  | type      | yes       | no    |
| `SettingsCommandKind`    | type      | yes       | no    |
| `SettingsCommandOptions` | interface | yes       | no    |
| `settingsCommands`       | function  | no        | no    |

### src/app/settings.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `AppSettingDefinition`         | interface | yes       | no    |
| `createSettingsController`     | function  | no        | no    |
| `SettingsController`           | class     | no        | no    |
| `SettingsControllerInspection` | interface | yes       | no    |
| `SettingsControllerOptions`    | interface | yes       | no    |

### src/app/slider_commands.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `bindSliderCommands`   | function  | no        | no    |
| `SliderCommandAction`  | type      | yes       | no    |
| `SliderCommandKind`    | type      | yes       | no    |
| `SliderCommandOptions` | interface | yes       | no    |
| `SliderCommandPayload` | interface | yes       | no    |
| `sliderCommands`       | function  | no        | no    |

### src/app/split_pane_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindSplitPaneCommands`    | function  | no        | no    |
| `SplitPaneBoundsSource`    | type      | yes       | no    |
| `SplitPaneCommandAction`   | type      | yes       | no    |
| `SplitPaneCommandKind`     | type      | yes       | no    |
| `SplitPaneCommandOptions`  | interface | yes       | no    |
| `splitPaneCommands`        | function  | no        | no    |
| `SplitPaneSnapshotPayload` | interface | yes       | no    |

### src/app/stepper_commands.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `bindStepperCommands`   | function  | no        | no    |
| `StepperCommandAction`  | type      | yes       | no    |
| `StepperCommandKind`    | type      | yes       | no    |
| `StepperCommandOptions` | interface | yes       | no    |
| `StepperCommandPayload` | interface | yes       | no    |
| `stepperCommands`       | function  | no        | no    |

### src/app/surface_bindings.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindModalFocus`           | function  | no        | no    |
| `ModalFocusBindingOptions` | interface | yes       | no    |

### src/app/table_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindTableCommands`   | function  | no        | no    |
| `TableCommandAction`  | type      | yes       | no    |
| `TableCommandKind`    | type      | yes       | no    |
| `TableCommandOptions` | interface | yes       | no    |
| `TableCommandPayload` | interface | yes       | no    |
| `tableCommands`       | function  | no        | no    |

### src/app/tabs_commands.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `bindTabsCommands`   | function  | no        | no    |
| `TabsCommandAction`  | type      | yes       | no    |
| `TabsCommandKind`    | type      | yes       | no    |
| `TabsCommandOptions` | interface | yes       | no    |
| `TabsCommandPayload` | interface | yes       | no    |
| `tabsCommands`       | function  | no        | no    |

### src/app/textbox_commands.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `bindTextBoxCommands`   | function  | no        | no    |
| `TextBoxCommandAction`  | type      | yes       | no    |
| `TextBoxCommandKind`    | type      | yes       | no    |
| `TextBoxCommandOptions` | interface | yes       | no    |
| `TextBoxCommandPayload` | interface | yes       | no    |
| `textBoxCommands`       | function  | no        | no    |

### src/app/theme_commands.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `bindThemeCommands`        | function  | no        | no    |
| `ThemeChangedPayload`      | interface | yes       | no    |
| `ThemeCommandAction`       | type      | yes       | no    |
| `ThemeCommandOptions`      | interface | yes       | no    |
| `themeCommands`            | function  | no        | no    |
| `ThemeLayerChangedPayload` | interface | yes       | no    |
| `themeLayerCommands`       | function  | no        | no    |
| `themePreviewCommands`     | function  | no        | no    |
| `ThemePreviewPayload`      | interface | yes       | no    |
| `themeSelectionCommands`   | function  | no        | no    |

### src/app/theme_engine_commands.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `bindThemeEngineCommands`    | function  | no        | no    |
| `themeEngineCatalogCommands` | function  | no        | no    |
| `ThemeEngineCatalogPayload`  | interface | yes       | no    |
| `ThemeEngineCommandAction`   | type      | yes       | no    |
| `ThemeEngineCommandOptions`  | interface | yes       | no    |
| `themeEngineCommands`        | function  | no        | no    |
| `ThemeEngineCommandSource`   | type      | yes       | no    |
| `themeEngineFactoryCommands` | function  | no        | no    |
| `ThemeEnginePreviewPayload`  | interface | yes       | no    |

### src/app/theme_pipeline_commands.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindThemePipelineCommands`       | function  | no        | no    |
| `ThemePipelineCommandAction`      | type      | yes       | no    |
| `ThemePipelineCommandOptions`     | interface | yes       | no    |
| `themePipelineCommands`           | function  | no        | no    |
| `ThemePipelineStepChangedPayload` | interface | yes       | no    |

### src/app/theme_plugin.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createThemePlugin`                 | function  | no        | no    |
| `ThemeAppPlugin`                    | interface | yes       | no    |
| `ThemePluginInspection`             | interface | yes       | no    |
| `ThemePluginInstallContext`         | interface | yes       | no    |
| `ThemePluginOptions`                | interface | yes       | no    |
| `ThemePluginPipelineCommandOptions` | type      | yes       | no    |
| `ThemePluginPipelineSettingOption`  | type      | yes       | no    |
| `ThemePluginPipelineSettingOptions` | type      | yes       | no    |

### src/app/theme_workspace_plugin.ts

| Symbol                               | Kind      | Type Only | JSDoc |
| ------------------------------------ | --------- | --------- | ----- |
| `createThemeWorkspacePlugin`         | function  | no        | no    |
| `ThemeWorkspaceAppPlugin`            | interface | yes       | no    |
| `ThemeWorkspacePluginInspection`     | interface | yes       | no    |
| `ThemeWorkspacePluginInstallContext` | interface | yes       | no    |
| `ThemeWorkspacePluginOptions`        | interface | yes       | no    |

### src/app/toast_commands.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `bindToastCommands`   | function  | no        | no    |
| `ToastCommandAction`  | type      | yes       | no    |
| `ToastCommandKind`    | type      | yes       | no    |
| `ToastCommandOptions` | interface | yes       | no    |
| `ToastCommandPayload` | interface | yes       | no    |
| `toastCommands`       | function  | no        | no    |

### src/app/tree_commands.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `bindTreeCommands`   | function  | no        | no    |
| `TreeCommandAction`  | type      | yes       | no    |
| `TreeCommandKind`    | type      | yes       | no    |
| `TreeCommandOptions` | interface | yes       | no    |
| `TreeCommandPayload` | interface | yes       | no    |
| `treeCommands`       | function  | no        | no    |

### src/canvas/box.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `BoxObject`        | class     | no        | yes   |
| `BoxObjectOptions` | interface | yes       | no    |

### src/canvas/canvas.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `Canvas`            | class     | no        | yes   |
| `CanvasEventMap`    | type      | yes       | yes   |
| `CanvasOptions`     | interface | yes       | yes   |
| `CanvasRenderStats` | interface | yes       | yes   |

### src/canvas/draw_object.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `DrawObject`        | class     | no        | yes   |
| `DrawObjectOptions` | interface | yes       | no    |

### src/canvas/mod.ts

| Re-export Target            | Kind | Names |
| --------------------------- | ---- | ----- |
| `src/canvas/box.ts`         | star | -     |
| `src/canvas/text.ts`        | star | -     |
| `src/canvas/canvas.ts`      | star | -     |
| `src/canvas/draw_object.ts` | star | -     |
| `src/canvas/sink.ts`        | star | -     |
| `src/canvas/three_ascii.ts` | star | -     |

_No direct exported symbols._

### src/canvas/sink.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `AnsiCanvasSink`        | class     | no        | yes   |
| `AnsiCanvasSinkOptions` | interface | yes       | no    |
| `CanvasCellSink`        | interface | yes       | no    |
| `CanvasCellUpdate`      | interface | yes       | no    |
| `CanvasStdout`          | interface | yes       | no    |
| `MemoryCanvasSink`      | class     | no        | no    |

### src/canvas/text.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `TextObject`        | class     | no        | yes   |
| `TextObjectOptions` | interface | yes       | no    |
| `TextRectangle`     | type      | yes       | yes   |

### src/canvas/three_ascii.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `ThreeAsciiObject`        | class     | no        | no    |
| `ThreeAsciiObjectOptions` | interface | yes       | no    |

### src/component.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `Component`        | class     | no        | no    |
| `ComponentOptions` | interface | yes       | no    |
| `ComponentState`   | type      | yes       | yes   |
| `Interaction`      | interface | yes       | yes   |

### src/components/box.ts

| Symbol | Kind  | Type Only | JSDoc |
| ------ | ----- | --------- | ----- |
| `Box`  | class | no        | yes   |

### src/components/breadcrumbs.ts

| Symbol               | Kind      | Type Only | JSDoc |
| -------------------- | --------- | --------- | ----- |
| `BreadcrumbItem`     | interface | yes       | no    |
| `Breadcrumbs`        | class     | no        | no    |
| `BreadcrumbsOptions` | interface | yes       | no    |
| `renderBreadcrumbs`  | function  | no        | no    |

### src/components/button.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `Button`                  | class     | no        | yes   |
| `ButtonController`        | class     | no        | no    |
| `ButtonControllerOptions` | interface | yes       | no    |
| `ButtonInspection`        | interface | yes       | no    |
| `ButtonOptions`           | interface | yes       | no    |

### src/components/catalog.ts

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

### src/components/chart.ts

| Symbol           | Kind      | Type Only | JSDoc |
| ---------------- | --------- | --------- | ----- |
| `Chart`          | class     | no        | no    |
| `ChartOptions`   | interface | yes       | no    |
| `renderBarChart` | function  | no        | no    |

### src/components/checkbox.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `CheckBox`                  | class     | no        | yes   |
| `CheckBoxController`        | class     | no        | no    |
| `CheckBoxControllerOptions` | interface | yes       | no    |
| `CheckBoxInspection`        | interface | yes       | no    |
| `CheckBoxOptions`           | interface | yes       | no    |
| `Mark`                      | enum      | no        | no    |
| `renderCheckBoxMark`        | function  | no        | no    |

### src/components/combobox.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `clampComboBoxIndex`        | function  | no        | no    |
| `ComboBox`                  | class     | no        | yes   |
| `ComboBoxController`        | class     | no        | no    |
| `ComboBoxControllerOptions` | interface | yes       | no    |
| `ComboBoxInspection`        | interface | yes       | no    |
| `comboBoxLabel`             | function  | no        | no    |
| `ComboBoxOptions`           | interface | yes       | no    |

### src/components/command_palette.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `clampCommandPaletteSelection`    | function  | no        | no    |
| `CommandPalette`                  | class     | no        | no    |
| `CommandPaletteController`        | class     | no        | no    |
| `CommandPaletteControllerOptions` | interface | yes       | no    |
| `CommandPaletteInspection`        | interface | yes       | no    |
| `CommandPaletteItem`              | interface | yes       | no    |
| `CommandPaletteMatch`             | interface | yes       | no    |
| `CommandPaletteOptions`           | interface | yes       | no    |
| `filterCommandPaletteItems`       | function  | no        | no    |
| `rankCommandPaletteItems`         | function  | no        | no    |
| `renderCommandPaletteRows`        | function  | no        | no    |
| `shiftCommandPaletteSelection`    | function  | no        | no    |

### src/components/context_menu.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `clampContextMenuSelection`    | function  | no        | no    |
| `ContextMenu`                  | class     | no        | no    |
| `ContextMenuController`        | class     | no        | no    |
| `ContextMenuControllerOptions` | interface | yes       | no    |
| `ContextMenuInspection`        | interface | yes       | no    |
| `ContextMenuItem`              | interface | yes       | no    |
| `ContextMenuOptions`           | interface | yes       | no    |
| `renderContextMenuRows`        | function  | no        | no    |
| `shiftContextMenuSelection`    | function  | no        | no    |
| `visibleContextMenuItems`      | function  | no        | no    |

### src/components/data_table.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `canSortColumn`              | function  | no        | no    |
| `createDataTableView`        | function  | no        | no    |
| `DataColumn`                 | interface | yes       | no    |
| `DataSort`                   | interface | yes       | no    |
| `DataTableController`        | class     | no        | no    |
| `DataTableControllerOptions` | interface | yes       | no    |
| `DataTableInspection`        | interface | yes       | no    |
| `DataTableState`             | interface | yes       | no    |
| `DataTableView`              | interface | yes       | no    |
| `filterDataRows`             | function  | no        | no    |
| `nextSort`                   | function  | no        | no    |
| `renderDataTableHeader`      | function  | no        | no    |
| `renderDataTableRows`        | function  | no        | no    |
| `sortDataRows`               | function  | no        | no    |
| `SortDirection`              | type      | yes       | no    |

### src/components/empty_state.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `EmptyState`        | class     | no        | no    |
| `EmptyStateContent` | interface | yes       | no    |
| `EmptyStateOptions` | interface | yes       | no    |
| `renderEmptyState`  | function  | no        | no    |

### src/components/frame.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `Frame`                      | class     | no        | yes   |
| `FrameOptions`               | interface | yes       | no    |
| `FrameUnicodeCharacters`     | const     | no        | no    |
| `FrameUnicodeCharactersType` | type      | yes       | no    |

### src/components/gauge.ts

| Symbol         | Kind      | Type Only | JSDoc |
| -------------- | --------- | --------- | ----- |
| `Gauge`        | class     | no        | no    |
| `GaugeOptions` | interface | yes       | no    |
| `renderGauge`  | function  | no        | no    |

### src/components/input.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `Input`                  | class     | no        | yes   |
| `InputController`        | class     | no        | no    |
| `InputControllerOptions` | interface | yes       | no    |
| `InputEditResult`        | type      | yes       | no    |
| `InputInspection`        | interface | yes       | no    |
| `InputOptions`           | interface | yes       | no    |
| `InputRectangle`         | interface | yes       | no    |
| `InputTheme`             | interface | yes       | no    |

### src/components/key_help.ts

| Symbol           | Kind      | Type Only | JSDoc |
| ---------------- | --------- | --------- | ----- |
| `KeyHelp`        | class     | no        | no    |
| `KeyHelpOptions` | interface | yes       | no    |
| `renderKeyHelp`  | function  | no        | no    |

### src/components/label.ts

| Symbol            | Kind      | Type Only | JSDoc |
| ----------------- | --------- | --------- | ----- |
| `Label`           | class     | no        | yes   |
| `LabelAlign`      | interface | yes       | yes   |
| `labelLineLayout` | function  | no        | yes   |
| `LabelLineLayout` | interface | yes       | yes   |
| `LabelOptions`    | interface | yes       | no    |
| `LabelRectangle`  | type      | yes       | yes   |

### src/components/list.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `List`                  | class     | no        | no    |
| `ListController`        | class     | no        | no    |
| `ListControllerOptions` | interface | yes       | no    |
| `ListInspection`        | interface | yes       | no    |
| `ListOptions`           | interface | yes       | no    |
| `VirtualRow`            | interface | yes       | no    |
| `virtualRows`           | function  | no        | no    |
| `visibleListRows`       | function  | no        | no    |

### src/components/log_viewer.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `LogViewer`                  | class     | no        | no    |
| `LogViewerController`        | class     | no        | no    |
| `LogViewerControllerOptions` | interface | yes       | no    |
| `LogViewerInspection`        | interface | yes       | no    |
| `LogViewerOptions`           | interface | yes       | no    |
| `visibleLogLines`            | function  | no        | no    |

### src/components/menu_bar.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `clampMenuIndex`           | function  | no        | no    |
| `MenuBar`                  | class     | no        | no    |
| `MenuBarController`        | class     | no        | no    |
| `MenuBarControllerOptions` | interface | yes       | no    |
| `MenuBarInspection`        | interface | yes       | no    |
| `MenuBarItem`              | interface | yes       | no    |
| `MenuBarOptions`           | interface | yes       | no    |
| `menuItemForIndex`         | function  | no        | no    |
| `renderMenuBar`            | function  | no        | no    |
| `shiftMenuIndex`           | function  | no        | no    |

### src/components/metric_series.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `DEFAULT_METRIC_SERIES_LIMIT`   | const     | no        | no    |
| `MetricClampRange`              | interface | yes       | no    |
| `MetricSeriesController`        | class     | no        | no    |
| `MetricSeriesControllerOptions` | interface | yes       | no    |
| `MetricSeriesInspection`        | interface | yes       | no    |
| `metricSeriesStats`             | function  | no        | no    |
| `MetricSeriesStats`             | interface | yes       | no    |
| `normalizeMetricLimit`          | function  | no        | no    |
| `normalizeMetricValue`          | function  | no        | no    |
| `pushMetricValue`               | function  | no        | no    |

### src/components/mod.ts

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
| `src/components/frame.ts`           | star | -     |
| `src/components/gauge.ts`           | star | -     |
| `src/components/input.ts`           | star | -     |
| `src/components/label.ts`           | star | -     |
| `src/components/key_help.ts`        | star | -     |
| `src/components/list.ts`            | star | -     |
| `src/components/log_viewer.ts`      | star | -     |
| `src/components/menu_bar.ts`        | star | -     |
| `src/components/metric_series.ts`   | star | -     |
| `src/components/modal.ts`           | star | -     |
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
| `src/components/text.ts`            | star | -     |
| `src/components/textbox.ts`         | star | -     |
| `src/components/three_ascii.ts`     | star | -     |
| `src/components/toast.ts`           | star | -     |
| `src/components/tree.ts`            | star | -     |
| `src/components/virtual_list.ts`    | star | -     |

_No direct exported symbols._

### src/components/modal.ts

| Symbol         | Kind      | Type Only | JSDoc |
| -------------- | --------- | --------- | ----- |
| `Modal`        | class     | no        | no    |
| `ModalOptions` | interface | yes       | no    |

### src/components/progressbar.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `clampProgressValue`           | function  | no        | no    |
| `ProgressBar`                  | class     | no        | yes   |
| `progressBarCharMap`           | const     | no        | no    |
| `ProgressBarCharMapType`       | type      | yes       | no    |
| `ProgressBarController`        | class     | no        | no    |
| `ProgressBarControllerOptions` | interface | yes       | no    |
| `ProgressBarDirection`         | type      | yes       | no    |
| `ProgressBarInspection`        | interface | yes       | no    |
| `ProgressBarOptions`           | interface | yes       | no    |
| `ProgressBarOrientation`       | type      | yes       | no    |
| `ProgressBarTheme`             | interface | yes       | no    |
| `ProgressBarTrackRectangle`    | interface | yes       | no    |
| `progressRatio`                | function  | no        | no    |
| `progressRectangle`            | function  | no        | no    |
| `progressSmoothLine`           | function  | no        | no    |

### src/components/radio_group.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `clampRadioIndex`             | function  | no        | no    |
| `optionForValue`              | function  | no        | no    |
| `RadioGroup`                  | class     | no        | no    |
| `RadioGroupController`        | class     | no        | no    |
| `RadioGroupControllerOptions` | interface | yes       | no    |
| `RadioGroupInspection`        | interface | yes       | no    |
| `RadioGroupOptions`           | interface | yes       | no    |
| `RadioOption`                 | interface | yes       | no    |
| `renderRadioGroupRows`        | function  | no        | no    |
| `shiftRadioIndex`             | function  | no        | no    |
| `visibleRadioOptions`         | function  | no        | no    |

### src/components/scroll_area.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `clampScrollOffset`           | function  | no        | no    |
| `maxScrollOffset`             | function  | no        | no    |
| `ScrollArea`                  | class     | no        | no    |
| `ScrollAreaController`        | class     | no        | no    |
| `ScrollAreaControllerOptions` | interface | yes       | no    |
| `ScrollAreaInspection`        | interface | yes       | no    |
| `ScrollAreaOptions`           | interface | yes       | no    |
| `scrollbarGlyph`              | function  | no        | no    |
| `scrollbarThumb`              | function  | no        | no    |
| `ScrollbarThumb`              | type      | yes       | no    |
| `scrollOffsetBy`              | function  | no        | no    |

### src/components/slider.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `clampSliderValue`        | function  | no        | no    |
| `Slider`                  | class     | no        | yes   |
| `SliderController`        | class     | no        | no    |
| `SliderControllerOptions` | interface | yes       | no    |
| `SliderInspection`        | interface | yes       | no    |
| `SliderOptions`           | interface | yes       | no    |
| `SliderOrientation`       | type      | yes       | no    |
| `SliderTheme`             | interface | yes       | no    |
| `sliderThumbRectangle`    | function  | no        | no    |
| `SliderThumbRectangle`    | interface | yes       | no    |
| `SliderTrackRectangle`    | interface | yes       | no    |
| `sliderValueBy`           | function  | no        | no    |

### src/components/sparkline.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `renderSparkline`  | function  | no        | no    |
| `Sparkline`        | class     | no        | no    |
| `SparklineOptions` | interface | yes       | no    |

### src/components/spinner.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `DEFAULT_SPINNER_FRAMES` | const     | no        | no    |
| `renderSpinner`          | function  | no        | no    |
| `Spinner`                | class     | no        | no    |
| `spinnerGlyph`           | function  | no        | no    |
| `SpinnerOptions`         | interface | yes       | no    |
| `SpinnerStatus`          | type      | yes       | no    |

### src/components/statusbar.ts

| Symbol             | Kind      | Type Only | JSDoc |
| ------------------ | --------- | --------- | ----- |
| `renderStatusBar`  | function  | no        | no    |
| `StatusBar`        | class     | no        | no    |
| `StatusBarOptions` | interface | yes       | no    |

### src/components/stepper.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `clampStepperIndex`        | function  | no        | no    |
| `renderStepper`            | function  | no        | no    |
| `shiftStepperIndex`        | function  | no        | no    |
| `stepForIndex`             | function  | no        | no    |
| `Stepper`                  | class     | no        | no    |
| `StepperController`        | class     | no        | no    |
| `StepperControllerOptions` | interface | yes       | no    |
| `StepperInspection`        | interface | yes       | no    |
| `StepperOptions`           | interface | yes       | no    |
| `StepperOrientation`       | type      | yes       | no    |
| `StepperStep`              | interface | yes       | no    |

### src/components/table.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `clampTableRow`              | function  | no        | no    |
| `Table`                      | class     | no        | yes   |
| `TableController`            | class     | no        | no    |
| `TableControllerOptions`     | interface | yes       | no    |
| `TableHeader`                | type      | yes       | no    |
| `TableInspection`            | interface | yes       | no    |
| `tableMaxOffset`             | function  | no        | no    |
| `TableOptions`               | interface | yes       | no    |
| `TableTheme`                 | interface | yes       | no    |
| `TableUnicodeCharacters`     | const     | no        | no    |
| `TableUnicodeCharactersType` | type      | yes       | no    |
| `tableVisibleCapacity`       | function  | no        | no    |

### src/components/tabs.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `clampTabIndex`         | function  | no        | no    |
| `renderTabs`            | function  | no        | no    |
| `shiftTabIndex`         | function  | no        | no    |
| `tabForIndex`           | function  | no        | no    |
| `TabItem`               | interface | yes       | no    |
| `Tabs`                  | class     | no        | no    |
| `TabsController`        | class     | no        | no    |
| `TabsControllerOptions` | interface | yes       | no    |
| `TabsInspection`        | interface | yes       | no    |
| `TabsOptions`           | interface | yes       | no    |

### src/components/text.ts

| Symbol        | Kind      | Type Only | JSDoc |
| ------------- | --------- | --------- | ----- |
| `Text`        | class     | no        | yes   |
| `TextOptions` | interface | yes       | no    |

### src/components/textbox.ts

| Symbol                     | Kind      | Type Only | JSDoc |
| -------------------------- | --------- | --------- | ----- |
| `CursorPosition`           | interface | yes       | no    |
| `TextBox`                  | class     | no        | yes   |
| `TextBoxController`        | class     | no        | no    |
| `TextBoxControllerOptions` | interface | yes       | no    |
| `TextBoxEditResult`        | type      | yes       | no    |
| `TextBoxInspection`        | interface | yes       | no    |
| `TextBoxOptions`           | interface | yes       | no    |
| `TextBoxTheme`             | interface | yes       | no    |
| `TextLineCache`            | class     | no        | no    |
| `TextLineCacheInspection`  | interface | yes       | no    |

### src/components/three_ascii.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `ThreeAscii`        | class     | no        | no    |
| `ThreeAsciiOptions` | interface | yes       | no    |

### src/components/toast.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `renderToast`                 | function  | no        | no    |
| `ToastLevel`                  | type      | yes       | no    |
| `ToastMessage`                | interface | yes       | no    |
| `ToastStack`                  | class     | no        | no    |
| `ToastStackController`        | class     | no        | no    |
| `ToastStackControllerOptions` | interface | yes       | no    |
| `ToastStackInspection`        | interface | yes       | no    |
| `ToastStackOptions`           | interface | yes       | no    |

### src/components/tree.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `flattenTree`           | function  | no        | no    |
| `flattenTreeRows`       | function  | no        | no    |
| `inspectTreeRow`        | function  | no        | no    |
| `Tree`                  | class     | no        | no    |
| `TreeController`        | class     | no        | no    |
| `TreeControllerOptions` | interface | yes       | no    |
| `TreeInspection`        | interface | yes       | no    |
| `TreeNode`              | interface | yes       | no    |
| `TreeOptions`           | interface | yes       | no    |
| `TreeRow`               | interface | yes       | no    |
| `TreeRowInspection`     | interface | yes       | no    |

### src/components/virtual_list.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `renderVirtualListRows`        | function  | no        | no    |
| `VirtualList`                  | class     | no        | no    |
| `VirtualListController`        | class     | no        | no    |
| `VirtualListControllerOptions` | interface | yes       | no    |
| `VirtualListInspection`        | interface | yes       | no    |
| `VirtualListOptions`           | interface | yes       | no    |
| `VirtualListRow`               | interface | yes       | no    |
| `virtualListRows`              | function  | no        | no    |

### src/controls.ts

| Symbol                   | Kind     | Type Only | JSDoc |
| ------------------------ | -------- | --------- | ----- |
| `handleKeyboardControls` | function | no        | yes   |
| `handleMouseControls`    | function | no        | yes   |

### src/event_emitter.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `EmitterEvent`           | type      | yes       | yes   |
| `EventEmitter`           | class     | no        | yes   |
| `EventEmitterInspection` | interface | yes       | no    |
| `EventListener`          | type      | yes       | yes   |
| `EventRecord`            | type      | yes       | no    |

### src/focus.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `bindFocusNavigation`    | function  | no        | no    |
| `Focusable`              | interface | yes       | no    |
| `FocusManager`           | class     | no        | no    |
| `FocusManagerInspection` | interface | yes       | no    |
| `FocusNavigationOptions` | interface | yes       | no    |
| `FocusNavigationTarget`  | interface | yes       | no    |
| `FocusScope`             | class     | no        | no    |

### src/grwizard_themes.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `grWizardThemeOptions`           | function  | no        | yes   |
| `grWizardThemePacks`             | const     | no        | yes   |
| `GrWizardThemePalette`           | interface | yes       | yes   |
| `grWizardThemePaletteDefinition` | function  | no        | yes   |
| `grWizardThemePalettes`          | const     | no        | yes   |

### src/input_reader/mod.ts

| Symbol             | Kind     | Type Only | JSDoc |
| ------------------ | -------- | --------- | ----- |
| `emitInputEvents`  | function | no        | yes   |
| `InputEventRecord` | type     | yes       | no    |

### src/input.ts

| Symbol        | Kind     | Type Only | JSDoc |
| ------------- | -------- | --------- | ----- |
| `handleInput` | function | no        | yes   |

### src/keymap.ts

| Symbol                 | Kind      | Type Only | JSDoc |
| ---------------------- | --------- | --------- | ----- |
| `bindingId`            | function  | no        | no    |
| `formatKeyBinding`     | function  | no        | no    |
| `KeyBinding`           | interface | yes       | no    |
| `KeyBindingInspection` | interface | yes       | no    |
| `KeymapInspection`     | interface | yes       | no    |
| `KeymapRegistry`       | class     | no        | no    |

### src/layout/errors.ts

| Symbol                              | Kind  | Type Only | JSDoc |
| ----------------------------------- | ----- | --------- | ----- |
| `LayoutInvalidElementsPatternError` | class | no        | no    |
| `LayoutMissingElementError`         | class | no        | no    |

### src/layout/flex_layout.ts

| Symbol          | Kind      | Type Only | JSDoc |
| --------------- | --------- | --------- | ----- |
| `FlexDirection` | type      | yes       | no    |
| `FlexItem`      | interface | yes       | no    |
| `flexRects`     | function  | no        | no    |

### src/layout/grid_layout.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `GridLayout`        | class     | no        | yes   |
| `GridLayoutElement` | interface | yes       | no    |
| `GridLayoutOptions` | interface | yes       | no    |

### src/layout/horizontal_layout.ts

| Symbol             | Kind  | Type Only | JSDoc |
| ------------------ | ----- | --------- | ----- |
| `HorizontalLayout` | class | no        | yes   |

### src/layout/mod.ts

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

_No direct exported symbols._

### src/layout/recipe.ts

| Symbol                             | Kind      | Type Only | JSDoc |
| ---------------------------------- | --------- | --------- | ----- |
| `createLayoutRecipeController`     | function  | no        | no    |
| `formatLayoutRecipeMarkdown`       | function  | no        | yes   |
| `inspectLayoutRecipe`              | function  | no        | yes   |
| `LayoutRecipeBreakpointInspection` | interface | yes       | yes   |
| `LayoutRecipeController`           | class     | no        | no    |
| `LayoutRecipeControllerInspection` | interface | yes       | no    |
| `LayoutRecipeInspection`           | interface | yes       | yes   |
| `LayoutRecipeMarkdownOptions`      | interface | yes       | yes   |
| `layoutRecipeSlots`                | function  | no        | no    |
| `LayoutRegion`                     | type      | yes       | no    |
| `LayoutRegionDirection`            | type      | yes       | no    |
| `LayoutRegionDock`                 | interface | yes       | no    |
| `LayoutRegionEdge`                 | type      | yes       | no    |
| `LayoutRegionLeaf`                 | interface | yes       | no    |
| `LayoutRegionSplit`                | interface | yes       | no    |
| `ResolvedLayoutRecipe`             | interface | yes       | no    |
| `resolveLayoutRecipe`              | function  | no        | no    |
| `ResponsiveLayoutRecipe`           | interface | yes       | no    |

### src/layout/responsive.ts

| Symbol              | Kind      | Type Only | JSDoc |
| ------------------- | --------- | --------- | ----- |
| `Breakpoint`        | interface | yes       | no    |
| `dockRect`          | function  | no        | no    |
| `insetRect`         | function  | no        | no    |
| `resolveBreakpoint` | function  | no        | no    |
| `splitRect`         | function  | no        | no    |

### src/layout/split_pane.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `createSplitPaneController`  | function  | no        | no    |
| `resizeSplitPane`            | function  | no        | no    |
| `resizeSplitPaneRatio`       | function  | no        | no    |
| `SplitPaneController`        | class     | no        | no    |
| `SplitPaneControllerOptions` | interface | yes       | no    |
| `SplitPaneDirection`         | type      | yes       | no    |
| `SplitPaneOptions`           | interface | yes       | no    |
| `splitPaneRects`             | function  | no        | no    |
| `SplitPaneRects`             | interface | yes       | no    |
| `SplitPaneResizeMode`        | type      | yes       | no    |

### src/layout/types.ts

| Symbol          | Kind      | Type Only | JSDoc |
| --------------- | --------- | --------- | ----- |
| `Layout`        | interface | yes       | no    |
| `LayoutElement` | interface | yes       | no    |
| `LayoutOptions` | interface | yes       | no    |

### src/layout/vertical_layout.ts

| Symbol           | Kind  | Type Only | JSDoc |
| ---------------- | ----- | --------- | ----- |
| `VerticalLayout` | class | no        | yes   |

### src/perf/benchmark.ts

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

### src/perf/mod.ts

| Re-export Target        | Kind | Names |
| ----------------------- | ---- | ----- |
| `src/perf/benchmark.ts` | star | -     |

_No direct exported symbols._

### src/runtime/capabilities.ts

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
| `RuntimeRendererStrategy`      | type      | yes       | no    |
| `RuntimeStorageStrategy`       | type      | yes       | no    |
| `RuntimeWorkerStrategy`        | type      | yes       | no    |
| `summarizeRuntimeCapabilities` | function  | no        | yes   |

### src/runtime/data_pipeline_bindings.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `bindDataPipeline`              | function  | no        | no    |
| `DataPipelineBinding`           | interface | yes       | no    |
| `DataPipelineBindingInspection` | interface | yes       | no    |
| `DataPipelineBindingOptions`    | interface | yes       | no    |

### src/runtime/data_pipeline.ts

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

### src/runtime/data_query.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `createDataQueryController`  | function  | no        | no    |
| `DataQueryController`        | class     | no        | no    |
| `DataQueryControllerOptions` | interface | yes       | no    |
| `DataQueryFilters`           | type      | yes       | no    |
| `DataQueryInspection`        | interface | yes       | no    |
| `DataQueryParams`            | interface | yes       | no    |
| `DataQueryResult`            | interface | yes       | no    |
| `DataQuerySort`              | interface | yes       | no    |
| `DataQuerySortDirection`     | type      | yes       | no    |
| `LocalDataQueryOptions`      | interface | yes       | no    |
| `nextDataQuerySort`          | function  | no        | no    |
| `normalizeDataQueryParams`   | function  | no        | no    |
| `NormalizedDataQueryParams`  | interface | yes       | no    |
| `pageDataQueryRows`          | function  | no        | no    |
| `queryLocalData`             | function  | no        | no    |

### src/runtime/mod.ts

| Re-export Target                        | Kind | Names |
| --------------------------------------- | ---- | ----- |
| `src/runtime/capabilities.ts`           | star | -     |
| `src/runtime/data_pipeline.ts`          | star | -     |
| `src/runtime/data_pipeline_bindings.ts` | star | -     |
| `src/runtime/data_query.ts`             | star | -     |
| `src/runtime/profiles.ts`               | star | -     |
| `src/runtime/renderer_backends.ts`      | star | -     |
| `src/runtime/resource.ts`               | star | -     |
| `src/runtime/resource_bindings.ts`      | star | -     |
| `src/runtime/render_loop.ts`            | star | -     |
| `src/runtime/scheduler.ts`              | star | -     |
| `src/runtime/storage.ts`                | star | -     |
| `src/runtime/telemetry.ts`              | star | -     |
| `src/runtime/terminal_capabilities.ts`  | star | -     |
| `src/runtime/terminal_session.ts`       | star | -     |
| `src/runtime/worker_pool.ts`            | star | -     |

_No direct exported symbols._

### src/runtime/profiles.ts

| Symbol                                 | Kind      | Type Only | JSDoc |
| -------------------------------------- | --------- | --------- | ----- |
| `createRuntimeProfile`                 | function  | no        | no    |
| `createRuntimeProfileCatalogReport`    | function  | no        | no    |
| `createRuntimeProfileController`       | function  | no        | no    |
| `createRuntimeProfileRegistry`         | function  | no        | no    |
| `findRuntimeProfile`                   | function  | no        | no    |
| `formatRuntimeProfileCatalogMarkdown`  | function  | no        | no    |
| `inspectRuntimeProfileCatalog`         | function  | no        | no    |
| `queryRuntimeProfiles`                 | function  | no        | no    |
| `RuntimeProfile`                       | class     | no        | yes   |
| `RuntimeProfileCatalogInspection`      | interface | yes       | no    |
| `RuntimeProfileCatalogMarkdownOptions` | interface | yes       | no    |
| `RuntimeProfileCatalogQuery`           | interface | yes       | no    |
| `RuntimeProfileCatalogReport`          | interface | yes       | no    |
| `RuntimeProfileCatalogReportOptions`   | interface | yes       | no    |
| `RuntimeProfileController`             | class     | no        | yes   |
| `RuntimeProfileControllerInspection`   | interface | yes       | no    |
| `RuntimeProfileControllerOptions`      | interface | yes       | no    |
| `RuntimeProfileDefinition`             | interface | yes       | no    |
| `runtimeProfileDefinitions`            | const     | no        | no    |
| `RuntimeProfileInspection`             | interface | yes       | no    |
| `RuntimeProfileNotFoundError`          | class     | no        | no    |
| `RuntimeProfilePlanInspection`         | interface | yes       | no    |
| `RuntimeProfileRegistry`               | class     | no        | yes   |
| `runtimeProfiles`                      | function  | no        | no    |

### src/runtime/render_loop.ts

| Symbol                   | Kind      | Type Only | JSDoc |
| ------------------------ | --------- | --------- | ----- |
| `createRenderLoop`       | function  | no        | no    |
| `defaultRenderLoopTimer` | const     | no        | no    |
| `RenderLoop`             | class     | no        | yes   |
| `RenderLoopFrame`        | interface | yes       | no    |
| `RenderLoopInspection`   | interface | yes       | no    |
| `RenderLoopOptions`      | interface | yes       | no    |
| `RenderLoopTimer`        | interface | yes       | no    |

### src/runtime/renderer_backends.ts

| Symbol                                        | Kind      | Type Only | JSDoc |
| --------------------------------------------- | --------- | --------- | ----- |
| `createRuntimeRendererBackend`                | function  | no        | no    |
| `createRuntimeRendererBackendCatalogReport`   | function  | no        | no    |
| `createRuntimeRendererBackendController`      | function  | no        | no    |
| `createRuntimeRendererBackendRegistry`        | function  | no        | no    |
| `formatRuntimeRendererBackendCatalogMarkdown` | function  | no        | no    |
| `inspectRuntimeRendererBackendCatalog`        | function  | no        | no    |
| `inspectRuntimeRendererBackends`              | function  | no        | no    |
| `queryRuntimeRendererBackends`                | function  | no        | no    |
| `RuntimeRendererBackend`                      | class     | no        | no    |
| `RuntimeRendererBackendCatalogInspection`     | interface | yes       | no    |
| `RuntimeRendererBackendCatalogOptions`        | interface | yes       | no    |
| `RuntimeRendererBackendCatalogReport`         | interface | yes       | no    |
| `RuntimeRendererBackendController`            | class     | no        | no    |
| `RuntimeRendererBackendControllerInspection`  | interface | yes       | no    |
| `RuntimeRendererBackendControllerOptions`     | interface | yes       | no    |
| `RuntimeRendererBackendDefinition`            | interface | yes       | no    |
| `runtimeRendererBackendDefinitions`           | const     | no        | no    |
| `RuntimeRendererBackendInspection`            | interface | yes       | no    |
| `RuntimeRendererBackendMarkdownOptions`       | interface | yes       | no    |
| `RuntimeRendererBackendQuery`                 | interface | yes       | no    |
| `RuntimeRendererBackendRegistry`              | class     | no        | no    |
| `runtimeRendererBackends`                     | function  | no        | no    |
| `RuntimeRendererBackendSelectionOptions`      | interface | yes       | no    |
| `selectRuntimeRendererBackend`                | function  | no        | no    |

### src/runtime/resource_bindings.ts

| Symbol                            | Kind      | Type Only | JSDoc |
| --------------------------------- | --------- | --------- | ----- |
| `bindResourceParams`              | function  | no        | no    |
| `ResourceParamsBindingHandle`     | type      | yes       | no    |
| `ResourceParamsBindingInspection` | interface | yes       | no    |
| `ResourceParamsBindingOptions`    | interface | yes       | no    |

### src/runtime/resource.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `AsyncResource`                 | class     | no        | no    |
| `AsyncResourceCacheKey`         | type      | yes       | no    |
| `AsyncResourceContext`          | interface | yes       | no    |
| `AsyncResourceInspection`       | interface | yes       | no    |
| `AsyncResourceLoader`           | type      | yes       | no    |
| `AsyncResourceOptions`          | interface | yes       | no    |
| `AsyncResourceParamsError`      | class     | no        | no    |
| `AsyncResourceState`            | interface | yes       | no    |
| `AsyncResourceStatus`           | type      | yes       | no    |
| `CachedAsyncResource`           | class     | no        | no    |
| `CachedAsyncResourceInspection` | interface | yes       | no    |
| `CachedAsyncResourceOptions`    | interface | yes       | no    |
| `createAsyncResource`           | function  | no        | no    |
| `createCachedAsyncResource`     | function  | no        | no    |

### src/runtime/scheduler.ts

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

### src/runtime/storage.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `AsyncStore`              | interface | yes       | no    |
| `createPersistentSignal`  | function  | no        | no    |
| `createRuntimeStore`      | function  | no        | no    |
| `IndexedDbStore`          | class     | no        | no    |
| `IndexedDbStoreOptions`   | interface | yes       | no    |
| `MemoryStore`             | class     | no        | no    |
| `PersistentSignal`        | class     | no        | no    |
| `PersistentSignalOptions` | interface | yes       | no    |
| `RuntimeStoreOptions`     | interface | yes       | no    |

### src/runtime/telemetry.ts

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

### src/runtime/terminal_capabilities.ts

| Symbol                               | Kind      | Type Only | JSDoc |
| ------------------------------------ | --------- | --------- | ----- |
| `createTerminalPlan`                 | function  | no        | yes   |
| `detectTerminalCapabilities`         | function  | no        | yes   |
| `formatTerminalCapabilities`         | function  | no        | yes   |
| `formatTerminalPlan`                 | function  | no        | yes   |
| `summarizeTerminalCapabilities`      | function  | no        | yes   |
| `TerminalCapabilities`               | interface | yes       | yes   |
| `TerminalCapabilityDetectionOptions` | interface | yes       | yes   |
| `terminalCapabilityEntries`          | function  | no        | yes   |
| `TerminalCapabilityEntry`            | interface | yes       | yes   |
| `TerminalCapabilityId`               | type      | yes       | yes   |
| `TerminalCapabilitySummary`          | interface | yes       | yes   |
| `TerminalColorDepth`                 | type      | yes       | yes   |
| `TerminalMouseProtocol`              | type      | yes       | yes   |
| `TerminalPlan`                       | interface | yes       | yes   |
| `TerminalPlanOptions`                | interface | yes       | yes   |
| `TerminalTextMode`                   | type      | yes       | yes   |

### src/runtime/terminal_session.ts

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

### src/runtime/worker_pool.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `installWorkerHandler`      | function  | no        | no    |
| `runWorkerBatch`            | function  | no        | no    |
| `WorkerBatchOptions`        | interface | yes       | no    |
| `WorkerBatchResult`         | interface | yes       | no    |
| `WorkerFactory`             | type      | yes       | no    |
| `WorkerHandler`             | type      | yes       | no    |
| `WorkerLike`                | interface | yes       | no    |
| `WorkerPool`                | class     | no        | no    |
| `WorkerPoolInspection`      | interface | yes       | no    |
| `WorkerPoolOptions`         | interface | yes       | no    |
| `WorkerPoolRunOptions`      | interface | yes       | no    |
| `WorkerPoolTerminatedError` | class     | no        | no    |

### src/selection.ts

| Symbol                       | Kind      | Type Only | JSDoc |
| ---------------------------- | --------- | --------- | ----- |
| `clampSelectionIndex`        | function  | no        | yes   |
| `createSelection`            | function  | no        | yes   |
| `moveSelection`              | function  | no        | yes   |
| `normalizeSelection`         | function  | no        | no    |
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

### src/signals/computed.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `Computable`            | interface | yes       | yes   |
| `Computed`              | class     | no        | yes   |
| `ComputedReadOnlyError` | class     | no        | yes   |

### src/signals/dependency_tracking.ts

| Symbol                 | Kind     | Type Only | JSDoc |
| ---------------------- | -------- | --------- | ----- |
| `activeSignals`        | variable | no        | no    |
| `optimizeDependencies` | function | no        | yes   |
| `trackDependencies`    | function | no        | yes   |

### src/signals/effect.ts

| Symbol       | Kind      | Type Only | JSDoc |
| ------------ | --------- | --------- | ----- |
| `Effect`     | class     | no        | yes   |
| `Effectable` | interface | yes       | yes   |

### src/signals/flusher.ts

| Symbol    | Kind  | Type Only | JSDoc |
| --------- | ----- | --------- | ----- |
| `Flusher` | class | no        | yes   |

### src/signals/lazy_computed.ts

| Symbol         | Kind  | Type Only | JSDoc |
| -------------- | ----- | --------- | ----- |
| `LazyComputed` | class | no        | yes   |

### src/signals/lazy_effect.ts

| Symbol       | Kind  | Type Only | JSDoc |
| ------------ | ----- | --------- | ----- |
| `LazyEffect` | class | no        | yes   |

### src/signals/mod.ts

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

### src/signals/reactivity.ts

| Symbol                         | Kind     | Type Only | JSDoc |
| ------------------------------ | -------- | --------- | ----- |
| `CONNECTED_SIGNAL`             | const    | no        | no    |
| `getConnectedSignal`           | function | no        | no    |
| `getOriginalRef`               | function | no        | no    |
| `IS_REACTIVE`                  | const    | no        | no    |
| `isReactive`                   | function | no        | no    |
| `makeArrayMethodsReactive`     | function | no        | yes   |
| `makeMapMethodsReactive`       | function | no        | yes   |
| `makeObjectPropertiesReactive` | function | no        | yes   |
| `makeSetMethodsReactive`       | function | no        | yes   |
| `ORIGINAL_REF`                 | const    | no        | no    |
| `Reactive`                     | type     | yes       | no    |

### src/signals/signal.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `Signal`                       | class     | no        | yes   |
| `SignalDeepObserveTypeofError` | class     | no        | yes   |
| `SignalInspection`             | interface | yes       | yes   |
| `SignalOfObject`               | type      | yes       | yes   |
| `SignalOptions`                | interface | yes       | no    |

### src/signals/types.ts

| Symbol          | Kind      | Type Only | JSDoc |
| --------------- | --------- | --------- | ----- |
| `Dependant`     | interface | yes       | yes   |
| `Dependency`    | interface | yes       | yes   |
| `LazyDependant` | interface | yes       | yes   |
| `Subscription`  | interface | yes       | yes   |

### src/testing/input.ts

| Symbol                  | Kind      | Type Only | JSDoc |
| ----------------------- | --------- | --------- | ----- |
| `createTestFocusable`   | function  | no        | no    |
| `createTestKeyPress`    | function  | no        | no    |
| `createTestMousePress`  | function  | no        | no    |
| `createTestMouseScroll` | function  | no        | no    |
| `TestKeyPressOptions`   | interface | yes       | no    |
| `TestKeyPressTarget`    | class     | no        | no    |
| `TestMouseTarget`       | class     | no        | no    |

### src/testing/mod.ts

| Re-export Target          | Kind | Names |
| ------------------------- | ---- | ----- |
| `src/testing/input.ts`    | star | -     |
| `src/testing/snapshot.ts` | star | -     |

_No direct exported symbols._

### src/testing/snapshot.ts

| Symbol                        | Kind      | Type Only | JSDoc |
| ----------------------------- | --------- | --------- | ----- |
| `assertTerminalSnapshot`      | function  | no        | no    |
| `canvasRowText`               | function  | no        | no    |
| `canvasSnapshot`              | function  | no        | no    |
| `compareTerminalSnapshot`     | function  | no        | no    |
| `createTestCanvas`            | function  | no        | no    |
| `createTestStdout`            | function  | no        | no    |
| `formatTerminalSnapshotDiff`  | function  | no        | no    |
| `frameBufferToSnapshot`       | function  | no        | no    |
| `normalizeTerminalSnapshot`   | function  | no        | no    |
| `stripAnsi`                   | function  | no        | no    |
| `TerminalSnapshotComparison`  | interface | yes       | no    |
| `TerminalSnapshotDiffOptions` | interface | yes       | no    |
| `TerminalSnapshotMismatch`    | interface | yes       | no    |
| `TestCanvasOptions`           | interface | yes       | no    |
| `TestStdout`                  | interface | yes       | no    |

### src/theme_binding.ts

| Symbol                                 | Kind      | Type Only | JSDoc |
| -------------------------------------- | --------- | --------- | ----- |
| `bindComponentTheme`                   | function  | no        | yes   |
| `bindComponentThemes`                  | function  | no        | yes   |
| `ComponentThemeBindingEntry`           | interface | yes       | yes   |
| `ComponentThemeBindingGroup`           | class     | no        | yes   |
| `ComponentThemeBindingGroupInspection` | interface | yes       | yes   |
| `ComponentThemeBindingInspection`      | interface | yes       | yes   |
| `ComponentThemeBindingOptions`         | interface | yes       | no    |
| `ThemeBindable`                        | interface | yes       | no    |

### src/theme_engine_cache.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createThemeEngineCache`       | function  | no        | no    |
| `createThemeProviderCache`     | function  | no        | no    |
| `ThemeEngineCache`             | class     | no        | no    |
| `ThemeEngineCacheInspection`   | interface | yes       | no    |
| `ThemeProviderCache`           | class     | no        | no    |
| `ThemeProviderCacheInspection` | interface | yes       | no    |

### src/theme_engine_factory.ts

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
| `ThemeEngineFactoryCatalogMarkdownOptions` | interface | yes       | no    |
| `ThemeEngineFactoryCatalogQuery`           | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogReport`          | interface | yes       | yes   |
| `ThemeEngineFactoryCatalogReportOptions`   | interface | yes       | no    |
| `ThemeEngineFactoryDefinition`             | interface | yes       | yes   |
| `ThemeEngineFactoryInspection`             | interface | yes       | yes   |
| `ThemeEngineFactoryNotFoundError`          | class     | no        | yes   |
| `ThemeEngineFactoryRegistry`               | class     | no        | yes   |
| `ThemeEnginePrewarmOptions`                | interface | yes       | yes   |

### src/theme_engine_pipeline.ts

| Symbol                              | Kind      | Type Only | JSDoc |
| ----------------------------------- | --------- | --------- | ----- |
| `createThemeEnginePipeline`         | function  | no        | no    |
| `prewarmThemeEnginePipelines`       | function  | no        | no    |
| `ThemeEnginePipeline`               | class     | no        | yes   |
| `ThemeEnginePipelineBuildResult`    | interface | yes       | no    |
| `ThemeEnginePipelineContext`        | interface | yes       | no    |
| `ThemeEnginePipelineDefinition`     | interface | yes       | no    |
| `ThemeEnginePipelineInspection`     | interface | yes       | no    |
| `ThemeEnginePipelineListener`       | type      | yes       | no    |
| `ThemeEnginePipelinePrewarmOptions` | interface | yes       | no    |
| `ThemeEnginePipelineStepDefinition` | interface | yes       | no    |
| `ThemeEnginePipelineStepInspection` | interface | yes       | no    |
| `ThemeEnginePipelineTransform`      | type      | yes       | no    |

### src/theme_gallery.ts

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

### src/theme_resolver.ts

| Symbol                           | Kind      | Type Only | JSDoc |
| -------------------------------- | --------- | --------- | ----- |
| `componentThemeStyleRequests`    | function  | no        | no    |
| `createThemeEngineResolver`      | function  | no        | no    |
| `createThemeProviderResolver`    | function  | no        | no    |
| `createThemeResolutionSnapshot`  | function  | no        | no    |
| `formatThemeResolutionMarkdown`  | function  | no        | no    |
| `ThemeEngineResolver`            | class     | no        | no    |
| `ThemeProviderResolver`          | class     | no        | no    |
| `ThemeResolutionSnapshot`        | interface | yes       | no    |
| `ThemeResolutionSnapshotOptions` | interface | yes       | no    |
| `ThemeResolver`                  | interface | yes       | no    |
| `ThemeResolverMarkdownOptions`   | interface | yes       | no    |
| `ThemeStyleRequest`              | interface | yes       | no    |
| `ThemeStyleResolution`           | interface | yes       | no    |
| `ThemeTokenRequest`              | interface | yes       | no    |
| `ThemeTokenResolution`           | interface | yes       | no    |

### src/theme_workspace.ts

| Symbol                         | Kind      | Type Only | JSDoc |
| ------------------------------ | --------- | --------- | ----- |
| `createThemeWorkspace`         | function  | no        | yes   |
| `ThemeWorkspace`               | class     | no        | yes   |
| `ThemeWorkspaceEngineOptions`  | interface | yes       | yes   |
| `ThemeWorkspaceInspection`     | interface | yes       | yes   |
| `ThemeWorkspaceOptions`        | interface | yes       | yes   |
| `ThemeWorkspacePrewarmOptions` | interface | yes       | yes   |
| `ThemeWorkspacePrewarmResult`  | interface | yes       | yes   |

### src/theme.ts

| Symbol                                | Kind      | Type Only | JSDoc |
| ------------------------------------- | --------- | --------- | ----- |
| `AnsiColor`                           | type      | yes       | no    |
| `AnsiColorName`                       | type      | yes       | no    |
| `AnsiRgbColor`                        | type      | yes       | no    |
| `AnsiStyleSpec`                       | interface | yes       | no    |
| `AnsiThemeTokenSpecs`                 | type      | yes       | no    |
| `assertThemeOptions`                  | function  | no        | no    |
| `compileThemeManifestOptions`         | function  | no        | no    |
| `compileThemeManifestStateDefinition` | function  | no        | no    |
| `compileThemeManifestStyleReference`  | function  | no        | no    |
| `ComponentThemeDefinition`            | interface | yes       | no    |
| `composeStyles`                       | function  | no        | no    |
| `composeThemeOptions`                 | function  | no        | no    |
| `createAnsiStyle`                     | function  | no        | no    |
| `createAnsiThemeTokens`               | function  | no        | no    |
| `createTheme`                         | function  | no        | no    |
| `createThemeCatalog`                  | function  | no        | no    |
| `createThemeEngine`                   | function  | no        | no    |
| `createThemeEngineFromManifest`       | function  | no        | no    |
| `createThemeEngineFromPalette`        | function  | no        | yes   |
| `createThemeLayerStack`               | function  | no        | no    |
| `createThemePaletteRegistry`          | function  | no        | yes   |
| `createThemeProvider`                 | function  | no        | no    |
| `createThemeProviderReport`           | function  | no        | yes   |
| `createThemeRegistry`                 | function  | no        | no    |
| `createThemeRegistryFromManifests`    | function  | no        | no    |
| `defaultThemePacks`                   | const     | no        | no    |
| `defaultThemePaletteDefinitions`      | function  | no        | yes   |
| `diffThemeEngines`                    | function  | no        | no    |
| `emptyStyle`                          | function  | no        | yes   |
| `formatThemeProviderReportMarkdown`   | function  | no        | yes   |
| `hierarchizeTheme`                    | function  | no        | yes   |
| `inspectThemeCoverage`                | function  | no        | no    |
| `inspectThemeManifest`                | function  | no        | no    |
| `mergeComponentThemeDefinition`       | function  | no        | no    |
| `previewThemeManifest`                | function  | no        | no    |
| `previewThemeProvider`                | function  | no        | no    |
| `replaceEmptyStyle`                   | function  | no        | yes   |
| `resolveThemeStateDefinition`         | function  | no        | no    |
| `resolveThemeStyleReference`          | function  | no        | no    |
| `Style`                               | type      | yes       | yes   |
| `Theme`                               | interface | yes       | yes   |
| `ThemeCatalog`                        | interface | yes       | no    |
| `ThemeCatalogComponent`               | interface | yes       | no    |
| `ThemeCatalogLayer`                   | interface | yes       | no    |
| `ThemeCatalogTheme`                   | interface | yes       | no    |
| `ThemeComponentCoverageInspection`    | interface | yes       | no    |
| `ThemeComponentInspection`            | interface | yes       | no    |
| `ThemeComponentStateDiff`             | interface | yes       | no    |
| `ThemeCoverageInspection`             | interface | yes       | no    |
| `ThemeCoverageOptions`                | interface | yes       | no    |
| `ThemeEngine`                         | class     | no        | no    |
| `ThemeEngineDiff`                     | interface | yes       | no    |
| `ThemeEngineDiffOptions`              | interface | yes       | no    |
| `ThemeEngineOptions`                  | interface | yes       | no    |
| `ThemeInheritanceError`               | class     | no        | no    |
| `ThemeInspection`                     | interface | yes       | no    |
| `ThemeLayer`                          | interface | yes       | no    |
| `ThemeLayerInspection`                | interface | yes       | no    |
| `ThemeLayerStack`                     | class     | no        | no    |
| `ThemeManifestComponentDefinition`    | interface | yes       | no    |
| `ThemeManifestComponentInspection`    | interface | yes       | no    |
| `ThemeManifestComponentStatePreview`  | interface | yes       | no    |
| `ThemeManifestInspection`             | interface | yes       | no    |
| `ThemeManifestOptions`                | interface | yes       | no    |
| `ThemeManifestPreview`                | interface | yes       | no    |
| `ThemeManifestPreviewOptions`         | interface | yes       | no    |
| `ThemeManifestStateDefinition`        | type      | yes       | no    |
| `ThemeManifestStyleReference`         | type      | yes       | no    |
| `ThemeManifestTokenPreview`           | interface | yes       | no    |
| `ThemeManifestVariantInspection`      | interface | yes       | no    |
| `ThemePack`                           | interface | yes       | no    |
| `themePackFromManifest`               | function  | no        | no    |
| `ThemePackInspection`                 | interface | yes       | no    |
| `ThemePackManifest`                   | interface | yes       | no    |
| `ThemePackNotFoundError`              | class     | no        | no    |
| `ThemePalette`                        | interface | yes       | yes   |
| `ThemePaletteInspection`              | interface | yes       | yes   |
| `ThemePaletteName`                    | type      | yes       | no    |
| `ThemePaletteNotFoundError`           | class     | no        | yes   |
| `ThemePaletteReference`               | type      | yes       | yes   |
| `ThemePaletteRegistry`                | class     | no        | yes   |
| `themePalettes`                       | const     | no        | no    |
| `ThemeProvider`                       | class     | no        | no    |
| `ThemeProviderComponentStatePreview`  | interface | yes       | no    |
| `ThemeProviderInspection`             | interface | yes       | no    |
| `ThemeProviderOptions`                | interface | yes       | no    |
| `ThemeProviderPreview`                | interface | yes       | no    |
| `ThemeProviderPreviewOptions`         | interface | yes       | no    |
| `ThemeProviderReport`                 | interface | yes       | yes   |
| `ThemeProviderReportIssue`            | interface | yes       | yes   |
| `ThemeProviderReportIssueSource`      | type      | yes       | yes   |
| `ThemeProviderReportOptions`          | interface | yes       | yes   |
| `ThemeProviderReportSummary`          | interface | yes       | yes   |
| `ThemeProviderTokenPreview`           | interface | yes       | no    |
| `ThemeRegistry`                       | class     | no        | no    |
| `ThemeState`                          | type      | yes       | no    |
| `ThemeStateDefinition`                | type      | yes       | no    |
| `themeStates`                         | const     | no        | no    |
| `ThemeStylePreview`                   | interface | yes       | no    |
| `ThemeStyleReference`                 | type      | yes       | no    |
| `ThemeTokenDiff`                      | interface | yes       | no    |
| `ThemeTokenName`                      | type      | yes       | no    |
| `themeTokenNames`                     | const     | no        | no    |
| `ThemeTokens`                         | interface | yes       | no    |
| `ThemeValidationError`                | class     | no        | no    |
| `ThemeValidationIssue`                | interface | yes       | no    |
| `ThemeValidationIssueKind`            | type      | yes       | no    |
| `ThemeVariantCoverageInspection`      | interface | yes       | no    |
| `validateThemeOptions`                | function  | no        | no    |

### src/three_ascii/AcerolaAsciiNode.ts

| Symbol                    | Kind      | Type Only | JSDoc |
| ------------------------- | --------- | --------- | ----- |
| `AcerolaAsciiNode`        | class     | no        | no    |
| `AcerolaAsciiNodeOptions` | interface | yes       | no    |

### src/three_ascii/demo_presets.ts

| Symbol                          | Kind      | Type Only | JSDoc |
| ------------------------------- | --------- | --------- | ----- |
| `ASCII_DEMO_PRESETS`            | const     | no        | no    |
| `ASCII_NUMERIC_CONTROLS`        | const     | no        | no    |
| `ASCII_TOGGLE_CONTROLS`         | const     | no        | no    |
| `AsciiDemoPreset`               | interface | yes       | no    |
| `asciiDemoPresetIds`            | function  | no        | no    |
| `asciiDemoPresets`              | function  | no        | no    |
| `asciiDemoPresetSummaries`      | function  | no        | no    |
| `AsciiDemoPresetSummary`        | interface | yes       | no    |
| `AsciiNumericControlDefinition` | interface | yes       | no    |
| `AsciiNumericControlKey`        | type      | yes       | no    |
| `AsciiToggleControlDefinition`  | interface | yes       | no    |
| `AsciiToggleControlKey`         | type      | yes       | no    |
| `DEFAULT_ASCII_DEMO_EFFECT`     | const     | no        | no    |
| `findAsciiDemoPreset`           | function  | no        | no    |

### src/three_ascii/glyphs.ts

| Symbol                      | Kind     | Type Only | JSDoc |
| --------------------------- | -------- | --------- | ----- |
| `ASCII_FILL_GLYPHS`         | const    | no        | no    |
| `bucketAsciiLuminance`      | function | no        | no    |
| `classifyEdgeDirection`     | function | no        | no    |
| `EDGE_GLYPHS`               | const    | no        | no    |
| `EdgeDirection`             | type     | yes       | no    |
| `FILL_GLYPHS`               | const    | no        | no    |
| `glyphForTile`              | function | no        | no    |
| `pickDominantEdgeDirection` | function | no        | no    |
| `TERMINAL_GLYPH_STYLES`     | const    | no        | no    |
| `TERMINAL_GLYPHS`           | const    | no        | no    |
| `TerminalGlyphStyle`        | type     | yes       | no    |

### src/three_ascii/mod.ts

| Re-export Target                      | Kind | Names |
| ------------------------------------- | ---- | ----- |
| `src/three_ascii/AcerolaAsciiNode.ts` | star | -     |
| `src/three_ascii/demo_presets.ts`     | star | -     |
| `src/three_ascii/glyphs.ts`           | star | -     |
| `src/three_ascii/renderer.ts`         | star | -     |

_No direct exported symbols._

### src/three_ascii/renderer.ts

| Symbol                      | Kind      | Type Only | JSDoc |
| --------------------------- | --------- | --------- | ----- |
| `ThreeAsciiRenderer`        | class     | no        | no    |
| `ThreeAsciiRendererOptions` | interface | yes       | no    |

### src/tui.ts

| Symbol       | Kind      | Type Only | JSDoc |
| ------------ | --------- | --------- | ----- |
| `Tui`        | class     | no        | yes   |
| `TuiOptions` | interface | yes       | no    |

### src/types.ts

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

### src/utils/ansi_codes.ts

| Symbol                 | Kind     | Type Only | JSDoc |
| ---------------------- | -------- | --------- | ----- |
| `CLEAR_SCREEN`         | const    | no        | yes   |
| `DISABLE_MOUSE`        | const    | no        | yes   |
| `ENABLE_MOUSE`         | const    | no        | yes   |
| `HIDE_CURSOR`          | const    | no        | yes   |
| `moveCursor`           | function | no        | yes   |
| `SHOW_CURSOR`          | const    | no        | yes   |
| `USE_PRIMARY_BUFFER`   | const    | no        | yes   |
| `USE_SECONDARY_BUFFER` | const    | no        | yes   |

### src/utils/async.ts

| Symbol  | Kind     | Type Only | JSDoc |
| ------- | -------- | --------- | ----- |
| `sleep` | function | no        | yes   |

### src/utils/component.ts

| Symbol                               | Kind     | Type Only | JSDoc |
| ------------------------------------ | -------- | --------- | ----- |
| `getComponentClosestToTopLeftCorner` | function | no        | yes   |
| `isInteractable`                     | function | no        | yes   |

### src/utils/mod.ts

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

### src/utils/numbers.ts

| Symbol                  | Kind     | Type Only | JSDoc |
| ----------------------- | -------- | --------- | ----- |
| `clamp`                 | function | no        | yes   |
| `fits`                  | function | no        | yes   |
| `fitsInRectangle`       | function | no        | yes   |
| `normalize`             | function | no        | yes   |
| `rectangleEquals`       | function | no        | yes   |
| `rectangleIntersection` | function | no        | no    |

### src/utils/signals.ts

| Symbol      | Kind     | Type Only | JSDoc |
| ----------- | -------- | --------- | ----- |
| `signalify` | function | no        | yes   |

### src/utils/sorted_array.ts

| Symbol        | Kind  | Type Only | JSDoc |
| ------------- | ----- | --------- | ----- |
| `CompareFn`   | type  | yes       | no    |
| `SortedArray` | class | no        | yes   |

### src/utils/strings.ts

| Symbol                        | Kind     | Type Only | JSDoc |
| ----------------------------- | -------- | --------- | ----- |
| `capitalize`                  | function | no        | yes   |
| `characterWidth`              | function | no        | yes   |
| `cropToWidth`                 | function | no        | yes   |
| `getMultiCodePointCharacters` | function | no        | yes   |
| `insertAt`                    | function | no        | yes   |
| `isFinalAnsiByte`             | function | no        | no    |
| `stripStyles`                 | function | no        | yes   |
| `textWidth`                   | function | no        | yes   |
| `UNICODE_CHAR_REGEXP`         | const    | no        | yes   |

### src/view.ts

| Symbol | Kind  | Type Only | JSDoc |
| ------ | ----- | --------- | ----- |
| `View` | class | no        | no    |

### src/viewport.ts

| Symbol                | Kind      | Type Only | JSDoc |
| --------------------- | --------- | --------- | ----- |
| `clampViewportOffset` | function  | no        | yes   |
| `inspectViewport`     | function  | no        | yes   |
| `maxViewportOffset`   | function  | no        | yes   |
| `ViewportInspection`  | interface | yes       | yes   |
| `viewportOffsetBy`    | function  | no        | yes   |
| `viewportThumb`       | function  | no        | yes   |
| `ViewportThumb`       | interface | yes       | yes   |
| `viewportThumbGlyph`  | function  | no        | yes   |
| `viewportWindow`      | function  | no        | yes   |
| `ViewportWindow`      | interface | yes       | yes   |
