// Copyright 2023 Im-Beast. MIT license.
import type { Route, RouteManager } from "./router.ts";
import type { ScreenDefinition, ScreenStack, ScreenStackChange, ScreenStackInspection } from "./screens.ts";

/** How an unmounted route target enters its named screen mode. */
export type ScreenRouteEnterOperation = "push" | "replace";

/** Effective projection selected from the live stack topology. */
export type ScreenRouteProjectionTransition = "current" | "push" | "replace" | "back";

/** Event that asked the binding to reconcile the Router-owned state. */
export type ScreenRouterSyncSource = "initial" | "route" | "routes" | "stack" | "manual";

/** Stable structured diagnostic categories for route/screen projection. */
export type ScreenRouterDiagnosticCode =
  | "invalid-mode"
  | "duplicate-mode"
  | "invalid-mapping"
  | "duplicate-route-mapping"
  | "unmapped-route"
  | "unknown-route"
  | "unknown-mode"
  | "unknown-screen"
  | "non-restorable-screen"
  | "disposed-stack"
  | "transition-failed"
  | "reentrant-sync-limit"
  | "sync-error"
  | "listener-error"
  | "disposed";

/** One independent named mode backed by a host-owned ScreenStack. */
export interface ScreenRouterModeDefinition<
  TScreen extends ScreenDefinition = ScreenDefinition,
  TFocusToken = unknown,
> {
  readonly id: string;
  readonly stack: ScreenStack<TScreen, TFocusToken>;
}

/** Deterministic projection from one Router route to one mode and screen. */
export interface ScreenRouteMappingDefinition {
  readonly routeId: string;
  readonly mode: string;
  readonly screenId: string;
  /** Used only when the target is not already mounted. Defaults to push. */
  readonly enter?: ScreenRouteEnterOperation;
  /** False means an unmounted transient screen cannot be recreated from route state alone. */
  readonly restorable?: boolean;
}

/** Construction policy for a renderer-neutral Router projection. */
export interface ScreenRouterModeBindingOptions<
  TRoute extends Route = Route,
  TScreen extends ScreenDefinition = ScreenDefinition,
  TFocusToken = unknown,
> {
  readonly router: RouteManager<TRoute>;
  readonly modes: readonly ScreenRouterModeDefinition<TScreen, TFocusToken>[];
  readonly mappings: readonly ScreenRouteMappingDefinition[];
  readonly maxDiagnostics?: number;
  readonly maxSyncPasses?: number;
  readonly now?: () => number;
  readonly onDiagnostic?: (diagnostic: ScreenRouterDiagnostic) => void;
}

/** Immutable bounded route/screen projection diagnostic. */
export interface ScreenRouterDiagnostic {
  readonly code: ScreenRouterDiagnosticCode;
  readonly source: ScreenRouterSyncSource | "configuration" | "dispose";
  readonly message: string;
  readonly timestamp: number;
  readonly routeId?: string;
  readonly mode?: string;
  readonly screenId?: string;
  readonly transition?: ScreenRouteProjectionTransition;
}

/** Why one configured mapping cannot currently project. */
export type ScreenRouteMappingInactiveReason =
  | "invalid-mapping"
  | "duplicate-route-mapping"
  | "route-unregistered"
  | "mode-unregistered"
  | "stack-disposed"
  | "screen-unregistered"
  | "screen-not-restorable";

/** Clone-safe evaluated mapping for devtools and tests. */
export interface ScreenRouteMappingInspection {
  readonly routeId: string;
  readonly mode: string;
  readonly screenId: string;
  readonly enter: ScreenRouteEnterOperation;
  readonly restorable: boolean;
  readonly configuredIndex: number;
  readonly accepted: boolean;
  readonly routeRegistered: boolean;
  readonly modeRegistered: boolean;
  readonly screenRegistered: boolean;
  readonly mounted: boolean;
  readonly active: boolean;
  readonly inactiveReason?: ScreenRouteMappingInactiveReason;
}

/** Clone-safe state for one accepted named screen mode. */
export interface ScreenRouterModeInspection {
  readonly id: string;
  readonly active: boolean;
  readonly stackDisposed: boolean;
  readonly stackRevision: number;
  readonly depth: number;
  readonly activeScreenId?: string;
  readonly mappingCount: number;
}

