import {
  layoutWorkbenchControlButtonLine,
  type WorkbenchControlButtonLineSegmentKind,
} from "../src/app/workbench_control_layout.ts";
import { fitCellText } from "../src/app/workbench_frame.ts";
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";

import type {
  ApiWorkbenchControlHitAction,
  ApiWorkbenchControlHitPlacement,
  ApiWorkbenchControlId,
} from "./api_workbench_control_types.ts";

export type ApiWorkbenchControlLineSegmentKind = "line" | WorkbenchControlButtonLineSegmentKind;

export interface ApiWorkbenchControlLineSegment {
  kind: ApiWorkbenchControlLineSegmentKind;
  text: string;
  column: number;
  row: number;
  width: number;
  active: boolean;
}

export type ApiWorkbenchControlLineRenderRole = "base" | "button" | "detail";

export interface ApiWorkbenchControlLineRenderCommand {
  kind: "fill" | "segment";
  role: ApiWorkbenchControlLineRenderRole;
  text: string;
  column: number;
  row: number;
  width: number;
  active: boolean;
}

export interface ApiWorkbenchControlLineOptions {
  previous?: boolean;
  next?: boolean;
  action?: ApiWorkbenchControlHitAction;
  indent?: boolean;
  index?: number;
  button?: boolean;
}

export interface ApiWorkbenchControlTrack {
  width: number;
  filled: number;
  text: string;
}

export interface ApiWorkbenchControlTrackOptions {
  ratio: number;
  boundsWidth: number;
  minWidth?: number;
  maxWidth?: number;
  reservedWidth?: number;
  fillGlyph?: string;
  emptyGlyph?: string;
}

export function apiWorkbenchControlLineInto(
  segments: ApiWorkbenchControlLineSegment[],
  hits: ApiWorkbenchControlHitPlacement[],
  id: ApiWorkbenchControlId,
  value: string,
  rect: Rectangle,
  row: number,
  activeId: ApiWorkbenchControlId,
  options: ApiWorkbenchControlLineOptions = {},
): number {
  let segmentCount = 0;
  let hitCount = 0;
  const bottom = rect.row + Math.max(0, rect.height);
  if (row >= bottom || rect.width <= 0) {
    segments.length = 0;
    hits.length = 0;
    return row;
  }
  const active = activeId === id;
  const prefix = `${active && !options.indent ? ">" : " "} ${options.indent ? "  " : ""}`;

  if (options.button) {
    const buttonSegments = layoutWorkbenchControlButtonLine(prefix, value, rect.width);
    for (let index = 0; index < buttonSegments.length; index += 1) {
      const segment = buttonSegments[index]!;
      writeControlLineSegment(
        segments,
        segmentCount,
        segment.kind,
        segment.text,
        rect.column + segment.columnOffset,
        row,
        segment.width,
        active,
      );
      segmentCount += 1;
    }
  } else {
    const line = fitCellText(`${prefix}${value}`, rect.width);
    writeControlLineSegment(segments, 0, "line", line, rect.column, row, textWidth(line), active);
    segmentCount = 1;
  }

  writeControlHit(hits, hitCount, {
    column: rect.column,
    row,
    width: rect.width,
    height: 1,
    id,
    action: options.action ?? "activate",
    index: options.index,
  });
  hitCount += 1;
  if (options.previous) {
    writeControlHit(hits, hitCount, {
      column: rect.column,
      row,
      width: Math.max(1, Math.floor(rect.width / 2)),
      height: 1,
      id,
      action: "previous",
    });
    hitCount += 1;
  }
  if (options.next) {
    writeControlHit(hits, hitCount, {
      column: rect.column + Math.floor(rect.width / 2),
      row,
      width: Math.ceil(rect.width / 2),
      height: 1,
      id,
      action: "next",
    });
    hitCount += 1;
  }
  segments.length = segmentCount;
  hits.length = hitCount;
  return row + 1;
}

