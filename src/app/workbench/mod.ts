// Copyright 2023 Im-Beast. MIT license.
/**
 * Renderer-neutral workbench helpers.
 *
 * This facade gives future workbench controller extraction a stable internal namespace while preserving the existing
 * flat `src/app/*` modules and public root exports.
 */
export * from "../hit_targets.ts";
export * from "../workbench_frame.ts";
export * from "../workbench_menu.ts";
export * from "../workbench_shelf.ts";
export * from "../workbench_terminal.ts";
export * from "../workbench_titlebar.ts";
export * from "../workbench_viewport.ts";
export * from "../workbench_window_registry.ts";
export * from "../workbench_workspace.ts";
