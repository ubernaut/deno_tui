// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import { TERMINAL_GLYPH_STYLES } from "../three_ascii/glyphs.ts";
import {
  applyAsciiPreset,
  asciiControlValues,
  asciiPresetLabel,
  cloneAsciiOptions,
  createDefaultAsciiOptions,
  formatAsciiControlValue,
  terminalGlyphStyleLabel,
  type ThreeAsciiConfigOptions,
  type ThreeAsciiOptionNumericControlKey,
} from "../three_ascii/options.ts";

/** Boolean Three ASCII renderer option exposed by workbench config controls. */
export type WorkbenchAsciiToggleKey = "edges" | "fill" | "invertLuminance";

/** Kitty transport option exposed by workbench config controls. */
export type WorkbenchAsciiKittyKey = "kittyGraphics" | "kittyDisableAscii";

/** Numeric Three ASCII renderer option exposed by workbench config controls. */
export type WorkbenchAsciiNumericKey = ThreeAsciiOptionNumericControlKey;

/** Row descriptor for a workbench Three ASCII configuration control. */
export type WorkbenchAsciiConfigRow =
  | { kind: "preset"; label: string }
  | { kind: "glyphStyle"; label: string }
  | { kind: "kitty"; key: WorkbenchAsciiKittyKey; label: string }
  | { kind: "toggle"; key: WorkbenchAsciiToggleKey; label: string }
  | { kind: "numeric"; key: WorkbenchAsciiNumericKey; label: string };

/** Options for formatting a workbench Three ASCII configuration row. */
export interface WorkbenchAsciiConfigRowTextOptions {
  kittyStatus?: string;
  labelWidth?: number;
  kittyLabelWidth?: number;
  trackWidth?: number;
}

/** Options for formatting a workbench Three ASCII configuration modal title. */
export interface WorkbenchAsciiConfigTitleOptions {
  prefix?: string;
}

/** User action applied to a Three ASCII config row. */
export type WorkbenchAsciiConfigAction = "previous" | "next" | "activate";

/** Result of applying a Three ASCII config row action. */
export interface WorkbenchAsciiConfigActionResult {
  options: ThreeAsciiConfigOptions;
  message: string;
}

/** Minimal key event shape for Three ASCII config modal navigation. */
export interface WorkbenchAsciiConfigKeyEvent {
  key: string;
  shift?: boolean;
}

/** Renderer-neutral action resolved from a Three ASCII config modal key press. */
export type WorkbenchAsciiConfigKeyResolution =
  | { kind: "modal"; action: "cancel" | "apply" | "ok" }
  | { kind: "selection"; delta: number }
  | { kind: "row"; action: WorkbenchAsciiConfigAction }
  | { kind: "none" };

/** Default row set for workbench Three ASCII configuration modals. */
export const defaultWorkbenchAsciiConfigRows: readonly WorkbenchAsciiConfigRow[] = [
  { kind: "preset", label: "Preset" },
  { kind: "glyphStyle", label: "Glyph style" },
  { kind: "kitty", key: "kittyGraphics", label: "Kitty graphics" },
  { kind: "kitty", key: "kittyDisableAscii", label: "Disable ASCII under Kitty" },
  { kind: "numeric", key: "terminalEdgeBias", label: "Edge glyph bias" },
  { kind: "numeric", key: "wireframeThickness", label: "Wire thickness" },
  { kind: "numeric", key: "renderMaxCells", label: "Render cells" },
  { kind: "numeric", key: "deferredReadbackSlots", label: "Readback slots" },
  { kind: "toggle", key: "edges", label: "Edge pass" },
  { kind: "toggle", key: "fill", label: "Fill pass" },
  { kind: "toggle", key: "invertLuminance", label: "Invert luminance" },
  { kind: "numeric", key: "edgeThreshold", label: "Edge threshold" },
  { kind: "numeric", key: "normalThreshold", label: "Normal edge" },
  { kind: "numeric", key: "depthThreshold", label: "Depth edge" },
  { kind: "numeric", key: "exposure", label: "Exposure" },
  { kind: "numeric", key: "attenuation", label: "Attenuation" },
  { kind: "numeric", key: "blendWithBase", label: "Base blend" },
  { kind: "numeric", key: "depthFalloff", label: "Fog falloff" },
  { kind: "numeric", key: "depthOffset", label: "Fog offset" },
];

