// Copyright 2023 Im-Beast. MIT license.
import {
  detectRuntimeCapabilities,
  type RuntimeCapabilities,
  type RuntimeCapabilityId,
  type RuntimeRendererStrategy,
} from "./capabilities.ts";
import { Signal } from "../signals/mod.ts";

/** Public interface describing a runtime Renderer Backend Definition. */
export interface RuntimeRendererBackendDefinition {
  id: string;
  label?: string;
  description?: string;
  strategy: RuntimeRendererStrategy;
  capabilities?: readonly RuntimeCapabilityId[];
  tags?: readonly string[];
  priority?: number;
}

/** Serializable inspection snapshot for runtime Renderer Backend. */
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

/** Public interface describing a runtime Renderer Backend Query. */
export interface RuntimeRendererBackendQuery {
  search?: string;
  strategy?: RuntimeRendererStrategy;
  tag?: string;
  available?: boolean;
  accelerated?: boolean;
}

/** Serializable inspection snapshot for runtime Renderer Backend Catalog. */
export interface RuntimeRendererBackendCatalogInspection {
  count: number;
  available: number;
  accelerated: number;
  strategies: RuntimeRendererStrategy[];
  capabilities: RuntimeCapabilityId[];
  tags: string[];
}

/** Structured report returned by runtime Renderer Backend Catalog helpers. */
export interface RuntimeRendererBackendCatalogReport {
  backends: RuntimeRendererBackendInspection[];
  selected?: RuntimeRendererBackendInspection;
  inspection: RuntimeRendererBackendCatalogInspection;
  capabilities: RuntimeCapabilities;
}

/** Options for configuring runtime Renderer Backend Catalog. */
export interface RuntimeRendererBackendCatalogOptions {
  backends?: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition>;
  capabilities?: RuntimeCapabilities;
  query?: RuntimeRendererBackendQuery;
  select?: RuntimeRendererBackendSelectionOptions | false;
}

/** Options for configuring runtime Renderer Backend Markdown. */
export interface RuntimeRendererBackendMarkdownOptions extends RuntimeRendererBackendCatalogOptions {
  title?: string;
  includeSummary?: boolean;
}

/** Options for configuring runtime Renderer Backend Selection. */
export interface RuntimeRendererBackendSelectionOptions {
  strategy?: RuntimeRendererStrategy;
  tag?: string;
  allowCpuFallback?: boolean;
}

/** Options for configuring runtime Renderer Backend Controller. */
export interface RuntimeRendererBackendControllerOptions {
  registry?: RuntimeRendererBackendRegistry;
  backends?: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition>;
  activeId?: string;
  capabilities?: RuntimeCapabilities | (() => RuntimeCapabilities);
  selection?: RuntimeRendererBackendSelectionOptions;
  onInvalidBackend?: (id: string) => void;
}

/** Serializable inspection snapshot for runtime Renderer Backend Controller. */
export interface RuntimeRendererBackendControllerInspection {
  activeId: string;
  active?: RuntimeRendererBackendInspection;
  backendIds: string[];
  capabilities: RuntimeCapabilities;
  selection: RuntimeRendererBackendSelectionOptions;
  selected?: RuntimeRendererBackendInspection;
}

/** Public constant for a runtime Renderer Backend Definitions. */
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

/** Public class implementing a runtime Renderer Backend. */
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
    this.capabilities = uniqueSorted(definition.capabilities ?? []);
    this.tags = uniqueSorted(definition.tags ?? []);
    this.priority = definition.priority ?? 0;
  }

  inspect(capabilities: RuntimeCapabilities = detectRuntimeCapabilities()): RuntimeRendererBackendInspection {
    const missingCapabilities: RuntimeCapabilityId[] = [];
    for (const capability of this.capabilities) {
      if (!capabilities[capability]) missingCapabilities.push(capability);
    }
    return {
      id: this.id,
      label: this.label,
      description: this.description,
      strategy: this.strategy,
      capabilities: cloneStringArray(this.capabilities),
      tags: cloneStringArray(this.tags),
      priority: this.priority,
      available: missingCapabilities.length === 0,
      missingCapabilities,
      accelerated: this.strategy !== "cpu" && missingCapabilities.length === 0,
    };
  }
}

