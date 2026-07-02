import type { DataColumn } from "../src/components/data_table.ts";
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";
import { type ApiWorkbenchControlHitPlacement, apiWorkbenchControlIds } from "./api_workbench_control_types.ts";

export * from "./api_workbench_control_line.ts";
export * from "./api_workbench_control_rows.ts";
export * from "./api_workbench_control_types.ts";
export * from "./api_workbench_textbox.ts";
export * from "./api_workbench_wrapped_options.ts";

export interface ApiWorkbenchStepperHitStep {
  label: string;
  disabled?: boolean;
  completed?: boolean;
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

export function nextApiWorkbenchControlId(
  current: (typeof apiWorkbenchControlIds)[number],
  delta: number,
  options: { wrap?: boolean } = {},
): (typeof apiWorkbenchControlIds)[number] | undefined {
  const index = apiWorkbenchControlIds.indexOf(current);
  if (index < 0) return options.wrap ? apiWorkbenchControlIds[0] : undefined;
  const next = index + delta;
  if (!options.wrap && (next < 0 || next >= apiWorkbenchControlIds.length)) return undefined;
  return apiWorkbenchControlIds[
    ((next % apiWorkbenchControlIds.length) + apiWorkbenchControlIds.length) %
    apiWorkbenchControlIds.length
  ];
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
