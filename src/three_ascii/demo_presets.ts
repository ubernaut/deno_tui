import type { AcerolaAsciiNodeOptions } from "./AcerolaAsciiNode.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";

/** Key union for ascii Toggle Control values. */
export type AsciiToggleControlKey = "edges" | "fill" | "invertLuminance";
/** Key union for ascii Numeric Control values. */
export type AsciiNumericControlKey =
  | "edgeThreshold"
  | "normalThreshold"
  | "depthThreshold"
  | "exposure"
  | "attenuation"
  | "blendWithBase"
  | "depthFalloff"
  | "depthOffset";

/** Public interface describing an ascii Demo Preset. */
export interface AsciiDemoPreset {
  id: string;
  label: string;
  description: string;
  effect: Partial<AcerolaAsciiNodeOptions>;
  terminalEdgeBias?: number;
  terminalGlyphStyle?: TerminalGlyphStyle;
}

/** Public interface describing an ascii Demo Preset Summary. */
export interface AsciiDemoPresetSummary {
  id: string;
  label: string;
  description: string;
  terminalGlyphStyle: TerminalGlyphStyle;
  terminalEdgeBias: number;
  edges: boolean;
  fill: boolean;
}

/** Public interface describing an ascii Numeric Control Definition. */
export interface AsciiNumericControlDefinition {
  key: AsciiNumericControlKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
}

/** Public interface describing an ascii Toggle Control Definition. */
export interface AsciiToggleControlDefinition {
  key: AsciiToggleControlKey;
  label: string;
}

const fixed = (digits: number) => (value: number): string => value.toFixed(digits);

/** Built-in dEFAULT ASCII DEMO EFFECT definitions. */
export const DEFAULT_ASCII_DEMO_EFFECT: AcerolaAsciiNodeOptions = {
  exposure: 1.1,
  attenuation: 1,
  blendWithBase: 1,
  asciiColor: "#ffffff",
  backgroundColor: "#000000",
  depthFalloff: 0,
  depthOffset: 180,
  edgeThreshold: 12,
  normalThreshold: 0.2,
  depthThreshold: 0.13,
  edges: false,
  fill: true,
  invertLuminance: false,
};

/** Built-in aSCII NUMERIC CONTROLS definitions. */
export const ASCII_NUMERIC_CONTROLS: readonly AsciiNumericControlDefinition[] = [
  { key: "edgeThreshold", label: "Edge threshold", min: 2, max: 20, step: 0.5, format: fixed(1) },
  { key: "normalThreshold", label: "Normal edge", min: 0.05, max: 0.4, step: 0.01, format: fixed(2) },
  { key: "depthThreshold", label: "Depth edge", min: 0.03, max: 0.25, step: 0.01, format: fixed(2) },
  { key: "exposure", label: "Exposure", min: 0.7, max: 1.8, step: 0.01, format: fixed(2) },
  { key: "attenuation", label: "Attenuation", min: 0.7, max: 1.6, step: 0.01, format: fixed(2) },
  { key: "blendWithBase", label: "Base blend", min: 0, max: 1, step: 0.01, format: fixed(2) },
  { key: "depthFalloff", label: "Fog falloff", min: 0, max: 0.4, step: 0.01, format: fixed(2) },
  { key: "depthOffset", label: "Fog offset", min: 0, max: 180, step: 1, format: fixed(0) },
] as const;

/** Built-in aSCII TOGGLE CONTROLS definitions. */
export const ASCII_TOGGLE_CONTROLS: readonly AsciiToggleControlDefinition[] = [
  { key: "edges", label: "Edges" },
  { key: "fill", label: "Fill" },
  { key: "invertLuminance", label: "Invert fill" },
] as const;

