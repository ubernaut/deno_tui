// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { AsyncScheduler, ScheduledTaskOptions } from "../runtime/scheduler.ts";
import type { AsyncStore } from "../runtime/storage.ts";
import {
  scoreWeightedSearchFields,
  searchTerms,
  type WeightedSearchField,
  weightedSearchFields,
} from "../utils/search.ts";
import type { Action } from "./actions.ts";
import type { CommandDispatch, CommandRegistry } from "./commands.ts";
import {
  type CommandSearchMatch,
  type CommandSearchOptions,
  type CommandSurfaceItem,
  commandSurfaceItems,
  executeCommandSurfaceItem,
} from "./command_bindings.ts";

/** Public interface describing a command Search Index Field. */
export interface CommandSearchIndexField extends WeightedSearchField {}

/** Entry record used by command Search Index catalogs or renderers. */
export interface CommandSearchIndexEntry {
  item: CommandSurfaceItem;
  fields: CommandSearchIndexField[];
  index: number;
}

/** Serializable inspection snapshot for command Search Index. */
export interface CommandSearchIndexInspection {
  count: number;
  disabled: number;
  fieldCount: number;
  keywordCount: number;
}

/** Public interface describing a command Search Index. */
export interface CommandSearchIndex {
  entries: CommandSearchIndexEntry[];
  inspection: CommandSearchIndexInspection;
}

/** Options for configuring command Search Index. */
export interface CommandSearchIndexOptions {
  labelWeight?: number;
  idWeight?: number;
  keywordWeight?: number;
}

/** Options for configuring indexed Command Search. */
export interface IndexedCommandSearchOptions extends CommandSearchOptions, CommandSearchIndexOptions {
  scheduler?: AsyncScheduler;
  priority?: number;
  signal?: AbortSignal;
  store?: AsyncStore<unknown>;
  cacheKey?: string;
  serialize?: (index: CommandSearchIndex) => unknown;
  deserialize?: (value: unknown) => CommandSearchIndex;
  restoreOnCreate?: boolean;
  onCacheError?: (error: unknown) => void;
}

/** Serializable inspection snapshot for indexed Command Surface. */
export interface IndexedCommandSurfaceInspection extends CommandSearchIndexInspection {
  query: string;
  matchCount: number;
  scheduler?: ReturnType<AsyncScheduler["inspect"]>;
  cached: boolean;
  cacheKey?: string;
  disposed: boolean;
}

/** Public interface describing an indexed Command Surface Controller. */
export interface IndexedCommandSurfaceController<TAction extends Action = Action> {
  readonly index: Signal<CommandSearchIndex>;
  readonly items: Signal<CommandSurfaceItem[]>;
  readonly query: Signal<string>;
  readonly matches: Signal<CommandSearchMatch[]>;
  refresh(options?: ScheduledTaskOptions): Promise<CommandSearchIndex>;
  restore(): Promise<CommandSearchIndex | undefined>;
  persist(): Promise<void>;
  clearCache(): Promise<void>;
  search(query?: string, options?: Pick<CommandSearchOptions, "limit">): CommandSearchMatch[];
  setQuery(query: string): CommandSearchMatch[];
  execute(item: Pick<CommandSurfaceItem, "id">): Promise<boolean>;
  inspect(): IndexedCommandSurfaceInspection;
  dispose(): void;
}

/** Creates an command Search Index. */
export function createCommandSearchIndex(
  items: readonly CommandSurfaceItem[],
  options: CommandSearchIndexOptions = {},
): CommandSearchIndex {
  const entries = items.map((item, index) => createCommandSearchIndexEntry(item, index, options));
  return {
    entries,
    inspection: {
      count: entries.length,
      disabled: entries.filter((entry) => entry.item.disabled).length,
      fieldCount: entries.reduce((total, entry) => total + entry.fields.length, 0),
      keywordCount: entries.reduce((total, entry) => total + (entry.item.keywords?.length ?? 0), 0),
    },
  };
}

/** Public helper for search Command Search Index. */
export function searchCommandSearchIndex(
  index: CommandSearchIndex,
  query: string,
  options: Pick<CommandSearchOptions, "limit"> = {},
): CommandSearchMatch[] {
  const terms = searchTerms(query);
  const ranked: Array<CommandSearchMatch & { index: number }> = [];
  for (const entry of index.entries) {
    const match = scoreCommandSearchIndexEntry(entry, terms);
    if (match) {
      ranked.push({
        item: entry.item,
        score: match.score,
        matched: match.matched,
        index: entry.index,
      });
    }
  }
  ranked.sort(compareCommandSearchMatches);
  const limit = options.limit === undefined ? ranked.length : Math.max(0, Math.floor(options.limit));
  const count = Math.min(limit, ranked.length);
  const matches = new Array<CommandSearchMatch>(count);
  for (let index = 0; index < count; index += 1) {
    const match = ranked[index]!;
    matches[index] = { item: match.item, score: match.score, matched: match.matched };
  }
  return matches;
}

