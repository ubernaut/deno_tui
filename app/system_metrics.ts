import { Signal } from "../src/signals/mod.ts";
import type { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import { clamp } from "./styles.ts";
import { compactDiagnostics, processDiagnostics } from "./system_metrics_diagnostics.ts";
import { parseDfDiskRows } from "./system_metrics_disk.ts";
import { NvidiaSmiGpuMetricsProvider, type SystemGpuMetricsProvider } from "./system_metrics_gpu.ts";
import {
  DenoSystemMetricsProvider,
  type SystemMetricsCommandOutput,
  type SystemMetricsProvider,
} from "./system_metrics_provider.ts";
import { parseProcessStat, processComparator, type SystemProcessSortKey } from "./system_metrics_process.ts";
import { collectAlerts, emptySnapshot, pushHistory } from "./system_metrics_snapshot.ts";
import type {
  CpuCoreSnapshot,
  DiskSnapshot,
  NetworkSnapshot,
  ProcessSnapshot,
  SystemMetricDiagnostic,
  SystemSnapshot,
  TemperatureSnapshot,
} from "./types.ts";

export {
  type GpuSample,
  NvidiaSmiGpuMetricsProvider,
  type SystemGpuMetricsProvider,
  type SystemGpuMetricsProviderContext,
} from "./system_metrics_gpu.ts";
export {
  DenoSystemMetricsProvider,
  type SystemMetricsCommandOptions,
  type SystemMetricsCommandOutput,
  type SystemMetricsDirEntry,
  type SystemMetricsNetworkInterface,
  type SystemMetricsProvider,
} from "./system_metrics_provider.ts";
export type { SystemProcessSortKey } from "./system_metrics_process.ts";

const COMMAND_OUTPUT_DECODER = new TextDecoder();

type CpuTimes = {
  total: number;
  idle: number;
};

type NetCounters = {
  rxBytes: number;
  txBytes: number;
  sampledAt: number;
};

type DiskCache = {
  sampledAt: number;
  disks: DiskSnapshot[];
};

type ProcessStatsSample = {
  stats: PromiseSettledResult<{ pid: number; stat: string }>[];
  scanned: number;
  failedReads: number;
  limited: boolean;
  durationMs: number;
  scanError?: string;
};

type TemperatureSample = {
  temperatures: TemperatureSnapshot[];
  diagnostic?: SystemMetricDiagnostic;
};

type DiskSample = {
  disks: DiskSnapshot[];
  diagnostic?: SystemMetricDiagnostic;
};

type ProcessCache = {
  sampledAt: number;
  processes: ProcessSnapshot[];
};

export interface SystemMonitorOptions {
  historyLength?: number;
  provider?: SystemMetricsProvider;
  gpuProvider?: SystemGpuMetricsProvider;
  diagnostics?: DiagnosticsCollector;
  processLimit?: number;
  processScanLimit?: number;
  processSortKey?: SystemProcessSortKey;
  processRefreshMs?: number;
  diskCacheMs?: number;
  commandTimeoutMs?: number;
}

export class SystemMonitor {
  snapshot: Signal<SystemSnapshot>;

  #provider: SystemMetricsProvider;
  #gpuProvider: SystemGpuMetricsProvider;
  #cpuTimes: CpuTimes[] = [];
  #netCounters = new Map<string, NetCounters>();
  #processCpu = new Map<number, number>();
  #timer: number | undefined;
  #sampleInFlight = false;
  #pageSize = 4096;
  #diskCache: DiskCache = { sampledAt: 0, disks: [] };
  #historyLength: number;
  #processLimit: number;
  #processScanLimit: number;
  #processSortKey: SystemProcessSortKey;
  #processRefreshMs: number;
  #processCache?: ProcessCache;
  #diskCacheMs: number;
  #commandTimeoutMs: number;
  #hostname: string;
  #osRelease: string;
  #diagnostics?: DiagnosticsCollector;

  constructor(
    historyLengthOrOptions: number | SystemMonitorOptions = 60,
    provider: SystemMetricsProvider = new DenoSystemMetricsProvider(),
  ) {
    const options = typeof historyLengthOrOptions === "number"
      ? { historyLength: historyLengthOrOptions, provider }
      : historyLengthOrOptions;
    this.#provider = options.provider ?? provider;
    this.#gpuProvider = options.gpuProvider ?? new NvidiaSmiGpuMetricsProvider();
    this.#historyLength = normalizePositiveInteger(options.historyLength, 60);
    this.#processLimit = normalizePositiveInteger(options.processLimit, 100);
    this.#processScanLimit = normalizePositiveInteger(options.processScanLimit, 4096);
    this.#processSortKey = options.processSortKey ?? "cpu";
    this.#processRefreshMs = normalizeNonNegativeInteger(options.processRefreshMs, 0);
    this.#diskCacheMs = normalizePositiveInteger(options.diskCacheMs, 10_000);
    this.#commandTimeoutMs = normalizePositiveInteger(options.commandTimeoutMs, 1_500);
    this.#diagnostics = options.diagnostics;
    this.#hostname = safeHostname(this.#provider);
    this.#osRelease = safeOsRelease(this.#provider);
    this.snapshot = new Signal(emptySnapshot(this.#hostname, this.#osRelease, this.#historyLength));
  }

  async start(intervalMs = 1000) {
    await this.sample();
    this.#timer = setInterval(() => {
      void this.sample();
    }, intervalMs);
  }

  stop() {
    clearInterval(this.#timer);
  }

  async sample() {
    if (this.#sampleInFlight) {
      return;
    }
    this.#sampleInFlight = true;

    try {
      const sampleStarted = performance.now();
      const current = this.snapshot.peek();
      const sampledAt = this.#provider.now();
      const useCachedProcesses = this.#processRefreshMs > 0 && this.#processCache !== undefined &&
        sampledAt - this.#processCache.sampledAt < this.#processRefreshMs;
      const [
        cpuRead,
        uptimeRead,
        networkRead,
        temperatureSample,
        diskSample,
        gpuSample,
        rawProcessSample,
      ] = await Promise.all([
        readMetricText(this.#provider, "/proc/stat", "cpu", ""),
        readMetricText(this.#provider, "/proc/uptime", "uptime", `${current.uptimeSeconds} 0`),
        readMetricText(this.#provider, "/proc/net/dev", "network", ""),
        sampleTemperatures(this.#provider),
        this.#sampleDisks(),
        this.#gpuProvider.sampleGpu({
          provider: this.#provider,
          current: current.gpu,
          diagnostics: this.#diagnostics,
          commandTimeoutMs: this.#commandTimeoutMs,
        }),
        useCachedProcesses ? Promise.resolve(undefined) : this.#collectProcessStats(),
      ]);

      const cpuSample = this.#sampleCpu(cpuRead.text, current);
      const memoryInfo = this.#provider.systemMemoryInfo();
      const memoryUsed = memoryInfo.total - memoryInfo.available;
      const swapUsed = memoryInfo.swapTotal - memoryInfo.swapFree;
      const memoryPercent = memoryInfo.total > 0 ? (memoryUsed / memoryInfo.total) * 100 : 0;
      const swapPercent = memoryInfo.swapTotal > 0 ? (swapUsed / memoryInfo.swapTotal) * 100 : 0;
      const networkSample = this.#sampleNetwork(networkRead.text);
      const processSample = this.#sampleProcesses(rawProcessSample, cpuSample.totalDelta, memoryInfo.total, sampledAt);
      const uptimeSeconds = Number.parseFloat(uptimeRead.text.split(" ")[0] ?? "0");
      const loadavg = this.#provider.loadavg();
      const diagnostics = compactDiagnostics([
        cpuRead.diagnostic,
        uptimeRead.diagnostic,
        networkRead.diagnostic,
        temperatureSample.diagnostic,
        diskSample.diagnostic,
        gpuSample.diagnostic,
        processSample.diagnostic,
        {
          source: "sample",
          status: "ok",
          detail: `sampled ${processSample.processes.length} processes`,
          durationMs: performance.now() - sampleStarted,
          sampledAt,
        },
      ]);

      const nextSnapshot: SystemSnapshot = {
        timestamp: sampledAt,
        hostname: this.#hostname,
        osRelease: this.#osRelease,
        uptimeSeconds,
        loadavg: [loadavg[0] ?? 0, loadavg[1] ?? 0, loadavg[2] ?? 0],
        cpuOverall: cpuSample.overall,
        cpuCores: cpuSample.cores,
        cpuHistory: pushHistory(current.cpuHistory, cpuSample.overall / 100, this.#historyLength),
        gpu: gpuSample.gpu,
        gpuUtilizationHistory: pushHistory(
          current.gpuUtilizationHistory,
          gpuSample.gpu.available ? gpuSample.gpu.utilizationPercent / 100 : 0,
          this.#historyLength,
        ),
        gpuMemoryHistory: pushHistory(
          current.gpuMemoryHistory,
          gpuSample.gpu.available ? gpuSample.gpu.memoryPercent / 100 : 0,
          this.#historyLength,
        ),
        memory: {
          total: memoryInfo.total,
          used: memoryUsed,
          available: memoryInfo.available,
          free: memoryInfo.free,
          swapTotal: memoryInfo.swapTotal,
          swapUsed,
          percent: memoryPercent,
          swapPercent,
        },
        memoryHistory: pushHistory(current.memoryHistory, memoryPercent / 100, this.#historyLength),
        swapHistory: pushHistory(current.swapHistory, swapPercent / 100, this.#historyLength),
        temperatures: temperatureSample.temperatures,
        disks: diskSample.disks,
        networks: networkSample.networks,
        rxHistory: pushHistory(
          current.rxHistory,
          clamp(networkSample.totalRxRate / 125_000_000, 0, 1),
          this.#historyLength,
        ),
        txHistory: pushHistory(
          current.txHistory,
          clamp(networkSample.totalTxRate / 125_000_000, 0, 1),
          this.#historyLength,
        ),
        processes: processSample.processes,
        alerts: collectAlerts({
          cpuOverall: cpuSample.overall,
          memoryPercent,
          swapPercent,
          temperatures: temperatureSample.temperatures,
          disks: diskSample.disks,
          networks: networkSample.networks,
          gpu: gpuSample.gpu,
        }),
        diagnostics,
      };

      this.snapshot.value = nextSnapshot;
    } catch (error) {
      // Keep the last successful snapshot visible if a sample fails.
      this.#diagnostics?.report({
        source: "system-metrics",
        code: "sample-failed",
        severity: "warning",
        message: "System metrics sample failed; keeping last snapshot.",
        detail: errorMessage(error),
      });
    } finally {
      this.#sampleInFlight = false;
    }
  }

  #sampleCpu(text: string, current: SystemSnapshot) {
    const rows = text.split("\n").filter((line) => line.startsWith("cpu"));
    const nextTimes: CpuTimes[] = [];
    const cores: CpuCoreSnapshot[] = [];
    let overall = 0;
    let totalDelta = 1;

    for (const [index, row] of rows.entries()) {
      const parts = row.trim().split(/\s+/).slice(1).map(Number);
      const idle = (parts[3] ?? 0) + (parts[4] ?? 0);
      const total = parts.reduce((sum, value) => sum + value, 0);
      const previous = this.#cpuTimes[index] ?? { total, idle };
      const nextTotalDelta = total - previous.total;
      const idleDelta = idle - previous.idle;
      const usage = nextTotalDelta > 0 ? clamp(1 - idleDelta / nextTotalDelta, 0, 1) * 100 : 0;

      nextTimes[index] = { total, idle };
      if (index === 0) {
        overall = usage;
        totalDelta = Math.max(1, nextTotalDelta);
      } else {
        cores.push({
          label: String(index - 1),
          usage,
        });
      }
    }

    this.#cpuTimes = nextTimes;

    return {
      overall,
      cores: cores.length > 0 ? cores : current.cpuCores,
      totalDelta,
    };
  }

  #sampleNetwork(text: string) {
    const sampledAt = this.#provider.now();
    const interfaces = this.#provider.networkInterfaces();
    const addressMap = new Map<string, string[]>();
    for (const entry of interfaces) {
      if (entry.name === "lo") {
        continue;
      }
      const addresses = addressMap.get(entry.name) ?? [];
      addresses.push(entry.address);
      addressMap.set(entry.name, addresses);
    }

    let totalRxRate = 0;
    let totalTxRate = 0;

    const networks = text
      .split("\n")
      .slice(2)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [namePart, countersPart] = line.split(":");
        const name = namePart?.trim() ?? "";
        const counters = countersPart?.trim().split(/\s+/).map(Number) ?? [];
        const rxBytes = counters[0] ?? 0;
        const txBytes = counters[8] ?? 0;
        const previous = this.#netCounters.get(name) ?? { rxBytes, txBytes, sampledAt };
        const elapsedSeconds = Math.max(0.001, (sampledAt - previous.sampledAt) / 1000);
        const rxRate = Math.max(0, (rxBytes - previous.rxBytes) / elapsedSeconds);
        const txRate = Math.max(0, (txBytes - previous.txBytes) / elapsedSeconds);
        this.#netCounters.set(name, { rxBytes, txBytes, sampledAt });
        if (name !== "lo") {
          totalRxRate += rxRate;
          totalTxRate += txRate;
        }
        return {
          name,
          addresses: addressMap.get(name) ?? [],
          rxBytes,
          txBytes,
          rxRate,
          txRate,
        } satisfies NetworkSnapshot;
      })
      .filter((entry) => entry.name !== "lo")
      .filter((entry) => entry.addresses.length > 0 || entry.rxRate > 0 || entry.txRate > 0)
      .sort((a, b) => {
        const aWeight = a.rxRate + a.txRate + (a.addresses.length > 0 ? 10_000_000_000 : 0);
        const bWeight = b.rxRate + b.txRate + (b.addresses.length > 0 ? 10_000_000_000 : 0);
        return bWeight - aWeight;
      })
      .slice(0, 8);

    return {
      networks,
      totalRxRate,
      totalTxRate,
    };
  }

  async #sampleDisks(): Promise<DiskSample> {
    const now = this.#provider.now();
    if (now - this.#diskCache.sampledAt < this.#diskCacheMs && this.#diskCache.disks.length > 0) {
      return { disks: this.#diskCache.disks };
    }

    const started = performance.now();
    let result: SystemMetricsCommandOutput;
    try {
      result = await runMetricCommand(
        this.#provider,
        "df",
        ["-B1P", "-x", "tmpfs", "-x", "devtmpfs", "-x", "squashfs"],
        this.#commandTimeoutMs,
      );
    } catch (error) {
      return {
        disks: this.#diskCache.disks,
        diagnostic: {
          source: "disk",
          status: this.#diskCache.disks.length > 0 ? "degraded" : "unavailable",
          detail: `df command failed: ${errorMessage(error)}`,
          durationMs: performance.now() - started,
          sampledAt: now,
        },
      };
    }
    if (!result.success) {
      return {
        disks: this.#diskCache.disks,
        diagnostic: {
          source: "disk",
          status: this.#diskCache.disks.length > 0 ? "degraded" : "unavailable",
          detail: "df command failed",
          durationMs: performance.now() - started,
          sampledAt: now,
        },
      };
    }

    const disks = parseDfDiskRows(COMMAND_OUTPUT_DECODER.decode(result.stdout));

    this.#diskCache = {
      sampledAt: now,
      disks,
    };

    return {
      disks,
      diagnostic: {
        source: "disk",
        status: disks.length > 0 ? "ok" : "unavailable",
        detail: disks.length > 0 ? `sampled ${disks.length} filesystem(s)` : "no disk rows available",
        durationMs: performance.now() - started,
        sampledAt: now,
      },
    };
  }

  async #collectProcessStats(): Promise<ProcessStatsSample> {
    const started = performance.now();
    const entries: number[] = [];
    try {
      for await (const entry of this.#provider.readDir("/proc")) {
        if (entry.isDirectory && /^\d+$/.test(entry.name)) {
          entries.push(Number(entry.name));
          if (entries.length >= this.#processScanLimit) {
            break;
          }
        }
      }
    } catch (error) {
      return {
        stats: [],
        scanned: 0,
        failedReads: 0,
        limited: false,
        durationMs: performance.now() - started,
        scanError: errorMessage(error),
      };
    }

    const stats = await Promise.allSettled(
      entries.map(async (pid) => {
        const stat = await this.#provider.readTextFile(`/proc/${pid}/stat`);
        return { pid, stat };
      }),
    );

    return {
      stats,
      scanned: entries.length,
      failedReads: stats.filter((result) => result.status === "rejected").length,
      limited: entries.length >= this.#processScanLimit,
      durationMs: performance.now() - started,
    };
  }

  #finalizeProcesses(
    sample: ProcessStatsSample,
    totalDelta: number,
    totalMemory: number,
  ) {
    const cpuCount = Math.max(1, this.#provider.hardwareConcurrency());

    const nextProcessCpu = new Map<number, number>();
    const processes: ProcessSnapshot[] = [];

    for (const result of sample.stats) {
      if (result.status !== "fulfilled") {
        continue;
      }

      const parsed = parseProcessStat(result.value.stat, this.#pageSize);
      if (!parsed) {
        continue;
      }

      const previousTime = this.#processCpu.get(result.value.pid) ?? parsed.cpuTime;
      const cpuDelta = Math.max(0, parsed.cpuTime - previousTime);
      nextProcessCpu.set(result.value.pid, parsed.cpuTime);

      const cpuPercent = clamp((cpuDelta / Math.max(1, totalDelta)) * 100 * cpuCount, 0, 999);

      processes.push({
        pid: result.value.pid,
        name: parsed.name,
        state: parsed.state,
        cpuPercent,
        memoryPercent: clamp((parsed.memoryBytes / totalMemory) * 100, 0, 100),
        memoryBytes: parsed.memoryBytes,
        processor: parsed.processor,
      });
    }

    this.#processCpu = nextProcessCpu;

    return processes.sort(processComparator(this.#processSortKey)).slice(0, this.#processLimit);
  }

  #sampleProcesses(
    sample: ProcessStatsSample | undefined,
    totalDelta: number,
    totalMemory: number,
    sampledAt: number,
  ): { processes: ProcessSnapshot[]; diagnostic: SystemMetricDiagnostic } {
    if (!sample) {
      const cached = this.#processCache;
      return {
        processes: cached?.processes ?? [],
        diagnostic: {
          source: "process",
          status: "stale",
          detail: cached
            ? `using cached process rows from ${Math.max(0, sampledAt - cached.sampledAt)}ms ago`
            : "process cache unavailable",
          sampledAt,
        },
      };
    }

    const processes = this.#finalizeProcesses(sample, totalDelta, totalMemory);
    this.#processCache = { sampledAt, processes };
    return {
      processes,
      diagnostic: processDiagnostics(sample, sampledAt),
    };
  }
}

async function runMetricCommand(
  provider: SystemMetricsProvider,
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<SystemMetricsCommandOutput> {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      provider.command(command, args, { timeoutMs }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${command} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function readMetricText(
  provider: SystemMetricsProvider,
  path: string,
  source: string,
  fallback: string,
): Promise<{ text: string; diagnostic?: SystemMetricDiagnostic }> {
  const started = performance.now();
  const sampledAt = provider.now();
  try {
    return { text: await provider.readTextFile(path) };
  } catch (error) {
    return {
      text: fallback,
      diagnostic: {
        source,
        status: "unavailable",
        detail: `${path} unavailable: ${errorMessage(error)}`,
        durationMs: performance.now() - started,
        sampledAt,
      },
    };
  }
}

async function sampleTemperatures(provider: SystemMetricsProvider): Promise<TemperatureSample> {
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

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value!));
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value!));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeHostname(provider: SystemMetricsProvider) {
  try {
    return provider.hostname();
  } catch {
    return "unknown-host";
  }
}

function safeOsRelease(provider: SystemMetricsProvider) {
  try {
    return provider.osRelease();
  } catch {
    return "unknown-os";
  }
}
