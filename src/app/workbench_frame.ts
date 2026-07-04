// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { mergeSgrStyle } from "../utils/sgr_style.ts";
import { stripStyles, textWidth } from "../utils/strings.ts";

const RESET = "\x1b[0m";
const MAX_FRAME_CELL_PARTS_CACHE_SIZE = 32768;
const frameCellPartsCache = new Map<string, FrameCellParts>();
const lineSignalRowCache = new WeakMap<WorkbenchLineSignal, WorkbenchLineSignalRowCache>();
const frameRowMetadata = new WeakMap<string[], WorkbenchFrameRowMetadata>();

/** Cell matrix used by immediate-mode workbench renderers before row assembly. */
export type WorkbenchFrame = string[][];

/** Style function used by frame fill helpers. */
export type WorkbenchFrameStyle = (text: string) => string;

/** Minimal retained line signal interface used by terminal workbench frame flushing. */
export interface WorkbenchLineSignal {
  peek(): string;
  value: string;
}

/** Summary of a line-signal frame flush. */
export interface WorkbenchLineSignalUpdateStats {
  rows: number;
  changed: number;
  cleared: number;
}

interface WorkbenchLineSignalRowCache {
  width: number;
  fingerprint: string;
  line: string;
}

interface WorkbenchFrameRowMetadata {
  dirty: boolean;
  revision: number;
}

/** One drawable text segment for a framed workbench window. */
export interface WorkbenchFrameBoxLine {
  kind: "border" | "title";
  row: number;
  column: number;
  text: string;
}

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
    frameRowMetadata.delete(row);
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
        style = mergeSgrStyle(style, sequence);
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
  let wrote = false;
  for (let index = 0; index < value.length && targetColumn < width;) {
    if (value.charCodeAt(index) === 0x1b) {
      const sequence = readSgrSequenceAt(value, index);
      if (sequence) {
        style = mergeSgrStyle(style, sequence);
        index += sequence.length;
        continue;
      }
    }

    const char = value[index]!;
    if (targetColumn >= 0) {
      cells[targetColumn] = style ? `${style}${char}\x1b[0m` : char;
      wrote = true;
    }
    targetColumn += 1;
    index += char.length;
  }
  if (wrote) {
    updateFrameRowMetadata(cells);
  }
}

/** Writes one already-styled cell into a workbench frame row and updates row-change metadata. */
export function writeFrameCell(cells: string[], column: number, value: string): void {
  cells[column] = value;
  updateFrameRowMetadata(cells);
}

/** Writes a contiguous set of already-styled cells into a frame row and marks the row dirty once. */
export function writeFrameCells(
  cells: string[],
  column: number,
  values: readonly string[],
  start = 0,
  count = values.length - start,
): void {
  let targetColumn = Math.floor(column);
  let sourceStart = Math.max(0, Math.floor(start));
  const sourceCount = Math.max(0, Math.floor(count));
  if (sourceCount <= 0 || sourceStart >= values.length) return;
  const end = Math.min(values.length, sourceStart + sourceCount);
  if (targetColumn < 0) {
    sourceStart += -targetColumn;
    targetColumn = 0;
  }
  if (sourceStart >= end) return;
  let writeColumn = targetColumn;
  for (let index = sourceStart; index < end; index += 1) {
    cells[writeColumn] = values[index]!;
    writeColumn += 1;
  }
  updateFrameRowMetadata(cells);
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
  const value = style(" ".repeat(Math.max(0, rect.width)));
  for (let row = rect.row; row < rect.row + rect.height; row += 1) {
    writeFrame(frame, width, row, rect.column, value);
  }
}

/** Assembles one frame row from sparse styled cells. */
export function renderFrameRow(cells: string[], width: number): string {
  return renderFrameCells((column) => cells[column] ?? " ", width);
}

/** Assembles a clipped frame row slice from sparse styled cells. */
export function renderFrameSlice(cells: string[], start: number, width: number): string {
  return renderFrameCells((column) => cells[start + column] ?? " ", width);
}

/** Applies a sparse workbench frame to retained line signals while skipping unchanged terminal rows. */
export function updateWorkbenchLineSignals(
  signals: readonly WorkbenchLineSignal[],
  frame: WorkbenchFrame,
  width: number,
  height: number,
): WorkbenchLineSignalUpdateStats {
  const rows = Math.max(0, Math.min(signals.length, Math.floor(height)));
  const columns = Math.max(0, Math.floor(width));
  let changed = 0;
  let cleared = 0;

  for (let row = 0; row < rows; row += 1) {
    const frameRow = frame[row] ?? [];
    const signal = signals[row]!;
    const metadata = frameRowMetadata.get(frameRow);
    const fingerprint = metadata && !metadata.dirty
      ? revisionFrameRowFingerprint(metadata, columns)
      : metadata
      ? undefined
      : fingerprintFrameRow(frameRow, columns);
    const cached = lineSignalRowCache.get(signal);
    if (fingerprint !== undefined && cached?.width === columns && cached.fingerprint === fingerprint) {
      if (signal.peek() !== cached.line) {
        signal.value = cached.line;
        changed += 1;
      }
      continue;
    }

    const nextLine = renderFrameRow(frameRow, columns);
    const nextFingerprint = metadata
      ? revisionFrameRowFingerprint(markFrameRowClean(metadata), columns)
      : fingerprint ?? fallbackLineFingerprint(nextLine, columns);
    lineSignalRowCache.set(signal, { width: columns, fingerprint: nextFingerprint, line: nextLine });
    if (signal.peek() !== nextLine) {
      signal.value = nextLine;
      changed += 1;
    }
  }

  for (let row = rows; row < signals.length; row += 1) {
    const signal = signals[row]!;
    if (signal.peek() !== "") {
      signal.value = "";
      cleared += 1;
    }
    lineSignalRowCache.delete(signal);
  }

  return { rows, changed, cleared };
}

