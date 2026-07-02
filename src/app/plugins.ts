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

/** Public interface describing an app Plugin Route. */
export interface AppPluginRoute<TRoute extends Route = Route> {
  route: TRoute;
  options?: RouteRegisterOptions;
  unregisterOptions?: RouteUnregisterOptions;
}

/** Public interface describing an app Plugin Definition. */
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

/** Serializable inspection snapshot for app Plugin Definition. */
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

/** Public interface describing an app Plugin Catalog Query. */
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

/** Serializable inspection snapshot for app Plugin Catalog. */
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

/** Structured report returned by app Plugin Catalog helpers. */
export interface AppPluginCatalogReport {
  plugins: AppPluginDefinitionInspection[];
  inspection: AppPluginCatalogInspection;
}

/** Options for configuring app Plugin Catalog Report. */
export interface AppPluginCatalogReportOptions<TAction extends Action = Action, TRoute extends Route = Route> {
  plugins: readonly AppPluginDefinition<TAction, TRoute>[];
  query?: AppPluginCatalogQuery;
}

/** Options for configuring app Plugin Catalog Markdown. */
export interface AppPluginCatalogMarkdownOptions<TAction extends Action = Action, TRoute extends Route = Route>
  extends AppPluginCatalogReportOptions<TAction, TRoute> {
  title?: string;
  includeSummary?: boolean;
}

/** Serializable inspection snapshot for app Plugin Definition Registry. */
export interface AppPluginDefinitionRegistryInspection extends AppPluginCatalogInspection {
  ids: string[];
  anonymous: number;
}

/** Creates an app Plugin. */
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

/** Creates a serializable inspection snapshot for app Plugin Definition. */
export function inspectAppPluginDefinition<TAction extends Action = Action, TRoute extends Route = Route>(
  definition: AppPluginDefinition<TAction, TRoute>,
): AppPluginDefinitionInspection {
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    tags: uniqueSorted(definition.tags ?? []),
    routes: pluginRouteIds(definition.routes ?? []),
    actionMiddleware: definition.actionMiddleware?.length ?? 0,
    commands: commandIds(definition.commands ?? []),
    keyBindings: keyBindingIds(definition.keyBindings ?? []),
    focusItems: definition.focusItems?.length ?? 0,
    mouseTargets: mouseTargetIds(definition.mouseTargets ?? []),
    workloadSources: workloadSourceIds(definition.workloadSources ?? []),
    hasInstaller: definition.install !== undefined,
  };
}

/** Queries app Plugin Definitions records with deterministic filtering. */
export function queryAppPluginDefinitions<TAction extends Action = Action, TRoute extends Route = Route>(
  definitions: readonly AppPluginDefinition<TAction, TRoute>[],
  query: AppPluginCatalogQuery = {},
): AppPluginDefinitionInspection[] {
  const matches: AppPluginDefinitionInspection[] = [];
  for (const definition of definitions) {
    const inspection = inspectAppPluginDefinition(definition);
    if (matchesPluginQuery(inspection, query)) matches.push(inspection);
  }
  return matches.sort(comparePluginInspections);
}

/** Creates a serializable inspection snapshot for app Plugin Catalog. */
export function inspectAppPluginCatalog(
  plugins: readonly AppPluginDefinitionInspection[],
): AppPluginCatalogInspection {
  let routeCount = 0;
  let commandCount = 0;
  let keyBindingCount = 0;
  let focusItemCount = 0;
  let mouseTargetCount = 0;
  let workloadSourceCount = 0;
  let actionMiddlewareCount = 0;
  let installerCount = 0;
  const tags = new Set<string>();
  for (const plugin of plugins) {
    routeCount += plugin.routes.length;
    commandCount += plugin.commands.length;
    keyBindingCount += plugin.keyBindings.length;
    focusItemCount += plugin.focusItems;
    mouseTargetCount += plugin.mouseTargets.length;
    workloadSourceCount += plugin.workloadSources.length;
    actionMiddlewareCount += plugin.actionMiddleware;
    if (plugin.hasInstaller) installerCount += 1;
    for (const tag of plugin.tags) tags.add(tag);
  }
  return {
    count: plugins.length,
    routeCount,
    commandCount,
    keyBindingCount,
    focusItemCount,
    mouseTargetCount,
    workloadSourceCount,
    actionMiddlewareCount,
    installerCount,
    tags: uniqueSorted(tags),
  };
}

