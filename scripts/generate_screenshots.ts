import { Buffer } from "node:buffer";
import jpeg from "npm:jpeg-js@0.4.4";
import { PNG } from "npm:pngjs@7.0.0";

interface ScreenshotTarget {
  filename: string;
  title: string;
  theme: ScreenshotTheme;
  columns: number;
  rows: number;
  command: string[];
  mode: "pty" | "stdout";
  timeoutMs?: number;
}

type ScreenshotTheme = "neon" | "exodus" | "system" | "gallery" | "theme" | "docs";

interface CellStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  inverse?: boolean;
}

interface Cell {
  char: string;
  style: CellStyle;
}

interface TerminalFrame {
  title: string;
  theme: ScreenshotTheme;
  columns: number;
  rows: number;
  cells: Cell[][];
}

const FONT_SIZE = 34;
const TITLE_FONT_SIZE = 46;
const CHAR_WIDTH = 20.6;
const LINE_HEIGHT = 52;
const PADDING = 32;
const TITLE_HEIGHT = 78;

const targets: ScreenshotTarget[] = [
  {
    filename: "showcase.jpg",
    title: "Showcase",
    theme: "neon",
    columns: 120,
    rows: 36,
    command: ["deno", "task", "showcase"],
    mode: "pty",
    timeoutMs: 1200,
  },
  {
    filename: "neon-exodus.jpg",
    title: "Neon Exodus",
    theme: "exodus",
    columns: 120,
    rows: 36,
    command: ["deno", "task", "neon-exodus"],
    mode: "pty",
    timeoutMs: 1200,
  },
  {
    filename: "system-monitor.jpg",
    title: "System Monitor",
    theme: "system",
    columns: 120,
    rows: 36,
    command: ["deno", "task", "viz"],
    mode: "pty",
    timeoutMs: 1200,
  },
  {
    filename: "three-ascii.jpg",
    title: "Three ASCII",
    theme: "exodus",
    columns: 120,
    rows: 36,
    command: ["deno", "task", "three-ascii", "--", "--no-controls"],
    mode: "pty",
    timeoutMs: 1400,
  },
  {
    filename: "theme-gallery.jpg",
    title: "Theme Gallery",
    theme: "theme",
    columns: 120,
    rows: 36,
    command: ["deno", "task", "theme-gallery", "--", "--select", "grwizard-velvet"],
    mode: "stdout",
  },
  {
    filename: "demo-gallery.jpg",
    title: "Demo Gallery",
    theme: "gallery",
    columns: 120,
    rows: 36,
    command: ["deno", "task", "demo-gallery"],
    mode: "stdout",
  },
  {
    filename: "api-reference.jpg",
    title: "API Reference",
    theme: "docs",
    columns: 120,
    rows: 36,
    command: ["deno", "task", "api-reference"],
    mode: "stdout",
  },
];

const defaultStyle: CellStyle = {};

if (import.meta.main) {
  await Deno.mkdir("docs/screenshots", { recursive: true });
  const expected = new Set(targets.map((target) => target.filename));
  const browser = await findBrowser();
  for (const target of targets) {
    const output = await captureTarget(target);
    const frame = replayTerminal(output, target);
    await writeJpegScreenshot(frame, `docs/screenshots/${target.filename}`, browser);
  }

  for await (const entry of Deno.readDir("docs/screenshots")) {
    if (entry.isFile && /\.(?:jpe?g|svg)$/i.test(entry.name) && !expected.has(entry.name)) {
      await Deno.remove(`docs/screenshots/${entry.name}`);
    }
  }
}

