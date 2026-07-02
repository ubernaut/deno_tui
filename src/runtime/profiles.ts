// Copyright 2023 Im-Beast. MIT license.
import {
  createRuntimePlan,
  detectRuntimeCapabilities,
  type RuntimeCapabilities,
  type RuntimePlan,
  type RuntimePlanOptions,
  type RuntimeRendererStrategy,
  type RuntimeStorageStrategy,
  type RuntimeWorkerStrategy,
} from "./capabilities.ts";
import { Signal } from "../signals/mod.ts";

/** Public interface describing a runtime Profile Definition. */
export interface RuntimeProfileDefinition {
  id: string;
  label?: string;
  description?: string;
  options?: RuntimePlanOptions;
  tags?: readonly string[];
  priority?: number;
}

/** Serializable inspection snapshot for runtime Profile. */
export interface RuntimeProfileInspection {
  id: string;
  label: string;
  description?: string;
  options: RuntimePlanOptions;
  tags: string[];
  priority: number;
}

/** Serializable inspection snapshot for runtime Profile Plan. */
export interface RuntimeProfilePlanInspection extends RuntimeProfileInspection {
  plan: RuntimePlan;
  strategies: {
    workers: RuntimeWorkerStrategy;
    storage: RuntimeStorageStrategy;
    renderer: RuntimeRendererStrategy;
  };
  accelerated: {
    workers: boolean;
    storage: boolean;
    renderer: boolean;
  };
}

/** Public interface describing a runtime Profile Catalog Query. */
export interface RuntimeProfileCatalogQuery {
  search?: string;
  tag?: string;
  workerStrategy?: RuntimeWorkerStrategy;
  storageStrategy?: RuntimeStorageStrategy;
  rendererStrategy?: RuntimeRendererStrategy;
  accelerated?: boolean;
}

/** Serializable inspection snapshot for runtime Profile Catalog. */
export interface RuntimeProfileCatalogInspection {
  count: number;
  accelerated: number;
  workerStrategies: RuntimeWorkerStrategy[];
  storageStrategies: RuntimeStorageStrategy[];
  rendererStrategies: RuntimeRendererStrategy[];
  tags: string[];
}

/** Structured report returned by runtime Profile Catalog helpers. */
export interface RuntimeProfileCatalogReport {
  profiles: RuntimeProfilePlanInspection[];
  inspection: RuntimeProfileCatalogInspection;
  capabilities: RuntimeCapabilities;
}

/** Options for configuring runtime Profile Catalog Report. */
export interface RuntimeProfileCatalogReportOptions {
  profiles?: Iterable<RuntimeProfile | RuntimeProfileDefinition>;
  capabilities?: RuntimeCapabilities;
  query?: RuntimeProfileCatalogQuery;
}

/** Options for configuring runtime Profile Catalog Markdown. */
export interface RuntimeProfileCatalogMarkdownOptions extends RuntimeProfileCatalogReportOptions {
  title?: string;
  includeSummary?: boolean;
}

/** Options for configuring runtime Profile Controller. */
export interface RuntimeProfileControllerOptions {
  registry?: RuntimeProfileRegistry;
  profiles?: Iterable<RuntimeProfile | RuntimeProfileDefinition>;
  activeId?: string;
  capabilities?: RuntimeCapabilities | (() => RuntimeCapabilities);
  onInvalidProfile?: (id: string) => void;
}

/** Serializable inspection snapshot for runtime Profile Controller. */
export interface RuntimeProfileControllerInspection {
  activeId: string;
  active?: RuntimeProfileInspection;
  profileIds: string[];
  capabilities: RuntimeCapabilities;
  plan?: RuntimePlan;
}

/** Public constant for a runtime Profile Definitions. */
export const runtimeProfileDefinitions = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Use workers, persistent storage, and GPU rendering when available.",
    tags: ["default", "adaptive"],
    priority: 100,
  },
  {
    id: "throughput",
    label: "Throughput",
    description: "Prefer every available acceleration path for busy dashboards and visualizations.",
    tags: ["performance", "visualization"],
    priority: 90,
    options: {
      preferWorkers: true,
      preferPersistentStorage: true,
      preferGpuRenderer: true,
      allowWebGlFallback: true,
    },
  },
  {
    id: "portable",
    label: "Portable",
    description: "Avoid workers and GPU rendering while still using persistent storage when available.",
    tags: ["fallback", "portable"],
    priority: 40,
    options: {
      preferWorkers: false,
      preferPersistentStorage: true,
      preferGpuRenderer: false,
    },
  },
  {
    id: "ephemeral",
    label: "Ephemeral",
    description: "Avoid persistent storage for demos, tests, and disposable sessions.",
    tags: ["memory", "testing"],
    priority: 30,
    options: {
      preferWorkers: true,
      preferPersistentStorage: false,
      preferGpuRenderer: true,
      allowWebGlFallback: true,
    },
  },
] as const satisfies readonly RuntimeProfileDefinition[];