export function apiWorkbenchControlLineRenderCommandsInto(
  target: ApiWorkbenchControlLineRenderCommand[],
  segments: readonly ApiWorkbenchControlLineSegment[],
  options: { rect: Rectangle; row: number; button?: boolean },
): ApiWorkbenchControlLineRenderCommand[] {
  let written = 0;
  if (options.button) {
    writeControlLineRenderCommand(target, written++, {
      kind: "fill",
      role: "base",
      text: "",
      column: options.rect.column,
      row: options.row,
      width: Math.max(0, Math.floor(options.rect.width)),
      active: false,
    });
  }
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const role = options.button && segment.kind === "button"
      ? "button"
      : options.button && segment.kind === "detail"
      ? "detail"
      : "base";
    writeControlLineRenderCommand(target, written++, {
      kind: "segment",
      role,
      text: segment.text,
      column: segment.column,
      row: segment.row,
      width: segment.width,
      active: segment.active,
    });
  }
  target.length = written;
  return target;
}

export function apiWorkbenchControlTrack(options: ApiWorkbenchControlTrackOptions): ApiWorkbenchControlTrack {
  const minWidth = Math.max(1, Math.floor(options.minWidth ?? 8));
  const maxWidth = Math.max(minWidth, Math.floor(options.maxWidth ?? 24));
  const reservedWidth = Math.max(0, Math.floor(options.reservedWidth ?? 18));
  const available = Math.max(minWidth, Math.floor(options.boundsWidth) - reservedWidth);
  const width = Math.max(minWidth, Math.min(maxWidth, available));
  const ratio = Math.max(0, Math.min(1, Number.isFinite(options.ratio) ? options.ratio : 0));
  const filled = Math.max(0, Math.min(width, Math.round(ratio * width)));
  const fillGlyph = options.fillGlyph ?? "█";
  const emptyGlyph = options.emptyGlyph ?? "░";
  return {
    width,
    filled,
    text: `${fillGlyph.repeat(filled)}${emptyGlyph.repeat(Math.max(0, width - filled))}`,
  };
}

export function apiWorkbenchSliderSetHit(
  rect: Rectangle,
  row: number,
  track: Pick<ApiWorkbenchControlTrack, "width">,
  options: { columnOffset?: number } = {},
): ApiWorkbenchControlHitPlacement {
  return apiWorkbenchSliderSetHitInto(
    { column: 0, row: 0, width: 0, height: 1, id: "slider", action: "set" },
    rect,
    row,
    track,
    options,
  );
}

export function apiWorkbenchSliderSetHitInto(
  target: ApiWorkbenchControlHitPlacement,
  rect: Rectangle,
  row: number,
  track: Pick<ApiWorkbenchControlTrack, "width">,
  options: { columnOffset?: number } = {},
): ApiWorkbenchControlHitPlacement {
  target.column = rect.column + Math.max(0, Math.floor(options.columnOffset ?? 12));
  target.row = row;
  target.width = Math.max(1, Math.floor(track.width));
  target.height = 1;
  target.id = "slider";
  target.action = "set";
  target.index = undefined;
  return target;
}

function writeControlLineSegment(
  target: ApiWorkbenchControlLineSegment[],
  index: number,
  kind: ApiWorkbenchControlLineSegmentKind,
  text: string,
  column: number,
  row: number,
  width: number,
  active: boolean,
): void {
  const segment = target[index] ?? {
    kind: "line",
    text: "",
    column: 0,
    row: 0,
    width: 0,
    active: false,
  };
  segment.kind = kind;
  segment.text = text;
  segment.column = column;
  segment.row = row;
  segment.width = width;
  segment.active = active;
  target[index] = segment;
}

function writeControlLineRenderCommand(
  target: ApiWorkbenchControlLineRenderCommand[],
  index: number,
  options: ApiWorkbenchControlLineRenderCommand,
): void {
  const command = target[index] ?? {
    kind: "segment",
    role: "base",
    text: "",
    column: 0,
    row: 0,
    width: 0,
    active: false,
  };
  command.kind = options.kind;
  command.role = options.role;
  command.text = options.text;
  command.column = options.column;
  command.row = options.row;
  command.width = options.width;
  command.active = options.active;
  target[index] = command;
}

function writeControlHit(
  target: ApiWorkbenchControlHitPlacement[],
  index: number,
  source: ApiWorkbenchControlHitPlacement,
): void {
  const hit = target[index] ?? {
    column: 0,
    row: 0,
    width: 0,
    height: 1,
    id: source.id,
    action: source.action,
  };
  hit.column = source.column;
  hit.row = source.row;
  hit.width = source.width;
  hit.height = source.height;
  hit.id = source.id;
  hit.action = source.action;
  hit.index = source.index;
  target[index] = hit;
}
