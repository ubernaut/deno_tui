// Copyright 2023 Im-Beast. MIT license.
import type {
  WindowManagerController,
  WindowManagerLayoutInspection,
  WindowManagerWindow,
  WindowManagerWindowInspection,
} from "../layout/window_manager.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for window manager command variants. */
export type WindowManagerCommandKind =
  | "newWindow"
  | "focusPrevious"
  | "focusNext"
  | "focusWindow"
  | "minimize"
  | "close"
  | "fullscreen"
  | "restore"
  | "restoreAll"
  | "moveBackward"
  | "moveForward"
  | "rename";

/** Action union emitted by window manager command helpers. */
export type WindowManagerCommandAction =
  | Action<"windowManager.created", WindowManagerCommandPayload>
  | Action<"windowManager.focused", WindowManagerCommandPayload>
  | Action<"windowManager.minimized", WindowManagerCommandPayload>
  | Action<"windowManager.closed", WindowManagerCommandPayload>
  | Action<"windowManager.fullscreenChanged", WindowManagerCommandPayload>
  | Action<"windowManager.restored", WindowManagerCommandPayload>
  | Action<"windowManager.moved", WindowManagerCommandPayload>
  | Action<"windowManager.renamed", WindowManagerCommandPayload>;

/** Payload carried by window manager command actions. */
export interface WindowManagerCommandPayload {
  id: string;
  inspection: WindowManagerLayoutInspection;
  window?: WindowManagerWindowInspection;
}

/** Factory used by `newWindow` commands. */
export type WindowManagerWindowFactory = (
  controller: WindowManagerController,
) => WindowManagerWindow | undefined;

/** Factory used by `rename` commands. */
export type WindowManagerRenameFactory = (
  window: WindowManagerWindow,
  controller: WindowManagerController,
) => string | undefined;

/** Options for configuring window manager commands. */
export interface WindowManagerCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  createWindow?: WindowManagerWindowFactory;
  renameWindow?: WindowManagerRenameFactory;
  moveStep?: number;
  includeNewWindow?: boolean;
  includeFocusCommands?: boolean;
  includeWindowCommands?: boolean;
  includeStateCommands?: boolean;
  includeOrderCommands?: boolean;
  includeRename?: boolean;
  labels?: Partial<Record<WindowManagerCommandKind, string>>;
  windowLabel?: (window: WindowManagerWindow, index: number) => string;
}

