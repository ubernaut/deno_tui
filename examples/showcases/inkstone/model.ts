// Copyright 2023 Im-Beast. MIT license.

/** Current fixture-vault persistence schema. */
export const INKSTONE_VAULT_SCHEMA_VERSION = 1 as const;

/** Current Inkstone workspace persistence schema. */
export const INKSTONE_SESSION_SCHEMA_VERSION = 1 as const;

/** Stable note identity. Paths may eventually become mutable without changing this value. */
export type InkstoneNoteId = string;

/** Construction data for one deterministic fixture note. */
export interface InkstoneNoteFixture {
  readonly id: InkstoneNoteId;
  readonly path: string;
  readonly source: string;
  readonly revision?: number;
  readonly updatedAt?: number;
}

/** Content-free note row returned by a vault listing. */
export interface InkstoneNoteSummary {
  readonly id: InkstoneNoteId;
  readonly path: string;
  readonly revision: number;
  readonly updatedAt: number;
}

/** Immutable note returned by a vault read or successful write. */
export interface InkstoneNote extends InkstoneNoteSummary {
  readonly source: string;
}

/** Optimistic write request accepted by an Inkstone vault. */
export interface InkstoneNoteWrite {
  readonly noteId: InkstoneNoteId;
  readonly source: string;
  readonly expectedRevision: number;
}

/** Common cancellation options for vault operations. */
export interface InkstoneVaultOperationOptions {
  readonly signal?: AbortSignal;
}

/** Content-free, clone-safe vault diagnostics. */
export interface InkstoneVaultProviderInspection {
  readonly provider: "fixture-memory";
  readonly disposed: boolean;
  readonly noteCount: number;
  readonly overrideCount: number;
  readonly reads: number;
  readonly writes: number;
  readonly conflicts: number;
}

/** One saved fixture override. Unchanged seed notes are deliberately omitted. */
export interface InkstoneSavedNoteOverride {
  readonly noteId: InkstoneNoteId;
  readonly source: string;
  readonly revision: number;
  readonly updatedAt: number;
}

/** Versioned fixture-provider state embedded in a showcase session. */
export interface InkstoneVaultSnapshot {
  readonly schemaVersion: typeof INKSTONE_VAULT_SCHEMA_VERSION;
  readonly overrides: readonly InkstoneSavedNoteOverride[];
}

/** Fixture-only provider boundary used by the first Inkstone vertical slice. */
export interface InkstoneVaultProvider {
  list(options?: InkstoneVaultOperationOptions): Promise<readonly InkstoneNoteSummary[]>;
  read(noteId: InkstoneNoteId, options?: InkstoneVaultOperationOptions): Promise<InkstoneNote>;
  write(note: InkstoneNoteWrite, options?: InkstoneVaultOperationOptions): Promise<InkstoneNote>;
  snapshot(): InkstoneVaultSnapshot;
  restore(snapshot: InkstoneVaultSnapshot): void;
  inspect(): InkstoneVaultProviderInspection;
  dispose(): void;
}

/** Base class for stable fixture-provider failures. */
export class InkstoneVaultError extends Error {
  constructor(
    readonly code: "invalid-note" | "not-found" | "conflict" | "disposed" | "invalid-snapshot",
    message: string,
  ) {
    super(message);
    this.name = "InkstoneVaultError";
  }
}

/** Optimistic-concurrency failure that never carries note contents. */
export class InkstoneVaultConflictError extends InkstoneVaultError {
  constructor(
    readonly noteId: InkstoneNoteId,
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      "conflict",
      `Note ${noteId} changed at revision ${actualRevision}; expected revision ${expectedRevision}.`,
    );
    this.name = "InkstoneVaultConflictError";
  }
}

/** Metadata supported by the bounded fixture frontmatter reader. */
export interface InkstoneNoteMetadata {
  readonly title: string;
  readonly tags: readonly string[];
  readonly aliases: readonly string[];
  readonly status?: string;
}

/** Patch accepted by the source-preserving metadata editor. Null removes a scalar. */
export interface InkstoneMetadataPatch {
  readonly title?: string | null;
  readonly tags?: readonly string[];
  readonly aliases?: readonly string[];
  readonly status?: string | null;
}

/** One heading in source order. Line numbers are zero-based editor rows. */
export interface InkstoneHeading {
  readonly id: string;
  readonly level: number;
  readonly text: string;
  readonly line: number;
}

/** Link discovered in Markdown source outside frontmatter and fenced code. */
export interface InkstoneLink {
  readonly kind: "markdown" | "wiki";
  readonly label: string;
  readonly target: string;
  readonly line: number;
  readonly fragment?: string;
  readonly resolvedNoteId?: InkstoneNoteId;
  readonly external?: boolean;
}

/** Indexed, content-minimized note projection. */
export interface InkstoneIndexedNote {
  readonly noteId: InkstoneNoteId;
  readonly path: string;
  readonly title: string;
  readonly metadata: InkstoneNoteMetadata;
  readonly headings: readonly InkstoneHeading[];
  readonly outgoing: readonly InkstoneLink[];
  readonly wordCount: number;
}