/** Create the default workbench Three ASCII configuration. */
export function createDefaultWorkbenchAsciiOptions(): ThreeAsciiConfigOptions {
  return {
    ...createDefaultAsciiOptions("sharp"),
    preset: "custom",
    renderMaxCells: 960,
    deferredReadbackSlots: 2,
  };
}

/** Describe whether a Three ASCII window should render glyph output, Kitty graphics, or both. */
export function workbenchAsciiRendererModeLabel(
  options: Pick<ThreeAsciiConfigOptions, "terminalGlyphStyle" | "kittyGraphics" | "kittyDisableAscii">,
  glyphLabel: (style: ThreeAsciiConfigOptions["terminalGlyphStyle"]) => string,
): string {
  const glyphs = glyphLabel(options.terminalGlyphStyle);
  if (!options.kittyGraphics) return glyphs;
  const suffix = options.kittyDisableAscii ? "Kitty only" : "Kitty + ASCII";
  return `${glyphs} · ${suffix}`;
}

/** Return the ratio of a numeric ASCII option within a sorted supported value list. */
export function asciiNumericOptionRatio(values: readonly number[], value: number): number {
  const min = values[0] ?? 0;
  const max = values.at(-1) ?? min;
  return max === min ? 1 : Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/** Return the closest supported value index for numeric ASCII option stepping. */
export function closestAsciiControlValueIndex(values: readonly number[], value: number): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < values.length; index += 1) {
    const candidate = values[index]!;
    const nextDistance = Math.abs(candidate - value);
    if (nextDistance < distance) {
      best = index;
      distance = nextDistance;
    }
  }
  return best;
}

/** Formats one workbench Three ASCII config row for terminal display. */
export function formatWorkbenchAsciiConfigRowText(
  row: WorkbenchAsciiConfigRow,
  options: ThreeAsciiConfigOptions,
  formatOptions: WorkbenchAsciiConfigRowTextOptions = {},
): string {
  const labelWidth = formatOptions.labelWidth ?? 18;
  if (row.kind === "preset") {
    return `${row.label.padEnd(labelWidth)} [<] ${asciiPresetLabel(options.preset)} [>]`;
  }
  if (row.kind === "glyphStyle") {
    let labels = "";
    for (let index = 0; index < TERMINAL_GLYPH_STYLES.length; index += 1) {
      const style = TERMINAL_GLYPH_STYLES[index]!;
      if (index > 0) labels += " ";
      labels += style === options.terminalGlyphStyle
        ? `[${terminalGlyphStyleLabel(style)}]`
        : ` ${terminalGlyphStyleLabel(style)} `;
    }
    return `${row.label.padEnd(labelWidth)} ${labels}`;
  }
  if (row.kind === "toggle") {
    return `${row.label.padEnd(labelWidth)} ${options[row.key] ? "[x]" : "[ ]"}`;
  }
  if (row.kind === "kitty") {
    const status = row.key === "kittyGraphics" ? formatOptions.kittyStatus ?? "" : "applies only when Kitty is active";
    return `${row.label.padEnd(formatOptions.kittyLabelWidth ?? 26)} ${options[row.key] ? "[x]" : "[ ]"} ${status}`;
  }
  const value = Number(options[row.key]);
  const values = asciiControlValues(row.key);
  const ratio = asciiNumericOptionRatio(values, value);
  const trackWidth = formatOptions.trackWidth ?? 14;
  const filled = Math.round(ratio * trackWidth);
  const track = `${"█".repeat(filled)}${"░".repeat(Math.max(0, trackWidth - filled))}`;
  return `${row.label.padEnd(labelWidth)} [<] ${track} ${formatAsciiControlValue(row.key, value).padStart(5)} [>]`;
}

