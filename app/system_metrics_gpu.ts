import type { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import { clamp } from "./styles.ts";
import type { SystemMetricsCommandOutput, SystemMetricsProvider } from "./system_metrics_provider.ts";
import type { GpuSnapshot, SystemMetricDiagnostic } from "./types.ts";

const COMMAND_OUTPUT_DECODER = new TextDecoder();

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

async function sampleNvidiaSmiGpu(
  provider: SystemMetricsProvider,
  current: GpuSnapshot,
  diagnostics?: DiagnosticsCollector,
  commandTimeoutMs = 1_500,
): Promise<GpuSample> {
  const started = performance.now();
  const sampledAt = provider.now();
  try {
    const result = await runMetricCommand(
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

    const rows = COMMAND_OUTPUT_DECODER.decode(result.stdout).trim().split("\n").filter(Boolean);
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
