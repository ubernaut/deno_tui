/** Shared CLI helpers for Three ASCII probe scripts. */

export function numberArg(args: readonly string[], name: string, fallback: number): number {
  const raw = argValue(args, name);
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function stringArg(args: readonly string[], name: string, fallback: string): string {
  return argValue(args, name) || fallback;
}

export function choiceArg<const T extends string>(
  args: readonly string[],
  name: string,
  fallback: T,
  choices: readonly T[],
): T {
  const value = stringArg(args, name, fallback);
  return (choices as readonly string[]).includes(value) ? value as T : fallback;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function formatMs(value: number | undefined): string {
  return `${(value ?? 0).toFixed(2)}ms`;
}

export function formatFps(frameMs: number): string {
  return frameMs > 0 ? (1000 / frameMs).toFixed(1) : "0.0";
}

function argValue(args: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg?.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg !== name) continue;
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) return undefined;
    return next;
  }
  return undefined;
}
