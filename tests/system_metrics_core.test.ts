import { assertEquals } from "./deps.ts";
import {
  emptyGpuSnapshot,
  NvidiaSmiGpuMetricsProvider,
  parseDfDiskRows,
  sampleCpuStatRows,
  sampleNetworkStats,
  sampleTemperatures,
} from "../app/system_metrics_sources.ts";
import type {
  SystemMetricsCommandOptions,
  SystemMetricsCommandOutput,
  SystemMetricsDirEntry,
  SystemMetricsNetworkInterface,
  SystemMetricsProvider,
} from "../app/system_metrics_sources.ts";

Deno.test("NvidiaSmiGpuMetricsProvider parses utilization memory and nullable telemetry", async () => {
  const provider = new FixtureThermalProvider();
  provider.commands.set("nvidia-smi", commandOutput("Fixture RTX, 75, 1024, 4096, 66, 120, 1800, 5000\n"));

  const sample = await new NvidiaSmiGpuMetricsProvider().sampleGpu({
    provider,
    current: emptyGpuSnapshot(),
  });

  assertEquals(sample.gpu, {
    available: true,
    name: "Fixture RTX",
    utilizationPercent: 75,
    memoryUsed: 1024 * 1024 ** 2,
    memoryTotal: 4096 * 1024 ** 2,
    memoryPercent: 25,
    temperatureCelsius: 66,
    powerWatts: 120,
    graphicsClockMhz: 1800,
    memoryClockMhz: 5000,
  });
  assertEquals(sample.diagnostic?.status, "ok");
});

Deno.test("NvidiaSmiGpuMetricsProvider handles unsupported optional fields", async () => {
  const provider = new FixtureThermalProvider();
  provider.commands.set("nvidia-smi", commandOutput("Fixture GPU, 150, n/a, 0, Not Supported, N/A, , \n"));

  const sample = await new NvidiaSmiGpuMetricsProvider().sampleGpu({
    provider,
    current: emptyGpuSnapshot(),
  });

  assertEquals(sample.gpu.utilizationPercent, 100);
  assertEquals(sample.gpu.memoryPercent, 0);
  assertEquals(sample.gpu.temperatureCelsius, null);
  assertEquals(sample.gpu.powerWatts, null);
  assertEquals(sample.gpu.graphicsClockMhz, null);
  assertEquals(sample.gpu.memoryClockMhz, null);
});

Deno.test("emptyGpuSnapshot exposes stable unavailable GPU state", () => {
  assertEquals(emptyGpuSnapshot(), {
    available: false,
    name: "GPU unavailable",
    utilizationPercent: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    memoryPercent: 0,
    temperatureCelsius: null,
    powerWatts: null,
    graphicsClockMhz: null,
    memoryClockMhz: null,
  });
});

Deno.test("sampleNetworkStats computes interface rates and ignores loopback totals", () => {
  const interfaces: SystemMetricsNetworkInterface[] = [
    { name: "eth0", address: "10.0.0.2" },
    { name: "wlan0", address: "192.168.1.7" },
    { name: "lo", address: "127.0.0.1" },
  ];
  const previous = sampleNetworkStats(
    procNetDev({ eth0: [100, 50], wlan0: [20, 10], lo: [1, 1] }),
    interfaces,
    new Map(),
    1_000,
  );
  const next = sampleNetworkStats(
    procNetDev({ eth0: [300, 250], wlan0: [20, 40], lo: [1_000, 1_000] }),
    interfaces,
    previous.counters,
    3_000,
  );

  assertEquals(next.totalRxRate, 100);
  assertEquals(next.totalTxRate, 115);
  assertEquals(next.networks.map((network) => [network.name, network.addresses, network.rxRate, network.txRate]), [
    ["eth0", ["10.0.0.2"], 100, 100],
    ["wlan0", ["192.168.1.7"], 0, 15],
  ]);
});