/** Named runtime policy that turns capabilities into a concrete strategy plan. */
export class RuntimeProfile {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly options: RuntimePlanOptions;
  readonly tags: readonly string[];
  readonly priority: number;

  constructor(definition: RuntimeProfileDefinition) {
    this.id = definition.id;
    this.label = definition.label ?? definition.id;
    this.description = definition.description;
    this.options = { ...definition.options };
    this.tags = uniqueSorted(definition.tags ?? []);
    this.priority = definition.priority ?? 0;
  }

  inspect(): RuntimeProfileInspection {
    return {
      id: this.id,
      label: this.label,
      description: this.description,
      options: { ...this.options },
      tags: cloneStringArray(this.tags),
      priority: this.priority,
    };
  }

  plan(capabilities: RuntimeCapabilities = detectRuntimeCapabilities()): RuntimePlan {
    return createRuntimePlan(capabilities, this.options);
  }

  inspectPlan(capabilities: RuntimeCapabilities = detectRuntimeCapabilities()): RuntimeProfilePlanInspection {
    const plan = this.plan(capabilities);
    return {
      ...this.inspect(),
      plan,
      strategies: {
        workers: plan.workers.strategy,
        storage: plan.storage.strategy,
        renderer: plan.renderer.strategy,
      },
      accelerated: {
        workers: plan.workers.accelerated,
        storage: plan.storage.accelerated,
        renderer: plan.renderer.accelerated,
      },
    };
  }
}

/** Ordered registry of runtime policy profiles for settings panes and launchers. */
export class RuntimeProfileRegistry {
  readonly #profiles = new Map<string, RuntimeProfile>();

  constructor(profiles: Iterable<RuntimeProfile | RuntimeProfileDefinition> = runtimeProfileDefinitions) {
    for (const profile of profiles) {
      this.register(profile);
    }
  }

  register(profile: RuntimeProfile | RuntimeProfileDefinition): this {
    const normalized = profile instanceof RuntimeProfile ? profile : createRuntimeProfile(profile);
    this.#profiles.set(normalized.id, normalized);
    return this;
  }

  unregister(id: string): boolean {
    return this.#profiles.delete(id);
  }

  has(id: string): boolean {
    return this.#profiles.has(id);
  }

  get(id: string): RuntimeProfile | undefined {
    return this.#profiles.get(id);
  }

  ids(): string[] {
    const profiles = this.profiles();
    const ids = new Array<string>(profiles.length);
    for (let index = 0; index < profiles.length; index += 1) {
      ids[index] = profiles[index]!.id;
    }
    return ids;
  }

  profiles(): RuntimeProfile[] {
    const profiles: RuntimeProfile[] = [];
    for (const profile of this.#profiles.values()) {
      profiles.push(profile);
    }
    return profiles.sort(compareRuntimeProfiles);
  }

  inspect(): RuntimeProfileInspection[] {
    const profiles = this.profiles();
    const inspections = new Array<RuntimeProfileInspection>(profiles.length);
    for (let index = 0; index < profiles.length; index += 1) {
      inspections[index] = profiles[index]!.inspect();
    }
    return inspections;
  }

  plan(id: string, capabilities: RuntimeCapabilities = detectRuntimeCapabilities()): RuntimePlan {
    const profile = this.get(id);
    if (!profile) throw new RuntimeProfileNotFoundError(id);
    return profile.plan(capabilities);
  }

  catalog(options: Omit<RuntimeProfileCatalogReportOptions, "profiles"> = {}): RuntimeProfileCatalogReport {
    return createRuntimeProfileCatalogReport({ ...options, profiles: this.profiles() });
  }
}

/** State holder for selected runtime profile policy and derived runtime plans. */
export class RuntimeProfileController {
  readonly registry: RuntimeProfileRegistry;
  readonly activeId: Signal<string>;
  readonly #capabilities: RuntimeCapabilities | (() => RuntimeCapabilities);
  readonly #onInvalidProfile?: (id: string) => void;

