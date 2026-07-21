import { assertEquals, assertThrows } from "./deps.ts";
import {
  batchSignalUpdates,
  bindWindowManagerCommands,
  CommandRegistry,
  createFileExplorerTree,
  FileExplorerController,
  OverlayStackController,
  placePopover,
  pointInRect,
  type WindowManagerCommandAction,
  WindowManagerController,
} from "../mod.ts";

Deno.test("window manager supports keyboard-style focus fullscreen tabs and restore flows", () => {
  const manager = new WindowManagerController({
    activeId: "editor",
    windows: [
      { id: "explorer", title: "Explorer", minWidth: 24, minHeight: 8 },
      { id: "editor", title: "Editor", minWidth: 40, minHeight: 10 },
      { id: "preview", title: "Preview", minWidth: 32, minHeight: 8 },
      { id: "logs", title: "Logs", minWidth: 30, minHeight: 7 },
    ],
  });

  assertEquals(manager.active()?.id, "editor");
  assertEquals(manager.focusNext()?.id, "preview");
  assertEquals(manager.fullscreen("preview")?.id, "preview");
  assertEquals(
    manager.layout({ bounds: { column: 0, row: 0, width: 100, height: 24 } }).visible.map((entry) => entry.id),
    [
      "preview",
    ],
  );

  manager.selectTab("explorer");
  assertEquals(manager.inspect().fullscreenId, "explorer");
  manager.minimize("explorer");
  assertEquals(manager.inspect().fullscreenId, undefined);
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "explorer")?.minimized, true);

  manager.restore("explorer");
  const restored = manager.layout({ bounds: { column: 0, row: 0, width: 88, height: 24 } });
  assertEquals(restored.visible.length, 4);
  assertEquals(restored.visible.every((entry) => entry.rect && entry.rect.width >= 24), true);
  assertEquals(restored.zOrder.at(-1)?.id, restored.activeId);
  manager.dispose();
});

Deno.test("window manager keeps closed windows out of focus and tab loops", () => {
  const manager = new WindowManagerController({
    activeId: "one",
    windows: [
      { id: "one", title: "One" },
      { id: "two", title: "Two" },
      { id: "three", title: "Three", closable: false },
    ],
  });

  manager.close("two");
  assertEquals(manager.ids(), ["one", "three"]);
  assertEquals(manager.focus("two"), undefined);
  assertEquals(manager.focusNext()?.id, "three");
  manager.close("three");
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "three")?.closed, false);
  manager.dispose();
});

Deno.test("window manager restores the next minimized open window in order", () => {
  const manager = new WindowManagerController({
    activeId: "editor",
    windows: [
      { id: "explorer", title: "Explorer" },
      { id: "editor", title: "Editor" },
      { id: "preview", title: "Preview" },
      { id: "logs", title: "Logs", state: "closed" },
    ],
  });

  manager.minimize("preview");
  manager.minimize("explorer");
  assertEquals(manager.restoreNextMinimized()?.id, "explorer");
  assertEquals(manager.active()?.id, "explorer");
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "explorer")?.minimized, false);
  assertEquals(manager.restoreNextMinimized()?.id, "preview");
  assertEquals(manager.restoreNextMinimized(), undefined);
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "logs")?.closed, true);
  manager.dispose();
});

Deno.test("window manager focus traversal skips minimized windows without restoring them", () => {
  const manager = new WindowManagerController({
    activeId: "one",
    windows: [
      { id: "one", title: "One" },
      { id: "two", title: "Two", state: "minimized" },
      { id: "three", title: "Three" },
    ],
  });

  assertEquals(manager.focusNext()?.id, "three");
  assertEquals(manager.focusNext()?.id, "one");
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "two")?.minimized, true);
  manager.dispose();
});