Deno.test("sampleNetworkStats clamps negative rates and hides inactive unaddressed interfaces", () => {
  const previous = new Map([
    ["eth0", { rxBytes: 500, txBytes: 500, sampledAt: 1_000 }],
    ["ghost0", { rxBytes: 100, txBytes: 100, sampledAt: 1_000 }],
  ]);
  const sample = sampleNetworkStats(
    procNetDev({ eth0: [400, 450], ghost0: [100, 100] }),
    [{ name: "eth0", address: "10.0.0.2" }],
    previous,
    2_000,
  );

  assertEquals(sample.networks.map((network) => [network.name, network.rxRate, network.txRate]), [
    ["eth0", 0, 0],
  ]);
});

Deno.test("sampleCpuStatRows computes CPU usage deltas", () => {
  const previous = sampleCpuStatRows(
    [
      "cpu  100 0 0 100 0 0 0 0 0 0",
      "cpu0 40 0 0 60 0 0 0 0 0 0",
      "cpu1 60 0 0 40 0 0 0 0 0 0",
    ].join("\n"),
    [],
    [],
  );

  const next = sampleCpuStatRows(
    [
      "cpu  150 0 0 150 0 0 0 0 0 0",
      "cpu0 80 0 0 80 0 0 0 0 0 0",
      "cpu1 70 0 0 70 0 0 0 0 0 0",
    ].join("\n"),
    previous.times,
    [],
  );

  assertEquals(next.overall, 50);
  assertEquals(next.totalDelta, 100);
  assertEquals(next.cores, [
    { label: "0", usage: 66.66666666666667 },
    { label: "1", usage: 25 },
  ]);
});

Deno.test("sampleCpuStatRows falls back when CPU rows omit cores", () => {
  const fallback = [{ label: "0", usage: 33 }];
  const sample = sampleCpuStatRows("cpu  1 0 0 9 0 0 0 0 0 0", [], fallback);

  assertEquals(sample.overall, 0);
  assertEquals(sample.totalDelta, 1);
  assertEquals(sample.cores, fallback);
  assertEquals(sample.cores === fallback, false);
});

Deno.test("parseDfDiskRows sorts disk rows by pressure", () => {
  const disks = parseDfDiskRows([
    "Filesystem 1B-blocks Used Available Use% Mounted on",
    "/dev/nvme0n1p2 1000 850 150 85% /",
    "tmpfs 100 2 98 2% /run",
    "/dev/nvme0n1p1 500 125 375 25% /boot",
    "overlay 200 199 1 99% /var/lib/container",
    "/dev/sda1 800 720 80 90% /mnt/archive",
  ].join("\n"));

  assertEquals(disks.map((disk) => [disk.filesystem, disk.mount, disk.percent]), [
    ["/dev/sda1", "/mnt/archive", 90],
    ["/dev/nvme0n1p2", "/", 85],
    ["/dev/nvme0n1p1", "/boot", 25],
  ]);
});

Deno.test("parseDfDiskRows caps rows and preserves numeric fields", () => {
  const disks = parseDfDiskRows(
    [
      "Filesystem 1B-blocks Used Available Use% Mounted on",
      "/dev/a 10 9 1 90% /a",
      "/dev/b 20 10 10 50% /b",
      "/dev/c 30 3 27 10% /c",
    ].join("\n"),
    2,
  );

  assertEquals(disks, [
    { filesystem: "/dev/a", mount: "/a", total: 10, used: 9, available: 1, percent: 90 },
    { filesystem: "/dev/b", mount: "/b", total: 20, used: 10, available: 10, percent: 50 },
  ]);
});

Deno.test("parseDfDiskRows preserves disk ordering for ties and zero limits", () => {
  const output = [
    "Filesystem 1B-blocks Used Available Use% Mounted on",
    "/dev/a 10 7 3 70% /a",
    "/dev/b 10 7 3 70% /b",
    "/dev/c 10 9 1 90% /c",
  ].join("\n");

  assertEquals(parseDfDiskRows(output, 0), []);
  assertEquals(parseDfDiskRows(output, 3).map((disk) => disk.mount), ["/c", "/a", "/b"]);
});

