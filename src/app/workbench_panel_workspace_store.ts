// Copyright 2023 Im-Beast. MIT license.

import type { AsyncStore } from "../runtime/storage.ts";
import type { StorageFallbackDiagnosticInput } from "../runtime/storage_diagnostics.ts";

/** Minimal synchronous key/value cache used for browser panel workspace snapshots. */
export interface WorkbenchPanelWorkspaceCache {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Diagnostic sink compatible with StorageFallbackDiagnostics. */
export interface WorkbenchPanelWorkspaceStorageDiagnostics {
  report(input: StorageFallbackDiagnosticInput): unknown;
}

/** Options for loading a cached panel workspace state. */
export interface LoadWorkbenchPanelWorkspaceCacheOptions<TState> {
  key: string;
  cache?: WorkbenchPanelWorkspaceCache | null;
  normalize: (value: unknown) => TState;
  fallback: TState;
  diagnostics?: WorkbenchPanelWorkspaceStorageDiagnostics;
  diagnosticSource?: string;
}

/** Options for hydrating a panel workspace state from async storage. */
export interface HydrateWorkbenchPanelWorkspaceStoreOptions<TState> {
  key: string;
  store: AsyncStore<TState>;
  normalize: (value: unknown) => TState;
  apply: (state: TState) => void;
  diagnostics?: WorkbenchPanelWorkspaceStorageDiagnostics;
  diagnosticSource?: string;
  storageLabel?: string;
}

/** Options for persisting a panel workspace snapshot to cache and async storage. */
export interface PersistWorkbenchPanelWorkspaceStateOptions<TState> {
  cacheKey: string;
  storeKey: string;
  cache?: WorkbenchPanelWorkspaceCache | null;
  store?: AsyncStore<TState>;
  diagnostics?: WorkbenchPanelWorkspaceStorageDiagnostics;
  diagnosticSource?: string;
  cacheStorageLabel?: string;
  storeStorageLabel?: string;
}

/** Loads a cached panel workspace snapshot from synchronous browser storage. */
export function loadWorkbenchPanelWorkspaceCache<TState>(
  options: LoadWorkbenchPanelWorkspaceCacheOptions<TState>,
): TState {
  const cache = options.cache ?? defaultWorkbenchPanelWorkspaceCache();
  if (!cache) return options.fallback;

  try {
    const saved = cache.getItem(options.key);
    return saved ? options.normalize(JSON.parse(saved)) : options.fallback;
  } catch (error) {
    reportPanelWorkspaceStorageFallback(options, "workspace-read", "localStorage", error);
    return options.fallback;
  }
}

/** Hydrates a panel workspace snapshot from async storage and applies it when present. */
export async function hydrateWorkbenchPanelWorkspaceStore<TState>(
  options: HydrateWorkbenchPanelWorkspaceStoreOptions<TState>,
): Promise<void> {
  try {
    const stored = await options.store.get(options.key);
    if (stored !== undefined) options.apply(options.normalize(stored));
  } catch (error) {
    reportPanelWorkspaceStorageFallback(options, "workspace-hydrate", options.storageLabel ?? "IndexedDB", error);
  }
}

/** Persists a panel workspace snapshot to cache and optional async storage. */
export function persistWorkbenchPanelWorkspaceState<TState>(
  state: TState,
  options: PersistWorkbenchPanelWorkspaceStateOptions<TState>,
): void {
  const cache = options.cache ?? defaultWorkbenchPanelWorkspaceCache();
  try {
    cache?.setItem(options.cacheKey, JSON.stringify(state));
    if (options.store) {
      void options.store.set(options.storeKey, state).catch((error) =>
        reportPanelWorkspaceStorageFallback(
          options,
          "workspace-persist",
          options.storeStorageLabel ?? "IndexedDB",
          error,
        )
      );
    }
  } catch (error) {
    reportPanelWorkspaceStorageFallback(
      options,
      "workspace-persist",
      options.cacheStorageLabel ?? "localStorage",
      error,
    );
  }
}

function defaultWorkbenchPanelWorkspaceCache(): WorkbenchPanelWorkspaceCache | undefined {
  return (globalThis as { localStorage?: WorkbenchPanelWorkspaceCache }).localStorage;
}

function reportPanelWorkspaceStorageFallback(
  options: { diagnostics?: WorkbenchPanelWorkspaceStorageDiagnostics; diagnosticSource?: string },
  operation: string,
  storage: string,
  error: unknown,
): void {
  options.diagnostics?.report({
    source: options.diagnosticSource ?? "workbench",
    storage,
    operation,
    error,
  });
}
