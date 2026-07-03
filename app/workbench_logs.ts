// Copyright 2023 Im-Beast. MIT license.
import type { RowStyle } from "./workbench_rows.ts";

/** Minimal theme tokens needed by the API workbench logs panel. */
export interface WorkbenchLogsTheme {
  surface: string;
  text: string;
}

/** Projects static workbench log/detail rows into caller-owned storage. */
export function workbenchLogRowsInto(
  target: RowStyle[],
  docs: readonly string[],
  theme: WorkbenchLogsTheme,
): RowStyle[] {
  target.length = docs.length;
  for (let index = 0; index < docs.length; index += 1) {
    const row = target[index] ?? { text: "" };
    row.text = docs[index]!;
    row.fg = theme.text;
    row.bg = theme.surface;
    row.bold = undefined;
    target[index] = row;
  }
  return target;
}
