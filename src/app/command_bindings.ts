// Copyright 2023 Im-Beast. MIT license.
import { bindingId, type KeyBinding, type KeymapRegistry } from "../keymap.ts";
import type { KeyPressEvent } from "../input_reader/types.ts";
import { Signal } from "../signals/mod.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandDispatch, CommandRegistry } from "./commands.ts";

/** Public interface describing a command Surface Item. */
export interface CommandSurfaceItem {
  id: string;
  label: string;
  keywords?: readonly string[];
  disabled?: boolean;
}

/** Public interface describing a command Key Target. */
export interface CommandKeyTarget {
  on(type: "keyPress", listener: (event: KeyPressEvent) => void | Promise<void>): () => void;
}

/** Options for configuring command Key Binding. */
export interface CommandKeyBindingOptions {
  group?: string;
}

/** Options for configuring command Surface. */
export interface CommandSurfaceOptions extends CommandKeyBindingOptions {
  includeDisabled?: boolean;
  includeBindingsInKeywords?: boolean;
}

/** Public interface describing a command Search Match. */
export interface CommandSearchMatch {
  item: CommandSurfaceItem;
  score: number;
  matched: string[];
}

/** Options for configuring command Search. */
export interface CommandSearchOptions extends CommandSurfaceOptions {
  query?: string;
  limit?: number;
}

/** Options for configuring command Keymap Binding. */
export interface CommandKeymapBindingOptions extends CommandKeyBindingOptions {
  includeDisabled?: boolean;
}

/** Serializable inspection snapshot for command Key Binding. */
export interface CommandKeyBindingInspection {
  commandId: string;
  label: string;
  group?: string;
  disabled: boolean;
  bindingId: string;
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

/** Public interface describing a command Key Binding Conflict. */
export interface CommandKeyBindingConflict {
  bindingId: string;
  groups: string[];
  commands: CommandKeyBindingInspection[];
}

/** Serializable inspection snapshot for command Key Binding Report. */
export interface CommandKeyBindingReportInspection {
  count: number;
  groups: string[];
  conflictCount: number;
  conflictingCommandCount: number;
}

/** Structured report returned by command Key Binding helpers. */
export interface CommandKeyBindingReport {
  bindings: CommandKeyBindingInspection[];
  conflicts: CommandKeyBindingConflict[];
  inspection: CommandKeyBindingReportInspection;
}

/** Options for configuring command Key Binding Report. */
export interface CommandKeyBindingReportOptions extends CommandKeymapBindingOptions {
  includeUnbound?: boolean;
}

/** Options for configuring command Key Binding Markdown. */
export interface CommandKeyBindingMarkdownOptions extends CommandKeyBindingReportOptions {
  title?: string;
  includeSummary?: boolean;
}

/** Public interface describing a command Surface Controller. */
export interface CommandSurfaceController<TAction extends Action = Action> {
  readonly items: Signal<CommandSurfaceItem[]>;
  refresh(): CommandSurfaceItem[];
  execute(item: Pick<CommandSurfaceItem, "id">): Promise<boolean>;
  dispose(): void;
}

/** Public helper for command For Key Event. */
export function commandForKeyEvent<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  event: KeyPressEvent,
  options: CommandKeyBindingOptions = {},
): Command<TAction> | undefined {
  const eventId = bindingId(event);
  return registry.list(options.group).find((command) => {
    return command.binding && registry.enabled(command) && bindingId(command.binding) === eventId;
  });
}

/** Binds command Keys behavior and returns a disposer when applicable. */
export function bindCommandKeys<TAction extends Action = Action>(
  target: CommandKeyTarget,
  registry: CommandRegistry<TAction>,
  dispatch?: CommandDispatch<TAction>,
  options: CommandKeyBindingOptions = {},
): () => void {
  return target.on("keyPress", async (event) => {
    const command = commandForKeyEvent(registry, event, options);
    if (command) {
      await registry.execute(command.id, dispatch);
    }
  });
}

