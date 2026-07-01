import { assertEquals } from "./deps.ts";
import { sampleTemperatures } from "../app/system_metrics_temperature.ts";
import type {
  SystemMetricsCommandOptions,
  SystemMetricsCommandOutput,
  SystemMetricsDirEntry,
  SystemMetricsNetworkInterface,
  SystemMetricsProvider,
} from "../app/system_metrics_provider.ts";

Deno.test("sampleTemperatures reads thermal zones, converts millidegrees, and sorts hottest first", async () => {
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
