import type { asciiEffectOptions } from "./ascii_options.ts";

export type ThreePanelAsciiEffectOptions = ReturnType<typeof asciiEffectOptions>;

/** Compare the Three panel ASCII effect fields that require renderer effect updates. */
export function threePanelAsciiEffectOptionsEqual(
  left: ThreePanelAsciiEffectOptions | undefined,
  right: ThreePanelAsciiEffectOptions,
): boolean {
  if (!left) return false;
  return left.edgeThreshold === right.edgeThreshold &&
    left.normalThreshold === right.normalThreshold &&
    left.depthThreshold === right.depthThreshold &&
    left.exposure === right.exposure &&
    left.attenuation === right.attenuation &&
    left.blendWithBase === right.blendWithBase &&
    left.depthFalloff === right.depthFalloff &&
    left.depthOffset === right.depthOffset &&
    left.edges === right.edges &&
    left.fill === right.fill &&
    left.invertLuminance === right.invertLuminance;
}
