import { renderCheckBoxMark } from "../src/components/checkbox.ts";
import type { DataColumn } from "../src/components/data_table.ts";
import { renderStepper, type StepperStep } from "../src/components/stepper.ts";
import type { CursorPosition, TextBoxVisualLine } from "../src/components/textbox.ts";
import { wrapTextBoxLinesInto } from "../src/components/textbox.ts";
import { layoutWrappedControlOptions } from "../src/app/workbench_control_layout.ts";
import { buttonText, fitCellText } from "../src/app/workbench_frame.ts";
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";
import {
  type ApiWorkbenchControlHitAction,
  type ApiWorkbenchControlHitPlacement,
  type ApiWorkbenchControlId,
} from "./api_workbench_control_base.ts";
import type { ApiWorkbenchControlLineOptions } from "./api_workbench_control_line.ts";
import type { ApiWorkbenchControlTrack } from "./api_workbench_control_slider.ts";

export {
  apiWorkbenchControlAt,
  apiWorkbenchControlAtEdge,
  type ApiWorkbenchControlHitAction,
  type ApiWorkbenchControlHitPlacement,
  type ApiWorkbenchControlId,
  apiWorkbenchControlIds,
  isApiWorkbenchTextControlActive,
  nextApiWorkbenchControlId,
} from "./api_workbench_control_base.ts";
export {
  apiWorkbenchControlLineInto,
  type ApiWorkbenchControlLineOptions,
  type ApiWorkbenchControlLineRenderCommand,
  apiWorkbenchControlLineRenderCommandsInto,
  type ApiWorkbenchControlLineRenderRole,
  type ApiWorkbenchControlLineSegment,
  type ApiWorkbenchControlLineSegmentKind,
} from "./api_workbench_control_line.ts";
export {
  type ApiWorkbenchControlTrack,
  apiWorkbenchControlTrack,
  type ApiWorkbenchControlTrackOptions,
  apiWorkbenchSliderSetHit,
  apiWorkbenchSliderSetHitInto,
} from "./api_workbench_control_slider.ts";

