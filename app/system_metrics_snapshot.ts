import { clamp } from "./styles.ts";
import { emptyGpuSnapshot } from "./system_metrics_gpu.ts";
import type {
  AlertMessage,
  DiskSnapshot,
  GpuSnapshot,
  NetworkSnapshot,
  SystemSnapshot,
  TemperatureSnapshot,
} from "./types.ts";

export function pushHistory(history: number[], value: number, limit: number): number[] {
  const next = history.slice(-Math.max(0, limit - 1));
  next.push(clamp(value, 0, 1));
  while (next.length < limit) {
    next.unshift(0);
  }
  return next;
}

export function collectAlerts(input: {
  cpuOverall: number;
  memoryPercent: number;
  swapPercent: number;
  temperatures: TemperatureSnapshot[];
  disks: DiskSnapshot[];
  networks: NetworkSnapshot[];
  gpu: GpuSnapshot;
}): AlertMessage[] {
  const alerts: AlertMessage[] = [];

  if (input.cpuOverall >= 90) {
    alerts.push({
      severity: "alarm",
      title: "CPU LIMIT",
      detail: `EXECUTION LOAD AT ${input.cpuOverall.toFixed(1)}%`,
    });
  } else if (input.cpuOverall >= 75) {
    alerts.push({
      severity: "warning",
      title: "CPU RISE",
      detail: `PROCESSOR WALL AT ${input.cpuOverall.toFixed(1)}%`,
    });
  }

  if (input.memoryPercent >= 90) {
    alerts.push({
      severity: "alarm",
      title: "MEMORY SATURATION",
      detail: `RAM USE AT ${input.memoryPercent.toFixed(1)}%`,
    });
  } else if (input.memoryPercent >= 80) {
    alerts.push({
      severity: "warning",
      title: "MEMORY CLIMB",
      detail: `RAM USE AT ${input.memoryPercent.toFixed(1)}%`,
    });
  }

  if (input.swapPercent >= 90) {
    alerts.push({
      severity: "alarm",
      title: "SWAP CRITICAL",
      detail: `SWAP USE AT ${input.swapPercent.toFixed(1)}%`,
    });
  }

  const hottest = input.temperatures[0];
  if (hottest && hottest.celsius >= 84) {
    alerts.push({
      severity: "alarm",
      title: "THERMAL LIMIT",
      detail: `${hottest.label.toUpperCase()} AT ${hottest.celsius.toFixed(1)}C`,
    });
  } else if (hottest && hottest.celsius >= 72) {
    alerts.push({
      severity: "warning",
      title: "THERMAL RISE",
      detail: `${hottest.label.toUpperCase()} AT ${hottest.celsius.toFixed(1)}C`,
    });
  }

  const fullestDisk = input.disks[0];
  if (fullestDisk && fullestDisk.percent >= 95) {
    alerts.push({
      severity: "alarm",
      title: "DISK CAPACITY",
      detail: `${fullestDisk.mount.toUpperCase()} AT ${fullestDisk.percent}%`,
    });
  } else if (fullestDisk && fullestDisk.percent >= 85) {
    alerts.push({
      severity: "warning",
      title: "DISK PRESSURE",
      detail: `${fullestDisk.mount.toUpperCase()} AT ${fullestDisk.percent}%`,
    });
  }

  const busiestNetwork = [...input.networks].sort((a, b) => (b.rxRate + b.txRate) - (a.rxRate + a.txRate))[0];
  if (busiestNetwork && busiestNetwork.rxRate + busiestNetwork.txRate > 125_000_000) {
    alerts.push({
      severity: "warning",
      title: "NETWORK SURGE",
      detail: `${busiestNetwork.name.toUpperCase()} ABOVE 125 MiB/s`,
    });
  }

  if (input.gpu.available && input.gpu.utilizationPercent >= 95) {
    alerts.push({
      severity: "warning",
      title: "GPU SATURATION",
      detail: `${input.gpu.name.toUpperCase()} AT ${input.gpu.utilizationPercent.toFixed(0)}%`,
    });
  }
  if (input.gpu.available && input.gpu.memoryPercent >= 92) {
    alerts.push({
      severity: "alarm",
      title: "VRAM LIMIT",
      detail: `GPU MEMORY AT ${input.gpu.memoryPercent.toFixed(0)}%`,
    });
  }

  return alerts.slice(0, 4);
}

export function emptySnapshot(hostname: string, osRelease: string, historyLength: number): SystemSnapshot {
  return {
    timestamp: 0,
    hostname,
    osRelease,
    uptimeSeconds: 0,
    loadavg: [0, 0, 0],
    cpuOverall: 0,
    cpuCores: [],
    cpuHistory: Array.from({ length: historyLength }, () => 0),
    gpu: emptyGpuSnapshot(),
    gpuUtilizationHistory: Array.from({ length: historyLength }, () => 0),
    gpuMemoryHistory: Array.from({ length: historyLength }, () => 0),
    memory: {
      total: 0,
      used: 0,
      available: 0,
      free: 0,
      swapTotal: 0,
      swapUsed: 0,
      percent: 0,
      swapPercent: 0,
    },
    memoryHistory: Array.from({ length: historyLength }, () => 0),
    swapHistory: Array.from({ length: historyLength }, () => 0),
    temperatures: [],
    disks: [],
    networks: [],
    rxHistory: Array.from({ length: historyLength }, () => 0),
    txHistory: Array.from({ length: historyLength }, () => 0),
    processes: [],
    alerts: [],
    diagnostics: [],
  };
}
