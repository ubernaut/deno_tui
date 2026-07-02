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

/** Creates caller-owned storage for repeated titlebar layout projections. */
export function createWorkbenchTitlebarLayout(): WorkbenchTitlebarLayout {
  return { buttons: [], hasWindowControls: false };
}

/** Calculates workbench titlebar button placement without depending on a terminal or browser renderer. */
export function layoutWorkbenchTitlebar(options: WorkbenchTitlebarLayoutOptions): WorkbenchTitlebarLayout {
  return layoutWorkbenchTitlebarInto(createWorkbenchTitlebarLayout(), options);
}

/** Calculates workbench titlebar button placement into caller-owned storage. */
export function layoutWorkbenchTitlebarInto(
  target: WorkbenchTitlebarLayout,
  options: WorkbenchTitlebarLayoutOptions,
): WorkbenchTitlebarLayout {
  const controlsMinWidth = options.controlsMinWidth ?? 22;
  const configLabel = options.configLabel ?? "config";
  const buttons = target.buttons;
  let buttonCount = 0;
  const row = options.rect.row;
  const rightBorderColumn = options.rect.column + options.rect.width - 1;
  const hasWindowControls = options.rect.width >= controlsMinWidth;
  target.hasWindowControls = hasWindowControls;
  let leftmostControlColumn = rightBorderColumn;

  if (hasWindowControls) {
    let cursor = rightBorderColumn;
    for (let index = 0; index < WINDOW_CONTROL_SPECS.length; index += 1) {
      const spec = WINDOW_CONTROL_SPECS[index]!;
      const width = textWidth(buttonText(spec.label, { compact: spec.compact }));
      const column = cursor - width;
      writeTitlebarButton(buttons, WINDOW_CONTROL_SPECS.length - index - 1, spec, column, row, width);
      leftmostControlColumn = column;
      cursor = column - 1;
    }
    buttonCount = WINDOW_CONTROL_SPECS.length;
  }

  const configWidth = textWidth(buttonText(configLabel));
  const configColumn = leftmostControlColumn - configWidth - 1;
  const titleEnd = options.rect.column + textWidth(options.title) + 3;
  if (options.showConfig && configColumn > titleEnd) {
    if (hasWindowControls) {
      for (let index = buttonCount; index > 0; index -= 1) {
        buttons[index] = buttons[index - 1]!;
      }
      writeTitlebarButton(
        buttons,
        0,
        { kind: "config", label: configLabel, tone: "default", compact: false },
        configColumn,
        row,
        configWidth,
      );
      buttonCount += 1;
    } else {
      writeTitlebarButton(
        buttons,
        0,
        { kind: "config", label: configLabel, tone: "default", compact: false },
        configColumn,
        row,
        configWidth,
      );
      buttonCount = 1;
    }
  }
  buttons.length = buttonCount;

  return target;
}

function writeTitlebarButton(
  buttons: WorkbenchTitlebarButton[],
  index: number,
  spec: Omit<WorkbenchTitlebarButton, "rect">,
  column: number,
  row: number,
  width: number,
): void {
  const button = buttons[index] ?? {
    kind: spec.kind,
    label: spec.label,
    tone: spec.tone,
    compact: spec.compact,
    rect: { column, row, width, height: 1 },
  };
  button.kind = spec.kind;
  button.label = spec.label;
  button.tone = spec.tone;
  button.compact = spec.compact;
  button.rect.column = column;
  button.rect.row = row;
  button.rect.width = width;
  button.rect.height = 1;
  buttons[index] = button;
}