export interface ApiWorkbenchControlKeyEvent {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export type ApiWorkbenchControlKeyResolution =
  | { type: "textInput" }
  | { type: "focus"; delta: number }
  | { type: "control"; action: Extract<ApiWorkbenchControlHitAction, "previous" | "next" | "activate"> }
  | { type: "radio"; delta: number }
  | { type: "dropdown"; action: "move"; delta: number }
  | { type: "dropdown"; action: "first" | "last" | "close" | "select" }
  | { type: "none" };

export interface ResolveApiWorkbenchControlKeyOptions {
  dropdownExpanded?: boolean;
}

export function resolveApiWorkbenchControlKey(
  id: ApiWorkbenchControlId,
  event: ApiWorkbenchControlKeyEvent,
  options: ResolveApiWorkbenchControlKeyOptions = {},
): ApiWorkbenchControlKeyResolution {
  if (id === "input" || id === "textbox") return { type: "textInput" };
  if (id === "dropdown" && options.dropdownExpanded) {
    if (event.key === "up") return { type: "dropdown", action: "move", delta: -1 };
    if (event.key === "down") return { type: "dropdown", action: "move", delta: 1 };
    if (event.key === "home") return { type: "dropdown", action: "first" };
    if (event.key === "end") return { type: "dropdown", action: "last" };
    if (event.key === "escape") return { type: "dropdown", action: "close" };
    if (event.key === "return" || event.key === "space") return { type: "dropdown", action: "select" };
    if (event.key === "left") return { type: "control", action: "previous" };
    if (event.key === "right") return { type: "control", action: "next" };
    return { type: "none" };
  }
  if (id === "radio" && (event.key === "up" || event.key === "down")) {
    return { type: "radio", delta: event.key === "up" ? -1 : 1 };
  }
  if (event.key === "up") return { type: "focus", delta: -1 };
  if (event.key === "down") return { type: "focus", delta: 1 };
  if (event.key === "left") return { type: "control", action: "previous" };
  if (event.key === "right") return { type: "control", action: "next" };
  if (event.key === "space" || event.key === "return") return { type: "control", action: "activate" };
  return { type: "none" };
}

export interface ApiWorkbenchControlStyleTheme {
  background: string;
  text: string;
  surface: string;
  warn: string;
}

export interface ApiWorkbenchControlPaintStyle {
  fg: string;
  bg: string;
  bold: boolean;
}

export type ApiWorkbenchControlLineStyleRole = "base" | "button" | "detail";

export interface ApiWorkbenchTextboxStyleCommand {
  role: "label" | "body";
  header: boolean;
}

export function apiWorkbenchControlBaseStyle(
  theme: ApiWorkbenchControlStyleTheme,
  active: boolean,
): ApiWorkbenchControlPaintStyle {
  return {
    fg: active ? theme.background : theme.text,
    bg: active ? theme.warn : theme.surface,
    bold: active,
  };
}

export function apiWorkbenchControlButtonDetailStyle(
  theme: ApiWorkbenchControlStyleTheme,
  active: boolean,
): ApiWorkbenchControlPaintStyle {
  return {
    fg: active ? theme.warn : theme.text,
    bg: theme.surface,
    bold: active,
  };
}

export function apiWorkbenchControlLineFallbackStyle(
  theme: ApiWorkbenchControlStyleTheme,
  role: ApiWorkbenchControlLineStyleRole,
  active: boolean,
): ApiWorkbenchControlPaintStyle {
  return role === "detail"
    ? apiWorkbenchControlButtonDetailStyle(theme, active)
    : apiWorkbenchControlBaseStyle(theme, active);
}

export function apiWorkbenchTextboxCommandStyle(
  theme: ApiWorkbenchControlStyleTheme,
  command: ApiWorkbenchTextboxStyleCommand,
  active: boolean,
): ApiWorkbenchControlPaintStyle {
  const highlighted = active && (command.role === "body" || command.header);
  return {
    fg: highlighted ? theme.background : theme.text,
    bg: highlighted ? theme.warn : theme.surface,
    bold: highlighted,
  };
}

export function apiWorkbenchWrappedOptionStyle(
  theme: ApiWorkbenchControlStyleTheme,
  active: boolean,
): ApiWorkbenchControlPaintStyle {
  return apiWorkbenchControlBaseStyle(theme, active);
}

export interface ApiWorkbenchDropdownPopoverOptions {
  rect: Rectangle;
  row: number;
  items: readonly string[];
  label?: string;
  minContentWidth?: number;
  horizontalInset?: number;
  padding?: number;
}

export function apiWorkbenchDropdownPopoverRect(
  options: ApiWorkbenchDropdownPopoverOptions,
): Rectangle {
  const rect = options.rect;
  const horizontalInset = Math.max(0, Math.floor(options.horizontalInset ?? 2));
  const padding = Math.max(0, Math.floor(options.padding ?? 6));
  const minContentWidth = Math.max(1, Math.floor(options.minContentWidth ?? 12));
  const maxWidth = Math.max(1, Math.floor(rect.width) - (horizontalInset * 2));
  const contentWidth = Math.max(
    minContentWidth,
    maxItemTextWidth(options.items),
    textWidth(options.label ?? ""),
  );
  const width = Math.max(1, Math.min(Math.max(16, contentWidth + padding), Math.max(16, maxWidth)));
  return {
    column: rect.column + horizontalInset,
    row: options.row,
    width,
    height: Math.max(2, options.items.length + 2),
  };
}

export interface ApiWorkbenchStepperHitStep {
  label: string;
  disabled?: boolean;
  completed?: boolean;
}

export function apiWorkbenchStepperHitPlacementsInto(
  target: ApiWorkbenchControlHitPlacement[],
  steps: readonly ApiWorkbenchStepperHitStep[],
  activeIndex: number,
  rect: Rectangle,
  row: number,
  options: { columnOffset?: number; gap?: number } = {},
): ApiWorkbenchControlHitPlacement[] {
  const columnOffset = Math.max(0, Math.floor(options.columnOffset ?? 12));
  const gap = Math.max(0, Math.floor(options.gap ?? 3));
  const endColumn = rect.column + rect.width;
  let column = rect.column + columnOffset;
  let written = 0;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!;
    const label = step.disabled ? `(${step.label})` : step.completed ? `✓ ${step.label}` : step.label;
    const token = index === activeIndex ? `[${label}]` : label;
    const width = textWidth(token);
    if (column + width > endColumn) break;
    const placement = target[written] ?? {
      column: 0,
      row: 0,
      width: 0,
      height: 1,
      id: "stepper",
      action: "activate",
    };
    placement.column = column;
    placement.row = row;
    placement.width = width;
    placement.height = 1;
    placement.id = "stepper";
    placement.action = "activate";
    placement.index = index;
    target[written] = placement;
    written += 1;
    column += width + gap;
  }
  target.length = written;
  return target;
}

