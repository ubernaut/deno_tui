// Copyright 2023 Im-Beast. MIT license.
import { type Focusable, type FocusManager, type FocusNavigationTarget, FocusScope } from "../focus.ts";
import type { Signal } from "../signals/mod.ts";

/** Options for configuring modal Focus Binding. */
export interface ModalFocusBindingOptions {
  initialIndex?: number;
  closeOnEscape?: boolean;
}

/** Binds modal Focus behavior and returns a disposer when applicable. */
export function bindModalFocus(
  target: FocusNavigationTarget,
  visible: Signal<boolean>,
  manager: FocusManager,
  items: readonly Focusable[],
  options: ModalFocusBindingOptions = {},
): () => void {
  const scope = new FocusScope(manager, items);
  const initialIndex = options.initialIndex ?? 0;
  const closeOnEscape = options.closeOnEscape ?? true;
  let active = false;

  const sync = (nextVisible: boolean) => {
    if (nextVisible && !active) {
      scope.enter(initialIndex);
      active = true;
    } else if (!nextVisible && active) {
      scope.exit();
      active = false;
    }
  };

  const unbindKeys = target.on("keyPress", (event) => {
    if (!closeOnEscape || event.ctrl || event.meta || event.key !== "escape" || !visible.peek()) return;
    visible.value = false;
  });

  sync(visible.peek());
  visible.subscribe(sync);

  return () => {
    unbindKeys();
    visible.unsubscribe(sync);
    if (active) {
      scope.exit();
      active = false;
    }
  };
}
