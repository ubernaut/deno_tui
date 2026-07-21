// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { setRectangle } from "../utils/rectangles.ts";
import { buttonText, fitCellText } from "./workbench_frame.ts";
import { textWidth } from "../utils/strings.ts";

/** Button action kinds exposed by workbench titlebars. */
export type WorkbenchTitlebarButtonKind =
  | "minimize"
  | "maximize"
  | "restore"
  | "close"
  | "always-on-top"
  | "config";

/** Tone hint for workbench titlebar button rendering. */
export type WorkbenchTitlebarButtonTone = "default" | "muted" | "warning" | "success" | "danger";

/** Renderer-neutral titlebar button geometry and display metadata. */
export interface WorkbenchTitlebarButton {
  kind: WorkbenchTitlebarButtonKind;
  label: string;
  /** Human-readable action name for semantic renderers, tooltips, and assistive technology. */
  accessibilityLabel: string;
  /** Keyboard equivalent advertised by hosts that expose shortcut metadata. */
  shortcut?: string;
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
  configAccessibilityLabel?: string;
  configShortcut?: string;
  /** Selects one state-aware maximize/restore control. Omit to retain the legacy four-control layout. */
  maximized?: boolean;
  /** Adds a state-aware pin control without changing legacy titlebars that omit this option. */
  alwaysOnTop?: boolean;
}

/** Renderer-neutral titlebar layout result. */
export interface WorkbenchTitlebarLayout {
  buttons: WorkbenchTitlebarButton[];
  hasWindowControls: boolean;
}

/** Renderer-neutral paint and hit command for one workbench titlebar button. */
export interface WorkbenchTitlebarButtonRenderCommand {
  button: WorkbenchTitlebarButton;
  kind: WorkbenchTitlebarButtonKind;
  label: string;
  accessibilityLabel: string;
  shortcut?: string;
  text: string;
  rect: Rectangle;
  hitRect: Rectangle;
  tone: WorkbenchTitlebarButtonTone;
  compact: boolean;
}

type WorkbenchTitlebarButtonSpec = Omit<WorkbenchTitlebarButton, "rect">;

const CLOSE_CONTROL_SPEC: WorkbenchTitlebarButtonSpec = {
  kind: "close",
  label: "x",
  accessibilityLabel: "Close window",
  shortcut: "C",
  tone: "danger",
  compact: true,
};
const RESTORE_CONTROL_SPEC: WorkbenchTitlebarButtonSpec = {
  kind: "restore",
  label: "R",
  accessibilityLabel: "Restore window",
  shortcut: "R",
  tone: "muted",
  compact: true,
};
const MAXIMIZE_CONTROL_SPEC: WorkbenchTitlebarButtonSpec = {
  kind: "maximize",
  label: "M",
  accessibilityLabel: "Maximize window",
  shortcut: "F",
  tone: "success",
  compact: true,
};
const MINIMIZE_CONTROL_SPEC: WorkbenchTitlebarButtonSpec = {
  kind: "minimize",
  label: "-",
  accessibilityLabel: "Minimize window",
  shortcut: "M",
  tone: "warning",
  compact: true,
};

const PIN_CONTROL_SPEC: WorkbenchTitlebarButtonSpec = {
  kind: "always-on-top",
  label: "^",
  accessibilityLabel: "Keep window always on top",
  shortcut: "P",
  tone: "default",
  compact: true,
};

const UNPIN_CONTROL_SPEC: WorkbenchTitlebarButtonSpec = {
  kind: "always-on-top",
  label: "v",
  accessibilityLabel: "Return window to normal stacking",
  shortcut: "P",
  tone: "success",
  compact: true,
};

