import { assertEquals, assertRejects, assertThrows } from "./deps.ts";
import { acquireGpuProbeLock, withGpuProbeLock } from "../scripts/gpu_probe_lock.ts";
import {
  average,
  averageWhere,
  choiceArg,
  formatFps,
  formatMs,
  numberArg,
  stringArg,
} from "../src/three_ascii/probe.ts";
import {
  defaultThreeAsciiProbeOptions,
  parseThreeAsciiProbeOptions,
  summarizeThreeAsciiProbeTimings,
  threeAsciiProbeReport,
} from "../src/three_ascii/probe.ts";

Deno.test("GPU probe lock creates and releases an exclusive file", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/probe.lock`;
  try {
    const lock = await acquireGpuProbeLock({ path, pollMs: 1, timeoutMs: 20 });
    assertEquals(await exists(path), true);
    await assertRejects(
      () => acquireGpuProbeLock({ path, pollMs: 1, timeoutMs: 5, staleMs: 60_000 }),
      Error,
      "timed out waiting for GPU probe lock",
    );
    await lock.release();
    assertEquals(await exists(path), false);
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => undefined);
  }
});

Deno.test("GPU probe lock removes stale files and wraps callbacks", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/probe.lock`;
  try {
    await Deno.writeTextFile(path, "stale");
    const old = new Date(Date.now() - 10_000);
    await Deno.utime(path, old, old);
    const result = await withGpuProbeLock(() => "ok", { path, staleMs: 1, pollMs: 1, timeoutMs: 100 });
    assertEquals(result, "ok");
    assertEquals(await exists(path), false);
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => undefined);
  }
});

Deno.test("Three ASCII probe CLI helpers parse typed arguments", () => {
  const args = ["--frames=24", "--mode=studio", "--name=demo"];
  const separatedArgs = ["--frames", "48", "--mode", "lattice", "--name", "separated"];

  assertEquals(numberArg(args, "--frames", 1), 24);
  assertEquals(numberArg(separatedArgs, "--frames", 1), 48);
  assertEquals(numberArg(args, "--missing", 7), 7);
  assertEquals(numberArg(["--frames=bad"], "--frames", 5), 5);
  assertEquals(numberArg(["--frames=-1"], "--frames", 5), 5);
  assertEquals(numberArg(["--frames", "--mode", "studio"], "--frames", 5), 5);
  assertEquals(stringArg(args, "--name", "fallback"), "demo");
  assertEquals(stringArg(separatedArgs, "--name", "fallback"), "separated");
  assertEquals(stringArg(args, "--missing", "fallback"), "fallback");
  assertEquals(choiceArg(args, "--mode", "studio", ["studio", "lattice"]), "studio");
  assertEquals(choiceArg(separatedArgs, "--mode", "studio", ["studio", "lattice"]), "lattice");
  assertEquals(choiceArg(["--mode=nope"], "--mode", "studio", ["studio", "lattice"]), "studio");
  assertEquals(choiceArg(["--mode", "--frames", "4"], "--mode", "studio", ["studio", "lattice"]), "studio");
});

Deno.test("Three ASCII probe CLI helpers format timing summaries", () => {
  assertEquals(average([]), 0);
  assertEquals(average([2, 4, 6]), 4);
  assertEquals(averageWhere([{ n: 1 }, { n: 5 }, { n: 7 }], (entry) => entry.n, (entry) => entry.n > 1), 6);
  assertEquals(averageWhere([{ n: 1 }], (entry) => entry.n, (entry) => entry.n > 10), 0);
  assertEquals(formatMs(1.234), "1.23ms");
  assertEquals(formatMs(undefined), "0.00ms");
  assertEquals(formatFps(20), "50.0");
  assertEquals(formatFps(0), "0.0");
});

Deno.test("defaultThreeAsciiProbeOptions yields between deferred frames", () => {
  assertEquals(defaultThreeAsciiProbeOptions().delayMs, 1);
});

Deno.test("parseThreeAsciiProbeOptions accepts task forwarded options", () => {
  assertEquals(
    parseThreeAsciiProbeOptions([
      "--",
      "--columns=80",
      "--rows",
      "30",
      "--frames=24",
      "--warmup=4",
      "--delay=70",
      "--style=mixed",
      "--readback=blocking",
    ]),
    {
      columns: 80,
      rows: 30,
      frames: 24,
      warmup: 4,
      delayMs: 70,
      style: "mixed",
      readbackStrategy: "blocking",
    },
  );
});

Deno.test("parseThreeAsciiProbeOptions clamps real WebGPU probes to a one tick delay", () => {
  assertEquals(parseThreeAsciiProbeOptions(["--delay=0", "--readback=deferred"]).delayMs, 1);
  assertEquals(parseThreeAsciiProbeOptions(["--delay=0", "--readback=blocking"]).delayMs, 1);
});

Deno.test("parseThreeAsciiProbeOptions rejects invalid modes and numeric values", () => {
  assertThrows(() => parseThreeAsciiProbeOptions(["--style=emoji"]), Error, "Unsupported style");
  assertThrows(() => parseThreeAsciiProbeOptions(["--readback=sync"]), Error, "Unsupported readback");
  assertThrows(() => parseThreeAsciiProbeOptions(["--columns=0"]), Error, "Expected positive columns");
  assertThrows(() => parseThreeAsciiProbeOptions(["--delay=-1"]), Error, "Expected non-negative delay");
});

Deno.test("summarizeThreeAsciiProbeTimings rounds stable timing percentiles", () => {
  assertEquals(summarizeThreeAsciiProbeTimings([]), { min: 0, avg: 0, p50: 0, p95: 0, max: 0 });
  assertEquals(summarizeThreeAsciiProbeTimings([10.125, 20.125, 30.125, 40.125]), {
    min: 10.13,
    avg: 25.13,
    p50: 20.13,
    p95: 30.13,
    max: 40.13,
  });
});

Deno.test("threeAsciiProbeReport projects renderer performance samples", () => {
  const options = defaultThreeAsciiProbeOptions();
  options.columns = 2;
  options.rows = 3;
  const report = threeAsciiProbeReport(options, [
    {
      columns: 2,
      rows: 3,
      cells: 6,
      terminalGlyphStyle: "blocks",
      totalMs: 10,
      initMs: 0,
      sceneMs: 6,
      ansiMs: 4,
      readbackMs: 3,
      assemblyMs: 1,
      deferredReadbackSlots: 6,
      deferredReadbackPending: 1,
      deferredReadbackUnresolved: 1,
      deferredReadbackResolved: 0,
      deferredReadbackSaturated: false,
    },
  ]);

  assertEquals(report.frames, 1);
  assertEquals(report.cells, 6);
  assertEquals(report.totalMs.avg, 10);
  assertEquals(report.deferred, {
    slots: 6,
    pending: 1,
    unresolved: 1,
    resolved: 0,
    saturated: false,
  });
});

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}
