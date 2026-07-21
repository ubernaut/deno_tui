import { assertEquals, assertNotStrictEquals, assertThrows } from "./deps.ts";
import { batchSignalUpdates } from "../src/signals/mod.ts";
import {
  createTiledWorkspaceController,
  createTiledWorkspaceControllerFromSnapshot,
  normalizeTiledWorkspaceLayout,
  projectTiledWorkspaceLayout,
  TILED_WORKSPACE_SNAPSHOT_VERSION,
  TiledWorkspaceController,
  type TiledWorkspaceLayoutNode,
  type TiledWorkspaceLayoutState,
} from "../src/layout/tiled_workspace.ts";

const bounds = { column: 0, row: 0, width: 100, height: 30 };

Deno.test("tiled workspace builds a deterministic balanced tree and reconciles visible windows", () => {
  const controller = createTiledWorkspaceController({
    windows: [
      { id: "explorer", minWidth: 20, minHeight: 6 },
      { id: "editor", minWidth: 40, minHeight: 10 },
      { id: "inspector", minWidth: 24, minHeight: 8 },
      { id: "logs", minWidth: 30, minHeight: 6 },
    ],
    activeWindowId: "editor",
  });

  assertEquals(controller.windowIds(), ["explorer", "editor", "inspector", "logs"]);
  assertEquals(controller.inspect().activeWindowId, "editor");
  assertEquals(controller.inspect().layout.root?.kind, "split");

  const reconciled = controller.reconcile([
    { id: "editor", minWidth: 44, minHeight: 11 },
    { id: "inspector", minWidth: 26, minHeight: 9 },
    { id: "terminal", minWidth: 32, minHeight: 8 },
  ]);
  assertEquals(reconciled.windows, [
    { id: "editor", minWidth: 44, minHeight: 11 },
    { id: "inspector", minWidth: 26, minHeight: 9 },
    { id: "terminal", minWidth: 32, minHeight: 8 },
  ]);
  assertEquals(reconciled.activeWindowId, "editor");
  assertEquals(new Set(collectNodeIds(reconciled.layout.root)).size, collectNodeIds(reconciled.layout.root).length);

  const collidingIds = controller.reconcile([{ id: "Foo Bar" }, { id: "foo-bar" }]);
  assertEquals(collectWindowIds(collidingIds.layout.root), ["Foo Bar", "foo-bar"]);
  assertEquals(
    new Set(collectNodeIds(collidingIds.layout.root)).size,
    collectNodeIds(collidingIds.layout.root).length,
  );
  controller.dispose();
});

Deno.test("tiled workspace projects recursive minimums and pointer separator geometry", () => {
  const controller = new TiledWorkspaceController({
    gap: 1,
    layout: nestedLayout(),
  });
  const layout = controller.layout(bounds, { separatorHitSize: 3 });

  assertEquals(layout.minimumSize, { width: 51, height: 15 });
  assertEquals(layout.fitsMinimumSize, true);
  assertEquals(layout.panes.map((pane) => [pane.windowId, pane.rect]), [
    ["explorer", { column: 0, row: 0, width: 30, height: 30 }],
    ["editor", { column: 31, row: 0, width: 69, height: 23 }],
    ["logs", { column: 31, row: 24, width: 69, height: 6 }],
  ]);
  assertEquals(layout.separators[0], {
    splitId: "root",
    direction: "row",
    axis: "column",
    ratio: 30 / 99,
    bounds,
    firstRect: { column: 0, row: 0, width: 30, height: 30 },
    rect: { column: 30, row: 0, width: 1, height: 30 },
    hitRect: { column: 29, row: 0, width: 3, height: 30 },
    secondRect: { column: 31, row: 0, width: 69, height: 30 },
  });
  assertEquals(layout.separators[1]?.axis, "row");
  assertEquals(layout.separators[1]?.rect, { column: 31, row: 23, width: 69, height: 1 });
  assertEquals(layout.separators[1]?.hitRect, { column: 31, row: 22, width: 69, height: 3 });
  controller.dispose();
});