/** Built-in aSCII DEMO PRESETS definitions. */
export const ASCII_DEMO_PRESETS: readonly AsciiDemoPreset[] = [
  {
    id: "opentui-blocks",
    label: "OpenTUI Blocks",
    description: "Chunky fill-first blocks tuned to read like the Neon Exodus OpenTUI panels.",
    effect: {
      edgeThreshold: 14,
      normalThreshold: 0.24,
      depthThreshold: 0.15,
      exposure: 1.28,
      attenuation: 0.96,
      blendWithBase: 1,
      depthFalloff: 0,
      depthOffset: 150,
      edges: false,
      fill: true,
      invertLuminance: false,
    },
    terminalEdgeBias: 1.45,
    terminalGlyphStyle: "blocks",
  },
  {
    id: "glyph-atlas",
    label: "Glyph Atlas",
    description: "Character-ramp ASCII output for a lighter Acerola glyph look.",
    effect: {
      edgeThreshold: 10,
      normalThreshold: 0.18,
      depthThreshold: 0.11,
      exposure: 1.2,
      attenuation: 1.08,
      blendWithBase: 0.35,
      depthFalloff: 0.08,
      depthOffset: 140,
      edges: true,
      fill: true,
      invertLuminance: false,
    },
    terminalEdgeBias: 1,
    terminalGlyphStyle: "glyphs",
  },
  {
    id: "mixed-best",
    label: "Mixed Best",
    description: "Chooses across block and character glyphs using the closest terminal coverage match.",
    effect: {
      edgeThreshold: 11,
      normalThreshold: 0.19,
      depthThreshold: 0.12,
      exposure: 1.22,
      attenuation: 1.02,
      blendWithBase: 0.7,
      depthFalloff: 0.06,
      depthOffset: 145,
      edges: true,
      fill: true,
      invertLuminance: false,
    },
    terminalEdgeBias: 1.15,
    terminalGlyphStyle: "mixed",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Matches the current demo tuning.",
    effect: {
      ...DEFAULT_ASCII_DEMO_EFFECT,
    },
    terminalEdgeBias: 1,
    terminalGlyphStyle: "mixed",
  },
  {
    id: "soft-fill",
    label: "Soft Fill",
    description: "Pulls back edges and lets the fill atlas carry more of the shape.",
    effect: {
      edgeThreshold: 12,
      normalThreshold: 0.21,
      depthThreshold: 0.14,
      exposure: 1.16,
      attenuation: 1.04,
      blendWithBase: 0.34,
      depthFalloff: 0.14,
      depthOffset: 105,
      edges: true,
      fill: true,
      invertLuminance: false,
    },
    terminalEdgeBias: 1.3,
    terminalGlyphStyle: "glyphs",
  },
  {
    id: "contrast",
    label: "High Contrast",
    description: "Sharper edges, stronger glyph separation, brighter highlights.",
    effect: {
      edgeThreshold: 8,
      normalThreshold: 0.14,
      depthThreshold: 0.08,
      exposure: 1.38,
      attenuation: 1.34,
      blendWithBase: 0.15,
      depthFalloff: 0.22,
      depthOffset: 116,
      edges: true,
      fill: true,
      invertLuminance: false,
    },
    terminalEdgeBias: 0.92,
    terminalGlyphStyle: "mixed",
  },
  {
    id: "wire",
    label: "Wire",
    description: "Edge-first look with fill disabled.",
    effect: {
      edgeThreshold: 9,
      normalThreshold: 0.16,
      depthThreshold: 0.1,
      exposure: 1.14,
      attenuation: 1,
      blendWithBase: 0,
      depthFalloff: 0.1,
      depthOffset: 100,
      edges: true,
      fill: false,
      invertLuminance: false,
    },
    terminalEdgeBias: 0.88,
    terminalGlyphStyle: "glyphs",
  },
  {
    id: "fill-only",
    label: "Fill Only",
    description: "Disables edges and keeps the original model color visible through the glyphs.",
    effect: {
      edgeThreshold: 12,
      normalThreshold: 0.2,
      depthThreshold: 0.13,
      exposure: 1.1,
      attenuation: 1,
      blendWithBase: 1,
      depthFalloff: 0,
      depthOffset: 180,
      edges: false,
      fill: true,
      invertLuminance: false,
    },
    terminalEdgeBias: 1.2,
    terminalGlyphStyle: "blocks",
  },
] as const;

/** Public helper for ascii Demo Preset Ids. */
export function asciiDemoPresetIds(style?: TerminalGlyphStyle): string[] {
  const presets = ASCII_DEMO_PRESETS;
  const ids: string[] = [];
  for (const preset of presets) {
    if (style !== undefined && (preset.terminalGlyphStyle ?? "blocks") !== style) continue;
    ids.push(preset.id);
  }
  return ids;
}

/** Public helper for ascii Demo Presets. */
export function asciiDemoPresets(style?: TerminalGlyphStyle): AsciiDemoPreset[] {
  const presets: AsciiDemoPreset[] = [];
  for (const preset of ASCII_DEMO_PRESETS) {
    if (style !== undefined && (preset.terminalGlyphStyle ?? "blocks") !== style) continue;
    presets.push(cloneAsciiDemoPreset(preset));
  }
  return presets;
}

/** Finds a matching ascii Demo Preset record when one exists. */
export function findAsciiDemoPreset(
  id: string,
  fallbackId: string | undefined = ASCII_DEMO_PRESETS[0]?.id,
): AsciiDemoPreset | undefined {
  const preset = findPreset(id) ?? findPreset(fallbackId);
  return preset === undefined ? undefined : cloneAsciiDemoPreset(preset);
}

/** Public helper for ascii Demo Preset Summaries. */
export function asciiDemoPresetSummaries(style?: TerminalGlyphStyle): AsciiDemoPresetSummary[] {
  const summaries: AsciiDemoPresetSummary[] = [];
  for (const preset of ASCII_DEMO_PRESETS) {
    if (style !== undefined && (preset.terminalGlyphStyle ?? "blocks") !== style) continue;
    summaries.push({
      id: preset.id,
      label: preset.label,
      description: preset.description,
      terminalGlyphStyle: preset.terminalGlyphStyle ?? "blocks",
      terminalEdgeBias: preset.terminalEdgeBias ?? 1,
      edges: preset.effect.edges ?? DEFAULT_ASCII_DEMO_EFFECT.edges ?? false,
      fill: preset.effect.fill ?? DEFAULT_ASCII_DEMO_EFFECT.fill ?? true,
    });
  }
  return summaries;
}

function cloneAsciiDemoPreset(preset: AsciiDemoPreset): AsciiDemoPreset {
  return {
    ...preset,
    effect: { ...preset.effect },
  };
}

function findPreset(id: string | undefined): AsciiDemoPreset | undefined {
  if (id === undefined) return undefined;
  for (const preset of ASCII_DEMO_PRESETS) {
    if (preset.id === id) return preset;
  }
  return undefined;
}