  constructor(options: RuntimeProfileControllerOptions = {}) {
    this.registry = options.registry ?? createRuntimeProfileRegistry(options.profiles);
    this.#capabilities = options.capabilities ?? detectRuntimeCapabilities;
    this.#onInvalidProfile = options.onInvalidProfile;
    const initialId = this.#validId(options.activeId) ?? this.registry.ids()[0] ?? "";
    this.activeId = new Signal(initialId);
    this.activeId.subscribe((id) => this.#repairInvalidProfile(id));
  }

  ids(): string[] {
    return this.registry.ids();
  }

  active(): RuntimeProfile | undefined {
    return this.registry.get(this.activeId.peek());
  }

  setProfile(id: string): boolean {
    if (!this.registry.has(id)) {
      this.#onInvalidProfile?.(id);
      return false;
    }
    this.activeId.value = id;
    return true;
  }

  nextProfile(): string {
    return this.cycleProfile(1);
  }

  previousProfile(): string {
    return this.cycleProfile(-1);
  }

  cycleProfile(direction: number): string {
    const ids = this.ids();
    if (ids.length === 0) return "";
    const index = ids.indexOf(this.activeId.peek());
    const next = ids[(index + direction + ids.length) % ids.length] ?? ids[0]!;
    this.setProfile(next);
    return this.activeId.peek();
  }

  plan(capabilities: RuntimeCapabilities = this.capabilities()): RuntimePlan | undefined {
    const profile = this.active();
    return profile?.plan(capabilities);
  }

  capabilities(): RuntimeCapabilities {
    return typeof this.#capabilities === "function" ? this.#capabilities() : this.#capabilities;
  }

  catalog(query: RuntimeProfileCatalogQuery = {}): RuntimeProfileCatalogReport {
    return this.registry.catalog({ capabilities: this.capabilities(), query });
  }

  inspect(): RuntimeProfileControllerInspection {
    const capabilities = this.capabilities();
    const active = this.active();
    return {
      activeId: this.activeId.peek(),
      active: active?.inspect(),
      profileIds: this.ids(),
      capabilities,
      plan: active?.plan(capabilities),
    };
  }

  #validId(id: string | undefined): string | undefined {
    return id && this.registry.has(id) ? id : undefined;
  }

  #repairInvalidProfile(id: string): void {
    if (this.registry.has(id)) return;
    this.#onInvalidProfile?.(id);
    const fallback = this.registry.ids()[0] ?? "";
    if (this.activeId.peek() !== fallback) {
      this.activeId.value = fallback;
    }
  }
}

/** Error thrown for invalid runtime Profile Not Found operations. */
export class RuntimeProfileNotFoundError extends Error {
  constructor(id: string) {
    super(`Runtime profile "${id}" is not registered`);
    this.name = "RuntimeProfileNotFoundError";
  }
}

/** Creates an runtime Profile. */
export function createRuntimeProfile(definition: RuntimeProfileDefinition): RuntimeProfile {
  return new RuntimeProfile(definition);
}

/** Creates an runtime Profile Registry. */
export function createRuntimeProfileRegistry(
  profiles: Iterable<RuntimeProfile | RuntimeProfileDefinition> = runtimeProfileDefinitions,
): RuntimeProfileRegistry {
  return new RuntimeProfileRegistry(profiles);
}

/** Creates an runtime Profile Controller. */
export function createRuntimeProfileController(
  options: RuntimeProfileControllerOptions = {},
): RuntimeProfileController {
  return new RuntimeProfileController(options);
}

/** Public helper for runtime Profiles. */
export function runtimeProfiles(): RuntimeProfile[] {
  const profiles = new Array<RuntimeProfile>(runtimeProfileDefinitions.length);
  for (let index = 0; index < runtimeProfileDefinitions.length; index += 1) {
    profiles[index] = createRuntimeProfile(runtimeProfileDefinitions[index]!);
  }
  return profiles;
}

/** Finds a matching runtime Profile record when one exists. */
export function findRuntimeProfile(idOrLabel: string): RuntimeProfile | undefined {
  const normalized = normalizeProfileLookup(idOrLabel);
  for (const definition of runtimeProfileDefinitions) {
    const profile = createRuntimeProfile(definition);
    if (normalizeProfileLookup(profile.id) === normalized || normalizeProfileLookup(profile.label) === normalized) {
      return profile;
    }
  }
  return undefined;
}

/** Queries runtime Profiles records with deterministic filtering. */
export function queryRuntimeProfiles(
  profiles: Iterable<RuntimeProfile | RuntimeProfileDefinition> = runtimeProfileDefinitions,
  query: RuntimeProfileCatalogQuery = {},
  capabilities: RuntimeCapabilities = detectRuntimeCapabilities(),
): RuntimeProfilePlanInspection[] {
  const matches: RuntimeProfilePlanInspection[] = [];
  for (const profile of normalizeProfiles(profiles)) {
    const inspection = profile.inspectPlan(capabilities);
    if (matchesRuntimeProfileQuery(inspection, query)) matches.push(inspection);
  }
  return matches.sort(compareRuntimeProfilePlans);
}