Deno.test("tiled workspace keeps constrained projections bounded and non-negative", () => {
  const projection = projectTiledWorkspaceLayout(
    nestedLayout(),
    { column: 5, row: 7, width: 17, height: 5 },
    { gap: 2, separatorHitSize: 5 },
  );

  assertEquals(projection.fitsMinimumSize, false);
  assertEquals(projection.panes.length, 3);
  for (const pane of projection.panes) {
    assertEquals(pane.rect.width >= 0 && pane.rect.height >= 0, true);
    assertEquals(pane.rect.column >= 5 && pane.rect.row >= 7, true);
    assertEquals(pane.rect.column + pane.rect.width <= 22, true);
    assertEquals(pane.rect.row + pane.rect.height <= 12, true);
  }
  for (const separator of projection.separators) {
    assertEquals(separator.hitRect.column >= separator.bounds.column, true);
    assertEquals(separator.hitRect.row >= separator.bounds.row, true);
    assertEquals(
      separator.hitRect.column + separator.hitRect.width <= separator.bounds.column + separator.bounds.width,
      true,
    );
    assertEquals(
      separator.hitRect.row + separator.hitRect.height <= separator.bounds.row + separator.bounds.height,
      true,
    );
  }
});

Deno.test("tiled workspace resizes separators by cells and clamps against descendant minimums", () => {
  const controller = new TiledWorkspaceController({ gap: 2, layout: twoPaneLayout() });

  assertEquals(controller.layout(bounds).panes.map((pane) => pane.rect.width), [49, 49]);
  assertEquals(controller.resizeSplit("main", 40, bounds), true);
  assertEquals(controller.layout(bounds).panes.map((pane) => pane.rect.width), [68, 30]);
  assertEquals(controller.resizeSplit("main", 1, bounds), false);
  assertEquals(controller.resizeSplit("main", -100, bounds), true);
  assertEquals(controller.layout(bounds).panes.map((pane) => pane.rect.width), [20, 78]);
  assertEquals(controller.resizeSplitRatio("main", 0.1), true);
  assertEquals(controller.layout(bounds).panes.map((pane) => pane.rect.width), [29, 69]);
  assertEquals(controller.setSplitRatio("missing", 0.5), false);
  controller.dispose();
});

Deno.test("tiled workspace visibility projection collapses hidden panes without losing persisted geometry", () => {
  const controller = new TiledWorkspaceController({
    gap: 1,
    layout: {
      activePaneId: "first",
      root: {
        kind: "split",
        id: "main",
        direction: "row",
        ratio: 0.3,
        first: { kind: "pane", id: "first", windowId: "first" },
        second: { kind: "pane", id: "second", windowId: "second" },
      },
    },
  });
  const persisted = controller.snapshot();

  const minimized = controller.layout(bounds, { visibleWindowIds: new Set(["second"]) });
  assertEquals(minimized.panes.map((pane) => [pane.windowId, pane.rect]), [["second", bounds]]);
  assertEquals(minimized.separators, []);
  assertEquals(minimized.activeWindowId, "second");
  assertEquals(controller.inspect().count, 2);
  assertEquals(controller.snapshot(), persisted);

  const restored = controller.layout(bounds, { visibleWindowIds: ["first", "second"] });
  assertEquals(restored.panes.map((pane) => [pane.windowId, pane.rect.width]), [
    ["first", 29],
    ["second", 70],
  ]);
  assertEquals(restored.separators.map((separator) => separator.splitId), ["main"]);
  const restoredRoot = controller.inspect().layout.root;
  assertEquals(restoredRoot?.kind === "split" ? restoredRoot.ratio : 0, 0.3);
  controller.dispose();
});

Deno.test("tiled workspace cell resize uses the same visibility-pruned descendant minimums", () => {
  const controller = new TiledWorkspaceController({
    gap: 1,
    layout: {
      activePaneId: "visible",
      root: {
        kind: "split",
        id: "root",
        direction: "row",
        ratio: 0.5,
        first: {
          kind: "split",
          id: "left",
          direction: "column",
          ratio: 0.5,
          first: { kind: "pane", id: "hidden", windowId: "hidden", minWidth: 80 },
          second: { kind: "pane", id: "visible", windowId: "visible", minWidth: 10 },
        },
        second: { kind: "pane", id: "second", windowId: "second", minWidth: 30 },
      },
    },
  });
  const visibleWindowIds = ["visible", "second"];

  assertEquals(controller.layout(bounds, { visibleWindowIds }).panes.map((pane) => pane.rect.width), [49, 50]);
  assertEquals(controller.resizeSplit("root", -100, bounds, { visibleWindowIds }), true);
  assertEquals(controller.layout(bounds, { visibleWindowIds }).panes.map((pane) => pane.rect.width), [10, 89]);
  const root = controller.inspect().layout.root;
  assertEquals(root?.kind === "split" ? root.ratio : undefined, 10 / 99);

  assertEquals(controller.layout(bounds).panes.map((pane) => pane.windowId), ["hidden", "visible", "second"]);
  assertEquals(controller.layout(bounds).separators.map((separator) => separator.splitId), ["root", "left"]);
  controller.dispose();
});

