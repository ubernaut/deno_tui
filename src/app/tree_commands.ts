// Copyright 2023 Im-Beast. MIT license.
import type { TreeController, TreeInspection, TreeRowInspection } from "../components/tree.ts";
import type { Action } from "./actions.ts";
import { actionCommandGroup, CommandGroupBuilder } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for tree Command variants. */
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

/** Action union emitted by tree Command command helpers. */
export type TreeCommandAction =
  | Action<"tree.changed", TreeCommandPayload>
  | Action<"tree.nodeToggled", TreeCommandPayload & { row: TreeRowInspection; expanded: boolean }>
  | Action<"tree.nodeSelected", TreeCommandPayload & { row: TreeRowInspection }>;

/** Payload carried by tree Command actions. */
export interface TreeCommandPayload {
  id: string;
  inspection: TreeInspection;
}

/** Options for configuring tree Command. */
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

/** Builds command definitions for tree. */
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
  const builder = new CommandGroupBuilder<TAction>(idPrefix, group);
  const addToggle = (
    kind: Extract<TreeCommandKind, "toggle" | "expand" | "collapse">,
    fallback: string,
    toggle: () => unknown,
    disabled?: (row: TreeRowInspection | undefined) => boolean,
  ): void => {
    const commandLabel = label(kind, fallback);
    builder.addOptionalAction(
      kind,
      commandLabel,
      "tree.nodeToggled",
      () => {
        toggle();
        return payload().inspection.selected;
      },
      (row) => ({ ...payload(), row, expanded: row.expanded }),
      ["tree", "node", "toggle", commandLabel],
      () => disabled?.(payload().inspection.selected) ?? controller.selected()?.hasChildren !== true,
    );
  };

  if (options.includeMoveCommands ?? true) {
    builder.commands.push(...actionCommandGroup<TAction, TreeCommandPayload, TreeCommandKind, unknown>({
      idPrefix,
      group,
      type: "tree.changed",
      keywords: ["tree", "node"],
      label,
      payload,
      disabled: () => payload().inspection.empty,
      entries: [
        ["first", "First Tree Node", () => controller.first()],
        ["previous", "Previous Tree Node", () => controller.move(-1)],
        ["next", "Next Tree Node", () => controller.move(1)],
        ["last", "Last Tree Node", () => controller.last()],
      ],
    }));
  }

  if (options.includeToggleCommands ?? true) {
    addToggle("toggle", "Toggle Tree Node", () => controller.toggleActive());
    addToggle(
      "expand",
      "Expand Tree Node",
      () => controller.expandActive(),
      (row) => row === undefined || !row.hasChildren || row.expanded,
    );
    addToggle(
      "collapse",
      "Collapse Tree Node",
      () => controller.collapseActive(),
      (row) => row === undefined || !row.hasChildren || !row.expanded,
    );
  }

  if (options.includeSelectCommand ?? true) {
    builder.addOptionalAction(
      "select",
      label("select", "Select Tree Node"),
      "tree.nodeSelected",
      () => controller.selectActive(),
      () => ({ ...payload(), row: payload().inspection.selected! }),
      ["tree", "select", "node", "active"],
      () => controller.selected() === undefined,
    );
  }

  if (options.includeNodeCommands ?? false) {
    for (const row of controller.inspect().rows) {
      builder.addOptionalAction(
        `node.${row.id}`,
        `${label("node", "Select Tree Node")}: ${nodeLabel(row)}`,
        "tree.nodeSelected",
        () => {
          const index = controller.inspect().rows.findIndex((entry) => entry.id === row.id);
          if (index < 0) return undefined;
          const selected = controller.setSelectedIndex(index);
          if (!selected) return undefined;
          controller.selectActive();
          return selected;
        },
        () => ({ ...payload(), row: payload().inspection.selected! }),
        ["tree", "node", row.id, row.label],
        () => controller.inspect().rows.every((entry) => entry.id !== row.id),
      );
    }
  }

  return builder.commands;
}

/** Binds tree Commands behavior and returns a disposer when applicable. */
export function bindTreeCommands<TAction extends Action = TreeCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: TreeController,
  options: TreeCommandOptions = {},
): () => void {
  return registry.registerAll(treeCommands<TAction>(controller, options));
}