export function nextSortableDataColumn<TRow extends Record<string, unknown>>(
  columns: readonly DataColumn<TRow>[],
  currentColumnId: string | undefined,
  delta: number,
): DataColumn<TRow> | undefined {
  let sortableCount = 0;
  let currentSortableIndex = -1;
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]!;
    if (column.sortable === false) continue;
    if (column.id === currentColumnId) currentSortableIndex = sortableCount;
    sortableCount += 1;
  }
  if (sortableCount === 0) return undefined;

  let targetSortableIndex = currentSortableIndex < 0 ? 0 : currentSortableIndex;
  targetSortableIndex = ((targetSortableIndex + delta) % sortableCount + sortableCount) % sortableCount;

  let sortableIndex = 0;
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]!;
    if (column.sortable === false) continue;
    if (sortableIndex === targetSortableIndex) return column;
    sortableIndex += 1;
  }
  return undefined;
}

export interface ApiWorkbenchTextboxProjectionOptions {
  rect: Rectangle;
  row: number;
  lines: readonly string[];
  visualLines?: TextBoxVisualLine[];
  cursor: CursorPosition;
  active: boolean;
  maxHeight?: number;
  minHeight?: number;
  labelMaxWidth?: number;
  labelReserveWidth?: number;
  wordWrap?: boolean;
}

export interface ApiWorkbenchTextboxProjectionRow {
  row: number;
  labelColumn: number;
  labelWidth: number;
  labelText: string;
  bodyColumn: number;
  bodyWidth: number;
  bodyText: string;
  visualLine: TextBoxVisualLine;
  cursor: boolean;
  continuation: boolean;
  active: boolean;
  header: boolean;
}

export interface ApiWorkbenchTextboxProjection {
  rows: ApiWorkbenchTextboxProjectionRow[];
  hit: ApiWorkbenchControlHitPlacement;
  nextRow: number;
  height: number;
  startVisualRow: number;
}

export type ApiWorkbenchTextboxRenderRole = "label" | "body";

export interface ApiWorkbenchTextboxRenderCommand {
  role: ApiWorkbenchTextboxRenderRole;
  text: string;
  column: number;
  row: number;
  width: number;
  active: boolean;
  header: boolean;
}

export interface ApiWorkbenchTextboxRenderOptions {
  cursorGlyph?: string;
  continuationGlyph?: string;
}

export function apiWorkbenchTextboxProjection(
  options: ApiWorkbenchTextboxProjectionOptions,
): ApiWorkbenchTextboxProjection {
  return apiWorkbenchTextboxProjectionInto([], options);
}

