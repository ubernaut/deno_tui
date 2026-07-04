import type { ThreeAsciiConfigOptions } from "../three_ascii/options.ts";
import type { ThreeAsciiRenderFrameOptions } from "../three_ascii/renderer.ts";

export interface ThreePanelRectLike {
  width: number;
  height: number;
}

export interface ThreePanelRenderPolicyInput {
  ascii: Pick<ThreeAsciiConfigOptions, "kittyGraphics" | "kittyDisableAscii">;
  graphicsAvailable: boolean;
  graphicsRectangle: ThreePanelRectLike;
  rendererSupportsImage: boolean;
}

export interface ThreePanelRenderPolicy {
  kittyActive: boolean;
  renderAscii: boolean;
  renderImage: boolean;
  frameOptions: ThreeAsciiRenderFrameOptions;
}

export interface ThreePanelRenderSize {
  columns: number;
  rows: number;
}

export interface ThreePanelRequestedMaxCellsInput {
  userMaxCells: number;
  pressureMaxCells?: number;
}

export function resolveThreePanelRenderSize(
  rect: ThreePanelRectLike,
  maxCells?: number,
): ThreePanelRenderSize {
  const columns = Math.max(1, Math.floor(rect.width));
  const rows = Math.max(1, Math.floor(rect.height));
  const cellLimit = Math.max(1, Math.floor(maxCells ?? columns * rows));
  const cells = columns * rows;
  if (cells <= cellLimit) return { columns, rows };

  const scale = Math.sqrt(cellLimit / cells);
  return {
    columns: Math.max(1, Math.min(columns, Math.floor(columns * scale))),
    rows: Math.max(1, Math.min(rows, Math.floor(rows * scale))),
  };
}

export function resolveThreePanelRequestedMaxCells(input: ThreePanelRequestedMaxCellsInput): number {
  const userCells = Math.max(1, Math.floor(input.userMaxCells));
  const pressureCap = input.pressureMaxCells === undefined
    ? userCells
    : Math.max(1, Math.floor(input.pressureMaxCells));
  return Math.min(userCells, pressureCap);
}

export function resolveThreePanelFrameInterval(frameInterval: number): number {
  return Math.max(1, frameInterval);
}

export function resolveThreePanelRenderPolicy(input: ThreePanelRenderPolicyInput): ThreePanelRenderPolicy {
  const kittyRequested = input.ascii.kittyGraphics;
  const kittyActive = Boolean(
    kittyRequested && input.graphicsAvailable && input.rendererSupportsImage &&
      input.graphicsRectangle.width > 0 && input.graphicsRectangle.height > 0,
  );
  const renderAscii = !kittyActive || !input.ascii.kittyDisableAscii;
  return {
    kittyActive,
    renderAscii,
    renderImage: kittyActive,
    frameOptions: {
      ansi: renderAscii,
      image: kittyActive,
    },
  };
}
