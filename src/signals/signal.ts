// Copyright 2023 Im-Beast. MIT license.
import { activeSignals } from "./dependency_tracking.ts";
import {
  IS_REACTIVE,
  makeMapMethodsReactive,
  makeObjectPropertiesReactive,
  makeSetMethodsReactive,
  ORIGINAL_REF,
  Reactive,
} from "./reactivity.ts";
import { Dependant, Dependency, Subscription } from "./types.ts";

/** Thrown whenever `deepObserve` is set and `typeof value !== "object"` */
export class SignalDeepObserveTypeofError extends Error {
  constructor() {
    super("You can only deeply observe value with typeof 'object'");
  }
}

/** Thrown when a signal graph recursively updates the same signal during one propagation pass. */
export class SignalRecursiveUpdateError extends Error {
  readonly path: string[];

  constructor(path: readonly string[]) {
    super(`Recursive signal propagation detected: ${path.join(" -> ")}`);
    this.name = "SignalRecursiveUpdateError";
    this.path = [...path];
  }
}

/** Options for configuring signal. */
export interface SignalOptions<T> {
  /**
   * @requires T to be `typeof 'object'`
   *
   * Whether to deeply observe object a.k.a. whether to watch changes in its properties.
   */
  deepObserve?: boolean;
  /**
   * @requires T to be `typeof 'object'`
   *
   * Changes the way `deepObserve` affects objects.
   *
   *  - When set to `true` it creates `Proxy` which watches properties, even new ones.
   *  - When set to `false` it uses `Object.defineProperty` to watch properties that existed at the time of creating signal.
   */
  watchObjectIndex?: T extends Map<unknown, unknown> | Set<unknown> ? never : boolean;
  /**
   * @requires T to be `instanceof Map`
   *
   * Changes method of detecting value changes when `.set()` gets called.
   *
   *  - When set to `true` it checks whether value changed.
   *  - When set to `false` it checks whether map size changed (default).
   */
  watchMapUpdates?: T extends Map<unknown, unknown> ? boolean : never;
}

/** Serializable lifecycle and subscription diagnostics for a signal. */
export interface SignalInspection {
  disposed: boolean;
  subscriptions: number;
  whenSubscriptions: number;
  dependants: number;
  reactive: boolean;
}

/** Serializable inspection snapshot for a scheduled signal batch. */
export interface SignalBatchSchedulerInspection {
  scheduled: boolean;
  pending: number;
  flushed: number;
  cancelled: number;
}

/** Options for coalescing signal mutations into one scheduled batch. */
export interface SignalBatchSchedulerOptions {
  queueMicrotask?: (callback: () => void) => void;
  onError?: (error: unknown) => void;
}

const MAX_PROPAGATION_REENTRY = 32;
const activePropagationCounts = new Map<object, number>();
const propagationStack: object[] = [];
let signalBatchDepth = 0;
let flushingSignalBatch = false;
interface SignalBatchTarget {
  propagate(): void;
}
const batchedSignals = new Set<SignalBatchTarget>();

/** Runs signal mutations as one propagation batch flushed after the outermost callback exits. */
export function batchSignalUpdates<T>(callback: () => T): T {
  signalBatchDepth += 1;
  try {
    return callback();
  } finally {
    signalBatchDepth -= 1;
    if (signalBatchDepth === 0) {
      flushSignalBatch();
    }
  }
}

/** Returns whether signal propagation is currently deferred inside a batch. */
export function isSignalBatching(): boolean {
  return signalBatchDepth > 0;
}

/** Coalesces arbitrary signal mutations into one future `batchSignalUpdates()` flush. */
export class SignalBatchScheduler {
  readonly #queueMicrotask: (callback: () => void) => void;
  readonly #onError?: (error: unknown) => void;
  #scheduled = false;
  #callbacks = new Set<() => void>();
  #flushed = 0;
  #cancelled = 0;

  constructor(options: SignalBatchSchedulerOptions = {}) {
    this.#queueMicrotask = options.queueMicrotask ?? queueMicrotask;
    this.#onError = options.onError;
  }

  get scheduled(): boolean {
    return this.#scheduled;
  }

