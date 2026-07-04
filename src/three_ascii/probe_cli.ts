/** Shared CLI helpers for Three ASCII probe scripts. */

export function numberArg(args: readonly string[], name: string, fallback: number): number {
  const prefix = `${name}=`;
  const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function stringArg(args: readonly string[], name: string, fallback: string): string {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
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
