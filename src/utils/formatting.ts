// Copyright 2023 Im-Beast. MIT license.

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
