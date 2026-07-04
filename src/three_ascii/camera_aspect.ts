export interface ThreeAsciiCameraAspectInput {
  columns: number;
  rows: number;
  pixelAspectRatio: number;
}

export const THREE_ASCII_CAMERA_ASPECT_EPSILON = 0.000001;

export function computeThreeAsciiCameraAspect(input: ThreeAsciiCameraAspectInput): number {
  return (input.columns * input.pixelAspectRatio) / Math.max(1, input.rows);
}

export function shouldUpdateThreeAsciiCameraAspect(
  current: number,
  next: number,
  epsilon = THREE_ASCII_CAMERA_ASPECT_EPSILON,
): boolean {
  return Math.abs(current - next) > epsilon;
}
