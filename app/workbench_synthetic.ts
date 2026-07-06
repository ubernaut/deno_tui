import type { WorkbenchWindowOptionGroup } from "../src/app/workbench_window_registry.ts";
import type { Accent, SourceFrame, SystemSnapshot } from "./types.ts";
import { stringSeed, unitWave, waveSeries } from "./visualization_primitives.ts";

export { unitWave } from "./visualization_primitives.ts";

type WorkbenchSyntheticGroup = WorkbenchWindowOptionGroup;

interface SyntheticWorkbenchSystemOptions {
  cpuCoreCount?: number;
  timestamp?: number;
}

export function monitorSourceIds(visualizationId: string): string[] {
  return monitorSourceIdsInto([], visualizationId);
}

export function monitorSourceIdsInto(target: string[], visualizationId: string): string[] {
  target.length = 0;
  switch (visualizationId) {
    case "cpu-monitor":
      target.push("sys:cpu", "sys:load");
      break;
    case "cpu-legend":
      target.push("sys:cpu-cores");
      break;
    case "cpu-hex-grid":
      target.push("sys:cpu-cores", "sys:processes");
      break;
    case "gpu-combined-monitor":
      target.push("sys:gpu", "sys:gpu-chip", "sys:gpu-memory");
      break;
    case "gpu-chip-monitor":
      target.push("sys:gpu-chip", "sys:gpu");
      break;
    case "gpu-memory-monitor":
      target.push("sys:gpu-memory", "sys:gpu");
      break;
    case "memory-monitor":
      target.push("sys:memory", "sys:swap", "sys:load");
      break;
    case "temperature-monitor":
      target.push("sys:temperature", "sys:alerts");
      break;
    case "disk-monitor":
      target.push("sys:disk", "sys:alerts");
      break;
    case "network-monitor":
      target.push("sys:network");
      break;
    case "process-monitor":
      target.push("sys:processes", "sys:cpu");
      break;
    default:
      target.push("sys:cpu", "sys:memory", "sys:alerts");
      break;
  }
  return target;
}

export function syntheticWorkbenchSources(
  id: string,
  group: WorkbenchSyntheticGroup,
  phase: number,
): SourceFrame[] {
  return syntheticWorkbenchSourcesInto([], id, group, phase);
}

export function syntheticWorkbenchSourcesInto(
  target: SourceFrame[],
  id: string,
  group: WorkbenchSyntheticGroup,
  phase: number,
): SourceFrame[] {
  const seed = stringSeed(id);
  target.length = 3;
  target[0] = syntheticWorkbenchSourceFrame(
    id,
    group,
    "primary",
    group,
    group === "Monitor" ? "signal" : "phosphor",
    seed % 29,
    phase,
    0,
  );
  target[1] = syntheticWorkbenchSourceFrame(id, group, "secondary", "Harmonic", "violet", seed % 41, phase, 1);
  target[2] = syntheticWorkbenchSourceFrame(
    id,
    group,
    "noise",
    "Noise",
    seed % 2 === 0 ? "amber" : "alarm",
    seed % 17,
    phase,
    2,
  );
  return target;
}

function syntheticWorkbenchSourceFrame(
  id: string,
  group: WorkbenchSyntheticGroup,
  sourceId: string,
  name: string,
  accent: Accent,
  offset: number,
  phase: number,
  index: number,
): SourceFrame {
  const series = waveSeries(72, phase + offset, 0.08 + index * 0.025, 0.11 + index * 0.07);
  const value = series.at(-1) ?? 0.5;
  return {
    id: `workbench:${id}:${sourceId}`,
    name,
    accent,
    value,
    series,
    detailLines: [`${Math.round(value * 100)}%`, group],
  };
}

