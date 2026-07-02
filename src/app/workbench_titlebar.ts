// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { buttonText } from "./workbench_frame.ts";
import { textWidth } from "../utils/strings.ts";

/** Button action kinds exposed by workbench titlebars. */
export type WorkbenchTitlebarButtonKind = "minimize" | "maximize" | "restore" | "close" | "config";

/** Tone hint for workbench titlebar button rendering. */
export type WorkbenchTitlebarButtonTone = "default" | "muted" | "warning" | "success" | "danger";

/** Renderer-neutral titlebar button geometry and display metadata. */
export interface WorkbenchTitlebarButton {
  kind: WorkbenchTitlebarButtonKind;
  label: string;
  rect: Rectangle;
  tone: WorkbenchTitlebarButtonTone;
  compact: boolean;
}

/** Options used to calculate workbench titlebar button geometry. */
export interface WorkbenchTitlebarLayoutOptions {
  rect: Rectangle;
  title: string;
  showConfig?: boolean;
  controlsMinWidth?: number;
  configLabel?: string;
}

/** Renderer-neutral titlebar layout result. */
export interface WorkbenchTitlebarLayout {
  buttons: WorkbenchTitlebarButton[];
  hasWindowControls: boolean;
}

const WINDOW_CONTROL_SPECS: readonly Omit<WorkbenchTitlebarButton, "rect">[] = [
  { kind: "close", label: "x", tone: "danger", compact: true },
  { kind: "restore", label: "↺", tone: "muted", compact: true },
  { kind: "maximize", label: "□", tone: "success", compact: true },
  { kind: "minimize", label: "-", tone: "warning", compact: true },
];

/** Calculates workbench titlebar button placement without depending on a terminal or browser renderer. */
export function layoutWorkbenchTitlebar(options: WorkbenchTitlebarLayoutOptions): WorkbenchTitlebarLayout {
  const controlsMinWidth = options.controlsMinWidth ?? 22;
  const configLabel = options.configLabel ?? "config";
  let buttons: WorkbenchTitlebarButton[] = [];
  const row = options.rect.row;
  const rightBorderColumn = options.rect.column + options.rect.width - 1;
  const hasWindowControls = options.rect.width >= controlsMinWidth;
  let leftmostControlColumn = rightBorderColumn;

  if (hasWindowControls) {
    const controlButtons = new Array<WorkbenchTitlebarButton>(WINDOW_CONTROL_SPECS.length);
    let cursor = rightBorderColumn;
    for (let index = 0; index < WINDOW_CONTROL_SPECS.length; index += 1) {
      const spec = WINDOW_CONTROL_SPECS[index]!;
      const width = textWidth(buttonText(spec.label, { compact: spec.compact }));
      const column = cursor - width;
      controlButtons[WINDOW_CONTROL_SPECS.length - index - 1] = { ...spec, rect: { column, row, width, height: 1 } };
      leftmostControlColumn = column;
      cursor = column - 1;
    }
    buttons = controlButtons;
  }

  const configWidth = textWidth(buttonText(configLabel));
  const configColumn = leftmostControlColumn - configWidth - 1;
  const titleEnd = options.rect.column + textWidth(options.title) + 3;
  if (options.showConfig && configColumn > titleEnd) {
    const configButton: WorkbenchTitlebarButton = {
      kind: "config",
      label: configLabel,
      tone: "default",
      compact: false,
      rect: { column: configColumn, row, width: configWidth, height: 1 },
    };
    buttons = hasWindowControls ? [configButton, ...buttons] : [configButton];
  }

  return {
    buttons,
    hasWindowControls,
  };
}
