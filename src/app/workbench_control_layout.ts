// Copyright 2023 Im-Beast. MIT license.
import { fitCellText } from "./workbench_frame.ts";
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

export type WorkbenchControlButtonLineSegmentKind = "prefix" | "button" | "detail";

/** One styled segment in a control row containing a clickable button token and trailing detail text. */
export interface WorkbenchControlButtonLineSegment {
  kind: WorkbenchControlButtonLineSegmentKind;
  text: string;
  columnOffset: number;
  width: number;
}

/** Computes clipped button/detail segments without letting the button background paint trailing whitespace. */
export function layoutWorkbenchControlButtonLine(
  prefix: string,
  value: string,
  width: number,
): WorkbenchControlButtonLineSegment[] {
  const safeWidth = Math.max(0, Math.floor(width));
  const segments: WorkbenchControlButtonLineSegment[] = [];
  let columnOffset = 0;
  const addSegment = (kind: WorkbenchControlButtonLineSegmentKind, text: string, maxWidth: number) => {
    const segmentWidth = Math.max(0, Math.min(textWidth(text), maxWidth, safeWidth - columnOffset));
    if (segmentWidth <= 0) return;
    const fitted = fitCellText(text, segmentWidth);
    segments.push({ kind, text: fitted, columnOffset, width: segmentWidth });
    columnOffset += segmentWidth;
  };

  addSegment("prefix", prefix, safeWidth);
  const match = /^(\[[^\]]+\])(.*)$/.exec(value);
  const buttonText = match?.[1] ?? value;
  const detailText = match?.[2] ?? "";
  addSegment("button", buttonText, safeWidth - columnOffset);
  addSegment("detail", detailText, safeWidth - columnOffset);
  return segments;
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
