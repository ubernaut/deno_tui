// Copyright 2023 Im-Beast. MIT license.
import type { WorkbenchButtonRowItem } from "./workbench_control_layout.ts";

/** Actions exposed by compact touch/mobile workbench command strips. */
export type WorkbenchMobileCommandAction = "next" | "controls" | "theme" | "help" | "restore" | "wide" | "dense";

/** Options for projecting compact touch/mobile workbench actions. */
export interface WorkbenchMobileCommandStripOptions {
  activeTitle: string;
  controlsActive?: boolean;
  themeActive?: boolean;
}

/** Project mobile workbench command strip actions into caller-owned button rows. */
export function workbenchMobileCommandStripItemsInto(
  target: WorkbenchButtonRowItem<WorkbenchMobileCommandAction>[],
  options: WorkbenchMobileCommandStripOptions,
): WorkbenchButtonRowItem<WorkbenchMobileCommandAction>[] {
  target.length = 7;
  target[0] = { action: "next", label: `Next ${options.activeTitle}` };
  target[1] = { action: "controls", label: "Controls", active: options.controlsActive === true };
  target[2] = { action: "theme", label: "Theme", active: options.themeActive === true };
  target[3] = { action: "help", label: "Help" };
  target[4] = { action: "restore", label: "Restore", tone: "muted" };
  target[5] = { action: "wide", label: "Wide", tone: "muted" };
  target[6] = { action: "dense", label: "Dense", tone: "muted" };
  return target;
}
