import type { AcerolaAsciiNodeOptions } from "./AcerolaAsciiNode.ts";
import { ASCII_DEMO_PRESETS, type AsciiDemoPreset, DEFAULT_ASCII_DEMO_EFFECT } from "./demo_presets.ts";
import { TERMINAL_GLYPH_STYLES, type TerminalGlyphStyle } from "./glyphs.ts";

/** Supported border presets for Three ASCII demo frames and hosted workbench windows. */
export const THREE_ASCII_BORDER_MODES = ["rounded", "sharp", "ascii"] as const;

/** Border preset identifier used by shared Three ASCII demo configuration. */
export type ThreeAsciiBorderMode = typeof THREE_ASCII_BORDER_MODES[number];

/** Shared, serializable Three ASCII renderer configuration for terminal and web demos. */
export interface ThreeAsciiConfigOptions {
  preset: string;
  border: ThreeAsciiBorderMode;
  terminalGlyphStyle: TerminalGlyphStyle;
  terminalEdgeBias: number;
  edgeThreshold: number;
  normalThreshold: number;
  depthThreshold: number;
  exposure: number;
  attenuation: number;
  blendWithBase: number;
  depthFalloff: number;
  depthOffset: number;
  wireframeThickness: number;
  renderMaxCells: number;
  deferredReadbackSlots: number;
  edges: boolean;
  fill: boolean;
  invertLuminance: boolean;
  kittyGraphics: boolean;
  kittyDisableAscii: boolean;
}

const presetMap = createPresetMap();

function createPresetMap(): Map<string, AsciiDemoPreset> {
  const map = new Map<string, AsciiDemoPreset>();
  for (const preset of ASCII_DEMO_PRESETS) {
    map.set(preset.id, preset);
  }
  return map;
}

/** Create the default block-style Three ASCII configuration. */
export function createDefaultAsciiOptions(border: ThreeAsciiBorderMode = "sharp"): ThreeAsciiConfigOptions {
  return buildAsciiOptionsFromPreset("opentui-blocks", border);
}

/** Clone a Three ASCII configuration object for signal or workspace persistence boundaries. */
export function cloneAsciiOptions(options: ThreeAsciiConfigOptions): ThreeAsciiConfigOptions {
  return { ...options };
}

/** Build a complete Three ASCII configuration from a named demo preset. */
export function buildAsciiOptionsFromPreset(presetId: string, border: ThreeAsciiBorderMode): ThreeAsciiConfigOptions {
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
    renderMaxCells: 3_840,
    deferredReadbackSlots: 6,
    edges: effect.edges ?? true,
    fill: effect.fill ?? true,
    invertLuminance: effect.invertLuminance ?? false,
    kittyGraphics: false,
    kittyDisableAscii: false,
  };
}

/** Normalize untrusted or persisted Three ASCII option data into a complete bounded configuration. */
export function normalizeAsciiOptions(
  value: unknown,
  fallback: ThreeAsciiConfigOptions = createDefaultAsciiOptions("sharp"),
): ThreeAsciiConfigOptions {
  const base = cloneAsciiOptions(fallback);
  if (!value || typeof value !== "object") return base;
  const candidate = value as Partial<ThreeAsciiConfigOptions>;
  const numeric = <K extends ThreeAsciiOptionNumericControlKey>(key: K): number => {
    const next = Number(candidate[key]);
    return clampAsciiControlValue(key, Number.isFinite(next) ? next : Number(base[key]));
  };
  return {
    preset: typeof candidate.preset === "string" ? candidate.preset : base.preset,
    border: THREE_ASCII_BORDER_MODES.includes(candidate.border as ThreeAsciiBorderMode)
      ? candidate.border as ThreeAsciiBorderMode
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
    renderMaxCells: numeric("renderMaxCells"),
    deferredReadbackSlots: numeric("deferredReadbackSlots"),
    edges: typeof candidate.edges === "boolean" ? candidate.edges : base.edges,
    fill: typeof candidate.fill === "boolean" ? candidate.fill : base.fill,
    invertLuminance: typeof candidate.invertLuminance === "boolean" ? candidate.invertLuminance : base.invertLuminance,
    kittyGraphics: typeof candidate.kittyGraphics === "boolean" ? candidate.kittyGraphics : base.kittyGraphics,
    kittyDisableAscii: typeof candidate.kittyDisableAscii === "boolean"
      ? candidate.kittyDisableAscii
      : base.kittyDisableAscii,
  };
}

/** Convert a terminal glyph style identifier into UI display text. */
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

/** Apply a named preset to an existing configuration while preserving Kitty transport preferences. */
export function applyAsciiPreset(target: ThreeAsciiConfigOptions, presetId: string) {
  const kittyGraphics = target.kittyGraphics;
  const kittyDisableAscii = target.kittyDisableAscii;
  const renderMaxCells = target.renderMaxCells;
  const deferredReadbackSlots = target.deferredReadbackSlots;
  const next = buildAsciiOptionsFromPreset(presetId, target.border);
  Object.assign(target, next, { kittyGraphics, kittyDisableAscii, renderMaxCells, deferredReadbackSlots });
}

/** Return the display label for a named ASCII preset. */
export function asciiPresetLabel(presetId: string) {
  return presetMap.get(presetId)?.label ?? presetId.toUpperCase();
}

/** Convert shared Three ASCII UI configuration into Acerola renderer effect options. */
export function asciiEffectOptions(options: ThreeAsciiConfigOptions): AcerolaAsciiNodeOptions {
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

/** Return the recommended stepped values for a numeric Three ASCII control. */
export function asciiControlValues(
  key: ThreeAsciiOptionNumericControlKey,
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
    case "renderMaxCells":
      return [60, 120, 240, 480, 960, 1_920, 3_840, 7_680, 15_400, 30_720];
    case "deferredReadbackSlots":
      return [2, 4, 6, 8, 12];
    case "terminalEdgeBias":
      return [0.6, 0.8, 0.92, 1, 1.15, 1.3, 1.4, 1.6, 1.8];
  }
}

/** Numeric Three ASCII configuration key supported by the shared control model. */
export type ThreeAsciiOptionNumericControlKey = keyof Pick<
  ThreeAsciiConfigOptions,
  | "edgeThreshold"
  | "normalThreshold"
  | "depthThreshold"
  | "exposure"
  | "attenuation"
  | "blendWithBase"
  | "depthFalloff"
  | "depthOffset"
  | "wireframeThickness"
  | "renderMaxCells"
  | "deferredReadbackSlots"
  | "terminalEdgeBias"
>;

/** Clamp a numeric Three ASCII control value to the supported UI and renderer range. */
export function clampAsciiControlValue(key: ThreeAsciiOptionNumericControlKey, value: number): number {
  const values = asciiControlValues(key);
  const min = values[0] ?? 0;
  const max = values.at(-1) ?? min;
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** Format a numeric Three ASCII control value for compact terminal and web controls. */
export function formatAsciiControlValue(
  key: ThreeAsciiOptionNumericControlKey,
  value: number,
) {
  switch (key) {
    case "edgeThreshold":
      return value.toFixed(1);
    case "depthOffset":
    case "renderMaxCells":
    case "deferredReadbackSlots":
      return value.toFixed(0);
    default:
      return value.toFixed(2);
  }
}
