// Copyright 2023 Im-Beast. MIT license.
import { bindingId, type KeyBinding, type KeymapRegistry } from "../keymap.ts";
import type { KeyPressEvent } from "../input_reader/types.ts";
import { Signal } from "../signals/mod.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandDispatch, CommandRegistry } from "./commands.ts";

export interface CommandSurfaceItem {
  id: string;
  label: string;
  keywords?: readonly string[];
  disabled?: boolean;
}

export interface CommandKeyTarget {
  on(type: "keyPress", listener: (event: KeyPressEvent) => void | Promise<void>): () => void;
}

export interface CommandKeyBindingOptions {
  group?: string;
}

export interface CommandSurfaceOptions extends CommandKeyBindingOptions {
  includeDisabled?: boolean;
  includeBindingsInKeywords?: boolean;
}

export interface CommandSearchMatch {
  item: CommandSurfaceItem;
  score: number;
  matched: string[];
}

export interface CommandSearchOptions extends CommandSurfaceOptions {
  query?: string;
  limit?: number;
}

export interface CommandKeymapBindingOptions extends CommandKeyBindingOptions {
  includeDisabled?: boolean;
}

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

export interface CommandKeyBindingConflict {
  bindingId: string;
  groups: string[];
  commands: CommandKeyBindingInspection[];
}

export interface CommandKeyBindingReportInspection {
  count: number;
  groups: string[];
  conflictCount: number;
  conflictingCommandCount: number;
}

export interface CommandKeyBindingReport {
  bindings: CommandKeyBindingInspection[];
  conflicts: CommandKeyBindingConflict[];
  inspection: CommandKeyBindingReportInspection;
}

export interface CommandKeyBindingReportOptions extends CommandKeymapBindingOptions {
  includeUnbound?: boolean;
}

export interface CommandKeyBindingMarkdownOptions extends CommandKeyBindingReportOptions {
  title?: string;
  includeSummary?: boolean;
}

export interface CommandSurfaceController<TAction extends Action = Action> {
  readonly items: Signal<CommandSurfaceItem[]>;
  refresh(): CommandSurfaceItem[];
  execute(item: Pick<CommandSurfaceItem, "id">): Promise<boolean>;
  dispose(): void;
}

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

export function searchCommandSurfaceItems<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  options: CommandSearchOptions = {},
): CommandSurfaceItem[] {
  return rankCommandSurfaceItems(commandSurfaceItems(registry, options), options.query ?? "", options)
    .map((match) => match.item);
}

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

export function executeCommandSurfaceItem<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  item: Pick<CommandSurfaceItem, "id">,
  dispatch?: CommandDispatch<TAction>,
): Promise<boolean> {
  return registry.execute(item.id, dispatch);
}

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
