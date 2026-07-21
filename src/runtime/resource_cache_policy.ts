// Copyright 2023 Im-Beast. MIT license.

import { MAX_MONOTONIC_TIME, type TimerScheduler } from "./clock.ts";

/** Temporal policy options shared by resource cache coordinators. */
export interface ResourceCacheTemporalPolicyOptions {
  /**
   * Caller-owned monotonic scheduler used by finite freshness and retention
   * policies. A coordinator cancels its handles but never disposes it.
   */
  readonly scheduler?: TimerScheduler;
  /** Milliseconds for which newly published data is fresh. Defaults to Infinity. */
  readonly staleTimeMs?: number;
  /** Milliseconds to retain an entry after its final owner releases it. Defaults to zero. */
  readonly retentionTimeMs?: number;
  /** Request stale owned entries when the coordinator receives a focus signal. */
  readonly refreshOnFocus?: boolean;
  /** Request stale owned entries when the coordinator receives a reconnect signal. */
  readonly refreshOnReconnect?: boolean;
}

/** Origin of a stale-while-revalidate refresh request. */
export type ResourceCacheRefreshTrigger = "manual" | "focus" | "reconnect";

/** Clone-safe temporal policy state for one entry. */
export interface ResourceCacheEntryPolicyInspection {
  /** Whether the currently published value has reached its stale deadline. */
  readonly stale: boolean;
  /** Whether usable data is being retained during a refresh request. */
  readonly refreshing: boolean;
  /** Whether the entry currently has no owners and is awaiting retention expiry. */
  readonly retained: boolean;
  /** Monotonic time at which the current value was published. */
  readonly updatedAtMs?: number;
  /** Monotonic deadline at which the current value becomes stale; absent means never. */
  readonly staleAtMs?: number;
  /** Monotonic time at which the final owner released the entry. */
  readonly retainedAtMs?: number;
  /** Monotonic eviction deadline; absent while retention is infinite. */
  readonly retainedUntilMs?: number;
  /** Trigger for the active refresh request, when requested through its coordinator. */
  readonly refreshTrigger?: ResourceCacheRefreshTrigger;
}

/** Clone-safe coordinator-wide temporal policy configuration and counters. */
export interface ResourceCachePolicyInspection {
  readonly staleTimeMs: number;
  readonly retentionTimeMs: number;
  readonly refreshOnFocus: boolean;
  readonly refreshOnReconnect: boolean;
  readonly staleEntries: number;
  readonly refreshingEntries: number;
  readonly retainedEntries: number;
  readonly staleTransitions: number;
  readonly refreshRequests: number;
  readonly clockRegressions: number;
}

/** @internal Fully snapshotted temporal policy configuration. */
export interface ResolvedResourceCachePolicy {
  readonly enabled: boolean;
  readonly scheduler?: ResourceCacheSchedulerCapabilities;
  readonly staleTimeMs: number;
  readonly retentionTimeMs: number;
  readonly refreshOnFocus: boolean;
  readonly refreshOnReconnect: boolean;
}

/** @internal Immutable bound capabilities required from an injected scheduler. */
export interface ResourceCacheSchedulerCapabilities {
  now(): unknown;
  scheduleAt(deadlineMs: number, callback: () => unknown): unknown;
}

/** @internal Immutable bound cancellation capability for one timer registration. */
export interface ResourceCacheTimerCancellation {
  cancel(): unknown;
}

/** @internal Snapshots and validates temporal policy fields without invoking accessors. */
export function resolveResourceCachePolicy(
  options: ResourceCacheTemporalPolicyOptions,
): ResolvedResourceCachePolicy {
  const schedulerOption = temporalOption(options, "scheduler");
  const staleTimeOption = temporalOption(options, "staleTimeMs");
  const retentionTimeOption = temporalOption(options, "retentionTimeMs");
  const focusOption = temporalOption(options, "refreshOnFocus");
  const reconnectOption = temporalOption(options, "refreshOnReconnect");
  const staleTimeMs = validateTemporalDuration(staleTimeOption.value ?? Number.POSITIVE_INFINITY, "staleTimeMs");
  const retentionTimeMs = validateTemporalDuration(retentionTimeOption.value ?? 0, "retentionTimeMs");
  const refreshOnFocus = validatePolicyBoolean(focusOption.value ?? false, "refreshOnFocus");
  const refreshOnReconnect = validatePolicyBoolean(reconnectOption.value ?? false, "refreshOnReconnect");
  const scheduler = schedulerOption.value === undefined
    ? undefined
    : snapshotSchedulerCapabilities(schedulerOption.value);
  if (
    (Number.isFinite(staleTimeMs) || (Number.isFinite(retentionTimeMs) && retentionTimeMs > 0)) &&
    scheduler === undefined
  ) {
    throw new TypeError("Finite resource cache stale or retention time requires a scheduler.");
  }
  return Object.freeze({
    enabled: schedulerOption.present || staleTimeOption.present || retentionTimeOption.present ||
      focusOption.present || reconnectOption.present,
    scheduler,
    staleTimeMs,
    retentionTimeMs,
    refreshOnFocus,
    refreshOnReconnect,
  });
}