/** Applies a string-backed workbench frame to retained line signals while skipping unchanged terminal rows. */
export function updateWorkbenchStringLineSignals(
  signals: readonly WorkbenchLineSignal[],
  frame: readonly string[],
  width: number,
  height: number,
): WorkbenchLineSignalUpdateStats {
  const rows = Math.max(0, Math.min(signals.length, Math.floor(height)));
  const columns = Math.max(0, Math.floor(width));
  let changed = 0;
  let cleared = 0;

  for (let row = 0; row < rows; row += 1) {
    const signal = signals[row]!;
    const nextLine = fitCellText(frame[row] ?? "", columns);
    const cached = lineSignalRowCache.get(signal);
    const fingerprint = fallbackLineFingerprint(nextLine, columns);
    if (cached?.width === columns && cached.fingerprint === fingerprint) {
      if (signal.peek() !== cached.line) {
        signal.value = cached.line;
        changed += 1;
      }
      continue;
    }

    lineSignalRowCache.set(signal, { width: columns, fingerprint, line: nextLine });
    if (signal.peek() !== nextLine) {
      signal.value = nextLine;
      changed += 1;
    }
  }

  for (let row = rows; row < signals.length; row += 1) {
    const signal = signals[row]!;
    if (signal.peek() !== "") {
      signal.value = "";
      cleared += 1;
    }
    lineSignalRowCache.delete(signal);
  }

  return { rows, changed, cleared };
}

function fingerprintFrameRow(cells: string[], width: number): string {
  let hash = 2166136261;
  const mix = (value: number) => {
    hash ^= value;
    hash = Math.imul(hash, 16777619) >>> 0;
  };

  mix(width);
  for (const key of Object.keys(cells)) {
    const column = Number(key);
    if (!Number.isInteger(column) || column < 0 || column >= width) continue;
    const cell = cells[column];
    if (cell === undefined) continue;
    mix(column);
    mix(cell.length);
    for (let index = 0; index < cell.length; index += 1) {
      mix(cell.charCodeAt(index));
    }
  }
  return `${width}:scan:${hash.toString(36)}`;
}

