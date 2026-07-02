// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { type WorkbenchButtonState, type WorkbenchButtonTone } from "./workbench_button_style.ts";
import { buttonText, fitCellText } from "./workbench_frame.ts";
import { textWidth } from "../utils/strings.ts";

/** One selectable option token inside a wrapped control option row. */
export interface WorkbenchControlOptionToken {
  index: number;
  text: string;
  columnOffset: number;
  width: number;
}

/** One row of wrapped selectable control option tokens. */
export interface WorkbenchControlOptionRow {
  text: string;
  tokens: WorkbenchControlOptionToken[];
}

/** Segment classes produced by a control row containing a clickable button token and trailing detail text. */
export type WorkbenchControlButtonLineSegmentKind = "prefix" | "button" | "detail";

/** One styled segment in a control row containing a clickable button token and trailing detail text. */
export interface WorkbenchControlButtonLineSegment {
  kind: WorkbenchControlButtonLineSegmentKind;
  text: string;
  columnOffset: number;
  width: number;
}

/** Render-neutral descriptor for a wrapped workbench toolbar button. */
export interface WorkbenchButtonRowItem<TAction = string> {
  label: string;
  action: TAction;
  disabled?: boolean;
  active?: boolean;
  tone?: WorkbenchButtonTone;
}

/** Concrete placement for one wrapped toolbar button. */
export interface WorkbenchButtonRowPlacement<TAction = string> {
  item: WorkbenchButtonRowItem<TAction>;
  rect: Rectangle;
  state: WorkbenchButtonState;
  tone?: WorkbenchButtonTone;
}

/** Result of laying out a responsive toolbar button row. */
export interface WorkbenchButtonRowLayout<TAction = string> {
  placements: WorkbenchButtonRowPlacement<TAction>[];
  nextRow: number;
}

/** Renderer-neutral draw command for one laid-out workbench toolbar button. */
export interface WorkbenchButtonRowRenderCommand<TAction = string> {
  item: WorkbenchButtonRowItem<TAction>;
  text: string;
  rect: Rectangle;
  hitRect: Rectangle;
  state: WorkbenchButtonState;
  tone?: WorkbenchButtonTone;
}

/** Computes wrapped toolbar button positions without knowing how a renderer paints buttons. */
export function layoutWorkbenchButtonRow<TAction>(
  items: readonly WorkbenchButtonRowItem<TAction>[],
  bounds: Rectangle,
  startRow: number,
  options: { gap?: number } = {},
): WorkbenchButtonRowLayout<TAction> {
  const placements: WorkbenchButtonRowPlacement<TAction>[] = [];
  const nextRow = layoutWorkbenchButtonRowInto(placements, items, bounds, startRow, options);
  return { placements, nextRow };
}

/** Computes wrapped toolbar button positions into caller-owned placement storage. */
export function layoutWorkbenchButtonRowInto<TAction>(
  target: WorkbenchButtonRowPlacement<TAction>[],
  items: readonly WorkbenchButtonRowItem<TAction>[],
  bounds: Rectangle,
  startRow: number,
  options: { gap?: number } = {},
): number {
  target.length = 0;
  const gap = Math.max(0, Math.floor(options.gap ?? 1));
  const right = bounds.column + Math.max(0, Math.floor(bounds.width));
  const bottom = bounds.row + Math.max(0, Math.floor(bounds.height));
  let row = Math.max(bounds.row, Math.floor(startRow));
  let column = bounds.column;

  for (const item of items) {
    if (row >= bottom || bounds.width <= 0) break;
    const width = Math.min(textWidth(buttonText(item.label)), Math.max(0, bounds.width));
    if (width <= 0) continue;
    if (column > bounds.column && column + width > right) {
      row += 1;
      column = bounds.column;
    }
    if (row >= bottom) break;
    const state: WorkbenchButtonState = item.disabled ? "disabled" : item.active ? "active" : "base";
    target.push({
      item,
      rect: { column, row, width, height: 1 },
      state,
      tone: item.tone,
    });
    column += width + gap;
  }

  return Math.min(bottom, row + 1);
}