export function apiWorkbenchTextboxProjectionInto(
  rows: ApiWorkbenchTextboxProjectionRow[],
  options: ApiWorkbenchTextboxProjectionOptions,
): ApiWorkbenchTextboxProjection {
  const rect = options.rect;
  const bottom = rect.row + Math.max(0, rect.height);
  const row = Math.floor(options.row);
  if (row >= bottom || rect.width <= 0) {
    rows.length = 0;
    return {
      rows,
      hit: { column: rect.column, row, width: Math.max(0, rect.width), height: 0, id: "textbox", action: "focus" },
      nextRow: row,
      height: 0,
      startVisualRow: 0,
    };
  }

  const minHeight = Math.max(1, Math.floor(options.minHeight ?? 2));
  const maxHeight = Math.max(minHeight, Math.floor(options.maxHeight ?? 5));
  const height = Math.min(maxHeight, Math.max(minHeight, bottom - row));
  const labelReserveWidth = Math.max(0, Math.floor(options.labelReserveWidth ?? 12));
  const labelWidth = Math.min(
    Math.max(0, Math.floor(options.labelMaxWidth ?? 10)),
    Math.max(0, rect.width - labelReserveWidth),
  );
  const bodyColumn = rect.column + labelWidth;
  const bodyWidth = Math.max(1, rect.width - labelWidth);
  const visualLines = wrapTextBoxLinesInto(options.visualLines ?? [], options.lines, bodyWidth - 2, {
    wordWrap: options.wordWrap ?? true,
  });
  let cursorRow = -1;
  for (let index = 0; index < visualLines.length; index += 1) {
    const line = visualLines[index]!;
    if (
      line.lineIndex === options.cursor.y && options.cursor.x >= line.startColumn &&
      options.cursor.x <= line.endColumn
    ) {
      cursorRow = index;
      break;
    }
  }
  const startVisualRow = Math.max(
    0,
    Math.min(Math.max(0, cursorRow - height + 1), Math.max(0, visualLines.length - height)),
  );
  for (let offset = 0; offset < height; offset += 1) {
    const visualLine = visualLines[startVisualRow + offset] ?? {
      text: "",
      lineIndex: 0,
      startColumn: 0,
      endColumn: 0,
      continuation: false,
    };
    const cursor = options.active && visualLine.lineIndex === options.cursor.y &&
      options.cursor.x >= visualLine.startColumn && options.cursor.x <= visualLine.endColumn;
    const target = rows[offset] ??= {
      row: 0,
      labelColumn: 0,
      labelWidth: 0,
      labelText: "",
      bodyColumn: 0,
      bodyWidth: 0,
      bodyText: "",
      visualLine,
      cursor: false,
      continuation: false,
      active: false,
      header: false,
    };
    target.row = row + offset;
    target.labelColumn = rect.column;
    target.labelWidth = labelWidth;
    target.labelText = offset === 0 ? `${options.active ? ">" : " "} TextBox` : " ".repeat(Math.max(0, labelWidth));
    target.bodyColumn = bodyColumn;
    target.bodyWidth = bodyWidth;
    target.bodyText = visualLine.text;
    target.visualLine = visualLine;
    target.cursor = cursor;
    target.continuation = visualLine.continuation;
    target.active = options.active;
    target.header = offset === 0;
  }
  rows.length = height;

  return {
    rows,
    hit: { column: rect.column, row, width: rect.width, height, id: "textbox", action: "focus" },
    nextRow: row + height,
    height,
    startVisualRow,
  };
}

export function apiWorkbenchTextboxRenderCommandsInto(
  target: ApiWorkbenchTextboxRenderCommand[],
  rows: readonly ApiWorkbenchTextboxProjectionRow[],
  options: ApiWorkbenchTextboxRenderOptions = {},
): ApiWorkbenchTextboxRenderCommand[] {
  const cursorGlyph = options.cursorGlyph ?? "▌";
  const continuationGlyph = options.continuationGlyph ?? "↳";
  let written = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    writeTextboxRenderCommand(target, written++, {
      role: "label",
      text: fitCellText(row.labelText, row.labelWidth),
      column: row.labelColumn,
      row: row.row,
      width: row.labelWidth,
      active: row.active,
      header: row.header,
    });
    writeTextboxRenderCommand(target, written++, {
      role: "body",
      text: fitCellText(
        `${row.continuation ? continuationGlyph : " "}${row.bodyText}${row.cursor ? cursorGlyph : " "}`,
        row.bodyWidth,
      ),
      column: row.bodyColumn,
      row: row.row,
      width: row.bodyWidth,
      active: row.active,
      header: row.header,
    });
  }
  target.length = written;
  return target;
}

export interface ApiWorkbenchOptionControlRow {
  id: Extract<ApiWorkbenchControlId, "checkbox" | "radio">;
  value: string;
  options?: ApiWorkbenchControlLineOptions;
}

export interface ApiWorkbenchProjectedControlRow {
  id: ApiWorkbenchControlId;
  value: string;
  options?: ApiWorkbenchControlLineOptions;
}

export interface ApiWorkbenchCheckboxOption {
  label: string;
  checked: boolean;
}

export interface ApiWorkbenchRadioOption {
  label: string;
  selected: boolean;
}

export interface ApiWorkbenchRadioSourceOption<Value extends string = string> {
  label: string;
  value: Value;
}

export interface ApiWorkbenchComboHeaderRowsOptions {
  title: string;
  label: string;
  expanded: boolean;
  rectWidth: number;
  expandedGlyph?: string;
  collapsedGlyph?: string;
  splitMinWidth?: number;
  previous?: boolean;
  next?: boolean;
}