async function captureTarget(target: ScreenshotTarget): Promise<string> {
  if (target.mode === "stdout") {
    const output = await new Deno.Command(target.command[0], {
      args: target.command.slice(1),
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!output.success) {
      throw new Error(`failed to capture ${target.filename}: ${decode(output.stderr)}`);
    }
    return decode(output.stdout);
  }

  const shellCommand = [
    `stty cols ${target.columns} rows ${target.rows}`,
    `timeout ${(target.timeoutMs ?? 1000) / 1000}s ${quoteCommand(target.command)}`,
  ].join("; ");
  const output = await new Deno.Command("script", {
    args: ["-q", "-c", shellCommand, "/dev/null"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = decode(output.stdout);
  if (text.length === 0) {
    throw new Error(`failed to capture ${target.filename}: ${decode(output.stderr)}`);
  }
  return text;
}

function replayTerminal(input: string, target: ScreenshotTarget): TerminalFrame {
  const cells = Array.from({ length: target.rows }, () => Array<Cell>(target.columns));
  let row = 0;
  let column = 0;
  let style: CellStyle = {};
  let index = 0;

  while (index < input.length) {
    const char = input[index]!;
    if (char === "\x1b" && input[index + 1] === "[") {
      const parsed = parseCsi(input, index);
      if (parsed) {
        const { command, params, raw } = parsed;
        if (command === "m") {
          style = applySgr(style, params);
        } else if (command === "H" || command === "f") {
          row = clamp(numberParam(params[0], 1) - 1, 0, target.rows - 1);
          column = clamp(numberParam(params[1], 1) - 1, 0, target.columns - 1);
        } else if (command === "G") {
          column = clamp(numberParam(params[0], 1) - 1, 0, target.columns - 1);
        } else if (command === "A") {
          row = clamp(row - numberParam(params[0], 1), 0, target.rows - 1);
        } else if (command === "B") {
          row = clamp(row + numberParam(params[0], 1), 0, target.rows - 1);
        } else if (command === "C") {
          column = clamp(column + numberParam(params[0], 1), 0, target.columns - 1);
        } else if (command === "D") {
          column = clamp(column - numberParam(params[0], 1), 0, target.columns - 1);
        } else if (command === "J" || raw === "?1049h") {
          clearCells(cells);
          row = 0;
          column = 0;
        } else if (command === "K") {
          clearRow(cells[row]!, column);
        }
        index = parsed.end;
        continue;
      }
    }

    if (char === "\r") {
      column = 0;
      index += 1;
      continue;
    }
    if (char === "\n") {
      row = target.mode === "stdout" ? row + 1 : clamp(row + 1, 0, target.rows - 1);
      column = 0;
      index += 1;
      continue;
    }

    const codePoint = input.codePointAt(index) ?? char.charCodeAt(0);
    const glyph = String.fromCodePoint(codePoint);
    if (row >= 0 && row < target.rows && column >= 0 && column < target.columns) {
      cells[row]![column] = { char: glyph, style: { ...style } };
    }
    column += 1;
    if (column >= target.columns) {
      if (target.mode === "stdout") {
        column = target.columns;
      } else {
        column = 0;
        row = clamp(row + 1, 0, target.rows - 1);
      }
    }
    index += codePoint > 0xffff ? 2 : 1;
  }

  return { title: target.title, theme: target.theme, columns: target.columns, rows: target.rows, cells };
}

function renderSvg(frame: TerminalFrame): string {
  const width = Math.ceil(PADDING * 2 + frame.columns * CHAR_WIDTH + 48);
  const height = Math.ceil(PADDING * 2 + TITLE_HEIGHT + frame.rows * LINE_HEIGHT + 32);
  const contentTop = PADDING + TITLE_HEIGHT;
  const text = frame.cells.map((row, rowIndex) => {
    const segments = rowSegments(row);
    const y = contentTop + 58 + rowIndex * LINE_HEIGHT;
    const backgrounds = backgroundSegments(row).map((segment) => {
      const x = PADDING + 32 + segment.column * CHAR_WIDTH;
      const y = contentTop + 14 + rowIndex * LINE_HEIGHT;
      return `<rect x="${x.toFixed(1)}" y="${y}" width="${
        (segment.length * CHAR_WIDTH).toFixed(1)
      }" height="${LINE_HEIGHT}" fill="${escapeXml(segment.color)}"/>`;
    }).join("");
    const foregrounds = segments.map((segment) => {
      const x = PADDING + 32 + segment.column * CHAR_WIDTH;
      const style = svgTextStyle(segment.style);
      return `<text x="${x.toFixed(1)}" y="${y}" class="term" style="${style}">${escapeSvgText(segment.text)}</text>`;
    }).join("");
    return `<g>${backgrounds}${foregrounds}</g>`;
  }).join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="theme-${frame.theme}" role="img" aria-label="${
      escapeXml(frame.title)
    } terminal screenshot">`,
    "<style>",
    `svg{background:#06080d}.frame{fill:#0d1117;stroke:var(--border);stroke-width:4}.title{fill:#f8fafc;font:700 ${TITLE_FONT_SIZE}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.term{font:${FONT_SIZE}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;dominant-baseline:alphabetic}.bar{fill:#111827;stroke:#374151}.screen{fill:#090d14;opacity:.91}.glow{filter:drop-shadow(0 0 18px var(--glow))}.theme-neon{--border:#2dd4bf;--glow:#2dd4bf}.theme-exodus{--border:#a855f7;--glow:#ff4fd8}.theme-system{--border:#38bdf8;--glow:#38bdf8}.theme-gallery{--border:#818cf8;--glow:#818cf8}.theme-theme{--border:#ac7cc8;--glow:#f694d8}.theme-docs{--border:#64748b;--glow:#93c5fd}`,
    "</style>",
    `<rect x="${PADDING}" y="${PADDING}" width="${width - PADDING * 2}" height="${
      height - PADDING * 2
    }" rx="24" class="frame glow"/>`,
    `<rect x="${PADDING}" y="${PADDING}" width="${width - PADDING * 2}" height="${TITLE_HEIGHT}" rx="24" class="bar"/>`,
    `<text x="${PADDING + 32}" y="${PADDING + 54}" class="title">${escapeXml(frame.title)}</text>`,
    `<circle cx="${width - PADDING - 144}" cy="${PADDING + 40}" r="12" fill="#a3e635"/>`,
    `<circle cx="${width - PADDING - 96}" cy="${PADDING + 40}" r="12" fill="#facc15"/>`,
    `<circle cx="${width - PADDING - 48}" cy="${PADDING + 40}" r="12" fill="#fb7185"/>`,
    `<rect x="${PADDING + 20}" y="${contentTop}" width="${width - PADDING * 2 - 40}" height="${
      height - contentTop - PADDING - 20
    }" rx="16" class="screen"/>`,
    text,
    "</svg>",
    "",
  ].join("\n");
}

async function writeJpegScreenshot(frame: TerminalFrame, path: string, browser: string): Promise<void> {
  const svg = renderSvg(frame);
  const width = Math.ceil(PADDING * 2 + frame.columns * CHAR_WIDTH + 48);
  const height = Math.ceil(PADDING * 2 + TITLE_HEIGHT + frame.rows * LINE_HEIGHT + 32);
  const tempDir = await Deno.makeTempDir({ prefix: "deno-tui-screenshot-" });
  const htmlPath = `${tempDir}/frame.html`;
  const pngPath = `${tempDir}/frame.png`;
  try {
    await Deno.writeTextFile(
      htmlPath,
      [
        "<!doctype html>",
        '<html><head><meta charset="utf-8">',
        "<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#06080d}svg{display:block}</style>",
        "</head><body>",
        svg,
        "</body></html>",
      ].join(""),
    );
    const output = await new Deno.Command(browser, {
      args: [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        `--window-size=${width},${height}`,
        `--screenshot=${pngPath}`,
        `file://${htmlPath}`,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!output.success) {
      throw new Error(`failed to render ${path}: ${decode(output.stderr)}`);
    }
    try {
      await Deno.stat(pngPath);
    } catch {
      throw new Error(`failed to render ${path}: browser did not create ${pngPath}: ${decode(output.stderr)}`);
    }
    const png = PNG.sync.read(Buffer.from(await Deno.readFile(pngPath)));
    const encoded = jpeg.encode({ data: png.data, width: png.width, height: png.height }, 92);
    await Deno.writeFile(path, encoded.data);
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => undefined);
  }
}

async function findBrowser(): Promise<string> {
  for (const candidate of ["google-chrome", "chromium", "chrome"]) {
    const output = await new Deno.Command("which", {
      args: [candidate],
      stdout: "piped",
      stderr: "null",
    }).output();
    if (output.success) return decode(output.stdout).trim();
  }
  throw new Error("No Chromium-compatible browser found for JPEG screenshot generation.");
}

function rowSegments(row: readonly (Cell | undefined)[]): Array<{ column: number; text: string; style: CellStyle }> {
  const segments: Array<{ column: number; text: string; style: CellStyle }> = [];
  let active: { column: number; text: string; style: CellStyle } | undefined;
  for (let column = 0; column < row.length; column += 1) {
    const cell = row[column] ?? { char: " ", style: defaultStyle };
    if (cell.char === " " && !active) continue;
    if (!active || !sameStyle(active.style, cell.style)) {
      if (active && active.text.trim().length > 0) segments.push(active);
      active = { column, text: cell.char, style: cell.style };
    } else {
      active.text += cell.char;
    }
  }
  if (active && active.text.trim().length > 0) segments.push(active);
  return segments;
}

function backgroundSegments(
  row: readonly (Cell | undefined)[],
): Array<{ column: number; length: number; color: string }> {
  const segments: Array<{ column: number; length: number; color: string }> = [];
  let active: { column: number; length: number; color: string } | undefined;
  for (let column = 0; column < row.length; column += 1) {
    const cell = row[column];
    const color = cell ? effectiveBackground(cell.style) : undefined;
    if (!color) {
      if (active) segments.push(active);
      active = undefined;
      continue;
    }
    if (!active || active.color !== color) {
      if (active) segments.push(active);
      active = { column, length: 1, color };
    } else {
      active.length += 1;
    }
  }
  if (active) segments.push(active);
  return segments;
}

function parseCsi(
  input: string,
  start: number,
): { raw: string; params: string[]; command: string; end: number } | null {
  let index = start + 2;
  while (index < input.length) {
    const code = input.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) {
      const raw = input.slice(start + 2, index);
      return { raw, params: raw.replace(/^\?/, "").split(";"), command: input[index]!, end: index + 1 };
    }
    index += 1;
  }
  return null;
}

function applySgr(previous: CellStyle, params: readonly string[]): CellStyle {
  const values = params.length === 0 || params[0] === "" ? ["0"] : [...params];
  let style = { ...previous };
  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index]);
    if (value === 0) style = {};
    else if (value === 1) style.bold = true;
    else if (value === 2) style.dim = true;
    else if (value === 7) style.inverse = true;
    else if (value === 27) style.inverse = false;
    else if (value === 22) {
      style.bold = false;
      style.dim = false;
    } else if (value === 39) style.fg = undefined;
    else if (value === 49) style.bg = undefined;
    else if (value >= 30 && value <= 37) style.fg = ansiColor(value - 30);
    else if (value >= 90 && value <= 97) style.fg = ansiColor(value - 90 + 8);
    else if (value >= 40 && value <= 47) style.bg = ansiColor(value - 40);
    else if (value >= 100 && value <= 107) style.bg = ansiColor(value - 100 + 8);
    else if ((value === 38 || value === 48) && values[index + 1] === "2") {
      const color = `rgb(${Number(values[index + 2])},${Number(values[index + 3])},${Number(values[index + 4])})`;
      if (value === 38) style.fg = color;
      else style.bg = color;
      index += 4;
    } else if ((value === 38 || value === 48) && values[index + 1] === "5") {
      const color = ansi256Color(Number(values[index + 2]));
      if (value === 38) style.fg = color;
      else style.bg = color;
      index += 2;
    }
  }
  return style;
}

