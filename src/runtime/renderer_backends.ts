// Copyright 2023 Im-Beast. MIT license.
import {
  detectRuntimeCapabilities,
  type RuntimeCapabilities,
  type RuntimeCapabilityId,
  type RuntimeRendererStrategy,
} from "./capabilities.ts";
import { Signal } from "../signals/mod.ts";

export interface RuntimeRendererBackendDefinition {
  id: string;
  label?: string;
  description?: string;
  strategy: RuntimeRendererStrategy;
  capabilities?: readonly RuntimeCapabilityId[];
  tags?: readonly string[];
  priority?: number;
}

export interface RuntimeRendererBackendInspection {
  id: string;
  label: string;
  description?: string;
  strategy: RuntimeRendererStrategy;
  capabilities: RuntimeCapabilityId[];
  tags: string[];
  priority: number;
  available: boolean;
  missingCapabilities: RuntimeCapabilityId[];
  accelerated: boolean;
}

export interface RuntimeRendererBackendQuery {
  search?: string;
  strategy?: RuntimeRendererStrategy;
  tag?: string;
  available?: boolean;
  accelerated?: boolean;
}

export interface RuntimeRendererBackendCatalogInspection {
  count: number;
  available: number;
  accelerated: number;
  strategies: RuntimeRendererStrategy[];
  capabilities: RuntimeCapabilityId[];
  tags: string[];
}

export interface RuntimeRendererBackendCatalogReport {
  backends: RuntimeRendererBackendInspection[];
  selected?: RuntimeRendererBackendInspection;
  inspection: RuntimeRendererBackendCatalogInspection;
  capabilities: RuntimeCapabilities;
}

export interface RuntimeRendererBackendCatalogOptions {
  backends?: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition>;
  capabilities?: RuntimeCapabilities;
  query?: RuntimeRendererBackendQuery;
  select?: RuntimeRendererBackendSelectionOptions | false;
}

export interface RuntimeRendererBackendMarkdownOptions extends RuntimeRendererBackendCatalogOptions {
  title?: string;
  includeSummary?: boolean;
}

export interface RuntimeRendererBackendSelectionOptions {
  strategy?: RuntimeRendererStrategy;
  tag?: string;
  allowCpuFallback?: boolean;
}

export interface RuntimeRendererBackendControllerOptions {
  registry?: RuntimeRendererBackendRegistry;
  backends?: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition>;
  activeId?: string;
  capabilities?: RuntimeCapabilities | (() => RuntimeCapabilities);
  selection?: RuntimeRendererBackendSelectionOptions;
  onInvalidBackend?: (id: string) => void;
}

export interface RuntimeRendererBackendControllerInspection {
  activeId: string;
  active?: RuntimeRendererBackendInspection;
  backendIds: string[];
  capabilities: RuntimeCapabilities;
  selection: RuntimeRendererBackendSelectionOptions;
  selected?: RuntimeRendererBackendInspection;
}

export const runtimeRendererBackendDefinitions = [
  {
    id: "webgpu-three-ascii",
    label: "WebGPU Three ASCII",
    description: "Accelerated three.js ASCII renderer using the WebGPU post-processing path.",
    strategy: "webgpu",
    capabilities: ["webgpu"],
    tags: ["three", "ascii", "gpu", "visualization"],
    priority: 100,
  },
  {
    id: "webgl-canvas",
    label: "WebGL Canvas",
    description: "Canvas WebGL renderer for graphics fallbacks when WebGPU is unavailable.",
    strategy: "webgl",
    capabilities: ["webgl"],
    tags: ["canvas", "gpu", "fallback"],
    priority: 70,
  },
  {
    id: "terminal-cpu",
    label: "Terminal CPU",
    description: "Portable CPU terminal renderer for headless, SSH, and test environments.",
    strategy: "cpu",
    capabilities: [],
    tags: ["terminal", "portable", "fallback"],
    priority: 10,
  },
] as const satisfies readonly RuntimeRendererBackendDefinition[];

