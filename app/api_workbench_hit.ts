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
