import type { DataColumn } from "../src/components/data_table.ts";
import { renderCheckBoxMark } from "../src/components/checkbox.ts";
import { renderStepper, type StepperStep } from "../src/components/stepper.ts";
import { type CursorPosition, type TextBoxVisualLine, wrapTextBoxLinesInto } from "../src/components/textbox.ts";
import {
  layoutWorkbenchControlButtonLine,
  type WorkbenchControlButtonLineSegmentKind,
} from "../src/app/workbench_control_layout.ts";
import { buttonText, fitCellText } from "../src/app/workbench_frame.ts";
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";

export const apiWorkbenchControlIds = [
  "button",
  "genericButton",
  "modal",
  "slider",
  "checkbox",
  "radio",
  "combo",
  "dropdown",
  "input",
  "stepper",
  "textbox",
] as const;

export type ApiWorkbenchControlId = typeof apiWorkbenchControlIds[number];

export type ApiWorkbenchControlHitAction = "previous" | "next" | "activate" | "set" | "focus" | "toggle";

export interface ApiWorkbenchControlHitPlacement {
  column: number;
  row: number;
  width: number;
  height: number;
  id: ApiWorkbenchControlId;
  action: ApiWorkbenchControlHitAction;
  index?: number;
}

export type ApiWorkbenchControlLineSegmentKind = "line" | WorkbenchControlButtonLineSegmentKind;

export interface ApiWorkbenchControlLineSegment {
  kind: ApiWorkbenchControlLineSegmentKind;
  text: string;
  column: number;
  row: number;
  width: number;
  active: boolean;
}

export type ApiWorkbenchControlLineRenderRole = "base" | "button" | "detail";

export interface ApiWorkbenchControlLineRenderCommand {
  kind: "fill" | "segment";
  role: ApiWorkbenchControlLineRenderRole;
  text: string;
  column: number;
  row: number;
  width: number;
  active: boolean;
}

export interface ApiWorkbenchControlLineOptions {
  previous?: boolean;
  next?: boolean;
  action?: ApiWorkbenchControlHitAction;
  indent?: boolean;
  index?: number;
  button?: boolean;
}

export interface ApiWorkbenchStepperHitStep {
  label: string;
  disabled?: boolean;
  completed?: boolean;
}

export interface ApiWorkbenchControlTrack {
  width: number;
  filled: number;
  text: string;
}

export interface ApiWorkbenchControlTrackOptions {
  ratio: number;
  boundsWidth: number;
  minWidth?: number;
  maxWidth?: number;
  reservedWidth?: number;
  fillGlyph?: string;
  emptyGlyph?: string;
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

export function nextApiWorkbenchControlId(
  current: ApiWorkbenchControlId,
  delta: number,
  options: { wrap?: boolean } = {},
): ApiWorkbenchControlId | undefined {
  const index = apiWorkbenchControlIds.indexOf(current);
  if (index < 0) return options.wrap ? apiWorkbenchControlIds[0] : undefined;
  const next = index + delta;
  if (!options.wrap && (next < 0 || next >= apiWorkbenchControlIds.length)) return undefined;
  return apiWorkbenchControlIds[
    ((next % apiWorkbenchControlIds.length) + apiWorkbenchControlIds.length) %
    apiWorkbenchControlIds.length
  ];
}

export function apiWorkbenchControlLineInto(
  segments: ApiWorkbenchControlLineSegment[],
  hits: ApiWorkbenchControlHitPlacement[],
  id: ApiWorkbenchControlId,
  value: string,
  rect: Rectangle,
  row: number,
  activeId: ApiWorkbenchControlId,
  options: ApiWorkbenchControlLineOptions = {},
): number {
  let segmentCount = 0;
  let hitCount = 0;
  const bottom = rect.row + Math.max(0, rect.height);
  if (row >= bottom || rect.width <= 0) {
    segments.length = 0;
    hits.length = 0;
    return row;
  }
  const active = activeId === id;
  const prefix = `${active && !options.indent ? ">" : " "} ${options.indent ? "  " : ""}`;

  if (options.button) {
    const buttonSegments = layoutWorkbenchControlButtonLine(prefix, value, rect.width);
    for (let index = 0; index < buttonSegments.length; index += 1) {
      const segment = buttonSegments[index]!;
      writeControlLineSegment(
        segments,
        segmentCount,
        segment.kind,
        segment.text,
        rect.column + segment.columnOffset,
        row,
        segment.width,
        active,
      );
      segmentCount += 1;
    }
  } else {
    const line = fitCellText(`${prefix}${value}`, rect.width);
    writeControlLineSegment(segments, 0, "line", line, rect.column, row, textWidth(line), active);
    segmentCount = 1;
  }

  writeControlHit(hits, hitCount, {
    column: rect.column,
    row,
    width: rect.width,
    height: 1,
    id,
    action: options.action ?? "activate",
    index: options.index,
  });
  hitCount += 1;
  if (options.previous) {
    writeControlHit(hits, hitCount, {
      column: rect.column,
      row,
      width: Math.max(1, Math.floor(rect.width / 2)),
      height: 1,
      id,
      action: "previous",
    });
    hitCount += 1;
  }
  if (options.next) {
    writeControlHit(hits, hitCount, {
      column: rect.column + Math.floor(rect.width / 2),
      row,
      width: Math.ceil(rect.width / 2),
      height: 1,
      id,
      action: "next",
    });
    hitCount += 1;
  }
  segments.length = segmentCount;
  hits.length = hitCount;
  return row + 1;
}

export function apiWorkbenchControlLineRenderCommandsInto(
  target: ApiWorkbenchControlLineRenderCommand[],
  segments: readonly ApiWorkbenchControlLineSegment[],
  options: { rect: Rectangle; row: number; button?: boolean },
): ApiWorkbenchControlLineRenderCommand[] {
  let written = 0;
  if (options.button) {
    writeControlLineRenderCommand(target, written++, {
      kind: "fill",
      role: "base",
      text: "",
      column: options.rect.column,
      row: options.row,
      width: Math.max(0, Math.floor(options.rect.width)),
      active: false,
    });
  }
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const role = options.button && segment.kind === "button"
      ? "button"
      : options.button && segment.kind === "detail"
      ? "detail"
      : "base";
    writeControlLineRenderCommand(target, written++, {
      kind: "segment",
      role,
      text: segment.text,
      column: segment.column,
      row: segment.row,
      width: segment.width,
      active: segment.active,
    });
  }
  target.length = written;
  return target;
}

