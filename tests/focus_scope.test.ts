import { assertEquals } from "./deps.ts";
import { type Focusable, FocusManager, FocusScope } from "../src/focus.ts";
import { Signal } from "../src/signals/mod.ts";
import type { ComponentState } from "../src/component.ts";

function target(): Focusable {
  return { state: new Signal<ComponentState>("base") };
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
