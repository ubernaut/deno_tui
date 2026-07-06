// Copyright 2023 Im-Beast. MIT license.

const ESCAPE = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESCAPE}\\[[0-?]*[ -/]*[@-~]`, "g");

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export function ansiCubeLevel(value: number): number {
  return value === 0 ? 0 : 55 + value * 40;
}