export class RuntimeRendererBackend {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly strategy: RuntimeRendererStrategy;
  readonly capabilities: readonly RuntimeCapabilityId[];
  readonly tags: readonly string[];
  readonly priority: number;

  constructor(definition: RuntimeRendererBackendDefinition) {
    this.id = definition.id;
    this.label = definition.label ?? definition.id;
    this.description = definition.description;
    this.strategy = definition.strategy;
    this.capabilities = [...new Set(definition.capabilities ?? [])].sort();
    this.tags = [...new Set(definition.tags ?? [])].sort();
    this.priority = definition.priority ?? 0;
  }

  inspect(capabilities: RuntimeCapabilities = detectRuntimeCapabilities()): RuntimeRendererBackendInspection {
    const missingCapabilities = this.capabilities.filter((capability) => !capabilities[capability]);
    return {
      id: this.id,
      label: this.label,
      description: this.description,
      strategy: this.strategy,
      capabilities: [...this.capabilities],
      tags: [...this.tags],
      priority: this.priority,
      available: missingCapabilities.length === 0,
      missingCapabilities,
      accelerated: this.strategy !== "cpu" && missingCapabilities.length === 0,
    };
  }
}

export class RuntimeRendererBackendRegistry {
  readonly #backends = new Map<string, RuntimeRendererBackend>();

  constructor(
    backends: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition> = runtimeRendererBackendDefinitions,
  ) {
    for (const backend of backends) {
      this.register(backend);
    }
  }

  register(backend: RuntimeRendererBackend | RuntimeRendererBackendDefinition): this {
    const normalized = backend instanceof RuntimeRendererBackend ? backend : createRuntimeRendererBackend(backend);
    this.#backends.set(normalized.id, normalized);
    return this;
  }

  unregister(id: string): boolean {
    return this.#backends.delete(id);
  }

  has(id: string): boolean {
    return this.#backends.has(id);
  }

  get(id: string): RuntimeRendererBackend | undefined {
    return this.#backends.get(id);
  }

  ids(): string[] {
    return this.backends().map((backend) => backend.id);
  }

  backends(): RuntimeRendererBackend[] {
    return [...this.#backends.values()].sort(compareRendererBackends);
  }

  inspect(capabilities: RuntimeCapabilities = detectRuntimeCapabilities()): RuntimeRendererBackendInspection[] {
    return inspectRuntimeRendererBackends(this.backends(), capabilities);
  }

  select(
    capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
    options: RuntimeRendererBackendSelectionOptions = {},
  ): RuntimeRendererBackendInspection | undefined {
    return selectRuntimeRendererBackend(this.backends(), capabilities, options);
  }

  catalog(
    options: Omit<RuntimeRendererBackendCatalogOptions, "backends"> = {},
  ): RuntimeRendererBackendCatalogReport {
    return createRuntimeRendererBackendCatalogReport({ ...options, backends: this.backends() });
  }
}

export class RuntimeRendererBackendController {
  readonly registry: RuntimeRendererBackendRegistry;
  readonly activeId: Signal<string>;
  readonly selection: RuntimeRendererBackendSelectionOptions;
  readonly #capabilities: RuntimeCapabilities | (() => RuntimeCapabilities);
  readonly #onInvalidBackend?: (id: string) => void;

