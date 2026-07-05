// Copyright 2023 Im-Beast. MIT license.

import type { AsyncStore } from "../runtime/storage.ts";
import {
  createWorkbenchWorkspaceStore,
  type WorkbenchWorkspaceStorageDiagnosticSink,
} from "./workbench_workspace_store.ts";
import { normalizeWorkbenchWorkspaceName } from "./workbench_workspace.ts";
import type { WorkbenchWorkspaceStorageOptions } from "./workbench_workspace_store.ts";

/** Default persistence key used by the API Workbench workspace menu. */
export const API_WORKBENCH_WORKSPACE_STORE_KEY = "api-workbench.workspaces";

/** Default IndexedDB/JSON store configuration for API Workbench workspaces. */
export const API_WORKBENCH_WORKSPACE_STORE_OPTIONS = {
  databaseName: "deno-tui-api-workbench",
  storeName: "workspaces",
  fallbackPath: ".api-workbench-workspaces.json",
  version: 1,
} as const;

export interface ApiWorkbenchWorkspaceStorageOptionsInput<TAscii = unknown> {
  key?: string;
  store: AsyncStore<unknown>;
  validVisualizationIds: Iterable<string>;
  normalizeAscii?: (value: unknown) => TAscii | undefined;
  diagnostics?: WorkbenchWorkspaceStorageDiagnosticSink;
  hasIndexedDb?: boolean;
}

/** Returns the user-facing storage label for API Workbench workspace diagnostics and modals. */
export function apiWorkbenchWorkspaceStorageLabel(hasIndexedDb = "indexedDB" in globalThis): string {
  return hasIndexedDb ? "IndexedDB" : "Deno JSON";
}

/** Creates the default API Workbench workspace backing store. */
export function createApiWorkbenchWorkspaceStore(): AsyncStore<unknown> {
  return createWorkbenchWorkspaceStore(API_WORKBENCH_WORKSPACE_STORE_OPTIONS);
}

/** Builds load/persist options for API Workbench workspace storage. */
export function apiWorkbenchWorkspaceStorageOptions<TAscii = unknown>(
  input: ApiWorkbenchWorkspaceStorageOptionsInput<TAscii>,
): WorkbenchWorkspaceStorageOptions<TAscii> {
  return {
    key: input.key ?? API_WORKBENCH_WORKSPACE_STORE_KEY,
    store: input.store,
    validVisualizationIds: input.validVisualizationIds,
    normalizeName: (name, index) => normalizeWorkbenchWorkspaceName(name, `Workspace ${index + 1}`),
    normalizeAscii: input.normalizeAscii,
    diagnostics: input.diagnostics,
    diagnosticSource: "api-workbench",
    storageLabel: apiWorkbenchWorkspaceStorageLabel(input.hasIndexedDb),
  };
}