Deno.test("window manager adapter tile options cannot weaken per-window minimums", () => {
  const manager = new WindowManagerController({
    windows: [
      { id: "wide", title: "Wide", minWidth: 54, minHeight: 14 },
      { id: "small", title: "Small", minWidth: 20, minHeight: 6 },
    ],
  });

  const layout = manager.layout({
    bounds: { column: 0, row: 0, width: 120, height: 30 },
    tileOptions: { minTileWidth: 26, minTileHeight: 8 },
  });
  assertEquals(layout.visible.every((entry) => (entry.rect?.width ?? 0) >= 54), true);
  assertEquals(layout.visible.every((entry) => (entry.rect?.height ?? 0) >= 14), true);
  manager.dispose();
});

Deno.test("window manager can upsert rename and reorder managed windows", () => {
  const manager = new WindowManagerController({
    activeId: "editor",
    windows: [
      { id: "explorer", title: "Explorer" },
      { id: "editor", title: "Editor" },
      { id: "logs", title: "Logs" },
    ],
  });

  manager.upsert({ id: "terminal", title: "Terminal", minWidth: 40, minHeight: 12 });
  assertEquals(manager.ids(), ["explorer", "editor", "logs", "terminal"]);
  assertEquals(manager.rename("terminal", "Shell")?.title, "Shell");
  assertEquals(manager.move("terminal", -2)?.id, "terminal");
  assertEquals(manager.ids(), ["explorer", "terminal", "editor", "logs"]);

  manager.upsert({ id: "terminal", title: "Shell Output", state: "minimized" });
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "terminal")?.title, "Shell Output");
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "terminal")?.minimized, true);
  manager.dispose();
});

Deno.test("window manager commands create focus rename move and update window state", async () => {
  const manager = new WindowManagerController({
    activeId: "editor",
    windows: [
      { id: "explorer", title: "Explorer" },
      { id: "editor", title: "Editor" },
    ],
  });
  const registry = new CommandRegistry<WindowManagerCommandAction>();
  const actions: WindowManagerCommandAction[] = [];
  let nextWindow = 0;
  const dispose = bindWindowManagerCommands(registry, manager, {
    idPrefix: "wm",
    createWindow: () => {
      nextWindow += 1;
      return { id: `terminal-${nextWindow}`, title: `Terminal ${nextWindow}`, minWidth: 40, minHeight: 12 };
    },
    renameWindow: (window) => `${window.title} Renamed`,
    includeWindowCommands: true,
  });

  assertEquals(await registry.execute("wm.newWindow", (action) => void actions.push(action)), true);
  assertEquals(manager.active()?.id, "terminal-1");
  assertEquals(actions.at(-1)?.type, "windowManager.created");
  assertEquals(actions.at(-1)?.payload?.window?.id, "terminal-1");

  assertEquals(await registry.execute("wm.rename", (action) => void actions.push(action)), true);
  assertEquals(manager.active()?.title, "Terminal 1 Renamed");
  assertEquals(actions.at(-1)?.type, "windowManager.renamed");

  assertEquals(await registry.execute("wm.moveBackward", (action) => void actions.push(action)), true);
  assertEquals(manager.ids(), ["explorer", "terminal-1", "editor"]);
  assertEquals(actions.at(-1)?.type, "windowManager.moved");

  assertEquals(await registry.execute("wm.focusNext", (action) => void actions.push(action)), true);
  assertEquals(manager.active()?.id, "editor");
  assertEquals(await registry.execute("wm.fullscreen", (action) => void actions.push(action)), true);
  assertEquals(manager.inspect().fullscreenId, "editor");

  assertEquals(await registry.execute("wm.minimize", (action) => void actions.push(action)), true);
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "editor")?.minimized, true);
  assertEquals(manager.inspect().fullscreenId, undefined);

  assertEquals(await registry.execute("wm.restoreAll", (action) => void actions.push(action)), true);
  assertEquals(manager.inspect().windows.find((entry) => entry.id === "editor")?.minimized, false);

  manager.focus("terminal-1");
  assertEquals(await registry.execute("wm.close", (action) => void actions.push(action)), true);
  assertEquals(manager.ids(), ["explorer", "editor"]);
  assertEquals(actions.at(-1)?.type, "windowManager.closed");

  dispose();
  assertEquals(registry.list("window"), []);
  manager.dispose();
});