  constructor(options: RuntimeRendererBackendControllerOptions = {}) {
    this.registry = options.registry ?? createRuntimeRendererBackendRegistry(options.backends);
    this.#capabilities = options.capabilities ?? detectRuntimeCapabilities;
    this.selection = { ...options.selection };
    this.#onInvalidBackend = options.onInvalidBackend;
    const initialId = this.#validId(options.activeId) ?? this.selected()?.id ?? this.registry.ids()[0] ?? "";
    this.activeId = new Signal(initialId);
    this.activeId.subscribe((id) => this.#repairInvalidBackend(id));
  }

  ids(): string[] {
    return this.registry.ids();
  }

  active(capabilities: RuntimeCapabilities = this.capabilities()): RuntimeRendererBackendInspection | undefined {
    return this.registry.get(this.activeId.peek())?.inspect(capabilities);
  }

  selected(capabilities: RuntimeCapabilities = this.capabilities()): RuntimeRendererBackendInspection | undefined {
    return this.registry.select(capabilities, this.selection);
  }

  setBackend(id: string): boolean {
    if (!this.registry.has(id)) {
      this.#onInvalidBackend?.(id);
      return false;
    }
    this.activeId.value = id;
    return true;
  }

  setSelectedBackend(capabilities: RuntimeCapabilities = this.capabilities()): string {
    const selected = this.selected(capabilities);
    if (selected) this.setBackend(selected.id);
    return this.activeId.peek();
  }

  nextBackend(): string {
    return this.cycleBackend(1);
  }

  previousBackend(): string {
    return this.cycleBackend(-1);
  }

  cycleBackend(direction: number): string {
    const ids = this.ids();
    if (ids.length === 0) return "";
    const index = Math.max(0, ids.indexOf(this.activeId.peek()));
    const next = ids[(index + direction + ids.length) % ids.length] ?? ids[0]!;
    this.setBackend(next);
    return this.activeId.peek();
  }

  capabilities(): RuntimeCapabilities {
    return typeof this.#capabilities === "function" ? this.#capabilities() : this.#capabilities;
  }

  catalog(query: RuntimeRendererBackendQuery = {}): RuntimeRendererBackendCatalogReport {
    return this.registry.catalog({ capabilities: this.capabilities(), query, select: this.selection });
  }

  inspect(): RuntimeRendererBackendControllerInspection {
    const capabilities = this.capabilities();
    return {
      activeId: this.activeId.peek(),
      active: this.active(capabilities),
      backendIds: this.ids(),
      capabilities,
      selection: { ...this.selection },
      selected: this.selected(capabilities),
    };
  }

  #validId(id: string | undefined): string | undefined {
    return id && this.registry.has(id) ? id : undefined;
  }

  #repairInvalidBackend(id: string): void {
    if (this.registry.has(id)) return;
    this.#onInvalidBackend?.(id);
    const fallback = this.selected()?.id ?? this.registry.ids()[0] ?? "";
    if (this.activeId.peek() !== fallback) {
      this.activeId.value = fallback;
    }
  }
}

export function createRuntimeRendererBackend(
  definition: RuntimeRendererBackendDefinition,
): RuntimeRendererBackend {
  return new RuntimeRendererBackend(definition);
}

export function createRuntimeRendererBackendRegistry(
  backends: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition> = runtimeRendererBackendDefinitions,
): RuntimeRendererBackendRegistry {
  return new RuntimeRendererBackendRegistry(backends);
}

export function createRuntimeRendererBackendController(
  options: RuntimeRendererBackendControllerOptions = {},
): RuntimeRendererBackendController {
  return new RuntimeRendererBackendController(options);
}

export function runtimeRendererBackends(): RuntimeRendererBackend[] {
  return runtimeRendererBackendDefinitions.map(createRuntimeRendererBackend);
}

export function inspectRuntimeRendererBackends(
  backends: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition>,
  capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
): RuntimeRendererBackendInspection[] {
  return normalizeRendererBackends(backends).map((backend) => backend.inspect(capabilities));
}

export function queryRuntimeRendererBackends(
  backends: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition>,
  query: RuntimeRendererBackendQuery = {},
  capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
): RuntimeRendererBackendInspection[] {
  return inspectRuntimeRendererBackends(backends, capabilities)
    .filter((backend) => matchesRendererBackend(backend, query))
    .sort(compareRendererBackendInspections);
}

export function inspectRuntimeRendererBackendCatalog(
  backends: readonly RuntimeRendererBackendInspection[],
): RuntimeRendererBackendCatalogInspection {
  return {
    count: backends.length,
    available: backends.filter((backend) => backend.available).length,
    accelerated: backends.filter((backend) => backend.accelerated).length,
    strategies: uniqueSorted(backends.map((backend) => backend.strategy)),
    capabilities: uniqueSorted(backends.flatMap((backend) => backend.capabilities)),
    tags: uniqueSorted(backends.flatMap((backend) => backend.tags)),
  };
}

