import { clamp } from "./styles.ts";
import type { SystemMetricsProvider } from "./system_metrics_provider.ts";
import type { CpuCoreSnapshot, DiskSnapshot, SystemMetricDiagnostic, TemperatureSnapshot } from "./types.ts";

export interface CpuTimes {
  total: number;
  idle: number;
}

export interface CpuStatSample {
  times: CpuTimes[];
  overall: number;
  cores: CpuCoreSnapshot[];
  totalDelta: number;
}

export interface TemperatureSample {
  temperatures: TemperatureSnapshot[];
  diagnostic?: SystemMetricDiagnostic;
}

/** Parses `/proc/stat` CPU rows and computes utilization from previous jiffy counters. */
export function sampleCpuStatRows(
  text: string,
  previousTimes: readonly CpuTimes[],
  fallbackCores: readonly CpuCoreSnapshot[],
): CpuStatSample {
  const times: CpuTimes[] = [];
  const cores: CpuCoreSnapshot[] = [];
  let overall = 0;
  let totalDelta = 1;
  let index = 0;

  for (const row of text.split("\n")) {
    if (!row.startsWith("cpu")) continue;
    const parts = row.trim().split(/\s+/);
    let idle = 0;
    let total = 0;
    for (let partIndex = 1; partIndex < parts.length; partIndex += 1) {
      const value = Number(parts[partIndex] ?? 0);
      total += value;
      if (partIndex === 4 || partIndex === 5) idle += value;
    }
    const previous = previousTimes[index] ?? { total, idle };
    const nextTotalDelta = total - previous.total;
    const idleDelta = idle - previous.idle;
    const usage = nextTotalDelta > 0 ? clamp(1 - idleDelta / nextTotalDelta, 0, 1) * 100 : 0;

    times[index] = { total, idle };
    if (index === 0) {
      overall = usage;
      totalDelta = Math.max(1, nextTotalDelta);
    } else {
      cores.push({
        label: String(index - 1),
        usage,
      });
    }
    index += 1;
  }

  return {
    times,
    overall,
    cores: cores.length > 0 ? cores : [...fallbackCores],
    totalDelta,
  };
}

/** Parses portable `df -B1P` output into bounded disk snapshots sorted by usage pressure. */
export function parseDfDiskRows(output: string, limit = 8): DiskSnapshot[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];

  const disks: DiskSnapshot[] = [];
  const lines = output.split("\n");
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;
    const filesystem = parts[0] ?? "";
    const mount = parts[5] ?? "/";
    if (!filesystem.startsWith("/dev/") && mount !== "/") continue;
    insertDiskSnapshot(disks, {
      filesystem,
      mount,
      total: Number(parts[1] ?? 0),
      used: Number(parts[2] ?? 0),
      available: Number(parts[3] ?? 0),
      percent: Number((parts[4] ?? "0").replace("%", "")),
    }, safeLimit);
  }
  return disks;
}

function insertDiskSnapshot(disks: DiskSnapshot[], disk: DiskSnapshot, limit: number): void {
  if (disks.length === limit && disk.percent <= (disks[disks.length - 1]?.percent ?? -Infinity)) return;

  let index = 0;
  while (index < disks.length && (disks[index]?.percent ?? -Infinity) >= disk.percent) {
    index += 1;
  }
  disks.splice(index, 0, disk);
  if (disks.length > limit) disks.length = limit;
}

/** Samples Linux thermal zones from `/sys/class/thermal`. */
export async function sampleTemperatures(provider: SystemMetricsProvider): Promise<TemperatureSample> {
  const started = performance.now();
  const sampledAt = provider.now();
  const zones: TemperatureSnapshot[] = [];
  try {
    for await (const entry of provider.readDir("/sys/class/thermal")) {
      if (!entry.name.startsWith("thermal_zone")) {
        continue;
      }

      const base = `/sys/class/thermal/${entry.name}`;
      const [labelText, tempText] = await Promise.all([
        provider.readTextFile(`${base}/type`).catch(() => ""),
        provider.readTextFile(`${base}/temp`).catch(() => ""),
      ]);

      const celsius = Number.parseFloat(tempText.trim());
      if (!Number.isFinite(celsius)) {
        continue;
      }

      zones.push({
        label: labelText.trim() || entry.name,
        celsius: celsius > 1000 ? celsius / 1000 : celsius,
      });
    }
  } catch {
    return {
      temperatures: [],
      diagnostic: {
        source: "temperature",
        status: "unavailable",
        detail: "thermal zone scan failed",
        durationMs: performance.now() - started,
        sampledAt,
      },
    };
  }

  const temperatures = zones.sort((a, b) => b.celsius - a.celsius);
  return {
    temperatures,
    diagnostic: {
      source: "temperature",
      status: temperatures.length > 0 ? "ok" : "unavailable",
      detail: temperatures.length > 0 ? `sampled ${temperatures.length} thermal zone(s)` : "no thermal zones available",
      durationMs: performance.now() - started,
      sampledAt,
    },
  };
}
