// Copyright 2023 Im-Beast. MIT license.
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";
import type { Route, RouteManager } from "./router.ts";

/** Public interface describing a history Transaction. */
export interface HistoryTransaction {
  id?: string;
  label: string;
  group?: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

/** Options for configuring history Stack. */
export interface HistoryStackOptions {
  capacity?: number;
}

/** Serializable inspection snapshot for history. */
export interface HistoryInspection {
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
  nextUndo?: HistoryEntryInspection;
  nextRedo?: HistoryEntryInspection;
}

/** Serializable inspection snapshot for history Entry. */
export interface HistoryEntryInspection {
  id?: string;
  label: string;
  group?: string;
}

/** Public class implementing a history Stack. */
export class HistoryStack {
  readonly #undoStack: HistoryTransaction[] = [];
  readonly #redoStack: HistoryTransaction[] = [];
  readonly #capacity: number;

  constructor(options: HistoryStackOptions = {}) {
    this.#capacity = Math.max(1, Math.floor(options.capacity ?? 100));
  }

  get undoDepth(): number {
    return this.#undoStack.length;
  }

  get redoDepth(): number {
    return this.#redoStack.length;
  }

  canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  push(transaction: HistoryTransaction): void {
    this.#undoStack.push(transaction);
    while (this.#undoStack.length > this.#capacity) {
      this.#undoStack.shift();
    }
    this.#redoStack.length = 0;
  }

  async apply(transaction: HistoryTransaction): Promise<void> {
    await transaction.redo();
    this.push(transaction);
  }

  async undo(): Promise<boolean> {
    const transaction = this.#undoStack.pop();
    if (!transaction) return false;
    await transaction.undo();
    this.#redoStack.push(transaction);
    return true;
  }

  async redo(): Promise<boolean> {
    const transaction = this.#redoStack.pop();
    if (!transaction) return false;
    await transaction.redo();
    this.#undoStack.push(transaction);
    return true;
  }

  clear(): void {
    this.#undoStack.length = 0;
    this.#redoStack.length = 0;
  }

  inspect(): HistoryInspection {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDepth: this.undoDepth,
      redoDepth: this.redoDepth,
      nextUndo: inspectEntry(this.#undoStack.at(-1)),
      nextRedo: inspectEntry(this.#redoStack.at(-1)),
    };
  }
}

function inspectEntry(transaction: HistoryTransaction | undefined): HistoryEntryInspection | undefined {
  return transaction
    ? {
      id: transaction.id,
      label: transaction.label,
      group: transaction.group,
    }
    : undefined;
}

/** Identifier union for history Command variants. */
export type HistoryCommandKind = "undo" | "redo" | "clear";

/** Options for configuring history Command. */
export interface HistoryCommandOptions {
  idPrefix?: string;
  group?: string;
  includeClear?: boolean;
  labels?: Partial<Record<HistoryCommandKind, string>>;
}

/** Options for configuring route History Binding. */
export interface RouteHistoryBindingOptions<TRoute extends Route = Route> {
  group?: string;
  label?: (previousRoute: TRoute, nextRoute: TRoute) => string;
  id?: (previousRoute: TRoute, nextRoute: TRoute) => string;
  navigate?: (routeId: string) => void | Promise<void>;
}

/** Binds route History behavior and returns a disposer when applicable. */
export function bindRouteHistory<TRoute extends Route = Route>(
  routes: RouteManager<TRoute>,
  history: HistoryStack,
  options: RouteHistoryBindingOptions<TRoute> = {},
): () => void {
  let previousId = routes.activeRouteId.peek();
  let replaying = false;

  const routeById = (id: string) => routes.routes.peek().find((route) => route.id === id);
  const navigate = options.navigate ?? ((routeId: string) => routes.navigate(routeId));
  const replay = async (routeId: string) => {
    replaying = true;
    try {
      await navigate(routeId);
      previousId = routeId;
    } finally {
      replaying = false;
    }
  };

  const listener = (nextId: string) => {
    if (replaying || nextId === previousId) return;
    const previousRoute = routeById(previousId);
    const nextRoute = routeById(nextId);
    previousId = nextId;
    if (!previousRoute || !nextRoute) return;

    history.push({
      id: options.id?.(previousRoute, nextRoute) ?? `route.${previousRoute.id}.${nextRoute.id}`,
      label: options.label?.(previousRoute, nextRoute) ??
        `Route ${previousRoute.title ?? previousRoute.id} -> ${nextRoute.title ?? nextRoute.id}`,
      group: options.group ?? "routes",
      undo: () => replay(previousRoute.id),
      redo: () => replay(nextRoute.id),
    });
  };

  routes.activeRouteId.subscribe(listener);

  return () => {
    routes.activeRouteId.unsubscribe(listener);
  };
}

/** Builds command definitions for history. */
export function historyCommands<TAction extends Action = Action>(
  history: HistoryStack,
  options: HistoryCommandOptions = {},
): Command<TAction>[] {
  const idPrefix = options.idPrefix ?? "history";
  const group = options.group ?? "history";
  const label = (kind: HistoryCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const commands: Command<TAction>[] = [
    {
      id: `${idPrefix}.undo`,
      label: label("undo", "Undo"),
      group,
      binding: { key: "z", ctrl: true },
      disabled: () => !history.canUndo(),
      action: async () => {
        await history.undo();
      },
    },
    {
      id: `${idPrefix}.redo`,
      label: label("redo", "Redo"),
      group,
      binding: { key: "y", ctrl: true },
      disabled: () => !history.canRedo(),
      action: async () => {
        await history.redo();
      },
    },
  ];

  if (options.includeClear ?? false) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear History"),
      group,
      disabled: () => !history.canUndo() && !history.canRedo(),
      action: () => history.clear(),
    });
  }

  return commands;
}

/** Binds history Commands behavior and returns a disposer when applicable. */
export function bindHistoryCommands<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  history: HistoryStack,
  options: HistoryCommandOptions = {},
): () => void {
  return registry.registerAll(historyCommands<TAction>(history, options));
}