/** Projects laid-out toolbar placements into clipped text plus exact hit rectangles. */
export function workbenchButtonRowRenderCommandsInto<TAction>(
  target: WorkbenchButtonRowRenderCommand<TAction>[],
  placements: readonly WorkbenchButtonRowPlacement<TAction>[],
  options: { compact?: boolean } = {},
): WorkbenchButtonRowRenderCommand<TAction>[] {
  let written = 0;
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index]!;
    const text = buttonText(placement.item.label, { compact: options.compact });
    const width = Math.max(0, Math.min(textWidth(text), placement.rect.width));
    if (width <= 0) continue;
    const command = target[written] ?? {
      item: placement.item,
      text: "",
      rect: { column: 0, row: 0, width: 0, height: 1 },
      hitRect: { column: 0, row: 0, width: 0, height: 1 },
      state: placement.state,
    };
    command.item = placement.item;
    command.text = fitCellText(text, width);
    command.state = placement.state;
    command.tone = placement.tone;
    setRect(command.rect, placement.rect.column, placement.rect.row, width, 1);
    setRect(command.hitRect, placement.rect.column, placement.rect.row, width, 1);
    target[written] = command;
    written += 1;
  }
  target.length = written;
  return target;
}

/** Computes clipped button/detail segments without letting the button background paint trailing whitespace. */
export function layoutWorkbenchControlButtonLine(
  prefix: string,
  value: string,
  width: number,
): WorkbenchControlButtonLineSegment[] {
  const safeWidth = Math.max(0, Math.floor(width));
  const segments: WorkbenchControlButtonLineSegment[] = [];
  let columnOffset = 0;
  const addSegment = (kind: WorkbenchControlButtonLineSegmentKind, text: string, maxWidth: number) => {
    const segmentWidth = Math.max(0, Math.min(textWidth(text), maxWidth, safeWidth - columnOffset));
    if (segmentWidth <= 0) return;
    const fitted = fitCellText(text, segmentWidth);
    segments.push({ kind, text: fitted, columnOffset, width: segmentWidth });
    columnOffset += segmentWidth;
  };

  addSegment("prefix", prefix, safeWidth);
  const match = /^(\[[^\]]+\])(.*)$/.exec(value);
  const buttonText = match?.[1] ?? value;
  const detailText = match?.[2] ?? "";
  addSegment("button", buttonText, safeWidth - columnOffset);
  addSegment("detail", detailText, safeWidth - columnOffset);
  return segments;
}

/** Computes wrapped rows for inline selectable options such as combo box previews. */
export function layoutWrappedControlOptions(
  items: readonly string[],
  selectedIndex: number | undefined,
  width: number,
): WorkbenchControlOptionRow[] {
  const safeWidth = Math.max(8, width);
  const rows: WorkbenchControlOptionRow[] = [];
  let line = "";
  let lineWidth = 0;
  let tokens: WorkbenchControlOptionToken[] = [];
  const flush = () => {
    if (line.length === 0) return;
    rows.push({ text: line, tokens });
    line = "";
    lineWidth = 0;
    tokens = [];
  };

  for (const [index, item] of items.entries()) {
    const token = `${index === selectedIndex ? "[" : " "}${item}${index === selectedIndex ? "]" : " "} `;
    const tokenWidth = textWidth(token);
    if (line.length > 0 && lineWidth + tokenWidth > safeWidth) flush();
    tokens.push({ index, text: token, columnOffset: lineWidth, width: tokenWidth });
    line += token;
    lineWidth += tokenWidth;
  }
  flush();
  return rows.length > 0 ? rows : [{ text: "", tokens: [] }];
}

/** Counts rows needed by wrapped inline selectable options. */
export function wrappedControlOptionRowCount(
  items: readonly string[],
  selectedIndex: number | undefined,
  width: number,
): number {
  if (items.length === 0) return 1;
  const safeWidth = Math.max(8, width);
  let rows = 0;
  let lineWidth = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const tokenWidth = textWidth(
      `${index === selectedIndex ? "[" : " "}${item}${index === selectedIndex ? "]" : " "} `,
    );
    if (lineWidth > 0 && lineWidth + tokenWidth > safeWidth) {
      rows += 1;
      lineWidth = 0;
    }
    lineWidth += tokenWidth;
  }
  return rows + 1;
}

function setRect(target: Rectangle, column: number, row: number, width: number, height: number): void {
  target.column = column;
  target.row = row;
  target.width = width;
  target.height = height;
}
