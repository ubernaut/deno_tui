// Copyright 2023 Im-Beast. MIT license.
import { createAnsiStyle, type ThemeEngineOptions, type ThemePack, type ThemePalette } from "./theme.ts";

/** Full color palette adapted from the GeoRefine grWizard Textual themes. */
export interface GrWizardThemePalette {
  name: string;
  label: string;
  description: string;
  dark: boolean;
  bg: string;
  bgAlt: string;
  panel: string;
  panelAlt: string;
  surface: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accentDeep: string;
  warm: string;
  warmDeep: string;
  success: string;
  warning: string;
  danger: string;
  idle: string;
  review: string;
  subtitle: string;
}

/** GeoRefine grWizard-inspired palette metadata with dark and light variants. */
export const grWizardThemePalettes: readonly GrWizardThemePalette[] = [
  {
    name: "arcane",
    label: "Arcane Tide",
    description: "Deep navy, cyan glass, and brass highlights.",
    dark: true,
    bg: "#081219",
    bgAlt: "#0d1a22",
    panel: "#10222c",
    panelAlt: "#152c37",
    surface: "#1a3644",
    border: "#335868",
    borderStrong: "#4d7a8f",
    text: "#f6f1e8",
    textMuted: "#9db3bf",
    textSoft: "#c7d8df",
    accent: "#7ad7ff",
    accentDeep: "#2d5364",
    warm: "#f4c86a",
    warmDeep: "#5d4722",
    success: "#9ad29a",
    warning: "#f0b35f",
    danger: "#ef7d6f",
    idle: "#7b8a96",
    review: "#b99adf",
    subtitle: "#b8d6c7",
  },
  {
    name: "forge",
    label: "Forge Ember",
    description: "Sooty charcoal with ember copper and furnace gold.",
    dark: true,
    bg: "#160d0b",
    bgAlt: "#211310",
    panel: "#341d18",
    panelAlt: "#472823",
    surface: "#5d372f",
    border: "#885845",
    borderStrong: "#c28969",
    text: "#f8eadc",
    textMuted: "#bfad9d",
    textSoft: "#e3d2c4",
    accent: "#ff9f68",
    accentDeep: "#6e3b2a",
    warm: "#ffd166",
    warmDeep: "#7c5a20",
    success: "#a9d290",
    warning: "#f2b45f",
    danger: "#f08073",
    idle: "#8e7a70",
    review: "#d6a5f3",
    subtitle: "#e4c7a9",
  },
  {
    name: "grove",
    label: "Verdant Grove",
    description: "Pine green shadows with mint and moss accents.",
    dark: true,
    bg: "#08130d",
    bgAlt: "#0d1d15",
    panel: "#153126",
    panelAlt: "#1d4434",
    surface: "#28614b",
    border: "#4c7c63",
    borderStrong: "#76ae8b",
    text: "#eef7ef",
    textMuted: "#a3baaa",
    textSoft: "#d0e3d3",
    accent: "#7be0bb",
    accentDeep: "#295948",
    warm: "#d7cb72",
    warmDeep: "#5f561f",
    success: "#9fda8d",
    warning: "#e9bf60",
    danger: "#ef8376",
    idle: "#778a7d",
    review: "#99bbef",
    subtitle: "#b9dcc2",
  },
  {
    name: "velvet",
    label: "Royal Velvet",
    description: "Plum lacquer, rose neon, and velvet gold.",
    dark: true,
    bg: "#100914",
    bgAlt: "#1a0f21",
    panel: "#281534",
    panelAlt: "#381f47",
    surface: "#523066",
    border: "#78518f",
    borderStrong: "#ac7cc8",
    text: "#f7effa",
    textMuted: "#b8a6c4",
    textSoft: "#ddd0e6",
    accent: "#f694d8",
    accentDeep: "#643257",
    warm: "#ffd08b",
    warmDeep: "#6e4e1f",
    success: "#aad68c",
    warning: "#f3b66b",
    danger: "#f27d96",
    idle: "#8a7c95",
    review: "#9db7ff",
    subtitle: "#dfbfed",
  },
  {
    name: "parchment",
    label: "Parchment Brass",
    description: "Warm ivory panels with brass, ink, and red-wax accents.",
    dark: false,
    bg: "#f6efdf",
    bgAlt: "#efe5d2",
    panel: "#e6d9bf",
    panelAlt: "#dbcaa9",
    surface: "#d0b98f",
    border: "#9b7c4a",
    borderStrong: "#785d2e",
    text: "#2f2415",
    textMuted: "#756347",
    textSoft: "#4a3920",
    accent: "#2f7f9f",
    accentDeep: "#8dc5d8",
    warm: "#b98a2b",
    warmDeep: "#ecd49a",
    success: "#5d915b",
    warning: "#cb8a2c",
    danger: "#b15b52",
    idle: "#938165",
    review: "#7c70b8",
    subtitle: "#5d6f55",
  },
  {
    name: "seaglass",
    label: "Seaglass Ledger",
    description: "Cool paper whites with teal framing and slate typography.",
    dark: false,
    bg: "#edf4f3",
    bgAlt: "#e0ece9",
    panel: "#d2e2dd",
    panelAlt: "#bfd4cd",
    surface: "#a8c4bc",
    border: "#5f8f86",
    borderStrong: "#426e67",
    text: "#1e3330",
    textMuted: "#5d7670",
    textSoft: "#31524d",
    accent: "#2a91a5",
    accentDeep: "#96d5de",
    warm: "#d29a34",
    warmDeep: "#edd8a7",
    success: "#4d8b65",
    warning: "#c9853a",
    danger: "#b45e63",
    idle: "#7a8e89",
    review: "#6f7fc1",
    subtitle: "#52706b",
  },
] as const;