/** Formats a compact title for a per-window Three ASCII configuration modal. */
export function formatWorkbenchAsciiConfigTitle(
  windowTitle: string,
  options: Pick<ThreeAsciiConfigOptions, "terminalGlyphStyle" | "preset">,
  formatOptions: WorkbenchAsciiConfigTitleOptions = {},
): string {
  const prefix = formatOptions.prefix ?? "ASCII";
  return `${prefix} ${windowTitle} · ${terminalGlyphStyleLabel(options.terminalGlyphStyle)} · ${
    asciiPresetLabel(options.preset)
  }`;
}

/** Returns a wrapped selected row index for keyboard navigation. */
export function moveWorkbenchAsciiConfigSelection(current: number, rowCount: number, delta: number): number {
  const count = Math.max(0, Math.floor(rowCount));
  if (count === 0) return 0;
  return (Math.floor(current) + Math.floor(delta) + count) % count;
}

/** Resolves a keyboard event into a Three ASCII config modal action. */
export function resolveWorkbenchAsciiConfigKey(
  event: WorkbenchAsciiConfigKeyEvent,
): WorkbenchAsciiConfigKeyResolution {
  switch (event.key) {
    case "escape":
    case "q":
      return { kind: "modal", action: "cancel" };
    case "a":
    case "A":
      return { kind: "modal", action: "apply" };
    case "o":
    case "O":
      return { kind: "modal", action: "ok" };
    case "up":
      return { kind: "selection", delta: -1 };
    case "down":
    case "tab":
      return { kind: "selection", delta: event.shift ? -1 : 1 };
    case "left":
      return { kind: "row", action: "previous" };
    case "right":
    case "return":
    case "space":
      return { kind: "row", action: "next" };
    default:
      return { kind: "none" };
  }
}

/** Returns the first row index that keeps the selected row visible in a clipped config modal. */
export function workbenchAsciiConfigVisibleRowStart(
  selected: number,
  rowCount: number,
  visibleRows: number,
): number {
  const count = Math.max(0, Math.floor(rowCount));
  const visible = Math.max(0, Math.floor(visibleRows));
  if (count === 0 || visible === 0) return 0;
  const clampedSelected = Math.max(0, Math.min(count - 1, Math.floor(selected)));
  return Math.max(0, Math.min(clampedSelected, count - visible));
}

/** Return the next ASCII preset configuration, preserving transport preferences through `applyAsciiPreset()`. */
export function stepWorkbenchAsciiPreset(
  options: ThreeAsciiConfigOptions,
  presetIds: readonly string[],
  delta: number,
): { options: ThreeAsciiConfigOptions; presetId: string; label: string } {
  const ids = presetIds.length ? presetIds : [options.preset];
  const currentIndex = Math.max(0, ids.indexOf(options.preset));
  const presetId = ids[(currentIndex + delta + ids.length) % ids.length]!;
  const next = cloneAsciiOptions(options);
  applyAsciiPreset(next, presetId);
  return { options: next, presetId, label: asciiPresetLabel(presetId) };
}

/** Return the next terminal glyph style configuration. */
export function stepWorkbenchAsciiGlyphStyle(
  options: ThreeAsciiConfigOptions,
  delta: number,
): ThreeAsciiConfigOptions {
  const index = TERMINAL_GLYPH_STYLES.indexOf(options.terminalGlyphStyle);
  const next = TERMINAL_GLYPH_STYLES[(index + delta + TERMINAL_GLYPH_STYLES.length) % TERMINAL_GLYPH_STYLES.length]!;
  return { ...options, terminalGlyphStyle: next, preset: "custom" };
}

/** Toggle a boolean renderer option and mark the configuration as custom. */
export function toggleWorkbenchAsciiOption(
  options: ThreeAsciiConfigOptions,
  key: WorkbenchAsciiToggleKey | WorkbenchAsciiKittyKey,
): ThreeAsciiConfigOptions {
  return { ...options, [key]: !options[key], preset: "custom" };
}

