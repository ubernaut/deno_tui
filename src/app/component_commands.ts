// Copyright 2023 Im-Beast. MIT license.
import {
  type ComponentCatalogEntry,
  type ComponentCatalogQuery,
  inspectComponentCatalog,
  queryComponents,
} from "../components/catalog.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Action union emitted by component Catalog Command command helpers. */
export type ComponentCatalogCommandAction = Action<"component.selected", ComponentCatalogEntry>;

/** Options for configuring component Catalog Command. */
export interface ComponentCatalogCommandOptions<TAction extends Action = ComponentCatalogCommandAction> {
  idPrefix?: string;
  group?: string;
  entries?: readonly ComponentCatalogEntry[];
  query?: ComponentCatalogQuery;
  label?: (entry: ComponentCatalogEntry) => string;
  keywords?: (entry: ComponentCatalogEntry) => readonly string[];
  disabled?: (entry: ComponentCatalogEntry) => boolean;
  action?: (entry: ComponentCatalogEntry) => TAction | void | Promise<TAction | void>;
}

/** Builds command definitions for component Catalog. */
export function componentCatalogCommands<TAction extends Action = ComponentCatalogCommandAction>(
  options: ComponentCatalogCommandOptions<TAction> = {},
): Command<TAction>[] {
  const idPrefix = options.idPrefix ?? "component";
  const group = options.group ?? "components";
  const entries = options.entries ?? queryComponents(options.query);

  const commands = new Array<Command<TAction>>(entries.length);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    commands[index] = {
      id: `${idPrefix}.select.${entry.id}`,
      label: options.label?.(entry) ?? entry.name,
      description: entry.description,
      group,
      keywords: options.keywords?.(entry) ?? componentKeywords(entry),
      disabled: options.disabled ? () => options.disabled!(entry) : false,
      action: async () => {
        const action = await options.action?.(entry);
        return (action ?? { type: "component.selected", payload: entry }) as TAction;
      },
    };
  }
  return commands;
}

/** Binds component Catalog Commands behavior and returns a disposer when applicable. */
export function bindComponentCatalogCommands<TAction extends Action = ComponentCatalogCommandAction>(
  registry: CommandRegistry<TAction>,
  options: ComponentCatalogCommandOptions<TAction> = {},
): () => void {
  return registry.registerAll(componentCatalogCommands<TAction>(options));
}

/** Creates a serializable inspection snapshot for component Catalog Commands. */
export function inspectComponentCatalogCommands(options: ComponentCatalogCommandOptions = {}) {
  const entries = options.entries ?? queryComponents(options.query);
  return {
    ...inspectComponentCatalog(entries),
    commandCount: entries.length,
    group: options.group ?? "components",
  };
}

function componentKeywords(entry: ComponentCatalogEntry): string[] {
  const keywords = new Array<string>(4 + entry.capabilities.length);
  keywords[0] = entry.id;
  keywords[1] = entry.name;
  keywords[2] = entry.category;
  keywords[3] = entry.description;
  for (let index = 0; index < entry.capabilities.length; index += 1) {
    keywords[index + 4] = entry.capabilities[index]!;
  }
  return keywords;
}
