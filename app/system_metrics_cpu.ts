import { clamp } from "./styles.ts";
import type { CpuCoreSnapshot } from "./types.ts";

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