export interface ApiWorkbenchButtonRowOptions {
  id: Extract<ApiWorkbenchControlId, "button" | "genericButton" | "modal">;
  label: string;
  detail?: string;
  compact?: boolean;
  action?: ApiWorkbenchControlHitAction;
}

export interface ApiWorkbenchDropdownHeaderRowOptions {
  title: string;
  label: string;
  expanded: boolean;
  expandedGlyph?: string;
  collapsedGlyph?: string;
}

export interface ApiWorkbenchInputRowOptions {
  title: string;
  text: string;
  active: boolean;
  cursorGlyph?: string;
}

export interface ApiWorkbenchSliderRowOptions {
  track: Pick<ApiWorkbenchControlTrack, "text">;
  value: number;
  max: number;
  title?: string;
}

export interface ApiWorkbenchStepperRowOptions {
  steps: readonly StepperStep[];
  activeIndex: number;
  rectWidth: number;
  title?: string;
  columnReserveWidth?: number;
}

export interface ApiWorkbenchProgressRowOptions {
  track: Pick<ApiWorkbenchControlTrack, "text">;
  value: number;
  suffix?: string;
  title?: string;
}

export interface ApiWorkbenchControlsRowsOptions {
  buttonPressCount: number;
  genericButtonPressCount: number;
  modalOpen: boolean;
  slider: ApiWorkbenchSliderRowOptions;
  checkboxes: readonly ApiWorkbenchCheckboxOption[];
  radio: {
    items: readonly ApiWorkbenchRadioOption[];
    activeIndex: number;
  };
  combo: ApiWorkbenchComboHeaderRowsOptions;
  dropdown: ApiWorkbenchDropdownHeaderRowOptions;
  input: ApiWorkbenchInputRowOptions;
  stepper: ApiWorkbenchStepperRowOptions;
  progress: ApiWorkbenchProgressRowOptions;
}

export interface ApiWorkbenchControlsSnapshotBuffers {
  checkboxes: ApiWorkbenchCheckboxOption[];
  radio: ApiWorkbenchRadioOption[];
}

export interface ApiWorkbenchControlsSnapshotOptions<Value extends string = string>
  extends Omit<ApiWorkbenchControlsRowsOptions, "checkboxes" | "radio"> {
  checkboxLivePreview: boolean;
  checkboxCompactRows: boolean;
  radioOptions: readonly ApiWorkbenchRadioSourceOption<Value>[];
  radioSelectedValue: Value | undefined;
  radioActiveIndex: number;
  buffers: ApiWorkbenchControlsSnapshotBuffers;
}

export function apiWorkbenchCheckboxRowsInto(
  target: ApiWorkbenchOptionControlRow[],
  items: readonly ApiWorkbenchCheckboxOption[],
  options: { header?: string } = {},
): ApiWorkbenchOptionControlRow[] {
  const written = appendCheckboxRows(target, 0, items, options.header ?? "Checkboxes", writeOptionControlRow);
  target.length = written;
  return target;
}

export function apiWorkbenchRadioRowsInto(
  target: ApiWorkbenchOptionControlRow[],
  items: readonly ApiWorkbenchRadioOption[],
  activeIndex: number,
  options: { header?: string } = {},
): ApiWorkbenchOptionControlRow[] {
  const written = appendRadioRows(target, 0, items, activeIndex, options.header ?? "Radio", writeOptionControlRow);
  target.length = written;
  return target;
}

export function apiWorkbenchComboHeaderRowsInto(
  target: ApiWorkbenchProjectedControlRow[],
  options: ApiWorkbenchComboHeaderRowsOptions,
): ApiWorkbenchProjectedControlRow[] {
  const written = appendComboHeaderRows(target, 0, options);
  target.length = written;
  return target;
}

export function apiWorkbenchButtonRowInto(
  target: ApiWorkbenchProjectedControlRow | undefined,
  options: ApiWorkbenchButtonRowOptions,
): ApiWorkbenchProjectedControlRow {
  const detail = options.detail ? ` ${options.detail}` : "";
  return writeProjectedControlRow(
    target,
    options.id,
    `${buttonText(options.label, { compact: options.compact })}${detail}`,
    { button: true, action: options.action },
  );
}

