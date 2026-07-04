// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { isSgrReset, mergeSgrStyle } from "../utils/sgr_style.ts";
import { stripStyles, textWidth } from "../utils/strings.ts";
import {
  readSgrSequenceAt,
  renderFrameRow as renderFrameRowCells,
  renderFrameSlice as renderFrameSliceCells,
  toStyledCells as toStyledFrameCells,
} from "./workbench_frame_rows.ts";

const lineSignalRowCache = new WeakMap<WorkbenchLineSignal, WorkbenchLineSignalRowCache>();
const frameRowMetadata = new WeakMap<string[], WorkbenchFrameRowMetadata>();
const RESET = "\x1b[0m";

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
  raw?: string;
}

interface WorkbenchFrameRowMetadata {
  dirty: boolean;
  revision: number;
  renderedHint?: {
    width: number;
    line: string;
  };
}

/** One drawable text segment for a framed workbench window. */
export interface WorkbenchFrameBoxLine {
  kind: "border" | "title";
  row: number;
  column: number;
  text: string;
}

/** Assembles one frame row from sparse styled cells. */
export function renderFrameRow(cells: string[], width: number): string {
  const columns = Math.max(0, Math.floor(width));
  const hint = frameRowMetadata.get(cells)?.renderedHint;
  if (hint?.width === columns) return hint.line;
  return renderFrameRowCells(cells, width);
}

/** Assembles a clipped frame row slice from sparse styled cells. */
export function renderFrameSlice(cells: string[], start: number, width: number): string {
  return renderFrameSliceCells(cells, start, width);
}

/** Converts an ANSI-styled string into independently styled terminal cells. */
export function toStyledCells(value: string): string[] {
  return toStyledFrameCells(value);
}

/** Copies a viewport from one sparse frame into another without stringifying ANSI cells. */
export function blitWorkbenchFrameCells(
  target: WorkbenchFrame,
  source: WorkbenchFrame,
  viewport: Rectangle,
  offset: { columns: number; rows: number },
): void {
  const viewportColumn = Math.floor(viewport.column);
  const viewportRow = Math.floor(viewport.row);
  const viewportWidth = Math.max(0, Math.floor(viewport.width));
  const viewportHeight = Math.max(0, Math.floor(viewport.height));
  const offsetColumns = Math.floor(offset.columns);
  const offsetRows = Math.floor(offset.rows);
  if (viewportWidth <= 0 || viewportHeight <= 0) return;

  for (let row = 0; row < viewportHeight; row += 1) {
    const sourceRow = source[offsetRows + row] ?? [];
    const targetRow = target[viewportRow + row] ??= [];
    if (viewportColumn >= 0 && offsetColumns >= 0 && offsetColumns + viewportWidth <= sourceRow.length) {
      writeFrameCellsUncheckedRange(targetRow, viewportColumn, sourceRow, offsetColumns, viewportWidth);
    } else {
      writeFrameCells(targetRow, viewportColumn, sourceRow, offsetColumns, viewportWidth);
    }
  }
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
    markFrameRowCleared(row);
    return row;
  });
}