Deno.test("window manager exposes deterministic window z-order", () => {
  const manager = new WindowManagerController({
    activeId: "two",
    windows: [
      { id: "one", title: "One" },
      { id: "two", title: "Two" },
      { id: "three", title: "Three" },
    ],
  });

  let layout = manager.layout({ bounds: { column: 0, row: 0, width: 90, height: 24 } });
  assertEquals(layout.zOrder.map((entry) => entry.id), ["one", "three", "two"]);
  assertEquals(layout.zOrder.at(-1)?.zIndex, 2501);

  manager.fullscreen("one");
  layout = manager.layout({ bounds: { column: 0, row: 0, width: 90, height: 24 } });
  assertEquals(layout.zOrder.at(-1)?.id, "one");
  assertEquals(layout.zOrder.at(-1)?.layer, "fullscreen");

  manager.minimize("one");
  layout = manager.layout({ bounds: { column: 0, row: 0, width: 90, height: 24 } });
  assertEquals(layout.zOrder.map((entry) => entry.id), ["one", "three", "two"]);
  assertEquals(layout.windows.find((entry) => entry.id === "one")?.layer, "minimized");
  manager.dispose();
});

Deno.test("window manager survives close rearrange resize churn without invalid active state", () => {
  const manager = new WindowManagerController({
    activeId: "win-0",
    windows: Array.from({ length: 9 }, (_, index) => ({
      id: `win-${index}`,
      title: `Window ${index}`,
      minWidth: 24 + index,
      minHeight: 7 + index % 3,
    })),
  });
  const bounds = [
    { column: 0, row: 0, width: 180, height: 44 },
    { column: 0, row: 0, width: 96, height: 28 },
    { column: 0, row: 0, width: 58, height: 20 },
    { column: 0, row: 0, width: 132, height: 32 },
  ];

  for (let cycle = 0; cycle < 24; cycle += 1) {
    const active = manager.active()?.id ?? manager.ids()[0];
    if (active) {
      manager.focus(active);
      manager.fullscreen(active);
      assertWindowManagerInvariants(manager.layout({ bounds: bounds[cycle % bounds.length]! }));
      manager.fullscreen(active);
      manager.move(active, cycle % 2 === 0 ? 1 : -1);
    }

    const target = `win-${cycle % 9}`;
    if (cycle % 4 === 0) {
      manager.minimize(target);
    } else if (cycle % 4 === 1) {
      manager.restore(target);
    } else if (cycle % 4 === 2) {
      manager.close(target);
    } else {
      manager.upsert({ id: target, title: `Window ${target} restored`, state: "normal" });
    }

    assertWindowManagerInvariants(manager.layout({ bounds: bounds[(cycle + 1) % bounds.length]! }));
  }

  for (const id of manager.ids()) {
    manager.close(id);
    assertWindowManagerInvariants(manager.layout({ bounds: bounds[0]! }));
  }

  assertEquals(manager.inspect().activeId, undefined);
  assertEquals(manager.inspect().fullscreenId, undefined);
  manager.dispose();
});

