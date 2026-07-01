import type { WorkbenchWindowOptionGroup } from "../src/app/workbench_window_registry.ts";
import type { Accent, SourceFrame, SystemSnapshot } from "./types.ts";

export type WorkbenchSyntheticGroup = WorkbenchWindowOptionGroup;

export interface SyntheticWorkbenchSystemOptions {
  cpuCoreCount?: number;
  timestamp?: number;
}

export function monitorSourceIds(visualizationId: string): string[] {
  switch (visualizationId) {
    case "cpu-monitor":
      return ["sys:cpu", "sys:load"];
    case "cpu-legend":
      return ["sys:cpu-cores"];
    case "cpu-hex-grid":
      return ["sys:cpu-cores", "sys:processes"];
    case "gpu-combined-monitor":
      return ["sys:gpu", "sys:gpu-chip", "sys:gpu-memory"];
    case "gpu-chip-monitor":
      return ["sys:gpu-chip", "sys:gpu"];
    case "gpu-memory-monitor":
      return ["sys:gpu-memory", "sys:gpu"];
    case "memory-monitor":
      return ["sys:memory", "sys:swap", "sys:load"];
    case "temperature-monitor":
      return ["sys:temperature", "sys:alerts"];
    case "disk-monitor":
      return ["sys:disk", "sys:alerts"];
    case "network-monitor":
      return ["sys:network"];
    case "process-monitor":
      return ["sys:processes", "sys:cpu"];
    default:
      return ["sys:cpu", "sys:memory", "sys:alerts"];
  }
}

export function syntheticWorkbenchSources(
  id: string,
  group: WorkbenchSyntheticGroup,
  phase: number,
): SourceFrame[] {
  const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const specs: Array<{ id: string; name: string; accent: Accent; offset: number }> = [
    { id: "primary", name: group, accent: group === "Monitor" ? "signal" : "phosphor", offset: seed % 29 },
    { id: "secondary", name: "Harmonic", accent: "violet", offset: seed % 41 },
    { id: "noise", name: "Noise", accent: seed % 2 === 0 ? "amber" : "alarm", offset: seed % 17 },
  ];
  return specs.map((spec, index) => {
    const series = Array.from(
      { length: 72 },
      (_, sample) => unitWave(phase + sample + spec.offset, 0.08 + index * 0.025, 0.11 + index * 0.07),
    );
    const value = series.at(-1) ?? 0.5;
    return {
      id: `workbench:${id}:${spec.id}`,
      name: spec.name,
      accent: spec.accent,
      value,
      series,
      detailLines: [`${Math.round(value * 100)}%`, group],
    };
  });
}

export function syntheticWorkbenchSystem(
  phase: number,
  group: WorkbenchSyntheticGroup,
  options: SyntheticWorkbenchSystemOptions = {},
): SystemSnapshot {
  const hot = unitWave(phase, 0.07, group === "Monitor" ? 0.1 : 0.33);
  const warm = unitWave(phase, 0.045, 0.55);
  const cpuCoreCount = Math.max(1, options.cpuCoreCount ?? globalThis.navigator?.hardwareConcurrency ?? 1);
  return {
    timestamp: options.timestamp ?? Date.now(),
    hostname: "workbench",
    osRelease: "demo",
    uptimeSeconds: phase,
    loadavg: [hot * 2.4, warm * 1.8, Math.max(hot, warm)],
    cpuOverall: hot * 100,
    cpuCores: Array.from({ length: cpuCoreCount }, (_, index) => ({
      label: String(index),
      usage: unitWave(phase + index * 7, 0.06, index * 0.13) * 100,
    })),
    cpuHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.07, 0.03) * 100),
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
    gpuUtilizationHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.075, 0.31)),
    gpuMemoryHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.042, 0.62)),
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
    memoryHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.045, 0.21)),
    swapHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.038, 0.49) * 0.35),
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
    rxHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.1, 0.2)),
    txHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.085, 0.4)),
    processes: Array.from({ length: 8 }, (_, index) => ({
      pid: 4200 + index,
      name: ["deno", "webgpu", "worker", "renderer", "scheduler", "cache", "input", "theme"][index] ?? "task",
      state: index % 3 === 0 ? "run" : "sleep",
      cpuPercent: unitWave(phase + index, 0.09, index * 0.2) * 80,
      memoryPercent: unitWave(phase + index, 0.05, index * 0.15) * 18,
      memoryBytes: (128 + index * 64) * 1024 ** 2,
      processor: index % cpuCoreCount,
    })),
    alerts: hot > 0.92 ? [{ severity: "warning", title: "WORKBENCH", detail: "LOAD SPIKE" }] : [],
    diagnostics: [],
  };
}

export function unitWave(value: number, frequency: number, offset: number): number {
  return Math.max(
    0,
    Math.min(
      1,
      0.5 + Math.sin(value * frequency + offset) * 0.34 +
        Math.cos(value * (frequency * 0.37) + offset * 2.1) * 0.16,
    ),
  );
}
