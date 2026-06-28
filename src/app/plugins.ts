// Copyright 2023 Im-Beast. MIT license.
import type { Focusable } from "../focus.ts";
import { bindingId, type KeyBinding } from "../keymap.ts";
import type { RuntimeWorkloadSource } from "../runtime/telemetry.ts";
import type { Action, ActionMiddleware } from "./actions.ts";
import type { AppPlugin, AppPluginDisposer, TuiApp } from "./app.ts";
import type { Command } from "./commands.ts";
import { DisposableStack } from "./disposables.ts";
import type { MouseInteractionTarget } from "./mouse_bindings.ts";
import type { Route, RouteRegisterOptions, RouteUnregisterOptions } from "./router.ts";

export interface AppPluginRoute<TRoute extends Route = Route> {
  route: TRoute;
  options?: RouteRegisterOptions;
  unregisterOptions?: RouteUnregisterOptions;
}

export interface AppPluginDefinition<TAction extends Action = Action, TRoute extends Route = Route> {
  id?: string;
  label?: string;
  description?: string;
  tags?: readonly string[];
  routes?: readonly (TRoute | AppPluginRoute<TRoute>)[];
  actionMiddleware?: readonly ActionMiddleware<TAction>[];
  commands?: readonly Command<TAction>[];
  keyBindings?: readonly KeyBinding[];
  focusItems?: readonly Focusable[];
  mouseTargets?: readonly MouseInteractionTarget[];
  workloadSources?: readonly RuntimeWorkloadSource[];
  install?: (app: TuiApp<TAction, TRoute>) => AppPluginDisposer;
}

export interface AppPluginDefinitionInspection {
  id?: string;
  label?: string;
  description?: string;
  tags: string[];
  routes: string[];
  actionMiddleware: number;
  commands: string[];
  keyBindings: string[];
  focusItems: number;
  mouseTargets: string[];
  workloadSources: string[];
  hasInstaller: boolean;
}

export interface AppPluginCatalogQuery {
  search?: string;
  tag?: string;
  hasRoutes?: boolean;
  hasCommands?: boolean;
  hasKeyBindings?: boolean;
  hasFocusItems?: boolean;
  hasMouseTargets?: boolean;
  hasWorkloadSources?: boolean;
  hasActionMiddleware?: boolean;
  hasInstaller?: boolean;
}

export interface AppPluginCatalogInspection {
  count: number;
  routeCount: number;
  commandCount: number;
  keyBindingCount: number;
  focusItemCount: number;
  mouseTargetCount: number;
  workloadSourceCount: number;
  actionMiddlewareCount: number;
  installerCount: number;
  tags: string[];
}

export interface AppPluginCatalogReport {
  plugins: AppPluginDefinitionInspection[];
  inspection: AppPluginCatalogInspection;
}

export interface AppPluginCatalogReportOptions<TAction extends Action = Action, TRoute extends Route = Route> {
  plugins: readonly AppPluginDefinition<TAction, TRoute>[];
  query?: AppPluginCatalogQuery;
}

export interface AppPluginCatalogMarkdownOptions<TAction extends Action = Action, TRoute extends Route = Route>
  extends AppPluginCatalogReportOptions<TAction, TRoute> {
  title?: string;
  includeSummary?: boolean;
}

export interface AppPluginDefinitionRegistryInspection extends AppPluginCatalogInspection {
  ids: string[];
  anonymous: number;
}

export function createAppPlugin<TAction extends Action = Action, TRoute extends Route = Route>(
  definition: AppPluginDefinition<TAction, TRoute>,
): AppPlugin<TAction, TRoute> {
  return {
    id: definition.id,
    label: definition.label,
    install(app) {
      const stack = new DisposableStack();
      try {
        for (const entry of definition.routes ?? []) {
          const routeEntry = normalizePluginRoute(entry);
          app.routes.register(routeEntry.route, routeEntry.options);
          stack.defer(() => app.routes.unregister(routeEntry.route.id, routeEntry.unregisterOptions));
        }

        if (definition.commands?.length) {
          stack.defer(app.commands.registerAll(definition.commands));
        }

        for (const middleware of definition.actionMiddleware ?? []) {
          stack.defer(app.useActionMiddleware(middleware));
        }

        if (definition.keyBindings?.length) {
          stack.defer(app.keymap.registerAll(definition.keyBindings));
        }

        if (definition.focusItems?.length) {
          stack.defer(app.focus.registerAll(definition.focusItems));
        }

        for (const target of definition.mouseTargets ?? []) {
          stack.defer(app.mouse.register(target));
        }

        for (const source of definition.workloadSources ?? []) {
          stack.defer(app.workloads.register(source));
        }

        stack.defer(definition.install?.(app));
      } catch (error) {
        stack.dispose();
        throw error;
      }

      return stack.dispose;
    },
  };
}

