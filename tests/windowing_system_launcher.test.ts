import { assertEquals } from "./deps.ts";
import {
  createWorkspaceDemoState,
  decodeWorkspaceKeys,
  formatWorkspaceDemoScreen,
  handleWorkspaceQuitModalKey,
  openWorkspaceItem,
  openWorkspaceQuitModal,
  selectedWorkspaceItem,
  workspaceDemoItems,
} from "../examples/windowing_system_launcher.ts";

Deno.test("workspace launcher catalog includes monitor three ascii and widget demos", () => {
  assertEquals(workspaceDemoItems.map((item) => item.id).includes("system-monitor"), true);
  assertEquals(workspaceDemoItems.map((item) => item.id).includes("three-ascii"), true);
  assertEquals(workspaceDemoItems.map((item) => item.id).includes("component-catalog"), true);
});

Deno.test("workspace launcher decodes batched terminal input", () => {
  assertEquals(decodeWorkspaceKeys("\x1b[B\x1b[B\rfq"), ["down", "down", "enter", "f", "q"]);
});

Deno.test("workspace launcher opens file explorer selections into managed windows", () => {
  const state = createWorkspaceDemoState([]);
  assertEquals(state.manager.ids(), ["explorer", "welcome"]);

  const item = openWorkspaceItem(state, "/renderers/three-ascii.viz");
  assertEquals(item?.task, "three-ascii");
  assertEquals(state.manager.activeId.peek(), "three-ascii");
  assertEquals(state.manager.ids(), ["explorer", "welcome", "three-ascii"]);

  openWorkspaceItem(state, "/renderers/three-ascii.viz");
  assertEquals(state.manager.ids(), ["explorer", "welcome", "three-ascii"]);
  state.explorer.dispose();
  state.manager.dispose();
});

Deno.test("workspace launcher renders file explorer and active preview", () => {
  const state = createWorkspaceDemoState(["system-monitor"]);
  openWorkspaceItem(state, "/apps/system-monitor.viz");
  const screen = formatWorkspaceDemoScreen(state, { width: 96, height: 26, frame: 2 });

  assertEquals(screen.includes("WINDOWING SYSTEM LAUNCHER"), true);
  assertEquals(screen.includes("File Explorer"), true);
  assertEquals(screen.includes("System Monitor"), true);
  assertEquals(screen.includes("deno task viz"), true);
  assertEquals(selectedWorkspaceItem(state)?.id, undefined);
  state.explorer.dispose();
  state.manager.dispose();
});

Deno.test("workspace launcher wraps top and bottom bars in narrow terminals", () => {
  const state = createWorkspaceDemoState(["system-monitor", "three-ascii", "component-catalog"]);
  const screen = formatWorkspaceDemoScreen(state, { width: 34, height: 22 });
  const lines = screen.split("\n");

  assertEquals(lines.every((line) => line.length === 34), true);
  assertEquals(screen.includes("WINDOWING SYSTEM LAUNCHER"), true);
  assertEquals(screen.includes("Q confirm quit"), true);
  assertEquals(screen.includes("Three ASCII Renderer"), true);
  state.explorer.dispose();
  state.manager.dispose();
});

Deno.test("workspace launcher shows quit confirmation before exiting", () => {
  const state = createWorkspaceDemoState([]);
  openWorkspaceQuitModal(state);
  assertEquals(state.quitModalOpen, true);
  assertEquals(state.quitModalAction, "cancel");

  const screen = formatWorkspaceDemoScreen(state, { width: 90, height: 24 });
  assertEquals(screen.includes("Confirm Quit"), true);
  assertEquals(screen.includes("Are you sure you want to quit"), true);
  assertEquals(handleWorkspaceQuitModalKey(state, "enter"), false);

  handleWorkspaceQuitModalKey(state, "right");
  assertEquals(state.quitModalAction, "quit");
  assertEquals(handleWorkspaceQuitModalKey(state, "enter"), true);
  state.explorer.dispose();
  state.manager.dispose();
});

Deno.test("workspace launcher quit confirmation can be cancelled", () => {
  const state = createWorkspaceDemoState([]);
  openWorkspaceQuitModal(state);
  assertEquals(handleWorkspaceQuitModalKey(state, "n"), false);
  assertEquals(state.quitModalOpen, false);
  state.explorer.dispose();
  state.manager.dispose();
});