function svgTextStyle(style: CellStyle): string {
  const rules = [`fill:${effectiveForeground(style)}`];
  if (style.bold) rules.push("font-weight:700");
  if (style.dim) rules.push("opacity:.72");
  return rules.join(";");
}

function effectiveForeground(style: CellStyle): string {
  return style.inverse ? style.bg ?? "#090d14" : style.fg ?? "#dbeafe";
}

function effectiveBackground(style: CellStyle): string | undefined {
  return style.inverse ? style.fg ?? "#dbeafe" : style.bg;
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

function sameStyle(left: CellStyle, right: CellStyle): boolean {
  return left.fg === right.fg && left.bg === right.bg && left.bold === right.bold && left.dim === right.dim &&
    left.inverse === right.inverse;
}

function clearCells(cells: Cell[][]): void {
  for (const row of cells) row.length = 0;
}

function clearRow(row: Cell[], start: number): void {
  for (let index = start; index < row.length; index += 1) row[index] = undefined as unknown as Cell;
}

function numberParam(value: string | undefined, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function quoteCommand(command: readonly string[]): string {
  return command.map((part) => `'${part.replaceAll("'", "'\\''")}'`).join(" ");
}

function decode(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeSvgText(value: string): string {
  return escapeXml(value).replaceAll(" ", "&#160;");
}
