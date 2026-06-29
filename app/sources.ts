import { AudioRegistry } from "./audio.ts";
import { clamp } from "./styles.ts";
import type { AudioCatalogEntry, SourceDescriptor, SourceFrame, SystemSnapshot } from "./types.ts";

export function buildSourceCatalog(audioCatalog: AudioCatalogEntry[]) {
  const sources: SourceDescriptor[] = [
    {
      id: "sys:cpu",
      name: "CPU Total",
      description: "Overall CPU load history and average utilization.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:cpu-cores",
      name: "CPU Cores",
      description: "Per-core activity distribution.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:gpu",
      name: "GPU Combined",
      description: "GPU utilization and VRAM pressure.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:gpu-chip",
      name: "GPU Chip",
      description: "GPU core utilization, thermals, power, and clocks.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:gpu-memory",
      name: "GPU Memory",
      description: "Dedicated GPU memory usage.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:memory",
      name: "Memory",
      description: "RAM usage history and available memory.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:swap",
      name: "Swap",
      description: "Swap pressure and paging activity.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:network",
      name: "Network",
      description: "Ingress and egress bandwidth.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:disk",
      name: "Disks",
      description: "Filesystem capacity and mount pressure.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:temperature",
      name: "Temperatures",
      description: "Thermal zone readings.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:processes",
      name: "Processes",
      description: "Top processes by CPU and memory.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:load",
      name: "Load Average",
      description: "1, 5, and 15 minute load averages.",
      group: "System",
      kind: "system",
    },
    {
      id: "sys:alerts",
      name: "Alert Bus",
      description: "Neon warning and alarm conditions.",
      group: "System",
      kind: "system",
    },
    {
      id: "synth:pulse",
      name: "Synthetic Pulse",
      description: "A stable reactive control pulse.",
      group: "Synthetic",
      kind: "synthetic",
    },
    {
      id: "synth:clock",
      name: "Synthetic Clock",
      description: "A stepped timing sequence.",
      group: "Synthetic",
      kind: "synthetic",
    },
    {
      id: "synth:noise",
      name: "Synthetic Noise",
      description: "Pseudo-random modulation field.",
      group: "Synthetic",
      kind: "synthetic",
    },
  ];

  for (const entry of audioCatalog) {
    sources.push({
      id: entry.id,
      name: entry.label,
      description: entry.description,
      group: entry.role === "audio-in" ? "Audio In" : "Audio Out",
      kind: "audio",
    });
  }

  return sources;
}

export function resolveSourceFrames(
  sourceIds: string[],
  system: SystemSnapshot,
  audio: AudioRegistry,
  phase: number,
) {
  if (sourceIds.length === 0) {
    return [syntheticPulseSource(phase)];
  }

  return sourceIds.map((sourceId) => getSourceFrame(sourceId, system, audio, phase));
}