// Specs are ordered from the right edge toward the title; layout output is reversed into visual order.
const LEGACY_WINDOW_CONTROL_SPECS: readonly WorkbenchTitlebarButtonSpec[] = [
  CLOSE_CONTROL_SPEC,
  RESTORE_CONTROL_SPEC,
  MAXIMIZE_CONTROL_SPEC,
  MINIMIZE_CONTROL_SPEC,
];
const NORMAL_WINDOW_CONTROL_SPECS: readonly WorkbenchTitlebarButtonSpec[] = [
  CLOSE_CONTROL_SPEC,
  MAXIMIZE_CONTROL_SPEC,
  MINIMIZE_CONTROL_SPEC,
];
const MAXIMIZED_WINDOW_CONTROL_SPECS: readonly WorkbenchTitlebarButtonSpec[] = [
  CLOSE_CONTROL_SPEC,
  RESTORE_CONTROL_SPEC,
  MINIMIZE_CONTROL_SPEC,
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
  const baseWindowControlSpecs = options.maximized === undefined
    ? LEGACY_WINDOW_CONTROL_SPECS
    : options.maximized
    ? MAXIMIZED_WINDOW_CONTROL_SPECS
    : NORMAL_WINDOW_CONTROL_SPECS;
  const windowControlSpecs = options.alwaysOnTop === undefined ? baseWindowControlSpecs : [
    ...baseWindowControlSpecs.slice(0, baseWindowControlSpecs.length - 1),
    options.alwaysOnTop ? UNPIN_CONTROL_SPEC : PIN_CONTROL_SPEC,
    baseWindowControlSpecs[baseWindowControlSpecs.length - 1]!,
  ];
  const controlsMinWidth = options.controlsMinWidth ?? windowControlSpecs.length * 4;
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
    for (let index = 0; index < windowControlSpecs.length; index += 1) {
      const spec = windowControlSpecs[index]!;
      const width = textWidth(buttonText(spec.label, { compact: spec.compact }));
      const column = cursor - width;
      writeTitlebarButton(buttons, windowControlSpecs.length - index - 1, spec, column, row, width);
      leftmostControlColumn = column;
      cursor = column - 1;
    }
    buttonCount = windowControlSpecs.length;
  }

  const configWidth = textWidth(buttonText(configLabel));
  const configColumn = leftmostControlColumn - configWidth - 1;
  const titleEnd = options.rect.column + textWidth(options.title) + 3;
  if (options.showConfig && configColumn > titleEnd) {
    if (hasWindowControls) {
      for (let index = buttonCount; index > 0; index -= 1) {
        buttons[index] = buttons[index - 1]!;
      }
      buttons[0] = createTitlebarButton(
        {
          kind: "config",
          label: configLabel,
          accessibilityLabel: options.configAccessibilityLabel ?? "Configure renderer",
          shortcut: options.configShortcut ?? "G",
          tone: "default",
          compact: false,
        },
        configColumn,
        row,
        configWidth,
      );
      buttonCount += 1;
    } else {
      writeTitlebarButton(
        buttons,
        0,
        {
          kind: "config",
          label: configLabel,
          accessibilityLabel: options.configAccessibilityLabel ?? "Configure renderer",
          shortcut: options.configShortcut ?? "G",
          tone: "default",
          compact: false,
        },
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

/** Projects titlebar button layout into clipped renderer-neutral paint and hit commands. */
export function workbenchTitlebarButtonRenderCommandsInto(
  target: WorkbenchTitlebarButtonRenderCommand[],
  layout: WorkbenchTitlebarLayout,
): WorkbenchTitlebarButtonRenderCommand[] {
  let written = 0;
  for (let index = 0; index < layout.buttons.length; index += 1) {
    const button = layout.buttons[index]!;
    const text = buttonText(button.label, { compact: button.compact });
    const width = Math.max(0, Math.min(textWidth(text), button.rect.width));
    if (width <= 0) continue;
    const command = target[written] ?? {
      button,
      kind: button.kind,
      label: "",
      accessibilityLabel: "",
      shortcut: undefined,
      text: "",
      rect: { column: 0, row: 0, width: 0, height: 1 },
      hitRect: { column: 0, row: 0, width: 0, height: 1 },
      tone: button.tone,
      compact: button.compact,
    };
    command.button = button;
    command.kind = button.kind;
    command.label = button.label;
    command.accessibilityLabel = button.accessibilityLabel;
    command.shortcut = button.shortcut;
    command.text = fitCellText(text, width);
    command.tone = button.tone;
    command.compact = button.compact;
    setRectangle(command.rect, button.rect.column, button.rect.row, width, 1);
    setRectangle(command.hitRect, button.rect.column, button.rect.row, width, 1);
    target[written] = command;
    written += 1;
  }
  target.length = written;
  return target;
}

function writeTitlebarButton(
  buttons: WorkbenchTitlebarButton[],
  index: number,
  spec: WorkbenchTitlebarButtonSpec,
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
  button.accessibilityLabel = spec.accessibilityLabel;
  button.shortcut = spec.shortcut;
  button.tone = spec.tone;
  button.compact = spec.compact;
  button.rect.column = column;
  button.rect.row = row;
  button.rect.width = width;
  button.rect.height = 1;
  buttons[index] = button;
}

function createTitlebarButton(
  spec: WorkbenchTitlebarButtonSpec,
  column: number,
  row: number,
  width: number,
): WorkbenchTitlebarButton {
  return {
    kind: spec.kind,
    label: spec.label,
    accessibilityLabel: spec.accessibilityLabel,
    shortcut: spec.shortcut,
    tone: spec.tone,
    compact: spec.compact,
    rect: { column, row, width, height: 1 },
  };
}