export function apiWorkbenchControlTrack(options: ApiWorkbenchControlTrackOptions): ApiWorkbenchControlTrack {
  const minWidth = Math.max(1, Math.floor(options.minWidth ?? 8));
  const maxWidth = Math.max(minWidth, Math.floor(options.maxWidth ?? 24));
  const reservedWidth = Math.max(0, Math.floor(options.reservedWidth ?? 18));
  const available = Math.max(minWidth, Math.floor(options.boundsWidth) - reservedWidth);
  const width = Math.max(minWidth, Math.min(maxWidth, available));
  const ratio = Math.max(0, Math.min(1, Number.isFinite(options.ratio) ? options.ratio : 0));
  const filled = Math.max(0, Math.min(width, Math.round(ratio * width)));
  const fillGlyph = options.fillGlyph ?? "█";
  const emptyGlyph = options.emptyGlyph ?? "░";
  return {
    width,
    filled,
    text: `${fillGlyph.repeat(filled)}${emptyGlyph.repeat(Math.max(0, width - filled))}`,
  };
}

export function apiWorkbenchSliderSetHit(
  rect: Rectangle,
  row: number,
  track: Pick<ApiWorkbenchControlTrack, "width">,
  options: { columnOffset?: number } = {},
): ApiWorkbenchControlHitPlacement {
  return apiWorkbenchSliderSetHitInto(
    { column: 0, row: 0, width: 0, height: 1, id: "slider", action: "set" },
    rect,
    row,
    track,
    options,
  );
}

export function apiWorkbenchSliderSetHitInto(
  target: ApiWorkbenchControlHitPlacement,
  rect: Rectangle,
  row: number,
  track: Pick<ApiWorkbenchControlTrack, "width">,
  options: { columnOffset?: number } = {},
): ApiWorkbenchControlHitPlacement {
  target.column = rect.column + Math.max(0, Math.floor(options.columnOffset ?? 12));
  target.row = row;
  target.width = Math.max(1, Math.floor(track.width));
  target.height = 1;
  target.id = "slider";
  target.action = "set";
  target.index = undefined;
  return target;
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

export function apiWorkbenchCheckboxRowsInto(
  target: ApiWorkbenchOptionControlRow[],
  items: readonly ApiWorkbenchCheckboxOption[],
  options: { header?: string } = {},
): ApiWorkbenchOptionControlRow[] {
  let written = 0;
  target[written] = writeOptionControlRow(target[written], "checkbox", options.header ?? "Checkboxes");
  written += 1;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    target[written] = writeOptionControlRow(
      target[written],
      "checkbox",
      `${renderCheckBoxMark(item.checked)} ${item.label}`,
      { indent: true, index },
    );
    written += 1;
  }
  target.length = written;
  return target;
}