export function getSourceFrame(
  sourceId: string,
  system: SystemSnapshot,
  audio: AudioRegistry,
  phase: number,
): SourceFrame {
  switch (sourceId) {
    case "sys:cpu":
      return {
        id: sourceId,
        name: "CPU",
        accent: system.cpuOverall >= 85 ? "alarm" : system.cpuOverall >= 70 ? "amber" : "signal",
        value: clamp(system.cpuOverall / 100, 0, 1),
        series: system.cpuHistory,
        detailLines: [
          `AVG ${system.cpuOverall.toFixed(1)}%`,
          `LOAD ${system.loadavg.map((value) => value.toFixed(2)).join(" / ")}`,
        ],
      };
    case "sys:cpu-cores":
      return {
        id: sourceId,
        name: "CPU Cores",
        accent: "signal",
        value: clamp(system.cpuOverall / 100, 0, 1),
        series: system.cpuCores.map((core) => core.usage / 100),
        detailLines: system.cpuCores.map((core) => `CPU${core.label.padStart(2, "0")} ${core.usage.toFixed(0)}%`),
      };
    case "sys:gpu":
      return {
        id: sourceId,
        name: "GPU",
        accent: gpuAccent(system.gpu.utilizationPercent, system.gpu.memoryPercent, system.gpu.available),
        value: system.gpu.available
          ? clamp(Math.max(system.gpu.utilizationPercent, system.gpu.memoryPercent) / 100, 0, 1)
          : 0,
        series: system.gpuUtilizationHistory.map((value, index) =>
          Math.max(value, system.gpuMemoryHistory[index] ?? 0)
        ),
        detailLines: gpuDetailLines(system),
      };
    case "sys:gpu-chip":
      return {
        id: sourceId,
        name: "GPU Chip",
        accent: gpuAccent(system.gpu.utilizationPercent, 0, system.gpu.available),
        value: system.gpu.available ? clamp(system.gpu.utilizationPercent / 100, 0, 1) : 0,
        series: system.gpuUtilizationHistory,
        detailLines: gpuChipDetailLines(system),
      };
    case "sys:gpu-memory":
      return {
        id: sourceId,
        name: "GPU Memory",
        accent: gpuAccent(0, system.gpu.memoryPercent, system.gpu.available),
        value: system.gpu.available ? clamp(system.gpu.memoryPercent / 100, 0, 1) : 0,
        series: system.gpuMemoryHistory,
        detailLines: gpuMemoryDetailLines(system),
      };
    case "sys:memory":
      return {
        id: sourceId,
        name: "Memory",
        accent: system.memory.percent >= 85 ? "alarm" : system.memory.percent >= 70 ? "amber" : "phosphor",
        value: clamp(system.memory.percent / 100, 0, 1),
        series: system.memoryHistory,
        detailLines: [
          `USED ${system.memory.percent.toFixed(1)}%`,
          `AVAIL ${bytesToShort(system.memory.available)}`,
        ],
      };
    case "sys:swap":
      return {
        id: sourceId,
        name: "Swap",
        accent: system.memory.swapPercent >= 85 ? "alarm" : "amber",
        value: clamp(system.memory.swapPercent / 100, 0, 1),
        series: system.swapHistory,
        detailLines: [
          `USED ${system.memory.swapPercent.toFixed(1)}%`,
          `FREE ${bytesToShort(Math.max(0, system.memory.swapTotal - system.memory.swapUsed))}`,
        ],
      };
    case "sys:network":
      return {
        id: sourceId,
        name: "Network",
        accent: "signal",
        value: clamp(Math.max(last(system.rxHistory), last(system.txHistory)), 0, 1),
        series: system.rxHistory.map((value, index) => Math.max(value, system.txHistory[index] ?? 0)),
        detailLines: system.networks.slice(0, 3).map((network) =>
          `${network.name.toUpperCase()} ${bytesToShort(network.rxRate)}↓ ${bytesToShort(network.txRate)}↑`
        ),
      };
    case "sys:disk":
      return {
        id: sourceId,
        name: "Disks",
        accent: system.disks[0]?.percent >= 90 ? "alarm" : "amber",
        value: clamp((system.disks[0]?.percent ?? 0) / 100, 0, 1),
        series: system.disks.map((disk) => disk.percent / 100),
        detailLines: system.disks.slice(0, 4).map((disk) => `${disk.mount.toUpperCase()} ${disk.percent}%`),
      };
    case "sys:temperature":
      return {
        id: sourceId,
        name: "Temperatures",
        accent: system.temperatures[0]?.celsius >= 80
          ? "alarm"
          : system.temperatures[0]?.celsius >= 70
          ? "amber"
          : "violet",
        value: clamp((system.temperatures[0]?.celsius ?? 0) / 100, 0, 1),
        series: system.temperatures.map((entry) => clamp(entry.celsius / 100, 0, 1)),
        detailLines: system.temperatures.slice(0, 4).map((entry) =>
          `${entry.label.toUpperCase()} ${entry.celsius.toFixed(1)}C`
        ),
      };
    case "sys:processes":
      return {
        id: sourceId,
        name: "Processes",
        accent: "amber",
        value: clamp((system.processes[0]?.cpuPercent ?? 0) / 100, 0, 1),
        series: system.processes.slice(0, 12).map((process) => clamp(process.cpuPercent / 100, 0, 1)),
        detailLines: system.processes.slice(0, 5).map((process) =>
          `${process.name.toUpperCase()} ${process.cpuPercent.toFixed(1)}%`
        ),
      };
    case "sys:load": {
      const cores = Math.max(1, navigator.hardwareConcurrency || 1);
      return {
        id: sourceId,
        name: "Load Average",
        accent: system.loadavg[0] >= cores * 0.9 ? "alarm" : system.loadavg[0] >= cores * 0.7 ? "amber" : "signal",
        value: clamp(system.loadavg[0] / cores, 0, 1),
        series: system.loadavg.map((value) => clamp(value / cores, 0, 1)),
        detailLines: [
          `1M ${system.loadavg[0].toFixed(2)}`,
          `5M ${system.loadavg[1].toFixed(2)}`,
          `15M ${system.loadavg[2].toFixed(2)}`,
        ],
      };
    }
    case "sys:alerts":
      return {
        id: sourceId,
        name: "Alert Bus",
        accent: system.alerts[0]?.severity === "alarm" ? "alarm" : system.alerts.length > 0 ? "amber" : "signal",
        value: system.alerts.length > 0 ? 1 : 0.12,
        series: system.alerts.map((_, index) => clamp(1 - index * 0.18, 0.2, 1)),
        detailLines: system.alerts.length > 0
          ? system.alerts.map((alert) => `${alert.title} ${alert.detail}`).slice(0, 4)
          : ["NO ACTIVE SYSTEM ALERTS"],
      };
    case "synth:clock":
      return syntheticClockSource(phase);
    case "synth:noise":
      return syntheticNoiseSource(phase);
    case "synth:pulse":
      return syntheticPulseSource(phase);
    default:
      if (sourceId.startsWith("audio:")) {
        const snapshot = audio.getSnapshot(sourceId);
        const label = audio.catalog.find((entry) => entry.id === sourceId)?.label ?? sourceId;
        return {
          id: sourceId,
          name: label,
          accent: label.startsWith("System:") ? "signal" : "violet",
          value: snapshot.rms,
          series: snapshot.history,
          detailLines: [
            `RMS ${(snapshot.rms * 100).toFixed(1)}%`,
            `PEAK ${(snapshot.peak * 100).toFixed(1)}%`,
            snapshot.active ? "LIVE AUDIO LINK" : "WAITING FOR AUDIO",
          ],
        };
      }
      return syntheticPulseSource(phase);
  }
}

