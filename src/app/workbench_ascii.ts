// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import { TERMINAL_GLYPH_STYLES } from "../three_ascii/glyphs.ts";
import {
  applyAsciiPreset,
  asciiControlValues,
  asciiPresetLabel,
  cloneAsciiOptions,
  createDefaultAsciiOptions,
  type ThreeAsciiConfigOptions,
  type ThreeAsciiOptionNumericControlKey,
} from "../three_ascii/options.ts";

/** Boolean Three ASCII renderer option exposed by workbench config controls. */
export type WorkbenchAsciiToggleKey = "edges" | "fill" | "invertLuminance";

/** Kitty transport option exposed by workbench config controls. */
export type WorkbenchAsciiKittyKey = "kittyGraphics" | "kittyDisableAscii";

/** Create the default workbench Three ASCII configuration. */
export function createDefaultWorkbenchAsciiOptions(): ThreeAsciiConfigOptions {
  return {
    ...createDefaultAsciiOptions("sharp"),
    preset: "custom",
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
  for (const [index, candidate] of values.entries()) {
    const nextDistance = Math.abs(candidate - value);
    if (nextDistance < distance) {
      best = index;
      distance = nextDistance;
    }
  }
  return best;
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