function fallbackLineFingerprint(line: string, width: number): string {
  let hash = 2166136261;
  for (let index = 0; index < line.length; index += 1) {
    hash ^= line.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${width}:line:${hash.toString(36)}`;
}

function revisionFrameRowFingerprint(metadata: WorkbenchFrameRowMetadata, width: number): string {
  return `${width}:rev:${metadata.revision}`;
}

function markFrameRowClean(metadata: WorkbenchFrameRowMetadata): WorkbenchFrameRowMetadata {
  metadata.dirty = false;
  return metadata;
}

function updateFrameRowMetadata(cells: string[]): void {
  let metadata = frameRowMetadata.get(cells);
  if (!metadata) {
    metadata = { dirty: true, revision: 1 };
    frameRowMetadata.set(cells, metadata);
    return;
  }
  metadata.revision += 1;
  metadata.dirty = true;
}

function renderFrameCells(cellAt: (column: number) => string, width: number): string {
  let row = "";
  for (let column = 0; column < width;) {
    const firstCell = cellAt(column);
    const first = splitFrameCell(firstCell);
    if (isBackgroundStyledFrameCell(first)) {
      const styled = renderBackgroundStyledRun(cellAt, column, width, firstCell, first);
      row += styled.value;
      column = styled.nextColumn;
      continue;
    }
    let next = column + 1;
    while (next < width && cellAt(next) === firstCell) {
      next += 1;
    }
    let text = next - column === 1 ? first.text : first.text.repeat(next - column);
    while (next < width) {
      const currentCell = cellAt(next);
      const current = splitFrameCell(currentCell);
      if (current.prefix !== first.prefix || current.suffix !== first.suffix) break;
      let repeatEnd = next + 1;
      while (repeatEnd < width && cellAt(repeatEnd) === currentCell) {
        repeatEnd += 1;
      }
      text += repeatEnd - next === 1 ? current.text : current.text.repeat(repeatEnd - next);
      next = repeatEnd;
    }
    row += `${first.prefix}${text}${first.suffix}`;
    column = next;
  }
  return row;
}

function renderBackgroundStyledRun(
  cellAt: (column: number) => string,
  startColumn: number,
  width: number,
  firstCell: string,
  first: FrameCellParts,
): { value: string; nextColumn: number } {
  let next = startColumn;
  let value = "";
  let currentCell = firstCell;
  let current = first;

  while (next < width) {
    let repeatEnd = next + 1;
    while (repeatEnd < width && cellAt(repeatEnd) === currentCell) {
      repeatEnd += 1;
    }
    let text = repeatEnd - next === 1 ? current.text : current.text.repeat(repeatEnd - next);
    next = repeatEnd;
    while (next < width) {
      const nextCell = cellAt(next);
      const nextParts = splitFrameCell(nextCell);
      if (!isBackgroundStyledFrameCell(nextParts) || nextParts.prefix !== current.prefix) break;
      let samePrefixEnd = next + 1;
      while (samePrefixEnd < width && cellAt(samePrefixEnd) === nextCell) {
        samePrefixEnd += 1;
      }
      text += samePrefixEnd - next === 1 ? nextParts.text : nextParts.text.repeat(samePrefixEnd - next);
      next = samePrefixEnd;
    }
    value += `${current.prefix}${text}`;
    if (next >= width) break;

    currentCell = cellAt(next);
    current = splitFrameCell(currentCell);
    if (!isBackgroundStyledFrameCell(current)) break;
  }

  return { value: `${value}${RESET}`, nextColumn: next };
}

function isBackgroundStyledFrameCell(cell: FrameCellParts): boolean {
  return cell.suffix === RESET && cell.prefix.length > 0 &&
    (cell.prefix.includes("[48;") || cell.prefix.includes(";48;"));
}

interface FrameCellParts {
  prefix: string;
  text: string;
  suffix: string;
}

function splitFrameCell(cell: string): FrameCellParts {
  if (!cell.includes("\x1b[") || !cell.endsWith("\x1b[0m")) {
    return { prefix: "", text: cell, suffix: "" };
  }
  const cached = frameCellPartsCache.get(cell);
  if (cached) return cached;

  const body = cell.slice(0, -RESET.length);
  const parts = Array.from(body);
  const text = parts.pop();
  if (!text || text.charCodeAt(0) === 0x1b) {
    return { prefix: "", text: cell, suffix: "" };
  }
  const split = { prefix: parts.join(""), text, suffix: RESET };
  if (frameCellPartsCache.size > MAX_FRAME_CELL_PARTS_CACHE_SIZE) {
    frameCellPartsCache.clear();
  }
  frameCellPartsCache.set(cell, split);
  return split;
}

/** Writes ANSI-styled text into a string-backed frame row. */
export function writeStringFrameRow(
  frame: string[],
  width: number,
  row: number,
  column: number,
  value: string,
): void {
  if (row < 0 || row >= frame.length || column >= width) return;
  const valueCells = toStyledCells(value);
  if (column <= 0 && column + valueCells.length >= width) {
    frame[row] = renderFrameSlice(valueCells, -column, width);
    return;
  }
  const cells = toStyledCells(frame[row] ?? "");
  let targetColumn = column;
  for (let index = 0; index < valueCells.length && targetColumn < width; index += 1) {
    if (targetColumn >= 0) cells[targetColumn] = valueCells[index]!;
    targetColumn += 1;
  }
  frame[row] = renderFrameRow(cells, width);
}

/** Writes a repeated string-backed fill row into a rectangular frame region. */
export function fillStringFrameRect(
  frame: string[],
  width: number,
  rect: Rectangle,
  value: string,
): void {
  for (let row = rect.row; row < rect.row + rect.height; row += 1) {
    writeStringFrameRow(frame, width, row, rect.column, value);
  }
}

/** Projects border and title text for a workbench window frame into caller-owned storage. */
export function workbenchFrameBoxLinesInto(
  target: WorkbenchFrameBoxLine[],
  rect: Rectangle,
  title: string,
): WorkbenchFrameBoxLine[] {
  target.length = 0;
  if (rect.width <= 0 || rect.height <= 0) return target;

  const horizontal = "─".repeat(Math.max(0, rect.width - 2));
  target.push({ kind: "border", row: rect.row, column: rect.column, text: `┌${horizontal}┐` });

  const rightColumn = rect.column + rect.width - 1;
  for (let row = rect.row + 1; row < rect.row + rect.height - 1; row += 1) {
    target.push({ kind: "border", row, column: rect.column, text: "│" });
    if (rect.width > 1) target.push({ kind: "border", row, column: rightColumn, text: "│" });
  }

  if (rect.height > 1) {
    target.push({ kind: "border", row: rect.row + rect.height - 1, column: rect.column, text: `└${horizontal}┘` });
  }
  if (rect.width > 2) {
    target.push({ kind: "title", row: rect.row, column: rect.column + 2, text: ` ${title.toUpperCase()} ` });
  }

  return target;
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
