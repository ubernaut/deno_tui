import type { DataColumn } from "../src/components/data_table.ts";
import {
  layoutWorkbenchControlButtonLine,
  layoutWrappedControlOptions,
  type WorkbenchControlButtonLineSegmentKind,
} from "../src/app/workbench_control_layout.ts";
import { fitCellText } from "../src/app/workbench_frame.ts";
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";
import {
  type ApiWorkbenchControlHitAction,
  type ApiWorkbenchControlHitPlacement,
  type ApiWorkbenchControlId,
  apiWorkbenchControlIds,
} from "./api_workbench_control_types.ts";

export * from "./api_workbench_control_rows.ts";
export * from "./api_workbench_control_types.ts";
export * from "./api_workbench_textbox.ts";

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

function maxItemTextWidth(items: readonly string[]): number {
  let width = 0;
  for (const item of items) width = Math.max(width, textWidth(item));
  return width;
}