/** Ready-to-register theme packs for gallery demos, settings screens, and apps. */
export const grWizardThemePacks: readonly ThemePack[] = grWizardThemePalettes.map((palette) => ({
  id: `grwizard-${palette.name}`,
  label: palette.label,
  description: palette.description,
  palette: grWizardThemePaletteDefinition(palette),
  options: grWizardThemeOptions(palette),
}));

/** Converts a grWizard palette into semantic TUI theme tokens. */
export function grWizardThemePaletteDefinition(palette: GrWizardThemePalette): ThemePalette {
  return {
    id: `grwizard-${palette.name}`,
    label: palette.label,
    tokens: {
      foreground: style({ foreground: palette.text }),
      muted: style({ foreground: palette.textMuted, dim: true }),
      accent: style({ foreground: palette.accent, bold: true }),
      success: style({ foreground: palette.success, bold: true }),
      warning: style({ foreground: palette.warning, bold: true }),
      danger: style({ foreground: palette.danger, bold: true }),
      surface: style({ foreground: palette.text, background: palette.panelAlt }),
    },
  };
}

/** Builds component variants that mirror the grWizard status, review, and focus treatments. */
export function grWizardThemeOptions(palette: GrWizardThemePalette): ThemeEngineOptions {
  return {
    components: {
      Badge: {
        base: {
          base: "muted",
          focused: "accent",
          active: "success",
          disabled: "muted",
        },
        variants: {
          blocked: { base: "danger" },
          review: { base: style({ foreground: palette.review, bold: true }) },
          idle: { base: style({ foreground: palette.idle }) },
        },
      },
      Button: {
        base: {
          base: "foreground",
          focused: "accent",
          active: "success",
          disabled: "muted",
        },
        variants: {
          danger: { base: "danger", focused: "warning" },
          warm: { base: "warning", active: "accent" },
        },
      },
      DataTable: {
        base: {
          base: "foreground",
          focused: "accent",
          active: "surface",
          disabled: "muted",
        },
      },
      Frame: {
        base: {
          base: style({ foreground: palette.border, background: palette.panel }),
          focused: style({ foreground: palette.borderStrong, background: palette.panelAlt, bold: true }),
          active: style({ foreground: palette.accent, background: palette.surface, bold: true }),
          disabled: "muted",
        },
      },
      Input: {
        base: {
          base: "foreground",
          focused: "accent",
          active: "warning",
          disabled: "muted",
        },
      },
      List: {
        base: {
          base: "foreground",
          focused: "accent",
          active: "surface",
          disabled: "muted",
        },
      },
      StatusBar: {
        base: {
          base: "surface",
          focused: "accent",
          active: "success",
          disabled: "muted",
        },
        variants: {
          warning: { base: "warning" },
          danger: { base: "danger" },
        },
      },
      Text: {
        base: {
          base: "foreground",
          focused: "accent",
          active: "success",
          disabled: "muted",
        },
        variants: {
          subtitle: { base: style({ foreground: palette.subtitle, italic: true }) },
          soft: { base: style({ foreground: palette.textSoft }) },
        },
      },
    },
  };
}

function style(spec: { foreground?: string; background?: string; bold?: boolean; dim?: boolean; italic?: boolean }) {
  return createAnsiStyle({
    foreground: spec.foreground ? hexRgb(spec.foreground) : undefined,
    background: spec.background ? hexRgb(spec.background) : undefined,
    bold: spec.bold,
    dim: spec.dim,
    italic: spec.italic,
  });
}

function hexRgb(value: string): [number, number, number] {
  const hex = value.replace(/^#/, "");
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}
