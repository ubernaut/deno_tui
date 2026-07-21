// Copyright 2023 Im-Beast. MIT license.

import type { KeyPressEvent } from "./input_reader/types.ts";

const focusNavigationEvents = new WeakSet<KeyPressEvent>();

export function markFocusNavigationEvent(event: KeyPressEvent): void {
  if (focusNavigationEvents.has(event)) return;
  focusNavigationEvents.add(event);
  queueMicrotask(() => focusNavigationEvents.delete(event));
}

export function isFocusNavigationEvent(event: KeyPressEvent): boolean {
  return focusNavigationEvents.has(event);
}