/** Reverse link projected from the same index as outgoing links. */
export interface InkstoneBacklink {
  readonly sourceNoteId: InkstoneNoteId;
  readonly sourcePath: string;
  readonly sourceTitle: string;
  readonly label: string;
  readonly line: number;
  readonly fragment?: string;
}

/** Unresolved internal link retained for visible diagnostics. */
export interface InkstoneUnresolvedLink {
  readonly sourceNoteId: InkstoneNoteId;
  readonly target: string;
  readonly line: number;
}

/** JSON-safe vault index used by outlines, backlinks, navigation, and search. */
export interface InkstoneVaultIndex {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly notes: readonly InkstoneIndexedNote[];
  readonly backlinks: Readonly<Record<InkstoneNoteId, readonly InkstoneBacklink[]>>;
  readonly unresolved: readonly InkstoneUnresolvedLink[];
}

/** Search row intentionally contains a short snippet rather than complete source. */
export interface InkstoneSearchRow {
  readonly [key: string]: unknown;
  readonly noteId: InkstoneNoteId;
  readonly title: string;
  readonly path: string;
  readonly tags: readonly string[];
  readonly snippet: string;
  readonly searchable: string;
}

/** Search filters supported by the fixture-backed query. */
export interface InkstoneSearchFilters {
  readonly [key: string]: unknown;
  readonly tag?: string;
}

/** JSON-safe editor cursor used by workspace snapshots. */
export interface InkstoneCursorSnapshot {
  readonly x: number;
  readonly y: number;
}

/** One open draft persisted independently from its saved provider override. */
export interface InkstoneDraftSnapshot {
  readonly noteId: InkstoneNoteId;
  readonly baseRevision: number;
  readonly source: string;
  readonly cursor: InkstoneCursorSnapshot;
}

/** Search state retained without persisting result rows. */
export interface InkstoneSearchSnapshot {
  readonly query: string;
  readonly tag?: string;
}

/** Versioned, JSON-safe Inkstone state stored through ShowcaseKernel. */
export interface InkstoneSessionState {
  readonly schemaVersion: typeof INKSTONE_SESSION_SCHEMA_VERSION;
  readonly route: string;
  readonly openNoteIds: readonly InkstoneNoteId[];
  readonly activeNoteId?: InkstoneNoteId;
  readonly drafts: readonly InkstoneDraftSnapshot[];
  readonly search: InkstoneSearchSnapshot;
  readonly vault: InkstoneVaultSnapshot;
}

/** Lifecycle exposed to status bars and deterministic tests. */
export type InkstoneStatus = "idle" | "loading" | "ready" | "saving" | "conflict" | "error" | "disposed";

/** Backing-store mode selected by the terminal or test host. */
export type InkstoneStorageMode = "memory" | "durable";

/** Active optimistic conflict; deliberately excludes note contents. */
export interface InkstoneConflict {
  readonly noteId: InkstoneNoteId;
  readonly expectedRevision: number;
  readonly actualRevision: number;
}

/** Explicit save outcome suitable for UI messaging. */
export type InkstoneSaveResult =
  | Readonly<{ status: "saved"; noteId: InkstoneNoteId; revision: number }>
  | Readonly<{ status: "clean" | "no-active-note" }>
  | Readonly<{ status: "conflict"; conflict: InkstoneConflict }>
  | Readonly<{ status: "error" }>;

/** Content-free outcome from current-note literal find navigation. */
export type InkstoneEditorFindResult =
  | Readonly<{ status: "empty" | "not-found" | "limited"; matchCount: 0; matchIndex: -1; wrapped: false }>
  | Readonly<{
    status: "match";
    matchCount: number;
    matchIndex: number;
    wrapped: boolean;
  }>;

/** Content-free outcome from one or all current-note replacements. */
export interface InkstoneEditorReplaceResult {
  readonly replacements: number;
  readonly remainingMatches: number;
  readonly truncated: boolean;
}

/** Safe controller inspection. Text, snippets, queries, and result rows are omitted. */
export interface InkstoneControllerInspection {
  readonly status: InkstoneStatus;
  readonly initialized: boolean;
  readonly disposed: boolean;
  readonly noteCount: number;
  readonly indexedNoteCount: number;
  readonly openTabCount: number;
  readonly dirtyCount: number;
  readonly activeNoteId?: InkstoneNoteId;
  readonly queryLength: number;
  readonly searchResultCount: number;
  readonly unresolvedLinkCount: number;
  readonly editorLineCount: number;
  readonly editorCursor: InkstoneCursorSnapshot;
  readonly previewBlocks: number;
  readonly previewLinks: number;
  readonly historyUndoDepth: number;
  readonly historyRedoDepth: number;
  readonly recoveredDraftCount: number;
  readonly recoveryConflictCount: number;
  readonly storageMode: InkstoneStorageMode;
  readonly persistenceStatus: "idle" | "writing" | "ready" | "error" | "disposed";
  readonly conflict?: InkstoneConflict;
  readonly provider: InkstoneVaultProviderInspection;
  readonly diagnosticCount: number;
}