/** Writes styled text into a clipped frame row. */
export function writeFrame(frame: WorkbenchFrame, width: number, row: number, column: number, value: string): void {
  if (row < 0 || row >= frame.length || column >= width) return;
  const cells = frame[row] ??= [];
  const singleStyle = singleSgrStyledText(value);
  if (singleStyle) {
    writeSingleStyleFrameText(cells, width, column, singleStyle.text, singleStyle.style);
    return;
  }
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

function writeSingleStyleFrameText(
  cells: string[],
  width: number,
  column: number,
  text: string,
  style: string,
): void {
  let targetColumn = column;
  let wrote = false;
  for (let index = 0; index < text.length && targetColumn < width;) {
    const char = text[index]!;
    if (targetColumn >= 0) {
      cells[targetColumn] = style ? `${style}${char}\x1b[0m` : char;
      wrote = true;
    }
    targetColumn += 1;
    index += char.length;
  }
  if (!wrote) return;

  const metadata = updateFrameRowMetadata(cells);
  const renderedLine = fullRowSingleStyleLine(style, text, width, column);
  if (renderedLine !== undefined) {
    metadata.renderedHint = { width: Math.max(0, Math.floor(width)), line: renderedLine };
  }
}

function singleSgrStyledText(value: string): { style: string; text: string } | undefined {
  if (value.charCodeAt(0) !== 0x1b || !value.endsWith("\x1b[0m")) return undefined;
  const sequence = readSgrSequenceAt(value, 0);
  if (!sequence || sequence.length >= value.length - "\x1b[0m".length) return undefined;
  const bodyStart = sequence.length;
  const bodyEnd = value.length - "\x1b[0m".length;
  if (value.indexOf("\x1b", bodyStart) !== bodyEnd) return undefined;
  return { style: isSgrReset(sequence) ? "" : sequence, text: value.slice(bodyStart, bodyEnd) };
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

/** Writes an already-clipped contiguous cell range and marks the row dirty once. */
export function writeFrameCellsUnchecked(
  cells: string[],
  column: number,
  values: readonly string[],
  count = values.length,
): void {
  const writeColumn = Math.floor(column);
  const sourceCount = Math.max(0, Math.min(values.length, Math.floor(count)));
  if (sourceCount <= 0) return;
  for (let index = 0; index < sourceCount; index += 1) {
    cells[writeColumn + index] = values[index]!;
  }
  updateFrameRowMetadata(cells);
}

function writeFrameCellsUncheckedRange(
  cells: string[],
  column: number,
  values: readonly string[],
  start: number,
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    cells[column + index] = values[start + index]!;
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
    const raw = frame[row] ?? "";
    const cached = lineSignalRowCache.get(signal);
    if (cached?.width === columns && cached.raw === raw) {
      if (signal.peek() !== cached.line) {
        signal.value = cached.line;
        changed += 1;
      }
      continue;
    }

    const nextLine = fitCellText(raw, columns);
    const fingerprint = fallbackLineFingerprint(nextLine, columns);
    if (cached?.width === columns && cached.fingerprint === fingerprint) {
      if (signal.peek() !== cached.line) {
        signal.value = cached.line;
        changed += 1;
      }
      continue;
    }

    lineSignalRowCache.set(signal, { width: columns, fingerprint, line: nextLine, raw });
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

/** Returns a stable fingerprint when a frame row is known to be clean. */
export function cleanWorkbenchFrameRowFingerprint(cells: string[], width: number): string | undefined {
  const metadata = frameRowMetadata.get(cells);
  if (!metadata || metadata.dirty) return undefined;
  return revisionFrameRowFingerprint(metadata, Math.max(0, Math.floor(width)));
}

/** Marks a rendered frame row clean and returns the fingerprint for the rendered state. */
export function markWorkbenchFrameRowRendered(cells: string[], width: number, renderedLine: string): string {
  const columns = Math.max(0, Math.floor(width));
  const metadata = frameRowMetadata.get(cells);
  if (!metadata) return fallbackLineFingerprint(renderedLine, columns);
  return revisionFrameRowFingerprint(markFrameRowClean(metadata), columns);
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

function markFrameRowCleared(cells: string[]): void {
  const metadata = frameRowMetadata.get(cells);
  if (!metadata) return;
  metadata.revision += 1;
  metadata.dirty = true;
  metadata.renderedHint = undefined;
}

function updateFrameRowMetadata(cells: string[]): WorkbenchFrameRowMetadata {
  let metadata = frameRowMetadata.get(cells);
  if (!metadata) {
    metadata = { dirty: true, revision: 1 };
    frameRowMetadata.set(cells, metadata);
    return metadata;
  }
  metadata.revision += 1;
  metadata.dirty = true;
  metadata.renderedHint = undefined;
  return metadata;
}

function fullRowSingleStyleLine(
  style: string,
  text: string,
  width: number,
  column: number,
): string | undefined {
  const columns = Math.max(0, Math.floor(width));
  if (columns <= 0 || column > 0 || column + text.length < columns) return undefined;
  const start = Math.max(0, -Math.floor(column));
  const body = text.slice(start, start + columns);
  if (body.length !== columns) return undefined;
  return style ? `${style}${body}${RESET}` : body;
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
  const fullRow = fullRowStringLine(value, width, column);
  if (fullRow !== undefined) {
    frame[row] = fullRow;
    return;
  }
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

function fullRowStringLine(value: string, width: number, column: number): string | undefined {
  const columns = Math.max(0, Math.floor(width));
  const sourceColumn = Math.floor(column);
  if (columns <= 0 || sourceColumn > 0) return undefined;
  if (!value.includes("\x1b")) {
    return sourceColumn === 0 && value.length === columns ? value : undefined;
  }

  let style = "";
  let index = 0;
  while (index < value.length) {
    const sequence = readSgrSequenceAt(value, index);
    if (!sequence) break;
    style = mergeSgrStyle(style, sequence);
    index += sequence.length;
  }
  if (!style || !value.endsWith(RESET)) return undefined;

  const resetStart = value.length - RESET.length;
  if (value.indexOf("\x1b", index) !== resetStart) return undefined;
  const text = value.slice(index, resetStart);
  const start = Math.max(0, -sourceColumn);
  const body = text.slice(start, start + columns);
  if (body.length !== columns) return undefined;
  return style ? `${style}${body}${RESET}` : body;
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