export function selectRuntimeRendererBackend(
  backends: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition>,
  capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
  options: RuntimeRendererBackendSelectionOptions = {},
): RuntimeRendererBackendInspection | undefined {
  const allowCpuFallback = options.allowCpuFallback ?? true;
  const query: RuntimeRendererBackendQuery = {
    available: true,
    strategy: options.strategy,
    tag: options.tag,
  };
  const candidates = queryRuntimeRendererBackends(backends, query, capabilities)
    .filter((backend) => allowCpuFallback || backend.strategy !== "cpu");
  return candidates[0];
}

export function createRuntimeRendererBackendCatalogReport(
  options: RuntimeRendererBackendCatalogOptions = {},
): RuntimeRendererBackendCatalogReport {
  const capabilities = options.capabilities ?? detectRuntimeCapabilities();
  const allBackends = options.backends ?? runtimeRendererBackends();
  const backends = queryRuntimeRendererBackends(allBackends, options.query, capabilities);
  const selected = options.select === false
    ? undefined
    : selectRuntimeRendererBackend(allBackends, capabilities, options.select ?? {});
  return {
    backends,
    selected,
    inspection: inspectRuntimeRendererBackendCatalog(backends),
    capabilities,
  };
}

export function formatRuntimeRendererBackendCatalogMarkdown(
  options: RuntimeRendererBackendMarkdownOptions = {},
): string {
  const report = createRuntimeRendererBackendCatalogReport(options);
  const lines = [`# ${options.title ?? "Runtime Renderer Backends"}`, ""];
  if (options.includeSummary ?? true) {
    lines.push(
      `${report.inspection.count} backends, ${report.inspection.available} available, ${report.inspection.accelerated} accelerated.`,
      "",
    );
    lines.push(`Selected: ${report.selected?.label ?? "none"}.`, "");
  }

  lines.push("| Backend | Strategy | Available | Missing | Tags |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const backend of report.backends) {
    lines.push(
      `| ${escapeMarkdownCell(backend.label)} | ${backend.strategy} | ${backend.available ? "yes" : "no"} | ${
        backend.missingCapabilities.join(", ") || "-"
      } | ${escapeMarkdownCell(backend.tags.join(", ") || "-")} |`,
    );
  }
  return lines.join("\n");
}

function normalizeRendererBackends(
  backends: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition>,
): RuntimeRendererBackend[] {
  return [...backends].map((backend) =>
    backend instanceof RuntimeRendererBackend ? backend : createRuntimeRendererBackend(backend)
  ).sort(compareRendererBackends);
}

function matchesRendererBackend(
  backend: RuntimeRendererBackendInspection,
  query: RuntimeRendererBackendQuery,
): boolean {
  if (query.strategy && backend.strategy !== query.strategy) return false;
  if (query.tag && !backend.tags.includes(query.tag)) return false;
  if (query.available !== undefined && backend.available !== query.available) return false;
  if (query.accelerated !== undefined && backend.accelerated !== query.accelerated) return false;
  if (!query.search) return true;
  const parts = query.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  const haystack = [
    backend.id,
    backend.label,
    backend.description ?? "",
    backend.strategy,
    ...backend.capabilities,
    ...backend.tags,
  ].join(" ").toLowerCase();
  return parts.every((part) => haystack.includes(part));
}

function compareRendererBackends(left: RuntimeRendererBackend, right: RuntimeRendererBackend): number {
  return right.priority - left.priority || left.id.localeCompare(right.id);
}

function compareRendererBackendInspections(
  left: RuntimeRendererBackendInspection,
  right: RuntimeRendererBackendInspection,
): number {
  return right.priority - left.priority || left.id.localeCompare(right.id);
}

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort();
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
