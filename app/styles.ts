import type { Style } from "../src/theme.ts";
import type { Accent, Severity } from "./types.ts";

export const palette = {
  void: "#05070d",
  voidSoft: "#0f1b34",
  panel: "#0a1020",
  panelSoft: "#111932",
  alarm: "#ff4231",
  amber: "#ff9f24",
  phosphor: "#7dffba",
  signal: "#5bb0ff",
  violet: "#b17cff",
  paper: "#eff7ff",
  dim: "#5a6478",
  shade: "#000000",
};

export function accentColor(accent: Accent): string {
  return palette[accent];
}

function hexToRgb(hex: string) {
  const normalized = hex.replace(/^#/, "");
  const value = normalized.length === 3 ? expandShortHex(normalized) : normalized;
  const intValue = Number.parseInt(value, 16);
  return {
    r: (intValue >> 16) & 0xff,
    g: (intValue >> 8) & 0xff,
    b: intValue & 0xff,
  };
}

function expandShortHex(value: string): string {
  const r = value[0] ?? "0";
  const g = value[1] ?? "0";
  const b = value[2] ?? "0";
  return `${r}${r}${g}${g}${b}${b}`;
}

export function makeStyle(options: {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  inverse?: boolean;
} = {}): Style {
  const codes: string[] = [];
  if (options.bold) {
    codes.push("1");
  }
  if (options.dim) {
    codes.push("2");
  }
  if (options.inverse) {
    codes.push("7");
  }
  if (options.fg) {
    const { r, g, b } = hexToRgb(options.fg);
    codes.push(`38;2;${r};${g};${b}`);
  }
  if (options.bg) {
    const { r, g, b } = hexToRgb(options.bg);
    codes.push(`48;2;${r};${g};${b}`);
  }

  if (codes.length === 0) {
    return (text) => text;
  }

  const prefix = `\x1b[${codes.join(";")}m`;
  return (text) => `${prefix}${text}\x1b[0m`;
}

export function severityAccent(severity: Severity): Accent {
  switch (severity) {
    case "alarm":
      return "alarm";
    case "warning":
      return "amber";
    default:
      return "signal";
  }
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function formatPercent(value: number) {
  return `${value.toFixed(value >= 100 ? 0 : 1)}%`;
}

export function formatBytes(value: number) {
  return formatBytesWithSeparator(value, " ");
}

export function formatCompactBytes(value: number) {
  return formatBytesWithSeparator(value, "");
}

function formatBytesWithSeparator(value: number, separator: string) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let amount = Math.max(0, value);
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  const precision = amount >= 100 || index === 0 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(precision)}${separator}${units[index]}`;
}

export function formatRate(value: number) {
  return `${formatBytes(value)}/s`;
}

export function formatOptionalNumber(value: number | null, suffix: string) {
  return value === null ? "--" : `${value.toFixed(value >= 100 ? 0 : 1)}${suffix}`;
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d ${String(hours % 24).padStart(2, "0")}h`;
  }
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

export function requireInteractiveTerminal(command: string): void {
  const input = Deno.stdin.isTerminal();
  const output = Deno.stdout.isTerminal();
  if (input && output) return;

  const missing = [
    input ? undefined : "stdin",
    output ? undefined : "stdout",
  ].filter((value): value is string => value !== undefined).join(" and ");
  const verb = missing.includes(" and ") ? "are" : "is";

  console.error(`${command} requires an interactive terminal (${missing} ${verb} not a TTY).`);
  console.error("Run it directly in a terminal, or use a report/web task for non-interactive output.");
  Deno.exit(64);
}
