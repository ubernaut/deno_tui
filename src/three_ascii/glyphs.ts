// The browser compositor samples the edge LUT with a flipped Y coordinate.
// When we map edge directions directly to terminal glyphs, the diagonal
// characters must be swapped to match the browser's visible output.
export const EDGE_GLYPHS = [" ", "|", "-", "\\", "/"] as const;
export const FILL_GLYPHS = [" ", ".", ":", "C", "O", "P", "0", "?", "@", "█"] as const;
export const TERMINAL_GLYPHS = [
  " ",
  "|",
  "-",
  "\\",
  "/",
  " ",
  ".",
  ":",
  "C",
  "O",
  "P",
  "0",
  "?",
  "@",
  "█",
] as const;

export type EdgeDirection = -1 | 0 | 1 | 2 | 3;

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

  return Math.max(0, Math.min(9, Math.floor(value * 10) - 1));
}

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
    return FILL_GLYPHS[Math.max(0, Math.min(FILL_GLYPHS.length - 1, luminanceBucket))];
  }

  return " ";
}
