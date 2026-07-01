// The browser compositor samples the edge LUT with a flipped Y coordinate.
// When we map edge directions directly to terminal glyphs, the diagonal
// characters must be swapped to match the browser's visible output.
/** Built-in eDGE GLYPHS definitions. */
export const EDGE_GLYPHS = [" ", "|", "-", "\\", "/"] as const;
/** Built-in fILL GLYPHS definitions. */
export const FILL_GLYPHS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "█"] as const;
/** Built-in full-height block fill glyph definitions for terminal block mode. */
export const BLOCK_FILL_GLYPHS = [" ", "█", "█", "█", "█", "█", "█", "█", "█", "█"] as const;
/** Built-in aSCII FILL GLYPHS definitions. */
export const ASCII_FILL_GLYPHS = [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"] as const;
/** Built-in tERMINAL GLYPHS definitions. */
export const TERMINAL_GLYPHS = [
  " ",
  "|",
  "-",
  "\\",
  "/",
  " ",
  "▁",
  "▂",
  "▃",
  "▄",
  "▅",
  "▆",
  "▇",
  "█",
  "█",
] as const;

/** Built-in tERMINAL GLYPH STYLES definitions. */
export const TERMINAL_GLYPH_STYLES = ["blocks", "glyphs", "mixed"] as const;
/** Public type alias for a terminal Glyph Style. */
export type TerminalGlyphStyle = typeof TERMINAL_GLYPH_STYLES[number];

const MIN_VISIBLE_LUMINANCE = 0.015;

/** Public type alias for an edge Direction. */
export type EdgeDirection = -1 | 0 | 1 | 2 | 3;

/** Public helper for classify Edge Direction. */
export function classifyEdgeDirection(theta: number, hasEdge: boolean): EdgeDirection {
  if (!hasEdge || Number.isNaN(theta)) return -1;

  const absTheta = Math.abs(theta) / Math.PI;

  if ((0 <= absTheta && absTheta < 0.05) || (0.9 < absTheta && absTheta <= 1.0)) {
    return 0;
  }

  if (0.45 < absTheta && absTheta < 0.55) {
    return 1;
  }

  if (0.05 < absTheta && absTheta < 0.45) {
    return Math.sign(theta) > 0 ? 3 : 2;
  }

  if (0.55 < absTheta && absTheta < 0.9) {
    return Math.sign(theta) > 0 ? 2 : 3;
  }

  return -1;
}

/** Public helper for bucket Ascii Luminance. */
export function bucketAsciiLuminance(
  luminance: number,
  exposure = 1,
  attenuation = 1,
  invert = false,
): number {
  let value = Math.max(0, Math.min(1, Math.pow(Math.max(0, luminance) * exposure, attenuation)));

  if (invert) {
    value = 1 - value;
  }

  if (value <= MIN_VISIBLE_LUMINANCE) {
    return 0;
  }

  return Math.max(1, Math.min(9, Math.floor(value * 9) + 1));
}

/** Public helper for pick Dominant Edge Direction. */
export function pickDominantEdgeDirection(
  directions: Iterable<EdgeDirection>,
  edgeThreshold = 8,
): EdgeDirection {
  const buckets = [0, 0, 0, 0];

  for (const direction of directions) {
    if (direction >= 0) {
      buckets[direction] += 1;
    }
  }

  let bestDirection: EdgeDirection = -1;
  let bestCount = 0;

  for (let index = 0 as 0 | 1 | 2 | 3; index < 4; index += 1) {
    const count = buckets[index];
    if (count > bestCount) {
      bestCount = count;
      bestDirection = index;
    }
  }

  return bestCount < edgeThreshold ? -1 : bestDirection;
}

/** Public helper for glyph For Tile. */
export function glyphForTile(
  direction: EdgeDirection,
  luminanceBucket: number,
  drawEdges = true,
  drawFill = true,
): string {
  if (drawEdges && direction >= 0) {
    return EDGE_GLYPHS[direction + 1];
  }

  if (drawFill) {
    return blockFillGlyphForBucket(luminanceBucket);
  }

  return " ";
}

/** Public helper for picking a full-height terminal block fill glyph. */
export function blockFillGlyphForBucket(luminanceBucket: number): string {
  return BLOCK_FILL_GLYPHS[Math.max(0, Math.min(BLOCK_FILL_GLYPHS.length - 1, luminanceBucket))];
}