Deno.test("tiled workspace move and swap preserve geometry while moving pane identity", () => {
  const controller = createTiledWorkspaceController({
    windows: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    activeWindowId: "a",
  });
  const paneId = controller.inspect().activePaneId;

  assertEquals(controller.move("a", 2), true);
  assertEquals(controller.windowIds(), ["b", "c", "a", "d"]);
  assertEquals(controller.inspect().activePaneId, paneId);
  assertEquals(controller.inspect().activeWindowId, "a");
  assertEquals(controller.move("a", 99), true);
  assertEquals(controller.windowIds(), ["b", "c", "d", "a"]);
  assertEquals(controller.move("a", 1), false);

  assertEquals(controller.swap("b", "d"), true);
  assertEquals(controller.windowIds(), ["d", "c", "b", "a"]);
  assertEquals(controller.inspect().activeWindowId, "b");
  controller.dispose();
});

Deno.test("tiled workspace docks panes on target edges and preserves source share", () => {
  const controller = new TiledWorkspaceController({ layout: threePaneLayout() });

  assertEquals(controller.dock("logs", "explorer", "left", { ratio: 0.25 }), true);
  assertEquals(controller.windowIds(), ["logs", "explorer", "editor"]);
  assertEquals(controller.inspect().activeWindowId, "logs");
  const layout = controller.layout(bounds);
  const dockSplit = layout.separators.find((separator) =>
    separator.firstRect.column === 0 &&
    separator.bounds.width === layout.panes.find((pane) => pane.windowId === "explorer")!
          .rect.column + layout.panes.find((pane) => pane.windowId === "explorer")!.rect.width
  );
  assertEquals(dockSplit?.direction, "row");
  const dockedState = controller.inspect().layout.root;
  assertEquals(
    dockedState?.kind === "split" && dockedState.first.kind === "split" ? dockedState.first.ratio : undefined,
    0.25,
  );

  assertEquals(controller.dock("editor", "logs", "bottom", { ratio: 0.4 }), true);
  assertEquals(controller.windowIds(), ["logs", "editor", "explorer"]);
  const vertical = controller.layout(bounds).separators.find((separator) => separator.direction === "column");
  assertEquals(vertical?.ratio, 17 / 29);
  const redockedState = controller.inspect().layout.root;
  assertEquals(
    redockedState?.kind === "split" && redockedState.first.kind === "split" ? redockedState.first.ratio : undefined,
    0.6,
  );
  assertEquals(controller.dock("editor", "editor", "left"), false);
  assertEquals(controller.dock("missing", "logs", "left"), false);
  controller.dispose();
});

Deno.test("tiled workspace normalizes duplicate ids windows ratios and active panes", () => {
  const malformed = {
    root: {
      kind: "split",
      id: "same",
      direction: "row",
      ratio: Number.POSITIVE_INFINITY,
      first: { kind: "pane", id: "same", windowId: "one", minWidth: 0 },
      second: {
        kind: "split",
        id: "same",
        direction: "invalid",
        ratio: -20,
        first: { kind: "pane", id: "same", windowId: "one" },
        second: { kind: "pane", id: "same", windowId: "two", minHeight: 4.9 },
      },
    },
    activePaneId: "missing",
  } as unknown as TiledWorkspaceLayoutState;
  const normalized = normalizeTiledWorkspaceLayout(malformed);
  const ids = collectNodeIds(normalized.root);

  assertEquals(new Set(ids).size, ids.length);
  assertEquals(collectWindowIds(normalized.root), ["one", "two"]);
  assertEquals(normalized.root?.kind, "split");
  assertEquals(normalized.root?.kind === "split" ? normalized.root.ratio : undefined, 0.5);
  assertEquals(normalized.activePaneId, "same");
  const panes = collectPanes(normalized.root);
  assertEquals(panes[0]?.minWidth, 1);
  assertEquals(panes[1]?.minHeight, 4);
});