export function inspectAppPluginDefinition<TAction extends Action = Action, TRoute extends Route = Route>(
  definition: AppPluginDefinition<TAction, TRoute>,
): AppPluginDefinitionInspection {
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    tags: [...new Set(definition.tags ?? [])].sort(),
    routes: (definition.routes ?? []).map((entry) => normalizePluginRoute(entry).route.id),
    actionMiddleware: definition.actionMiddleware?.length ?? 0,
    commands: (definition.commands ?? []).map((command) => command.id),
    keyBindings: (definition.keyBindings ?? []).map(bindingId),
    focusItems: definition.focusItems?.length ?? 0,
    mouseTargets: (definition.mouseTargets ?? []).map((target) => target.id),
    workloadSources: (definition.workloadSources ?? []).map((source) => source.id),
    hasInstaller: definition.install !== undefined,
  };
}

export function queryAppPluginDefinitions<TAction extends Action = Action, TRoute extends Route = Route>(
  definitions: readonly AppPluginDefinition<TAction, TRoute>[],
  query: AppPluginCatalogQuery = {},
): AppPluginDefinitionInspection[] {
  return definitions
    .map(inspectAppPluginDefinition)
    .filter((plugin) => matchesPluginQuery(plugin, query))
    .sort((left, right) => (left.label ?? left.id ?? "").localeCompare(right.label ?? right.id ?? ""));
}

export function inspectAppPluginCatalog(
  plugins: readonly AppPluginDefinitionInspection[],
): AppPluginCatalogInspection {
  return {
    count: plugins.length,
    routeCount: plugins.reduce((total, plugin) => total + plugin.routes.length, 0),
    commandCount: plugins.reduce((total, plugin) => total + plugin.commands.length, 0),
    keyBindingCount: plugins.reduce((total, plugin) => total + plugin.keyBindings.length, 0),
    focusItemCount: plugins.reduce((total, plugin) => total + plugin.focusItems, 0),
    mouseTargetCount: plugins.reduce((total, plugin) => total + plugin.mouseTargets.length, 0),
    workloadSourceCount: plugins.reduce((total, plugin) => total + plugin.workloadSources.length, 0),
    actionMiddlewareCount: plugins.reduce((total, plugin) => total + plugin.actionMiddleware, 0),
    installerCount: plugins.filter((plugin) => plugin.hasInstaller).length,
    tags: [...new Set(plugins.flatMap((plugin) => plugin.tags))].sort(),
  };
}

export function createAppPluginCatalogReport<TAction extends Action = Action, TRoute extends Route = Route>(
  options: AppPluginCatalogReportOptions<TAction, TRoute>,
): AppPluginCatalogReport {
  const plugins = queryAppPluginDefinitions(options.plugins, options.query);
  return {
    plugins,
    inspection: inspectAppPluginCatalog(plugins),
  };
}

export function formatAppPluginCatalogMarkdown<TAction extends Action = Action, TRoute extends Route = Route>(
  options: AppPluginCatalogMarkdownOptions<TAction, TRoute>,
): string {
  const report = createAppPluginCatalogReport(options);
  const lines = [`# ${options.title ?? "App Plugin Catalog"}`, ""];
  if (options.includeSummary ?? true) {
    lines.push(
      `${report.inspection.count} plugins, ${report.inspection.routeCount} routes, ${report.inspection.commandCount} commands, ${report.inspection.keyBindingCount} key bindings, ${report.inspection.mouseTargetCount} mouse targets, ${report.inspection.workloadSourceCount} workload sources.`,
      "",
    );
  }
  lines.push("| Plugin | Tags | Routes | Commands | Key Bindings | Mouse | Workloads | Installer |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const plugin of report.plugins) {
    lines.push(
      `| ${plugin.label ?? plugin.id ?? "plugin"} | ${
        plugin.tags.join(", ") || "-"
      } | ${plugin.routes.length} | ${plugin.commands.length} | ${plugin.keyBindings.length} | ${plugin.mouseTargets.length} | ${plugin.workloadSources.length} | ${
        plugin.hasInstaller ? "yes" : "no"
      } |`,
    );
  }
  return lines.join("\n");
}

export class AppPluginDefinitionRegistry<TAction extends Action = Action, TRoute extends Route = Route> {
  readonly #definitions: AppPluginDefinition<TAction, TRoute>[] = [];

  constructor(definitions: readonly AppPluginDefinition<TAction, TRoute>[] = []) {
    this.registerAll(definitions);
  }

