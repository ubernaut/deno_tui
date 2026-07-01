import { assertEquals } from "./deps.ts";
import {
  type SystemMetricsCommandOutput,
  type SystemMetricsDirEntry,
  type SystemMetricsNetworkInterface,
  type SystemMetricsProvider,
  SystemMonitor,
} from "../app/system_metrics.ts";

const encoder = new TextEncoder();

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

Deno.test("SystemMonitor bounds process scans and reports degraded sources", async () => {
  const provider = new FixtureMetricsProvider();
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
      diagnostic.detail.includes("2")
    ),
    true,
  );
  assertEquals(
    snapshot.diagnostics.some((diagnostic) => diagnostic.source === "gpu" && diagnostic.status === "unavailable"),
    true,
  );
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

class FixtureMetricsProvider implements SystemMetricsProvider {
  nowValue = 1_000;
  files = new Map<string, string>();
  dirs = new Map<string, SystemMetricsDirEntry[]>();
  commands = new Map<string, SystemMetricsCommandOutput>();

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

  async readTextFile(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) {
      throw new Error(`missing fixture file: ${path}`);
    }
    return value;
  }

  async *readDir(path: string): AsyncIterable<SystemMetricsDirEntry> {
    for (const entry of this.dirs.get(path) ?? []) {
      yield entry;
    }
  }

  async command(command: string, _args: string[]): Promise<SystemMetricsCommandOutput> {
    return this.commands.get(command) ?? { success: false, stdout: new Uint8Array() };
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