Deno.test("tiled workspace snapshots and hydration are clone-safe and reconcile inventory", () => {
  const controller = new TiledWorkspaceController({
    windows: [{ id: "explorer", minWidth: 20 }, { id: "editor", minWidth: 40 }],
    activeWindowId: "editor",
    gap: 2,
  });
  controller.resizeSplitRatio("split-1", 0.2);
  const snapshot = controller.snapshot();

  assertEquals(snapshot.version, TILED_WORKSPACE_SNAPSHOT_VERSION);
  assertEquals(snapshot.gap, 2);
  assertNotStrictEquals(snapshot.layout, controller.state.peek());
  if (snapshot.layout.root?.kind === "split") snapshot.layout.root.ratio = 0.1;
  const unchanged = controller.snapshot().layout.root;
  assertEquals(unchanged?.kind === "split" ? unchanged.ratio : 0, 0.7);

  const restored = createTiledWorkspaceControllerFromSnapshot(controller.snapshot(), {
    windows: [{ id: "editor", minWidth: 45 }, { id: "terminal", minWidth: 30 }],
    activeWindowId: "terminal",
  });
  assertEquals(restored.inspect().windows, [
    { id: "editor", minWidth: 45, minHeight: undefined },
    { id: "terminal", minWidth: 30, minHeight: undefined },
  ]);
  assertEquals(restored.inspect().activeWindowId, "terminal");
  assertEquals(restored.snapshot().gap, 2);
  restored.dispose();
  controller.dispose();
});

Deno.test("tiled workspace restore remains provenance-consistent after a throwing gap subscriber", () => {
  const controller = new TiledWorkspaceController({ windows: [{ id: "a" }] });
  const listener = () => {
    throw new Error("gap-publication-failed");
  };
  controller.gap.subscribe(listener);

  try {
    assertThrows(
      () =>
        controller.restore({
          version: TILED_WORKSPACE_SNAPSHOT_VERSION,
          gap: 7,
          layout: {
            root: { kind: "pane", id: "pane-b", windowId: "b" },
            activePaneId: "pane-b",
          },
        }),
      Error,
      "gap-publication-failed",
    );

    controller.gap.unsubscribe(listener);
    assertEquals(controller.windowIds(), ["b"]);
    assertEquals(controller.windowRegistrationGeneration("a"), undefined);
    assertEquals(typeof controller.windowRegistrationGeneration("b"), "number");
    controller.restore(controller.snapshot());
  } finally {
    controller.gap.unsubscribe(listener);
    controller.dispose();
  }
});

Deno.test("tiled workspace tracks nested identity ABA and isolates retained ingress aliases", () => {
  const controller = new TiledWorkspaceController({ windows: [{ id: "a" }] });
  const root = controller.state.value.root;
  if (!root || root.kind !== "pane") throw new Error("Expected one tiled pane.");
  const originalGeneration = controller.windowRegistrationGeneration("a");

  batchSignalUpdates(() => {
    root.windowId = "temporary";
    root.windowId = "a";
  });

  assertEquals(controller.windowRegistrationGeneration("temporary"), undefined);
  assertEquals(controller.windowRegistrationGeneration("a") === originalGeneration, false);

  const retainedPane = { kind: "pane", id: "pane-external", windowId: "external" } as const;
  controller.state.value = { root: retainedPane, activePaneId: retainedPane.id };
  const assignedGeneration = controller.windowRegistrationGeneration("external");
  (retainedPane as { windowId: string }).windowId = "raw-alias";
  assertEquals(controller.windowIds(), ["external"]);
  assertEquals(controller.windowRegistrationGeneration("external"), assignedGeneration);
  assertEquals(controller.windowRegistrationGeneration("raw-alias"), undefined);
  controller.dispose();
});

