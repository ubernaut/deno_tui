// Copyright 2023 Im-Beast. MIT license.
import type { SplitPaneController, SplitPaneControllerOptions, SplitPaneDirection } from "../layout/split_pane.ts";
import { Signal } from "../signals/mod.ts";
import type { Rectangle } from "../types.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for split Pane Command variants. */
export type SplitPaneCommandKind =
  | "shrinkFirst"
  | "growFirst"
  | "row"
  | "column"
  | "ratio"
  | "reset";

/** Action union emitted by split Pane Command command helpers. */
export type SplitPaneCommandAction =
  | Action<"splitPane.resized", SplitPaneSnapshotPayload>
  | Action<"splitPane.directionChanged", SplitPaneSnapshotPayload>
  | Action<"splitPane.ratioChanged", SplitPaneSnapshotPayload>
  | Action<"splitPane.reset", SplitPaneSnapshotPayload>;

/** Payload carried by split Pane Snapshot actions. */
export interface SplitPaneSnapshotPayload {
  id: string;
  snapshot: SplitPaneControllerOptions;
}

/** Public type alias for a split Pane Bounds Source. */
export type SplitPaneBoundsSource =
  | Rectangle
  | Signal<Rectangle>
  | (() => Rectangle);

/** Options for configuring split Pane Command. */
export interface SplitPaneCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  bounds?: SplitPaneBoundsSource;
  step?: number;
  ratios?: readonly number[];
  includeResizeCommands?: boolean;
  includeDirectionCommands?: boolean;
  includeRatioCommands?: boolean;
  includeReset?: boolean;
  labels?: Partial<Record<SplitPaneCommandKind, string>>;
  ratioLabel?: (ratio: number) => string;
}

/** Builds command definitions for split Pane. */
export function splitPaneCommands<TAction extends Action = SplitPaneCommandAction>(
  controller: SplitPaneController,
  options: SplitPaneCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "split";
  const idPrefix = options.idPrefix ?? "splitPane";
  const group = options.group ?? "layout";
  const step = Math.max(1, Math.floor(options.step ?? 2));
  const label = (kind: SplitPaneCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const ratioLabel = options.ratioLabel ?? ((ratio: number) => `${Math.round(ratio * 100)}%`);
  const initial = controller.snapshot();
  const bounds = () => readSplitPaneBounds(options.bounds);
  const canResize = () => bounds() !== undefined;
  const snapshot = (): SplitPaneSnapshotPayload => ({ id, snapshot: controller.snapshot() });
  const commands: Command<TAction>[] = [];

  if (options.includeResizeCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.shrinkFirst`,
        label: label("shrinkFirst", "Shrink First Pane"),
        group,
        binding: { key: "left" },
        disabled: () => !canResize(),
        action: () => {
          controller.resize(bounds()!, -step);
          return { type: "splitPane.resized", payload: snapshot() } as TAction;
        },
      },
      {
        id: `${idPrefix}.growFirst`,
        label: label("growFirst", "Grow First Pane"),
        group,
        binding: { key: "right" },
        disabled: () => !canResize(),
        action: () => {
          controller.resize(bounds()!, step);
          return { type: "splitPane.resized", payload: snapshot() } as TAction;
        },
      },
    );
  }

  if (options.includeDirectionCommands ?? true) {
    for (const direction of ["row", "column"] as const satisfies readonly SplitPaneDirection[]) {
      commands.push({
        id: `${idPrefix}.direction.${direction}`,
        label: label(direction, direction === "row" ? "Horizontal Split" : "Vertical Split"),
        group,
        disabled: () => controller.snapshot().direction === direction,
        action: () => {
          controller.setDirection(direction);
          return { type: "splitPane.directionChanged", payload: snapshot() } as TAction;
        },
      });
    }
  }

  if (options.includeRatioCommands ?? false) {
    for (const ratio of options.ratios ?? [0.25, 0.5, 0.75]) {
      commands.push({
        id: `${idPrefix}.ratio.${ratioId(ratio)}`,
        label: `${label("ratio", "Set Split Ratio")}: ${ratioLabel(ratio)}`,
        group,
        keywords: ["layout", "split", "ratio", ratioLabel(ratio)],
        disabled: () => controller.snapshot().ratio === ratio && controller.snapshot().firstSize === undefined,
        action: () => {
          controller.setRatio(ratio);
          return { type: "splitPane.ratioChanged", payload: snapshot() } as TAction;
        },
      });
    }
  }

  if (options.includeReset ?? false) {
    commands.push({
      id: `${idPrefix}.reset`,
      label: label("reset", "Reset Split Pane"),
      group,
      keywords: ["layout", "split", "reset"],
      action: () => {
        applySplitPaneSnapshot(controller, initial);
        return { type: "splitPane.reset", payload: snapshot() } as TAction;
      },
    });
  }

  return commands;
}

/** Binds split Pane Commands behavior and returns a disposer when applicable. */
export function bindSplitPaneCommands<TAction extends Action = SplitPaneCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: SplitPaneController,
  options: SplitPaneCommandOptions = {},
): () => void {
  return registry.registerAll(splitPaneCommands<TAction>(controller, options));
}

function readSplitPaneBounds(bounds: SplitPaneBoundsSource | undefined): Rectangle | undefined {
  if (!bounds) return undefined;
  if (typeof bounds === "function") return bounds();
  if (bounds instanceof Signal) return bounds.peek();
  return bounds;
}

function applySplitPaneSnapshot(controller: SplitPaneController, snapshot: SplitPaneControllerOptions): void {
  const { resizeMode = "size", ...options } = snapshot;
  controller.resizeMode.value = resizeMode;
  controller.options.value = { ...options };
}

function ratioId(ratio: number): string {
  return String(Math.round(ratio * 1000)).padStart(4, "0");
}