/** Result of one complete reconciliation pass. */
export interface ScreenRouterSyncResult {
  readonly status: "applied" | "current" | "unresolved" | "disposed";
  readonly source: ScreenRouterSyncSource;
  readonly routeId: string;
  readonly mode?: string;
  readonly screenId?: string;
  readonly actualScreenId?: string;
  readonly transition?: ScreenRouteProjectionTransition;
  readonly stackOperation?: "push" | "replace" | "switch";
  readonly stackRevision?: number;
  readonly diagnostic?: ScreenRouterDiagnostic;
}

/** Last observed external ScreenStack change. It never becomes route ownership. */
export interface ScreenRouterStackChangeInspection {
  readonly mode: string;
  readonly operation: ScreenStackChange["operation"];
  readonly revision: number;
  readonly previousActiveScreenId?: string;
  readonly activeScreenId?: string;
  readonly screenIds: readonly string[];
}

/** Full clone-safe state of the Router-to-screen projection. */
export interface ScreenRouterModeBindingInspection {
  readonly disposed: boolean;
  readonly revision: number;
  readonly syncCount: number;
  readonly queuedSyncCount: number;
  readonly activeRouteId: string;
  readonly activeMode?: string;
  readonly activeScreenId?: string;
  /** Route history is intentionally owned by bindRouteHistory/HistoryStack, not this adapter. */
  readonly routeHistoryOwnership: "external";
  /** Direct stack mutations are drift and are reconciled to Router state, never promoted to routes. */
  readonly stackNavigationPolicy: "router-authoritative";
  readonly configuredModeCount: number;
  readonly modeCount: number;
  readonly configuredMappingCount: number;
  readonly mappingCount: number;
  readonly subscriptionCount: number;
  readonly diagnosticSubscriptionCount: number;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly ScreenRouterDiagnostic[];
  readonly modes: readonly ScreenRouterModeInspection[];
  readonly mappings: readonly ScreenRouteMappingInspection[];
  readonly lastSync?: ScreenRouterSyncResult;
  readonly lastStackChange?: ScreenRouterStackChangeInspection;
}

interface RegisteredMode<TScreen extends ScreenDefinition, TFocusToken> {
  readonly id: string;
  readonly stack: ScreenStack<TScreen, TFocusToken>;
  readonly configuredIndex: number;
}

interface MappingRecord {
  readonly routeId: string;
  readonly mode: string;
  readonly screenId: string;
  readonly enter: ScreenRouteEnterOperation;
  readonly restorable: boolean;
  readonly configuredIndex: number;
  readonly accepted: boolean;
  readonly staticInactiveReason?: "invalid-mapping" | "duplicate-route-mapping" | "mode-unregistered";
}

/**
 * Projects the existing RouteManager into independent named ScreenStacks.
 *
 * RouteManager remains the sole route owner. Its `navigate`, `next`, and
 * `previous` methods all appear here as an activeRouteId change. RouteManager
 * has no push/replace/back/forward history API; applications that need undoable
 * back/forward navigation keep using `bindRouteHistory` and `HistoryStack`.
 * This binding never writes activeRouteId and never records route history.
 *
 * Within a mode, an active target is `current`, a suspended target is revealed
 * with ScreenStack.switch (`back`), and an unmounted restorable target uses its
 * declared push/replace operation. Other mode stacks remain intact.
 */
export class ScreenRouterModeBinding<
  TRoute extends Route = Route,
  TScreen extends ScreenDefinition = ScreenDefinition,
  TFocusToken = unknown,