  register(definition: AppPluginDefinition<TAction, TRoute>): () => void {
    const id = pluginDefinitionKey(definition);
    if (id) {
      this.unregister(id);
    }
    this.#definitions.push(definition);
    return () => {
      const index = this.#definitions.indexOf(definition);
      if (index >= 0) {
        this.#definitions.splice(index, 1);
      }
    };
  }

  registerAll(definitions: Iterable<AppPluginDefinition<TAction, TRoute>>): () => void {
    const stack = new DisposableStack();
    try {
      for (const definition of definitions) {
        stack.defer(this.register(definition));
      }
    } catch (error) {
      stack.dispose();
      throw error;
    }
    return stack.dispose;
  }

  unregister(id: string): boolean {
    const index = this.#definitions.findIndex((definition) => pluginDefinitionKey(definition) === id);
    if (index < 0) return false;
    this.#definitions.splice(index, 1);
    return true;
  }

  get(id: string): AppPluginDefinition<TAction, TRoute> | undefined {
    return this.#definitions.find((definition) => pluginDefinitionKey(definition) === id);
  }

  has(id: string): boolean {
    return this.get(id) !== undefined;
  }

  definitions(): AppPluginDefinition<TAction, TRoute>[] {
    return [...this.#definitions];
  }

  query(query: AppPluginCatalogQuery = {}): AppPluginDefinitionInspection[] {
    return queryAppPluginDefinitions(this.#definitions, query);
  }

  report(query?: AppPluginCatalogQuery): AppPluginCatalogReport {
    return createAppPluginCatalogReport({ plugins: this.#definitions, query });
  }

  markdown(options: Omit<AppPluginCatalogMarkdownOptions<TAction, TRoute>, "plugins"> = {}): string {
    return formatAppPluginCatalogMarkdown({ ...options, plugins: this.#definitions });
  }

  inspect(): AppPluginDefinitionRegistryInspection {
    const report = this.report();
    return {
      ...report.inspection,
      ids: this.#definitions.map(pluginDefinitionKey).filter((id): id is string => !!id).sort(),
      anonymous: this.#definitions.filter((definition) => !pluginDefinitionKey(definition)).length,
    };
  }

  clear(): void {
    this.#definitions.length = 0;
  }
}

export function createAppPluginDefinitionRegistry<TAction extends Action = Action, TRoute extends Route = Route>(
  definitions: readonly AppPluginDefinition<TAction, TRoute>[] = [],
): AppPluginDefinitionRegistry<TAction, TRoute> {
  return new AppPluginDefinitionRegistry(definitions);
}

function normalizePluginRoute<TRoute extends Route>(
  entry: TRoute | AppPluginRoute<TRoute>,
): AppPluginRoute<TRoute> {
  return "route" in entry ? entry : { route: entry };
}

function pluginDefinitionKey<TAction extends Action, TRoute extends Route>(
  definition: AppPluginDefinition<TAction, TRoute>,
): string | undefined {
  return definition.id ?? definition.label;
}

function matchesPluginQuery(plugin: AppPluginDefinitionInspection, query: AppPluginCatalogQuery): boolean {
  if (query.tag && !plugin.tags.includes(query.tag)) return false;
  if (query.hasRoutes !== undefined && (plugin.routes.length > 0) !== query.hasRoutes) return false;
  if (query.hasCommands !== undefined && (plugin.commands.length > 0) !== query.hasCommands) return false;
  if (query.hasKeyBindings !== undefined && (plugin.keyBindings.length > 0) !== query.hasKeyBindings) return false;
  if (query.hasFocusItems !== undefined && (plugin.focusItems > 0) !== query.hasFocusItems) return false;
  if (query.hasMouseTargets !== undefined && (plugin.mouseTargets.length > 0) !== query.hasMouseTargets) return false;
  if (
    query.hasWorkloadSources !== undefined &&
    (plugin.workloadSources.length > 0) !== query.hasWorkloadSources
  ) return false;
  if (
    query.hasActionMiddleware !== undefined &&
    (plugin.actionMiddleware > 0) !== query.hasActionMiddleware
  ) return false;
  if (query.hasInstaller !== undefined && plugin.hasInstaller !== query.hasInstaller) return false;
  if (!query.search) return true;
  const needle = query.search.trim().toLowerCase();
  const haystack = [
    plugin.id,
    plugin.label,
    plugin.description,
    ...plugin.tags,
    ...plugin.routes,
    ...plugin.commands,
    ...plugin.keyBindings,
    ...plugin.mouseTargets,
    ...plugin.workloadSources,
  ].join(" ").toLowerCase();
  return needle.split(/\s+/).every((part) => haystack.includes(part));
}