/** Creates an app Plugin Catalog Report. */
export function createAppPluginCatalogReport<TAction extends Action = Action, TRoute extends Route = Route>(
  options: AppPluginCatalogReportOptions<TAction, TRoute>,
): AppPluginCatalogReport {
  const plugins = queryAppPluginDefinitions(options.plugins, options.query);
  return {
    plugins,
    inspection: inspectAppPluginCatalog(plugins),
  };
}

/** Formats app Plugin Catalog Markdown for display or diagnostics. */
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

/** Registry for storing and querying app Plugin Definition definitions. */
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
    const definitions = new Array<AppPluginDefinition<TAction, TRoute>>(this.#definitions.length);
    for (let index = 0; index < this.#definitions.length; index += 1) {
      definitions[index] = this.#definitions[index]!;
    }
    return definitions;
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
      ids: pluginDefinitionIds(this.#definitions),
      anonymous: anonymousPluginDefinitionCount(this.#definitions),
    };
  }

  clear(): void {
    this.#definitions.length = 0;
  }
}

/** Creates an app Plugin Definition Registry. */
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
  const terms = query.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  for (const term of terms) {
    if (!pluginSearchIncludes(plugin, term)) return false;
  }
  return true;
}

function pluginRouteIds<TRoute extends Route>(routes: readonly (TRoute | AppPluginRoute<TRoute>)[]): string[] {
  const ids = new Array<string>(routes.length);
  for (let index = 0; index < routes.length; index += 1) {
    ids[index] = normalizePluginRoute(routes[index]!).route.id;
  }
  return ids;
}

function commandIds<TAction extends Action>(commands: readonly Command<TAction>[]): string[] {
  const ids = new Array<string>(commands.length);
  for (let index = 0; index < commands.length; index += 1) {
    ids[index] = commands[index]!.id;
  }
  return ids;
}

function keyBindingIds(bindings: readonly KeyBinding[]): string[] {
  const ids = new Array<string>(bindings.length);
  for (let index = 0; index < bindings.length; index += 1) {
    ids[index] = bindingId(bindings[index]!);
  }
  return ids;
}

function mouseTargetIds(targets: readonly MouseInteractionTarget[]): string[] {
  const ids = new Array<string>(targets.length);
  for (let index = 0; index < targets.length; index += 1) {
    ids[index] = targets[index]!.id;
  }
  return ids;
}

function workloadSourceIds(sources: readonly RuntimeWorkloadSource[]): string[] {
  const ids = new Array<string>(sources.length);
  for (let index = 0; index < sources.length; index += 1) {
    ids[index] = sources[index]!.id;
  }
  return ids;
}

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  const set = new Set<T>();
  for (const value of values) set.add(value);
  const output: T[] = [];
  for (const value of set) output.push(value);
  return output.sort();
}

function comparePluginInspections(left: AppPluginDefinitionInspection, right: AppPluginDefinitionInspection): number {
  return (left.label ?? left.id ?? "").localeCompare(right.label ?? right.id ?? "");
}

function pluginDefinitionIds<TAction extends Action, TRoute extends Route>(
  definitions: readonly AppPluginDefinition<TAction, TRoute>[],
): string[] {
  const ids: string[] = [];
  for (const definition of definitions) {
    const id = pluginDefinitionKey(definition);
    if (id) ids.push(id);
  }
  return ids.sort();
}

function anonymousPluginDefinitionCount<TAction extends Action, TRoute extends Route>(
  definitions: readonly AppPluginDefinition<TAction, TRoute>[],
): number {
  let count = 0;
  for (const definition of definitions) {
    if (!pluginDefinitionKey(definition)) count += 1;
  }
  return count;
}

function pluginSearchIncludes(plugin: AppPluginDefinitionInspection, term: string): boolean {
  if (plugin.id?.toLowerCase().includes(term)) return true;
  if (plugin.label?.toLowerCase().includes(term)) return true;
  if (plugin.description?.toLowerCase().includes(term)) return true;
  if (stringArrayIncludes(plugin.tags, term)) return true;
  if (stringArrayIncludes(plugin.routes, term)) return true;
  if (stringArrayIncludes(plugin.commands, term)) return true;
  if (stringArrayIncludes(plugin.keyBindings, term)) return true;
  if (stringArrayIncludes(plugin.mouseTargets, term)) return true;
  return stringArrayIncludes(plugin.workloadSources, term);
}

function stringArrayIncludes(values: readonly string[], term: string): boolean {
  for (const value of values) {
    if (value.toLowerCase().includes(term)) return true;
  }
  return false;
}
