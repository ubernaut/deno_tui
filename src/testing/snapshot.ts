// Copyright 2023 Im-Beast. MIT license.
const ANSI_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]/g;

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export function normalizeTerminalSnapshot(value: string): string {
  return stripAnsi(value).replace(/[ \t]+$/gm, "").trimEnd();
}

export function frameBufferToSnapshot(frameBuffer: readonly (readonly (string | Uint8Array | undefined)[])[]): string {
  const decoder = new TextDecoder();
  return normalizeTerminalSnapshot(
    frameBuffer
      .map((row) =>
        row.map((cell) => {
          if (cell === undefined) return " ";
          return typeof cell === "string" ? cell : decoder.decode(cell);
        }).join("")
      )
      .join("\n"),
  );
}
