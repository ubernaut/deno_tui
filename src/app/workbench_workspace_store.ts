// Copyright 2023 Im-Beast. MIT license.

import type { DiagnosticInput } from "../runtime/diagnostics.ts";
import { type AsyncStore, createRuntimeStore, JsonFileStore } from "../runtime/storage.ts";
import { createStorageFallbackDiagnostic } from "../runtime/storage_diagnostics.ts";
import {
  type NormalizeWorkbenchWorkspacesOptions,
  normalizeWorkbenchWorkspaceStorage,
  serializeWorkbenchWorkspaces,
  type WorkbenchWorkspace,
} from "./workbench_workspace.ts";

/** Minimal diagnostic sink accepted by workbench workspace persistence helpers. */
export interface WorkbenchWorkspaceStorageDiagnosticSink {
  report(input: DiagnosticInput): unknown;
}

/** Options for choosing the default browser or Deno workspace backing store. */
export interface WorkbenchWorkspaceStoreOptions {
  databaseName: string;
  storeName: string;
  fallbackPath: string;
  version?: number;
  preferIndexedDb?: boolean;
  hasIndexedDb?: boolean;
}

/** Shared options for loading and persisting named workbench workspaces. */
export interface WorkbenchWorkspaceStorageOptions<TAscii = unknown>
  extends NormalizeWorkbenchWorkspacesOptions<TAscii> {
  key: string;
  store: AsyncStore<unknown>;
  diagnostics?: WorkbenchWorkspaceStorageDiagnosticSink;
  diagnosticSource?: string;
  storageLabel?: string;
}

/** Creates the default workspace store for browser and terminal runtimes. */
export function createWorkbenchWorkspaceStore(options: WorkbenchWorkspaceStoreOptions): AsyncStore<unknown> {
  const hasIndexedDb = options.hasIndexedDb ?? "indexedDB" in globalThis;
  if (options.preferIndexedDb !== false && hasIndexedDb) {
    return createRuntimeStore<unknown>({
      databaseName: options.databaseName,
      storeName: options.storeName,
      version: options.version ?? 1,
    });
  }
  return new JsonFileStore<unknown>(options.fallbackPath);
}

/** Loads and normalizes saved workspaces, reporting storage failures as diagnostics. */
export async function loadWorkbenchWorkspaceStorage<TAscii = unknown>(
  options: WorkbenchWorkspaceStorageOptions<TAscii>,
): Promise<WorkbenchWorkspace<TAscii>[]> {
  const stored = await options.store.get(options.key).catch((error) => {
    reportWorkbenchWorkspaceStorageFallback(options, "workspace load", error);
    return undefined;
  });
  return normalizeWorkbenchWorkspaceStorage(stored, options);
}

/** Persists saved workspaces in the versioned workspace storage envelope. */
export async function persistWorkbenchWorkspaceStorage<TAscii = unknown>(
  workspaces: readonly WorkbenchWorkspace<TAscii>[],
  options: WorkbenchWorkspaceStorageOptions<TAscii>,
  savedAt: number = Date.now(),
): Promise<void> {
  await options.store.set(options.key, serializeWorkbenchWorkspaces(workspaces, savedAt)).catch((error) => {
    reportWorkbenchWorkspaceStorageFallback(options, "workspace persist", error);
  });
}

function reportWorkbenchWorkspaceStorageFallback<TAscii>(
  options: WorkbenchWorkspaceStorageOptions<TAscii>,
  operation: string,
  error: unknown,
): void {
  options.diagnostics?.report(createStorageFallbackDiagnostic({
    source: options.diagnosticSource ?? "workbench",
    storage: options.storageLabel ?? ("indexedDB" in globalThis ? "IndexedDB" : "Deno JSON"),
    operation,
    error,
  }));
}
