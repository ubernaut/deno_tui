// Copyright 2023 Im-Beast. MIT license.

/** Output selection for one three Ascii renderer pass. */
export interface ThreeAsciiRenderFrameOptions {
  ansi?: boolean;
  image?: boolean;
}

/** Minimal render frame returned when the renderer has no drawable area. */
export interface ThreeAsciiEmptyRenderFrame {
  grid?: string[][];
}

export interface ThreeAsciiRenderFrameSelection {
  renderAnsi: boolean;
  renderImage: boolean;
}

export function resolveThreeAsciiRenderFrameSelection(
  options: ThreeAsciiRenderFrameOptions = { ansi: true },
): ThreeAsciiRenderFrameSelection {
  return {
    renderAnsi: options.ansi ?? true,
    renderImage: options.image ?? false,
  };
}

export function emptyThreeAsciiRenderFrame(selection: ThreeAsciiRenderFrameSelection): ThreeAsciiEmptyRenderFrame {
  return { grid: selection.renderAnsi ? [] : undefined };
}
