// Copyright 2023 Im-Beast. MIT license.
import type {
  PluginSlotPlugin,
  PluginSlotRegistry,
  PluginSlotRegistryInspection,
  PluginSlotRenderer,
  PluginSlotRenderers,
} from "./plugin_slots.ts";

/** Clone-safe scalar/collection values permitted in adapter-owned source context. */
export type PluginSlotDataValue =
  | null
  | boolean
  | number
  | string
  | readonly PluginSlotDataValue[]
  | { readonly [key: string]: PluginSlotDataValue };

/** Data-only source categories supported without transferring layout ownership. */
export type PluginSlotSourceKind = "core" | "markup" | "view";

/** Clone-safe context supplied to sources instead of the host registry context. */
export interface PluginSlotSourceContext<TValues extends Readonly<Record<string, PluginSlotDataValue>>> {
  readonly sourceId: string;
  readonly sourceKind: PluginSlotSourceKind;
  readonly registrationId?: string;
  readonly values: TValues;
}

/** Payload callback for one typed source slot. */
export type PluginSlotSourceRenderer<
  TPayload,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
  TProps,
> = (
  context: PluginSlotSourceContext<TValues>,
  props: TProps,
) => TPayload | null | undefined;

/** Typed source callbacks before framework/markup adaptation. */
export type PluginSlotSourceRenderers<
  TPayload,
  TSlots extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
> = {
  [TName in keyof TSlots]?: PluginSlotSourceRenderer<TPayload, TValues, TSlots[TName]>;
};

/** One independently ordered registration contributed by a source. */
export interface PluginSlotSourceRegistration<
  TPayload,
  TSlots extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
> {
  id: string;
  order?: number;
  slots: PluginSlotSourceRenderers<TPayload, TSlots, TValues>;
  setup?: (context: PluginSlotSourceContext<TValues>) => void | (() => void);
  dispose?: () => void;
}

/** Shared lifecycle and provenance contract for all source categories. */
export interface PluginSlotSourceBase<
  TPayload,
  TSlots extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
  TKind extends PluginSlotSourceKind,
> {
  id: string;
  kind: TKind;
  order?: number;
  registrations: readonly PluginSlotSourceRegistration<TPayload, TSlots, TValues>[];
  setup?: (context: PluginSlotSourceContext<TValues>) => void | (() => void);
  dispose?: () => void;
}

/** Source whose callbacks already return host core node/value objects. */
export type CorePluginSlotSource<
  TNode,
  TSlots extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
> = PluginSlotSourceBase<TNode, TSlots, TValues, "core">;

/** Source whose callbacks return declarative markup values for a host adapter. */
export type MarkupPluginSlotSource<
  TMarkup,
  TSlots extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
> = PluginSlotSourceBase<TMarkup, TSlots, TValues, "markup">;

/** Optional source whose callbacks return view/JSX-style values for a host adapter. */
export type ViewPluginSlotSource<
  TView,
  TSlots extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
> = PluginSlotSourceBase<TView, TSlots, TValues, "view">;

/** Union accepted by PluginSlotSourceAdapter.install. */
export type PluginSlotSource<
  TNode,
  TMarkup,
  TView,
  TSlots extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
> =
  | CorePluginSlotSource<TNode, TSlots, TValues>
  | MarkupPluginSlotSource<TMarkup, TSlots, TValues>
  | ViewPluginSlotSource<TView, TSlots, TValues>;

/** Host-owned payload conversion that receives no layout/controller capability. */
export interface PluginSlotPayloadAdapter<
  TNode,
  TPayload,
  TSlots extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
> {
  <TName extends Extract<keyof TSlots, string>>(
    payload: TPayload,
    context: PluginSlotSourceContext<TValues>,
    slot: TName,
    props: TSlots[TName],
  ): TNode | null | undefined;
}

/** Data source used for each setup/render callback. */
export type PluginSlotSourceValues<TValues extends Readonly<Record<string, PluginSlotDataValue>>> =
  | TValues
  | (() => TValues);

/** Configuration for adapting sources into one injected host-owned registry. */
export interface PluginSlotSourceAdapterOptions<
  TNode,
  TMarkup,
  TView,
  TSlots extends object,
  THostContext extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
> {
  registry: PluginSlotRegistry<TNode, TSlots, THostContext>;
  values: PluginSlotSourceValues<TValues>;
  markup?: PluginSlotPayloadAdapter<TNode, TMarkup, TSlots, TValues>;
  view?: PluginSlotPayloadAdapter<TNode, TView, TSlots, TValues>;
  idPrefix?: string;
  maxDiagnostics?: number;
}

