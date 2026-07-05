import { assertEquals } from "./deps.ts";
import {
  resolveWorkbenchThreeWindowState,
  workbenchThreeWindowStateIsInteractive,
} from "../src/app/workbench_three_window_state.ts";

type Id = "inspector" | "three" | "viz" | "logs";

const isThreeWindow = (id: Id) => id === "three" || id === "viz";
const windows: Id[] = ["inspector", "three", "viz", "logs"];

Deno.test("resolveWorkbenchThreeWindowState makes the active Three window interactive", () => {
  const state = resolveWorkbenchThreeWindowState({ activeId: "three", windows, isThreeWindow });

  assertEquals(state.live, true);
  assertEquals(state.fullscreenThree, false);
  assertEquals(state.threeWindowCount, 2);
  assertEquals(workbenchThreeWindowStateIsInteractive(state, "three"), true);
  assertEquals(workbenchThreeWindowStateIsInteractive(state, "viz"), false);
});

Deno.test("resolveWorkbenchThreeWindowState makes fullscreen Three window interactive", () => {
  const state = resolveWorkbenchThreeWindowState({
    activeId: "inspector",
    fullscreenId: "viz",
    windows,
    isThreeWindow,
  });

  assertEquals(state.live, true);
  assertEquals(state.fullscreenThree, true);
  assertEquals(workbenchThreeWindowStateIsInteractive(state, "viz"), true);
  assertEquals(workbenchThreeWindowStateIsInteractive(state, "three"), false);
});

Deno.test("resolveWorkbenchThreeWindowState blocks live and interactive state behind modal overlays", () => {
  const state = resolveWorkbenchThreeWindowState({
    activeId: "three",
    fullscreenId: "three",
    windows,
    isThreeWindow,
    blocked: true,
  });

  assertEquals(state.live, false);
  assertEquals(state.fullscreenThree, true);
  assertEquals(workbenchThreeWindowStateIsInteractive(state, "three"), false);
});

Deno.test("resolveWorkbenchThreeWindowState reports no live state without Three windows", () => {
  const state = resolveWorkbenchThreeWindowState<"inspector" | "logs">({
    activeId: "inspector",
    windows: ["inspector", "logs"],
    isThreeWindow: () => false,
  });

  assertEquals(state.live, false);
  assertEquals(state.threeWindowCount, 0);
  assertEquals(state.fullscreenThree, false);
});
