// Copyright 2023 Im-Beast. MIT license.
export interface Action<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload?: TPayload;
}

/** Function that sends an action to the next action middleware or subscribers. */
export type ActionDispatch<TAction extends Action = Action> = (action: TAction) => void | Promise<void>;

export type ActionHandler<TAction extends Action = Action> = (action: TAction) => void | Promise<void>;
export type ActionOfType<TAction extends Action, TType extends TAction["type"]> = Extract<TAction, { type: TType }>;

/** Middleware that can observe, transform, or stop action dispatch. */
export type ActionMiddleware<TAction extends Action = Action> = (
  action: TAction,
  next: ActionDispatch<TAction>,
) => void | Promise<void>;

/** Serializable action bus status for diagnostics and status bars. */
export interface ActionBusInspection {
  handlers: number;
  middleware: number;
  dispatching: boolean;
}

export class ActionBus<TAction extends Action = Action> {
  private readonly handlers = new Set<ActionHandler<TAction>>();
  private readonly middleware = new Set<ActionMiddleware<TAction>>();
  private dispatchDepth = 0;

  subscribe(handler: ActionHandler<TAction>): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  subscribeType<TType extends TAction["type"]>(
    type: TType,
    handler: ActionHandler<ActionOfType<TAction, TType>>,
  ): () => void {
    return this.subscribe((action) => {
      if (action.type === type) {
        return handler(action as ActionOfType<TAction, TType>);
      }
    });
  }

  use(middleware: ActionMiddleware<TAction>): () => void {
    this.middleware.add(middleware);
    return () => this.middleware.delete(middleware);
  }

  async dispatch(action: TAction): Promise<void> {
    this.dispatchDepth++;
    try {
      await this.dispatchMiddleware([...this.middleware], action);
    } finally {
      this.dispatchDepth--;
    }
  }

  inspect(): ActionBusInspection {
    return {
      handlers: this.handlers.size,
      middleware: this.middleware.size,
      dispatching: this.dispatchDepth > 0,
    };
  }

  private async dispatchMiddleware(
    middleware: readonly ActionMiddleware<TAction>[],
    action: TAction,
    index = 0,
  ): Promise<void> {
    const next = middleware[index];
    if (!next) {
      await this.dispatchHandlers(action);
      return;
    }
    await next(action, (nextAction) => this.dispatchMiddleware(middleware, nextAction, index + 1));
  }

  private async dispatchHandlers(action: TAction): Promise<void> {
    for (const handler of this.handlers) {
      await handler(action);
    }
  }
}