export function syntheticWorkbenchSystem(
  phase: number,
  group: WorkbenchSyntheticGroup,
  options: SyntheticWorkbenchSystemOptions = {},
): SystemSnapshot {
  const hot = unitWave(phase, 0.07, group === "Monitor" ? 0.1 : 0.33);
  const warm = unitWave(phase, 0.045, 0.55);
  const cpuCoreCount = Math.max(1, options.cpuCoreCount ?? globalThis.navigator?.hardwareConcurrency ?? 1);
  const cpuCores = new Array<SystemSnapshot["cpuCores"][number]>(cpuCoreCount);
  for (let index = 0; index < cpuCoreCount; index++) {
    cpuCores[index] = {
      label: String(index),
      usage: unitWave(phase + index * 7, 0.06, index * 0.13) * 100,
    };
  }
  const processes = new Array<SystemSnapshot["processes"][number]>(8);
  const processNames = ["deno", "webgpu", "worker", "renderer", "scheduler", "cache", "input", "theme"];
  for (let index = 0; index < processes.length; index++) {
    processes[index] = {
      pid: 4200 + index,
      name: processNames[index] ?? "task",
      state: index % 3 === 0 ? "run" : "sleep",
      cpuPercent: unitWave(phase + index, 0.09, index * 0.2) * 80,
      memoryPercent: unitWave(phase + index, 0.05, index * 0.15) * 18,
      memoryBytes: (128 + index * 64) * 1024 ** 2,
      processor: index % cpuCoreCount,
    };
  }

  return {
    timestamp: options.timestamp ?? Date.now(),
    hostname: "workbench",
    osRelease: "demo",
    uptimeSeconds: phase,
    loadavg: [hot * 2.4, warm * 1.8, Math.max(hot, warm)],
    cpuOverall: hot * 100,
    cpuCores,
    cpuHistory: waveSeries(72, phase, 0.07, 0.03, 100),
    gpu: {
      available: true,
      name: "Workbench RTX",
      utilizationPercent: hot * 100,
      memoryUsed: warm * 18 * 1024 ** 3,
      memoryTotal: 24 * 1024 ** 3,
      memoryPercent: warm * 75,
      temperatureCelsius: 34 + hot * 48,
      powerWatts: 90 + hot * 230,
      graphicsClockMhz: 1500 + hot * 1050,
      memoryClockMhz: 9000 + warm * 1500,
    },
    gpuUtilizationHistory: waveSeries(72, phase, 0.075, 0.31),
    gpuMemoryHistory: waveSeries(72, phase, 0.042, 0.62),
    memory: {
      total: 32 * 1024 ** 3,
      used: warm * 26 * 1024 ** 3,
      available: (1 - warm) * 26 * 1024 ** 3,
      free: (1 - warm) * 18 * 1024 ** 3,
      swapTotal: 8 * 1024 ** 3,
      swapUsed: hot * 2 * 1024 ** 3,
      percent: warm * 100,
      swapPercent: hot * 25,
    },
    memoryHistory: waveSeries(72, phase, 0.045, 0.21),
    swapHistory: waveSeries(72, phase, 0.038, 0.49, 0.35),
    temperatures: [
      { label: "CPU", celsius: 38 + hot * 50 },
      { label: "GPU", celsius: 35 + warm * 46 },
    ],
    disks: [
      {
        filesystem: "/dev/nvme0n1",
        mount: "/",
        total: 1024 * 1024 ** 3,
        used: warm * 820 * 1024 ** 3,
        available: (1 - warm) * 820 * 1024 ** 3,
        percent: Math.round(warm * 100),
      },
    ],
    networks: [
      {
        name: "eth0",
        addresses: ["10.0.0.2"],
        rxBytes: phase * 95_000,
        txBytes: phase * 72_000,
        rxRate: hot * 95_000_000,
        txRate: warm * 72_000_000,
      },
    ],
    rxHistory: waveSeries(72, phase, 0.1, 0.2),
    txHistory: waveSeries(72, phase, 0.085, 0.4),
    processes,
    alerts: hot > 0.92 ? [{ severity: "warning", title: "WORKBENCH", detail: "LOAD SPIKE" }] : [],
    diagnostics: [],
  };
}