Deno.test("tiled workspace tracks identity mutation reentered from an owned publication", () => {
  const controller = new TiledWorkspaceController({ windows: [{ id: "a" }] });
  let mutated = false;
  const listener = (state: TiledWorkspaceLayoutState) => {
    const root = state.root;
    if (mutated || !root || root.kind !== "pane" || root.windowId !== "b") return;
    mutated = true;
    root.windowId = "c";
  };
  controller.state.subscribe(listener);

  try {
    controller.reconcile([{ id: "b" }]);
    assertEquals(mutated, true);
    assertEquals(controller.windowIds(), ["c"]);
    assertEquals(controller.windowRegistrationGeneration("b"), undefined);
    assertEquals(typeof controller.windowRegistrationGeneration("c"), "number");
  } finally {
    controller.state.unsubscribe(listener);
    controller.dispose();
  }
});

Deno.test("tiled workspace rejects duplicate nested window identities atomically", () => {
  const controller = new TiledWorkspaceController({ windows: [{ id: "a" }, { id: "b" }] });
  const before = controller.snapshot();
  const panes = collectPanes(controller.state.value.root);

  assertThrows(
    () => {
      panes[1]!.windowId = "a";
    },
    TypeError,
    "duplicate window id",
  );
  assertEquals(controller.snapshot(), before);
  assertEquals(typeof controller.windowRegistrationGeneration("a"), "number");
  assertEquals(typeof controller.windowRegistrationGeneration("b"), "number");
  controller.dispose();
});

Deno.test("tiled workspace focus remove and empty reconciliation repair active state", () => {
  const controller = createTiledWorkspaceController({ windows: [{ id: "a" }, { id: "b" }, { id: "c" }] });
  assertEquals(controller.focus("b"), true);
  assertEquals(controller.inspect().activeWindowId, "b");
  assertEquals(controller.remove("b"), true);
  assertEquals(controller.windowIds(), ["a", "c"]);
  assertEquals(controller.inspect().activeWindowId, "a");
  assertEquals(controller.remove("missing"), false);
  assertEquals(controller.reconcile([]).layout, { root: undefined, activePaneId: undefined });
  assertEquals(controller.layout(bounds).panes, []);
  controller.dispose();
});

function nestedLayout(): TiledWorkspaceLayoutState {
  return {
    activePaneId: "editor-pane",
    root: {
      kind: "split",
      id: "root",
      direction: "row",
      ratio: 0.05,
      first: {
        kind: "pane",
        id: "explorer-pane",
        windowId: "explorer",
        minWidth: 30,
        minHeight: 5,
      },
      second: {
        kind: "split",
        id: "right",
        direction: "column",
        ratio: 0.9,
        first: {
          kind: "pane",
          id: "editor-pane",
          windowId: "editor",
          minWidth: 20,
          minHeight: 8,
        },
        second: {
          kind: "pane",
          id: "logs-pane",
          windowId: "logs",
          minWidth: 20,
          minHeight: 6,
        },
      },
    },
  };
}

function twoPaneLayout(): TiledWorkspaceLayoutState {
  return {
    activePaneId: "first",
    root: {
      kind: "split",
      id: "main",
      direction: "row",
      ratio: 0.5,
      first: { kind: "pane", id: "first", windowId: "first", minWidth: 20 },
      second: { kind: "pane", id: "second", windowId: "second", minWidth: 30 },
    },
  };
}

function threePaneLayout(): TiledWorkspaceLayoutState {
  return {
    activePaneId: "editor",
    root: {
      kind: "split",
      id: "root",
      direction: "row",
      ratio: 0.4,
      first: { kind: "pane", id: "explorer", windowId: "explorer" },
      second: {
        kind: "split",
        id: "right",
        direction: "column",
        ratio: 0.7,
        first: { kind: "pane", id: "editor", windowId: "editor" },
        second: { kind: "pane", id: "logs", windowId: "logs" },
      },
    },
  };
}

function collectNodeIds(node: TiledWorkspaceLayoutNode | undefined): string[] {
  if (!node) return [];
  return node.kind === "pane" ? [node.id] : [node.id, ...collectNodeIds(node.first), ...collectNodeIds(node.second)];
}

function collectWindowIds(node: TiledWorkspaceLayoutNode | undefined): string[] {
  return collectPanes(node).map((pane) => pane.windowId);
}

function collectPanes(
  node: TiledWorkspaceLayoutNode | undefined,
): Array<Extract<TiledWorkspaceLayoutNode, { kind: "pane" }>> {
  if (!node) return [];
  return node.kind === "pane" ? [node] : [...collectPanes(node.first), ...collectPanes(node.second)];
}