/** Creates an indexed Command Surface. */
export function createIndexedCommandSurface<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  dispatch?: CommandDispatch<TAction>,
  options: IndexedCommandSearchOptions = {},
): IndexedCommandSurfaceController<TAction> {
  let disposed = false;
  let revision = 0;
  let cached = false;
  const build = () => createCommandSearchIndex(commandSurfaceItems(registry, options), options);
  const cacheKey = options.cacheKey ?? "command-search-index";
  const serialize = options.serialize ?? ((value: CommandSearchIndex) => value as unknown);
  const deserialize = options.deserialize ?? ((value: unknown) => value as CommandSearchIndex);
  const initial = build();
  const query = new Signal(options.query ?? "");
  const index = new Signal(initial, { deepObserve: true });
  const items = new Signal(initial.entries.map((entry) => entry.item), { deepObserve: true });
  const matches = new Signal(searchCommandSearchIndex(initial, query.peek(), options), { deepObserve: true });
  const syncMatches = () => {
    if (!disposed) {
      matches.value = searchCommandSearchIndex(index.peek(), query.peek(), options);
    }
  };
  query.subscribe(syncMatches);

  const applyIndex = (next: CommandSearchIndex, buildRevision: number) => {
    if (disposed || buildRevision !== revision) return next;
    index.value = next;
    items.value = next.entries.map((entry) => entry.item);
    syncMatches();
    return next;
  };

  const persist = async () => {
    if (!options.store) return;
    try {
      await options.store.set(cacheKey, serialize(index.peek()));
    } catch (error) {
      options.onCacheError?.(error);
    }
  };

  const refresh = async (taskOptions: ScheduledTaskOptions = {}) => {
    const buildRevision = ++revision;
    const scheduledOptions = {
      priority: taskOptions.priority ?? options.priority,
      signal: taskOptions.signal ?? options.signal,
    };
    const next = options.scheduler
      ? await options.scheduler.run(build, scheduledOptions)
      : await Promise.resolve().then(build);
    if (disposed || buildRevision !== revision) return next;
    cached = false;
    const applied = applyIndex(next, buildRevision);
    await persist();
    return applied;
  };

  const restore = async () => {
    if (!options.store) return undefined;
    try {
      const stored = await options.store.get(cacheKey);
      if (stored === undefined) return undefined;
      const restored = deserialize(stored);
      cached = true;
      return applyIndex(restored, ++revision);
    } catch (error) {
      options.onCacheError?.(error);
      return undefined;
    }
  };

  const clearCache = async () => {
    cached = false;
    if (!options.store) return;
    try {
      await options.store.delete(cacheKey);
    } catch (error) {
      options.onCacheError?.(error);
    }
  };

  const unsubscribe = registry.subscribe(() => {
    void refresh();
  });

  if (options.restoreOnCreate) {
    void restore();
  }

  return {
    index,
    items,
    query,
    matches,
    refresh,
    restore,
    persist,
    clearCache,
    search: (nextQuery = query.peek(), searchOptions = {}) =>
      searchCommandSearchIndex(index.peek(), nextQuery, { limit: searchOptions.limit ?? options.limit }),
    setQuery: (nextQuery) => {
      query.value = nextQuery;
      return matches.peek();
    },
    execute: (item) => executeCommandSurfaceItem(registry, item, dispatch),
    inspect: () => ({
      ...index.peek().inspection,
      query: query.peek(),
      matchCount: matches.peek().length,
      scheduler: options.scheduler?.inspect(),
      cached,
      cacheKey: options.store ? cacheKey : undefined,
      disposed,
    }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      query.unsubscribe(syncMatches);
      index.dispose();
      items.dispose();
      query.dispose();
      matches.dispose();
    },
  };
}

function createCommandSearchIndexEntry(
  item: CommandSurfaceItem,
  index: number,
  options: CommandSearchIndexOptions,
): CommandSearchIndexEntry {
  const fields = weightedSearchFields([
    { value: item.label, weight: options.labelWeight ?? 100 },
    { value: item.id, weight: options.idWeight ?? 80 },
    ...(item.keywords ?? []).map((value) => ({ value, weight: options.keywordWeight ?? 40 })),
  ]);

  return { item, fields, index };
}

function scoreCommandSearchIndexEntry(
  entry: CommandSearchIndexEntry,
  terms: readonly string[],
): { score: number; matched: string[] } | undefined {
  return scoreWeightedSearchFields(entry.fields, terms, entry.item.disabled);
}

function compareCommandSearchMatches(
  left: CommandSearchMatch & { index: number },
  right: CommandSearchMatch & { index: number },
): number {
  return right.score - left.score ||
    Number(left.item.disabled) - Number(right.item.disabled) ||
    left.item.label.localeCompare(right.item.label) ||
    left.index - right.index;
}