/** Creates a serializable inspection snapshot for runtime Profile Catalog. */
export function inspectRuntimeProfileCatalog(
  profiles: readonly RuntimeProfilePlanInspection[],
): RuntimeProfileCatalogInspection {
  let accelerated = 0;
  const workerStrategies = new Set<RuntimeWorkerStrategy>();
  const storageStrategies = new Set<RuntimeStorageStrategy>();
  const rendererStrategies = new Set<RuntimeRendererStrategy>();
  const tags = new Set<string>();
  for (const profile of profiles) {
    if (profile.accelerated.workers || profile.accelerated.storage || profile.accelerated.renderer) {
      accelerated += 1;
    }
    workerStrategies.add(profile.strategies.workers);
    storageStrategies.add(profile.strategies.storage);
    rendererStrategies.add(profile.strategies.renderer);
    for (const tag of profile.tags) tags.add(tag);
  }
  return {
    count: profiles.length,
    accelerated,
    workerStrategies: uniqueSorted(workerStrategies),
    storageStrategies: uniqueSorted(storageStrategies),
    rendererStrategies: uniqueSorted(rendererStrategies),
    tags: uniqueSorted(tags),
  };
}

/** Creates an runtime Profile Catalog Report. */
export function createRuntimeProfileCatalogReport(
  options: RuntimeProfileCatalogReportOptions = {},
): RuntimeProfileCatalogReport {
  const capabilities = options.capabilities ?? detectRuntimeCapabilities();
  const profiles = queryRuntimeProfiles(options.profiles ?? runtimeProfileDefinitions, options.query, capabilities);
  return {
    profiles,
    inspection: inspectRuntimeProfileCatalog(profiles),
    capabilities,
  };
}

/** Formats runtime Profile Catalog Markdown for display or diagnostics. */
export function formatRuntimeProfileCatalogMarkdown(options: RuntimeProfileCatalogMarkdownOptions = {}): string {
  const report = createRuntimeProfileCatalogReport(options);
  const lines = [`# ${options.title ?? "Runtime Profiles"}`, ""];
  if (options.includeSummary ?? true) {
    lines.push(
      `${report.inspection.count} profiles, ${report.inspection.accelerated} with at least one accelerated strategy.`,
      "",
    );
  }
  lines.push("| Profile | Workers | Storage | Renderer | Tags |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const profile of report.profiles) {
    lines.push(
      `| ${profile.label} | ${profile.strategies.workers} | ${profile.strategies.storage} | ${profile.strategies.renderer} | ${
        profile.tags.join(", ") || "-"
      } |`,
    );
  }
  return lines.join("\n");
}

function normalizeProfiles(
  profiles: Iterable<RuntimeProfile | RuntimeProfileDefinition>,
): RuntimeProfile[] {
  const normalized: RuntimeProfile[] = [];
  for (const profile of profiles) {
    normalized.push(profile instanceof RuntimeProfile ? profile : createRuntimeProfile(profile));
  }
  return normalized;
}

function matchesRuntimeProfileQuery(
  profile: RuntimeProfilePlanInspection,
  query: RuntimeProfileCatalogQuery,
): boolean {
  if (query.tag && !profile.tags.includes(query.tag)) return false;
  if (query.workerStrategy && profile.strategies.workers !== query.workerStrategy) return false;
  if (query.storageStrategy && profile.strategies.storage !== query.storageStrategy) return false;
  if (query.rendererStrategy && profile.strategies.renderer !== query.rendererStrategy) return false;
  if (
    query.accelerated !== undefined &&
    (profile.accelerated.workers || profile.accelerated.storage || profile.accelerated.renderer) !== query.accelerated
  ) return false;
  if (!query.search) return true;
  const needle = normalizeProfileLookup(query.search);
  if (!needle) return true;
  if (profileSearchValueIncludes(profile.id, needle)) return true;
  if (profileSearchValueIncludes(profile.label, needle)) return true;
  if (profile.description && profileSearchValueIncludes(profile.description, needle)) return true;
  for (const tag of profile.tags) {
    if (profileSearchValueIncludes(tag, needle)) return true;
  }
  if (profileSearchValueIncludes(profile.strategies.workers, needle)) return true;
  if (profileSearchValueIncludes(profile.strategies.storage, needle)) return true;
  return profileSearchValueIncludes(profile.strategies.renderer, needle);
}

function normalizeProfileLookup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
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

function compareRuntimeProfiles(left: RuntimeProfile, right: RuntimeProfile): number {
  return right.priority - left.priority || left.id.localeCompare(right.id);
}

function compareRuntimeProfilePlans(left: RuntimeProfilePlanInspection, right: RuntimeProfilePlanInspection): number {
  return right.priority - left.priority || left.label.localeCompare(right.label);
}

function cloneStringArray<T extends string>(values: readonly T[]): T[] {
  const output = new Array<T>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    output[index] = values[index]!;
  }
  return output;
}

function profileSearchValueIncludes(value: string, needle: string): boolean {
  return normalizeProfileLookup(value).includes(needle);
}
