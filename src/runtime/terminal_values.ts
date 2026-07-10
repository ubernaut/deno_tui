// Copyright 2023 Im-Beast. MIT license.

interface TerminalCommandValue {
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: Record<string, string>;
}

export function cloneTerminalCommand(command: TerminalCommandValue): TerminalCommandValue {
  return {
    command: command.command,
    args: command.args ? [...command.args] : undefined,
    cwd: command.cwd,
    env: command.env ? { ...command.env } : undefined,
  };
}

export function normalizeTerminalDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value!));
}
