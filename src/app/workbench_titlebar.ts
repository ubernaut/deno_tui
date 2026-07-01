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

/** Calculates workbench titlebar button placement without depending on a terminal or browser renderer. */
export function layoutWorkbenchTitlebar(options: WorkbenchTitlebarLayoutOptions): WorkbenchTitlebarLayout {
  const controlsMinWidth = options.controlsMinWidth ?? 22;
  const configLabel = options.configLabel ?? "config";
  const buttons: WorkbenchTitlebarButton[] = [];
  const row = options.rect.row;
  const rightBorderColumn = options.rect.column + options.rect.width - 1;
  const hasWindowControls = options.rect.width >= controlsMinWidth;
  let leftmostControlColumn = rightBorderColumn;

  if (hasWindowControls) {
    const specs: Array<Omit<WorkbenchTitlebarButton, "rect">> = [
      { kind: "close", label: "x", tone: "danger", compact: true },
      { kind: "restore", label: "↺", tone: "muted", compact: true },
      { kind: "maximize", label: "□", tone: "success", compact: true },
      { kind: "minimize", label: "-", tone: "warning", compact: true },
    ];
    let cursor = rightBorderColumn;
    for (const spec of specs) {
      const width = textWidth(buttonText(spec.label, { compact: spec.compact }));
      const column = cursor - width;
      buttons.push({ ...spec, rect: { column, row, width, height: 1 } });
      leftmostControlColumn = column;
      cursor = column - 1;
    }
  }

  const configWidth = textWidth(buttonText(configLabel));
  const configColumn = leftmostControlColumn - configWidth - 1;
  const titleEnd = options.rect.column + textWidth(options.title) + 3;
  if (options.showConfig && configColumn > titleEnd) {
    buttons.push({
      kind: "config",
      label: configLabel,
      tone: "default",
      compact: false,
      rect: { column: configColumn, row, width: configWidth, height: 1 },
    });
  }

  return {
    buttons: buttons.sort((left, right) => left.rect.column - right.rect.column),
    hasWindowControls,
  };
}
