// Copyright 2023 Im-Beast. MIT license.
import type { AsyncSchedulerInspection } from "./scheduler.ts";
import type { WorkerPoolInspection } from "./worker_pool.ts";

/** Runtime work primitive supported by the shared telemetry helpers. */
export type RuntimeWorkloadKind = "scheduler" | "worker-pool";

/** Normalized lifecycle and backpressure status for a runtime work primitive. */
export type RuntimeWorkloadState = "idle" | "active" | "saturated" | "queued" | "terminated";

/** Source adapter for runtime primitives that expose an inspectable status snapshot. */
export interface RuntimeWorkloadSource {
  id: string;
  label?: string;
  kind?: RuntimeWorkloadKind;
  inspect: () => AsyncSchedulerInspection | WorkerPoolInspection;
}

/** Serializable status for one runtime work primitive. */
export interface RuntimeWorkloadInspection {
  id: string;
  label: string;
  kind: RuntimeWorkloadKind;
  capacity: number;
  running: number;
  queued: number;
  pending: number;
  saturation: number;
  idle: boolean;
  terminated: boolean;
  state: RuntimeWorkloadState;
}

/** Aggregate runtime workload telemetry for settings panes, demos, and CI logs. */
export interface RuntimeWorkloadReport {
  workloads: RuntimeWorkloadInspection[];
  inspection: RuntimeWorkloadReportInspection;
}

/** Aggregate counts and pressure metrics for a runtime workload report. */
export interface RuntimeWorkloadReportInspection {
  count: number;
  running: number;
  queued: number;
  pending: number;
  capacity: number;
  saturated: number;
  terminated: number;
  idle: boolean;
  maxSaturation: number;
}

/** Options for creating a runtime workload report. */
export interface RuntimeWorkloadReportOptions {
  sources: Iterable<RuntimeWorkloadSource>;
}

/** Options for formatting a runtime workload report as Markdown. */
export interface RuntimeWorkloadMarkdownOptions extends RuntimeWorkloadReportOptions {
  title?: string;
}

/** Inspects one scheduler or worker-pool source through a normalized workload shape. */
export function inspectRuntimeWorkload(source: RuntimeWorkloadSource): RuntimeWorkloadInspection {
  const raw = source.inspect();
  const kind = source.kind ?? inferRuntimeWorkloadKind(raw);
  const normalized = normalizeRuntimeWorkload(raw, kind);
  const saturation = normalized.capacity === 0 ? 0 : normalized.pending / normalized.capacity;
  return {
    id: source.id,
    label: source.label ?? source.id,
    kind,
    ...normalized,
    saturation,
    state: runtimeWorkloadState(normalized),
  };
}

/** Creates an aggregate runtime workload report from scheduler and worker-pool sources. */
export function createRuntimeWorkloadReport(options: RuntimeWorkloadReportOptions): RuntimeWorkloadReport {
  const workloads = [...options.sources].map(inspectRuntimeWorkload);
  return {
    workloads,
    inspection: inspectRuntimeWorkloadReport(workloads),
  };
}

/** Aggregates normalized workload statuses. */
export function inspectRuntimeWorkloadReport(
  workloads: readonly RuntimeWorkloadInspection[],
): RuntimeWorkloadReportInspection {
  return {
    count: workloads.length,
    running: workloads.reduce((total, workload) => total + workload.running, 0),
    queued: workloads.reduce((total, workload) => total + workload.queued, 0),
    pending: workloads.reduce((total, workload) => total + workload.pending, 0),
    capacity: workloads.reduce((total, workload) => total + workload.capacity, 0),
    saturated: workloads.filter((workload) => workload.state === "saturated" || workload.state === "queued").length,
    terminated: workloads.filter((workload) => workload.terminated).length,
    idle: workloads.every((workload) => workload.idle),
    maxSaturation: workloads.reduce((max, workload) => Math.max(max, workload.saturation), 0),
  };
}

/** Formats runtime workload telemetry as Markdown. */
export function formatRuntimeWorkloadMarkdown(options: RuntimeWorkloadMarkdownOptions): string {
  const report = createRuntimeWorkloadReport(options);
  const lines = [`# ${options.title ?? "Runtime Workloads"}`, ""];
  lines.push(
    `${report.inspection.count} workloads, ${report.inspection.pending} pending, ${report.inspection.saturated} saturated.`,
    "",
  );
  lines.push("| Workload | Kind | State | Running | Queued | Capacity | Saturation |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: |");
  for (const workload of report.workloads) {
    lines.push(
      `| ${
        escapeMarkdownCell(workload.label)
      } | ${workload.kind} | ${workload.state} | ${workload.running} | ${workload.queued} | ${workload.capacity} | ${
        workload.saturation.toFixed(2)
      } |`,
    );
  }
  return lines.join("\n");
}

function normalizeRuntimeWorkload(
  raw: AsyncSchedulerInspection | WorkerPoolInspection,
  kind: RuntimeWorkloadKind,
): Omit<RuntimeWorkloadInspection, "id" | "label" | "kind" | "saturation" | "state"> {
  if (kind === "scheduler") {
    const scheduler = raw as AsyncSchedulerInspection;
    return {
      capacity: scheduler.concurrency,
      running: scheduler.running,
      queued: scheduler.pending,
      pending: scheduler.running + scheduler.pending,
      idle: scheduler.idle,
      terminated: false,
    };
  }

  const workerPool = raw as WorkerPoolInspection;
  const running = Math.min(workerPool.pending, workerPool.size);
  return {
    capacity: workerPool.size,
    running,
    queued: Math.max(0, workerPool.pending - workerPool.size),
    pending: workerPool.pending,
    idle: workerPool.idle,
    terminated: workerPool.terminated,
  };
}

function runtimeWorkloadState(
  workload: Omit<RuntimeWorkloadInspection, "id" | "label" | "kind" | "saturation" | "state">,
): RuntimeWorkloadState {
  if (workload.terminated) return "terminated";
  if (workload.pending === 0) return "idle";
  if (workload.queued > 0) return "queued";
  if (workload.running >= workload.capacity) return "saturated";
  return "active";
}

function inferRuntimeWorkloadKind(raw: AsyncSchedulerInspection | WorkerPoolInspection): RuntimeWorkloadKind {
  return "concurrency" in raw ? "scheduler" : "worker-pool";
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
