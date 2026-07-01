/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// Copyright 2023 Im-Beast. MIT license.
import type { CanvasCellSink, CanvasCellUpdate } from "../canvas/sink.ts";
import type { CanvasRenderStats } from "../canvas/canvas.ts";
import { stripStyles } from "../utils/strings.ts";

const textDecoder = new TextDecoder();

/** Options for drawing terminal cells into a browser Canvas2D surface. */
export interface BrowserCellCanvasSinkOptions {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  font?: string;
  cellWidth?: number;
  cellHeight?: number;
  foreground?: string;
  background?: string;
  devicePixelRatio?: number;
}

/** Snapshot of browser canvas sink geometry, colors, and last render stats. */
export interface BrowserCellCanvasSinkInspection {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  foreground: string;
  background: string;
  lastStats?: CanvasRenderStats;
}

interface CellCanvasContext {
  canvas: { width: number; height: number };
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  scale(x: number, y: number): void;
  setTransform?(a: number, b: number, c: number, d: number, e: number, f: number): void;
}

/** Parsed display attributes for one ANSI-styled terminal cell. */
export interface ParsedAnsiCell {
  text: string;
  foreground?: string;
  background?: string;
  bold: boolean;
  dim: boolean;
}

/** Canvas2D-backed cell sink for browser-hosted TUI rendering. */
export class BrowserCellCanvasSink implements CanvasCellSink {
  readonly #canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly #context: CellCanvasContext;
  readonly #font: string;
  readonly #foreground: string;
  readonly #background: string;
  readonly #pixelRatio: number;
  #columns = 0;
  #rows = 0;
  #cellWidth: number;
  #cellHeight: number;
  #lastStats?: CanvasRenderStats;

  constructor(options: BrowserCellCanvasSinkOptions) {
    const context = options.canvas.getContext("2d");
    if (!context) {
      throw new Error("BrowserCellCanvasSink requires a 2D canvas context.");
    }
    this.#canvas = options.canvas;
    this.#context = context as unknown as CellCanvasContext;
    this.#font = options.font ?? "16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    this.#foreground = options.foreground ?? "#dbeafe";
    this.#background = options.background ?? "#070b12";
    this.#pixelRatio = Math.max(1, options.devicePixelRatio ?? globalThis.devicePixelRatio ?? 1);
    this.#cellWidth = Math.max(1, options.cellWidth ?? 10);
    this.#cellHeight = Math.max(1, options.cellHeight ?? 20);
    this.#context.font = this.#font;
    this.#context.textBaseline = "top";
  }

  resize(columns: number, rows: number): void {
    this.#columns = Math.max(1, Math.floor(columns));
    this.#rows = Math.max(1, Math.floor(rows));
    this.#canvas.width = Math.ceil(this.#columns * this.#cellWidth * this.#pixelRatio);
    this.#canvas.height = Math.ceil(this.#rows * this.#cellHeight * this.#pixelRatio);
    this.#context.setTransform?.(1, 0, 0, 1, 0, 0);
    this.#context.scale(this.#pixelRatio, this.#pixelRatio);
    this.#context.font = this.#font;
    this.#context.textBaseline = "top";
    this.#context.fillStyle = this.#background;
    this.#context.fillRect(0, 0, this.#columns * this.#cellWidth, this.#rows * this.#cellHeight);
  }

  flush(updates: readonly CanvasCellUpdate[], stats: CanvasRenderStats): void {
    for (const update of updates) {
      const value = typeof update.value === "string" ? update.value : textDecoder.decode(update.value);
      const parsed = parseAnsiCell(value);
      const x = update.column * this.#cellWidth;
      const y = update.row * this.#cellHeight;
      this.#context.fillStyle = parsed.background ?? this.#background;
      this.#context.fillRect(x, y, this.#cellWidth, this.#cellHeight);

      const text = parsed.text || stripStyles(value) || " ";
      if (text.trim().length === 0) continue;
      this.#context.font = parsed.bold ? `700 ${this.#font}` : this.#font;
      this.#context.fillStyle = parsed.dim ? dimColor(parsed.foreground ?? this.#foreground) : parsed.foreground ??
        this.#foreground;
      this.#context.fillText(text, x, y);
    }
    this.#lastStats = { ...stats };
  }

