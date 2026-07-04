// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../src/types.ts";
import { type WorkbenchFrameBoxLine, workbenchFrameBoxLinesInto } from "../src/app/workbench_frame.ts";

export interface WorkbenchFrameRenderTheme {
  background: string;
  panel: string;
  panelSoft: string;
  border: string;
  borderStrong: string;
  accent: string;
}

export interface WorkbenchFramePaintStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
}

export type WorkbenchFrameRenderCommand =
  | {
    kind: "fill";
    rect: Rectangle;
    bg: string;
  }
  | {
    kind: "text";
    row: number;
    column: number;
    text: string;
    style: WorkbenchFramePaintStyle;
    lineKind: WorkbenchFrameBoxLine["kind"];
  };

export interface WorkbenchFrameRenderOptions {
  rect: Rectangle;
  title: string;
  active: boolean;
  theme: WorkbenchFrameRenderTheme;
}

/** Projects a themed workbench window frame into renderer-neutral fill and text commands. */
export function workbenchFrameRenderCommandsInto(
  target: WorkbenchFrameRenderCommand[],
  lineBuffer: WorkbenchFrameBoxLine[],
  options: WorkbenchFrameRenderOptions,
): WorkbenchFrameRenderCommand[] {
  if (options.rect.width <= 0 || options.rect.height <= 0) {
    target.length = 0;
    return target;
  }

  const t = options.theme;
  const background = options.active ? t.panelSoft : t.panel;
  const borderStyle = {
    fg: options.active ? t.accent : t.borderStrong,
    bg: background,
    bold: options.active,
  };
  const titleStyle = {
    fg: t.background,
    bg: options.active ? t.accent : t.border,
    bold: true,
  };

  target[0] = writeFillCommand(target[0], options.rect, background);
  const lines = workbenchFrameBoxLinesInto(lineBuffer, options.rect, options.title);
  let written = 1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    target[written] = writeTextCommand(
      target[written],
      line,
      line.kind === "title" ? titleStyle : borderStyle,
    );
    written += 1;
  }
  target.length = written;
  return target;
}

function writeFillCommand(
  target: WorkbenchFrameRenderCommand | undefined,
  source: Rectangle,
  bg: string,
): WorkbenchFrameRenderCommand {
  if (!target || target.kind !== "fill") {
    return {
      kind: "fill",
      rect: { column: source.column, row: source.row, width: source.width, height: source.height },
      bg,
    };
  }
  target.rect.column = source.column;
  target.rect.row = source.row;
  target.rect.width = source.width;
  target.rect.height = source.height;
  target.bg = bg;
  return target;
}

function writeTextCommand(
  target: WorkbenchFrameRenderCommand | undefined,
  line: WorkbenchFrameBoxLine,
  style: WorkbenchFramePaintStyle,
): WorkbenchFrameRenderCommand {
  if (!target || target.kind !== "text") {
    return {
      kind: "text",
      row: line.row,
      column: line.column,
      text: line.text,
      style: { ...style },
      lineKind: line.kind,
    };
  }
  target.row = line.row;
  target.column = line.column;
  target.text = line.text;
  target.style.fg = style.fg;
  target.style.bg = style.bg;
  target.style.bold = style.bold;
  target.lineKind = line.kind;
  return target;
}
