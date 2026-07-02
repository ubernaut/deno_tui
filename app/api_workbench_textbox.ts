import type { CursorPosition, TextBoxVisualLine } from "../src/components/textbox.ts";
import { wrapTextBoxLinesInto } from "../src/components/textbox.ts";
import { fitCellText } from "../src/app/workbench_frame.ts";
import type { Rectangle } from "../src/types.ts";

import type { ApiWorkbenchControlHitPlacement } from "./api_workbench_control_types.ts";

export interface ApiWorkbenchTextboxProjectionOptions {
  rect: Rectangle;
  row: number;
  lines: readonly string[];
  visualLines?: TextBoxVisualLine[];
  cursor: CursorPosition;
  active: boolean;
  maxHeight?: number;
  minHeight?: number;
  labelMaxWidth?: number;
  labelReserveWidth?: number;
  wordWrap?: boolean;
}

export interface ApiWorkbenchTextboxProjectionRow {
  row: number;
  labelColumn: number;
  labelWidth: number;
  labelText: string;
  bodyColumn: number;
  bodyWidth: number;
  bodyText: string;
  visualLine: TextBoxVisualLine;
  cursor: boolean;
  continuation: boolean;
  active: boolean;
  header: boolean;
}

export interface ApiWorkbenchTextboxProjection {
  rows: ApiWorkbenchTextboxProjectionRow[];
  hit: ApiWorkbenchControlHitPlacement;
  nextRow: number;
  height: number;
  startVisualRow: number;
}

export type ApiWorkbenchTextboxRenderRole = "label" | "body";

export interface ApiWorkbenchTextboxRenderCommand {
  role: ApiWorkbenchTextboxRenderRole;
  text: string;
  column: number;
  row: number;
  width: number;
  active: boolean;
  header: boolean;
}

export interface ApiWorkbenchTextboxRenderOptions {
  cursorGlyph?: string;
  continuationGlyph?: string;
}

export function apiWorkbenchTextboxProjection(
  options: ApiWorkbenchTextboxProjectionOptions,
): ApiWorkbenchTextboxProjection {
  return apiWorkbenchTextboxProjectionInto([], options);
}

export function apiWorkbenchTextboxProjectionInto(
  rows: ApiWorkbenchTextboxProjectionRow[],
  options: ApiWorkbenchTextboxProjectionOptions,
): ApiWorkbenchTextboxProjection {
  const rect = options.rect;
  const bottom = rect.row + Math.max(0, rect.height);
  const row = Math.floor(options.row);
  if (row >= bottom || rect.width <= 0) {
    rows.length = 0;
    return {
      rows,
      hit: { column: rect.column, row, width: Math.max(0, rect.width), height: 0, id: "textbox", action: "focus" },
      nextRow: row,
      height: 0,
      startVisualRow: 0,
    };
  }

  const minHeight = Math.max(1, Math.floor(options.minHeight ?? 2));
  const maxHeight = Math.max(minHeight, Math.floor(options.maxHeight ?? 5));
  const height = Math.min(maxHeight, Math.max(minHeight, bottom - row));
  const labelReserveWidth = Math.max(0, Math.floor(options.labelReserveWidth ?? 12));
  const labelWidth = Math.min(
    Math.max(0, Math.floor(options.labelMaxWidth ?? 10)),
    Math.max(0, rect.width - labelReserveWidth),
  );
  const bodyColumn = rect.column + labelWidth;
  const bodyWidth = Math.max(1, rect.width - labelWidth);
  const visualLines = wrapTextBoxLinesInto(options.visualLines ?? [], options.lines, bodyWidth - 2, {
    wordWrap: options.wordWrap ?? true,
  });
  let cursorRow = -1;
  for (let index = 0; index < visualLines.length; index += 1) {
    const line = visualLines[index]!;
    if (
      line.lineIndex === options.cursor.y && options.cursor.x >= line.startColumn &&
      options.cursor.x <= line.endColumn
    ) {
      cursorRow = index;
      break;
    }
  }
  const startVisualRow = Math.max(
    0,
    Math.min(Math.max(0, cursorRow - height + 1), Math.max(0, visualLines.length - height)),
  );
  for (let offset = 0; offset < height; offset += 1) {
    const visualLine = visualLines[startVisualRow + offset] ?? {
      text: "",
      lineIndex: 0,
      startColumn: 0,
      endColumn: 0,
      continuation: false,
    };
    const cursor = options.active && visualLine.lineIndex === options.cursor.y &&
      options.cursor.x >= visualLine.startColumn && options.cursor.x <= visualLine.endColumn;
    const target = rows[offset] ??= {
      row: 0,
      labelColumn: 0,
      labelWidth: 0,
      labelText: "",
      bodyColumn: 0,
      bodyWidth: 0,
      bodyText: "",
      visualLine,
      cursor: false,
      continuation: false,
      active: false,
      header: false,
    };
    target.row = row + offset;
    target.labelColumn = rect.column;
    target.labelWidth = labelWidth;
    target.labelText = offset === 0 ? `${options.active ? ">" : " "} TextBox` : " ".repeat(Math.max(0, labelWidth));
    target.bodyColumn = bodyColumn;
    target.bodyWidth = bodyWidth;
    target.bodyText = visualLine.text;
    target.visualLine = visualLine;
    target.cursor = cursor;
    target.continuation = visualLine.continuation;
    target.active = options.active;
    target.header = offset === 0;
  }
  rows.length = height;

  return {
    rows,
    hit: { column: rect.column, row, width: rect.width, height, id: "textbox", action: "focus" },
    nextRow: row + height,
    height,
    startVisualRow,
  };
}

export function apiWorkbenchTextboxRenderCommandsInto(
  target: ApiWorkbenchTextboxRenderCommand[],
  rows: readonly ApiWorkbenchTextboxProjectionRow[],
  options: ApiWorkbenchTextboxRenderOptions = {},
): ApiWorkbenchTextboxRenderCommand[] {
  const cursorGlyph = options.cursorGlyph ?? "▌";
  const continuationGlyph = options.continuationGlyph ?? "↳";
  let written = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    writeTextboxRenderCommand(target, written++, {
      role: "label",
      text: fitCellText(row.labelText, row.labelWidth),
      column: row.labelColumn,
      row: row.row,
      width: row.labelWidth,
      active: row.active,
      header: row.header,
    });
    writeTextboxRenderCommand(target, written++, {
      role: "body",
      text: fitCellText(
        `${row.continuation ? continuationGlyph : " "}${row.bodyText}${row.cursor ? cursorGlyph : " "}`,
        row.bodyWidth,
      ),
      column: row.bodyColumn,
      row: row.row,
      width: row.bodyWidth,
      active: row.active,
      header: row.header,
    });
  }
  target.length = written;
  return target;
}

function writeTextboxRenderCommand(
  target: ApiWorkbenchTextboxRenderCommand[],
  index: number,
  options: ApiWorkbenchTextboxRenderCommand,
): void {
  const command = target[index] ?? {
    role: "body",
    text: "",
    column: 0,
    row: 0,
    width: 0,
    active: false,
    header: false,
  };
  command.role = options.role;
  command.text = options.text;
  command.column = options.column;
  command.row = options.row;
  command.width = options.width;
  command.active = options.active;
  command.header = options.header;
  target[index] = command;
}