Deno.test("sampleTemperatures reads thermal zones and sorts hottest first", async () => {
  const provider = new FixtureThermalProvider();
  provider.dirs.set("/sys/class/thermal", [
    { name: "thermal_zone0", isDirectory: true },
    { name: "cooling_device0", isDirectory: true },
    { name: "thermal_zone1", isDirectory: true },
    { name: "thermal_zone2", isDirectory: true },
  ]);
  provider.files.set("/sys/class/thermal/thermal_zone0/type", "x86_pkg_temp\n");
  provider.files.set("/sys/class/thermal/thermal_zone0/temp", "55000\n");
  provider.files.set("/sys/class/thermal/thermal_zone1/temp", "61.5\n");
  provider.files.set("/sys/class/thermal/thermal_zone2/type", "bad\n");
  provider.files.set("/sys/class/thermal/thermal_zone2/temp", "not-a-number\n");

  const sample = await sampleTemperatures(provider);

  assertEquals(sample.temperatures, [
    { label: "thermal_zone1", celsius: 61.5 },
    { label: "x86_pkg_temp", celsius: 55 },
  ]);
  assertEquals(sample.diagnostic?.source, "temperature");
  assertEquals(sample.diagnostic?.status, "ok");
  assertEquals(sample.diagnostic?.detail, "sampled 2 thermal zone(s)");
  assertEquals(sample.diagnostic?.sampledAt, 1_000);
});

Deno.test("sampleTemperatures reports unavailable when thermal scan fails", async () => {
  const provider = new FixtureThermalProvider();
  provider.dirError = new Error("permission denied");

  const sample = await sampleTemperatures(provider);

  assertEquals(sample.temperatures, []);
  assertEquals(sample.diagnostic?.status, "unavailable");
  assertEquals(sample.diagnostic?.detail, "thermal zone scan failed");
});

function procNetDev(counters: Record<string, [number, number]>): string {
  const rows = Object.entries(counters).map(([name, [rxBytes, txBytes]]) =>
    `${name}: ${rxBytes} 0 0 0 0 0 0 0 ${txBytes} 0 0 0 0 0 0 0`
  );
  return [
    "Inter-|   Receive                                                |  Transmit",
    " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
    ...rows,
  ].join("\n");
}

function commandOutput(output: string): SystemMetricsCommandOutput {
  return {
    success: true,
    stdout: new TextEncoder().encode(output),
  };
}

class FixtureThermalProvider implements SystemMetricsProvider {
  files = new Map<string, string>();
  dirs = new Map<string, SystemMetricsDirEntry[]>();
  commands = new Map<string, SystemMetricsCommandOutput>();
  dirError?: Error;

  now(): number {
    return 1_000;
  }

  hostname(): string {
    return "host";
  }

  osRelease(): string {
    return "os";
  }

  hardwareConcurrency(): number {
    return 1;
  }

  systemMemoryInfo(): Deno.SystemMemoryInfo {
    return {
      total: 0,
      free: 0,
      available: 0,
      buffers: 0,
      cached: 0,
      swapTotal: 0,
      swapFree: 0,
    };
  }

  loadavg(): [number, number, number] {
    return [0, 0, 0];
  }

  networkInterfaces(): SystemMetricsNetworkInterface[] {
    return [];
  }

  readTextFile(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) return Promise.reject(new Error(`missing ${path}`));
    return Promise.resolve(value);
  }

  async *readDir(path: string): AsyncIterable<SystemMetricsDirEntry> {
    if (this.dirError) throw this.dirError;
    for (const entry of this.dirs.get(path) ?? []) {
      yield entry;
    }
  }

  command(
    command: string,
    _args: string[],
    _options?: SystemMetricsCommandOptions,
  ): Promise<SystemMetricsCommandOutput> {
    return Promise.resolve(this.commands.get(command) ?? { success: false, stdout: new Uint8Array() });
  }
}
