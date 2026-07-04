export interface ThreePanelFrameUpdate {
  rendererBacked: boolean;
  rows: number;
  columns: number;
}

/** Builds the lightweight event payload emitted when a Three panel renders or publishes a grid. */
export function threePanelFrameUpdate(
  grid: readonly (readonly string[] | undefined)[] | undefined,
  rendererBacked: boolean,
): ThreePanelFrameUpdate {
  return {
    rendererBacked,
    rows: grid?.length ?? 0,
    columns: grid?.[0]?.length ?? 0,
  };
}
