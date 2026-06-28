// Copyright 2023 Im-Beast. MIT license.
import type { ThemeEnginePipeline } from "../theme_engine_pipeline.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type ThemePipelineCommandAction = Action<"theme.pipeline.step.changed", ThemePipelineStepChangedPayload>;

export interface ThemePipelineStepChangedPayload {
  pipelineId: string;
  id: string;
  enabled: boolean;
}

export interface ThemePipelineCommandOptions {
  group?: string;
  prefix?: string;
  includeToggleCommands?: boolean;
  includeEnableCommands?: boolean;
  includeDisableCommands?: boolean;
  disableInactiveStepStates?: boolean;
}

export function themePipelineCommands(
  pipeline: ThemeEnginePipeline,
  options: ThemePipelineCommandOptions = {},
): Command<ThemePipelineCommandAction>[] {
  const group = options.group ?? "theme";
  const prefix = options.prefix ?? `theme.pipeline.${pipeline.id}`;
  const commands: Command<ThemePipelineCommandAction>[] = [];
  const active = () => new Set(pipeline.activeIds());

  for (const step of pipeline.inspect().steps) {
    if (options.includeToggleCommands ?? true) {
      commands.push({
        id: `${prefix}.toggle.${step.id}`,
        label: `Toggle ${step.label}`,
        description: `Toggle the ${step.label} theme pipeline step.`,
        group,
        keywords: ["theme", "pipeline", "step", "toggle", pipeline.id, step.id, step.label],
        action: () => {
          pipeline.toggle(step.id);
          return {
            type: "theme.pipeline.step.changed",
            payload: { pipelineId: pipeline.id, id: step.id, enabled: pipeline.activeIds().includes(step.id) },
          };
        },
      });
    }

    if (options.includeEnableCommands ?? true) {
      commands.push({
        id: `${prefix}.enable.${step.id}`,
        label: `Enable ${step.label}`,
        description: `Enable the ${step.label} theme pipeline step.`,
        group,
        keywords: ["theme", "pipeline", "step", "enable", pipeline.id, step.id, step.label],
        disabled: options.disableInactiveStepStates ?? true ? () => active().has(step.id) : false,
        action: () => {
          pipeline.enable(step.id);
          return {
            type: "theme.pipeline.step.changed",
            payload: { pipelineId: pipeline.id, id: step.id, enabled: true },
          };
        },
      });
    }

    if (options.includeDisableCommands ?? true) {
      commands.push({
        id: `${prefix}.disable.${step.id}`,
        label: `Disable ${step.label}`,
        description: `Disable the ${step.label} theme pipeline step.`,
        group,
        keywords: ["theme", "pipeline", "step", "disable", pipeline.id, step.id, step.label],
        disabled: options.disableInactiveStepStates ?? true ? () => !active().has(step.id) : false,
        action: () => {
          pipeline.disable(step.id);
          return {
            type: "theme.pipeline.step.changed",
            payload: { pipelineId: pipeline.id, id: step.id, enabled: false },
          };
        },
      });
    }
  }

  return commands;
}

export function bindThemePipelineCommands<TAction extends Action = ThemePipelineCommandAction>(
  registry: CommandRegistry<TAction>,
  pipeline: ThemeEnginePipeline,
  options: ThemePipelineCommandOptions = {},
): () => void {
  return registry.registerAll(themePipelineCommands(pipeline, options) as unknown as Command<TAction>[]);
}
