// Copyright 2023 Im-Beast. MIT license.
import type { RuntimeRendererBackendController } from "../runtime/renderer_backends.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Action union emitted by runtime Renderer Backend Command command helpers. */
export type RuntimeRendererBackendCommandAction = Action<
  "runtime.renderer.changed",
  RuntimeRendererBackendChangedPayload
>;

/** Payload carried by runtime Renderer Backend Changed actions. */
export interface RuntimeRendererBackendChangedPayload {
  id: string;
  previousId: string;
  direction?: number;
  selected?: boolean;
}

/** Options for configuring runtime Renderer Backend Command. */
export interface RuntimeRendererBackendCommandOptions {
  group?: string;
  prefix?: string;
  includeCycleCommands?: boolean;
  includeBackendCommands?: boolean;
  includeSelectCommand?: boolean;
  disableActiveBackend?: boolean;
}

/** Builds command definitions for runtime Renderer Backend. */
export function runtimeRendererBackendCommands(
  controller: RuntimeRendererBackendController,
  options: RuntimeRendererBackendCommandOptions = {},
): Command<RuntimeRendererBackendCommandAction>[] {
  const group = options.group ?? "runtime";
  const prefix = options.prefix ?? "runtime.renderer";
  const commands: Command<RuntimeRendererBackendCommandAction>[] = [];

  if (options.includeCycleCommands ?? true) {
    commands.push(
      {
        id: `${prefix}.next`,
        label: "Next Renderer Backend",
        description: "Cycle to the next renderer backend.",
        group,
        keywords: ["runtime", "renderer", "backend", "next"],
        disabled: () => controller.ids().length <= 1,
        action: () => {
          const previousId = controller.activeId.peek();
          const id = controller.nextBackend();
          return { type: "runtime.renderer.changed", payload: { id, previousId, direction: 1 } };
        },
      },
      {
        id: `${prefix}.previous`,
        label: "Previous Renderer Backend",
        description: "Cycle to the previous renderer backend.",
        group,
        keywords: ["runtime", "renderer", "backend", "previous"],
        disabled: () => controller.ids().length <= 1,
        action: () => {
          const previousId = controller.activeId.peek();
          const id = controller.previousBackend();
          return { type: "runtime.renderer.changed", payload: { id, previousId, direction: -1 } };
        },
      },
    );
  }

  if (options.includeSelectCommand ?? true) {
    commands.push({
      id: `${prefix}.select`,
      label: "Select Renderer Backend",
      description: "Select the best available renderer backend for current runtime capabilities.",
      group,
      keywords: ["runtime", "renderer", "backend", "select", "auto"],
      disabled: () => controller.selected()?.id === controller.activeId.peek(),
      action: () => {
        const previousId = controller.activeId.peek();
        const id = controller.setSelectedBackend();
        return { type: "runtime.renderer.changed", payload: { id, previousId, selected: true } };
      },
    });
  }

  if (options.includeBackendCommands ?? true) {
    for (const backend of controller.registry.inspect(controller.capabilities())) {
      const currentBackend = () => controller.registry.get(backend.id)?.inspect(controller.capabilities());
      const unavailable = () => currentBackend()?.available !== true;
      commands.push({
        id: `${prefix}.set.${backend.id}`,
        label: `Renderer Backend: ${backend.label}`,
        description: backend.description ?? `Switch to the ${backend.label} renderer backend.`,
        group,
        keywords: [
          "runtime",
          "renderer",
          "backend",
          backend.id,
          backend.label,
          backend.strategy,
          ...backend.capabilities,
          ...backend.tags,
        ],
        disabled: () =>
          unavailable() || ((options.disableActiveBackend ?? true) && controller.activeId.peek() === backend.id),
        action: () => {
          const previousId = controller.activeId.peek();
          if (!unavailable()) controller.setBackend(backend.id);
          return { type: "runtime.renderer.changed", payload: { id: controller.activeId.peek(), previousId } };
        },
      });
    }
  }

  return commands;
}

/** Binds runtime Renderer Backend Commands behavior and returns a disposer when applicable. */
export function bindRuntimeRendererBackendCommands<
  TAction extends Action = RuntimeRendererBackendCommandAction,
>(
  registry: CommandRegistry<TAction>,
  controller: RuntimeRendererBackendController,
  options: RuntimeRendererBackendCommandOptions = {},
): () => void {
  return registry.registerAll(runtimeRendererBackendCommands(controller, options) as unknown as Command<TAction>[]);
}
