// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { stripStyles, textWidth } from "../utils/strings.ts";

/** Cell matrix used by immediate-mode workbench renderers before row assembly. */
export type WorkbenchFrame = string[][];

/** Style function used by frame fill helpers. */
export type WorkbenchFrameStyle = (text: string) => string;

/** Prepares a reusable row array to a fixed length. */
export function prepareWorkbenchRows<T>(
  rows: T[],
  count: number,
  create: (index: number) => T,
  reset?: (row: T, index: number) => T,
): T[] {
  const rowCount = Math.max(0, Math.floor(count));
  rows.length = rowCount;
  for (let index = 0; index < rowCount; index += 1) {
    const current = rows[index] ?? create(index);
    rows[index] = reset ? reset(current, index) : current;
  }
  return rows;
}

/** Prepares a reusable sparse workbench frame by clearing each retained row. */
export function prepareWorkbenchFrame(frame: WorkbenchFrame, rows: number): WorkbenchFrame {
  return prepareWorkbenchRows(frame, rows, () => [], (row) => {
    row.length = 0;
    return row;
  });
}

/** Converts an ANSI-styled string into independently styled terminal cells. */
export function toStyledCells(value: string): string[] {
  const cells: string[] = [];
  let style = "";
  for (let index = 0; index < value.length;) {
    if (value.charCodeAt(index) === 0x1b) {
      const sequence = readSgrSequenceAt(value, index);
      if (sequence) {
        style = sequence.includes("[0m") ? "" : style + sequence;
        index += sequence.length;
        continue;
      }
    }
    const char = value[index]!;
    cells.push(style ? `${style}${char}\x1b[0m` : char);
    index += char.length;
  }
  return cells;
}

function readSgrSequenceAt(value: string, start: number): string | undefined {
  if (value.charCodeAt(start) !== 0x1b || value[start + 1] !== "[") return undefined;
  let index = start + 2;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if ((code >= 0x30 && code <= 0x39) || code === 0x3b) {
      index++;
      continue;
    }
    break;
  }
  if (value[index] !== "m") return undefined;
  return value.slice(start, index + 1);
}

/** Writes styled text into a clipped frame row. */
export function writeFrame(frame: WorkbenchFrame, width: number, row: number, column: number, value: string): void {
  if (row < 0 || row >= frame.length || column >= width) return;
  const cells = frame[row] ??= [];
  let style = "";
  let targetColumn = column;
  for (let index = 0; index < value.length && targetColumn < width;) {
    if (value.charCodeAt(index) === 0x1b) {
      const sequence = readSgrSequenceAt(value, index);
      if (sequence) {
        style = sequence.includes("[0m") ? "" : style + sequence;
        index += sequence.length;
        continue;
      }
    }

    const char = value[index]!;
    if (targetColumn >= 0) {
      cells[targetColumn] = style ? `${style}${char}\x1b[0m` : char;
    }
    targetColumn += 1;
    index += char.length;
  }
}

/** Fills a full frame row with a style. */
export function fillFrameRow(
  frame: WorkbenchFrame,
  width: number,
  row: number,
  style: WorkbenchFrameStyle,
): void {
  writeFrame(frame, width, row, 0, style(" ".repeat(Math.max(0, width))));
}

/** Fills a rectangle in the frame with a style. */
export function fillFrameRect(
  frame: WorkbenchFrame,
  width: number,
  rect: Rectangle,
  style: WorkbenchFrameStyle,
): void {
  for (let row = rect.row; row < rect.row + rect.height; row += 1) {
    writeFrame(frame, width, row, rect.column, style(" ".repeat(Math.max(0, rect.width))));
  }
}

/** Assembles one frame row from sparse styled cells. */
export function renderFrameRow(cells: string[], width: number): string {
  const row = new Array<string>(Math.max(0, width));
  for (let column = 0; column < width; column += 1) {
    row[column] = cells[column] ?? " ";
  }
  return row.join("");
}

/** Assembles a clipped frame row slice from sparse styled cells. */
export function renderFrameSlice(cells: string[], start: number, width: number): string {
  const row = new Array<string>(Math.max(0, width));
  for (let column = 0; column < width; column += 1) {
    row[column] = cells[start + column] ?? " ";
  }
  return row.join("");
}

/** Pads or truncates text to a terminal-cell width. */
export function fitCellText(value: string, width: number): string {
  const visible = textWidth(value);
  if (visible === width) return value;
  if (visible < width) return value + " ".repeat(Math.max(0, width - visible));
  const plain = stripStyles(value);
  return `${plain.slice(0, Math.max(0, width - 1))}…`;
}

/** Centers text inside a terminal-cell width after clipping. */
export function centerCellText(value: string, width: number): string {
  const cropped = fitCellText(value, width);
  const remaining = Math.max(0, width - textWidth(cropped));
  return `${" ".repeat(Math.floor(remaining / 2))}${cropped}`;
}

/** Formats a compact or padded workbench button label. */
export function buttonText(label: string, options: { compact?: boolean } = {}): string {
  const safeLabel = label.trim();
  return options.compact ? `[${safeLabel}]` : `[ ${safeLabel} ]`;
}

/** Selects the higher contrast foreground for a background color. */
export function contrastText(background: string, dark: string, light: string): string {
  const bg = parseHexColor(background);
  const darkRgb = parseHexColor(dark);
  const lightRgb = parseHexColor(light);
  if (!bg || !darkRgb || !lightRgb) return relativeLuminance(bg ?? [0, 0, 0]) > 0.5 ? dark : light;
  return contrastRatio(bg, lightRgb) >= contrastRatio(bg, darkRgb) ? light : dark;
}

/** Parses a six-digit hex color into RGB bytes. */
export function parseHexColor(value: string): [number, number, number] | undefined {
  const color = value.trim().replace(/^#/, "");
  if (!/^[\da-f]{6}$/i.test(color)) return undefined;
  return [
    Number.parseInt(color.slice(0, 2), 16),
    Number.parseInt(color.slice(2, 4), 16),
    Number.parseInt(color.slice(4, 6), 16),
  ];
}

function contrastRatio(left: [number, number, number], right: [number, number, number]): number {
  const leftLum = relativeLuminance(left);
  const rightLum = relativeLuminance(right);
  const brightest = Math.max(leftLum, rightLum);
  const darkest = Math.min(leftLum, rightLum);
  return (brightest + 0.05) / (darkest + 0.05);
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const r = linearRgbChannel(red);
  const g = linearRgbChannel(green);
  const b = linearRgbChannel(blue);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function linearRgbChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
