import { assertEquals } from "./deps.ts";
import { compactDiagnostics, processDiagnostics, SystemMonitor } from "../app/system_metrics.ts";
import type {
  GpuSample,
  SystemGpuMetricsProvider,
  SystemGpuMetricsProviderContext,
  SystemMetricsCommandOptions,
  SystemMetricsCommandOutput,
  SystemMetricsDirEntry,
  SystemMetricsNetworkInterface,
  SystemMetricsProvider,
} from "../app/system_metrics_sources.ts";
import { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";

const encoder = new TextEncoder();

Deno.test("system metric diagnostics sort severe diagnostics before ok entries", () => {
  assertEquals(
    compactDiagnostics([
      { source: "gpu", status: "ok", detail: "sampled", sampledAt: 1 },
      undefined,
      { source: "cpu", status: "unavailable", detail: "missing", sampledAt: 1 },
      { source: "process", status: "limited", detail: "capped", sampledAt: 1 },
      { source: "disk", status: "degraded", detail: "partial", sampledAt: 1 },
    ]).map((diagnostic) => [diagnostic.source, diagnostic.status]),
    [
      ["cpu", "unavailable"],
      ["disk", "degraded"],
      ["process", "limited"],
      ["gpu", "ok"],
    ],
  );
});

Deno.test("process diagnostics reports scan error limited degraded and ok states", () => {
  assertEquals(
    processDiagnostics({ scanned: 0, failedReads: 0, limited: false, durationMs: 2, scanError: "EACCES" }, 5),
    {
      source: "process",
      status: "unavailable",
      detail: "/proc scan failed: EACCES",
      durationMs: 2,
      sampledAt: 5,
    },
  );
  assertEquals(processDiagnostics({ scanned: 100, failedReads: 0, limited: true, durationMs: 3 }, 5).status, "limited");
  assertEquals(
    processDiagnostics({ scanned: 100, failedReads: 2, limited: false, durationMs: 4 }, 5).status,
    "degraded",
  );
  assertEquals(processDiagnostics({ scanned: 100, failedReads: 0, limited: false, durationMs: 5 }, 5).status, "ok");
});

Deno.test("SystemMonitor samples through an injectable metrics provider", async () => {
  const provider = new FixtureMetricsProvider();
  provider.files.set("/proc/stat", procStatFirst());
  provider.files.set("/proc/uptime", "123.45 100.00\n");
  provider.files.set("/proc/net/dev", procNetDev(1_000, 2_000));
  provider.files.set("/proc/42/stat", processStat(100, 256, 7));
  provider.files.set("/sys/class/thermal/thermal_zone0/type", "x86_pkg_temp\n");
  provider.files.set("/sys/class/thermal/thermal_zone0/temp", "55000\n");
  provider.dirs.set("/proc", [{ name: "42", isDirectory: true }, { name: "self", isDirectory: false }]);
  provider.dirs.set("/sys/class/thermal", [{ name: "thermal_zone0", isDirectory: true }]);
  provider.commands.set("df", commandOutput(dfOutput()));
  provider.commands.set("nvidia-smi", commandOutput("Fixture RTX, 75, 1024, 4096, 66, 120, 1800, 5000\n"));

  const monitor = new SystemMonitor(4, provider);
  await monitor.sample();

  provider.nowValue = 2_000;
  provider.files.set("/proc/stat", procStatSecond());
  provider.files.set("/proc/net/dev", procNetDev(126_000, 252_000));
  provider.files.set("/proc/42/stat", processStat(140, 256, 7));
  await monitor.sample();

  const snapshot = monitor.snapshot.peek();
  assertEquals(snapshot.timestamp, 2_000);
  assertEquals(snapshot.hostname, "fixture-host");
  assertEquals(snapshot.osRelease, "fixture-os");
  assertEquals(Math.round(snapshot.cpuOverall), 50);
  assertEquals(snapshot.cpuCores.map((core) => Math.round(core.usage)), [50, 50]);
  assertEquals(snapshot.memory.percent, 60);
  assertEquals(snapshot.swapHistory.at(-1), 0.5);
  assertEquals(snapshot.temperatures[0], { label: "x86_pkg_temp", celsius: 55 });
  assertEquals(snapshot.disks[0]?.mount, "/");
  assertEquals(snapshot.networks[0]?.name, "eth0");
  assertEquals(Math.round(snapshot.networks[0]?.rxRate ?? 0), 125_000);
  assertEquals(Math.round(snapshot.networks[0]?.txRate ?? 0), 250_000);
  assertEquals(snapshot.gpu.available, true);
  assertEquals(snapshot.gpu.name, "Fixture RTX");
  assertEquals(snapshot.gpu.memoryPercent, 25);
  assertEquals(snapshot.processes[0]?.pid, 42);
  assertEquals(snapshot.processes[0]?.processor, 7);
  assertEquals(
    snapshot.diagnostics.some((diagnostic) => diagnostic.source === "gpu" && diagnostic.status === "ok"),
    true,
  );
  assertEquals(
    snapshot.diagnostics.some((diagnostic) => diagnostic.source === "process" && diagnostic.status === "ok"),
    true,
  );
});

Deno.test("SystemMonitor accepts a pluggable GPU metrics provider", async () => {
  const provider = new FixtureMetricsProvider();
  const gpuProvider = new FixtureGpuProvider();
  provider.files.set("/proc/stat", procStatFirst());
  provider.files.set("/proc/uptime", "123.45 100.00\n");
  provider.files.set("/proc/net/dev", procNetDev(1_000, 2_000));

  const monitor = new SystemMonitor({
    historyLength: 4,
    provider,
    gpuProvider,
  });
  await monitor.sample();

  const snapshot = monitor.snapshot.peek();
  assertEquals(snapshot.gpu.available, true);
  assertEquals(snapshot.gpu.name, "Fixture Arc");
  assertEquals(snapshot.gpu.utilizationPercent, 42);
  assertEquals(snapshot.gpu.memoryPercent, 50);
  assertEquals(provider.commandCalls.get("nvidia-smi"), undefined);
  assertEquals(gpuProvider.samples, 1);
  assertEquals(
    snapshot.diagnostics.some((diagnostic) =>
      diagnostic.source === "gpu" && diagnostic.status === "ok" && diagnostic.detail === "fixture gpu provider"
    ),
    true,
  );
});

Deno.test("SystemMonitor reports metadata fallback diagnostics", () => {
  const diagnostics = new DiagnosticsCollector();
  const monitor = new SystemMonitor({
    provider: new ThrowingMetadataMetricsProvider(),
    diagnostics,
  });
  const snapshot = monitor.snapshot.peek();

  assertEquals(snapshot.hostname, "unknown-host");
  assertEquals(snapshot.osRelease, "unknown-os");
  assertEquals(
    diagnostics.entries().map((entry) => [entry.source, entry.code, entry.severity]),
    [
      ["system-metrics", "hostname-unavailable", "warning"],
      ["system-metrics", "os-release-unavailable", "warning"],
    ],
  );
});

Deno.test("SystemMonitor bounds process scans and reports degraded sources", async () => {
  const provider = new FixtureMetricsProvider();
  const diagnostics = new DiagnosticsCollector();
  provider.files.set("/proc/stat", procStatFirst());
  provider.files.set("/proc/uptime", "123.45 100.00\n");
  provider.files.set("/proc/net/dev", procNetDev(1_000, 2_000));
  provider.files.set("/proc/40/stat", processStatForPid(40, 100, 256, 0));
  provider.files.set("/proc/41/stat", processStatForPid(41, 100, 256, 1));
  provider.files.set("/proc/42/stat", processStatForPid(42, 100, 256, 0));
  provider.dirs.set("/proc", [
    { name: "40", isDirectory: true },
    { name: "41", isDirectory: true },
    { name: "42", isDirectory: true },
  ]);

  const monitor = new SystemMonitor({
    historyLength: 4,
    provider,
    diagnostics,
    processScanLimit: 2,
    processLimit: 1,
  });
  await monitor.sample();

  provider.nowValue = 2_000;
  provider.files.set("/proc/stat", procStatSecond());
  provider.files.set("/proc/net/dev", procNetDev(126_000, 252_000));
  provider.files.set("/proc/40/stat", processStatForPid(40, 160, 256, 0));
  provider.files.set("/proc/41/stat", processStatForPid(41, 130, 256, 1));
  provider.files.set("/proc/42/stat", processStatForPid(42, 999, 256, 0));
  await monitor.sample();

  const snapshot = monitor.snapshot.peek();
  assertEquals(snapshot.processes.length, 1);
  assertEquals(snapshot.processes[0]?.pid, 40);
  assertEquals(snapshot.processes.some((process) => process.pid === 42), false);
  assertEquals(
    snapshot.diagnostics.some((diagnostic) =>
      diagnostic.source === "process" && diagnostic.status === "limited" &&
      diagnostic.detail.includes("2") && typeof diagnostic.durationMs === "number"
    ),
    true,
  );
  assertEquals(
    snapshot.diagnostics.some((diagnostic) => diagnostic.source === "gpu" && diagnostic.status === "unavailable"),
    true,
  );
  assertEquals(diagnostics.entries().map((entry) => [entry.source, entry.code, entry.severity]), [
    ["system-metrics", "nvidia-smi-unavailable", "info"],
    ["system-metrics", "nvidia-smi-unavailable", "info"],
  ]);
  assertEquals(
    snapshot.diagnostics.some((diagnostic) => diagnostic.source === "disk" && diagnostic.status === "unavailable"),
    true,
  );
  assertEquals(
    snapshot.diagnostics.some((diagnostic) =>
      diagnostic.source === "temperature" && diagnostic.status === "unavailable"
    ),
    true,
  );
});

Deno.test("SystemMonitor exposes top 100 process rows with bounded scan cost", async () => {
  const provider = new FixtureMetricsProvider();
  provider.files.set("/proc/stat", procStatFirst());
  provider.files.set("/proc/uptime", "123.45 100.00\n");
  provider.files.set("/proc/net/dev", procNetDev(1_000, 2_000));
  provider.dirs.set(
    "/proc",
    Array.from({ length: 120 }, (_, index) => ({ name: String(index + 1), isDirectory: true })),
  );
  for (let pid = 1; pid <= 120; pid += 1) {
    provider.files.set(`/proc/${pid}/stat`, processStatForPid(pid, 100 + pid, pid, pid % 2));
  }

  const monitor = new SystemMonitor({
    historyLength: 4,
    provider,
    processLimit: 100,
    processScanLimit: 100,
    processSortKey: "pid",
  });
  await monitor.sample();

  const snapshot = monitor.snapshot.peek();
  assertEquals(snapshot.processes.length, 100);
  assertEquals(snapshot.processes[0]?.pid, 1);
  assertEquals(snapshot.processes.at(-1)?.pid, 100);
  assertEquals(snapshot.processes.some((process) => process.pid === 101), false);
  assertEquals(
    snapshot.diagnostics.some((diagnostic) =>
      diagnostic.source === "process" && diagnostic.status === "limited" &&
      diagnostic.detail === "process scan capped at 100 entries" && typeof diagnostic.durationMs === "number"
    ),
    true,
  );
});

Deno.test("SystemMonitor supports process sort keys and refresh cadence", async () => {
  const provider = new FixtureMetricsProvider();
  provider.files.set("/proc/stat", procStatFirst());
  provider.files.set("/proc/uptime", "123.45 100.00\n");
  provider.files.set("/proc/net/dev", procNetDev(1_000, 2_000));
  provider.files.set("/proc/40/stat", processStatForPid(40, 100, 128, 0));
  provider.files.set("/proc/41/stat", processStatForPid(41, 100, 512, 1));
  provider.files.set("/proc/42/stat", processStatForPid(42, 100, 256, 0));
  provider.dirs.set("/proc", [
    { name: "40", isDirectory: true },
    { name: "41", isDirectory: true },
    { name: "42", isDirectory: true },
  ]);

  const monitor = new SystemMonitor({
    historyLength: 4,
    provider,
    processSortKey: "memory",
    processRefreshMs: 1_000,
  });
  await monitor.sample();

  provider.nowValue = 1_500;
  provider.files.set("/proc/stat", procStatSecond());
  provider.files.set("/proc/net/dev", procNetDev(126_000, 252_000));
  provider.files.set("/proc/40/stat", processStatForPid(40, 999, 4096, 0));
  provider.files.set("/proc/41/stat", processStatForPid(41, 100, 64, 1));
  await monitor.sample();

  const cached = monitor.snapshot.peek();
  assertEquals(cached.processes[0]?.pid, 41);
  assertEquals(
    cached.diagnostics.some((diagnostic) => diagnostic.source === "process" && diagnostic.status === "stale"),
    true,
  );

  provider.nowValue = 2_500;
  await monitor.sample();

  const refreshed = monitor.snapshot.peek();
  assertEquals(refreshed.processes[0]?.pid, 40);
  assertEquals(
    refreshed.diagnostics.some((diagnostic) => diagnostic.source === "process" && diagnostic.status === "ok"),
    true,
  );
});

Deno.test("SystemMonitor keeps sampling when required sources are partially unavailable", async () => {
  const provider = new FixtureMetricsProvider();
  provider.files.set("/proc/stat", procStatFirst());
  provider.files.set("/proc/uptime", "123.45 100.00\n");
  provider.dirErrors.set("/proc", new Error("permission denied"));

  const monitor = new SystemMonitor({
    historyLength: 4,
    provider,
  });
  await monitor.sample();

  const snapshot = monitor.snapshot.peek();
  assertEquals(snapshot.timestamp, 1_000);
  assertEquals(snapshot.uptimeSeconds, 123.45);
  assertEquals(
    snapshot.diagnostics.some((diagnostic) =>
      diagnostic.source === "network" && diagnostic.status === "unavailable" &&
      diagnostic.detail.includes("/proc/net/dev")
    ),
    true,
  );
  assertEquals(
    snapshot.diagnostics.some((diagnostic) =>
      diagnostic.source === "process" && diagnostic.status === "unavailable" &&
      diagnostic.detail.includes("permission denied") && typeof diagnostic.durationMs === "number"
    ),
    true,
  );
});

Deno.test("SystemMonitor degrades disk metrics when df command throws", async () => {
  const provider = new FixtureMetricsProvider();
  provider.files.set("/proc/stat", procStatFirst());
  provider.files.set("/proc/uptime", "123.45 100.00\n");
  provider.files.set("/proc/net/dev", procNetDev(1_000, 2_000));
  provider.commandErrors.set("df", new Error("command missing"));

  const monitor = new SystemMonitor({
    historyLength: 4,
    provider,
  });
  await monitor.sample();

  const snapshot = monitor.snapshot.peek();
  assertEquals(snapshot.timestamp, 1_000);
  assertEquals(
    snapshot.diagnostics.some((diagnostic) =>
      diagnostic.source === "disk" && diagnostic.status === "unavailable" &&
      diagnostic.detail.includes("command missing") && typeof diagnostic.durationMs === "number"
    ),
    true,
  );
});

Deno.test("SystemMonitor times out hung command-backed samplers", async () => {
  const provider = new FixtureMetricsProvider();
  const diagnostics = new DiagnosticsCollector();
  provider.files.set("/proc/stat", procStatFirst());
  provider.files.set("/proc/uptime", "123.45 100.00\n");
  provider.files.set("/proc/net/dev", procNetDev(1_000, 2_000));
  provider.commandHangs.add("df");
  provider.commandHangs.add("nvidia-smi");

  const monitor = new SystemMonitor({
    historyLength: 4,
    provider,
    diagnostics,
    commandTimeoutMs: 5,
  });
  await monitor.sample();

  const snapshot = monitor.snapshot.peek();
  assertEquals(snapshot.timestamp, 1_000);
  assertEquals(
    snapshot.diagnostics.some((diagnostic) =>
      diagnostic.source === "disk" && diagnostic.status === "unavailable" &&
      diagnostic.detail.includes("timed out") && typeof diagnostic.durationMs === "number"
    ),
    true,
  );
  assertEquals(
    snapshot.diagnostics.some((diagnostic) =>
      diagnostic.source === "gpu" && diagnostic.status === "unavailable" &&
      diagnostic.detail === "nvidia-smi sampling failed" && typeof diagnostic.durationMs === "number"
    ),
    true,
  );
  assertEquals(
    diagnostics.entries().some((entry) =>
      entry.source === "system-metrics" && entry.code === "nvidia-smi-failed" &&
      entry.detail?.includes("timed out")
    ),
    true,
  );
});

class FixtureGpuProvider implements SystemGpuMetricsProvider {
  samples = 0;

  sampleGpu(context: SystemGpuMetricsProviderContext): Promise<GpuSample> {
    this.samples += 1;
    return Promise.resolve({
      gpu: {
        available: true,
        name: "Fixture Arc",
        utilizationPercent: 42,
        memoryUsed: 2048,
        memoryTotal: 4096,
        memoryPercent: 50,
        temperatureCelsius: 61,
        powerWatts: 90,
        graphicsClockMhz: 1800,
        memoryClockMhz: 8000,
      },
      diagnostic: {
        source: "gpu",
        status: "ok",
        detail: "fixture gpu provider",
        durationMs: 0,
        sampledAt: context.provider.now(),
      },
    });
  }
}

class FixtureMetricsProvider implements SystemMetricsProvider {
  nowValue = 1_000;
  files = new Map<string, string>();
  dirs = new Map<string, SystemMetricsDirEntry[]>();
  dirErrors = new Map<string, Error>();
  commands = new Map<string, SystemMetricsCommandOutput>();
  commandErrors = new Map<string, Error>();
  commandHangs = new Set<string>();
  commandCalls = new Map<string, number>();

  now(): number {
    return this.nowValue;
  }

  hostname(): string {
    return "fixture-host";
  }

  osRelease(): string {
    return "fixture-os";
  }

  hardwareConcurrency(): number {
    return 2;
  }

  systemMemoryInfo(): Deno.SystemMemoryInfo {
    return {
      total: 1_000_000,
      free: 300_000,
      available: 400_000,
      buffers: 0,
      cached: 0,
      swapTotal: 200_000,
      swapFree: 100_000,
    };
  }

  loadavg(): [number, number, number] {
    return [1, 2, 3];
  }

  networkInterfaces(): SystemMetricsNetworkInterface[] {
    return [
      {
        name: "eth0",
        address: "192.0.2.10",
      },
    ];
  }

  readTextFile(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) {
      return Promise.reject(new Error(`missing fixture file: ${path}`));
    }
    return Promise.resolve(value);
  }

  async *readDir(path: string): AsyncIterable<SystemMetricsDirEntry> {
    const error = this.dirErrors.get(path);
    if (error) throw error;
    for (const entry of this.dirs.get(path) ?? []) {
      yield entry;
    }
  }

  async command(
    command: string,
    _args: string[],
    _options?: SystemMetricsCommandOptions,
  ): Promise<SystemMetricsCommandOutput> {
    this.commandCalls.set(command, (this.commandCalls.get(command) ?? 0) + 1);
    if (this.commandHangs.has(command)) {
      return await new Promise<SystemMetricsCommandOutput>(() => {});
    }
    const error = this.commandErrors.get(command);
    if (error) throw error;
    return this.commands.get(command) ?? { success: false, stdout: new Uint8Array() };
  }
}

