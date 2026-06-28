// Copyright 2023 Im-Beast. MIT license.
export interface Action<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload?: TPayload;
}

export type ActionHandler<TAction extends Action = Action> = (action: TAction) => void | Promise<void>;

export class ActionBus<TAction extends Action = Action> {
  private readonly handlers = new Set<ActionHandler<TAction>>();

  subscribe(handler: ActionHandler<TAction>): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async dispatch(action: TAction): Promise<void> {
    for (const handler of this.handlers) {
      await handler(action);
    }
  }
}