export function apiWorkbenchDropdownHeaderRowInto(
  target: ApiWorkbenchProjectedControlRow | undefined,
  options: ApiWorkbenchDropdownHeaderRowOptions,
): ApiWorkbenchProjectedControlRow {
  const expandedGlyph = options.expandedGlyph ?? "▾";
  const collapsedGlyph = options.collapsedGlyph ?? "▸";
  return writeProjectedControlRow(
    target,
    "dropdown",
    `${options.title}  ${options.expanded ? expandedGlyph : collapsedGlyph} ${options.label}`,
    { action: "toggle" },
  );
}

export function apiWorkbenchInputRowInto(
  target: ApiWorkbenchProjectedControlRow | undefined,
  options: ApiWorkbenchInputRowOptions,
): ApiWorkbenchProjectedControlRow {
  return writeProjectedControlRow(
    target,
    "input",
    `${options.title}     ${options.text}${options.active ? options.cursorGlyph ?? "▌" : ""}`,
    { action: "focus" },
  );
}

export function apiWorkbenchSliderRowInto(
  target: ApiWorkbenchProjectedControlRow | undefined,
  options: ApiWorkbenchSliderRowOptions,
): ApiWorkbenchProjectedControlRow {
  return writeProjectedControlRow(
    target,
    "slider",
    `${options.title ?? "Slider"}    ${options.track.text} ${options.value}/${options.max}`,
    { previous: true, next: true },
  );
}

export function apiWorkbenchStepperRowInto(
  target: ApiWorkbenchProjectedControlRow | undefined,
  options: ApiWorkbenchStepperRowOptions,
): ApiWorkbenchProjectedControlRow {
  const reserve = Math.max(0, Math.floor(options.columnReserveWidth ?? 12));
  const stepWidth = Math.max(8, Math.floor(options.rectWidth) - reserve);
  return writeProjectedControlRow(
    target,
    "stepper",
    `${options.title ?? "Stepper"}   ${
      renderStepper(options.steps, options.activeIndex, "horizontal", stepWidth)[0] ?? ""
    }`,
    { previous: true, next: true },
  );
}

export function apiWorkbenchProgressRowInto(
  target: ApiWorkbenchProjectedControlRow | undefined,
  options: ApiWorkbenchProgressRowOptions,
): ApiWorkbenchProjectedControlRow {
  const suffix = options.suffix ?? "%";
  return writeProjectedControlRow(
    target,
    "slider",
    `${options.title ?? "Progress"}  ${options.track.text} ${options.value}${suffix}`,
  );
}

export function apiWorkbenchControlsRowsInto(
  target: ApiWorkbenchProjectedControlRow[],
  options: ApiWorkbenchControlsRowsOptions,
): ApiWorkbenchProjectedControlRow[] {
  let written = 0;
  target[written] = apiWorkbenchButtonRowInto(target[written], {
    id: "button",
    label: "Run Action",
    detail: `presses=${options.buttonPressCount}`,
  });
  written += 1;
  target[written] = apiWorkbenchButtonRowInto(target[written], {
    id: "genericButton",
    label: "Generic Button",
    detail: `presses=${options.genericButtonPressCount}`,
  });
  written += 1;
  target[written] = apiWorkbenchButtonRowInto(target[written], {
    id: "modal",
    label: "Open Modal",
    detail: `state=${options.modalOpen ? "open" : "closed"}`,
  });
  written += 1;
  target[written] = apiWorkbenchSliderRowInto(target[written], options.slider);
  written += 1;
  written = appendCheckboxRows(target, written, options.checkboxes, "Checkboxes", writeProjectedControlRow);
  written = appendRadioRows(
    target,
    written,
    options.radio.items,
    options.radio.activeIndex,
    "Radio",
    writeProjectedControlRow,
  );
  written = appendComboHeaderRows(target, written, options.combo);
  target[written] = apiWorkbenchDropdownHeaderRowInto(target[written], options.dropdown);
  written += 1;
  target[written] = apiWorkbenchInputRowInto(target[written], options.input);
  written += 1;
  target[written] = apiWorkbenchStepperRowInto(target[written], options.stepper);
  written += 1;
  target[written] = writeProjectedControlRow(target[written], "textbox", "TextBox", { action: "focus" });
  written += 1;
  target[written] = apiWorkbenchProgressRowInto(target[written], options.progress);
  written += 1;
  target.length = written;
  return target;
}

