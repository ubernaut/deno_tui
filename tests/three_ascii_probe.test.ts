import { assertEquals, assertRejects, assertStringIncludes, assertThrows } from "./deps.ts";
import { acquireGpuProbeLock, runGpuProbeLockCli, withGpuProbeLock } from "../scripts/gpu_probe_lock.ts";
import {
  average,
  averageWhere,
  choiceArg,
  formatFps,
  formatMs,
  formatThreePanelProbeLines,
  numberArg,
  stringArg,
  summarizeThreePanelProbe,
  type ThreePanelProbeSample,
  validateThreePanelProbeSummary,
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

Deno.test("GPU probe lock CLI reports usage when no command is provided", async () => {
  assertEquals(await runGpuProbeLockCli([]), 2);
  assertEquals(await runGpuProbeLockCli(["--"]), 2);
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

Deno.test("summarizeThreePanelProbe skips startup samples for steady timing", () => {
  const summary = summarizeThreePanelProbe(threePanelProbeSamples);

  assertEquals(summary.first?.index, 1);
  assertEquals(summary.latest?.index, 3);
  assertEquals(summary.steady.map((sample) => sample.index), [2, 3]);
  assertEquals(summary.averageTotalMs, 12);
  assertEquals(summary.averageInitMs, 2);
  assertEquals(summary.averageSceneMs, 10);
  assertEquals(summary.averageSceneUpdateMs, 3);
  assertEquals(summary.averageSceneRenderMs, 7);
  assertEquals(summary.averageReadbackMs, 12);
  assertEquals(summary.averageAssemblyMs, 0.6);
});

Deno.test("formatThreePanelProbeLines includes first-grid latency and frame rows", () => {
  const lines = formatThreePanelProbeLines(
    {
      mode: "studio",
      glyphs: "blocks",
      readback: "blocking",
      width: 80,
      height: 24,
      maxCells: 480,
      intervalMs: 1000 / 18,
    },
    threePanelProbeSamples,
    420.25,
  );

  assertEquals(lines[0], "three-panel live probe");
  assertStringIncludes(lines[1], "readback=blocking");
  assertStringIncludes(lines[1], "rect=80x24");
  assertStringIncludes(lines[2], "steady=12.00ms");
  assertStringIncludes(lines[2], "latest=40x12/480c");
  assertStringIncludes(lines[2], "firstGrid=420.25ms");
  assertStringIncludes(lines[3], "updates=4");
  assertStringIncludes(lines[3], "init=2.00ms");
  assertStringIncludes(lines[3], "update=3.00ms");
  assertStringIncludes(lines[3], "render=7.00ms");
  assertStringIncludes(lines[3], "queue=2/1/1");
  assertStringIncludes(lines.at(-1)!, "03 total=14.00ms init=3.00ms");
  assertStringIncludes(lines[4], "queue=2/2/0 saturated");
  assertStringIncludes(lines.at(-1)!, "state=idle");
});

Deno.test("validateThreePanelProbeSummary accepts live renderer samples", () => {
  const result = validateThreePanelProbeSummary(summarizeThreePanelProbe(threePanelProbeSamples), {
    minSteadyFrames: 2,
    minGridUpdates: 4,
    maxAverageTotalMs: 20,
  });

  assertEquals(result, { ok: true, errors: [] });
});

Deno.test("validateThreePanelProbeSummary rejects stale or slow probes", () => {
  const result = validateThreePanelProbeSummary(summarizeThreePanelProbe(threePanelProbeSamples), {
    minSteadyFrames: 3,
    minGridUpdates: 5,
    maxAverageTotalMs: 10,
  });

  assertEquals(result.ok, false);
  assertStringIncludes(result.errors.join("\n"), "steady renderer frames 2 < 3");
  assertStringIncludes(result.errors.join("\n"), "grid updates 4 < 5");
  assertStringIncludes(result.errors.join("\n"), "average renderer frame 12.00ms > 10.00ms");
});

const threePanelProbeSamples: ThreePanelProbeSample[] = [
  {
    index: 1,
    elapsedMs: 500,
    totalMs: 2,
    initMs: 0,
    sceneMs: 0,
    readbackMs: 0,
    assemblyMs: 0,
    columns: 0,
    rows: 0,
    cells: 480,
    updates: 2,
    deferredPending: 2,
    deferredUnresolved: 2,
    deferredResolved: 0,
    deferredSaturated: true,
    lifecycle: "initializing",
  },
  {
    index: 2,
    elapsedMs: 56,
    totalMs: 10,
    initMs: 1,
    sceneMs: 8,
    sceneUpdateMs: 2,
    sceneRenderMs: 6,
    readbackMs: 11,
    assemblyMs: 0.5,
    columns: 40,
    rows: 12,
    cells: 480,
    updates: 3,
    deferredPending: 1,
    deferredUnresolved: 1,
    deferredResolved: 0,
    deferredSaturated: false,
    lifecycle: "idle",
  },
  {
    index: 3,
    elapsedMs: 56,
    totalMs: 14,
    initMs: 3,
    sceneMs: 12,
    sceneUpdateMs: 4,
    sceneRenderMs: 8,
    readbackMs: 13,
    assemblyMs: 0.7,
    columns: 40,
    rows: 12,
    cells: 480,
    updates: 4,
    deferredPending: 2,
    deferredUnresolved: 1,
    deferredResolved: 1,
    deferredSaturated: false,
    lifecycle: "idle",
  },
];

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}
