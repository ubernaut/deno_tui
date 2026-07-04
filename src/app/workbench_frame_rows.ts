// Copyright 2023 Im-Beast. MIT license.
import { mergeSgrStyle } from "../utils/sgr_style.ts";

const RESET = "\x1b[0m";
const MAX_FRAME_CELL_PARTS_CACHE_SIZE = 32768;
const frameCellPartsCache = new Map<string, FrameCellParts>();
const plainAsciiCellPartsCache: Array<FrameCellParts | undefined> = [];

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

/** Reads one SGR ANSI escape sequence starting at an exact string offset. */
export function readSgrSequenceAt(value: string, start: number): string | undefined {
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

/** Assembles one frame row from sparse styled cells. */
export function renderFrameRow(cells: string[], width: number): string {
  return renderFrameArrayCells(cells, 0, width);
}

/** Assembles a clipped frame row slice from sparse styled cells. */
export function renderFrameSlice(cells: string[], start: number, width: number): string {
  return renderFrameArrayCells(cells, start, width);
}

function renderFrameArrayCells(cells: string[], start: number, width: number): string {
  const columns = Math.max(0, Math.floor(width));
  if (columns <= 0) return "";
  const offset = Math.floor(start);
  if (cells.length === 0 || offset >= cells.length) return " ".repeat(columns);
  let row = "";
  for (let column = 0; column < columns;) {
    const firstCell = cells[offset + column] ?? " ";
    const first = splitFrameCell(firstCell);
    if (isBackgroundStyledFrameCell(first)) {
      const styled = renderBackgroundStyledRun(cells, offset, column, columns, firstCell, first);
      row += styled.value;
      column = styled.nextColumn;
      continue;
    }
    let next = column + 1;
    while (next < columns && (cells[offset + next] ?? " ") === firstCell) {
      next += 1;
    }
    let text = next - column === 1 ? first.text : first.text.repeat(next - column);
    while (next < columns) {
      const currentCell = cells[offset + next] ?? " ";
      const current = splitFrameCell(currentCell);
      if (current.prefix !== first.prefix || current.suffix !== first.suffix) break;
      let repeatEnd = next + 1;
      while (repeatEnd < columns && (cells[offset + repeatEnd] ?? " ") === currentCell) {
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
  cells: string[],
  start: number,
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
    while (repeatEnd < width && (cells[start + repeatEnd] ?? " ") === currentCell) {
      repeatEnd += 1;
    }
    let text = repeatEnd - next === 1 ? current.text : current.text.repeat(repeatEnd - next);
    next = repeatEnd;
    while (next < width) {
      const nextCell = cells[start + next] ?? " ";
      const nextParts = splitFrameCell(nextCell);
      if (!isBackgroundStyledFrameCell(nextParts) || nextParts.prefix !== current.prefix) break;
      let samePrefixEnd = next + 1;
      while (samePrefixEnd < width && (cells[start + samePrefixEnd] ?? " ") === nextCell) {
        samePrefixEnd += 1;
      }
      text += samePrefixEnd - next === 1 ? nextParts.text : nextParts.text.repeat(samePrefixEnd - next);
      next = samePrefixEnd;
    }
    value += `${current.prefix}${text}`;
    if (next >= width) break;

    currentCell = cells[start + next] ?? " ";
    current = splitFrameCell(currentCell);
    if (!isBackgroundStyledFrameCell(current)) break;
  }

  return { value: `${value}${RESET}`, nextColumn: next };
}

function isBackgroundStyledFrameCell(cell: FrameCellParts): boolean {
  return cell.backgroundStyled;
}

interface FrameCellParts {
  prefix: string;
  text: string;
  suffix: string;
  backgroundStyled: boolean;
}

function splitFrameCell(cell: string): FrameCellParts {
  if (cell.length === 1) {
    const code = cell.charCodeAt(0);
    if (code !== 0x1b && code < 128) {
      return plainAsciiCellPartsCache[code] ??= plainFrameCellParts(cell);
    }
  }
  if (!cell.includes("\x1b[") || !cell.endsWith("\x1b[0m")) {
    return plainFrameCellParts(cell);
  }
  const cached = frameCellPartsCache.get(cell);
  if (cached) return cached;

  const body = cell.slice(0, -RESET.length);
  const split = splitFrameCellBody(body);
  if (!split) {
    return plainFrameCellParts(cell);
  }
  if (frameCellPartsCache.size > MAX_FRAME_CELL_PARTS_CACHE_SIZE) {
    frameCellPartsCache.clear();
  }
  frameCellPartsCache.set(cell, split);
  return split;
}

function splitFrameCellBody(body: string): FrameCellParts | undefined {
  if (body.length === 0) return undefined;
  const lastCodeUnit = body.charCodeAt(body.length - 1);
  if (lastCodeUnit < 0xdc00 || lastCodeUnit > 0xdfff) {
    const text = body[body.length - 1]!;
    if (text.charCodeAt(0) === 0x1b) return undefined;
    return styledFrameCellParts(body.slice(0, -1), text);
  }

  const parts = Array.from(body);
  const text = parts.pop();
  if (!text || text.charCodeAt(0) === 0x1b) return undefined;
  return styledFrameCellParts(parts.join(""), text);
}

function plainFrameCellParts(text: string): FrameCellParts {
  return { prefix: "", text, suffix: "", backgroundStyled: false };
}

function styledFrameCellParts(prefix: string, text: string): FrameCellParts {
  return {
    prefix,
    text,
    suffix: RESET,
    backgroundStyled: prefix.length > 0 && (prefix.includes("[48;") || prefix.includes(";48;")),
  };
}