export function apiWorkbenchControlsSnapshotRowsInto<Value extends string = string>(
  target: ApiWorkbenchProjectedControlRow[],
  options: ApiWorkbenchControlsSnapshotOptions<Value>,
): ApiWorkbenchProjectedControlRow[] {
  const checkboxes = options.buffers.checkboxes;
  checkboxes[0] = { label: "live preview", checked: options.checkboxLivePreview };
  checkboxes[1] = { label: "compact rows", checked: options.checkboxCompactRows };
  checkboxes.length = 2;

  const radio = options.buffers.radio;
  for (let index = 0; index < options.radioOptions.length; index += 1) {
    const option = options.radioOptions[index]!;
    radio[index] = {
      label: option.label,
      selected: option.value === options.radioSelectedValue,
    };
  }
  radio.length = options.radioOptions.length;

  return apiWorkbenchControlsRowsInto(target, {
    buttonPressCount: options.buttonPressCount,
    genericButtonPressCount: options.genericButtonPressCount,
    modalOpen: options.modalOpen,
    slider: options.slider,
    checkboxes,
    radio: {
      items: radio,
      activeIndex: options.radioActiveIndex,
    },
    combo: options.combo,
    dropdown: options.dropdown,
    input: options.input,
    stepper: options.stepper,
    progress: options.progress,
  });
}

export interface ApiWorkbenchWrappedOptionsRenderCommand {
  text: string;
  column: number;
  row: number;
  width: number;
  active: boolean;
}

export interface ApiWorkbenchWrappedOptionsRenderOptions {
  rect: Rectangle;
  startRow: number;
  id: ApiWorkbenchControlId;
  items: readonly string[];
  selectedIndex: number | undefined;
  activeId: ApiWorkbenchControlId;
  minWidth?: number;
  horizontalInset?: number;
}

export function apiWorkbenchWrappedOptionsRenderCommandsInto(
  target: ApiWorkbenchWrappedOptionsRenderCommand[],
  hits: ApiWorkbenchControlHitPlacement[],
  options: ApiWorkbenchWrappedOptionsRenderOptions,
): ApiWorkbenchWrappedOptionsRenderCommand[] {
  const inset = Math.max(0, Math.floor(options.horizontalInset ?? 2));
  const width = Math.max(Math.max(1, Math.floor(options.minWidth ?? 8)), Math.floor(options.rect.width) - inset * 2);
  const rows = layoutWrappedControlOptions(options.items, options.selectedIndex, width);
  const bottom = options.rect.row + Math.max(0, Math.floor(options.rect.height));
  const column = options.rect.column + inset;
  const active = options.activeId === options.id;
  let written = 0;
  let hitCount = 0;
  for (let offset = 0; offset < rows.length; offset += 1) {
    const line = rows[offset]!;
    const row = Math.floor(options.startRow) + offset;
    if (row >= bottom || line.text.length === 0) break;
    writeWrappedOptionRenderCommand(target, written++, {
      text: fitCellText(line.text, width),
      column,
      row,
      width,
      active,
    });
    for (let index = 0; index < line.tokens.length; index += 1) {
      const token = line.tokens[index]!;
      writeControlHit(hits, hitCount++, {
        column: column + token.columnOffset,
        row,
        width: token.width,
        height: 1,
        id: options.id,
        action: "activate",
        index: token.index,
      });
    }
  }
  target.length = written;
  hits.length = hitCount;
  return target;
}

function writeWrappedOptionRenderCommand(
  target: ApiWorkbenchWrappedOptionsRenderCommand[],
  index: number,
  options: ApiWorkbenchWrappedOptionsRenderCommand,
): void {
  const command = target[index] ?? {
    text: "",
    column: 0,
    row: 0,
    width: 0,
    active: false,
  };
  command.text = options.text;
  command.column = options.column;
  command.row = options.row;
  command.width = options.width;
  command.active = options.active;
  target[index] = command;
}

