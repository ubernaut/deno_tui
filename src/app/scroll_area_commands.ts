// Copyright 2023 Im-Beast. MIT license.
import type { ScrollAreaController, ScrollAreaInspection } from "../components/scroll_area.ts";
import type { Action } from "./actions.ts";
import { actionCommandGroup } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for scroll Area Command variants. */
export type ScrollAreaCommandKind =
  | "up"
  | "down"
  | "left"
  | "right"
  | "pageUp"
  | "pageDown"
  | "home"
  | "end"
  | "showScrollbar"
  | "hideScrollbar";

/** Action union emitted by scroll Area Command command helpers. */
export type ScrollAreaCommandAction =
  | Action<"scrollArea.scrolled", ScrollAreaCommandPayload>
  | Action<"scrollArea.scrollbarChanged", ScrollAreaCommandPayload & { visible: boolean }>;

/** Payload carried by scroll Area Command actions. */
export interface ScrollAreaCommandPayload {
  id: string;
  inspection: ScrollAreaInspection;
}

/** Options for configuring scroll Area Command. */
export interface ScrollAreaCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  step?: number;
  includeMoveCommands?: boolean;
  includePageCommands?: boolean;
  includeEdgeCommands?: boolean;
  includeScrollbarCommands?: boolean;
  labels?: Partial<Record<ScrollAreaCommandKind, string>>;
}

/** Builds command definitions for scroll Area. */
export function scrollAreaCommands<TAction extends Action = ScrollAreaCommandAction>(
  controller: ScrollAreaController,
  options: ScrollAreaCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "scroll";
  const idPrefix = options.idPrefix ?? "scroll";
  const group = options.group ?? "viewport";
  const step = Math.max(1, Math.floor(options.step ?? 1));
  const label = (kind: ScrollAreaCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const payload = (): ScrollAreaCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeMoveCommands ?? true) {
    commands.push(...actionCommandGroup<TAction, ScrollAreaCommandPayload, ScrollAreaCommandKind, void>({
      idPrefix,
      group,
      type: "scrollArea.scrolled",
      keywords: ["scroll"],
      label,
      payload,
      entries: [
        ["up", "Scroll Up", () => controller.scrollBy(0, -step), ["scroll", "up"]],
        ["down", "Scroll Down", () => controller.scrollBy(0, step), ["scroll", "down"]],
        ["left", "Scroll Left", () => controller.scrollBy(-step, 0), ["scroll", "left"]],
        ["right", "Scroll Right", () => controller.scrollBy(step, 0), ["scroll", "right"]],
      ],
    }));
  }

  if (options.includePageCommands ?? true) {
    commands.push(...actionCommandGroup<TAction, ScrollAreaCommandPayload, ScrollAreaCommandKind, void>({
      idPrefix,
      group,
      type: "scrollArea.scrolled",
      keywords: ["scroll"],
      label,
      payload,
      entries: [
        [
          "pageUp",
          "Page Up",
          () => controller.scrollBy(0, -Math.max(1, controller.viewportHeight.peek() - 1)),
          ["scroll", "page", "up"],
        ],
        [
          "pageDown",
          "Page Down",
          () => controller.scrollBy(0, Math.max(1, controller.viewportHeight.peek() - 1)),
          ["scroll", "page", "down"],
        ],
      ],
    }));
  }

  if (options.includeEdgeCommands ?? true) {
    commands.push(...actionCommandGroup<TAction, ScrollAreaCommandPayload, ScrollAreaCommandKind, void>({
      idPrefix,
      group,
      type: "scrollArea.scrolled",
      keywords: ["scroll"],
      label,
      payload,
      entries: [
        ["home", "Scroll Home", () => controller.scrollTo(0, 0), ["scroll", "home"]],
        ["end", "Scroll End", () => controller.scrollTo(0, controller.maxOffset().rows), ["scroll", "end"]],
      ],
    }));
  }

  if (options.includeScrollbarCommands ?? false) {
    commands.push(
      scrollbarCommand(
        `${idPrefix}.scrollbar.show`,
        label("showScrollbar", "Show Scrollbar"),
        group,
        true,
        controller,
        payload,
      ),
      scrollbarCommand(
        `${idPrefix}.scrollbar.hide`,
        label("hideScrollbar", "Hide Scrollbar"),
        group,
        false,
        controller,
        payload,
      ),
    );
  }

  return commands;
}

/** Binds scroll Area Commands behavior and returns a disposer when applicable. */
export function bindScrollAreaCommands<TAction extends Action = ScrollAreaCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: ScrollAreaController,
  options: ScrollAreaCommandOptions = {},
): () => void {
  return registry.registerAll(scrollAreaCommands<TAction>(controller, options));
}

function scrollbarCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  visible: boolean,
  controller: ScrollAreaController,
  payload: () => ScrollAreaCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords: ["scroll", "scrollbar", visible ? "show" : "hide"],
    disabled: () => controller.showScrollbar.peek() === visible,
    action: () => {
      controller.setScrollbarVisible(visible);
      return {
        type: "scrollArea.scrollbarChanged",
        payload: { ...payload(), visible },
      } as TAction;
    },
  };
}
