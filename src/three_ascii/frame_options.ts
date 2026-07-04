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

/** Normalized output selection for one renderer frame. */
export interface ThreeAsciiRenderFrameSelection {
  renderAnsi: boolean;
  renderImage: boolean;
}

/** Shared options object for ANSI-only renderer frames. */
export const THREE_ASCII_ANSI_FRAME_OPTIONS: Readonly<ThreeAsciiRenderFrameOptions> = { ansi: true };
/** Shared options object for image-only renderer frames. */
export const THREE_ASCII_IMAGE_FRAME_OPTIONS: Readonly<ThreeAsciiRenderFrameOptions> = { ansi: false, image: true };

/** Resolves optional frame-output flags into explicit ANSI/image booleans. */
export function resolveThreeAsciiRenderFrameSelection(
  options: ThreeAsciiRenderFrameOptions = THREE_ASCII_ANSI_FRAME_OPTIONS,
): ThreeAsciiRenderFrameSelection {
  return {
    renderAnsi: options.ansi ?? true,
    renderImage: options.image ?? false,
  };
}

/** Writes output selection into a caller-owned record for hot render paths. */
export function resolveThreeAsciiRenderFrameSelectionInto(
  target: ThreeAsciiRenderFrameSelection,
  options: ThreeAsciiRenderFrameOptions = THREE_ASCII_ANSI_FRAME_OPTIONS,
): ThreeAsciiRenderFrameSelection {
  target.renderAnsi = options.ansi ?? true;
  target.renderImage = options.image ?? false;
  return target;
}

/** Creates the empty frame shape matching the selected output channels. */
export function emptyThreeAsciiRenderFrame(selection: ThreeAsciiRenderFrameSelection): ThreeAsciiEmptyRenderFrame {
  return { grid: selection.renderAnsi ? [] : undefined };
}
