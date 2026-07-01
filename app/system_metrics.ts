import { Signal } from "../src/signals/mod.ts";
import type { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import { clamp } from "./styles.ts";
import type {
  AlertMessage,
  CpuCoreSnapshot,
  DiskSnapshot,
  GpuSnapshot,
  NetworkSnapshot,
  ProcessSnapshot,
  SystemMetricDiagnostic,
  SystemSnapshot,
  TemperatureSnapshot,
} from "./types.ts";

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

/** Result returned by a system GPU metrics provider. */
export interface GpuSample {
  gpu: GpuSnapshot;
  diagnostic?: SystemMetricDiagnostic;
}

/** Context passed to pluggable GPU metrics providers. */
export interface SystemGpuMetricsProviderContext {
  provider: SystemMetricsProvider;
  current: GpuSnapshot;
  diagnostics?: DiagnosticsCollector;
}

/** Pluggable GPU metrics sampler used by SystemMonitor. */
export interface SystemGpuMetricsProvider {
  sampleGpu(context: SystemGpuMetricsProviderContext): Promise<GpuSample>;
}

export type SystemProcessSortKey = "cpu" | "memory" | "pid" | "name";

type ProcessCache = {
  sampledAt: number;
  processes: ProcessSnapshot[];
};

export interface SystemMetricsDirEntry {
  name: string;
  isDirectory: boolean;
}

export interface SystemMetricsCommandOutput {
  success: boolean;
  stdout: Uint8Array;
}

export interface SystemMetricsNetworkInterface {
  name: string;
  address: string;
}

export interface SystemMetricsProvider {
  now(): number;
  hostname(): string;
  osRelease(): string;
  hardwareConcurrency(): number;
  systemMemoryInfo(): Deno.SystemMemoryInfo;
  loadavg(): [number, number, number];
  networkInterfaces(): SystemMetricsNetworkInterface[];
  readTextFile(path: string): Promise<string>;
  readDir(path: string): AsyncIterable<SystemMetricsDirEntry>;
  command(command: string, args: string[]): Promise<SystemMetricsCommandOutput>;
}

export class DenoSystemMetricsProvider implements SystemMetricsProvider {
  now(): number {
    return Date.now();
  }

  hostname(): string {
    return Deno.hostname();
  }

  osRelease(): string {
    return Deno.osRelease();
  }

  hardwareConcurrency(): number {
    return navigator.hardwareConcurrency || 1;
  }

  systemMemoryInfo(): Deno.SystemMemoryInfo {
    return Deno.systemMemoryInfo();
  }

  loadavg(): [number, number, number] {
    const loadavg = Deno.loadavg();
    return [loadavg[0] ?? 0, loadavg[1] ?? 0, loadavg[2] ?? 0];
  }

  networkInterfaces(): SystemMetricsNetworkInterface[] {
    return Deno.networkInterfaces();
  }

  readTextFile(path: string): Promise<string> {
    return Deno.readTextFile(path);
  }

  readDir(path: string): AsyncIterable<SystemMetricsDirEntry> {
    return Deno.readDir(path);
  }

  async command(command: string, args: string[]): Promise<SystemMetricsCommandOutput> {
    const result = await new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "null",
    }).output();
    return {
      success: result.success,
      stdout: result.stdout,
    };
  }
}

/** NVIDIA GPU metrics provider backed by nvidia-smi CSV output. */
export class NvidiaSmiGpuMetricsProvider implements SystemGpuMetricsProvider {
  async sampleGpu(context: SystemGpuMetricsProviderContext): Promise<GpuSample> {
    return await sampleNvidiaSmiGpu(context.provider, context.current, context.diagnostics);
  }
}

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
      result = await this.#provider.command("df", ["-B1P", "-x", "tmpfs", "-x", "devtmpfs", "-x", "squashfs"]);
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

    const output = new TextDecoder().decode(result.stdout);
    const lines = output.split("\n").slice(1).filter(Boolean);

    const disks = lines
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 6)
      .map((parts) => {
        const filesystem = parts[0] ?? "";
        const total = Number(parts[1] ?? 0);
        const used = Number(parts[2] ?? 0);
        const available = Number(parts[3] ?? 0);
        const percent = Number((parts[4] ?? "0").replace("%", ""));
        const mount = parts[5] ?? "/";
        return {
          filesystem,
          mount,
          total,
          used,
          available,
          percent,
        } satisfies DiskSnapshot;
      })
      .filter((entry) => entry.filesystem.startsWith("/dev/") || entry.mount === "/")
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 8);

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

