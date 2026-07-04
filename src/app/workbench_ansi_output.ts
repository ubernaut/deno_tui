import type { CanvasStdout } from "../canvas/sink.ts";

const encoder = new TextEncoder();

export interface WorkbenchAnsiScreenFlushStats {
  rows: number;
  changed: number;
  cleared: number;
  bytes: number;
  durationMs: number;
}

export function writeWorkbenchAnsiScreenOutput(
  stdout: CanvasStdout,
  output: readonly string[],
  stats: Pick<WorkbenchAnsiScreenFlushStats, "rows" | "changed" | "cleared">,
): WorkbenchAnsiScreenFlushStats {
  if (output.length === 0) {
    return { ...stats, bytes: 0, durationMs: 0 };
  }

  const flushStart = performance.now();
  const bytes = encoder.encode(output.join(""));
  stdout.writeSync(bytes);
  return { ...stats, bytes: bytes.byteLength, durationMs: performance.now() - flushStart };
}