/** Builds command definitions for a WindowManagerController. */
export function windowManagerCommands<TAction extends Action = WindowManagerCommandAction>(
  controller: WindowManagerController,
  options: WindowManagerCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "windows";
  const idPrefix = options.idPrefix ?? "windowManager";
  const group = options.group ?? "window";
  const moveStep = Math.max(1, Math.floor(options.moveStep ?? 1));
  const label = (kind: WindowManagerCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const windowLabel = options.windowLabel ?? ((window: WindowManagerWindow) => window.title);
  const payload = (windowId = controller.activeId.peek()): WindowManagerCommandPayload => {
    const inspection = controller.inspect();
    return {
      id,
      inspection,
      window: windowId ? inspection.windows.find((entry) => entry.id === windowId) : undefined,
    };
  };
  const commands: Command<TAction>[] = [];

  if (options.includeNewWindow ?? Boolean(options.createWindow)) {
    commands.push({
      id: `${idPrefix}.newWindow`,
      label: label("newWindow", "New Window"),
      group,
      keywords: ["window", "new", "create", "terminal"],
      disabled: () => !options.createWindow,
      action: () => {
        const window = options.createWindow?.(controller);
        if (window) {
          controller.upsert(window);
          controller.focus(window.id);
        }
        return { type: "windowManager.created", payload: payload(window?.id) } as TAction;
      },
    });
  }

  if (options.includeFocusCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.focusPrevious`,
        label: label("focusPrevious", "Previous Window"),
        group,
        keywords: ["window", "focus", "previous"],
        binding: { key: "tab", shift: true },
        disabled: () => controller.ids().length < 2,
        action: () => {
          controller.focusNext(-1);
          return { type: "windowManager.focused", payload: payload() } as TAction;
        },
      },
      {
        id: `${idPrefix}.focusNext`,
        label: label("focusNext", "Next Window"),
        group,
        keywords: ["window", "focus", "next"],
        binding: { key: "tab" },
        disabled: () => controller.ids().length < 2,
        action: () => {
          controller.focusNext(1);
          return { type: "windowManager.focused", payload: payload() } as TAction;
        },
      },
    );
  }

  if (options.includeWindowCommands ?? false) {
    for (const [index, window] of controller.orderedWindows().entries()) {
      commands.push({
        id: `${idPrefix}.focus.${window.id}`,
        label: `${label("focusWindow", "Focus Window")}: ${windowLabel(window, index)}`,
        group,
        keywords: ["window", "focus", window.id, window.title],
        disabled: () => controller.activeId.peek() === window.id || !controller.ids().includes(window.id),
        action: () => {
          controller.focus(window.id);
          return { type: "windowManager.focused", payload: payload(window.id) } as TAction;
        },
      });
    }
  }

  if (options.includeStateCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.minimize`,
        label: label("minimize", "Minimize Window"),
        group,
        keywords: ["window", "minimize", "hide"],
        disabled: () => controller.active() === undefined,
        action: () => {
          const activeId = controller.activeId.peek();
          controller.minimize(activeId);
          return { type: "windowManager.minimized", payload: payload(activeId) } as TAction;
        },
      },
      {
        id: `${idPrefix}.close`,
        label: label("close", "Close Window"),
        group,
        keywords: ["window", "close"],
        disabled: () => !closableActiveWindow(controller),
        action: () => {
          const activeId = controller.activeId.peek();
          controller.close(activeId);
          return { type: "windowManager.closed", payload: payload(activeId) } as TAction;
        },
      },
      {
        id: `${idPrefix}.fullscreen`,
        label: label("fullscreen", "Toggle Fullscreen"),
        group,
        keywords: ["window", "fullscreen", "maximize"],
        disabled: () => controller.active() === undefined,
        action: () => {
          const activeId = controller.activeId.peek();
          controller.fullscreen(activeId);
          return { type: "windowManager.fullscreenChanged", payload: payload(activeId) } as TAction;
        },
      },
      {
        id: `${idPrefix}.restore`,
        label: label("restore", "Restore Window"),
        group,
        keywords: ["window", "restore"],
        disabled: () => controller.active() === undefined,
        action: () => {
          const activeId = controller.activeId.peek();
          controller.restore(activeId);
          return { type: "windowManager.restored", payload: payload(activeId) } as TAction;
        },
      },
      {
        id: `${idPrefix}.restoreAll`,
        label: label("restoreAll", "Restore All Windows"),
        group,
        keywords: ["window", "restore", "all"],
        action: () => {
          controller.restore();
          return { type: "windowManager.restored", payload: payload() } as TAction;
        },
      },
    );
  }

  if (options.includeOrderCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.moveBackward`,
        label: label("moveBackward", "Move Window Backward"),
        group,
        keywords: ["window", "move", "order", "backward"],
        disabled: () => controller.active() === undefined || controller.ids().length < 2,
        action: () => {
          const activeId = controller.activeId.peek();
          if (activeId) controller.move(activeId, -moveStep);
          return { type: "windowManager.moved", payload: payload(activeId) } as TAction;
        },
      },
      {
        id: `${idPrefix}.moveForward`,
        label: label("moveForward", "Move Window Forward"),
        group,
        keywords: ["window", "move", "order", "forward"],
        disabled: () => controller.active() === undefined || controller.ids().length < 2,
        action: () => {
          const activeId = controller.activeId.peek();
          if (activeId) controller.move(activeId, moveStep);
          return { type: "windowManager.moved", payload: payload(activeId) } as TAction;
        },
      },
    );
  }

  if (options.includeRename ?? Boolean(options.renameWindow)) {
    commands.push({
      id: `${idPrefix}.rename`,
      label: label("rename", "Rename Window"),
      group,
      keywords: ["window", "rename", "title"],
      disabled: () => controller.active() === undefined || !options.renameWindow,
      action: () => {
        const active = controller.active();
        const nextTitle = active ? options.renameWindow?.(active, controller) : undefined;
        if (active && nextTitle !== undefined) controller.rename(active.id, nextTitle);
        return { type: "windowManager.renamed", payload: payload(active?.id) } as TAction;
      },
    });
  }

  return commands;
}

/** Binds window manager commands behavior and returns a disposer when applicable. */
export function bindWindowManagerCommands<TAction extends Action = WindowManagerCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: WindowManagerController,
  options: WindowManagerCommandOptions = {},
): () => void {
  return registry.registerAll(windowManagerCommands<TAction>(controller, options));
}

function closableActiveWindow(controller: WindowManagerController): boolean {
  const active = controller.active();
  return Boolean(active && active.closable !== false);
}
