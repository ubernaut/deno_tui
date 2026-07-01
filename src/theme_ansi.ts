// Copyright 2023 Im-Beast. MIT license.

/** Function that's supposed to return styled text given string as parameter */
export type Style = (text: string) => string;

/** Used as placeholder style when one is not supplied, returns the input */
export function emptyStyle(text: string): string {
  return text;
}

/** Returns {replacement} if {style} is an {emptyStyle} otherwise returns {style} back */
export function replaceEmptyStyle(style: Style, replacement: Style): Style {
  return style === emptyStyle ? replacement : style;
}

/** Public type alias for an ansi Color Name. */
export type AnsiColorName =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "brightBlack"
  | "brightRed"
  | "brightGreen"
  | "brightYellow"
  | "brightBlue"
  | "brightMagenta"
  | "brightCyan"
  | "brightWhite";

/** Public type alias for an ansi Rgb Color. */
export type AnsiRgbColor = readonly [red: number, green: number, blue: number];

/** Public type alias for an ansi Color. */
export type AnsiColor = AnsiColorName | AnsiRgbColor | number;

/** Public interface describing an ansi Style Spec. */
export interface AnsiStyleSpec {
  foreground?: AnsiColor;
  background?: AnsiColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strikethrough?: boolean;
}

const ANSI_COLOR_NAMES: readonly AnsiColorName[] = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
];

/** Creates an ansi Style. */
export function createAnsiStyle(spec: AnsiStyleSpec): Style {
  const codes = ansiStyleCodes(spec);
  if (codes.length === 0) return emptyStyle;
  const open = `\x1b[${codes.join(";")}m`;
  return (value) => `${open}${value}\x1b[0m`;
}

/** Creates a style map from named ANSI style specs. */
export function createAnsiStyleMap<TokenName extends string>(
  specs: Partial<Record<TokenName, AnsiStyleSpec>>,
): Partial<Record<TokenName, Style>> {
  const styles: Partial<Record<TokenName, Style>> = {};
  for (const [name, spec] of Object.entries(specs) as [TokenName, AnsiStyleSpec][]) {
    styles[name] = createAnsiStyle(spec);
  }
  return styles;
}

function ansiStyleCodes(spec: AnsiStyleSpec): number[] {
  const codes: number[] = [];
  if (spec.bold) codes.push(1);
  if (spec.dim) codes.push(2);
  if (spec.italic) codes.push(3);
  if (spec.underline) codes.push(4);
  if (spec.inverse) codes.push(7);
  if (spec.strikethrough) codes.push(9);
  if (spec.foreground !== undefined) codes.push(...ansiColorCodes(spec.foreground, false));
  if (spec.background !== undefined) codes.push(...ansiColorCodes(spec.background, true));
  return codes;
}

function ansiColorCodes(color: AnsiColor, background: boolean): number[] {
  if (typeof color === "number") {
    return [background ? 48 : 38, 5, clampAnsiByte(color)];
  }
  if (typeof color !== "string") {
    const [red, green, blue] = color;
    return [background ? 48 : 38, 2, clampAnsiByte(red), clampAnsiByte(green), clampAnsiByte(blue)];
  }
  return [ansiNamedColorCode(color, background)];
}

function ansiNamedColorCode(color: AnsiColorName, background: boolean): number {
  const index = ANSI_COLOR_NAMES.indexOf(color);
  const base = background ? 40 : 30;
  return index < 8 ? base + index : base + 60 + index - 8;
}

function clampAnsiByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