> {
  readonly router: RouteManager<TRoute>;
  readonly #modes = new Map<string, RegisteredMode<TScreen, TFocusToken>>();
  readonly #modeRecords: Array<{ id: string; accepted: boolean }> = [];
  readonly #mappings: MappingRecord[] = [];
  readonly #mappingByRoute = new Map<string, MappingRecord>();
  readonly #stackDisposers: Array<() => void> = [];
  readonly #listeners = new Set<(inspection: ScreenRouterModeBindingInspection) => void>();
  readonly #diagnosticListeners = new Set<(diagnostic: ScreenRouterDiagnostic) => void>();
  readonly #diagnostics: ScreenRouterDiagnostic[] = [];
  readonly #onDiagnostic?: (diagnostic: ScreenRouterDiagnostic) => void;
  readonly #now: () => number;
  readonly #maxDiagnostics: number;
  readonly #maxSyncPasses: number;
  readonly #routeListener: (routeId: string) => void;
  readonly #routesListener: () => void;
  #revision = 0;
  #syncCount = 0;
  #queuedSyncCount = 0;
  #activeMode?: string;
  #lastSync?: ScreenRouterSyncResult;
  #lastStackChange?: ScreenRouterStackChangeInspection;
  #syncing = false;
  #queuedSource?: ScreenRouterSyncSource;
  #projectingMode?: string;
  #disposed = false;

  constructor(options: ScreenRouterModeBindingOptions<TRoute, TScreen, TFocusToken>) {
    this.router = options.router;
    this.#onDiagnostic = options.onDiagnostic;
    this.#now = options.now ?? Date.now;
    this.#maxDiagnostics = nonNegativeInteger(options.maxDiagnostics, 100);
    this.#maxSyncPasses = positiveInteger(options.maxSyncPasses, 32);
    this.#registerModes(options.modes);
    this.#registerMappings(options.mappings);

    this.#routeListener = () => {
      this.#requestSync("route");
    };
    this.#routesListener = () => {
      this.#requestSync("routes");
    };
    this.router.activeRouteId.subscribe(this.#routeListener);
    this.router.routes.subscribe(this.#routesListener);
    for (const mode of this.#modes.values()) {
      this.#stackDisposers.push(mode.stack.subscribe((inspection, change) => {
        this.#observeStackChange(mode, inspection, change);
      }));
    }
    this.#requestSync("initial");
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get revision(): number {
    return this.#revision;
  }

  /** Explicitly reconciles the current Router route without changing it. */
  sync(): ScreenRouterSyncResult {
    return this.#requestSync("manual");
  }

  /** Subscribes to completed projection snapshots. */
  subscribe(listener: (inspection: ScreenRouterModeBindingInspection) => void): () => void {
    if (this.#disposed) return noop;
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Subscribes to immutable bounded projection diagnostics. */
  onDiagnostic(listener: (diagnostic: ScreenRouterDiagnostic) => void): () => void {
    if (this.#disposed) return noop;
    this.#diagnosticListeners.add(listener);
    return () => this.#diagnosticListeners.delete(listener);
  }

  /** Returns live Router, mode, mapping, transition, and diagnostic state. */
  inspect(): ScreenRouterModeBindingInspection {
    const activeRouteId = this.router.activeRouteId.peek();
    const modes = [...this.#modes.values()].map((mode) =>
      modeInspection(mode, mode.id === this.#activeMode, this.#mappings)
    )
      .sort((left, right) => compareStrings(left.id, right.id));
    const mappings = this.#mappings.map((mapping) => this.#inspectMapping(mapping, activeRouteId))
      .sort((left, right) => left.configuredIndex - right.configuredIndex);
    const activeMode = this.#activeMode ? this.#modes.get(this.#activeMode) : undefined;
    const diagnostics = this.#diagnostics.map(cloneDiagnostic);
    return {
      disposed: this.#disposed,
      revision: this.#revision,
      syncCount: this.#syncCount,
      queuedSyncCount: this.#queuedSyncCount,
      activeRouteId,
      activeMode: this.#activeMode,
      activeScreenId: activeMode?.stack.inspect().activeScreenId,
      routeHistoryOwnership: "external",
      stackNavigationPolicy: "router-authoritative",
      configuredModeCount: this.#modeRecords.length,
      modeCount: this.#modes.size,
      configuredMappingCount: this.#mappings.length,
      mappingCount: this.#mappingByRoute.size,
      subscriptionCount: this.#listeners.size,
      diagnosticSubscriptionCount: this.#diagnosticListeners.size,
      diagnosticCount: diagnostics.length,
      diagnostics,
      modes,
      mappings,
      lastSync: this.#lastSync ? cloneSyncResult(this.#lastSync) : undefined,
      lastStackChange: this.#lastStackChange ? cloneStackChange(this.#lastStackChange) : undefined,
    };
  }

  /** Unsubscribes without disposing the injected Router or any ScreenStack. */
  dispose(): void {
    if (this.#disposed) return;
    this.router.activeRouteId.unsubscribe(this.#routeListener);
    this.router.routes.unsubscribe(this.#routesListener);
    for (let index = this.#stackDisposers.length - 1; index >= 0; index -= 1) {
      try {
        this.#stackDisposers[index]!();
      } catch (error) {
        this.#report("sync-error", "dispose", `screen subscription disposal failed: ${errorMessage(error)}`);
      }
    }
    this.#stackDisposers.length = 0;
    this.#queuedSource = undefined;
    this.#disposed = true;
    this.#lastSync = {
      status: "disposed",
      source: "manual",
      routeId: this.router.activeRouteId.peek(),
      mode: this.#activeMode,
      actualScreenId: this.#activeMode ? this.#modes.get(this.#activeMode)?.stack.inspect().activeScreenId : undefined,
    };
    this.#revision += 1;
    this.#notify();
    this.#listeners.clear();
    this.#diagnosticListeners.clear();
  }

  #registerModes(modes: readonly ScreenRouterModeDefinition<TScreen, TFocusToken>[]): void {
    for (let index = 0; index < modes.length; index += 1) {
      const source = modes[index] as ScreenRouterModeDefinition<TScreen, TFocusToken> | undefined;
      const id = typeof source?.id === "string" ? source.id : "";
      if (!validExactId(id) || !isScreenStack(source?.stack)) {
        this.#modeRecords.push({ id, accepted: false });
        this.#report(
          "invalid-mode",
          "configuration",
          `mode at index ${index} requires an exact non-empty id and ScreenStack`,
          { mode: id || undefined },
        );
        continue;
      }
      if (this.#modes.has(id)) {
        this.#modeRecords.push({ id, accepted: false });
        this.#report("duplicate-mode", "configuration", `mode ${id} is configured more than once`, { mode: id });
        continue;
      }
      this.#modeRecords.push({ id, accepted: true });
      this.#modes.set(id, { id, stack: source.stack, configuredIndex: index });
    }
  }

  #registerMappings(mappings: readonly ScreenRouteMappingDefinition[]): void {
    for (let index = 0; index < mappings.length; index += 1) {
      const source = mappings[index] as ScreenRouteMappingDefinition | undefined;
      const routeId = typeof source?.routeId === "string" ? source.routeId : "";
      const mode = typeof source?.mode === "string" ? source.mode : "";
      const screenId = typeof source?.screenId === "string" ? source.screenId : "";
      const enter = source?.enter === "replace" ? "replace" : "push";
      const restorable = source?.restorable !== false;
      let accepted = true;
      let staticInactiveReason: MappingRecord["staticInactiveReason"];
      if (!validExactId(routeId) || !validExactId(mode) || !validExactId(screenId) || !validEnter(source?.enter)) {
        accepted = false;
        staticInactiveReason = "invalid-mapping";
        this.#report("invalid-mapping", "configuration", `mapping at index ${index} is malformed`, {
          routeId: routeId || undefined,
          mode: mode || undefined,
          screenId: screenId || undefined,
        });
      } else if (this.#mappingByRoute.has(routeId)) {
        accepted = false;
        staticInactiveReason = "duplicate-route-mapping";
        this.#report(
          "duplicate-route-mapping",
          "configuration",
          `route ${routeId} has more than one screen mapping; the first mapping wins`,
          { routeId, mode, screenId },
        );
      } else if (!this.#modes.has(mode)) {
        accepted = false;
        staticInactiveReason = "mode-unregistered";
        this.#report("unknown-mode", "configuration", `mapping for route ${routeId} references unknown mode ${mode}`, {
          routeId,
          mode,
          screenId,
        });
      }
      const record: MappingRecord = {
        routeId,
        mode,
        screenId,
        enter,
        restorable,
        configuredIndex: index,
        accepted,
        staticInactiveReason,
      };
      this.#mappings.push(record);
      if (accepted) this.#mappingByRoute.set(routeId, record);
    }
  }

  #observeStackChange(
    mode: RegisteredMode<TScreen, TFocusToken>,
    _inspection: ScreenStackInspection,
    change: ScreenStackChange,
  ): void {
    if (this.#disposed || this.#projectingMode === mode.id) return;
    this.#lastStackChange = {
      mode: mode.id,
      operation: change.operation,
      revision: change.revision,
      previousActiveScreenId: change.previousActiveScreenId,
      activeScreenId: change.activeScreenId,
      screenIds: [...change.screenIds],
    };
    const mapping = this.#mappingByRoute.get(this.router.activeRouteId.peek());
    if (mapping?.mode === mode.id) {
      this.#requestSync("stack");
      return;
    }
    this.#revision += 1;
    this.#notify();
  }

  #requestSync(source: ScreenRouterSyncSource): ScreenRouterSyncResult {
    if (this.#disposed) {
      const diagnostic = this.#report("disposed", source, "screen router binding is disposed", {
        routeId: this.router.activeRouteId.peek(),
      });
      return {
        status: "disposed",
        source,
        routeId: this.router.activeRouteId.peek(),
        mode: this.#activeMode,
        diagnostic,
      };
    }
    if (this.#syncing) {
      this.#queuedSource = source;
      this.#queuedSyncCount += 1;
      return this.#lastSync
        ? cloneSyncResult(this.#lastSync)
        : { status: "unresolved", source, routeId: this.router.activeRouteId.peek() };
    }

    this.#syncing = true;
    this.#queuedSource = source;
    let result: ScreenRouterSyncResult = {
      status: "unresolved",
      source,
      routeId: this.router.activeRouteId.peek(),
    };
    let passes = 0;
    try {
      while (this.#queuedSource) {
        const nextSource = this.#queuedSource;
        this.#queuedSource = undefined;
        passes += 1;
        if (passes > this.#maxSyncPasses) {
          const routeId = this.router.activeRouteId.peek();
          const diagnostic = this.#report(
            "reentrant-sync-limit",
            nextSource,
            `route/screen synchronization exceeded ${this.#maxSyncPasses} queued passes`,
            { routeId },
          );
          result = { status: "unresolved", source: nextSource, routeId, diagnostic };
          break;
        }
        this.#syncCount += 1;
        result = this.#syncOnce(nextSource);
      }
    } catch (error) {
      const routeId = this.router.activeRouteId.peek();
      const diagnostic = this.#report(
        "sync-error",
        source,
        `route/screen synchronization failed: ${errorMessage(error)}`,
        {
          routeId,
        },
      );
      result = { status: "unresolved", source, routeId, diagnostic };
    } finally {
      this.#queuedSource = undefined;
      this.#syncing = false;
    }
    this.#lastSync = cloneSyncResult(result);
    this.#revision += 1;
    this.#notify();
    return cloneSyncResult(result);
  }

  #syncOnce(source: ScreenRouterSyncSource): ScreenRouterSyncResult {
    const routeId = this.router.activeRouteId.peek();
    const mapping = this.#mappingByRoute.get(routeId);
    if (!mapping) {
      this.#activeMode = undefined;
      const diagnostic = this.#report(
        "unmapped-route",
        source,
        `active route ${displayId(routeId)} has no screen mapping`,
        {
          routeId: routeId || undefined,
        },
      );
      return { status: "unresolved", source, routeId, diagnostic };
    }
    const mode = this.#modes.get(mapping.mode);
    if (!mode) {
      this.#activeMode = undefined;
      const diagnostic = this.#report(
        "unknown-mode",
        source,
        `route ${routeId} references unavailable mode ${mapping.mode}`,
        {
          routeId,
          mode: mapping.mode,
          screenId: mapping.screenId,
        },
      );
      return {
        status: "unresolved",
        source,
        routeId,
        mode: mapping.mode,
        screenId: mapping.screenId,
        diagnostic,
      };
    }
    this.#activeMode = mode.id;
    const before = mode.stack.inspect();
    if (before.disposed) {
      const diagnostic = this.#report("disposed-stack", source, `mode ${mode.id} uses a disposed screen stack`, {
        routeId,
        mode: mode.id,
        screenId: mapping.screenId,
      });
      return unresolvedResult(source, mapping, before, diagnostic);
    }
    if (!this.router.has(routeId)) {
      const diagnostic = this.#report("unknown-route", source, `active route ${routeId} is not registered`, {
        routeId,
        mode: mode.id,
        screenId: mapping.screenId,
      });
      return unresolvedResult(source, mapping, before, diagnostic);
    }
    if (!mode.stack.has(mapping.screenId)) {
      const diagnostic = this.#report(
        "unknown-screen",
        source,
        `route ${routeId} references unregistered screen ${mapping.screenId} in mode ${mode.id}`,
        { routeId, mode: mode.id, screenId: mapping.screenId },
      );
      return unresolvedResult(source, mapping, before, diagnostic);
    }

    const stackIds = mode.stack.stackIds();
    const targetIndex = stackIds.indexOf(mapping.screenId);
    if (before.activeScreenId === mapping.screenId) {
      return {
        status: "current",
        source,
        routeId,
        mode: mode.id,
        screenId: mapping.screenId,
        actualScreenId: before.activeScreenId,
        transition: "current",
        stackRevision: before.revision,
      };
    }

    let transition: Exclude<ScreenRouteProjectionTransition, "current">;
    let stackOperation: "push" | "replace" | "switch";
    if (targetIndex >= 0) {
      transition = "back";
      stackOperation = "switch";
    } else {
      if (!mapping.restorable) {
        const diagnostic = this.#report(
          "non-restorable-screen",
          source,
          `route ${routeId} cannot recreate unmounted transient screen ${mapping.screenId}`,
          { routeId, mode: mode.id, screenId: mapping.screenId },
        );
        return unresolvedResult(source, mapping, before, diagnostic);
      }
      transition = mapping.enter;
      stackOperation = mapping.enter;
    }

    let applied = false;
    this.#projectingMode = mode.id;
    try {
      if (stackOperation === "switch") applied = mode.stack.switch(mapping.screenId);
      else if (stackOperation === "replace") applied = mode.stack.replace(mapping.screenId);
      else applied = mode.stack.push(mapping.screenId);
    } finally {
      this.#projectingMode = undefined;
    }
    const after = mode.stack.inspect();
    if (!applied || after.activeScreenId !== mapping.screenId) {
      const diagnostic = this.#report(
        "transition-failed",
        source,
        `${stackOperation} failed while projecting route ${routeId} to ${mode.id}/${mapping.screenId}`,
        { routeId, mode: mode.id, screenId: mapping.screenId, transition },
      );
      return unresolvedResult(source, mapping, after, diagnostic, transition, stackOperation);
    }
    return {
      status: "applied",
      source,
      routeId,
      mode: mode.id,
      screenId: mapping.screenId,
      actualScreenId: after.activeScreenId,
      transition,
      stackOperation,
      stackRevision: after.revision,
    };
  }

  #inspectMapping(mapping: MappingRecord, activeRouteId: string): ScreenRouteMappingInspection {
    const mode = this.#modes.get(mapping.mode);
    const inspection = mode?.stack.inspect();
    const routeRegistered = this.router.has(mapping.routeId);
    const screenRegistered = mode?.stack.has(mapping.screenId) ?? false;
    const mounted = mode?.stack.stackIds().includes(mapping.screenId) ?? false;
    let inactiveReason: ScreenRouteMappingInactiveReason | undefined = mapping.staticInactiveReason;
    if (!inactiveReason && !routeRegistered) inactiveReason = "route-unregistered";
    if (!inactiveReason && !mode) inactiveReason = "mode-unregistered";
    if (!inactiveReason && inspection?.disposed) inactiveReason = "stack-disposed";
    if (!inactiveReason && !screenRegistered) inactiveReason = "screen-unregistered";
    if (!inactiveReason && !mapping.restorable && !mounted) inactiveReason = "screen-not-restorable";
    return {
      routeId: mapping.routeId,
      mode: mapping.mode,
      screenId: mapping.screenId,
      enter: mapping.enter,
      restorable: mapping.restorable,
      configuredIndex: mapping.configuredIndex,
      accepted: mapping.accepted,
      routeRegistered,
      modeRegistered: mode !== undefined,
      screenRegistered,
      mounted,
      active: mapping.accepted && activeRouteId === mapping.routeId && inactiveReason === undefined &&
        inspection?.activeScreenId === mapping.screenId,
      inactiveReason,
    };
  }

  #report(
    code: ScreenRouterDiagnosticCode,
    source: ScreenRouterDiagnostic["source"],
    message: string,
    details: Pick<ScreenRouterDiagnostic, "routeId" | "mode" | "screenId" | "transition"> = {},
  ): ScreenRouterDiagnostic {
    const diagnostic: ScreenRouterDiagnostic = Object.freeze({
      code,
      source,
      message,
      timestamp: safeNow(this.#now),
      ...details,
    });
    if (this.#maxDiagnostics > 0) {
      this.#diagnostics.push(diagnostic);
      if (this.#diagnostics.length > this.#maxDiagnostics) {
        this.#diagnostics.splice(0, this.#diagnostics.length - this.#maxDiagnostics);
      }
    }
    for (const listener of [this.#onDiagnostic, ...this.#diagnosticListeners]) {
      try {
        listener?.(diagnostic);
      } catch {
        // Diagnostic observers cannot interfere with Router projection.
      }
    }
    return diagnostic;
  }

  #notify(): void {
    const inspection = this.inspect();
    for (const listener of [...this.#listeners]) {
      try {
        listener(inspection);
      } catch (error) {
        this.#report("listener-error", "manual", `binding listener failed: ${errorMessage(error)}`);
      }
    }
  }
}

/** Creates and initially synchronizes a Router-owned named-mode projection. */
export function createScreenRouterModeBinding<
  TRoute extends Route = Route,
  TScreen extends ScreenDefinition = ScreenDefinition,
  TFocusToken = unknown,
>(
  options: ScreenRouterModeBindingOptions<TRoute, TScreen, TFocusToken>,
): ScreenRouterModeBinding<TRoute, TScreen, TFocusToken> {
  return new ScreenRouterModeBinding(options);
}

function modeInspection<TScreen extends ScreenDefinition, TFocusToken>(
  mode: RegisteredMode<TScreen, TFocusToken>,
  active: boolean,
  mappings: readonly MappingRecord[],
): ScreenRouterModeInspection {
  const inspection = mode.stack.inspect();
  return {
    id: mode.id,
    active,
    stackDisposed: inspection.disposed,
    stackRevision: inspection.revision,
    depth: inspection.depth,
    activeScreenId: inspection.activeScreenId,
    mappingCount: mappings.filter((mapping) => mapping.accepted && mapping.mode === mode.id).length,
  };
}

function unresolvedResult(
  source: ScreenRouterSyncSource,
  mapping: MappingRecord,
  inspection: ScreenStackInspection,
  diagnostic: ScreenRouterDiagnostic,
  transition?: ScreenRouteProjectionTransition,
  stackOperation?: "push" | "replace" | "switch",
): ScreenRouterSyncResult {
  return {
    status: "unresolved",
    source,
    routeId: mapping.routeId,
    mode: mapping.mode,
    screenId: mapping.screenId,
    actualScreenId: inspection.activeScreenId,
    transition,
    stackOperation,
    stackRevision: inspection.revision,
    diagnostic,
  };
}

function validExactId(value: string): boolean {
  return value.length > 0 && value.trim() === value;
}

function validEnter(value: ScreenRouteEnterOperation | undefined): boolean {
  return value === undefined || value === "push" || value === "replace";
}

function isScreenStack<TScreen extends ScreenDefinition, TFocusToken>(
  value: ScreenStack<TScreen, TFocusToken> | undefined,
): value is ScreenStack<TScreen, TFocusToken> {
  return typeof value === "object" && value !== null && typeof value.inspect === "function" &&
    typeof value.subscribe === "function" && typeof value.stackIds === "function" && typeof value.has === "function" &&
    typeof value.push === "function" && typeof value.replace === "function" && typeof value.switch === "function";
}

function cloneDiagnostic(value: ScreenRouterDiagnostic): ScreenRouterDiagnostic {
  return { ...value };
}

function cloneSyncResult(value: ScreenRouterSyncResult): ScreenRouterSyncResult {
  return { ...value, diagnostic: value.diagnostic ? cloneDiagnostic(value.diagnostic) : undefined };
}

function cloneStackChange(value: ScreenRouterStackChangeInspection): ScreenRouterStackChangeInspection {
  return { ...value, screenIds: [...value.screenIds] };
}

function safeNow(now: () => number): number {
  try {
    const value = now();
    return Number.isFinite(value) ? value : Date.now();
  } catch {
    return Date.now();
  }
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : fallback;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value!)) : fallback;
}

function displayId(value: string): string {
  return value || "<empty>";
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function noop(): void {}
