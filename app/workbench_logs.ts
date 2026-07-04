// Copyright 2023 Im-Beast. MIT license.
import type { RowStyle } from "../src/app/workbench_rows.ts";

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
  return workbenchLogRowsFromSourcesInto(target, [docs], theme);
}

/** Projects one or more log/detail row sources into caller-owned storage without concatenating source arrays. */
export function workbenchLogRowsFromSourcesInto(
  target: RowStyle[],
  sources: readonly (readonly string[])[],
  theme: WorkbenchLogsTheme,
): RowStyle[] {
  let rowCount = 0;
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    rowCount += sources[sourceIndex]!.length;
  }
  target.length = rowCount;

  let targetIndex = 0;
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = sources[sourceIndex]!;
    for (let index = 0; index < source.length; index += 1) {
      const row = target[targetIndex] ?? { text: "" };
      row.text = source[index]!;
      row.fg = theme.text;
      row.bg = theme.surface;
      row.bold = undefined;
      target[targetIndex] = row;
      targetIndex += 1;
    }
  }
  return target;
}