/** Registry for storing and querying runtime Renderer Backend definitions. */
export class RuntimeRendererBackendRegistry {
  readonly #backends = new Map<string, RuntimeRendererBackend>();
  #orderedBackends?: RuntimeRendererBackend[];
  #orderedIds?: string[];

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
    this.#orderedBackends = undefined;
    this.#orderedIds = undefined;
    return this;
  }

  unregister(id: string): boolean {
    const deleted = this.#backends.delete(id);
    if (deleted) {
      this.#orderedBackends = undefined;
      this.#orderedIds = undefined;
    }
    return deleted;
  }

  has(id: string): boolean {
    return this.#backends.has(id);
  }

  get(id: string): RuntimeRendererBackend | undefined {
    return this.#backends.get(id);
  }

  ids(): string[] {
    if (!this.#orderedIds) {
      const backends = this.#orderedBackendList();
      const ids = new Array<string>(backends.length);
      for (let index = 0; index < backends.length; index += 1) {
        ids[index] = backends[index]!.id;
      }
      this.#orderedIds = ids;
    }
    return cloneStringArray(this.#orderedIds);
  }

  backends(): RuntimeRendererBackend[] {
    return cloneRendererBackendArray(this.#orderedBackendList());
  }

  inspect(capabilities: RuntimeCapabilities = detectRuntimeCapabilities()): RuntimeRendererBackendInspection[] {
    return inspectRuntimeRendererBackends(this.#orderedBackendList(), capabilities);
  }

  select(
    capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
    options: RuntimeRendererBackendSelectionOptions = {},
  ): RuntimeRendererBackendInspection | undefined {
    return selectRuntimeRendererBackend(this.#orderedBackendList(), capabilities, options);
  }

  catalog(
    options: Omit<RuntimeRendererBackendCatalogOptions, "backends"> = {},
  ): RuntimeRendererBackendCatalogReport {
    return createRuntimeRendererBackendCatalogReport({ ...options, backends: this.#orderedBackendList() });
  }

  #orderedBackendList(): readonly RuntimeRendererBackend[] {
    if (!this.#orderedBackends) {
      const backends: RuntimeRendererBackend[] = [];
      for (const backend of this.#backends.values()) backends.push(backend);
      backends.sort(compareRendererBackends);
      this.#orderedBackends = backends;
    }
    return this.#orderedBackends;
  }
}

/** State controller for runtime Renderer Backend behavior. */
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

/** Creates an runtime Renderer Backend. */
export function createRuntimeRendererBackend(
  definition: RuntimeRendererBackendDefinition,
): RuntimeRendererBackend {
  return new RuntimeRendererBackend(definition);
}

/** Creates an runtime Renderer Backend Registry. */
export function createRuntimeRendererBackendRegistry(
  backends: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition> = runtimeRendererBackendDefinitions,
): RuntimeRendererBackendRegistry {
  return new RuntimeRendererBackendRegistry(backends);
}

/** Creates an runtime Renderer Backend Controller. */
export function createRuntimeRendererBackendController(
  options: RuntimeRendererBackendControllerOptions = {},
): RuntimeRendererBackendController {
  return new RuntimeRendererBackendController(options);
}

/** Public helper for runtime Renderer Backends. */
export function runtimeRendererBackends(): RuntimeRendererBackend[] {
  const backends = new Array<RuntimeRendererBackend>(runtimeRendererBackendDefinitions.length);
  for (let index = 0; index < runtimeRendererBackendDefinitions.length; index += 1) {
    backends[index] = createRuntimeRendererBackend(runtimeRendererBackendDefinitions[index]!);
  }
  return backends;
}

/** Creates a serializable inspection snapshot for runtime Renderer Backends. */
export function inspectRuntimeRendererBackends(
  backends: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition>,
  capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
): RuntimeRendererBackendInspection[] {
  const normalized = normalizeRendererBackends(backends);
  const inspections = new Array<RuntimeRendererBackendInspection>(normalized.length);
  for (let index = 0; index < normalized.length; index += 1) {
    inspections[index] = normalized[index]!.inspect(capabilities);
  }
  return inspections;
}

/** Queries runtime Renderer Backends records with deterministic filtering. */
export function queryRuntimeRendererBackends(
  backends: Iterable<RuntimeRendererBackend | RuntimeRendererBackendDefinition>,
  query: RuntimeRendererBackendQuery = {},
  capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
): RuntimeRendererBackendInspection[] {
  const normalized = normalizeRendererBackends(backends);
  const matches: RuntimeRendererBackendInspection[] = [];
  for (const backend of normalized) {
    const inspection = backend.inspect(capabilities);
    if (matchesRendererBackend(inspection, query)) matches.push(inspection);
  }
  return matches.sort(compareRendererBackendInspections);
}

/** Creates a serializable inspection snapshot for runtime Renderer Backend Catalog. */
export function inspectRuntimeRendererBackendCatalog(
  backends: readonly RuntimeRendererBackendInspection[],
): RuntimeRendererBackendCatalogInspection {
  let available = 0;
  let accelerated = 0;
  const strategies = new Set<RuntimeRendererStrategy>();
  const capabilities = new Set<RuntimeCapabilityId>();
  const tags = new Set<string>();
  for (const backend of backends) {
    if (backend.available) available += 1;
    if (backend.accelerated) accelerated += 1;
    strategies.add(backend.strategy);
    for (const capability of backend.capabilities) capabilities.add(capability);
    for (const tag of backend.tags) tags.add(tag);
  }
  return {
    count: backends.length,
    available,
    accelerated,
    strategies: uniqueSorted(strategies),
    capabilities: uniqueSorted(capabilities),
    tags: uniqueSorted(tags),
  };
}

/** Public helper for select Runtime Renderer Backend. */
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
  const candidates = queryRuntimeRendererBackends(backends, query, capabilities);
  for (const backend of candidates) {
    if (allowCpuFallback || backend.strategy !== "cpu") return backend;
  }
  return undefined;
}

/** Creates an runtime Renderer Backend Catalog Report. */
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

/** Formats runtime Renderer Backend Catalog Markdown for display or diagnostics. */
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
  const normalized: RuntimeRendererBackend[] = [];
  for (const backend of backends) {
    normalized.push(backend instanceof RuntimeRendererBackend ? backend : createRuntimeRendererBackend(backend));
  }
  return normalized.sort(compareRendererBackends);
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
  return rendererBackendMatchesSearch(backend, query.search);
}

function rendererBackendMatchesSearch(backend: RuntimeRendererBackendInspection, search: string): boolean {
  let start = -1;
  const normalized = search.toLowerCase();
  for (let index = 0; index <= normalized.length; index += 1) {
    const char = index < normalized.length ? normalized[index] : " ";
    if (char !== undefined && !isSearchWhitespace(char)) {
      if (start < 0) start = index;
      continue;
    }
    if (start < 0) continue;
    if (!rendererBackendIncludesSearchPart(backend, normalized.slice(start, index))) return false;
    start = -1;
  }
  return true;
}

function isSearchWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\t" || char === "\r" || char === "\f";
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
  const set = new Set<T>();
  for (const value of values) {
    set.add(value);
  }
  const output: T[] = [];
  for (const value of set) {
    output.push(value);
  }
  return output.sort();
}

function cloneStringArray<T extends string>(values: readonly T[]): T[] {
  const output = new Array<T>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    output[index] = values[index]!;
  }
  return output;
}

function cloneRendererBackendArray(values: readonly RuntimeRendererBackend[]): RuntimeRendererBackend[] {
  const output = new Array<RuntimeRendererBackend>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    output[index] = values[index]!;
  }
  return output;
}

function rendererBackendIncludesSearchPart(
  backend: RuntimeRendererBackendInspection,
  part: string,
): boolean {
  if (backend.id.toLowerCase().includes(part)) return true;
  if (backend.label.toLowerCase().includes(part)) return true;
  if ((backend.description ?? "").toLowerCase().includes(part)) return true;
  if (backend.strategy.toLowerCase().includes(part)) return true;
  for (const capability of backend.capabilities) {
    if (capability.toLowerCase().includes(part)) return true;
  }
  for (const tag of backend.tags) {
    if (tag.toLowerCase().includes(part)) return true;
  }
  return false;
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