/** Binds command Keymap behavior and returns a disposer when applicable. */
export function bindCommandKeymap<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  keymap: KeymapRegistry,
  options: CommandKeymapBindingOptions = {},
): () => void {
  let disposers: Array<() => void> = [];
  const clear = () => {
    for (const dispose of disposers) {
      dispose();
    }
    disposers = [];
  };
  const sync = () => {
    clear();
    disposers = registry
      .keyBindings(options.group, options.includeDisabled ?? false)
      .map((binding: KeyBinding) => keymap.register(binding));
  };

  sync();
  const unsubscribe = registry.subscribe(sync);

  return () => {
    unsubscribe();
    clear();
  };
}

/** Public helper for command Surface Items. */
export function commandSurfaceItems<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  options: CommandSurfaceOptions = {},
): CommandSurfaceItem[] {
  const includeDisabled = options.includeDisabled ?? true;
  const includeBindingsInKeywords = options.includeBindingsInKeywords ?? true;
  return registry.list(options.group)
    .filter((command) => includeDisabled || registry.enabled(command))
    .map((command) => ({
      id: command.id,
      label: command.label,
      keywords: commandKeywords(command, includeBindingsInKeywords),
      disabled: !registry.enabled(command),
    }));
}

/** Public helper for search Command Surface Items. */
export function searchCommandSurfaceItems<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  options: CommandSearchOptions = {},
): CommandSurfaceItem[] {
  return rankCommandSurfaceItems(commandSurfaceItems(registry, options), options.query ?? "", options)
    .map((match) => match.item);
}

/** Public helper for rank Command Surface Items. */
export function rankCommandSurfaceItems(
  items: readonly CommandSurfaceItem[],
  query: string,
  options: Pick<CommandSearchOptions, "limit"> = {},
): CommandSearchMatch[] {
  const terms = searchTerms(query);
  const ranked = items
    .map((item, index) => {
      const match = scoreCommandSurfaceItem(item, terms);
      return match
        ? {
          item,
          score: match.score,
          matched: match.matched,
          index,
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

/** Public helper for execute Command Surface Item. */
export function executeCommandSurfaceItem<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  item: Pick<CommandSurfaceItem, "id">,
  dispatch?: CommandDispatch<TAction>,
): Promise<boolean> {
  return registry.execute(item.id, dispatch);
}

/** Creates an command Surface. */
export function createCommandSurface<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  dispatch?: CommandDispatch<TAction>,
  options: CommandSurfaceOptions = {},
): CommandSurfaceController<TAction> {
  let disposed = false;
  const items = new Signal(commandSurfaceItems(registry, options));
  const refresh = () => {
    const next = commandSurfaceItems(registry, options);
    if (!disposed) {
      items.value = next;
    }
    return next;
  };
  const unsubscribe = registry.subscribe(refresh);

  return {
    items,
    refresh,
    execute: (item) => executeCommandSurfaceItem(registry, item, dispatch),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      items.dispose();
    },
  };
}

/** Binds command Surface behavior and returns a disposer when applicable. */
export function bindCommandSurface<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  items: Signal<CommandSurfaceItem[]>,
  options: CommandSurfaceOptions = {},
): () => void {
  const sync = () => {
    items.value = commandSurfaceItems(registry, options);
  };
  sync();
  const unsubscribe = registry.subscribe(sync);
  return unsubscribe;
}

/** Creates a serializable inspection snapshot for command Key Bindings. */
export function inspectCommandKeyBindings<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  options: CommandKeyBindingReportOptions = {},
): CommandKeyBindingInspection[] {
  const includeDisabled = options.includeDisabled ?? false;
  const includeUnbound = options.includeUnbound ?? false;
  return registry.list(options.group)
    .filter((command) => (includeDisabled || registry.enabled(command)) && (includeUnbound || command.binding))
    .map((command) => {
      const binding = command.binding;
      return {
        commandId: command.id,
        label: command.label,
        group: command.group,
        disabled: !registry.enabled(command),
        bindingId: binding ? bindingId(binding) : "",
        key: binding?.key ?? "",
        ctrl: binding?.ctrl,
        meta: binding?.meta,
        shift: binding?.shift,
      };
    })
    .sort((left, right) =>
      left.bindingId.localeCompare(right.bindingId) ||
      (left.group ?? "").localeCompare(right.group ?? "") ||
      left.label.localeCompare(right.label)
    );
}