/** Clone-safe installed registration provenance. */
export interface PluginSlotSourceRegistrationInspection {
  id: string;
  pluginId: string;
  order: number;
  slots: string[];
}

/** Clone-safe installed source provenance. */
export interface PluginSlotSourceInspection {
  id: string;
  kind: PluginSlotSourceKind;
  order: number;
  sequence: number;
  registrations: PluginSlotSourceRegistrationInspection[];
}

/** Adapter-owned lifecycle diagnostic; renderer diagnostics remain in the registry. */
export interface PluginSlotSourceDiagnostic {
  sequence: number;
  sourceId: string;
  registrationId?: string;
  pluginId: string;
  phase: "registration" | "setup" | "dispose";
  message: string;
}

/** Clone-safe adapter state including host registry diagnostics. */
export interface PluginSlotSourceAdapterInspection {
  disposed: boolean;
  revision: number;
  idPrefix: string;
  sourceCount: number;
  sources: PluginSlotSourceInspection[];
  diagnosticCount: number;
  diagnostics: PluginSlotSourceDiagnostic[];
  registry: PluginSlotRegistryInspection;
}

interface PreparedRegistration<
  TPayload,
  TSlots extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
> {
  definition: PluginSlotSourceRegistration<TPayload, TSlots, TValues>;
  id: string;
  pluginId: string;
  order: number;
  declarationSequence: number;
  setupDisposer?: () => void;
  dispose?: () => void;
}

interface InstalledSource {
  id: string;
  kind: PluginSlotSourceKind;
  order: number;
  sequence: number;
  registrations: PluginSlotSourceRegistrationInspection[];
  pluginDisposers: Array<() => void>;
  setupDisposer?: () => void;
  dispose?: () => void;
}

/**
 * Installs data/value sources into a host-owned PluginSlotRegistry.
 *
 * The registry retains ordering, fallback, render policy, and node layout
 * authority. Source callbacks never receive its host context; they receive only
 * structured-cloned values and provenance.
 */
export class PluginSlotSourceAdapter<
  TNode,
  TMarkup,
  TView,
  TSlots extends object,
  THostContext extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
