// Copyright 2023 Im-Beast. MIT license.
import { bindingId, type KeyBinding, type KeymapRegistry } from "../keymap.ts";
import type { KeyPressEvent } from "../input_reader/types.ts";
import { Signal } from "../signals/mod.ts";
import { scoreWeightedSearchFields, searchTerms, weightedSearchFields } from "../utils/search.ts";
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
  for (const command of registry.list(options.group)) {
    if (command.binding && registry.enabled(command) && bindingId(command.binding) === eventId) return command;
  }
  return undefined;
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
    const bindings = registry.keyBindings(options.group, options.includeDisabled ?? false);
    disposers = new Array<() => void>(bindings.length);
    for (let index = 0; index < bindings.length; index += 1) {
      disposers[index] = keymap.register(bindings[index]!);
    }
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
  const commands = registry.list(options.group);
  const items: CommandSurfaceItem[] = [];
  for (const command of commands) {
    const enabled = registry.enabled(command);
    if (!includeDisabled && !enabled) continue;
    items.push({
      id: command.id,
      label: command.label,
      keywords: commandKeywords(command, includeBindingsInKeywords),
      disabled: !enabled,
    });
  }
  return items;
}

/** Public helper for search Command Surface Items. */
export function searchCommandSurfaceItems<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  options: CommandSearchOptions = {},
): CommandSurfaceItem[] {
  const matches = rankCommandSurfaceItems(commandSurfaceItems(registry, options), options.query ?? "", options);
  const items = new Array<CommandSurfaceItem>(matches.length);
  for (let index = 0; index < matches.length; index += 1) {
    items[index] = matches[index]!.item;
  }
  return items;
}

/** Public helper for rank Command Surface Items. */
export function rankCommandSurfaceItems(
  items: readonly CommandSurfaceItem[],
  query: string,
  options: Pick<CommandSearchOptions, "limit"> = {},
): CommandSearchMatch[] {
  const terms = searchTerms(query);
  const ranked: Array<CommandSearchMatch & { index: number }> = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const match = scoreCommandSurfaceItem(item, terms);
    if (match) {
      ranked.push({ item, score: match.score, matched: match.matched, index });
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
  const output: CommandKeyBindingInspection[] = [];
  for (const command of registry.list(options.group)) {
    const enabled = registry.enabled(command);
    if (!includeDisabled && !enabled) continue;
    if (!includeUnbound && !command.binding) continue;
    const binding = command.binding;
    output.push({
      commandId: command.id,
      label: command.label,
      group: command.group,
      disabled: !enabled,
      bindingId: binding ? bindingId(binding) : "",
      key: binding?.key ?? "",
      ctrl: binding?.ctrl,
      meta: binding?.meta,
      shift: binding?.shift,
    });
  }
  output.sort((left, right) =>
    left.bindingId.localeCompare(right.bindingId) ||
    (left.group ?? "").localeCompare(right.group ?? "") ||
    left.label.localeCompare(right.label)
  );
  return output;
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
      groups: uniqueSortedGroups(bindings),
      conflictCount: conflicts.length,
      conflictingCommandCount: conflictingCommandCount(conflicts),
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
          escapeMarkdownCell(commandIdsText(conflict.commands))
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
  const keywords: string[] = [command.id];
  if (command.group) keywords.push(command.group);
  if (command.description) keywords.push(command.description);
  if (command.keywords) {
    for (const keyword of command.keywords) {
      if (keyword) keywords.push(keyword);
    }
  }
  if (includeBinding && command.binding) keywords.push(bindingId(command.binding));
  return keywords;
}

function scoreCommandSurfaceItem(
  item: CommandSurfaceItem,
  terms: readonly string[],
): { score: number; matched: string[] } | undefined {
  const rawFields: Array<{ value: string; weight: number }> = [
    { value: item.label, weight: 100 },
    { value: item.id, weight: 80 },
  ];
  if (item.keywords) {
    for (const value of item.keywords) rawFields.push({ value, weight: 40 });
  }
  const fields = weightedSearchFields(rawFields);
  return scoreWeightedSearchFields(fields, terms, item.disabled);
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

function inspectCommandKeyBindingConflicts(
  bindings: readonly CommandKeyBindingInspection[],
): CommandKeyBindingConflict[] {
  const byBinding = new Map<string, CommandKeyBindingInspection[]>();
  for (const binding of bindings) {
    if (!binding.bindingId) continue;
    let commands = byBinding.get(binding.bindingId);
    if (!commands) {
      commands = [];
      byBinding.set(binding.bindingId, commands);
    }
    commands.push(binding);
  }

  const conflicts: CommandKeyBindingConflict[] = [];
  for (const [bindingId, commands] of byBinding) {
    if (commands.length <= 1) continue;
    conflicts.push({
      bindingId,
      groups: uniqueSortedGroups(commands),
      commands,
    });
  }
  conflicts.sort((left, right) => left.bindingId.localeCompare(right.bindingId));
  return conflicts;
}

function uniqueSortedGroups(bindings: readonly { group?: string }[]): string[] {
  const groups = new Set<string>();
  for (const binding of bindings) {
    if (binding.group) groups.add(binding.group);
  }
  return [...groups].sort();
}

function conflictingCommandCount(conflicts: readonly CommandKeyBindingConflict[]): number {
  let count = 0;
  for (const conflict of conflicts) count += conflict.commands.length;
  return count;
}

function commandIdsText(commands: readonly CommandKeyBindingInspection[]): string {
  let output = "";
  for (let index = 0; index < commands.length; index += 1) {
    if (index > 0) output += ", ";
    output += commands[index]!.commandId;
  }
  return output;
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