class ThrowingMetadataMetricsProvider extends FixtureMetricsProvider {
  override hostname(): string {
    throw new Error("hostname denied");
  }

  override osRelease(): string {
    throw new Error("os release denied");
  }
}

function commandOutput(output: string): SystemMetricsCommandOutput {
  return {
    success: true,
    stdout: encoder.encode(output),
  };
}

function procStatFirst(): string {
  return [
    "cpu 100 0 100 800 0 0 0 0 0 0",
    "cpu0 50 0 50 400 0 0 0 0 0 0",
    "cpu1 50 0 50 400 0 0 0 0 0 0",
  ].join("\n");
}

function procStatSecond(): string {
  return [
    "cpu 150 0 150 900 0 0 0 0 0 0",
    "cpu0 100 0 50 450 0 0 0 0 0 0",
    "cpu1 50 0 100 450 0 0 0 0 0 0",
  ].join("\n");
}

function procNetDev(rxBytes: number, txBytes: number): string {
  return [
    "Inter-|   Receive                                                |  Transmit",
    " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
    `  eth0: ${rxBytes} 0 0 0 0 0 0 0 ${txBytes} 0 0 0 0 0 0 0`,
    "    lo: 10 0 0 0 0 0 0 0 10 0 0 0 0 0 0 0",
  ].join("\n");
}

function processStat(cpuTime: number, rssPages: number, processor: number): string {
  return processStatForPid(42, cpuTime, rssPages, processor);
}

function processStatForPid(pid: number, cpuTime: number, rssPages: number, processor: number): string {
  const tail = Array.from({ length: 37 }, () => "0");
  tail[0] = "R";
  tail[11] = String(cpuTime);
  tail[12] = "0";
  tail[21] = String(rssPages);
  tail[36] = String(processor);
  return `${pid} (fixture worker ${pid}) ${tail.join(" ")}`;
}

function dfOutput(): string {
  return [
    "Filesystem 1B-blocks Used Available Use% Mounted on",
    "/dev/sda1 100000 50000 50000 50% /",
  ].join("\n");
}
