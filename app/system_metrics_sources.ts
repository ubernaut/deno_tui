import type { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import { clamp } from "./styles.ts";
import type {
  CpuCoreSnapshot,
  DiskSnapshot,
  GpuSnapshot,
  NetworkSnapshot,
  SystemMetricDiagnostic,
  TemperatureSnapshot,
} from "./types.ts";

const COMMAND_OUTPUT_DECODER = new TextDecoder();

export interface SystemMetricsDirEntry {
  name: string;
  isDirectory: boolean;
}

export interface SystemMetricsCommandOutput {
  success: boolean;
  stdout: Uint8Array;
}

export interface SystemMetricsCommandOptions {
  timeoutMs?: number;
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
  command(command: string, args: string[], options?: SystemMetricsCommandOptions): Promise<SystemMetricsCommandOutput>;
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

  async command(
    command: string,
    args: string[],
    options: SystemMetricsCommandOptions = {},
  ): Promise<SystemMetricsCommandOutput> {
    const child = new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "null",
    }).spawn();
    let timeout: number | undefined;
    try {
      const output = child.output();
      const result = options.timeoutMs && options.timeoutMs > 0
        ? await Promise.race([
          output,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              try {
                child.kill("SIGKILL");
              } catch {
                // The process may have exited between the timer firing and kill.
              }
              reject(new Error(`${command} timed out after ${options.timeoutMs}ms`));
            }, options.timeoutMs);
          }),
        ])
        : await output;
      return {
        success: result.success,
        stdout: result.stdout,
      };
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
}

interface CpuTimes {
  total: number;
  idle: number;
}

interface CpuStatSample {
  times: CpuTimes[];
  overall: number;
  cores: CpuCoreSnapshot[];
  totalDelta: number;
}

interface TemperatureSample {
  temperatures: TemperatureSnapshot[];
  diagnostic?: SystemMetricDiagnostic;
}

interface NetCounters {
  rxBytes: number;
  txBytes: number;
  sampledAt: number;
}

interface NetworkStatsSample {
  networks: NetworkSnapshot[];
  totalRxRate: number;
  totalTxRate: number;
  counters: Map<string, NetCounters>;
}

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
  commandTimeoutMs?: number;
}

/** Pluggable GPU metrics sampler used by SystemMonitor. */
export interface SystemGpuMetricsProvider {
  sampleGpu(context: SystemGpuMetricsProviderContext): Promise<GpuSample>;
}

/** NVIDIA GPU metrics provider backed by nvidia-smi CSV output. */
export class NvidiaSmiGpuMetricsProvider implements SystemGpuMetricsProvider {
  async sampleGpu(context: SystemGpuMetricsProviderContext): Promise<GpuSample> {
    return await sampleNvidiaSmiGpu(context.provider, context.current, context.diagnostics, context.commandTimeoutMs);
  }
}

export function emptyGpuSnapshot(): GpuSnapshot {
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

export function parseNvidiaSmiGpuRow(row: string): GpuSnapshot | null {
  const parts = row.split(",");
  const name = parts[0]?.trim();
  const utilization = parts[1]?.trim();
  const memoryUsed = parts[2]?.trim();
  const memoryTotal = parts[3]?.trim();
  const temperature = parts[4]?.trim();
  const power = parts[5]?.trim();
  const graphicsClock = parts[6]?.trim();
  const memoryClock = parts[7]?.trim();
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

/** Parses `/proc/net/dev` rows and computes byte rates from previous counters. */
export function sampleNetworkStats(
  text: string,
  interfaces: readonly SystemMetricsNetworkInterface[],
  previousCounters: ReadonlyMap<string, NetCounters>,
  sampledAt: number,
): NetworkStatsSample {
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
  const counters = new Map<string, NetCounters>();

  const networks: NetworkSnapshot[] = [];
  const lines = text.split("\n");
  for (let index = 2; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim();
    const { rxBytes, txBytes } = parseNetworkByteCounters(line.slice(separator + 1));
    const previous = previousCounters.get(name) ?? { rxBytes, txBytes, sampledAt };
    const elapsedSeconds = Math.max(0.001, (sampledAt - previous.sampledAt) / 1000);
    const rxRate = Math.max(0, (rxBytes - previous.rxBytes) / elapsedSeconds);
    const txRate = Math.max(0, (txBytes - previous.txBytes) / elapsedSeconds);
    counters.set(name, { rxBytes, txBytes, sampledAt });
    if (name !== "lo") {
      totalRxRate += rxRate;
      totalTxRate += txRate;
      const addresses = addressMap.get(name) ?? [];
      if (addresses.length > 0 || rxRate > 0 || txRate > 0) {
        networks.push({
          name,
          addresses,
          rxBytes,
          txBytes,
          rxRate,
          txRate,
        });
      }
    }
  }
  networks.sort(compareNetworkSnapshots);
  if (networks.length > 8) networks.length = 8;

  return {
    networks,
    totalRxRate,
    totalTxRate,
    counters,
  };
}

async function sampleNvidiaSmiGpu(
  provider: SystemMetricsProvider,
  current: GpuSnapshot,
  diagnostics?: DiagnosticsCollector,
  commandTimeoutMs = 1_500,
): Promise<GpuSample> {
  const started = performance.now();
  const sampledAt = provider.now();
  try {
    const result = await runTimedMetricCommand(
      provider,
      "nvidia-smi",
      [
        "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,clocks.gr,clocks.mem",
        "--format=csv,noheader,nounits",
      ],
      commandTimeoutMs,
    );
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

    let gpu: GpuSnapshot | undefined;
    for (const row of COMMAND_OUTPUT_DECODER.decode(result.stdout).split("\n")) {
      if (!row.trim()) continue;
      const parsed = parseNvidiaSmiGpuRow(row);
      if (!parsed) continue;
      if (!gpu || parsed.utilizationPercent > gpu.utilizationPercent) gpu = parsed;
    }
    gpu ??= current.available ? current : emptyGpuSnapshot();
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

async function runTimedMetricCommand(
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

function insertDiskSnapshot(disks: DiskSnapshot[], disk: DiskSnapshot, limit: number): void {
  if (disks.length === limit && disk.percent <= (disks[disks.length - 1]?.percent ?? -Infinity)) return;

  let index = 0;
  while (index < disks.length && (disks[index]?.percent ?? -Infinity) >= disk.percent) {
    index += 1;
  }
  disks.splice(index, 0, disk);
  if (disks.length > limit) disks.length = limit;
}

function parseNetworkByteCounters(value: string): { rxBytes: number; txBytes: number } {
  let field = 0;
  let start = -1;
  let rxBytes = 0;
  let txBytes = 0;
  for (let index = 0; index <= value.length; index += 1) {
    const char = index < value.length ? value[index] : " ";
    if (char !== undefined && !isNetworkCounterWhitespace(char)) {
      if (start < 0) start = index;
      continue;
    }
    if (start < 0) continue;
    if (field === 0) {
      rxBytes = Number(value.slice(start, index)) || 0;
    } else if (field === 8) {
      txBytes = Number(value.slice(start, index)) || 0;
      break;
    }
    field += 1;
    start = -1;
  }
  return { rxBytes, txBytes };
}

function isNetworkCounterWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\r" || char === "\n" || char === "\f";
}

function compareNetworkSnapshots(a: NetworkSnapshot, b: NetworkSnapshot): number {
  const aWeight = a.rxRate + a.txRate + (a.addresses.length > 0 ? 10_000_000_000 : 0);
  const bWeight = b.rxRate + b.txRate + (b.addresses.length > 0 ? 10_000_000_000 : 0);
  return bWeight - aWeight;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