Deno.test("overlay stack places popovers and blocks background hits behind modals", () => {
  const popover = placePopover(
    { column: 70, row: 18, width: 8, height: 2 },
    { width: 18, height: 6 },
    { column: 0, row: 0, width: 80, height: 24 },
    { placement: "bottom-end", gap: 1, margin: 1 },
  );
  assertEquals(popover, { column: 60, row: 11, width: 18, height: 6 });
  assertEquals(pointInRect({ column: 61, row: 12 }, popover), true);

  const overlays = new OverlayStackController({
    surfaces: [
      { id: "editor", kind: "window", rect: { column: 0, row: 2, width: 80, height: 22 } },
      { id: "theme-menu", kind: "popover", rect: popover },
      {
        id: "confirm",
        kind: "modal",
        rect: { column: 20, row: 7, width: 40, height: 8 },
        closeOnOutsideClick: true,
      },
      {
        id: "confirm-ok",
        kind: "custom",
        ownerId: "confirm",
        layer: "modal",
        rect: { column: 43, row: 13, width: 8, height: 1 },
      },
      {
        id: "confirm-menu",
        kind: "popover",
        ownerId: "confirm",
        layer: "modal",
        rect: { column: 62, row: 3, width: 12, height: 4 },
      },
      {
        id: "confirm-tip",
        kind: "tooltip",
        ownerId: "confirm-menu",
        layer: "modal",
        rect: { column: 70, row: 2, width: 8, height: 2 },
      },
    ],
  });

  assertEquals(overlays.hitTest({ column: 44, row: 13 })?.surface.id, "confirm-ok");
  assertEquals(overlays.hitTest({ column: 61, row: 12 })?.surface.id, undefined);
  assertEquals(overlays.hitTest({ column: 72, row: 2 })?.surface.id, "confirm-tip");
  assertEquals(overlays.handlePointerDown({ column: 72, row: 2 }).closedIds, []);
  assertEquals(overlays.handlePointerDown({ column: 61, row: 12 }).closedIds, [
    "confirm",
    "confirm-ok",
    "confirm-menu",
    "confirm-tip",
  ]);
  assertEquals(
    overlays.inspect().surfaces.filter((surface) => surface.id.startsWith("confirm")).every((surface) =>
      !surface.visible
    ),
    true,
  );
  assertEquals(overlays.hitTest({ column: 61, row: 12 })?.surface.id, "theme-menu");
  assertEquals(overlays.inspect().top?.id, "theme-menu");
  overlays.dispose();
});

Deno.test("overlay stack remains snapshot-safe after throwing surface subscribers", () => {
  const overlays = new OverlayStackController({
    surfaces: [{ id: "a", rect: { column: 0, row: 0, width: 3, height: 2 } }],
    activeId: "a",
  });
  const listener = () => {
    throw new Error("surface-publication-failed");
  };
  try {
    overlays.surfaces.subscribe(listener);
    assertThrows(() => overlays.remove("a"), Error, "surface-publication-failed");
    overlays.surfaces.unsubscribe(listener);
    assertEquals(overlays.snapshot().activeId, undefined);
    overlays.restoreSnapshot(overlays.snapshot());

    overlays.surfaces.subscribe(listener);
    assertThrows(
      () =>
        overlays.register({
          id: "b",
          rect: { column: 4, row: 1, width: 4, height: 2 },
        }),
      Error,
      "surface-publication-failed",
    );
    overlays.surfaces.unsubscribe(listener);
    assertEquals(overlays.snapshot().activeId, "b");
    overlays.restoreSnapshot(overlays.snapshot());

    const targetOverlays = new OverlayStackController({
      surfaces: [{ id: "c", rect: { column: 8, row: 2, width: 5, height: 2 } }],
      activeId: "c",
    });
    const target = targetOverlays.snapshot();
    targetOverlays.dispose();
    overlays.surfaces.subscribe(listener);
    assertThrows(() => overlays.restoreSnapshot(target), Error, "surface-publication-failed");
    overlays.surfaces.unsubscribe(listener);
    assertEquals(overlays.snapshot().activeId, "c");
    overlays.restoreSnapshot(overlays.snapshot());
  } finally {
    overlays.surfaces.unsubscribe(listener);
    overlays.dispose();
  }
});