function writeControlHit(
  target: ApiWorkbenchControlHitPlacement[],
  index: number,
  source: ApiWorkbenchControlHitPlacement,
): void {
  const hit = target[index] ?? {
    column: 0,
    row: 0,
    width: 0,
    height: 1,
    id: source.id,
    action: source.action,
  };
  hit.column = source.column;
  hit.row = source.row;
  hit.width = source.width;
  hit.height = source.height;
  hit.id = source.id;
  hit.action = source.action;
  hit.index = source.index;
  target[index] = hit;
}

function writeTextboxRenderCommand(
  target: ApiWorkbenchTextboxRenderCommand[],
  index: number,
  options: ApiWorkbenchTextboxRenderCommand,
): void {
  const command = target[index] ?? {
    role: "body",
    text: "",
    column: 0,
    row: 0,
    width: 0,
    active: false,
    header: false,
  };
  command.role = options.role;
  command.text = options.text;
  command.column = options.column;
  command.row = options.row;
  command.width = options.width;
  command.active = options.active;
  command.header = options.header;
  target[index] = command;
}

type OptionRowId = Extract<ApiWorkbenchControlId, "checkbox" | "radio">;
type ControlRowWriter<Row, Id extends ApiWorkbenchControlId = ApiWorkbenchControlId> = (
  target: Row | undefined,
  id: Id,
  value: string,
  options?: ApiWorkbenchControlLineOptions,
) => Row;

function appendCheckboxRows<Row>(
  target: Row[],
  start: number,
  items: readonly ApiWorkbenchCheckboxOption[],
  header: string,
  writeRow: ControlRowWriter<Row, "checkbox">,
): number {
  let written = start;
  target[written] = writeRow(target[written], "checkbox", header);
  written += 1;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    target[written] = writeRow(
      target[written],
      "checkbox",
      `${renderCheckBoxMark(item.checked)} ${item.label}`,
      { indent: true, index },
    );
    written += 1;
  }
  return written;
}

function appendRadioRows<Row>(
  target: Row[],
  start: number,
  items: readonly ApiWorkbenchRadioOption[],
  activeIndex: number,
  header: string,
  writeRow: ControlRowWriter<Row, "radio">,
): number {
  let written = start;
  target[written] = writeRow(target[written], "radio", header, { previous: true, next: true });
  written += 1;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const mark = item.selected ? "●" : "○";
    const cursor = index === activeIndex ? ">" : " ";
    target[written] = writeRow(
      target[written],
      "radio",
      `${cursor} ${mark} ${item.label}`,
      { indent: true, index },
    );
    written += 1;
  }
  return written;
}

function appendComboHeaderRows(
  target: ApiWorkbenchProjectedControlRow[],
  start: number,
  options: ApiWorkbenchComboHeaderRowsOptions,
): number {
  const expandedGlyph = options.expandedGlyph ?? "▾";
  const collapsedGlyph = options.collapsedGlyph ?? "▸";
  const glyph = options.expanded ? expandedGlyph : collapsedGlyph;
  const title = `${options.title}  ${glyph}`;
  const header = `${title} ${options.label}`;
  const shouldSplit = textWidth(`> ${header}`) > options.rectWidth &&
    options.rectWidth > Math.max(0, Math.floor(options.splitMinWidth ?? 16));
  let written = start;
  target[written] = writeProjectedControlRow(target[written], "combo", shouldSplit ? title : header, {
    action: "activate",
    previous: options.previous,
    next: options.next,
  });
  written += 1;
  if (shouldSplit) {
    target[written] = writeProjectedControlRow(target[written], "combo", options.label, { indent: true });
    written += 1;
  }
  return written;
}

function writeOptionControlRow(
  target: ApiWorkbenchOptionControlRow | undefined,
  id: OptionRowId,
  value: string,
  options?: ApiWorkbenchControlLineOptions,
): ApiWorkbenchOptionControlRow {
  const row = target ?? { id, value };
  row.id = id;
  row.value = value;
  row.options = options;
  return row;
}

function writeProjectedControlRow(
  target: ApiWorkbenchProjectedControlRow | undefined,
  id: ApiWorkbenchControlId,
  value: string,
  options?: ApiWorkbenchControlLineOptions,
): ApiWorkbenchProjectedControlRow {
  const row = target ?? { id, value };
  row.id = id;
  row.value = value;
  row.options = options;
  return row;
}

function maxItemTextWidth(items: readonly string[]): number {
  let width = 0;
  for (const item of items) width = Math.max(width, textWidth(item));
  return width;
}