/** Creates an command Key Binding Report. */
export function createCommandKeyBindingReport<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  options: CommandKeyBindingReportOptions = {},
): CommandKeyBindingReport {
  const bindings = inspectCommandKeyBindings(registry, options);
  const conflicts = inspectCommandKeyBindingConflicts(bindings);
  return {
    bindings,
    conflicts,
    inspection: {
      count: bindings.length,
      groups: uniqueSorted(bindings.map((binding) => binding.group)),
      conflictCount: conflicts.length,
      conflictingCommandCount: conflicts.reduce((total, conflict) => total + conflict.commands.length, 0),
    },
  };
}

/** Formats command Key Binding Markdown for display or diagnostics. */
export function formatCommandKeyBindingMarkdown<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  options: CommandKeyBindingMarkdownOptions = {},
): string {
  const report = createCommandKeyBindingReport(registry, options);
  const lines = [`# ${options.title ?? "Command Key Bindings"}`, ""];
  if (options.includeSummary ?? true) {
    lines.push(`${report.inspection.count} bindings, ${report.inspection.conflictCount} conflicts.`, "");
  }

  lines.push("| Binding | Command | Group | Disabled |");
  lines.push("| --- | --- | --- | --- |");
  for (const binding of report.bindings) {
    lines.push(
      `| ${binding.bindingId || "-"} | ${escapeMarkdownCell(binding.label)} | ${
        escapeMarkdownCell(binding.group ?? "-")
      } | ${binding.disabled ? "yes" : "no"} |`,
    );
  }

  if (report.conflicts.length > 0) {
    lines.push("", "| Conflict | Groups | Commands |");
    lines.push("| --- | --- | --- |");
    for (const conflict of report.conflicts) {
      lines.push(
        `| ${conflict.bindingId} | ${escapeMarkdownCell(conflict.groups.join(", "))} | ${
          escapeMarkdownCell(conflict.commands.map((command) => command.commandId).join(", "))
        } |`,
      );
    }
  }

  return lines.join("\n");
}

function commandKeywords<TAction extends Action = Action>(
  command: Command<TAction>,
  includeBinding: boolean,
): string[] {
  return [
    command.id,
    command.group,
    command.description,
    ...(command.keywords ?? []),
    includeBinding && command.binding ? bindingId(command.binding) : undefined,
  ].filter((keyword): keyword is string => !!keyword);
}

function scoreCommandSurfaceItem(
  item: CommandSurfaceItem,
  terms: readonly string[],
): { score: number; matched: string[] } | undefined {
  if (terms.length === 0) {
    return { score: item.disabled ? -1 : 0, matched: [] };
  }

  const fields = [
    { value: item.label, weight: 100 },
    { value: item.id, weight: 80 },
    ...(item.keywords ?? []).map((value) => ({ value, weight: 40 })),
  ].map((field) => ({ ...field, normalized: normalizeSearchText(field.value) }));

  let score = item.disabled ? -10 : 0;
  const matched: string[] = [];
  for (const term of terms) {
    let best = 0;
    let bestValue: string | undefined;
    for (const field of fields) {
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

function inspectCommandKeyBindingConflicts(
  bindings: readonly CommandKeyBindingInspection[],
): CommandKeyBindingConflict[] {
  const byBinding = new Map<string, CommandKeyBindingInspection[]>();
  for (const binding of bindings) {
    if (!binding.bindingId) continue;
    const commands = byBinding.get(binding.bindingId) ?? [];
    commands.push(binding);
    byBinding.set(binding.bindingId, commands);
  }

  return [...byBinding.entries()]
    .filter(([, commands]) => commands.length > 1)
    .map(([bindingId, commands]) => ({
      bindingId,
      groups: uniqueSorted(commands.map((command) => command.group)),
      commands,
    }))
    .sort((left, right) => left.bindingId.localeCompare(right.bindingId));
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))].sort();
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
