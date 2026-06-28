// Copyright 2023 Im-Beast. MIT license.
export interface Action<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload?: TPayload;
}

export type ActionHandler<TAction extends Action = Action> = (action: TAction) => void | Promise<void>;
export type ActionOfType<TAction extends Action, TType extends TAction["type"]> = Extract<TAction, { type: TType }>;

export class ActionBus<TAction extends Action = Action> {
  private readonly handlers = new Set<ActionHandler<TAction>>();

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

  async dispatch(action: TAction): Promise<void> {
    for (const handler of this.handlers) {
      await handler(action);
    }
  }
}
