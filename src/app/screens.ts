// Copyright 2023 Im-Beast. MIT license.

/** Lifecycle phases emitted while a screen entry moves through the stack. */
export type ScreenLifecyclePhase = "mount" | "focus" | "suspend" | "resume" | "close";

/** Mutations that can produce screen-stack lifecycle or subscription events. */
export type ScreenStackOperation =
  | "register"
  | "unregister"
  | "push"
  | "pop"
  | "replace"
  | "switch"
  | "dismiss"
  | "dispose";

/** Structured diagnostic categories reported without throwing through host code. */
export type ScreenStackDiagnosticCode =
  | "invalid-screen"
  | "duplicate-screen"
  | "unknown-screen"
  | "screen-not-active"
  | "screen-active"
  | "empty-stack"
  | "disposed"
  | "reentrant-transition"
  | "lifecycle-error"
  | "focus-error"
  | "result-callback-error";

/** A renderer-neutral named screen and its optional lifecycle callbacks. */
export interface ScreenDefinition {
  id: string;
  title?: string;
  onMount?: (event: ScreenLifecycleEvent) => void;
  onFocus?: (event: ScreenLifecycleEvent) => void;
  onSuspend?: (event: ScreenLifecycleEvent) => void;
  onResume?: (event: ScreenLifecycleEvent) => void;
  onClose?: (event: ScreenLifecycleEvent) => void;
}

/** Immutable context supplied to lifecycle and focus-restoration hooks. */
export interface ScreenLifecycleEvent<TScreen extends ScreenDefinition = ScreenDefinition> {
  readonly phase: ScreenLifecyclePhase;
  readonly operation: ScreenStackOperation;
  readonly screenId: string;
  readonly screen: TScreen;
  readonly previousActiveScreenId?: string;
  readonly activeScreenId?: string;
  readonly depth: number;
}

/** One bounded, immutable diagnostic emitted by the screen stack. */
export interface ScreenStackDiagnostic {
  readonly code: ScreenStackDiagnosticCode;
  readonly operation: ScreenStackOperation;
  readonly screenId?: string;
  readonly phase?: ScreenLifecyclePhase;
  readonly message: string;
  readonly timestamp: number;
}

/** Immutable public projection of one mounted stack entry. */
export interface ScreenEntryInspection {
  readonly id: string;
  readonly title?: string;
  readonly modal: boolean;
  readonly state: "active" | "suspended";
  readonly hasFocusToken: boolean;
}

/** Immutable public state used by render adapters, tests, and devtools. */
export interface ScreenStackInspection {
  readonly disposed: boolean;
  readonly revision: number;
  readonly registeredCount: number;
  readonly registeredScreenIds: readonly string[];
  readonly depth: number;
  readonly activeScreenId?: string;
  readonly entries: readonly ScreenEntryInspection[];
  readonly diagnosticCount: number;
  readonly diagnostics: readonly ScreenStackDiagnostic[];
  readonly lastDiagnostic?: ScreenStackDiagnostic;
}

/** Immutable description of one successful registry or stack mutation. */
export interface ScreenStackChange {
  readonly operation: ScreenStackOperation;
  readonly revision: number;
  readonly previousActiveScreenId?: string;
  readonly activeScreenId?: string;
  readonly screenIds: readonly string[];
}

/** Configuration for lifecycle observation, focus ownership, and diagnostics. */
export interface ScreenStackOptions<
  TScreen extends ScreenDefinition = ScreenDefinition,
  TFocusToken = unknown,
> {
  captureFocus?: (event: ScreenLifecycleEvent<TScreen>) => TFocusToken;
  restoreFocus?: (token: TFocusToken, event: ScreenLifecycleEvent<TScreen>) => void;
  onLifecycle?: (event: ScreenLifecycleEvent<TScreen>) => void;
  onDiagnostic?: (diagnostic: ScreenStackDiagnostic) => void;
  maxDiagnostics?: number;
  now?: () => number;
}

/** Callback form of a modal result; the returned promise always receives the same value. */
export type ScreenModalResultCallback<TResult> = (
  result: TResult | undefined,
  inspection: ScreenStackInspection,
) => void;

