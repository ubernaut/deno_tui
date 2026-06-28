// Copyright 2023 Im-Beast. MIT license.
import type { TreeController, TreeInspection, TreeRowInspection } from "../components/tree.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type TreeCommandKind =
  | "first"
  | "previous"
  | "next"
  | "last"
  | "toggle"
  | "expand"
  | "collapse"
  | "select"
  | "node";

export type TreeCommandAction =
  | Action<"tree.changed", TreeCommandPayload>
  | Action<"tree.nodeToggled", TreeCommandPayload & { row: TreeRowInspection; expanded: boolean }>
  | Action<"tree.nodeSelected", TreeCommandPayload & { row: TreeRowInspection }>;

export interface TreeCommandPayload {
  id: string;
  inspection: TreeInspection;
}

export interface TreeCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeMoveCommands?: boolean;
  includeToggleCommands?: boolean;
  includeSelectCommand?: boolean;
  includeNodeCommands?: boolean;
  labels?: Partial<Record<TreeCommandKind, string>>;
  nodeLabel?: (row: TreeRowInspection) => string;
}

export function treeCommands<TAction extends Action = TreeCommandAction>(
  controller: TreeController,
  options: TreeCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "tree";
  const idPrefix = options.idPrefix ?? "tree";
  const group = options.group ?? "navigation";
  const label = (kind: TreeCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const nodeLabel = options.nodeLabel ?? ((row: TreeRowInspection) => row.label);
  const payload = (): TreeCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(
      moveCommand(`${idPrefix}.first`, label("first", "First Tree Node"), group, () => controller.first(), payload),
      moveCommand(
        `${idPrefix}.previous`,
        label("previous", "Previous Tree Node"),
        group,
        () => controller.move(-1),
        payload,
      ),
      moveCommand(`${idPrefix}.next`, label("next", "Next Tree Node"), group, () => controller.move(1), payload),
      moveCommand(`${idPrefix}.last`, label("last", "Last Tree Node"), group, () => controller.last(), payload),
    );
  }

  if (options.includeToggleCommands ?? true) {
    commands.push(
      toggleCommand(
        `${idPrefix}.toggle`,
        label("toggle", "Toggle Tree Node"),
        group,
        controller,
        () => controller.toggleActive(),
        payload,
      ),
      toggleCommand(
        `${idPrefix}.expand`,
        label("expand", "Expand Tree Node"),
        group,
        controller,
        () => controller.expandActive(),
        payload,
        (row) => row === undefined || !row.hasChildren || row.expanded,
      ),
      toggleCommand(
        `${idPrefix}.collapse`,
        label("collapse", "Collapse Tree Node"),
        group,
        controller,
        () => controller.collapseActive(),
        payload,
        (row) => row === undefined || !row.hasChildren || !row.expanded,
      ),
    );
  }

  if (options.includeSelectCommand ?? true) {
    commands.push({
      id: `${idPrefix}.select`,
      label: label("select", "Select Tree Node"),
      group,
      keywords: ["tree", "select", "node", "active"],
      disabled: () => controller.selected() === undefined,
      action: () => {
        const row = controller.selectActive();
        if (!row) return undefined;
        return {
          type: "tree.nodeSelected",
          payload: { ...payload(), row: payload().inspection.selected! },
        } as TAction;
      },
    });
  }

  if (options.includeNodeCommands ?? false) {
    for (const row of controller.inspect().rows) {
      commands.push({
        id: `${idPrefix}.node.${row.id}`,
        label: `${label("node", "Select Tree Node")}: ${nodeLabel(row)}`,
        group,
        keywords: ["tree", "node", row.id, row.label],
        disabled: () => controller.inspect().rows.every((entry) => entry.id !== row.id),
        action: () => {
          const index = controller.inspect().rows.findIndex((entry) => entry.id === row.id);
          if (index < 0) return undefined;
          const selected = controller.setSelectedIndex(index);
          if (!selected) return undefined;
          controller.selectActive();
          return {
            type: "tree.nodeSelected",
            payload: { ...payload(), row: payload().inspection.selected! },
          } as TAction;
        },
      });
    }
  }

  return commands;
}

export function bindTreeCommands<TAction extends Action = TreeCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: TreeController,
  options: TreeCommandOptions = {},
): () => void {
  return registry.registerAll(treeCommands<TAction>(controller, options));
}

function moveCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  move: () => unknown,
  payload: () => TreeCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords: ["tree", "node", label],
    disabled: () => payload().inspection.empty,
    action: () => {
      move();
      return { type: "tree.changed", payload: payload() } as TAction;
    },
  };
}

function toggleCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  controller: TreeController,
  toggle: () => unknown,
  payload: () => TreeCommandPayload,
  disabled?: (row: TreeRowInspection | undefined) => boolean,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords: ["tree", "node", "toggle", label],
    disabled: () => disabled?.(payload().inspection.selected) ?? controller.selected()?.hasChildren !== true,
    action: () => {
      toggle();
      const inspection = payload().inspection;
      if (!inspection.selected) return undefined;
      return {
        type: "tree.nodeToggled",
        payload: { ...payload(), row: inspection.selected, expanded: inspection.selected.expanded },
      } as TAction;
    },
  };
}