  inspectSink(): BrowserCellCanvasSinkInspection {
    return {
      columns: this.#columns,
      rows: this.#rows,
      cellWidth: this.#cellWidth,
      cellHeight: this.#cellHeight,
      foreground: this.#foreground,
      background: this.#background,
      lastStats: this.#lastStats ? { ...this.#lastStats } : undefined,
    };
  }
}

/** Parses SGR styling from a single terminal cell string. */
export function parseAnsiCell(value: string): ParsedAnsiCell {
  const style: ParsedAnsiCell = { text: stripStyles(value), bold: false, dim: false };
  const textIndex = firstPrintableIndex(value);
  const matches = value.matchAll(/\x1b\[([0-9;]*)m/g);
  for (const match of matches) {
    if (match.index !== undefined && match.index > textIndex) break;
    const params = match[1] ? match[1].split(";").map((part) => Number(part)) : [0];
    for (let index = 0; index < params.length; index += 1) {
      const param = params[index] ?? 0;
      if (param === 0) {
        style.foreground = undefined;
        style.background = undefined;
        style.bold = false;
        style.dim = false;
      } else if (param === 1) {
        style.bold = true;
      } else if (param === 2) {
        style.dim = true;
      } else if (param === 22) {
        style.bold = false;
        style.dim = false;
      } else if (param === 39) {
        style.foreground = undefined;
      } else if (param === 49) {
        style.background = undefined;
      } else if (param >= 30 && param <= 37) {
        style.foreground = ansiColor(param - 30);
      } else if (param >= 90 && param <= 97) {
        style.foreground = ansiColor(param - 90 + 8);
      } else if (param >= 40 && param <= 47) {
        style.background = ansiColor(param - 40);
      } else if (param >= 100 && param <= 107) {
        style.background = ansiColor(param - 100 + 8);
      } else if ((param === 38 || param === 48) && params[index + 1] === 2) {
        const color = `rgb(${clampByte(params[index + 2])},${clampByte(params[index + 3])},${
          clampByte(params[index + 4])
        })`;
        if (param === 38) style.foreground = color;
        else style.background = color;
        index += 4;
      } else if ((param === 38 || param === 48) && params[index + 1] === 5) {
        const color = ansi256Color(params[index + 2] ?? 15);
        if (param === 38) style.foreground = color;
        else style.background = color;
        index += 2;
      }
    }
  }
  return style;
}

function firstPrintableIndex(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\x1b") return index;
    while (index < value.length && value[index] !== "m") index += 1;
  }
  return value.length;
}

function dimColor(color: string): string {
  return color.startsWith("#") ? `${color}aa` : color;
}

function clampByte(value: number | undefined): number {
  return Math.max(0, Math.min(255, Math.floor(Number.isFinite(value) ? value! : 0)));
}

function ansiColor(index: number): string {
  const colors = [
    "#0f172a",
    "#ef4444",
    "#22c55e",
    "#eab308",
    "#3b82f6",
    "#d946ef",
    "#06b6d4",
    "#e5e7eb",
    "#475569",
    "#fb7185",
    "#86efac",
    "#fde047",
    "#93c5fd",
    "#f0abfc",
    "#67e8f9",
    "#f8fafc",
  ];
  return colors[index] ?? "#dbeafe";
}

function ansi256Color(index: number): string {
  if (!Number.isFinite(index) || index < 0) return "#dbeafe";
  if (index < 16) return ansiColor(index);
  if (index >= 232) {
    const level = 8 + (Math.min(index, 255) - 232) * 10;
    return `rgb(${level},${level},${level})`;
  }
  const offset = Math.min(index, 231) - 16;
  const red = Math.floor(offset / 36);
  const green = Math.floor((offset % 36) / 6);
  const blue = offset % 6;
  return `rgb(${ansiCubeLevel(red)},${ansiCubeLevel(green)},${ansiCubeLevel(blue)})`;
}

function ansiCubeLevel(value: number): number {
  return value === 0 ? 0 : 55 + value * 40;
}
