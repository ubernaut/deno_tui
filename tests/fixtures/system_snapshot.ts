import type { SystemSnapshot } from "../../app/types.ts";

export function emptySystemSnapshot(hostname: string, osRelease: string, historyLength: number): SystemSnapshot {
  const history = () => new Array<number>(Math.max(0, historyLength)).fill(0);
  return {
    timestamp: 0,
    hostname,
    osRelease,
    uptimeSeconds: 0,
    loadavg: [0, 0, 0],
    cpuOverall: 0,
    cpuCores: [],
    cpuHistory: history(),
    gpu: {
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
    },
    gpuUtilizationHistory: history(),
    gpuMemoryHistory: history(),
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
    memoryHistory: history(),
    swapHistory: history(),
    temperatures: [],
    disks: [],
    networks: [],
    rxHistory: history(),
    txHistory: history(),
    processes: [],
    alerts: [],
    diagnostics: [],
  };
}
