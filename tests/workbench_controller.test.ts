import { assertEquals } from "./deps.ts";
import { WorkbenchController } from "../src/app/workbench/controller.ts";

Deno.test("WorkbenchController coordinates menus and window state", () => {
  const events: unknown[] = [];
  const controller = new WorkbenchController<"theme" | "new">({
    activeId: "inspector",
    menu: { onChange: (event) => events.push(event) },
    menuIndexes: { theme: 3 },
    windows: [
      { id: "explorer", title: "Explorer" },
      { id: "inspector", title: "Inspector" },
      { id: "logs", title: "Logs", state: "closed" },
    ],
  });

  assertEquals(controller.inspect().activeWindowId, "inspector");
  assertEquals(controller.inspect().closedWindowIds, ["logs"]);
  assertEquals(controller.openMenu("theme", 2), { openId: "theme", focused: true });
  assertEquals(controller.menuIndex("theme"), 1);
  assertEquals(controller.moveMenuIndex("theme", 4, "down"), 2);
  assertEquals(controller.toggleMenu("new"), { openId: "new", focused: true });
  assertEquals(controller.closeMenus(), { openId: null, focused: false });

  assertEquals(controller.focusNextWindow(), "explorer");
  assertEquals(controller.toggleFullscreenWindow(), "explorer");
  assertEquals(controller.inspect().fullscreenWindowId, "explorer");
  assertEquals(controller.minimizeWindow("explorer"), "explorer");
  assertEquals(controller.inspect().minimizedWindowIds, ["explorer"]);
  assertEquals(controller.restoreWindows("explorer"), "explorer");
  assertEquals(controller.closeWindow("explorer"), "explorer");
  assertEquals(controller.inspect().closedWindowIds, ["explorer", "logs"]);

  assertEquals(events, [
    { openId: "theme", focused: true },
    { openId: "new", focused: true },
    { openId: null, focused: false },
  ]);

  controller.dispose();
});

Deno.test("WorkbenchController keeps menu index updates bounded", () => {
  const controller = new WorkbenchController<"workspace">({
    windows: [{ id: "only", title: "Only" }],
  });

  assertEquals(controller.setMenuIndex("workspace", Number.NaN, 5), 0);
  assertEquals(controller.setMenuIndex("workspace", 99, 5), 4);
  assertEquals(controller.setMenuIndex("workspace", -4, 5), 0);
  assertEquals(controller.setMenuIndex("workspace", 2.8, 0), 0);
  assertEquals(controller.moveMenuIndex("workspace", 3, "up"), 2);

  controller.dispose();
});