function processComparator(sortKey: SystemProcessSortKey): (left: ProcessSnapshot, right: ProcessSnapshot) => number {
  switch (sortKey) {
    case "memory":
      return (left, right) =>
        right.memoryBytes - left.memoryBytes || right.cpuPercent - left.cpuPercent ||
        left.pid - right.pid;
    case "pid":
      return (left, right) => left.pid - right.pid;
    case "name":
      return (left, right) =>
        left.name.localeCompare(right.name) || right.cpuPercent - left.cpuPercent ||
        left.pid - right.pid;
    case "cpu":
      return (left, right) =>
        right.cpuPercent - left.cpuPercent || right.memoryBytes - left.memoryBytes ||
        left.pid - right.pid;
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

function parseProcessStat(stat: string, pageSize: number) {
  const open = stat.indexOf("(");
  const close = stat.lastIndexOf(")");
  if (open === -1 || close === -1) {
    return null;
  }
  const name = stat.slice(open + 1, close);
  const tail = stat.slice(close + 2).trim().split(/\s+/);
  const state = tail[0] ?? "?";
  const utime = Number(tail[11] ?? 0);
  const stime = Number(tail[12] ?? 0);
  const rssPages = Number(tail[21] ?? 0);
  const processor = Number(tail[36] ?? Number.NaN);
  return {
    name,
    state,
    cpuTime: utime + stime,
    memoryBytes: rssPages * pageSize,
    processor: Number.isFinite(processor) ? processor : undefined,
  };
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

async function sampleNvidiaSmiGpu(
  provider: SystemMetricsProvider,
  current: GpuSnapshot,
  diagnostics?: DiagnosticsCollector,
): Promise<GpuSample> {
  const started = performance.now();
  const sampledAt = provider.now();
  try {
    const result = await provider.command("nvidia-smi", [
      "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,clocks.gr,clocks.mem",
      "--format=csv,noheader,nounits",
    ]);
    if (!result.success) {
      diagnostics?.report({
        source: "system-metrics",
        code: "nvidia-smi-unavailable",
        severity: "info",
        message: "nvidia-smi command failed; GPU metrics are unavailable.",
        context: { retainedPreviousGpu: current.available },
      });
      return {
        gpu: current.available ? current : emptyGpuSnapshot(),
        diagnostic: {
          source: "gpu",
          status: current.available ? "degraded" : "unavailable",
          detail: "nvidia-smi command failed",
          durationMs: performance.now() - started,
          sampledAt,
        },
      };
    }

    const rows = new TextDecoder().decode(result.stdout).trim().split("\n").filter(Boolean);
    const gpus = rows.map(parseNvidiaSmiGpuRow).filter((gpu): gpu is GpuSnapshot => gpu !== null);
    const gpu = gpus.sort((left, right) => right.utilizationPercent - left.utilizationPercent)[0] ??
      (current.available ? current : emptyGpuSnapshot());
    return {
      gpu,
      diagnostic: {
        source: "gpu",
        status: gpu.available ? "ok" : "unavailable",
        detail: gpu.available ? `sampled ${gpu.name}` : "no GPU rows available",
        durationMs: performance.now() - started,
        sampledAt,
      },
    };
  } catch (error) {
    diagnostics?.report({
      source: "system-metrics",
      code: "nvidia-smi-failed",
      severity: "warning",
      message: "nvidia-smi sampling failed; GPU metrics are unavailable.",
      detail: errorMessage(error),
      context: { retainedPreviousGpu: current.available },
    });
    return {
      gpu: current.available ? current : emptyGpuSnapshot(),
      diagnostic: {
        source: "gpu",
        status: current.available ? "degraded" : "unavailable",
        detail: "nvidia-smi sampling failed",
        durationMs: performance.now() - started,
        sampledAt,
      },
    };
  }
}

function parseNvidiaSmiGpuRow(row: string): GpuSnapshot | null {
  const [name, utilization, memoryUsed, memoryTotal, temperature, power, graphicsClock, memoryClock] = row
    .split(",")
    .map((part) => part.trim());
  if (!name) return null;
  const total = parseMetricNumber(memoryTotal);
  const used = parseMetricNumber(memoryUsed);
  const utilizationPercent = clamp(parseMetricNumber(utilization), 0, 100);
  const memoryPercent = total > 0 ? clamp((used / total) * 100, 0, 100) : 0;
  return {
    available: true,
    name,
    utilizationPercent,
    memoryUsed: used * 1024 ** 2,
    memoryTotal: total * 1024 ** 2,
    memoryPercent,
    temperatureCelsius: parseNullableMetricNumber(temperature),
    powerWatts: parseNullableMetricNumber(power),
    graphicsClockMhz: parseNullableMetricNumber(graphicsClock),
    memoryClockMhz: parseNullableMetricNumber(memoryClock),
  };
}

function parseMetricNumber(value: string | undefined): number {
  if (!value || /not supported|n\/a/i.test(value)) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableMetricNumber(value: string | undefined): number | null {
  if (!value || /not supported|n\/a/i.test(value)) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pushHistory(history: number[], value: number, limit: number) {
  const next = history.slice(-Math.max(0, limit - 1));
  next.push(clamp(value, 0, 1));
  while (next.length < limit) {
    next.unshift(0);
  }
  return next;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value!));
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value!));
}

function compactDiagnostics(
  diagnostics: Array<SystemMetricDiagnostic | undefined>,
): SystemMetricDiagnostic[] {
  return diagnostics
    .filter((diagnostic): diagnostic is SystemMetricDiagnostic => diagnostic !== undefined)
    .sort((left, right) => {
      const leftWeight = diagnosticWeight(left.status);
      const rightWeight = diagnosticWeight(right.status);
      return rightWeight - leftWeight || left.source.localeCompare(right.source);
    });
}

function diagnosticWeight(status: SystemMetricDiagnostic["status"]): number {
  switch (status) {
    case "unavailable":
      return 4;
    case "degraded":
      return 3;
    case "limited":
      return 2;
    case "stale":
      return 2;
    case "ok":
      return 1;
  }
}

function processDiagnostics(sample: ProcessStatsSample, sampledAt: number): SystemMetricDiagnostic {
  if (sample.scanError) {
    return {
      source: "process",
      status: "unavailable",
      detail: `/proc scan failed: ${sample.scanError}`,
      durationMs: sample.durationMs,
      sampledAt,
    };
  }
  if (sample.limited) {
    return {
      source: "process",
      status: "limited",
      detail: `process scan capped at ${sample.scanned} entries`,
      durationMs: sample.durationMs,
      sampledAt,
    };
  }
  if (sample.failedReads > 0) {
    return {
      source: "process",
      status: "degraded",
      detail: `${sample.failedReads} process stat read(s) failed`,
      durationMs: sample.durationMs,
      sampledAt,
    };
  }
  return {
    source: "process",
    status: "ok",
    detail: `sampled ${sample.scanned} process entries`,
    durationMs: sample.durationMs,
    sampledAt,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function collectAlerts(input: {
  cpuOverall: number;
  memoryPercent: number;
  swapPercent: number;
  temperatures: TemperatureSnapshot[];
  disks: DiskSnapshot[];
  networks: NetworkSnapshot[];
  gpu: GpuSnapshot;
}) {
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

function emptyGpuSnapshot(): GpuSnapshot {
  return {
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
  };
}

function emptySnapshot(hostname: string, osRelease: string, historyLength: number): SystemSnapshot {
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
