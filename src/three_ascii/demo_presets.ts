import type { AcerolaAsciiNodeOptions } from "./AcerolaAsciiNode.ts";

export type AsciiToggleControlKey = "edges" | "fill" | "invertLuminance";
export type AsciiNumericControlKey =
  | "edgeThreshold"
  | "normalThreshold"
  | "depthThreshold"
  | "exposure"
  | "attenuation"
  | "blendWithBase"
  | "depthFalloff"
  | "depthOffset";

export interface AsciiDemoPreset {
  id: string;
  label: string;
  description: string;
  effect: Partial<AcerolaAsciiNodeOptions>;
  terminalEdgeBias?: number;
}

export interface AsciiNumericControlDefinition {
  key: AsciiNumericControlKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
}

export interface AsciiToggleControlDefinition {
  key: AsciiToggleControlKey;
  label: string;
}

const fixed = (digits: number) => (value: number): string => value.toFixed(digits);

export const DEFAULT_ASCII_DEMO_EFFECT: AcerolaAsciiNodeOptions = {
  exposure: 1.25,
  attenuation: 1.2,
  blendWithBase: 0.24,
  asciiColor: "#f2ebc8",
  backgroundColor: "#071017",
  depthFalloff: 0.18,
  depthOffset: 110,
  edgeThreshold: 10,
  normalThreshold: 0.18,
  depthThreshold: 0.11,
  edges: true,
  fill: true,
  invertLuminance: false,
};

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

export const ASCII_TOGGLE_CONTROLS: readonly AsciiToggleControlDefinition[] = [
  { key: "edges", label: "Edges" },
  { key: "fill", label: "Fill" },
  { key: "invertLuminance", label: "Invert fill" },
] as const;

export const ASCII_DEMO_PRESETS: readonly AsciiDemoPreset[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Matches the current demo tuning.",
    effect: {
      ...DEFAULT_ASCII_DEMO_EFFECT,
    },
    terminalEdgeBias: 1,
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
  },
  {
    id: "fill-only",
    label: "Fill Only",
    description: "Disables edges and leans into the luminance glyph set.",
    effect: {
      edgeThreshold: 12,
      normalThreshold: 0.2,
      depthThreshold: 0.13,
      exposure: 1.2,
      attenuation: 1.08,
      blendWithBase: 0.32,
      depthFalloff: 0.18,
      depthOffset: 110,
      edges: false,
      fill: true,
      invertLuminance: false,
    },
    terminalEdgeBias: 1.4,
  },
] as const;
