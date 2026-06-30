// Copyright 2023 Im-Beast. MIT license.
import type { ScrollAreaController, ScrollAreaInspection } from "../components/scroll_area.ts";
import type { Action } from "./actions.ts";
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
    commands.push(
      scrollCommand(
        `${idPrefix}.up`,
        label("up", "Scroll Up"),
        group,
        ["scroll", "up"],
        () => controller.scrollBy(0, -step),
        payload,
      ),
      scrollCommand(
        `${idPrefix}.down`,
        label("down", "Scroll Down"),
        group,
        ["scroll", "down"],
        () => controller.scrollBy(0, step),
        payload,
      ),
      scrollCommand(
        `${idPrefix}.left`,
        label("left", "Scroll Left"),
        group,
        ["scroll", "left"],
        () => controller.scrollBy(-step, 0),
        payload,
      ),
      scrollCommand(
        `${idPrefix}.right`,
        label("right", "Scroll Right"),
        group,
        ["scroll", "right"],
        () => controller.scrollBy(step, 0),
        payload,
      ),
    );
  }

  if (options.includePageCommands ?? true) {
    commands.push(
      scrollCommand(
        `${idPrefix}.pageUp`,
        label("pageUp", "Page Up"),
        group,
        ["scroll", "page", "up"],
        () => controller.scrollBy(0, -Math.max(1, controller.viewportHeight.peek() - 1)),
        payload,
      ),
      scrollCommand(
        `${idPrefix}.pageDown`,
        label("pageDown", "Page Down"),
        group,
        ["scroll", "page", "down"],
        () => controller.scrollBy(0, Math.max(1, controller.viewportHeight.peek() - 1)),
        payload,
      ),
    );
  }

  if (options.includeEdgeCommands ?? true) {
    commands.push(
      scrollCommand(
        `${idPrefix}.home`,
        label("home", "Scroll Home"),
        group,
        ["scroll", "home"],
        () => controller.scrollTo(0, 0),
        payload,
      ),
      scrollCommand(
        `${idPrefix}.end`,
        label("end", "Scroll End"),
        group,
        ["scroll", "end"],
        () => controller.scrollTo(0, controller.maxOffset().rows),
        payload,
      ),
    );
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

function scrollCommand<TAction extends Action>(
  id: string,
  label: string,
  group: string,
  keywords: string[],
  scroll: () => void,
  payload: () => ScrollAreaCommandPayload,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords,
    action: () => {
      scroll();
      return { type: "scrollArea.scrolled", payload: payload() } as TAction;
    },
  };
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