interface RegisteredScreen<TScreen extends ScreenDefinition> {
  readonly id: string;
  readonly definition: TScreen;
}

interface PendingModalResult {
  readonly resolve: (result: unknown | undefined) => void;
  readonly callback?: ScreenModalResultCallback<unknown>;
  settled: boolean;
}

interface ScreenStackEntry<TScreen extends ScreenDefinition, TFocusToken> {
  readonly registered: RegisteredScreen<TScreen>;
  readonly modal?: PendingModalResult;
  focusToken?: TFocusToken;
  hasFocusToken: boolean;
}

interface ModalSettlement {
  readonly pending: PendingModalResult;
  readonly screenId: string;
  readonly result: unknown | undefined;
}

interface TransitionResult {
  readonly screenIds: string[];
  readonly settlements?: ModalSettlement[];
}

/**
 * Generic renderer-neutral stack for registered, named screens.
 *
 * `push` suspends the current screen. `replace` closes only the current screen.
 * `switch` returns to an existing entry by closing entries above it, or behaves
 * like a replacement when the registered target is not currently mounted.
 * `dismiss` can close either the active entry or a suspended entry by id.
 */
export class ScreenStack<
  TScreen extends ScreenDefinition = ScreenDefinition,
  TFocusToken = unknown,
> {
  readonly #registered = new Map<string, RegisteredScreen<TScreen>>();
  readonly #entries: ScreenStackEntry<TScreen, TFocusToken>[] = [];
  readonly #listeners = new Set<(inspection: ScreenStackInspection, change: ScreenStackChange) => void>();
  readonly #diagnosticListeners = new Set<(diagnostic: ScreenStackDiagnostic) => void>();
  readonly #diagnostics: ScreenStackDiagnostic[] = [];
  readonly #options: ScreenStackOptions<TScreen, TFocusToken>;
  readonly #maxDiagnostics: number;
  readonly #now: () => number;
  #revision = 0;
  #disposed = false;
  #transitioning = false;
  #reportingDiagnostic = false;

  constructor(
    screens: Iterable<TScreen> = [],
    options: ScreenStackOptions<TScreen, TFocusToken> = {},
  ) {
    this.#options = options;
    this.#maxDiagnostics = Math.max(0, Math.floor(options.maxDiagnostics ?? 100));
    this.#now = options.now ?? Date.now;
    this.registerAll(screens);
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get revision(): number {
    return this.#revision;
  }

  /** Registers one named screen. Duplicate and empty ids are diagnosed. */
  register(screen: TScreen): boolean {
    if (!this.#available("register", screen.id)) return false;
    const id = normalizeScreenId(screen.id);
    if (!id || id !== screen.id) {
      this.#report(
        "invalid-screen",
        "register",
        id || undefined,
        "screen id must be non-empty and contain no surrounding whitespace",
      );
      return false;
    }
    if (this.#registered.has(id)) {
      this.#report("duplicate-screen", "register", id, `screen ${id} is already registered`);
      return false;
    }

    this.#registered.set(id, { id, definition: screen });
    this.#publish("register", this.#activeId(), [id]);
    return true;
  }

  /** Registers every screen and returns the number accepted. */
  registerAll(screens: Iterable<TScreen>): number {
    let registered = 0;
    for (const screen of screens) {
      if (this.register(screen)) registered += 1;
    }
    return registered;
  }

  /** Unregisters an unmounted screen without reviving or disposing stack entries. */
  unregister(screenId: string): boolean {
    if (!this.#available("unregister", screenId)) return false;
    const id = normalizeScreenId(screenId);
    if (!this.#registered.has(id)) {
      this.#report("unknown-screen", "unregister", id, `screen ${displayScreenId(id)} is not registered`);
      return false;
    }
    if (this.#entryIndex(id) >= 0) {
      this.#report("screen-active", "unregister", id, `screen ${id} must be dismissed before unregistering`);
      return false;
    }

    const previousActiveScreenId = this.#activeId();
    this.#registered.delete(id);
    this.#publish("unregister", previousActiveScreenId, [id]);
    return true;
  }

  get(screenId: string): TScreen | undefined {
    return this.#registered.get(normalizeScreenId(screenId))?.definition;
  }

  has(screenId: string): boolean {
    return this.#registered.has(normalizeScreenId(screenId));
  }

  active(): TScreen | undefined {
    return this.#entries.at(-1)?.registered.definition;
  }

  registeredIds(): readonly string[] {
    return Object.freeze([...this.#registered.keys()]);
  }

  stackIds(): readonly string[] {
    return Object.freeze(this.#entries.map((entry) => entry.registered.id));
  }

  /** Pushes a registered screen and suspends the previous active entry. */
  push(screenId: string): boolean {
    const registered = this.#screenFor("push", screenId);
    if (!registered) return false;
    if (this.#entryIndex(registered.id) >= 0) {
      this.#report("duplicate-screen", "push", registered.id, `screen ${registered.id} is already in the stack`);
      return false;
    }
    return this.#pushKnown(registered);
  }

  /**
   * Pushes a modal entry and returns its typed result promise.
   *
   * `pop(value)` and `dismiss(id, value)` settle with `value`. Replacement,
   * switching, disposal, and result-less closes settle with `undefined`.
   */
  pushModal<TResult>(
    screenId: string,
    onResult?: ScreenModalResultCallback<TResult>,
  ): Promise<TResult | undefined> {
    let resolveResult!: (result: TResult | undefined) => void;
    const promise = new Promise<TResult | undefined>((resolve) => {
      resolveResult = resolve;
    });
    const pending: PendingModalResult = {
      resolve: resolveResult as (result: unknown | undefined) => void,
      callback: onResult as ScreenModalResultCallback<unknown> | undefined,
      settled: false,
    };

    const registered = this.#screenFor("push", screenId);
    if (!registered) {
      this.#settle(pending, undefined, this.inspect(), "push", normalizeScreenId(screenId));
      return promise;
    }
    if (this.#entryIndex(registered.id) >= 0) {
      this.#report("duplicate-screen", "push", registered.id, `screen ${registered.id} is already in the stack`);
      this.#settle(pending, undefined, this.inspect(), "push", registered.id);
      return promise;
    }

    this.#pushKnown(registered, pending);
    return promise;
  }

  /** Closes the active entry and resumes the one below it, if present. */
  pop<TResult>(result?: TResult): boolean {
    if (!this.#available("pop")) return false;
    const current = this.#entries.at(-1);
    if (!current) {
      this.#report("empty-stack", "pop", undefined, "cannot pop an empty screen stack");
      return false;
    }
    return this.#popKnown("pop", result);
  }

  /** Replaces only the active entry; replacing an empty stack behaves like push. */
  replace(screenId: string): boolean {
    const registered = this.#screenFor("replace", screenId);
    if (!registered) return false;
    const existingIndex = this.#entryIndex(registered.id);
    if (existingIndex >= 0 && existingIndex !== this.#entries.length - 1) {
      this.#report(
        "duplicate-screen",
        "replace",
        registered.id,
        `screen ${registered.id} is already suspended in the stack; use switch instead`,
      );
      return false;
    }
    return this.#replaceKnown(registered, "replace");
  }

  /**
   * Switches to a registered screen.
   *
   * An existing entry is revealed by closing entries above it. A registered
   * but unmounted screen replaces the active entry. Switching to the already
   * active screen is a successful no-op.
   */
  switch(screenId: string): boolean {
    const registered = this.#screenFor("switch", screenId);
    if (!registered) return false;
    const targetIndex = this.#entryIndex(registered.id);
    if (targetIndex < 0) return this.#replaceKnown(registered, "switch");
    if (targetIndex === this.#entries.length - 1) return true;

    return this.#transition("switch", registered.id, (previousActiveScreenId) => {
      const removed = this.#entries.splice(targetIndex + 1);
      const target = this.#entries[targetIndex]!;
      const activeScreenId = target.registered.id;
      const depth = this.#entries.length;
      const settlements: ModalSettlement[] = [];
      const screenIds: string[] = [];

      for (let index = removed.length - 1; index >= 0; index -= 1) {
        const entry = removed[index]!;
        screenIds.push(entry.registered.id);
        this.#invokeLifecycle(entry, "close", "switch", previousActiveScreenId, activeScreenId, depth);
        collectModalSettlement(settlements, entry, undefined);
      }
      screenIds.push(activeScreenId);
      const resumeEvent = this.#invokeLifecycle(
        target,
        "resume",
        "switch",
        previousActiveScreenId,
        activeScreenId,
        depth,
      );
      this.#restoreFocus(target, resumeEvent);
      this.#invokeLifecycle(target, "focus", "switch", previousActiveScreenId, activeScreenId, depth);
      return { screenIds, settlements };
    });
  }

  /** Closes a mounted entry by id, including a suspended modal. */
  dismiss<TResult>(screenId: string, result?: TResult): boolean {
    const registered = this.#screenFor("dismiss", screenId);
    if (!registered) return false;
    const index = this.#entryIndex(registered.id);
    if (index < 0) {
      this.#report("screen-not-active", "dismiss", registered.id, `screen ${registered.id} is not in the stack`);
      return false;
    }
    if (index === this.#entries.length - 1) return this.#popKnown("dismiss", result);

    return this.#transition("dismiss", registered.id, (previousActiveScreenId) => {
      const [entry] = this.#entries.splice(index, 1);
      const activeScreenId = this.#activeId();
      this.#invokeLifecycle(
        entry!,
        "close",
        "dismiss",
        previousActiveScreenId,
        activeScreenId,
        this.#entries.length,
      );
      const settlements: ModalSettlement[] = [];
      collectModalSettlement(settlements, entry!, result);
      return { screenIds: [registered.id], settlements };
    });
  }

  /** Subscribes to successful mutations. Each callback receives frozen values. */
  subscribe(listener: (inspection: ScreenStackInspection, change: ScreenStackChange) => void): () => void {
    if (this.#disposed) return noop;
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Subscribes to structured diagnostics without coupling them to rendering. */
  onDiagnostic(listener: (diagnostic: ScreenStackDiagnostic) => void): () => void {
    if (this.#disposed) return noop;
    this.#diagnosticListeners.add(listener);
    return () => this.#diagnosticListeners.delete(listener);
  }

  diagnostics(): readonly ScreenStackDiagnostic[] {
    return Object.freeze(this.#diagnostics.slice());
  }

  inspect(): ScreenStackInspection {
    const lastIndex = this.#entries.length - 1;
    const entries = Object.freeze(this.#entries.map((entry, index) =>
      Object.freeze({
        id: entry.registered.id,
        title: entry.registered.definition.title,
        modal: entry.modal !== undefined,
        state: index === lastIndex ? "active" as const : "suspended" as const,
        hasFocusToken: entry.hasFocusToken,
      })
    ));
    const registeredScreenIds = Object.freeze([...this.#registered.keys()]);
    const diagnostics = Object.freeze(this.#diagnostics.slice());
    return Object.freeze({
      disposed: this.#disposed,
      revision: this.#revision,
      registeredCount: registeredScreenIds.length,
      registeredScreenIds,
      depth: entries.length,
      activeScreenId: this.#activeId(),
      entries,
      diagnosticCount: diagnostics.length,
      diagnostics,
      lastDiagnostic: diagnostics.at(-1),
    });
  }

  /** Closes every entry top-down, settles modal promises, and releases observers. */
  dispose(): void {
    if (this.#disposed) return;
    if (this.#transitioning) {
      this.#report("reentrant-transition", "dispose", undefined, "cannot dispose during a screen transition");
      return;
    }

    const previousActiveScreenId = this.#activeId();
    const removed = this.#entries.splice(0);
    const screenIds: string[] = [];
    const settlements: ModalSettlement[] = [];
    this.#transitioning = true;
    this.#disposed = true;
    this.#registered.clear();
    try {
      for (let index = removed.length - 1; index >= 0; index -= 1) {
        const entry = removed[index]!;
        screenIds.push(entry.registered.id);
        this.#invokeLifecycle(entry, "close", "dispose", previousActiveScreenId, undefined, 0);
        collectModalSettlement(settlements, entry, undefined);
      }
    } finally {
      this.#transitioning = false;
    }

    const inspection = this.#publish("dispose", previousActiveScreenId, screenIds);
    this.#settleAll(settlements, inspection, "dispose");
    this.#listeners.clear();
    this.#diagnosticListeners.clear();
  }

  #pushKnown(registered: RegisteredScreen<TScreen>, modal?: PendingModalResult): boolean {
    return this.#transition("push", registered.id, (previousActiveScreenId) => {
      const previous = this.#entries.at(-1);
      const entry: ScreenStackEntry<TScreen, TFocusToken> = {
        registered,
        modal,
        hasFocusToken: false,
      };
      this.#entries.push(entry);
      const depth = this.#entries.length;
      if (previous) {
        const suspendEvent = this.#event(
          previous,
          "suspend",
          "push",
          previousActiveScreenId,
          registered.id,
          depth,
        );
        this.#captureFocus(previous, suspendEvent);
        this.#invokeLifecycleEvent(previous, suspendEvent);
      }
      this.#invokeLifecycle(entry, "mount", "push", previousActiveScreenId, registered.id, depth);
      this.#invokeLifecycle(entry, "focus", "push", previousActiveScreenId, registered.id, depth);
      return { screenIds: previous ? [previous.registered.id, registered.id] : [registered.id] };
    });
  }

  #popKnown(operation: "pop" | "dismiss", result: unknown): boolean {
    const requestedScreenId = this.#entries.at(-1)!.registered.id;
    return this.#transition(operation, requestedScreenId, (previousActiveScreenId) => {
      const entry = this.#entries.pop()!;
      const resumed = this.#entries.at(-1);
      const activeScreenId = resumed?.registered.id;
      const depth = this.#entries.length;
      const screenIds = [entry.registered.id];
      const settlements: ModalSettlement[] = [];

      this.#invokeLifecycle(entry, "close", operation, previousActiveScreenId, activeScreenId, depth);
      collectModalSettlement(settlements, entry, result);
      if (resumed) {
        screenIds.push(resumed.registered.id);
        const resumeEvent = this.#invokeLifecycle(
          resumed,
          "resume",
          operation,
          previousActiveScreenId,
          activeScreenId,
          depth,
        );
        this.#restoreFocus(resumed, resumeEvent);
        this.#invokeLifecycle(resumed, "focus", operation, previousActiveScreenId, activeScreenId, depth);
      }
      return { screenIds, settlements };
    });
  }

  #replaceKnown(registered: RegisteredScreen<TScreen>, operation: "replace" | "switch"): boolean {
    return this.#transition(operation, registered.id, (previousActiveScreenId) => {
      const previous = this.#entries.pop();
      const entry: ScreenStackEntry<TScreen, TFocusToken> = {
        registered,
        hasFocusToken: false,
      };
      this.#entries.push(entry);
      const depth = this.#entries.length;
      const settlements: ModalSettlement[] = [];
      const screenIds: string[] = [];

      if (previous) {
        screenIds.push(previous.registered.id);
        this.#invokeLifecycle(previous, "close", operation, previousActiveScreenId, registered.id, depth);
        collectModalSettlement(settlements, previous, undefined);
      }
      screenIds.push(registered.id);
      this.#invokeLifecycle(entry, "mount", operation, previousActiveScreenId, registered.id, depth);
      this.#invokeLifecycle(entry, "focus", operation, previousActiveScreenId, registered.id, depth);
      return { screenIds, settlements };
    });
  }

  #transition(
    operation: "push" | "pop" | "replace" | "switch" | "dismiss",
    requestedScreenId: string,
    mutate: (previousActiveScreenId: string | undefined) => TransitionResult,
  ): boolean {
    if (!this.#available(operation, requestedScreenId)) return false;
    const previousActiveScreenId = this.#activeId();
    let result: TransitionResult;
    this.#transitioning = true;
    try {
      result = mutate(previousActiveScreenId);
    } finally {
      this.#transitioning = false;
    }
    const inspection = this.#publish(operation, previousActiveScreenId, result.screenIds);
    this.#settleAll(result.settlements ?? [], inspection, operation);
    return true;
  }

  #available(operation: ScreenStackOperation, screenId?: string): boolean {
    if (this.#disposed) {
      this.#report("disposed", operation, normalizedOptionalId(screenId), "screen stack is disposed");
      return false;
    }
    if (this.#transitioning) {
      this.#report(
        "reentrant-transition",
        operation,
        normalizedOptionalId(screenId),
        "screen transitions cannot be nested inside lifecycle or focus hooks",
      );
      return false;
    }
    return true;
  }

  #screenFor(operation: ScreenStackOperation, screenId: string): RegisteredScreen<TScreen> | undefined {
    if (!this.#available(operation, screenId)) return undefined;
    const id = normalizeScreenId(screenId);
    const registered = this.#registered.get(id);
    if (!registered) {
      this.#report("unknown-screen", operation, id, `screen ${displayScreenId(id)} is not registered`);
    }
    return registered;
  }

  #entryIndex(screenId: string): number {
    return this.#entries.findIndex((entry) => entry.registered.id === screenId);
  }

  #activeId(): string | undefined {
    return this.#entries.at(-1)?.registered.id;
  }

  #captureFocus(
    entry: ScreenStackEntry<TScreen, TFocusToken>,
    event: ScreenLifecycleEvent<TScreen>,
  ): void {
    entry.focusToken = undefined;
    entry.hasFocusToken = false;
    if (!this.#options.captureFocus) return;
    try {
      entry.focusToken = this.#options.captureFocus(event);
      entry.hasFocusToken = true;
    } catch (error) {
      this.#reportError("focus-error", event, error, "focus capture failed");
    }
  }

  #restoreFocus(
    entry: ScreenStackEntry<TScreen, TFocusToken>,
    event: ScreenLifecycleEvent<TScreen>,
  ): void {
    if (!entry.hasFocusToken) return;
    const token = entry.focusToken as TFocusToken;
    entry.focusToken = undefined;
    entry.hasFocusToken = false;
    if (!this.#options.restoreFocus) return;
    try {
      this.#options.restoreFocus(token, event);
    } catch (error) {
      this.#reportError("focus-error", event, error, "focus restoration failed");
    }
  }

  #event(
    entry: ScreenStackEntry<TScreen, TFocusToken>,
    phase: ScreenLifecyclePhase,
    operation: ScreenStackOperation,
    previousActiveScreenId: string | undefined,
    activeScreenId: string | undefined,
    depth: number,
  ): ScreenLifecycleEvent<TScreen> {
    return Object.freeze({
      phase,
      operation,
      screenId: entry.registered.id,
      screen: entry.registered.definition,
      previousActiveScreenId,
      activeScreenId,
      depth,
    });
  }

  #invokeLifecycle(
    entry: ScreenStackEntry<TScreen, TFocusToken>,
    phase: ScreenLifecyclePhase,
    operation: ScreenStackOperation,
    previousActiveScreenId: string | undefined,
    activeScreenId: string | undefined,
    depth: number,
  ): ScreenLifecycleEvent<TScreen> {
    const event = this.#event(entry, phase, operation, previousActiveScreenId, activeScreenId, depth);
    this.#invokeLifecycleEvent(entry, event);
    return event;
  }

  #invokeLifecycleEvent(
    entry: ScreenStackEntry<TScreen, TFocusToken>,
    event: ScreenLifecycleEvent<TScreen>,
  ): void {
    const callback = lifecycleCallback(entry.registered.definition, event.phase);
    for (const listener of [callback, this.#options.onLifecycle]) {
      if (!listener) continue;
      try {
        listener(event);
      } catch (error) {
        this.#reportError("lifecycle-error", event, error, `${event.phase} lifecycle callback failed`);
      }
    }
  }

  #reportError(
    code: "lifecycle-error" | "focus-error",
    event: ScreenLifecycleEvent<TScreen>,
    error: unknown,
    prefix: string,
  ): void {
    this.#report(
      code,
      event.operation,
      event.screenId,
      `${prefix}: ${errorMessage(error)}`,
      event.phase,
    );
  }

  #publish(
    operation: ScreenStackOperation,
    previousActiveScreenId: string | undefined,
    screenIds: readonly string[],
  ): ScreenStackInspection {
    this.#revision += 1;
    const inspection = this.inspect();
    const change: ScreenStackChange = Object.freeze({
      operation,
      revision: this.#revision,
      previousActiveScreenId,
      activeScreenId: inspection.activeScreenId,
      screenIds: Object.freeze(screenIds.slice()),
    });
    for (const listener of [...this.#listeners]) {
      try {
        listener(inspection, change);
      } catch {
        // Observers are advisory and cannot interrupt a committed transition.
      }
    }
    return inspection;
  }

  #settleAll(
    settlements: readonly ModalSettlement[],
    inspection: ScreenStackInspection,
    operation: ScreenStackOperation,
  ): void {
    for (const settlement of settlements) {
      this.#settle(settlement.pending, settlement.result, inspection, operation, settlement.screenId);
    }
  }

  #settle(
    pending: PendingModalResult,
    result: unknown | undefined,
    inspection: ScreenStackInspection,
    operation: ScreenStackOperation,
    screenId?: string,
  ): void {
    if (pending.settled) return;
    pending.settled = true;
    try {
      pending.callback?.(result, inspection);
    } catch (error) {
      this.#report(
        "result-callback-error",
        operation,
        screenId,
        `modal result callback failed: ${errorMessage(error)}`,
      );
    }
    pending.resolve(result);
  }

  #report(
    code: ScreenStackDiagnosticCode,
    operation: ScreenStackOperation,
    screenId: string | undefined,
    message: string,
    phase?: ScreenLifecyclePhase,
  ): ScreenStackDiagnostic {
    const diagnostic: ScreenStackDiagnostic = Object.freeze({
      code,
      operation,
      screenId: screenId || undefined,
      phase,
      message,
      timestamp: this.#now(),
    });
    if (this.#maxDiagnostics > 0) {
      this.#diagnostics.push(diagnostic);
      if (this.#diagnostics.length > this.#maxDiagnostics) {
        this.#diagnostics.splice(0, this.#diagnostics.length - this.#maxDiagnostics);
      }
    }

    if (this.#reportingDiagnostic) return diagnostic;
    this.#reportingDiagnostic = true;
    try {
      for (const listener of [this.#options.onDiagnostic, ...this.#diagnosticListeners]) {
        try {
          listener?.(diagnostic);
        } catch {
          // Diagnostic observers must not interfere with state recovery.
        }
      }
    } finally {
      this.#reportingDiagnostic = false;
    }
    return diagnostic;
  }
}

/** Creates a generic renderer-neutral screen stack. */
export function createScreenStack<
  TScreen extends ScreenDefinition = ScreenDefinition,
  TFocusToken = unknown,
>(
  screens: Iterable<TScreen> = [],
  options: ScreenStackOptions<TScreen, TFocusToken> = {},
): ScreenStack<TScreen, TFocusToken> {
  return new ScreenStack(screens, options);
}

function lifecycleCallback(
  screen: ScreenDefinition,
  phase: ScreenLifecyclePhase,
): ((event: ScreenLifecycleEvent) => void) | undefined {
  switch (phase) {
    case "mount":
      return screen.onMount;
    case "focus":
      return screen.onFocus;
    case "suspend":
      return screen.onSuspend;
    case "resume":
      return screen.onResume;
    case "close":
      return screen.onClose;
  }
}

function collectModalSettlement<TScreen extends ScreenDefinition, TFocusToken>(
  settlements: ModalSettlement[],
  entry: ScreenStackEntry<TScreen, TFocusToken>,
  result: unknown | undefined,
): void {
  if (entry.modal) settlements.push({ pending: entry.modal, screenId: entry.registered.id, result });
}

function normalizeScreenId(screenId: string): string {
  return screenId.trim();
}

function normalizedOptionalId(screenId: string | undefined): string | undefined {
  if (screenId === undefined) return undefined;
  return normalizeScreenId(screenId) || undefined;
}

function displayScreenId(screenId: string): string {
  return screenId || "<empty>";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function noop(): void {}
