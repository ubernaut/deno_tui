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

/** Inspection summary for registered runtime workload sources. */
export interface RuntimeWorkloadRegistryInspection extends RuntimeWorkloadReportInspection {
  sourceIds: string[];
  labels: string[];
  kinds: RuntimeWorkloadKind[];
}

/** Registry for dynamic scheduler and worker-pool telemetry sources. */
export class RuntimeWorkloadRegistry {
  readonly #sources = new Map<string, RuntimeWorkloadSource>();

  constructor(sources: Iterable<RuntimeWorkloadSource> = []) {
    for (const source of sources) {
      this.register(source);
    }
  }

  register(source: RuntimeWorkloadSource): () => void {
    const registered = { ...source };
    this.#sources.set(source.id, registered);
    return () => {
      if (this.#sources.get(source.id) === registered) {
        this.unregister(source.id);
      }
    };
  }

  unregister(id: string): boolean {
    return this.#sources.delete(id);
  }

  has(id: string): boolean {
    return this.#sources.has(id);
  }

  get(id: string): RuntimeWorkloadSource | undefined {
    const source = this.#sources.get(id);
    return source ? { ...source } : undefined;
  }

  sources(): RuntimeWorkloadSource[] {
    const sources = new Array<RuntimeWorkloadSource>(this.#sources.size);
    let index = 0;
    for (const source of this.#sources.values()) {
      sources[index] = { ...source };
      index += 1;
    }
    return sources;
  }

  clear(): void {
    this.#sources.clear();
  }

  report(): RuntimeWorkloadReport {
    return createRuntimeWorkloadReport({ sources: this.sources() });
  }

  inspect(): RuntimeWorkloadRegistryInspection {
    const report = this.report();
    const sourceIds = new Array<string>(report.workloads.length);
    const labels = new Array<string>(report.workloads.length);
    const kindsSet = new Set<RuntimeWorkloadKind>();
    for (let index = 0; index < report.workloads.length; index += 1) {
      const workload = report.workloads[index]!;
      sourceIds[index] = workload.id;
      labels[index] = workload.label;
      kindsSet.add(workload.kind);
    }
    return {
      ...report.inspection,
      sourceIds,
      labels,
      kinds: uniqueSorted(kindsSet),
    };
  }

  markdown(options: Omit<RuntimeWorkloadMarkdownOptions, "sources"> = {}): string {
    return formatRuntimeWorkloadMarkdown({ ...options, sources: this.sources() });
  }
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
  const workloads: RuntimeWorkloadInspection[] = [];
  for (const source of options.sources) workloads.push(inspectRuntimeWorkload(source));
  return {
    workloads,
    inspection: inspectRuntimeWorkloadReport(workloads),
  };
}

/** Aggregates normalized workload statuses. */
export function inspectRuntimeWorkloadReport(
  workloads: readonly RuntimeWorkloadInspection[],
): RuntimeWorkloadReportInspection {
  let running = 0;
  let queued = 0;
  let pending = 0;
  let capacity = 0;
  let saturated = 0;
  let terminated = 0;
  let idle = true;
  let maxSaturation = 0;
  for (const workload of workloads) {
    running += workload.running;
    queued += workload.queued;
    pending += workload.pending;
    capacity += workload.capacity;
    if (workload.state === "saturated" || workload.state === "queued") saturated += 1;
    if (workload.terminated) terminated += 1;
    if (!workload.idle) idle = false;
    maxSaturation = Math.max(maxSaturation, workload.saturation);
  }
  return {
    count: workloads.length,
    running,
    queued,
    pending,
    capacity,
    saturated,
    terminated,
    idle,
    maxSaturation,
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

/** Creates a runtime workload registry from inspectable scheduler and worker-pool sources. */
export function createRuntimeWorkloadRegistry(
  sources: Iterable<RuntimeWorkloadSource> = [],
): RuntimeWorkloadRegistry {
  return new RuntimeWorkloadRegistry(sources);
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

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort();
}
