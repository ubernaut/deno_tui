import type { AcerolaAsciiNodeOptions } from "../src/three_ascii/AcerolaAsciiNode.ts";
import { TERMINAL_GLYPH_STYLES, type TerminalGlyphStyle } from "../src/three_ascii/glyphs.ts";
import {
  ASCII_DEMO_PRESETS,
  type AsciiDemoPreset,
  DEFAULT_ASCII_DEMO_EFFECT,
} from "../src/three_ascii/demo_presets.ts";
import type { AsciiOptions, BorderMode } from "./types.ts";

const presetMap = new Map<string, AsciiDemoPreset>(ASCII_DEMO_PRESETS.map((preset) => [preset.id, preset]));

export function createDefaultAsciiOptions(border: BorderMode = "sharp"): AsciiOptions {
  return buildAsciiOptionsFromPreset("opentui-blocks", border);
}

export function cloneAsciiOptions(options: AsciiOptions): AsciiOptions {
  return { ...options };
}

export function buildAsciiOptionsFromPreset(presetId: string, border: BorderMode): AsciiOptions {
  const preset = presetMap.get(presetId) ?? ASCII_DEMO_PRESETS[0]!;
  const effect = {
    ...DEFAULT_ASCII_DEMO_EFFECT,
    ...preset.effect,
  };

  return {
    preset: preset.id,
    border,
    terminalGlyphStyle: preset.terminalGlyphStyle ?? "blocks",
    terminalEdgeBias: preset.terminalEdgeBias ?? 1,
    edgeThreshold: effect.edgeThreshold ?? 10,
    normalThreshold: effect.normalThreshold ?? 0.18,
    depthThreshold: effect.depthThreshold ?? 0.11,
    exposure: effect.exposure ?? 1.25,
    attenuation: effect.attenuation ?? 1.2,
    blendWithBase: effect.blendWithBase ?? 0.24,
    depthFalloff: effect.depthFalloff ?? 0.18,
    depthOffset: effect.depthOffset ?? 110,
    wireframeThickness: 8,
    edges: effect.edges ?? true,
    fill: effect.fill ?? true,
    invertLuminance: effect.invertLuminance ?? false,
    kittyGraphics: false,
    kittyDisableAscii: false,
  };
}

export function normalizeAsciiOptions(
  value: unknown,
  fallback: AsciiOptions = createDefaultAsciiOptions("sharp"),
): AsciiOptions {
  const base = cloneAsciiOptions(fallback);
  if (!value || typeof value !== "object") return base;
  const candidate = value as Partial<AsciiOptions>;
  const numeric = <K extends AsciiNumericControlKey>(key: K): number => {
    const next = Number(candidate[key]);
    return clampAsciiControlValue(key, Number.isFinite(next) ? next : Number(base[key]));
  };
  return {
    preset: typeof candidate.preset === "string" ? candidate.preset : base.preset,
    border: candidate.border === "rounded" || candidate.border === "sharp" || candidate.border === "ascii"
      ? candidate.border
      : base.border,
    terminalGlyphStyle: candidate.terminalGlyphStyle &&
        TERMINAL_GLYPH_STYLES.includes(candidate.terminalGlyphStyle)
      ? candidate.terminalGlyphStyle
      : base.terminalGlyphStyle,
    terminalEdgeBias: numeric("terminalEdgeBias"),
    edgeThreshold: numeric("edgeThreshold"),
    normalThreshold: numeric("normalThreshold"),
    depthThreshold: numeric("depthThreshold"),
    exposure: numeric("exposure"),
    attenuation: numeric("attenuation"),
    blendWithBase: numeric("blendWithBase"),
    depthFalloff: numeric("depthFalloff"),
    depthOffset: numeric("depthOffset"),
    wireframeThickness: numeric("wireframeThickness"),
    edges: typeof candidate.edges === "boolean" ? candidate.edges : base.edges,
    fill: typeof candidate.fill === "boolean" ? candidate.fill : base.fill,
    invertLuminance: typeof candidate.invertLuminance === "boolean" ? candidate.invertLuminance : base.invertLuminance,
    kittyGraphics: typeof candidate.kittyGraphics === "boolean" ? candidate.kittyGraphics : base.kittyGraphics,
    kittyDisableAscii: typeof candidate.kittyDisableAscii === "boolean"
      ? candidate.kittyDisableAscii
      : base.kittyDisableAscii,
  };
}

