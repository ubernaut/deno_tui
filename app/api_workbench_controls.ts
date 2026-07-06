import { renderCheckBoxMark } from "../src/components/checkbox.ts";
import type { DataColumn } from "../src/components/data_table.ts";
import { scrollbarOffsetForPointer } from "../src/components/scroll_area.ts";
import { renderStepper, type StepperStep } from "../src/components/stepper.ts";
import type { CursorPosition, TextBoxVisualLine } from "../src/components/textbox.ts";
import { wrapTextBoxLinesInto } from "../src/components/textbox.ts";
import {
  layoutWorkbenchControlButtonLine,
  layoutWrappedControlOptions,
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

export interface ApiWorkbenchHitWindowIds<TWindowId extends string> {
  terminalShell: TWindowId;
  controls: TWindowId;
  data: TWindowId;
  explorer: TWindowId;
}

export type ApiWorkbenchTitlebarButtonKind = "minimize" | "maximize" | "restore" | "close" | "config";

export type ApiWorkbenchTitlebarHitAction<TWindowId extends string> =
  | { type: "threeConfig"; id: TWindowId }
  | { type: "minimize"; id: TWindowId }
  | { type: "maximize"; id: TWindowId }
  | { type: "restore"; id: TWindowId }
  | { type: "close"; id: TWindowId };

export interface ApiWorkbenchHitActionWindowSource {
  type: string;
  id?: unknown;
}

export interface ApiWorkbenchScrollbarOffsetInput {
  contentWidth?: number;
  contentHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  currentColumns?: number;
  currentRows?: number;
  pointerColumn?: number;
  pointerRow?: number;
}

export interface ApiWorkbenchScrollbarOffset {
  columns: number;
  rows: number;
}

export interface ApiWorkbenchTouchLayoutInput {
  coarsePointer?: boolean;
  columns: number;
  rows: number;
}

export interface ApiWorkbenchTouchHitRectInput {
  rect: Rectangle;
  bounds: Rectangle;
}

export interface ApiWorkbenchHitTarget<TAction> {
  rect: Rectangle;
  action: TAction;
}

export interface ApiWorkbenchHitTargetStack<TAction> {
  find(x: number, y: number): ApiWorkbenchHitTarget<TAction> | undefined;
  findExpanded(
    x: number,
    y: number,
    expand: (rect: Rectangle, target: ApiWorkbenchHitTarget<TAction>) => Rectangle | undefined,
  ): ApiWorkbenchHitTarget<TAction> | undefined;
}

export interface FindApiWorkbenchHitTargetInput<TAction> {
  targets: ApiWorkbenchHitTargetStack<TAction>;
  x: number;
  y: number;
  bounds: Rectangle;
  touchOptimized?: boolean;
}

export interface ApiWorkbenchControlHitPlacement {
  column: number;
  row: number;
  width: number;
  height: number;
  id: ApiWorkbenchControlId;
  action: ApiWorkbenchControlHitAction;
  index?: number;
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

export function apiWorkbenchControlAt(
  current: ApiWorkbenchControlId,
  delta: number,
  fallback: ApiWorkbenchControlId = "button",
): ApiWorkbenchControlId {
  return nextApiWorkbenchControlId(current, delta, { wrap: true }) ?? fallback;
}

export function apiWorkbenchControlAtEdge(
  current: ApiWorkbenchControlId,
  delta: number,
): ApiWorkbenchControlId | undefined {
  return nextApiWorkbenchControlId(current, delta);
}

export function isApiWorkbenchTextControlActive(
  activeWindowId: string | undefined,
  controlsWindowId: string,
  activeControl: ApiWorkbenchControlId,
): boolean {
  return activeWindowId === controlsWindowId && (activeControl === "input" || activeControl === "textbox");
}

/** Maps a renderer-neutral titlebar button kind to the workbench hit action it should trigger. */
export function resolveApiWorkbenchTitlebarHitAction<TWindowId extends string>(
  id: TWindowId,
  kind: ApiWorkbenchTitlebarButtonKind,
): ApiWorkbenchTitlebarHitAction<TWindowId> {
  switch (kind) {
    case "config":
      return { type: "threeConfig", id };
    case "minimize":
      return { type: "minimize", id };
    case "maximize":
      return { type: "maximize", id };
    case "close":
      return { type: "close", id };
    case "restore":
      return { type: "restore", id };
  }
}

/** Resolves the workbench window associated with a pointer hit action, when the action implies one. */
export function resolveApiWorkbenchHitWindowId<TWindowId extends string>(
  action: ApiWorkbenchHitActionWindowSource,
  ids: ApiWorkbenchHitWindowIds<TWindowId>,
): TWindowId | undefined {
  switch (action.type) {
    case "focus":
    case "minimize":
    case "maximize":
    case "restore":
    case "close":
    case "windowVScrollbar":
    case "windowHScrollbar":
    case "threeViewport":
      return typeof action.id === "string" ? action.id as TWindowId : undefined;
    case "terminalShellContent":
      return ids.terminalShell;
    case "control":
      return ids.controls;
    case "dataRow":
      return ids.data;
    case "explorerRow":
      return ids.explorer;
    default:
      return undefined;
  }
}

/** Resolves the next scroll offset for a window vertical scrollbar pointer hit. */
export function resolveApiWorkbenchWindowVScrollbarOffset(
  input: ApiWorkbenchScrollbarOffsetInput,
): ApiWorkbenchScrollbarOffset {
  return {
    columns: Math.max(0, Math.floor(input.currentColumns ?? 0)),
    rows: scrollbarOffsetForPointer(
      Math.max(0, Math.floor(input.contentHeight ?? 0)),
      Math.max(0, Math.floor(input.viewportHeight ?? 0)),
      Math.max(0, Math.floor(input.pointerRow ?? 0)),
    ),
  };
}

/** Resolves the next scroll offset for a window horizontal scrollbar pointer hit. */
export function resolveApiWorkbenchWindowHScrollbarOffset(
  input: ApiWorkbenchScrollbarOffsetInput,
): ApiWorkbenchScrollbarOffset {
  return {
    columns: scrollbarOffsetForPointer(
      Math.max(0, Math.floor(input.contentWidth ?? 0)),
      Math.max(0, Math.floor(input.viewportWidth ?? 0)),
      Math.max(0, Math.floor(input.pointerColumn ?? 0)),
    ),
    rows: Math.max(0, Math.floor(input.currentRows ?? 0)),
  };
}

/** Resolves the next scroll offset for the workspace vertical scrollbar. */
export function resolveApiWorkbenchWorkspaceScrollbarOffset(
  input: ApiWorkbenchScrollbarOffsetInput,
): ApiWorkbenchScrollbarOffset {
  return {
    columns: 0,
    rows: scrollbarOffsetForPointer(
      Math.max(0, Math.floor(input.contentHeight ?? 0)),
      Math.max(0, Math.floor(input.viewportHeight ?? 0)),
      Math.max(0, Math.floor(input.pointerRow ?? 0)),
    ),
  };
}

/** Returns true when pointer targets should expand for coarse or compact layouts. */
export function isApiWorkbenchTouchOptimizedLayout(input: ApiWorkbenchTouchLayoutInput): boolean {
  return Boolean(input.coarsePointer) || input.columns < 92 || input.rows < 30;
}

/** Expands small pointer targets for touch/mobile layouts while clipping to the visible bounds. */
export function expandedApiWorkbenchTouchHitRect(input: ApiWorkbenchTouchHitRectInput): Rectangle {
  const { rect, bounds } = input;
  const minimumWidth = rect.width <= 3 ? 6 : rect.width <= 10 ? Math.max(10, rect.width) : rect.width;
  const minimumHeight = rect.height <= 1 ? 3 : rect.height;
  const growColumns = Math.max(0, minimumWidth - rect.width);
  const growRows = Math.max(0, minimumHeight - rect.height);
  return clipApiWorkbenchRect(
    {
      column: rect.column - Math.floor(growColumns / 2),
      row: rect.row - Math.floor(growRows / 2),
      width: rect.width + growColumns,
      height: rect.height + growRows,
    },
    bounds,
  );
}

/** Finds a workbench hit target with optional touch expansion using the shared API workbench policy. */
export function findApiWorkbenchHitTarget<TAction>(
  input: FindApiWorkbenchHitTargetInput<TAction>,
): ApiWorkbenchHitTarget<TAction> | undefined {
  const target = input.targets.find(input.x, input.y);
  if (target) return target;
  if (!input.touchOptimized) return undefined;
  return input.targets.findExpanded(input.x, input.y, (rect, target) =>
    expandedApiWorkbenchTouchHitRect({
      rect,
      bounds: input.bounds,
    }) ?? target.rect);
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
    kind,
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

function maxItemTextWidth(items: readonly string[]): number {
  let width = 0;
  for (const item of items) width = Math.max(width, textWidth(item));
  return width;
}

function clipApiWorkbenchRect(rect: Rectangle, bounds: Rectangle): Rectangle {
  const column = Math.max(bounds.column, rect.column);
  const row = Math.max(bounds.row, rect.row);
  const right = Math.min(bounds.column + bounds.width, rect.column + rect.width);
  const bottom = Math.min(bounds.row + bounds.height, rect.row + rect.height);
  return {
    column,
    row,
    width: Math.max(0, right - column),
    height: Math.max(0, bottom - row),
  };
}
