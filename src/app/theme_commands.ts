// Copyright 2023 Im-Beast. MIT license.
import { previewThemeProvider, type ThemeLayerStack, type ThemeProvider } from "../theme.ts";
import type { ThemeProviderPreview, ThemeProviderPreviewOptions } from "../theme.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Action union emitted by theme Command command helpers. */
export type ThemeCommandAction =
  | Action<"theme.changed", ThemeChangedPayload>
  | Action<"theme.layer.changed", ThemeLayerChangedPayload>
  | Action<"theme.previewed", ThemePreviewPayload>;

/** Payload carried by theme Changed actions. */
export interface ThemeChangedPayload {
  id: string;
  previousId: string;
  direction?: number;
}

/** Payload carried by theme Layer Changed actions. */
export interface ThemeLayerChangedPayload {
  id: string;
  enabled: boolean;
}

/** Payload carried by theme Preview actions. */
export interface ThemePreviewPayload {
  preview: ThemeProviderPreview;
}

/** Options for configuring theme Command. */
export interface ThemeCommandOptions {
  group?: string;
  themePrefix?: string;
  layerPrefix?: string;
  previewPrefix?: string;
  includeCycleCommands?: boolean;
  includeThemeCommands?: boolean;
  includeLayerCommands?: boolean;
  includePreviewCommand?: boolean;
  disableActiveTheme?: boolean;
  disableInactiveLayerStates?: boolean;
  preview?: ThemeProviderPreviewOptions;
}

/** Builds command definitions for theme. */
export function themeCommands(
  provider: ThemeProvider,
  options: ThemeCommandOptions = {},
): Command<ThemeCommandAction>[] {
  return [
    ...themeSelectionCommands(provider, options),
    ...themeLayerCommands(provider, options),
    ...themePreviewCommands(provider, options),
  ];
}

/** Binds theme Commands behavior and returns a disposer when applicable. */
export function bindThemeCommands<TAction extends Action = ThemeCommandAction>(
  registry: CommandRegistry<TAction>,
  provider: ThemeProvider,
  options: ThemeCommandOptions = {},
): () => void {
  return registry.registerAll(themeCommands(provider, options) as unknown as Command<TAction>[]);
}

/** Builds command definitions for theme Selection. */
export function themeSelectionCommands(
  provider: ThemeProvider,
  options: ThemeCommandOptions = {},
): Command<ThemeCommandAction>[] {
  const group = options.group ?? "theme";
  const prefix = options.themePrefix ?? "theme";
  const commands: Command<ThemeCommandAction>[] = [];

  if (options.includeCycleCommands ?? true) {
    commands.push(
      {
        id: `${prefix}.next`,
        label: "Next Theme",
        description: "Cycle to the next registered theme pack.",
        group,
        keywords: ["theme", "next", "cycle"],
        action: () => {
          const previousId = provider.activeId.peek();
          const id = provider.nextTheme();
          return { type: "theme.changed", payload: { id, previousId, direction: 1 } };
        },
      },
      {
        id: `${prefix}.previous`,
        label: "Previous Theme",
        description: "Cycle to the previous registered theme pack.",
        group,
        keywords: ["theme", "previous", "cycle"],
        action: () => {
          const previousId = provider.activeId.peek();
          const id = provider.previousTheme();
          return { type: "theme.changed", payload: { id, previousId, direction: -1 } };
        },
      },
    );
  }

  if (options.includeThemeCommands ?? true) {
    for (const id of provider.themeIds()) {
      const pack = provider.registry.get(id);
      commands.push({
        id: `${prefix}.set.${id}`,
        label: `Theme: ${pack?.label ?? id}`,
        description: `Switch to the ${pack?.label ?? id} theme pack.`,
        group,
        keywords: ["theme", "set", id, pack?.label ?? id],
        disabled: options.disableActiveTheme ?? true ? () => provider.activeId.peek() === id : false,
        action: () => {
          const previousId = provider.activeId.peek();
          provider.setTheme(id);
          return { type: "theme.changed", payload: { id: provider.activeId.peek(), previousId } };
        },
      });
    }
  }

  return commands;
}

/** Builds command definitions for theme Preview. */
export function themePreviewCommands(
  provider: ThemeProvider,
  options: ThemeCommandOptions = {},
): Command<ThemeCommandAction>[] {
  if (!(options.includePreviewCommand ?? true)) return [];

  const group = options.group ?? "theme";
  const prefix = options.previewPrefix ?? "theme.preview";
  return [
    {
      id: `${prefix}.snapshot`,
      label: "Preview Theme",
      description: "Capture the active theme provider catalog and rendered style samples.",
      group,
      keywords: ["theme", "preview", "catalog", "tokens", "layers"],
      action: () => ({
        type: "theme.previewed",
        payload: { preview: previewThemeProvider(provider, options.preview) },
      }),
    },
  ];
}

/** Builds command definitions for theme Layer. */
export function themeLayerCommands(
  target: ThemeProvider | ThemeLayerStack,
  options: ThemeCommandOptions = {},
): Command<ThemeCommandAction>[] {
  const layers = "layers" in target ? target.layers : target;
  const group = options.group ?? "theme";
  const prefix = options.layerPrefix ?? "theme.layer";
  const commands: Command<ThemeCommandAction>[] = [];

  if (!(options.includeLayerCommands ?? true)) return commands;

  for (const layer of layers.inspect()) {
    commands.push(
      {
        id: `${prefix}.toggle.${layer.id}`,
        label: `Toggle ${layer.label}`,
        description: `Toggle the ${layer.label} theme layer.`,
        group,
        keywords: ["theme", "layer", "toggle", layer.id, layer.label],
        action: () => {
          layers.toggle(layer.id);
          return {
            type: "theme.layer.changed",
            payload: { id: layer.id, enabled: layers.activeIds().includes(layer.id) },
          };
        },
      },
      {
        id: `${prefix}.enable.${layer.id}`,
        label: `Enable ${layer.label}`,
        description: `Enable the ${layer.label} theme layer.`,
        group,
        keywords: ["theme", "layer", "enable", layer.id, layer.label],
        disabled: options.disableInactiveLayerStates ?? true ? () => layers.activeIds().includes(layer.id) : false,
        action: () => {
          layers.enable(layer.id);
          return { type: "theme.layer.changed", payload: { id: layer.id, enabled: true } };
        },
      },
      {
        id: `${prefix}.disable.${layer.id}`,
        label: `Disable ${layer.label}`,
        description: `Disable the ${layer.label} theme layer.`,
        group,
        keywords: ["theme", "layer", "disable", layer.id, layer.label],
        disabled: options.disableInactiveLayerStates ?? true ? () => !layers.activeIds().includes(layer.id) : false,
        action: () => {
          layers.disable(layer.id);
          return { type: "theme.layer.changed", payload: { id: layer.id, enabled: false } };
        },
      },
    );
  }

  return commands;
}