Deno.test("overlay stack rejects non-restorable ingress and canonicalizes active ids", () => {
  assertThrows(
    () =>
      new OverlayStackController({
        surfaces: [
          { id: "duplicate", rect: { column: 0, row: 0, width: 1, height: 1 } },
          { id: "duplicate", rect: { column: 1, row: 0, width: 1, height: 1 } },
        ],
      }),
    TypeError,
    "duplicate surface id",
  );

  const overlays = new OverlayStackController({ activeId: "missing" });
  try {
    assertEquals(overlays.snapshot().activeId, undefined);
    overlays.restoreSnapshot(overlays.snapshot());
    const before = overlays.snapshot();
    assertThrows(
      () =>
        overlays.register({
          id: "invalid",
          rect: { column: Number.NaN, row: 0, width: 1, height: 1 },
          zIndex: Number.NaN,
        }),
      TypeError,
      "must be a safe integer",
    );
    assertEquals(overlays.snapshot(), before);

    overlays.register({ id: "valid", rect: { column: 0, row: 0, width: 2, height: 1 } });
    const valid = overlays.snapshot();
    assertThrows(
      () =>
        overlays.surfaces.value.push({
          ...overlays.surface("valid")!,
          id: "deep-invalid",
          rect: { column: 0, row: Number.NaN, width: 1, height: 1 },
        }),
      TypeError,
      "must be finite",
    );
    assertEquals(overlays.snapshot(), valid);
    overlays.activeId.value = "missing";
    assertEquals(overlays.snapshot().activeId, undefined);
    overlays.restoreSnapshot(overlays.snapshot());
  } finally {
    overlays.dispose();
  }
});

Deno.test("overlay stack tracks nested identity ABA and isolates retained ingress aliases", () => {
  const overlays = new OverlayStackController({
    activeId: "managed",
    surfaces: [{ id: "managed", rect: { column: 0, row: 0, width: 2, height: 1 } }],
  });
  const external = structuredClone(overlays.surface("managed")!);
  overlays.surfaces.value = [external];
  const assignedGeneration = overlays.registrationGeneration("managed");

  external.id = "raw-alias";
  assertEquals(overlays.surface("managed")?.id, "managed");
  assertEquals(overlays.registrationGeneration("managed"), assignedGeneration);
  assertEquals(overlays.registrationGeneration("raw-alias"), undefined);

  const live = overlays.surface("managed")!;
  batchSignalUpdates(() => {
    live.id = "temporary";
    live.id = "managed";
  });
  assertEquals(overlays.registrationGeneration("temporary"), undefined);
  assertEquals(overlays.registrationGeneration("managed") === assignedGeneration, false);
  assertEquals(overlays.activeId.peek(), "managed");
  overlays.dispose();
});

Deno.test("overlay stack tracks identity mutation reentered from an owned publication", () => {
  const overlays = new OverlayStackController();
  let mutated = false;
  const listener = (surfaces: ReturnType<OverlayStackController["zOrder"]>) => {
    const surface = surfaces.find((entry) => entry.id === "registered");
    if (mutated || !surface) return;
    mutated = true;
    surface.id = "reentered";
  };
  overlays.surfaces.subscribe(listener);

  try {
    overlays.register({ id: "registered", rect: { column: 0, row: 0, width: 2, height: 1 } });
    assertEquals(mutated, true);
    assertEquals(overlays.surface("registered"), undefined);
    assertEquals(overlays.registrationGeneration("registered"), undefined);
    assertEquals(typeof overlays.registrationGeneration("reentered"), "number");
    assertEquals(overlays.activeId.peek(), "reentered");
  } finally {
    overlays.surfaces.unsubscribe(listener);
    overlays.dispose();
  }
});

Deno.test("overlay insertion-only splice publishes registration provenance", () => {
  const overlays = new OverlayStackController();
  const inserted = {
    id: "inserted",
    rect: { column: 0, row: 0, width: 2, height: 1 },
    layer: "window" as const,
    kind: "custom" as const,
    zIndex: 1_000,
    order: 0,
    visible: true,
    modal: false,
    closeOnOutsideClick: false,
  };
  overlays.surfaces.value.splice(0, 0, inserted);
  assertEquals(typeof overlays.registrationGeneration("inserted"), "number");
  assertEquals(overlays.surface("inserted")?.id, "inserted");
  overlays.dispose();
});

