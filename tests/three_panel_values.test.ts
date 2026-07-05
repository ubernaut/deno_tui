import { assertEquals } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import {
  resolveOptionalThreePanelValue,
  resolveThreePanelLiveValue,
  resolveThreePanelValue,
} from "../src/app/three_panel_values.ts";

Deno.test("three panel value resolver reads literals and signal-like values", () => {
  const signal = new Signal(42);

  assertEquals(resolveThreePanelValue(7), 7);
  assertEquals(resolveThreePanelValue(signal), 42);

  signal.value = 64;
  assertEquals(resolveThreePanelValue(signal), 64);

  signal.dispose();
});

Deno.test("three panel optional value resolver preserves undefined", () => {
  const signal = new Signal(12);

  assertEquals(resolveOptionalThreePanelValue<number>(undefined), undefined);
  assertEquals(resolveOptionalThreePanelValue(5), 5);
  assertEquals(resolveOptionalThreePanelValue(signal), 12);

  signal.dispose();
});

Deno.test("three panel live value resolver defaults true and supports callbacks", () => {
  let active = false;
  const signal = new Signal(false);

  assertEquals(resolveThreePanelLiveValue(undefined), true);
  assertEquals(resolveThreePanelLiveValue(true), true);
  assertEquals(resolveThreePanelLiveValue(signal), false);
  signal.value = true;
  assertEquals(resolveThreePanelLiveValue(signal), true);
  assertEquals(resolveThreePanelLiveValue(() => active), false);
  active = true;
  assertEquals(resolveThreePanelLiveValue(() => active), true);

  signal.dispose();
});
