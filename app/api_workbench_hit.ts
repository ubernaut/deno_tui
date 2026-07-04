export interface ApiWorkbenchHitWindowIds<TWindowId extends string> {
  terminalShell: TWindowId;
  controls: TWindowId;
  data: TWindowId;
  explorer: TWindowId;
}

export interface ApiWorkbenchHitActionWindowSource {
  type: string;
  id?: unknown;
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
