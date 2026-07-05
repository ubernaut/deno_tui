import { assertEquals } from "./deps.ts";
import { parseDfDiskRows, sampleCpuStatRows, sampleTemperatures } from "../app/system_metrics_sources.ts";
import type {
  SystemMetricsCommandOptions,
  SystemMetricsCommandOutput,
  SystemMetricsDirEntry,
  SystemMetricsNetworkInterface,
  SystemMetricsProvider,
} from "../app/system_metrics_provider.ts";

Deno.test("system metrics sources compute CPU usage deltas", () => {
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

Deno.test("system metrics sources fall back when CPU rows omit cores", () => {
  const fallback = [{ label: "0", usage: 33 }];
  const sample = sampleCpuStatRows("cpu  1 0 0 9 0 0 0 0 0 0", [], fallback);

  assertEquals(sample.overall, 0);
  assertEquals(sample.totalDelta, 1);
  assertEquals(sample.cores, fallback);
  assertEquals(sample.cores === fallback, false);
});

Deno.test("system metrics sources parse disk rows by pressure", () => {
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

Deno.test("system metrics sources cap disk rows and preserve numeric fields", () => {
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

Deno.test("system metrics sources preserve disk ordering for ties and zero limits", () => {
  const output = [
    "Filesystem 1B-blocks Used Available Use% Mounted on",
    "/dev/a 10 7 3 70% /a",
    "/dev/b 10 7 3 70% /b",
    "/dev/c 10 9 1 90% /c",
  ].join("\n");

  assertEquals(parseDfDiskRows(output, 0), []);
  assertEquals(parseDfDiskRows(output, 3).map((disk) => disk.mount), ["/c", "/a", "/b"]);
});

Deno.test("system metrics sources read thermal zones and sort hottest first", async () => {
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

Deno.test("system metrics sources report unavailable when thermal scan fails", async () => {
  const provider = new FixtureThermalProvider();
  provider.dirError = new Error("permission denied");

  const sample = await sampleTemperatures(provider);

  assertEquals(sample.temperatures, []);
  assertEquals(sample.diagnostic?.status, "unavailable");
  assertEquals(sample.diagnostic?.detail, "thermal zone scan failed");
});

class FixtureThermalProvider implements SystemMetricsProvider {
  files = new Map<string, string>();
  dirs = new Map<string, SystemMetricsDirEntry[]>();
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

  async readTextFile(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) throw new Error(`missing ${path}`);
    return value;
  }

  async *readDir(path: string): AsyncIterable<SystemMetricsDirEntry> {
    if (this.dirError) throw this.dirError;
    for (const entry of this.dirs.get(path) ?? []) {
      yield entry;
    }
  }

  command(
    _command: string,
    _args: string[],
    _options?: SystemMetricsCommandOptions,
  ): Promise<SystemMetricsCommandOutput> {
    return Promise.resolve({ success: false, stdout: new Uint8Array() });
  }
}
