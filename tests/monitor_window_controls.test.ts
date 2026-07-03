import { assertEquals } from "./deps.ts";
import {
  MONITOR_WINDOW_CONTROL_TEXT,
  monitorWindowControlAt,
  monitorWindowControlRect,
  monitorWindowControlsVisible,
} from "../app/monitor_window_controls.ts";

Deno.test("monitor window controls stay available in compact minimized titlebars", () => {
  const minimized = { column: 4, row: 8, width: 20, height: 3 };

  assertEquals(MONITOR_WINDOW_CONTROL_TEXT.length, 15);
  assertEquals(monitorWindowControlsVisible(minimized), true);
  assertEquals(monitorWindowControlRect(minimized), { column: 8, row: 8, width: 15, height: 1 });
  assertEquals(monitorWindowControlAt(minimized, 8, 8), "minimize");
  assertEquals(monitorWindowControlAt(minimized, 12, 8), "maximize");
  assertEquals(monitorWindowControlAt(minimized, 16, 8), "restore");
  assertEquals(monitorWindowControlAt(minimized, 20, 8), "close");
});

Deno.test("monitor window controls hide only when the titlebar is too narrow", () => {
  const narrow = { column: 1, row: 2, width: 15, height: 8 };

  assertEquals(monitorWindowControlsVisible(narrow), false);
  assertEquals(monitorWindowControlRect(narrow), { column: 0, row: 0, width: 0, height: 0 });
  assertEquals(monitorWindowControlAt(narrow, 1, 2), undefined);
});