> {
  readonly registry: PluginSlotRegistry<TNode, TSlots, THostContext>;
  readonly #values: PluginSlotSourceValues<TValues>;
  readonly #markup?: PluginSlotPayloadAdapter<TNode, TMarkup, TSlots, TValues>;
  readonly #view?: PluginSlotPayloadAdapter<TNode, TView, TSlots, TValues>;
  readonly #idPrefix: string;
  readonly #maxDiagnostics: number;
  readonly #sources = new Map<string, InstalledSource>();
  readonly #diagnostics: PluginSlotSourceDiagnostic[] = [];
  #sourceSequence = 0;
  #diagnosticSequence = 0;
  #revision = 0;
  #disposed = false;

  constructor(
    options: PluginSlotSourceAdapterOptions<TNode, TMarkup, TView, TSlots, THostContext, TValues>,
  ) {
    this.registry = options.registry;
    this.#values = options.values;
    this.#markup = options.markup;
    this.#view = options.view;
    this.#idPrefix = normalizedId(options.idPrefix, "slot-source");
    this.#maxDiagnostics = Math.max(0, Math.floor(options.maxDiagnostics ?? 100));
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get revision(): number {
    return this.#revision;
  }

  has(sourceId: string): boolean {
    return this.#sources.has(sourceId.trim());
  }

  sourceIds(): string[] {
    return this.#orderedSources().map((source) => source.id);
  }

  /**
   * Atomically installs all registrations from one source. Setup is completed
   * before the first registry mutation; any later rejection rolls final state
   * back and disposes acquired resources in reverse order.
   */
  install(
    source: PluginSlotSource<TNode, TMarkup, TView, TSlots, TValues>,
  ): () => void {
    const sourceId = source.id.trim();
    const sourcePluginId = this.#sourcePluginId(sourceId || "anonymous");
    if (this.#disposed || this.registry.disposed) {
      this.#report(sourceId || "<anonymous>", sourcePluginId, "registration", "slot source adapter is disposed");
      return noop;
    }
    if (!sourceId) {
      this.#report("<anonymous>", sourcePluginId, "registration", "source id must not be empty");
      return noop;
    }
    if (this.#sources.has(sourceId)) {
      this.#report(sourceId, sourcePluginId, "registration", `source ${sourceId} is already installed`);
      return noop;
    }
    if (source.kind === "markup" && !this.#markup) {
      this.#report(sourceId, sourcePluginId, "registration", "markup source adapter is not configured");
      return noop;
    }
    if (source.kind === "view" && !this.#view) {
      this.#report(sourceId, sourcePluginId, "registration", "view source adapter is not configured");
      return noop;
    }

    const prepared = this.#prepareRegistrations(sourceId, source);
    if (!prepared) return noop;
    if (this.#hasRegistrationCollision(sourceId, prepared)) return noop;
    const sourceOrder = finiteOrder(source.order);
    const sourceDispose = once(source.dispose);
    let sourceSetupDisposer: (() => void) | undefined;
    try {
      sourceSetupDisposer = once(source.setup?.(this.#context(sourceId, source.kind)) || undefined);
    } catch (error) {
      this.#report(sourceId, sourcePluginId, "setup", error);
      this.#safeDispose(sourceId, sourcePluginId, sourceDispose);
      return noop;
    }

    let setupCount = 0;
    for (const registration of prepared) {
      setupCount += 1;
      try {
        registration.setupDisposer = once(
          registration.definition.setup?.(
            this.#context(sourceId, source.kind, registration.id),
          ) || undefined,
        );
      } catch (error) {
        this.#report(sourceId, registration.pluginId, "setup", error, registration.id);
        this.#disposePrepared(sourceId, prepared, setupCount, sourceSetupDisposer, sourceDispose);
        return noop;
      }
    }

    if (this.#hasRegistrationCollision(sourceId, prepared)) {
      this.#disposePrepared(sourceId, prepared, prepared.length, sourceSetupDisposer, sourceDispose);
      return noop;
    }

    const pluginDisposers: Array<() => void> = [];
    for (let index = 0; index < prepared.length; index += 1) {
      const registration = prepared[index]!;
      let activated = false;
      const plugin = this.#pluginDefinition(sourceId, source, registration, () => {
        activated = true;
      });
      const dispose = this.registry.register(plugin);
      if (!activated || !this.registry.has(registration.pluginId)) {
        this.#report(
          sourceId,
          registration.pluginId,
          "registration",
          `registry rejected plugin ${registration.pluginId}`,
          registration.id,
        );
        this.#rollbackRegistrationFailure(
          sourceId,
          prepared,
          index,
          pluginDisposers,
          sourceSetupDisposer,
          sourceDispose,
        );
        return noop;
      }
      pluginDisposers.push(dispose);
    }

    const installed: InstalledSource = {
      id: sourceId,
      kind: source.kind,
      order: sourceOrder,
      sequence: this.#sourceSequence++,
      registrations: prepared.map((registration) => ({
        id: registration.id,
        pluginId: registration.pluginId,
        order: registration.order,
        slots: Object.keys(registration.definition.slots).sort(),
      })),
      pluginDisposers,
      setupDisposer: sourceSetupDisposer || undefined,
      dispose: sourceDispose,
    };
    this.#sources.set(sourceId, installed);
    this.#revision += 1;

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (this.#sources.get(sourceId) === installed) this.#remove(installed);
    };
  }

  /** Removes one installed source and its registrations. */
  uninstall(sourceId: string): boolean {
    const source = this.#sources.get(sourceId.trim());
    if (!source) return false;
    this.#remove(source);
    return true;
  }

  /** Removes sources in reverse installation order without disposing the host registry. */
  clear(): void {
    if (this.#sources.size === 0) return;
    const sources = [...this.#sources.values()].sort((left, right) => right.sequence - left.sequence);
    this.#sources.clear();
    this.#revision += 1;
    for (const source of sources) this.#disposeInstalled(source);
  }

  /** Idempotently closes this adapter while leaving the injected registry alive. */
  dispose(): void {
    if (this.#disposed) return;
    this.clear();
    this.#disposed = true;
    this.#revision += 1;
  }

  diagnostics(): PluginSlotSourceDiagnostic[] {
    return this.#diagnostics.map((diagnostic) => ({ ...diagnostic }));
  }

  clearDiagnostics(): void {
    this.#diagnostics.length = 0;
  }

  inspect(): PluginSlotSourceAdapterInspection {
    const sources = this.#orderedSources().map((source) => ({
      id: source.id,
      kind: source.kind,
      order: source.order,
      sequence: source.sequence,
      registrations: source.registrations.map((registration) => ({
        ...registration,
        slots: registration.slots.slice(),
      })),
    }));
    return {
      disposed: this.#disposed,
      revision: this.#revision,
      idPrefix: this.#idPrefix,
      sourceCount: sources.length,
      sources,
      diagnosticCount: this.#diagnostics.length,
      diagnostics: this.diagnostics(),
      registry: this.registry.inspect(),
    };
  }

  #prepareRegistrations(
    sourceId: string,
    source: PluginSlotSource<TNode, TMarkup, TView, TSlots, TValues>,
  ):
    | Array<PreparedRegistration<unknown, TSlots, TValues>>
    | undefined {
    const ids = new Set<string>();
    const prepared: Array<PreparedRegistration<unknown, TSlots, TValues>> = [];
    for (let index = 0; index < source.registrations.length; index += 1) {
      const definition = source.registrations[index] as PluginSlotSourceRegistration<unknown, TSlots, TValues>;
      const id = definition.id.trim();
      const pluginId = this.#registrationPluginId(sourceId, id || `anonymous-${index}`);
      if (!id) {
        this.#report(sourceId, pluginId, "registration", "registration id must not be empty");
        return undefined;
      }
      if (ids.has(id)) {
        this.#report(sourceId, pluginId, "registration", `registration id ${id} is duplicated`, id);
        return undefined;
      }
      ids.add(id);
      prepared.push({
        definition,
        id,
        pluginId,
        order: finiteOrder(source.order) + finiteOrder(definition.order),
        declarationSequence: index,
        dispose: once(definition.dispose),
      });
    }
    prepared.sort((left, right) => left.order - right.order || left.declarationSequence - right.declarationSequence);
    return prepared;
  }

  #pluginDefinition(
    sourceId: string,
    source: PluginSlotSource<TNode, TMarkup, TView, TSlots, TValues>,
    registration: PreparedRegistration<unknown, TSlots, TValues>,
    activate: () => void,
  ): PluginSlotPlugin<TNode, TSlots, THostContext> {
    return {
      id: registration.pluginId,
      order: registration.order,
      slots: this.#adaptSlots(sourceId, source, registration),
      setup: () => {
        activate();
        return registration.setupDisposer;
      },
      dispose: registration.dispose,
    };
  }

  #hasRegistrationCollision(
    sourceId: string,
    registrations: Array<PreparedRegistration<unknown, TSlots, TValues>>,
  ): boolean {
    for (const registration of registrations) {
      if (!this.registry.has(registration.pluginId)) continue;
      this.#report(
        sourceId,
        registration.pluginId,
        "registration",
        `plugin id ${registration.pluginId} is already registered`,
        registration.id,
      );
      return true;
    }
    return false;
  }

  #adaptSlots(
    sourceId: string,
    source: PluginSlotSource<TNode, TMarkup, TView, TSlots, TValues>,
    registration: PreparedRegistration<unknown, TSlots, TValues>,
  ): PluginSlotRenderers<TNode, TSlots, THostContext> {
    type SlotName = Extract<keyof TSlots, string>;
    const slots: Partial<Record<SlotName, PluginSlotRenderer<TNode, THostContext, TSlots[SlotName]>>> = {};
    for (const slot of Object.keys(registration.definition.slots) as SlotName[]) {
      const render = registration.definition.slots[slot] as
        | PluginSlotSourceRenderer<unknown, TValues, TSlots[SlotName]>
        | undefined;
      if (!render) continue;
      slots[slot] = (_hostContext, props) => {
        const context = this.#context(sourceId, source.kind, registration.id);
        const payload = render(context, props);
        if (payload === null || payload === undefined) return payload;
        if (source.kind === "core") return payload as TNode;
        if (source.kind === "markup") {
          return this.#markup!(payload as TMarkup, context, slot, props);
        }
        return this.#view!(payload as TView, context, slot, props);
      };
    }
    return slots as PluginSlotRenderers<TNode, TSlots, THostContext>;
  }

  #context(
    sourceId: string,
    sourceKind: PluginSlotSourceKind,
    registrationId?: string,
  ): PluginSlotSourceContext<TValues> {
    const current = typeof this.#values === "function" ? this.#values() : this.#values;
    return Object.freeze({
      sourceId,
      sourceKind,
      registrationId,
      values: deepFreeze(structuredClone(current)),
    });
  }

  #rollbackRegistrationFailure(
    sourceId: string,
    registrations: Array<PreparedRegistration<unknown, TSlots, TValues>>,
    failedIndex: number,
    pluginDisposers: Array<() => void>,
    sourceSetupDisposer: void | (() => void),
    sourceDispose: (() => void) | undefined,
  ): void {
    for (let index = registrations.length - 1; index >= failedIndex; index -= 1) {
      this.#disposePreparedRegistration(sourceId, registrations[index]!);
    }
    for (let index = pluginDisposers.length - 1; index >= 0; index -= 1) pluginDisposers[index]!();
    const sourcePluginId = this.#sourcePluginId(sourceId);
    this.#safeDispose(sourceId, sourcePluginId, sourceSetupDisposer || undefined);
    this.#safeDispose(sourceId, sourcePluginId, sourceDispose);
  }

  #disposePrepared(
    sourceId: string,
    registrations: Array<PreparedRegistration<unknown, TSlots, TValues>>,
    setupCount: number,
    sourceSetupDisposer: void | (() => void),
    sourceDispose: (() => void) | undefined,
  ): void {
    for (let index = setupCount - 1; index >= 0; index -= 1) {
      this.#disposePreparedRegistration(sourceId, registrations[index]!);
    }
    const sourcePluginId = this.#sourcePluginId(sourceId);
    this.#safeDispose(sourceId, sourcePluginId, sourceSetupDisposer || undefined);
    this.#safeDispose(sourceId, sourcePluginId, sourceDispose);
  }

  #disposePreparedRegistration(
    sourceId: string,
    registration: PreparedRegistration<unknown, TSlots, TValues>,
  ): void {
    this.#safeDispose(
      sourceId,
      registration.pluginId,
      registration.setupDisposer,
      registration.id,
    );
    this.#safeDispose(
      sourceId,
      registration.pluginId,
      registration.dispose,
      registration.id,
    );
  }

  #remove(source: InstalledSource): void {
    this.#sources.delete(source.id);
    this.#revision += 1;
    this.#disposeInstalled(source);
  }

  #disposeInstalled(source: InstalledSource): void {
    for (let index = source.pluginDisposers.length - 1; index >= 0; index -= 1) {
      source.pluginDisposers[index]!();
    }
    const sourcePluginId = this.#sourcePluginId(source.id);
    this.#safeDispose(source.id, sourcePluginId, source.setupDisposer);
    this.#safeDispose(source.id, sourcePluginId, source.dispose);
  }

  #safeDispose(
    sourceId: string,
    pluginId: string,
    dispose: (() => void) | undefined,
    registrationId?: string,
  ): void {
    if (!dispose) return;
    try {
      dispose();
    } catch (error) {
      this.#report(sourceId, pluginId, "dispose", error, registrationId);
    }
  }

  #report(
    sourceId: string,
    pluginId: string,
    phase: "registration" | "setup" | "dispose",
    error: unknown,
    registrationId?: string,
  ): void {
    const normalized = normalizeError(error);
    const diagnostic: PluginSlotSourceDiagnostic = {
      sequence: this.#diagnosticSequence++,
      sourceId,
      registrationId,
      pluginId,
      phase,
      message: normalized.message,
    };
    if (this.#maxDiagnostics > 0) {
      this.#diagnostics.push(diagnostic);
      if (this.#diagnostics.length > this.#maxDiagnostics) {
        this.#diagnostics.splice(0, this.#diagnostics.length - this.#maxDiagnostics);
      }
    }
    this.registry.reportError({ pluginId, phase, error: normalized });
  }

  #orderedSources(): InstalledSource[] {
    return [...this.#sources.values()].sort((left, right) =>
      left.order - right.order || left.sequence - right.sequence || left.id.localeCompare(right.id)
    );
  }

  #sourcePluginId(sourceId: string): string {
    return `${this.#idPrefix}.${idPart(sourceId)}`;
  }

  #registrationPluginId(sourceId: string, registrationId: string): string {
    return `${this.#sourcePluginId(sourceId)}.${idPart(registrationId)}`;
  }
}

/** Creates a source adapter around an existing host-owned typed slot registry. */
export function createPluginSlotSourceAdapter<
  TNode,
  TMarkup,
  TView,
  TSlots extends object,
  THostContext extends object,
  TValues extends Readonly<Record<string, PluginSlotDataValue>>,
>(
  options: PluginSlotSourceAdapterOptions<TNode, TMarkup, TView, TSlots, THostContext, TValues>,
): PluginSlotSourceAdapter<TNode, TMarkup, TView, TSlots, THostContext, TValues> {
  return new PluginSlotSourceAdapter(options);
}

function finiteOrder(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

function normalizedId(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function idPart(value: string): string {
  return encodeURIComponent(value).replaceAll(".", "%2E");
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function once(dispose: (() => void) | undefined): (() => void) | undefined {
  if (!dispose) return undefined;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    dispose();
  };
}

function noop(): void {}
