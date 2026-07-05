import {
  inspectWorkbenchFullscreenVisualSmokeOutput,
  type WorkbenchFullscreenVisualSmokeResult,
} from "./workbench_visual_smoke.ts";

export interface WorkbenchFullscreenVisualSmokeOptions {
  command?: readonly string[];
  columns?: number;
  rows?: number;
  timeoutMs?: number;
  settleMs?: number;
  fullscreenKey?: string;
  minCells?: number;
  minTruecolorRows?: number;
}

const DEFAULT_COMMAND = ["deno", "task", "api-workbench"] as const;

if (import.meta.main) {
  const result = await runWorkbenchFullscreenVisualSmoke();
  console.log(formatWorkbenchFullscreenVisualSmokeResult(result));
  if (!result.passed) Deno.exit(1);
}

export async function runWorkbenchFullscreenVisualSmoke(
  options: WorkbenchFullscreenVisualSmokeOptions = {},
): Promise<WorkbenchFullscreenVisualSmokeResult> {
  const columns = Math.max(1, Math.floor(options.columns ?? 132));
  const rows = Math.max(1, Math.floor(options.rows ?? 44));
  const output = await captureWorkbenchFullscreenPty({
    command: options.command ?? DEFAULT_COMMAND,
    columns,
    rows,
    timeoutMs: options.timeoutMs ?? 12_000,
    settleMs: options.settleMs ?? 4_000,
    fullscreenKey: options.fullscreenKey ?? "f",
  });
  return inspectWorkbenchFullscreenVisualSmokeOutput(output, {
    columns,
    rows,
    minCells: options.minCells,
    minTruecolorRows: options.minTruecolorRows,
  });
}

export async function captureWorkbenchFullscreenPty(
  options: Required<
    Pick<
      WorkbenchFullscreenVisualSmokeOptions,
      "command" | "columns" | "rows" | "timeoutMs" | "settleMs" | "fullscreenKey"
    >
  >,
): Promise<string> {
  const tempFile = await Deno.makeTempFile({ prefix: "deno-tui-workbench-fullscreen-", suffix: ".ansi" });
  const command = quotePythonList(options.command);
  const python = `
import pexpect, sys, time
path = sys.argv[1]
command = ${command}
child = pexpect.spawn(command[0], command[1:], encoding=None, timeout=${
    Math.ceil(options.timeoutMs / 1000)
  }, dimensions=(${options.rows}, ${options.columns}))
chunks = []
try:
    time.sleep(${(options.settleMs / 1000).toFixed(3)})
    while True:
        try:
            chunks.append(child.read_nonblocking(size=200000, timeout=0.2))
        except Exception:
            break
    child.send(${JSON.stringify(options.fullscreenKey)}.encode())
    time.sleep(${(options.settleMs / 1000).toFixed(3)})
    while True:
        try:
            chunks.append(child.read_nonblocking(size=200000, timeout=0.2))
        except Exception:
            break
finally:
    try:
        child.send(b"q")
    except Exception:
        pass
    time.sleep(0.2)
    child.terminate(force=True)
open(path, "wb").write(b"".join(chunks))
`;
  try {
    const process = await new Deno.Command("python3", {
      args: ["-c", python, tempFile],
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!process.success) {
      const error = new TextDecoder().decode(process.stderr).trim();
      throw new Error(error || "workbench fullscreen visual smoke PTY capture failed");
    }
    return await Deno.readTextFile(tempFile);
  } finally {
    await Deno.remove(tempFile).catch(() => {});
  }
}

export function formatWorkbenchFullscreenVisualSmokeResult(result: WorkbenchFullscreenVisualSmokeResult): string {
  return [
    "# Workbench Fullscreen Visual Smoke",
    "",
    `Status: ${result.passed ? "pass" : "fail"}`,
    `Size: ${result.columns}x${result.rows}`,
    `Output: ${result.outputBytes} bytes`,
    `Fullscreen cells: ${result.fullscreenCells}/${result.fullscreenCap}`,
    `Truecolor rows: ${result.truecolorBackgroundRows}`,
    `Truecolor backgrounds: ${result.truecolorBackgroundWrites}`,
    `Nonblank rows: ${result.nonBlankRows}`,
    `Missing: ${result.missing.join(", ") || "-"}`,
    `Forbidden: ${result.forbidden.join(", ") || "-"}`,
    "",
    "Three line:",
    result.threeLine,
    "",
    "Status line:",
    result.statusLine,
  ].join("\n");
}

function quotePythonList(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}
