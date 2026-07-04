import { Color } from "npm:three@0.183.2";

import { assertEquals } from "./deps.ts";
import { ThreeAsciiAnsiBackgroundState } from "../src/three_ascii/ansi_background.ts";

Deno.test("ThreeAsciiAnsiBackgroundState reports only effective background changes", () => {
  const state = new ThreeAsciiAnsiBackgroundState();

  assertEquals(state.set(0x010203), true);
  assertEquals(state.key, 0x010203);
  assertEquals(state.ansi, "\x1b[48;2;1;2;3m");
  assertEquals(state.blankAnsi, "\x1b[48;2;1;2;3m \x1b[0m");
  assertEquals(state.set(0x010203), false);
  assertEquals(state.set("#010203"), false);
  assertEquals(state.set(0x030201), true);
  assertEquals(state.key, 0x030201);
});

Deno.test("ThreeAsciiAnsiBackgroundState tracks mutable Color inputs", () => {
  const state = new ThreeAsciiAnsiBackgroundState();
  const color = new Color(0x010203);

  assertEquals(state.set(color), true);
  assertEquals(state.set(color), false);
  color.set(0x030201);
  assertEquals(state.set(color), true);
  assertEquals(state.key, 0x030201);
});

Deno.test("ThreeAsciiAnsiBackgroundState clear resets stable input caches", () => {
  const state = new ThreeAsciiAnsiBackgroundState();

  assertEquals(state.set(0x010203), true);
  state.clear();
  assertEquals(state.key, -1);
  assertEquals(state.ansi, "");
  assertEquals(state.blankAnsi, "");
  assertEquals(state.set(0x010203), true);
});