/** @internal Snapshots a timer handle's cancellation data method without invoking accessors. */
export function snapshotResourceCacheTimerCancellation(
  value: unknown,
): ResourceCacheTimerCancellation {
  const cancel = snapshotDataMethod(value, "cancel", "timer handle");
  return Object.freeze({
    cancel: () => invokeDataMethod(cancel, value, [], "Resource cache timer cancellation failed."),
  });
}

/** @internal Validates a public refresh trigger. */
export function validateResourceCacheRefreshTrigger(
  trigger: ResourceCacheRefreshTrigger,
): ResourceCacheRefreshTrigger {
  if (trigger !== "manual" && trigger !== "focus" && trigger !== "reconnect") {
    throw new TypeError("Unsupported resource cache refresh trigger.");
  }
  return trigger;
}

/** @internal Adds a duration without leaving the scheduler's valid clock domain. */
export function addResourceCacheMonotonicDuration(now: number, duration: number): number {
  return duration > MAX_MONOTONIC_TIME - now ? MAX_MONOTONIC_TIME : now + duration;
}

/** @internal Advances a bounded timer generation while reserving zero. */
export function nextResourceCacheTimerGeneration(generation: number): number {
  return generation === Number.MAX_SAFE_INTEGER ? 1 : generation + 1;
}

function temporalOption(
  options: ResourceCacheTemporalPolicyOptions,
  key: keyof ResourceCacheTemporalPolicyOptions,
): { readonly present: boolean; readonly value: unknown } {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(options, key);
  } catch {
    throw new TypeError("Resource cache temporal options are not safely inspectable.");
  }
  if (!descriptor) return { present: false, value: undefined };
  if (!("value" in descriptor)) {
    throw new TypeError(`Resource cache ${key} must be a data property.`);
  }
  return { present: true, value: descriptor.value };
}

function validateTemporalDuration(value: unknown, name: string): number {
  if (
    typeof value !== "number" || Number.isNaN(value) || value < 0 ||
    (value !== Number.POSITIVE_INFINITY && (!Number.isFinite(value) || value > MAX_MONOTONIC_TIME))
  ) {
    throw new RangeError(`${name} must be non-negative, at most ${MAX_MONOTONIC_TIME}, or Infinity.`);
  }
  return value;
}

function validatePolicyBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean.`);
  return value;
}

function snapshotSchedulerCapabilities(value: unknown): ResourceCacheSchedulerCapabilities {
  const now = snapshotDataMethod(value, "now", "scheduler");
  const scheduleAt = snapshotDataMethod(value, "scheduleAt", "scheduler");
  return Object.freeze({
    now: () => invokeDataMethod(now, value, [], "Resource cache scheduler now() failed."),
    scheduleAt: (deadlineMs: number, callback: () => unknown) =>
      invokeDataMethod(
        scheduleAt,
        value,
        [deadlineMs, callback],
        "Resource cache scheduler scheduleAt() failed.",
      ),
  });
}

function snapshotDataMethod(
  target: unknown,
  key: string,
  scope: "scheduler" | "timer handle",
): (...args: unknown[]) => unknown {
  if (target === null || (typeof target !== "object" && typeof target !== "function")) {
    throw new TypeError(`Resource cache ${scope} must expose a ${key} data method.`);
  }
  const seen = new Set<object>();
  let current: object | null = target;
  for (let depth = 0; current !== null && depth < 64; depth += 1) {
    if (seen.has(current)) {
      throw new TypeError(`Resource cache ${scope} prototype chain is cyclic.`);
    }
    seen.add(current);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(current, key);
    } catch {
      throw new TypeError(`Resource cache ${scope} ${key} capability is not safely inspectable.`);
    }
    if (descriptor !== undefined) {
      if (!("value" in descriptor) || typeof descriptor.value !== "function") {
        throw new TypeError(`Resource cache ${scope} must expose a ${key} data method.`);
      }
      return descriptor.value as (...args: unknown[]) => unknown;
    }
    try {
      current = Object.getPrototypeOf(current);
    } catch {
      throw new TypeError(`Resource cache ${scope} prototype chain is not safely inspectable.`);
    }
  }
  throw new TypeError(`Resource cache ${scope} must expose a ${key} data method.`);
}

function invokeDataMethod(
  method: (...args: unknown[]) => unknown,
  receiver: unknown,
  args: readonly unknown[],
  failureMessage: string,
): unknown {
  try {
    return Reflect.apply(method, receiver, args);
  } catch {
    throw new TypeError(failureMessage);
  }
}