Deno.test("overlay deep order changes keep snapshots restorable and allocator failure atomic", () => {
  const overlays = new OverlayStackController({
    surfaces: [
      { id: "managed", rect: { column: 0, row: 0, width: 2, height: 1 } },
      { id: "other", rect: { column: 3, row: 0, width: 2, height: 1 } },
    ],
  });
  assertEquals(overlays.zOrder().map((surface) => surface.id), ["managed", "other"]);
  const surface = overlays.surface("managed")!;
  surface.order = 99;
  surface.zIndex = 9_999;
  assertEquals(overlays.zOrder().map((surface) => surface.id), ["other", "managed"]);
  const advanced = overlays.snapshot();
  assertEquals(advanced.nextOrder, 100);
  overlays.restoreSnapshot(advanced);

  const beforeFailure = overlays.snapshot();
  assertThrows(
    () => {
      overlays.surfaces.value.push({
        ...surface,
        id: "unallocatable",
        rect: { ...surface.rect },
        order: Number.MAX_SAFE_INTEGER,
      });
    },
    TypeError,
    "bounded non-negative safe integer",
  );
  assertEquals(overlays.snapshot(), beforeFailure);
  assertEquals(overlays.registrationGeneration("unallocatable"), undefined);
  overlays.restoreSnapshot(overlays.snapshot());
  overlays.dispose();
});

Deno.test("overlay snapshots preserve an explicit absence of active focus", () => {
  const overlays = new OverlayStackController({
    surfaces: [{ id: "visible", rect: { column: 0, row: 0, width: 2, height: 1 } }],
  });
  const inactive = overlays.snapshot();
  assertEquals(inactive.activeId, undefined);
  overlays.restoreSnapshot(inactive);
  assertEquals(overlays.snapshot(), inactive);

  overlays.activeId.value = "missing";
  const canonical = overlays.snapshot();
  assertEquals(canonical.activeId, undefined);
  overlays.restoreSnapshot(canonical);
  assertEquals(overlays.activeId.peek(), undefined);
  overlays.dispose();
});

Deno.test("file explorer exposes indented entries and mouse-style row selection", () => {
  const opened: string[] = [];
  const explorer = new FileExplorerController({
    root: createFileExplorerTree([
      "src/components/tree.ts",
      "src/components/file_explorer.ts",
      "src/layout/window_manager.ts",
      "README.md",
    ]),
    onOpen: (entry) => {
      opened.push(entry.path);
    },
  });

  assertEquals(explorer.entries().map((entry) => entry.text).slice(0, 4), [
    "▾ src",
    "  ▾ components",
    "    · file_explorer.ts",
    "    · tree.ts",
  ]);

  explorer.tree.setSelectedIndex(2);
  assertEquals(explorer.selected()?.path, "/src/components/file_explorer.ts");
  explorer.openActive();
  assertEquals(opened, ["/src/components/file_explorer.ts"]);

  explorer.tree.setSelectedIndex(1);
  explorer.openActive();
  assertEquals(explorer.entries().map((entry) => entry.text).slice(0, 4), [
    "▾ src",
    "  ▸ components",
    "  ▾ layout",
    "    · window_manager.ts",
  ]);
  explorer.dispose();
});

function assertWindowManagerInvariants(layout: ReturnType<WindowManagerController["layout"]>): void {
  const open = new Set(layout.windows.filter((entry) => !entry.closed).map((entry) => entry.id));
  if (layout.activeId !== undefined) {
    assertEquals(open.has(layout.activeId), true);
  }
  if (layout.fullscreenId !== undefined) {
    assertEquals(open.has(layout.fullscreenId), true);
  }
  assertEquals(layout.tabs.every((entry) => open.has(entry.id)), true);
  assertEquals(layout.zOrder.every((entry) => open.has(entry.id)), true);
  assertEquals(
    layout.visible.every((entry) =>
      entry.rect !== undefined && entry.rect.width >= 0 && entry.rect.height >= 0 &&
      entry.rect.column >= layout.bounds.column && entry.rect.row >= layout.bounds.row
    ),
    true,
  );
  assertEquals(layout.contentHeight >= layout.bounds.height, true);
}
