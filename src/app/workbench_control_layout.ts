// Copyright 2023 Im-Beast. MIT license.
import { textWidth } from "../utils/strings.ts";

/** One selectable option token inside a wrapped control option row. */
export interface WorkbenchControlOptionToken {
  index: number;
  text: string;
  columnOffset: number;
  width: number;
}

/** One row of wrapped selectable control option tokens. */
export interface WorkbenchControlOptionRow {
  text: string;
  tokens: WorkbenchControlOptionToken[];
}

/** Computes wrapped rows for inline selectable options such as combo box previews. */
export function layoutWrappedControlOptions(
  items: readonly string[],
  selectedIndex: number | undefined,
  width: number,
): WorkbenchControlOptionRow[] {
  const safeWidth = Math.max(8, width);
  const rows: WorkbenchControlOptionRow[] = [];
  let line = "";
  let tokens: WorkbenchControlOptionToken[] = [];
  const flush = () => {
    if (line.length === 0) return;
    rows.push({ text: line, tokens });
    line = "";
    tokens = [];
  };

  for (const [index, item] of items.entries()) {
    const token = `${index === selectedIndex ? "[" : " "}${item}${index === selectedIndex ? "]" : " "} `;
    const tokenWidth = textWidth(token);
    if (line.length > 0 && textWidth(line) + tokenWidth > safeWidth) flush();
    tokens.push({ index, text: token, columnOffset: textWidth(line), width: tokenWidth });
    line += token;
  }
  flush();
  return rows.length > 0 ? rows : [{ text: "", tokens: [] }];
}

/** Counts rows needed by wrapped inline selectable options. */
export function wrappedControlOptionRowCount(
  items: readonly string[],
  selectedIndex: number | undefined,
  width: number,
): number {
  return layoutWrappedControlOptions(items, selectedIndex, width).length;
}