/** Step a numeric renderer option to the nearest supported value. */
export function stepWorkbenchAsciiNumericOption(
  options: ThreeAsciiConfigOptions,
  key: ThreeAsciiOptionNumericControlKey,
  delta: number,
): ThreeAsciiConfigOptions {
  const values = asciiControlValues(key);
  const currentValue = Number(options[key]);
  const closest = closestAsciiControlValueIndex(values, currentValue);
  const nextValue = values[Math.max(0, Math.min(values.length - 1, closest + delta))]!;
  return { ...options, [key]: nextValue, preset: "custom" };
}

/** Apply a renderer-neutral config row action and return the next options plus a log-safe summary. */
export function applyWorkbenchAsciiConfigRowAction(
  options: ThreeAsciiConfigOptions,
  row: WorkbenchAsciiConfigRow,
  action: WorkbenchAsciiConfigAction,
  presetIds: readonly string[],
): WorkbenchAsciiConfigActionResult {
  if (row.kind === "preset") {
    const next = stepWorkbenchAsciiPreset(options, presetIds, action === "previous" ? -1 : 1);
    return { options: next.options, message: `preset ${next.label}` };
  }
  if (row.kind === "glyphStyle") {
    const next = stepWorkbenchAsciiGlyphStyle(options, action === "previous" ? -1 : 1);
    return { options: next, message: `glyph style ${terminalGlyphStyleLabel(next.terminalGlyphStyle)}` };
  }
  if (row.kind === "toggle" || row.kind === "kitty") {
    const next = toggleWorkbenchAsciiOption(options, row.key);
    return { options: next, message: `${row.key} ${next[row.key] ? "on" : "off"}` };
  }
  const next = stepWorkbenchAsciiNumericOption(options, row.key, action === "previous" ? -1 : 1);
  return {
    options: next,
    message: `${row.key} ${formatAsciiControlValue(row.key, Number(next[row.key]))}`,
  };
}

/** Owns per-window Three ASCII config signals for workbench-style hosts. */
export class WorkbenchAsciiConfigController<WindowId extends string> {
  readonly root: Signal<ThreeAsciiConfigOptions>;
  private readonly signals = new Map<WindowId, Signal<ThreeAsciiConfigOptions>>();

  constructor(
    readonly rootWindowId: WindowId,
    initial: ThreeAsciiConfigOptions = createDefaultWorkbenchAsciiOptions(),
  ) {
    this.root = new Signal<ThreeAsciiConfigOptions>(cloneAsciiOptions(initial));
    this.signals.set(rootWindowId, this.root);
  }

  signalForWindow(id: WindowId): Signal<ThreeAsciiConfigOptions> {
    const existing = this.signals.get(id);
    if (existing) return existing;
    const created = new Signal<ThreeAsciiConfigOptions>(cloneAsciiOptions(this.root.peek()));
    this.signals.set(id, created);
    return created;
  }

  setForWindow(id: WindowId, options: ThreeAsciiConfigOptions): void {
    this.signalForWindow(id).value = cloneAsciiOptions(options);
  }

  disposeWindow(id: WindowId): void {
    if (id === this.rootWindowId) return;
    const signal = this.signals.get(id);
    signal?.dispose();
    this.signals.delete(id);
  }

  configuredWindow(candidate: WindowId, isSupported: (id: WindowId) => boolean): WindowId {
    return isSupported(candidate) ? candidate : this.rootWindowId;
  }

  configuredSignal(candidate: WindowId, isSupported: (id: WindowId) => boolean): Signal<ThreeAsciiConfigOptions> {
    return this.signalForWindow(this.configuredWindow(candidate, isSupported));
  }

  dispose(): void {
    for (const [id, signal] of this.signals) {
      if (id !== this.rootWindowId) signal.dispose();
    }
    this.signals.clear();
    this.root.dispose();
  }
}