export function terminalGlyphStyleLabel(style: TerminalGlyphStyle) {
  switch (style) {
    case "blocks":
      return "Blocks";
    case "glyphs":
      return "Glyphs";
    case "mixed":
      return "Mixed";
  }
}

export function applyAsciiPreset(target: AsciiOptions, presetId: string) {
  const kittyGraphics = target.kittyGraphics;
  const kittyDisableAscii = target.kittyDisableAscii;
  const next = buildAsciiOptionsFromPreset(presetId, target.border);
  Object.assign(target, next, { kittyGraphics, kittyDisableAscii });
}

export function asciiPresetLabel(presetId: string) {
  return presetMap.get(presetId)?.label ?? presetId.toUpperCase();
}

export function asciiEffectOptions(options: AsciiOptions): AcerolaAsciiNodeOptions {
  return {
    ...DEFAULT_ASCII_DEMO_EFFECT,
    edgeThreshold: options.edgeThreshold,
    normalThreshold: options.normalThreshold,
    depthThreshold: options.depthThreshold,
    exposure: options.exposure,
    attenuation: options.attenuation,
    blendWithBase: options.blendWithBase,
    depthFalloff: options.depthFalloff,
    depthOffset: options.depthOffset,
    edges: options.edges,
    fill: options.fill,
    invertLuminance: options.invertLuminance,
  };
}

export function asciiControlValues(
  key: AsciiNumericControlKey,
) {
  switch (key) {
    case "edgeThreshold":
      return [4, 6, 8, 10, 12, 14, 16, 18];
    case "normalThreshold":
      return [0.08, 0.12, 0.16, 0.18, 0.22, 0.26, 0.3];
    case "depthThreshold":
      return [0.05, 0.08, 0.11, 0.14, 0.17, 0.2];
    case "exposure":
      return [0.8, 1, 1.1, 1.25, 1.4, 1.6, 1.8];
    case "attenuation":
      return [0.8, 1, 1.1, 1.2, 1.3, 1.4, 1.6];
    case "blendWithBase":
      return [0, 0.12, 0.24, 0.32, 0.5, 0.75, 1];
    case "depthFalloff":
      return [0, 0.08, 0.14, 0.18, 0.24, 0.32, 0.4];
    case "depthOffset":
      return [0, 60, 90, 105, 110, 116, 140, 180];
    case "wireframeThickness":
      return [0.5, 0.75, 1, 1.4, 1.8, 2, 2.4, 3, 4, 6, 8, 12, 16, 24, 32];
    case "terminalEdgeBias":
      return [0.6, 0.8, 0.92, 1, 1.15, 1.3, 1.4, 1.6, 1.8];
  }
}

export type AsciiNumericControlKey = keyof Pick<
  AsciiOptions,
  | "edgeThreshold"
  | "normalThreshold"
  | "depthThreshold"
  | "exposure"
  | "attenuation"
  | "blendWithBase"
  | "depthFalloff"
  | "depthOffset"
  | "wireframeThickness"
  | "terminalEdgeBias"
>;

export function clampAsciiControlValue(key: AsciiNumericControlKey, value: number): number {
  const values = asciiControlValues(key);
  const min = values[0] ?? 0;
  const max = values.at(-1) ?? min;
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function formatAsciiControlValue(
  key: AsciiNumericControlKey,
  value: number,
) {
  switch (key) {
    case "edgeThreshold":
      return value.toFixed(1);
    case "depthOffset":
      return value.toFixed(0);
    default:
      return value.toFixed(2);
  }
}

export { ASCII_DEMO_PRESETS };
export { TERMINAL_GLYPH_STYLES };
