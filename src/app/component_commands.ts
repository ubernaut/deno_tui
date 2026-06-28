// Copyright 2023 Im-Beast. MIT license.
import {
  type ComponentCatalogEntry,
  type ComponentCatalogQuery,
  inspectComponentCatalog,
  queryComponents,
} from "../components/catalog.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type ComponentCatalogCommandAction = Action<"component.selected", ComponentCatalogEntry>;

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

export function componentCatalogCommands<TAction extends Action = ComponentCatalogCommandAction>(
  options: ComponentCatalogCommandOptions<TAction> = {},
): Command<TAction>[] {
  const idPrefix = options.idPrefix ?? "component";
  const group = options.group ?? "components";
  const entries = options.entries ?? queryComponents(options.query);

  return entries.map((entry) => ({
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
  }));
}

export function bindComponentCatalogCommands<TAction extends Action = ComponentCatalogCommandAction>(
  registry: CommandRegistry<TAction>,
  options: ComponentCatalogCommandOptions<TAction> = {},
): () => void {
  return registry.registerAll(componentCatalogCommands<TAction>(options));
}

export function inspectComponentCatalogCommands(options: ComponentCatalogCommandOptions = {}) {
  const entries = options.entries ?? queryComponents(options.query);
  return {
    ...inspectComponentCatalog(entries),
    commandCount: entries.length,
    group: options.group ?? "components",
  };
}

function componentKeywords(entry: ComponentCatalogEntry): string[] {
  return [
    entry.id,
    entry.name,
    entry.category,
    entry.description,
    ...entry.capabilities,
  ];
}
