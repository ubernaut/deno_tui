import { scrollbarOffsetForPointer } from "../src/components/scroll_area.ts";

export interface ApiWorkbenchHitWindowIds<TWindowId extends string> {
  terminalShell: TWindowId;
  controls: TWindowId;
  data: TWindowId;
  explorer: TWindowId;
}

export type ApiWorkbenchTitlebarButtonKind = "minimize" | "maximize" | "restore" | "close" | "config";

export type ApiWorkbenchTitlebarHitAction<TWindowId extends string> =
  | { type: "threeConfig"; id: TWindowId }
  | { type: "minimize"; id: TWindowId }
  | { type: "maximize"; id: TWindowId }
  | { type: "restore"; id: TWindowId }
  | { type: "close"; id: TWindowId };

export interface ApiWorkbenchHitActionWindowSource {
  type: string;
  id?: unknown;
}

export interface ApiWorkbenchScrollbarOffsetInput {
  contentWidth?: number;
  contentHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  currentColumns?: number;
  currentRows?: number;
  pointerColumn?: number;
  pointerRow?: number;
}

export interface ApiWorkbenchScrollbarOffset {
  columns: number;
  rows: number;
}

/** Maps a renderer-neutral titlebar button kind to the workbench hit action it should trigger. */
export function resolveApiWorkbenchTitlebarHitAction<TWindowId extends string>(
  id: TWindowId,
  kind: ApiWorkbenchTitlebarButtonKind,
): ApiWorkbenchTitlebarHitAction<TWindowId> {
  switch (kind) {
    case "config":
      return { type: "threeConfig", id };
    case "minimize":
      return { type: "minimize", id };
    case "maximize":
      return { type: "maximize", id };
    case "close":
      return { type: "close", id };
    case "restore":
      return { type: "restore", id };
  }
}

/** Resolves the workbench window associated with a pointer hit action, when the action implies one. */
export function resolveApiWorkbenchHitWindowId<TWindowId extends string>(
  action: ApiWorkbenchHitActionWindowSource,
  ids: ApiWorkbenchHitWindowIds<TWindowId>,
): TWindowId | undefined {
  switch (action.type) {
    case "focus":
    case "minimize":
    case "maximize":
    case "restore":
    case "close":
    case "windowVScrollbar":
    case "windowHScrollbar":
    case "threeViewport":
      return typeof action.id === "string" ? action.id as TWindowId : undefined;
    case "terminalShellContent":
      return ids.terminalShell;
    case "control":
      return ids.controls;
    case "dataRow":
      return ids.data;
    case "explorerRow":
      return ids.explorer;
    default:
      return undefined;
  }
}

/** Resolves the next scroll offset for a window vertical scrollbar pointer hit. */
export function resolveApiWorkbenchWindowVScrollbarOffset(
  input: ApiWorkbenchScrollbarOffsetInput,
): ApiWorkbenchScrollbarOffset {
  return {
    columns: Math.max(0, Math.floor(input.currentColumns ?? 0)),
    rows: scrollbarOffsetForPointer(
      Math.max(0, Math.floor(input.contentHeight ?? 0)),
      Math.max(0, Math.floor(input.viewportHeight ?? 0)),
      Math.max(0, Math.floor(input.pointerRow ?? 0)),
    ),
  };
}

/** Resolves the next scroll offset for a window horizontal scrollbar pointer hit. */
export function resolveApiWorkbenchWindowHScrollbarOffset(
  input: ApiWorkbenchScrollbarOffsetInput,
): ApiWorkbenchScrollbarOffset {
  return {
    columns: scrollbarOffsetForPointer(
      Math.max(0, Math.floor(input.contentWidth ?? 0)),
      Math.max(0, Math.floor(input.viewportWidth ?? 0)),
      Math.max(0, Math.floor(input.pointerColumn ?? 0)),
    ),
    rows: Math.max(0, Math.floor(input.currentRows ?? 0)),
  };
}

/** Resolves the next scroll offset for the workspace vertical scrollbar. */
export function resolveApiWorkbenchWorkspaceScrollbarOffset(
  input: ApiWorkbenchScrollbarOffsetInput,
): ApiWorkbenchScrollbarOffset {
  return {
    columns: 0,
    rows: scrollbarOffsetForPointer(
      Math.max(0, Math.floor(input.contentHeight ?? 0)),
      Math.max(0, Math.floor(input.viewportHeight ?? 0)),
      Math.max(0, Math.floor(input.pointerRow ?? 0)),
    ),
  };
}