export function apiWorkbenchRadioRowsInto(
  target: ApiWorkbenchOptionControlRow[],
  items: readonly ApiWorkbenchRadioOption[],
  activeIndex: number,
  options: { header?: string } = {},
): ApiWorkbenchOptionControlRow[] {
  let written = 0;
  target[written] = writeOptionControlRow(target[written], "radio", options.header ?? "Radio", {
    previous: true,
    next: true,
  });
  written += 1;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const mark = item.selected ? "●" : "○";
    const cursor = index === activeIndex ? ">" : " ";
    target[written] = writeOptionControlRow(
      target[written],
      "radio",
      `${cursor} ${mark} ${item.label}`,
      { indent: true, index },
    );
    written += 1;
  }
  target.length = written;
  return target;
}

export function apiWorkbenchComboHeaderRowsInto(
  target: ApiWorkbenchProjectedControlRow[],
  options: ApiWorkbenchComboHeaderRowsOptions,
): ApiWorkbenchProjectedControlRow[] {
  const expandedGlyph = options.expandedGlyph ?? "▾";
  const collapsedGlyph = options.collapsedGlyph ?? "▸";
  const glyph = options.expanded ? expandedGlyph : collapsedGlyph;
  const title = `${options.title}  ${glyph}`;
  const header = `${title} ${options.label}`;
  const shouldSplit = textWidth(`> ${header}`) > options.rectWidth &&
    options.rectWidth > Math.max(0, Math.floor(options.splitMinWidth ?? 16));
  target[0] = writeProjectedControlRow(target[0], "combo", shouldSplit ? title : header, {
    action: "activate",
    previous: options.previous,
    next: options.next,
  });
  if (shouldSplit) {
    target[1] = writeProjectedControlRow(target[1], "combo", options.label, { indent: true });
    target.length = 2;
  } else {
    target.length = 1;
  }
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
  target[written] = writeProjectedControlRow(target[written], "checkbox", "Checkboxes");
  written += 1;
  for (let index = 0; index < options.checkboxes.length; index += 1) {
    const item = options.checkboxes[index]!;
    target[written] = writeProjectedControlRow(
      target[written],
      "checkbox",
      `${renderCheckBoxMark(item.checked)} ${item.label}`,
      { indent: true, index },
    );
    written += 1;
  }
  target[written] = writeProjectedControlRow(target[written], "radio", "Radio", { previous: true, next: true });
  written += 1;
  for (let index = 0; index < options.radio.items.length; index += 1) {
    const item = options.radio.items[index]!;
    const mark = item.selected ? "●" : "○";
    const cursor = index === options.radio.activeIndex ? ">" : " ";
    target[written] = writeProjectedControlRow(
      target[written],
      "radio",
      `${cursor} ${mark} ${item.label}`,
      { indent: true, index },
    );
    written += 1;
  }
  const expandedGlyph = options.combo.expandedGlyph ?? "▾";
  const collapsedGlyph = options.combo.collapsedGlyph ?? "▸";
  const comboGlyph = options.combo.expanded ? expandedGlyph : collapsedGlyph;
  const comboTitle = `${options.combo.title}  ${comboGlyph}`;
  const comboHeader = `${comboTitle} ${options.combo.label}`;
  const comboShouldSplit = textWidth(`> ${comboHeader}`) > options.combo.rectWidth &&
    options.combo.rectWidth > Math.max(0, Math.floor(options.combo.splitMinWidth ?? 16));
  target[written] = writeProjectedControlRow(target[written], "combo", comboShouldSplit ? comboTitle : comboHeader, {
    action: "activate",
    previous: options.combo.previous,
    next: options.combo.next,
  });
  written += 1;
  if (comboShouldSplit) {
    target[written] = writeProjectedControlRow(target[written], "combo", options.combo.label, { indent: true });
    written += 1;
  }
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

function writeControlLineSegment(
  target: ApiWorkbenchControlLineSegment[],
  index: number,
  kind: ApiWorkbenchControlLineSegmentKind,
  text: string,
  column: number,
  row: number,
  width: number,
  active: boolean,
): void {
  const segment = target[index] ?? {
    kind: "line",
    text: "",
    column: 0,
    row: 0,
    width: 0,
    active: false,
  };
  segment.kind = kind;
  segment.text = text;
  segment.column = column;
  segment.row = row;
  segment.width = width;
  segment.active = active;
  target[index] = segment;
}

function writeControlLineRenderCommand(
  target: ApiWorkbenchControlLineRenderCommand[],
  index: number,
  options: ApiWorkbenchControlLineRenderCommand,
): void {
  const command = target[index] ?? {
    kind: "segment",
    role: "base",
    text: "",
    column: 0,
    row: 0,
    width: 0,
    active: false,
  };
  command.kind = options.kind;
  command.role = options.role;
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

function writeOptionControlRow(
  target: ApiWorkbenchOptionControlRow | undefined,
  id: Extract<ApiWorkbenchControlId, "checkbox" | "radio">,
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