  schedule(callback: () => void): boolean {
    this.#callbacks.add(callback);
    if (this.#scheduled) return false;
    this.#scheduled = true;
    this.#queueMicrotask(() => this.#flush());
    return true;
  }

  flush(): boolean {
    if (!this.#scheduled) return false;
    this.#flush();
    return true;
  }

  cancel(): boolean {
    if (!this.#scheduled) return false;
    this.#scheduled = false;
    this.#callbacks.clear();
    this.#cancelled += 1;
    return true;
  }

  inspect(): SignalBatchSchedulerInspection {
    return {
      scheduled: this.#scheduled,
      pending: this.#callbacks.size,
      flushed: this.#flushed,
      cancelled: this.#cancelled,
    };
  }

  #flush(): void {
    if (!this.#scheduled) return;
    const callbacks = [...this.#callbacks];
    this.#scheduled = false;
    this.#callbacks.clear();
    this.#flushed += 1;
    try {
      batchSignalUpdates(() => {
        for (const callback of callbacks) {
          callback();
        }
      });
    } catch (error) {
      this.#onError?.(error);
      if (!this.#onError) throw error;
    }
  }
}

function flushSignalBatch(): void {
  if (flushingSignalBatch || batchedSignals.size === 0) return;
  flushingSignalBatch = true;
  try {
    while (batchedSignals.size > 0) {
      const signals = [...batchedSignals];
      batchedSignals.clear();
      for (const signal of signals) {
        signal.propagate();
      }
    }
  } finally {
    flushingSignalBatch = false;
  }
}

/**
 * Signal wraps value in a container.
 *
 * Each time you set the value it analyzes whether it changed and propagates update over all of its dependants.
 *
 * @example
 * ```ts
 * const number = new Signal(0);
 * number.value++;
 * console.log(number.value); // 1
 * ```
 */
export class Signal<T> implements Dependency {
  protected $value: T;

  // Dependant: something that depends on THIS
  dependants?: Set<Dependant>;
  subscriptions?: Set<Subscription<T>>;
  whenSubscriptions?: Map<T, Set<Subscription<T>>>;

  forceUpdateValue?: boolean;
  disposed = false;

  constructor(value: T, options?: SignalOptions<T>) {
    if (options?.deepObserve) {
      if (typeof value !== "object") throw new SignalDeepObserveTypeofError();

      if (value instanceof Set) {
        value = makeSetMethodsReactive(value, this);
      } else if (value instanceof Map) {
        value = makeMapMethodsReactive(value, this, options.watchMapUpdates);
      } else {
        value = makeObjectPropertiesReactive(value, this, options.watchObjectIndex);
      }
    }
    this.$value = value;
  }

  /** Bind function to signal, it'll be called each time signal's value changes and is equal to {conditionValues} */
  when(conditionValue: T, subscription: Subscription<T>, abortSignal?: AbortSignal): void {
    this.whenSubscriptions ??= new Map();

    const { whenSubscriptions } = this;
    let set = whenSubscriptions.get(conditionValue);

    if (!set) {
      set = new Set<Subscription<T>>().add(subscription);
      whenSubscriptions.set(conditionValue, set);
    } else {
      set.add(subscription);
    }

    abortSignal?.addEventListener("abort", () => {
      set?.delete(subscription);
    });
  }

  /** Unbind function from signal that has been previously set with `Signal.when` */
  drop(conditionValue: T, subscription: Subscription<T>): void {
    const set = this.whenSubscriptions?.get(conditionValue);
    set?.delete(subscription);
  }

  /** Bind function to signal, it'll be called each time signal's value changes with current value as argument */
  subscribe(subscription: Subscription<T>, abortSignal?: AbortSignal): void {
    this.subscriptions ??= new Set();
    this.subscriptions.add(subscription);

    abortSignal?.addEventListener("abort", () => {
      this.subscriptions?.delete(subscription);
    });
  }

  /** Unbind function from signal that has been previously set with `Signal.subscribe` */
  unsubscribe(subscription: Subscription<T>): void {
    this.subscriptions?.delete(subscription);
  }

  /** Returns signal lifecycle and listener diagnostics. */
  inspect(): SignalInspection {
    return {
      disposed: this.disposed,
      subscriptions: this.subscriptions?.size ?? 0,
      whenSubscriptions: [...(this.whenSubscriptions?.values() ?? [])].reduce((count, set) => count + set.size, 0),
      dependants: this.dependants?.size ?? 0,
      reactive: typeof this.$value === "object" && this.$value !== null && IS_REACTIVE in this.$value,
    };
  }

  /** Add `dependant` to signal `dependants` */
  depend(dependant: Dependant): void {
    this.dependants ??= new Set();
    this.dependants.add(dependant);
  }

  /**
   * - Run all linked subscriptions
   * - Update each dependant in `dependants`
   */
  propagate(cause?: Dependency | Dependant): void {
    if (signalBatchDepth > 0 && !flushingSignalBatch) {
      batchedSignals.add(this);
      return;
    }

    const exitPropagation = enterPropagation(this);
    const { subscriptions, whenSubscriptions, dependants } = this;

    try {
      const value = this.$value;

      if (subscriptions?.size) {
        for (const subscription of subscriptions) {
          subscription(value);
        }
      }

      const valueSubscriptions = whenSubscriptions?.get(value);
      if (valueSubscriptions) {
        for (const subscription of valueSubscriptions) {
          subscription(value);
        }
      }

      if (!dependants?.size) return;

      for (const dependant of dependants) {
        if ("forceUpdateValue" in dependant) {
          dependant.forceUpdateValue = true;
        }
        dependant.update(cause ?? this);
      }
    } finally {
      exitPropagation();
    }
  }

  /**
   * - Overwrites signal's `value` getter with current value
   * - Removes all subscriptions
   * - Removes itself from all dependants dependencies
   * - If any of the dependant doesn't have any other dependencies it gets disposed
   * - Clears dependants
   */
  dispose(): void {
    let { $value } = this;
    this.disposed = true;

    // Set $value to its original reference to make next property accessess faster
    if (typeof $value === "object" && $value !== null) {
      $value = ($value as Reactive<T>)?.[ORIGINAL_REF] ?? $value;
    }
    this.$value = $value;

    Object.defineProperty(this, "value", {
      value: $value,
    });

    const { dependants, subscriptions, whenSubscriptions } = this;

    subscriptions?.clear();
    whenSubscriptions?.clear();

    if (!dependants) return;
    for (const dependant of [...dependants]) {
      dependants.delete(dependant);
      dependant.dependencies.delete(this);

      // If dependant has no more dependencies then
      // it means that it should be replaced with constant value,
      // because nothing can update its value anymore
      if (!dependant.dependencies) {
        dependant.dispose();
      }
    }
  }

  get value(): T {
    activeSignals?.add(this);
    return this.$value;
  }

  set value(value) {
    activeSignals?.add(this);

    if (this.$value !== (this.$value = value) || this.forceUpdateValue) {
      this.propagate();
    }
  }

  /** Gets signals value without being appended as dependency */
  peek(): T {
    return this.$value;
  }

  /** Sets signals value without being appended as dependency */
  jink(value: T): void {
    this.$value = value;
  }

  valueOf(): T {
    return this.$value;
  }

  toString(): string {
    return `${this.$value}`;
  }
}

/**
 * Type that defines signal, which doesn't implement any properties that `T` type has.
 * This is used to enhance DX for typing unions between objects and Signals.
 *
 * @example
 * ```ts
 * // Don't do that! Autocomplete shows properties of both `Dog` and `SignalDog`
 * type Dog = { notHuman: true };
 * type SuperDog = Dog | Signal<Dog>;
 *
 * // Do this instead
 * type SuperDuperDog = Dog | SignalOfObject<Dog>;
 * ```
 *
 * It doesn't matter on primitive types though
 * @example
 * ```ts
 * // These would be exactly the same from DX standpoint
 * type Foo = number | Signal<number>;
 * type Bar = number | SignalOfObject<number>;
 * ```
 */
export type SignalOfObject<T> = Signal<T> & { [key in keyof T]?: never };

function enterPropagation(node: object): () => void {
  const activeCount = activePropagationCounts.get(node) ?? 0;
  if (activeCount >= MAX_PROPAGATION_REENTRY) {
    throw new SignalRecursiveUpdateError([...propagationStack, node].map(formatPropagationNode));
  }

  activePropagationCounts.set(node, activeCount + 1);
  propagationStack.push(node);

  return () => {
    propagationStack.pop();
    const nextCount = (activePropagationCounts.get(node) ?? 1) - 1;
    if (nextCount <= 0) {
      activePropagationCounts.delete(node);
    } else {
      activePropagationCounts.set(node, nextCount);
    }
  };
}

function formatPropagationNode(node: object): string {
  return node.constructor?.name || "unknown";
}
