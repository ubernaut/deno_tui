import { assertEquals } from "./deps.ts";
import { bindModalFocus } from "../src/app/surface_bindings.ts";
import { bindFocusNavigation, type Focusable, FocusManager, FocusScope } from "../src/focus.ts";
import { Signal } from "../src/signals/mod.ts";
import type { ComponentState } from "../src/component.ts";
import type { KeyPressEvent } from "../src/input_reader/types.ts";

function target(): Focusable {
  return { state: new Signal<ComponentState>("base") };
}

function keyPress(key: KeyPressEvent["key"], shift = false): KeyPressEvent {
  return { key, shift, ctrl: false, meta: false, buffer: new Uint8Array() };
}

Deno.test("FocusScope traps focus and restores the previous item", () => {
  const manager = new FocusManager();
  const outside = target();
  const insideA = target();
  const insideB = target();

  manager.focus(outside);
  const scope = new FocusScope(manager, [insideA, insideB]);
  scope.enter(1);

  assertEquals(outside.state.peek(), "base");
  assertEquals(insideB.state.peek(), "focused");
  assertEquals(manager.next(), insideA);
  assertEquals(manager.previous(), insideB);

  scope.exit();

  assertEquals(insideA.state.peek(), "base");
  assertEquals(insideB.state.peek(), "base");
  assertEquals(outside.state.peek(), "focused");
});

Deno.test("bindFocusNavigation cycles focus with tab and unsubscribes cleanly", () => {
  let listener: ((event: KeyPressEvent) => void | Promise<void>) | undefined;
  const target = {
    on(type: "keyPress", next: (event: KeyPressEvent) => void | Promise<void>) {
      assertEquals(type, "keyPress");
      listener = next;
      return () => {
        listener = undefined;
      };
    },
  };
  const manager = new FocusManager();
  const first = targetItem();
  const second = targetItem();
  const unsubscribe = bindFocusNavigation(target, manager, { items: [first, second] });

  listener?.(keyPress("tab"));
  assertEquals(first.state.peek(), "focused");
  assertEquals(second.state.peek(), "base");

  listener?.(keyPress("tab"));
  assertEquals(first.state.peek(), "base");
  assertEquals(second.state.peek(), "focused");

  listener?.(keyPress("tab", true));
  assertEquals(first.state.peek(), "focused");
  assertEquals(second.state.peek(), "base");

  unsubscribe();
  assertEquals(listener, undefined);
});

Deno.test("bindModalFocus enters restores and closes on escape", () => {
  const target = new TestKeyTarget();
  const manager = new FocusManager();
  const visible = new Signal(false);
  const outside = targetItem();
  const insideA = targetItem();
  const insideB = targetItem();
  manager.focus(outside);

  const dispose = bindModalFocus(target, visible, manager, [insideA, insideB], { initialIndex: 1 });

  visible.value = true;
  assertEquals(outside.state.peek(), "base");
  assertEquals(insideB.state.peek(), "focused");

  target.key("escape");
  assertEquals(visible.peek(), false);
  assertEquals(insideA.state.peek(), "base");
  assertEquals(insideB.state.peek(), "base");
  assertEquals(outside.state.peek(), "focused");

  visible.value = true;
  dispose();
  assertEquals(outside.state.peek(), "focused");
  assertEquals(target.listenerCount(), 0);
});

function targetItem(): Focusable {
  return target();
}

class TestKeyTarget {
  private readonly listeners = new Set<(event: KeyPressEvent) => void | Promise<void>>();

  on(type: "keyPress", listener: (event: KeyPressEvent) => void | Promise<void>): () => void {
    assertEquals(type, "keyPress");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  key(key: KeyPressEvent["key"]): void {
    for (const listener of this.listeners) {
      listener(keyPress(key));
    }
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}
