// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { AsyncScheduler, ScheduledTaskOptions } from "../runtime/scheduler.ts";
import type { Action } from "./actions.ts";
import type { CommandDispatch, CommandRegistry } from "./commands.ts";
import {
  type CommandSearchMatch,
  type CommandSearchOptions,
  type CommandSurfaceItem,
  commandSurfaceItems,
  executeCommandSurfaceItem,
} from "./command_bindings.ts";

export interface CommandSearchIndexField {
  value: string;
  normalized: string;
  weight: number;
}

export interface CommandSearchIndexEntry {
  item: CommandSurfaceItem;
  fields: CommandSearchIndexField[];
  index: number;
}

export interface CommandSearchIndexInspection {
  count: number;
  disabled: number;
  fieldCount: number;
  keywordCount: number;
}

export interface CommandSearchIndex {
  entries: CommandSearchIndexEntry[];
  inspection: CommandSearchIndexInspection;
}

export interface CommandSearchIndexOptions {
  labelWeight?: number;
  idWeight?: number;
  keywordWeight?: number;
}

export interface IndexedCommandSearchOptions extends CommandSearchOptions, CommandSearchIndexOptions {
  scheduler?: AsyncScheduler;
  priority?: number;
  signal?: AbortSignal;
}

export interface IndexedCommandSurfaceInspection extends CommandSearchIndexInspection {
  query: string;
  matchCount: number;
  scheduler?: ReturnType<AsyncScheduler["inspect"]>;
  disposed: boolean;
}

export interface IndexedCommandSurfaceController<TAction extends Action = Action> {
  readonly index: Signal<CommandSearchIndex>;
  readonly items: Signal<CommandSurfaceItem[]>;
  readonly query: Signal<string>;
  readonly matches: Signal<CommandSearchMatch[]>;
  refresh(options?: ScheduledTaskOptions): Promise<CommandSearchIndex>;
  search(query?: string, options?: Pick<CommandSearchOptions, "limit">): CommandSearchMatch[];
  setQuery(query: string): CommandSearchMatch[];
  execute(item: Pick<CommandSurfaceItem, "id">): Promise<boolean>;
  inspect(): IndexedCommandSurfaceInspection;
  dispose(): void;
}

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

export function searchCommandSearchIndex(
  index: CommandSearchIndex,
  query: string,
  options: Pick<CommandSearchOptions, "limit"> = {},
): CommandSearchMatch[] {
  const terms = searchTerms(query);
  const ranked = index.entries
    .map((entry) => {
      const match = scoreCommandSearchIndexEntry(entry, terms);
      return match
        ? {
          item: entry.item,
          score: match.score,
          matched: match.matched,
          index: entry.index,
        }
        : undefined;
    })
    .filter((match): match is CommandSearchMatch & { index: number } => match !== undefined)
    .sort((left, right) =>
      right.score - left.score ||
      Number(left.item.disabled) - Number(right.item.disabled) ||
      left.item.label.localeCompare(right.item.label) ||
      left.index - right.index
    );
  const limit = options.limit === undefined ? ranked.length : Math.max(0, Math.floor(options.limit));
  return ranked.slice(0, limit).map(({ index: _index, ...match }) => match);
}

export function createIndexedCommandSurface<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  dispatch?: CommandDispatch<TAction>,
  options: IndexedCommandSearchOptions = {},
): IndexedCommandSurfaceController<TAction> {
  let disposed = false;
  let revision = 0;
  const build = () => createCommandSearchIndex(commandSurfaceItems(registry, options), options);
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

  const refresh = async (taskOptions: ScheduledTaskOptions = {}) => {
    const buildRevision = ++revision;
    const scheduledOptions = {
      priority: taskOptions.priority ?? options.priority,
      signal: taskOptions.signal ?? options.signal,
    };
    const next = options.scheduler
      ? await options.scheduler.run(build, scheduledOptions)
      : await Promise.resolve().then(build);
    return applyIndex(next, buildRevision);
  };

  const unsubscribe = registry.subscribe(() => {
    void refresh();
  });

  return {
    index,
    items,
    query,
    matches,
    refresh,
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
  const fields = [
    { value: item.label, weight: options.labelWeight ?? 100 },
    { value: item.id, weight: options.idWeight ?? 80 },
    ...(item.keywords ?? []).map((value) => ({ value, weight: options.keywordWeight ?? 40 })),
  ].map((field) => ({ ...field, normalized: normalizeSearchText(field.value) }));

  return { item, fields, index };
}

function scoreCommandSearchIndexEntry(
  entry: CommandSearchIndexEntry,
  terms: readonly string[],
): { score: number; matched: string[] } | undefined {
  if (terms.length === 0) {
    return { score: entry.item.disabled ? -1 : 0, matched: [] };
  }

  let score = entry.item.disabled ? -10 : 0;
  const matched: string[] = [];
  for (const term of terms) {
    let best = 0;
    let bestValue: string | undefined;
    for (const field of entry.fields) {
      const fieldScore = scoreSearchField(field.normalized, term, field.weight);
      if (fieldScore > best) {
        best = fieldScore;
        bestValue = field.value;
      }
    }
    if (best <= 0) return undefined;
    score += best;
    if (bestValue) matched.push(bestValue);
  }

  return { score, matched: [...new Set(matched)] };
}

function scoreSearchField(field: string, term: string, weight: number): number {
  if (field === term) return weight + 40;
  if (field.startsWith(term)) return weight + 25;
  if (field.split(" ").some((part) => part.startsWith(term))) return weight + 15;
  if (field.includes(term)) return weight + 5;
  return acronym(field).startsWith(term) ? weight : 0;
}

function searchTerms(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean);
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/[_.:/]+/g, " ").replace(/\s+/g, " ");
}

function acronym(value: string): string {
  return value.split(/\s+/).map((part) => part[0] ?? "").join("");
}