function syntheticPulseSource(phase: number): SourceFrame {
  return {
    id: "synth:pulse",
    name: "Synthetic Pulse",
    accent: "signal",
    value: (Math.sin(phase * 0.22) + 1) / 2,
    series: range(48).map((index) => clamp((Math.sin((phase + index) * 0.24) + 1) / 2, 0, 1)),
    detailLines: ["REACTIVE PULSE BUS", "STABLE CONTROL DRIVER"],
  };
}

function syntheticClockSource(phase: number): SourceFrame {
  return {
    id: "synth:clock",
    name: "Synthetic Clock",
    accent: "amber",
    value: ((phase % 60) + 1) / 60,
    series: range(48).map((index) => ((phase + index) % 16) / 16),
    detailLines: [
      `TICK ${String(phase).padStart(5, "0")}`,
      `STEP ${String(phase % 60).padStart(2, "0")}`,
    ],
  };
}

function syntheticNoiseSource(phase: number): SourceFrame {
  return {
    id: "synth:noise",
    name: "Synthetic Noise",
    accent: "phosphor",
    value: pseudoRandom(phase, phase * 0.13),
    series: range(48).map((index) => pseudoRandom(index + phase, index * 0.17)),
    detailLines: ["PSEUDO-RANDOM VECTOR FIELD", "LOW CONFIDENCE INPUT"],
  };
}

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

function pseudoRandom(seedA: number, seedB: number) {
  const raw = Math.sin(seedA * 12.9898 + seedB * 78.233) * 43758.5453;
  return clamp(raw - Math.floor(raw), 0, 1);
}

function last(values: number[]) {
  return values[values.length - 1] ?? 0;
}

function gpuAccent(utilization: number, memory: number, available: boolean) {
  if (!available) return "violet";
  const pressure = Math.max(utilization, memory);
  return pressure >= 90 ? "alarm" : pressure >= 72 ? "amber" : "violet";
}

function gpuDetailLines(system: SystemSnapshot) {
  if (!system.gpu.available) return ["GPU TELEMETRY OFFLINE", "INSTALL NVIDIA-SMI OR ENABLE DRIVER METRICS"];
  return [
    system.gpu.name,
    `CHIP ${system.gpu.utilizationPercent.toFixed(0)}%  VRAM ${system.gpu.memoryPercent.toFixed(0)}%`,
    `MEM ${bytesToShort(system.gpu.memoryUsed)} / ${bytesToShort(system.gpu.memoryTotal)}`,
    gpuThermalPowerLine(system),
  ];
}

function gpuChipDetailLines(system: SystemSnapshot) {
  if (!system.gpu.available) return ["GPU CHIP OFFLINE"];
  return [
    system.gpu.name,
    `UTIL ${system.gpu.utilizationPercent.toFixed(0)}%`,
    gpuThermalPowerLine(system),
    `GFX ${formatOptionalNumber(system.gpu.graphicsClockMhz, "MHz")}  MEM ${
      formatOptionalNumber(system.gpu.memoryClockMhz, "MHz")
    }`,
  ];
}

function gpuMemoryDetailLines(system: SystemSnapshot) {
  if (!system.gpu.available) return ["GPU MEMORY OFFLINE"];
  return [
    `VRAM ${system.gpu.memoryPercent.toFixed(0)}%`,
    `${bytesToShort(system.gpu.memoryUsed)} USED`,
    `${bytesToShort(Math.max(0, system.gpu.memoryTotal - system.gpu.memoryUsed))} FREE`,
    `${bytesToShort(system.gpu.memoryTotal)} TOTAL`,
  ];
}

function gpuThermalPowerLine(system: SystemSnapshot) {
  return `TEMP ${formatOptionalNumber(system.gpu.temperatureCelsius, "C")}  POWER ${
    formatOptionalNumber(system.gpu.powerWatts, "W")
  }`;
}

function formatOptionalNumber(value: number | null, suffix: string) {
  return value === null ? "--" : `${value.toFixed(value >= 100 ? 0 : 1)}${suffix}`;
}

function bytesToShort(value: number) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let amount = Math.max(0, value);
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toFixed(amount >= 100 || index === 0 ? 0 : amount >= 10 ? 1 : 2)}${units[index]}`;
}
