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

export interface TerminalSnapshotMismatch {
  line: number;
  column: number;
  expected: string;
  actual: string;
}

export interface TerminalSnapshotComparison {
  pass: boolean;
  expected: string;
  actual: string;
  mismatches: TerminalSnapshotMismatch[];
}

export interface TerminalSnapshotDiffOptions {
  maxMismatches?: number;
}

export function compareTerminalSnapshot(
  actual: string,
  expected: string,
  options: TerminalSnapshotDiffOptions = {},
): TerminalSnapshotComparison {
  const normalizedActual = normalizeTerminalSnapshot(actual);
  const normalizedExpected = normalizeTerminalSnapshot(expected);
  const actualLines = normalizedActual.split("\n");
  const expectedLines = normalizedExpected.split("\n");
  const lineCount = Math.max(actualLines.length, expectedLines.length);
  const maxMismatches = Math.max(1, Math.floor(options.maxMismatches ?? 8));
  const mismatches: TerminalSnapshotMismatch[] = [];

  for (let index = 0; index < lineCount && mismatches.length < maxMismatches; index += 1) {
    const actualLine = actualLines[index] ?? "";
    const expectedLine = expectedLines[index] ?? "";
    if (actualLine === expectedLine) continue;

    mismatches.push({
      line: index + 1,
      column: firstDifferenceColumn(actualLine, expectedLine),
      expected: expectedLine,
      actual: actualLine,
    });
  }

  return {
    pass: normalizedActual === normalizedExpected,
    expected: normalizedExpected,
    actual: normalizedActual,
    mismatches,
  };
}

export function formatTerminalSnapshotDiff(
  comparison: TerminalSnapshotComparison,
): string {
  if (comparison.pass) return "Terminal snapshots match.";
  const lines = ["Terminal snapshot mismatch:"];
  for (const mismatch of comparison.mismatches) {
    lines.push(
      `line ${mismatch.line}, column ${mismatch.column}`,
      `  expected: ${JSON.stringify(mismatch.expected)}`,
      `  actual:   ${JSON.stringify(mismatch.actual)}`,
    );
  }
  return lines.join("\n");
}

export function assertTerminalSnapshot(
  actual: string,
  expected: string,
  options: TerminalSnapshotDiffOptions = {},
): void {
  const comparison = compareTerminalSnapshot(actual, expected, options);
  if (!comparison.pass) {
    throw new Error(formatTerminalSnapshotDiff(comparison));
  }
}

function firstDifferenceColumn(left: string, right: string): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return index + 1;
  }
  return 1;
}
