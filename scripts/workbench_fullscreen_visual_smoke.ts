import {
  inspectWorkbenchFullscreenVisualSmokeOutput,
  type WorkbenchFullscreenVisualSmokeResult,
} from "./workbench_visual_smoke.ts";

export interface WorkbenchFullscreenVisualSmokeOptions {
  command?: readonly string[];
  columns?: number;
  rows?: number;
  resizeColumns?: number;
  resizeRows?: number;
  timeoutMs?: number;
  settleMs?: number;
  fullscreenKey?: string;
  minCells?: number;
  minTruecolorRows?: number;
  dumpScreen?: boolean;
}

const DEFAULT_COMMAND = ["deno", "task", "api-workbench"] as const;

if (import.meta.main) {
  const options = parseWorkbenchFullscreenVisualSmokeArgs(Deno.args);
  const result = await runWorkbenchFullscreenVisualSmoke(options);
  console.log(formatWorkbenchFullscreenVisualSmokeResult(result));
  if (options.dumpScreen) {
    console.log("");
    console.log("Screen:");
    for (let index = 0; index < result.screenLines.length; index += 1) {
      console.log(`${String(index + 1).padStart(2, "0")}|${result.screenLines[index]}`);
    }
  }
  if (!result.passed) Deno.exit(1);
}

export function parseWorkbenchFullscreenVisualSmokeArgs(
  args: readonly string[],
): WorkbenchFullscreenVisualSmokeOptions {
  const options: WorkbenchFullscreenVisualSmokeOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") continue;
    const [name, inlineValue] = arg.split("=", 2);
    if (name === "--dump-screen") {
      options.dumpScreen = inlineValue === undefined ? true : inlineValue !== "false";
      continue;
    }
    const value = inlineValue ?? args[index + 1];
    if (inlineValue === undefined && name.startsWith("--")) index += 1;
    if (value === undefined) continue;
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) continue;
    if (name === "--columns") options.columns = number;
    else if (name === "--rows") options.rows = number;
    else if (name === "--resize-columns") options.resizeColumns = number;
    else if (name === "--resize-rows") options.resizeRows = number;
    else if (name === "--timeout-ms") options.timeoutMs = number;
    else if (name === "--settle-ms") options.settleMs = number;
    else if (name === "--min-cells") options.minCells = number;
    else if (name === "--min-truecolor-rows") options.minTruecolorRows = number;
  }
  return options;
}

export async function runWorkbenchFullscreenVisualSmoke(
  options: WorkbenchFullscreenVisualSmokeOptions = {},
): Promise<WorkbenchFullscreenVisualSmokeResult> {
  const columns = Math.max(1, Math.floor(options.columns ?? 132));
  const rows = Math.max(1, Math.floor(options.rows ?? 44));
  const resizeColumns = options.resizeColumns === undefined
    ? undefined
    : Math.max(1, Math.floor(options.resizeColumns));
  const resizeRows = options.resizeRows === undefined ? undefined : Math.max(1, Math.floor(options.resizeRows));
  const output = await captureWorkbenchFullscreenPty({
    command: options.command ?? DEFAULT_COMMAND,
    columns,
    rows,
    resizeColumns,
    resizeRows,
    timeoutMs: options.timeoutMs ?? 12_000,
    settleMs: options.settleMs ?? 4_000,
    fullscreenKey: options.fullscreenKey ?? "f",
  });
  return inspectWorkbenchFullscreenVisualSmokeOutput(output, {
    columns: resizeColumns ?? columns,
    rows: resizeRows ?? rows,
    minCells: options.minCells,
    minTruecolorRows: options.minTruecolorRows,
  });
}

export async function captureWorkbenchFullscreenPty(
  options:
    & Required<
      Pick<
        WorkbenchFullscreenVisualSmokeOptions,
        "command" | "columns" | "rows" | "timeoutMs" | "settleMs" | "fullscreenKey"
      >
    >
    & Pick<WorkbenchFullscreenVisualSmokeOptions, "resizeColumns" | "resizeRows">,
): Promise<string> {
  const tempFile = await Deno.makeTempFile({ prefix: "deno-tui-workbench-fullscreen-", suffix: ".ansi" });
  const command = quotePythonList(options.command);
  const resizeRows = pythonOptionalNumber(options.resizeRows);
  const resizeColumns = pythonOptionalNumber(options.resizeColumns);
  const python = `
import os, pexpect, signal, subprocess, sys, time
path = sys.argv[1]
command = ${command}
child = pexpect.spawn(command[0], command[1:], encoding=None, timeout=${
    Math.ceil(options.timeoutMs / 1000)
  }, dimensions=(${options.rows}, ${options.columns}))
chunks = []
def child_pids(pid):
    try:
        output = subprocess.check_output(["pgrep", "-P", str(pid)], stderr=subprocess.DEVNULL)
    except Exception:
        return []
    return [int(value) for value in output.decode().split() if value.strip().isdigit()]
def process_tree(pid):
    children = []
    for child_pid in child_pids(pid):
        children.extend(process_tree(child_pid))
        children.append(child_pid)
    return children
def signal_tree(pid, sig):
    for target in process_tree(pid) + [pid]:
        try:
            os.kill(target, sig)
        except Exception:
            pass
def drain(duration):
    deadline = time.time() + duration
    while time.time() < deadline:
        try:
            chunks.append(child.read_nonblocking(size=200000, timeout=0.05))
        except Exception:
            time.sleep(0.02)
try:
    drain(${(options.settleMs / 1000).toFixed(3)})
    child.send(${JSON.stringify(options.fullscreenKey)}.encode())
    drain(${(options.settleMs / 1000).toFixed(3)})
    resize_rows = ${resizeRows}
    resize_columns = ${resizeColumns}
    if resize_rows and resize_columns:
        child.setwinsize(resize_rows, resize_columns)
        drain(${(options.settleMs / 1000).toFixed(3)})
finally:
    try:
        child.sendintr()
    except Exception:
        pass
    time.sleep(0.2)
    signal_tree(child.pid, signal.SIGTERM)
    time.sleep(0.2)
    signal_tree(child.pid, signal.SIGKILL)
    try:
        child.close(force=True)
    except Exception:
        pass
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

function pythonOptionalNumber(value: number | undefined): string {
  return value === undefined ? "None" : String(Math.max(1, Math.floor(value)));
}
