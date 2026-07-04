// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import type { RowStyle } from "./workbench_rows.ts";

export interface WorkbenchStyledRowRenderTheme {
  text: string;
  surface: string;
}

export interface WorkbenchStyledRowRenderCommand {
  row: number;
  column: number;
  text: string;
  fg: string;
  bg: string;
  bold: boolean;
}

export interface WorkbenchStyledRowsRenderOptions {
  rect: Rectangle;
  rows: readonly RowStyle[];
  theme: WorkbenchStyledRowRenderTheme;
  fit: (text: string, width: number) => string;
  sourceStart?: number;
}

/** Projects styled workbench rows into renderer-neutral clipped draw commands. */
export function workbenchStyledRowsRenderCommandsInto(
  target: WorkbenchStyledRowRenderCommand[],
  options: WorkbenchStyledRowsRenderOptions,
): WorkbenchStyledRowRenderCommand[] {
  target.length = 0;
  if (options.rect.width <= 0 || options.rect.height <= 0) return target;

  const sourceStart = Math.max(0, Math.floor(options.sourceStart ?? 0));
  const count = Math.min(options.rect.height, Math.max(0, options.rows.length - sourceStart));
  target.length = count;
  for (let index = 0; index < count; index += 1) {
    const row = options.rows[sourceStart + index]!;
    target[index] = {
      row: options.rect.row + index,
      column: options.rect.column,
      text: options.fit(row.text, options.rect.width),
      fg: row.fg ?? options.theme.text,
      bg: row.bg ?? options.theme.surface,
      bold: row.bold ?? false,
    };
  }
  return target;
}
