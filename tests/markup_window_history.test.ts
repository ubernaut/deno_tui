import { assertEquals, assertNotEquals, assertRejects, assertThrows } from "./deps.ts";
import { HistoryOperationError, HistoryPoisonedError, HistoryStack } from "../src/app/history.ts";
import { OverlayStackController } from "../src/layout/overlay.ts";
import { createLayoutNode, type LayoutNode } from "../src/layout/solver.ts";
import {
  TiledWorkspaceController,
  type TiledWorkspaceLayoutNode,
  type TiledWorkspaceSplitNode,
} from "../src/layout/tiled_workspace.ts";
import {
  MarkupWindowHistoryAdapter,
  type MarkupWindowHistoryAdapterOptions,
  MarkupWindowHistoryRestoreError,
} from "../src/markup/window_history.ts";
import { MarkupWindowController, type MarkupWindowSnapshot } from "../src/markup/windows.ts";
import type { Rectangle } from "../src/types.ts";

const bounds: Rectangle = { column: 0, row: 0, width: 120, height: 32 };

interface Fixture {
  workspace: TiledWorkspaceController;
  overlays: OverlayStackController;
  controller: MarkupWindowController;
  history: HistoryStack;
  adapter: MarkupWindowHistoryAdapter;
}

interface ActionScenario {
  name: string;
  prepare?: (fixture: Fixture) => void;
  execute: (fixture: Fixture) => { status: string };
}

const actionScenarios: ActionScenario[] = [
  {
    name: "focus",
    execute: ({ adapter }) => adapter.focus("b"),
  },
  {
    name: "move",
    execute: ({ adapter }) => adapter.move("b", 1),
  },
  {
    name: "swap",
    execute: ({ adapter }) => adapter.swap("a", "c"),
  },
  {
    name: "dock",
    execute: ({ adapter }) => adapter.dock("c", "a", "left", { ratio: 0.3 }),
  },
  {
    name: "cell resize",
    execute: ({ adapter, controller }) => adapter.resize(firstSplitId(controller), 3, bounds, { compactMode: "never" }),
  },
  {
    name: "ratio resize",
    execute: ({ adapter, controller }) => adapter.resizeRatio(firstSplitId(controller), 0.1),
  },
  {
    name: "minimize",
    execute: ({ adapter }) => adapter.minimize("b"),
  },
  {
    name: "maximize",
    execute: ({ adapter }) => adapter.maximize("b"),
  },
  {
    name: "restore",
    prepare: ({ controller }) => {
      assertEquals(controller.minimize("b").status, "applied");
    },
    execute: ({ adapter }) => adapter.restore("b"),
  },
  {
    name: "close",
    execute: ({ adapter }) => adapter.close("b"),
  },
  {
    name: "modal focus",
    execute: ({ adapter }) => adapter.focus("modal-one"),
  },
  {
    name: "modal close",
    execute: ({ adapter }) => adapter.close("modal-two"),
  },
  {
    name: "modal restore",
    prepare: ({ controller }) => {
      assertEquals(controller.close("modal-two").status, "applied");
    },
    execute: ({ adapter }) => adapter.restore("modal-two"),
  },
];

for (const scenario of actionScenarios) {
  Deno.test(`window history ${scenario.name} restores exact geometry visibility and overlay state`, async () => {
    const fixture = createFixture();
    try {
      scenario.prepare?.(fixture);
      const before = fixtureState(fixture);
      const result = scenario.execute(fixture);
      assertEquals(result.status, "applied");
      const after = fixtureState(fixture);
      assertNotEquals(JSON.stringify(after), JSON.stringify(before));
      assertEquals(fixture.history.undoDepth, 1);
      assertEquals(fixture.history.redoDepth, 0);
      assertEquals(fixture.history.inspect().nextUndo?.composite, true);
      assertEquals(fixture.history.inspect().nextUndo?.operationCount, 1);

      assertEquals(await fixture.history.undo(), true);
      assertEquals(fixtureState(fixture), before);
      assertEquals(await fixture.history.redo(), true);
      assertEquals(fixtureState(fixture), after);
    } finally {
      disposeFixture(fixture);
    }
  });
}

Deno.test("window history floating actions restore exact geometry group and pin state", async () => {
  const fixture = createFixture();
  try {
    const snapshots = [fixtureState(fixture)];
    const apply = (result: { status: string }): void => {
      assertEquals(result.status, "applied");
      snapshots.push(fixtureState(fixture));
    };

    apply(fixture.adapter.setPlacement("a", "floating", {
      rect: { column: 4, row: 3, width: 30, height: 10 },
    }));
    apply(fixture.adapter.setGroup("a", "suite"));
    apply(fixture.adapter.setAlwaysOnTop("a", true));
    apply(fixture.adapter.setFloatingRect("a", { column: 6, row: 5, width: 28, height: 9 }));
    apply(fixture.adapter.resizeWindow("a", "bottom-right", { columns: 3, rows: 2 }));
    apply(fixture.adapter.moveBy("a", { columns: 2, rows: -1 }));
    apply(fixture.adapter.snap(
      "a",
      { kind: "corner", corner: "top-left" },
      bounds,
    ));
    apply(fixture.adapter.recoverBounds(
      "a",
      { column: 0, row: 0, width: 20, height: 8 },
      { margin: 1, titleBarHeight: 1 },
    ));

    assertEquals(fixture.history.undoDepth, snapshots.length - 1);
    for (let index = snapshots.length - 2; index >= 0; index -= 1) {
      assertEquals(await fixture.history.undo(), true);
      assertEquals(fixtureState(fixture), snapshots[index]);
    }
    assertEquals(await fixture.history.undo(), false);
    for (let index = 1; index < snapshots.length; index += 1) {
      assertEquals(await fixture.history.redo(), true);
      assertEquals(fixtureState(fixture), snapshots[index]);
    }
    assertEquals(await fixture.history.redo(), false);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history restores unmanaged descendant overlays exactly", async () => {
  const fixture = createFixture();
  try {
    fixture.overlays.register({
      id: "modal-two-child",
      ownerId: "modal-two",
      kind: "popover",
      rect: { column: 18, row: 4, width: 6, height: 2 },
    });
    fixture.overlays.register({
      id: "modal-two-grandchild",
      ownerId: "modal-two-child",
      kind: "tooltip",
      rect: { column: 22, row: 3, width: 7, height: 2 },
    });
    const before = structuredClone(fixture.overlays.snapshot());

    assertEquals(fixture.adapter.close("modal-two").status, "applied");
    assertEquals(fixture.overlays.surface("modal-two-child")?.visible, false);
    assertEquals(fixture.overlays.surface("modal-two-grandchild")?.visible, false);
    const after = structuredClone(fixture.overlays.snapshot());
    assertNotEquals(after, before);

    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.snapshot(), before);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.snapshot(), after);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history restores overlay order allocation for deterministic repeated focus", async () => {
  const fixture = createFixture();
  try {
    assertEquals(fixture.adapter.focus("modal-one").status, "applied");
    const firstOrder = fixture.overlays.surface("modal-one")!.order;
    const firstFocused = structuredClone(fixture.overlays.snapshot());

    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.adapter.focus("modal-one").status, "applied");
    assertEquals(fixture.overlays.surface("modal-one")!.order, firstOrder);
    assertEquals(fixture.overlays.snapshot(), firstFocused);
    assertEquals(fixture.history.undoDepth, 1);
    assertEquals(fixture.history.redoDepth, 0);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("overlay history snapshots reject unsafe allocator state without mutation", () => {
  const overlays = new OverlayStackController({
    surfaces: [{
      id: "surface",
      kind: "window",
      rect: { column: 0, row: 0, width: 2, height: 1 },
    }],
    activeId: "surface",
  });
  try {
    const before = structuredClone(overlays.snapshot());
    assertThrows(
      () => overlays.restoreSnapshot({ ...before, nextOrder: before.surfaces[0]!.order }),
      RangeError,
      "greater than every surface order",
    );
    assertEquals(overlays.snapshot(), before);
  } finally {
    overlays.dispose();
  }

  const exhausted = new OverlayStackController({
    surfaces: [{
      id: "last-safe-surface",
      kind: "custom",
      rect: { column: 0, row: 0, width: 1, height: 1 },
      order: Number.MAX_SAFE_INTEGER - 1,
      zIndex: Number.MAX_SAFE_INTEGER - 1,
    }],
  });
  try {
    const before = structuredClone(exhausted.snapshot());
    assertThrows(
      () =>
        exhausted.register({
          id: "too-late",
          rect: { column: 1, row: 0, width: 1, height: 1 },
        }),
      RangeError,
      "allocator is exhausted",
    );
    assertEquals(exhausted.snapshot(), before);
    assertThrows(
      () => exhausted.bringToFront("last-safe-surface"),
      RangeError,
      "allocator is exhausted",
    );
    assertEquals(exhausted.snapshot(), before);
  } finally {
    exhausted.dispose();
  }
});

Deno.test("window history skips unchanged blocked invalid and not-found outcomes", () => {
  const fixture = createFixture();
  try {
    assertEquals(fixture.adapter.focus("a").status, "unchanged");
    assertEquals(fixture.adapter.move("a", -100).status, "unchanged");
    assertEquals(fixture.adapter.swap("a", "a").status, "unchanged");
    assertEquals(fixture.adapter.resizeRatio(firstSplitId(fixture.controller), 0).status, "invalid");
    assertEquals(fixture.controller.close("b").status, "applied");
    assertEquals(fixture.adapter.minimize("b").status, "blocked");
    assertEquals(fixture.adapter.close("missing").status, "not-found");
    assertEquals(fixture.history.inspect().undoDepth, 0);
    assertEquals(fixture.history.inspect().redoDepth, 0);
    assertEquals(fixture.adapter.inspect().recordedActions, 0);
    assertEquals(fixture.adapter.inspect().skippedActions, 6);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history metadata and inspection are deterministic and clone-safe", () => {
  const fixture = createFixture({
    idPrefix: "workbench",
    group: "layout",
    label: (operation) => `Host ${operation.action}: ${operation.id}`,
  });
  try {
    assertEquals(fixture.adapter.move("b", 1).status, "applied");
    assertEquals(fixture.history.inspect().nextUndo, {
      id: "workbench.move.b",
      label: "Host move: b",
      group: "layout",
      composite: true,
      operationCount: 1,
    });
    const inspection = fixture.adapter.inspect();
    assertEquals(inspection, {
      disposed: false,
      idPrefix: "workbench",
      group: "layout",
      attemptedActions: 1,
      recordedActions: 1,
      skippedActions: 0,
      failedActions: 0,
      lastOperation: { action: "move", id: "b", targetId: undefined, parameters: { delta: 1 } },
      lastResult: { action: "move", status: "applied", ok: true, id: "b" },
      lastEntry: { id: "workbench.move.b", label: "Host move: b", group: "layout" },
      history: fixture.history.inspect(),
    });
    inspection.lastOperation!.parameters!.delta = 99;
    inspection.lastEntry!.label = "mutated";
    assertEquals(fixture.adapter.inspect().lastOperation?.parameters?.delta, 1);
    assertEquals(fixture.adapter.inspect().lastEntry?.label, "Host move: b");
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history accounts for metadata failures before executing controller state", () => {
  const fixture = createFixture({
    label: () => {
      throw new Error("label failed");
    },
  });
  try {
    const before = fixtureState(fixture);
    assertThrows(() => fixture.adapter.move("b", 1), Error, "label failed");
    assertEquals(fixtureState(fixture), before);
    assertEquals(fixture.history.undoDepth, 0);
    assertEquals(fixture.adapter.inspect().attemptedActions, 1);
    assertEquals(fixture.adapter.inspect().failedActions, 1);
    assertEquals(fixture.adapter.inspect().lastEntry, undefined);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("terminal and web adapters can share one controller and history without ownership coupling", async () => {
  const fixture = createFixture();
  const terminal = fixture.adapter;
  const web = new MarkupWindowHistoryAdapter({
    controller: fixture.controller,
    history: fixture.history,
    idPrefix: "web-window",
  });
  try {
    const initial = fixtureState(fixture);
    assertEquals(terminal.move("b", 1).status, "applied");
    const moved = fixtureState(fixture);
    assertEquals(web.minimize("a").status, "applied");
    assertEquals(fixture.history.undoDepth, 2);

    terminal.dispose();
    assertEquals(terminal.close("c"), {
      action: "close",
      status: "disposed",
      ok: false,
      id: "c",
      targetId: undefined,
      reason: "window-history-adapter-disposed",
    });
    assertEquals(fixture.history.undoDepth, 2);
    assertEquals(fixture.controller.inspect().disposed, false);

    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixtureState(fixture), moved);
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixtureState(fixture), initial);
    assertEquals(web.focus("c").status, "applied");
  } finally {
    web.dispose();
    disposeFixture(fixture);
  }
});

Deno.test("rejected snapshot restore is compensated and does not advance history", async () => {
  const owner: { controller?: MarkupWindowController } = {};
  const rejectedSnapshots = new Set<string>();
  const fixture = createFixture({
    restoreSnapshot: (snapshot) => {
      if (rejectedSnapshots.has(snapshotKey(snapshot))) {
        return {
          action: "restore-snapshot",
          status: "blocked",
          ok: false,
          reason: "injected-restore-failure",
        };
      }
      return owner.controller!.restoreSnapshot(snapshot);
    },
  });
  owner.controller = fixture.controller;
  try {
    const before = fixtureState(fixture);
    assertEquals(fixture.adapter.move("b", 1).status, "applied");
    const after = fixtureState(fixture);
    rejectedSnapshots.add(snapshotKey(before.controller));

    const error = await assertRejects(() => fixture.history.undo(), HistoryOperationError);
    assertEquals(error.poisoned, false);
    assertEquals(fixtureState(fixture), after);
    assertEquals(fixture.history.undoDepth, 1);
    assertEquals(fixture.history.redoDepth, 0);

    rejectedSnapshots.clear();
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixtureState(fixture), before);
    rejectedSnapshots.add(snapshotKey(after.controller));
    const redoError = await assertRejects(() => fixture.history.redo(), HistoryOperationError);
    assertEquals(redoError.poisoned, false);
    assertEquals(fixtureState(fixture), before);
    assertEquals(fixture.history.undoDepth, 0);
    assertEquals(fixture.history.redoDepth, 1);

    rejectedSnapshots.clear();
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixtureState(fixture), after);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("failed snapshot compensation poisons shared history with a structured diagnostic", async () => {
  const fixture = createFixture({
    restoreSnapshot: () => ({
      action: "restore-snapshot",
      status: "blocked",
      ok: false,
      reason: "injected-total-restore-failure",
    }),
  });
  try {
    assertEquals(fixture.adapter.move("b", 1).status, "applied");
    const after = fixtureState(fixture);
    const error = await assertRejects(() => fixture.history.undo(), HistoryOperationError);
    assertEquals(error.poisoned, true);
    assertEquals(fixture.history.isPoisoned(), true);
    assertEquals(fixtureState(fixture), after);
    assertEquals(fixture.history.inspect().poisoned?.reason, "compensation-failed");
    assertEquals(fixture.history.inspect().poisoned?.failedEntry.label, 'Move window "b"');
    assertEquals(
      fixture.history.inspect().poisoned?.compensationFailures[0]?.error.name,
      "MarkupWindowHistoryRestoreError",
    );
    fixture.history.clear();
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("partial initial action failure poisons history when exact rollback also fails", () => {
  const fixture = createFixture({
    restoreSnapshot: () => ({
      action: "restore-snapshot",
      status: "blocked",
      ok: false,
      reason: "injected-initial-rollback-failure",
    }),
  });
  const move = fixture.controller.move.bind(fixture.controller);
  fixture.controller.move = (id, delta) => {
    move(id, delta);
    throw new Error("injected-partial-action-failure");
  };
  try {
    assertThrows(
      () => fixture.adapter.move("b", 1),
      HistoryPoisonedError,
      "History is poisoned",
    );
    assertEquals(fixture.history.isPoisoned(), true);
    assertEquals(fixture.history.undoDepth, 0);
    assertEquals(fixture.history.redoDepth, 0);
    assertEquals(fixture.history.inspect().poisoned?.reason, "compensation-failed");
    assertEquals(fixture.adapter.inspect().failedActions, 1);
    assertEquals(fixture.adapter.inspect().recordedActions, 0);
    fixture.history.clear();
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history gesture records one already-applied entry after one hundred live updates", async () => {
  const fixture = createFixture();
  try {
    const splitId = firstSplitId(fixture.controller);
    const before = fixtureState(fixture);
    const gesture = fixture.adapter.beginGesture({
      action: "resize-ratio",
      id: splitId,
      parameters: { updates: 100 },
    });
    for (let index = 0; index < 100; index += 1) {
      assertEquals(fixture.controller.resizeRatio(splitId, 0.001).status, "applied");
    }
    const after = fixtureState(fixture);

    assertEquals(gesture.commit(), true);
    assertEquals(gesture.commit(), false);
    assertEquals(gesture.cancel(), false);
    assertEquals(gesture.inspect().state, "committed");
    assertEquals(gesture.inspect().changed, true);
    assertEquals(fixture.history.undoDepth, 1);
    assertEquals(fixture.history.inspect().nextUndo?.operationCount, undefined);

    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixtureState(fixture), before);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixtureState(fixture), after);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history gesture cancel and no-op commit record nothing", () => {
  const fixture = createFixture();
  try {
    const splitId = firstSplitId(fixture.controller);
    const before = fixtureState(fixture);
    const cancelled = fixture.adapter.beginGesture({ action: "resize-ratio", id: splitId });
    for (let index = 0; index < 10; index += 1) fixture.controller.resizeRatio(splitId, 0.005);
    assertEquals(cancelled.cancel(), true);
    assertEquals(cancelled.cancel(), false);
    assertEquals(cancelled.commit(), false);
    assertEquals(cancelled.inspect().state, "cancelled");
    assertEquals(fixtureState(fixture), before);
    assertEquals(fixture.history.undoDepth, 0);

    const noOp = fixture.adapter.beginGesture({ action: "move", id: "b", parameters: { delta: 0 } });
    assertEquals(noOp.commit(), false);
    assertEquals(noOp.inspect().state, "committed");
    assertEquals(noOp.inspect().changed, false);
    assertEquals(fixture.history.undoDepth, 0);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history allows one live gesture and blocks competing adapter actions", () => {
  const fixture = createFixture();
  try {
    const before = fixtureState(fixture);
    const active = fixture.adapter.beginGesture({ action: "move-by", id: "a" });
    const competing = fixture.adapter.beginGesture({ action: "resize-window", id: "a" });
    assertEquals(competing.inspect().state, "unavailable");
    assertEquals(competing.commit(), false);
    assertEquals(fixture.adapter.move("b", 1).status, "blocked");
    assertEquals(fixtureState(fixture), before);

    assertEquals(active.cancel(), true);
    assertEquals(fixture.adapter.move("b", 1).status, "applied");
    assertEquals(fixture.history.undoDepth, 1);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history gesture metadata failure rolls live state back without recording", () => {
  const fixture = createFixture({
    label: () => {
      throw new Error("gesture label failed");
    },
  });
  try {
    const before = fixtureState(fixture);
    const gesture = fixture.adapter.beginGesture({ action: "move", id: "b" });
    assertEquals(fixture.controller.move("b", 1).status, "applied");
    assertThrows(() => gesture.commit(), Error, "gesture label failed");
    assertEquals(gesture.inspect().state, "failed");
    assertEquals(fixtureState(fixture), before);
    assertEquals(fixture.history.undoDepth, 0);
    assertEquals(fixture.adapter.inspect().failedActions, 1);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history gesture preserves unrelated shared overlays across undo and redo", async () => {
  const fixture = createFixture();
  try {
    const gesture = fixture.adapter.beginGesture({ action: "move", id: "b", parameters: { delta: 1 } });
    assertEquals(fixture.controller.move("b", 1).status, "applied");
    fixture.overlays.register({
      id: "shared-toast",
      kind: "toast",
      layer: "system",
      rect: { column: 70, row: 1, width: 18, height: 3 },
    });
    fixture.overlays.register({
      id: "shared-toast-detail",
      kind: "custom",
      ownerId: "shared-toast",
      rect: { column: 72, row: 2, width: 12, height: 1 },
    });
    const unrelated = fixture.overlays.inspect().surfaces.filter((surface) => surface.id.startsWith("shared-"));
    const unrelatedActiveId = fixture.overlays.inspect().activeId;
    assertEquals(gesture.commit(), true);

    assertEquals(await fixture.history.undo(), true);
    assertEquals(
      fixture.overlays.inspect().surfaces.filter((surface) => surface.id.startsWith("shared-")),
      unrelated,
    );
    assertEquals(fixture.overlays.inspect().activeId, unrelatedActiveId);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(
      fixture.overlays.inspect().surfaces.filter((surface) => surface.id.startsWith("shared-")),
      unrelated,
    );
    assertEquals(fixture.overlays.inspect().activeId, unrelatedActiveId);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history gesture exposes failed cancellation compensation without recording", () => {
  const fixture = createFixture({
    restoreSnapshot: () => ({
      action: "restore-snapshot",
      status: "blocked",
      ok: false,
      reason: "injected-gesture-restore-failure",
    }),
  });
  try {
    const before = fixtureState(fixture);
    const gesture = fixture.adapter.beginGesture({ action: "move", id: "b", parameters: { delta: 1 } });
    assertEquals(fixture.controller.move("b", 1).status, "applied");
    assertThrows(() => gesture.cancel(), MarkupWindowHistoryRestoreError, "compensation");
    assertEquals(gesture.inspect().state, "failed");
    assertEquals(fixture.history.undoDepth, 0);
    assertEquals(fixture.adapter.inspect().failedActions, 1);
    assertNotEquals(fixtureState(fixture), before);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("window history bounds identifiers labels and lone surrogates", () => {
  const fixture = createFixture({
    idPrefix: `prefix-${"x".repeat(300)}\ud800`,
    group: `group-${"y".repeat(300)}\udfff`,
    label: () => `label-${"z".repeat(800)}\ud800`,
  });
  try {
    const gesture = fixture.adapter.beginGesture({
      action: "move",
      id: `b\ud800${"q".repeat(500)}`,
      parameters: Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`p${index}\udfff`, "v".repeat(300)])),
    });
    assertEquals(gesture.commit(), false);
    const inspection = gesture.inspect();
    assertEquals((inspection.operation.id?.length ?? 0) <= 128, true);
    assertEquals(Object.keys(inspection.operation.parameters ?? {}).length, 32);
    assertEquals(JSON.stringify(inspection).includes("\\ud800"), false);
    assertEquals(JSON.stringify(inspection).includes("\\udfff"), false);
    assertEquals(fixture.adapter.inspect().idPrefix.length <= 128, true);
    assertEquals(fixture.adapter.inspect().group.length <= 128, true);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("shared adapters exclude overlapping gestures and release the lease on disposal", () => {
  const fixture = createFixture();
  const second = new MarkupWindowHistoryAdapter({ controller: fixture.controller, history: fixture.history });
  try {
    const before = fixtureState(fixture);
    const gesture = fixture.adapter.beginGesture({ action: "move", id: "b" });
    assertEquals(fixture.controller.move("b", 1).status, "applied");
    assertEquals(second.minimize("a").reason, "window-history-gesture-active");
    assertEquals(second.beginGesture({ action: "move", id: "c" }).inspect().state, "unavailable");

    fixture.adapter.dispose();
    assertEquals(gesture.inspect().state, "cancelled");
    assertEquals(fixtureState(fixture), before);
    assertEquals(second.move("b", 1).status, "applied");
    assertEquals(fixture.history.undoDepth, 1);
  } finally {
    second.dispose();
    disposeFixture(fixture);
  }
});

Deno.test("side-effecting metadata callbacks are compensated before their error escapes", () => {
  const owner: { controller?: MarkupWindowController } = {};
  const fixture = createFixture({
    label: () => {
      owner.controller!.minimize("a");
      throw new Error("hostile-label");
    },
  });
  owner.controller = fixture.controller;
  try {
    const before = fixtureState(fixture);
    assertThrows(() => fixture.adapter.move("b", 1), Error, "hostile-label");
    assertEquals(fixtureState(fixture), before);
    assertEquals(fixture.history.undoDepth, 0);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("history excludes conflicting declarative modal ids from managed overlay roots", async () => {
  const fixture = createFixture();
  try {
    fixture.overlays.register({
      id: "external-conflict",
      kind: "toast",
      layer: "system",
      rect: { column: 70, row: 1, width: 15, height: 3 },
    });
    fixture.controller.reconcile(
      markupRoot(windowNode("a"), windowNode("b"), windowNode("c"), modalNode("external-conflict", 60)),
    );
    const external = structuredClone(fixture.overlays.surface("external-conflict"));
    assertEquals(fixture.controller.inspect().modals[0]!.registered, false);
    assertEquals(fixture.adapter.move("b", 1).status, "applied");
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.surface("external-conflict"), external);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves reentrant same-id overlay registration takeovers", async () => {
  const fixture = createFixture();
  let replacement: ReturnType<OverlayStackController["surface"]>;
  let replacementGeneration: number | undefined;
  let replaced = false;
  const listener = () => {
    if (replaced) return;
    replaced = true;
    fixture.overlays.remove("modal-one");
    replacement = fixture.overlays.register({
      id: "modal-one",
      rect: { column: 41, row: 17, width: 9, height: 3 },
      layer: "system",
      kind: "toast",
      zIndex: 7_777,
      visible: true,
      modal: false,
      ownerId: "external-owner",
    });
    replacementGeneration = fixture.overlays.registrationGeneration("modal-one");
  };
  fixture.workspace.state.subscribe(listener);
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.workspace.state.unsubscribe(listener);
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.surface("modal-one"), replacement);
    assertEquals(fixture.overlays.registrationGeneration("modal-one"), replacementGeneration);
    assertEquals(
      fixture.controller.inspect().modals.find((modal) => modal.id === "modal-one")?.registered,
      false,
    );
  } finally {
    fixture.workspace.state.unsubscribe(listener);
    disposeFixture(fixture);
  }
});

Deno.test("history replay does not resurrect a managed modal removed during an unrelated action", async () => {
  const fixture = createFixture();
  let removed = false;
  const listener = () => {
    if (removed) return;
    removed = true;
    fixture.overlays.remove("modal-one");
  };
  fixture.workspace.state.subscribe(listener);
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.workspace.state.unsubscribe(listener);
    assertEquals(fixture.overlays.surface("modal-one"), undefined);
    assertEquals(
      fixture.controller.inspect().modals.find((modal) => modal.id === "modal-one")?.registered,
      false,
    );

    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.surface("modal-one"), undefined);
    assertEquals(
      fixture.controller.inspect().modals.find((modal) => modal.id === "modal-one")?.registered,
      false,
    );
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.surface("modal-one"), undefined);
  } finally {
    fixture.workspace.state.unsubscribe(listener);
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves active descendant overlay registration takeovers", async () => {
  const fixture = createFixture();
  fixture.overlays.register({
    id: "modal-two-child",
    ownerId: "modal-two",
    kind: "popover",
    rect: { column: 18, row: 4, width: 6, height: 2 },
  });
  let replacement: ReturnType<OverlayStackController["surface"]>;
  let replacementGeneration: number | undefined;
  let replaced = false;
  const listener = () => {
    if (replaced) return;
    replaced = true;
    fixture.overlays.remove("modal-two-child");
    replacement = fixture.overlays.register({
      id: "modal-two-child",
      ownerId: "modal-two",
      kind: "popover",
      rect: { column: 44, row: 11, width: 13, height: 4 },
      zIndex: 8_888,
    });
    replacementGeneration = fixture.overlays.registrationGeneration("modal-two-child");
  };
  fixture.workspace.state.subscribe(listener);
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.workspace.state.unsubscribe(listener);
    assertEquals(fixture.overlays.activeId.peek(), "modal-two-child");

    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.surface("modal-two-child"), replacement);
    assertEquals(fixture.overlays.registrationGeneration("modal-two-child"), replacementGeneration);
    assertEquals(fixture.overlays.activeId.peek(), "modal-two-child");
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.surface("modal-two-child"), replacement);
    assertEquals(fixture.overlays.registrationGeneration("modal-two-child"), replacementGeneration);
    assertEquals(fixture.overlays.activeId.peek(), "modal-two-child");
  } finally {
    fixture.workspace.state.unsubscribe(listener);
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves a same-generation descendant reparented outside managed roots", async () => {
  const fixture = createFixture();
  fixture.overlays.register({
    id: "modal-two-child",
    ownerId: "modal-two",
    kind: "popover",
    rect: { column: 18, row: 4, width: 6, height: 2 },
  });
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    const generation = fixture.overlays.registrationGeneration("modal-two-child");
    const replacement = fixture.overlays.update("modal-two-child", {
      ownerId: "external-owner",
      rect: { column: 51, row: 12, width: 9, height: 3 },
    });
    assertEquals(fixture.overlays.registrationGeneration("modal-two-child"), generation);

    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.surface("modal-two-child"), replacement);
    assertEquals(fixture.overlays.registrationGeneration("modal-two-child"), generation);
    assertEquals(fixture.history.inspect().poisoned, undefined);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.surface("modal-two-child"), replacement);
    assertEquals(fixture.overlays.registrationGeneration("modal-two-child"), generation);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves a same-generation declarative modal signature takeover", async () => {
  const fixture = createFixture();
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    const generation = fixture.overlays.registrationGeneration("modal-one");
    const replacement = fixture.overlays.update("modal-one", {
      rect: { column: 57, row: 13, width: 17, height: 5 },
    });
    assertEquals(fixture.overlays.registrationGeneration("modal-one"), generation);
    assertEquals(
      fixture.controller.inspect().modals.find((modal) => modal.id === "modal-one")?.registered,
      false,
    );

    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.surface("modal-one"), replacement);
    assertEquals(fixture.overlays.registrationGeneration("modal-one"), generation);
    assertEquals(fixture.history.inspect().poisoned, undefined);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.surface("modal-one"), replacement);
    assertEquals(fixture.overlays.registrationGeneration("modal-one"), generation);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("history replay treats managed modal ordering as replayable state", async () => {
  const fixture = createFixture();
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.overlays.bringToFront("modal-one");
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.history.inspect().poisoned, undefined);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.history.inspect().poisoned, undefined);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves removal of an active managed-overlay descendant", async () => {
  const fixture = createFixture();
  fixture.overlays.register({
    id: "modal-two-child",
    ownerId: "modal-two",
    kind: "popover",
    rect: { column: 18, row: 4, width: 6, height: 2 },
  });
  let removed = false;
  const listener = () => {
    if (removed) return;
    removed = true;
    fixture.overlays.remove("modal-two-child");
  };
  fixture.workspace.state.subscribe(listener);
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.workspace.state.unsubscribe(listener);
    const activeAfterRemoval = fixture.overlays.activeId.peek();
    assertEquals(fixture.overlays.surface("modal-two-child"), undefined);

    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.surface("modal-two-child"), undefined);
    assertEquals(fixture.overlays.activeId.peek(), activeAfterRemoval);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.surface("modal-two-child"), undefined);
    assertEquals(fixture.overlays.activeId.peek(), activeAfterRemoval);
  } finally {
    fixture.workspace.state.unsubscribe(listener);
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves workspace ABA registrations while undoing unrelated layout", async () => {
  const fixture = createFixture();
  const originalGeneration = fixture.workspace.windowRegistrationGeneration("a");
  let replacementGeneration: number | undefined;
  let replaced = false;
  const listener = () => {
    if (replaced) return;
    replaced = true;
    fixture.workspace.reconcile([{ id: "b" }, { id: "c" }]);
    fixture.workspace.reconcile([
      { id: "b" },
      { id: "c" },
      { id: "a", minWidth: 77, minHeight: 66 },
    ]);
    replacementGeneration = fixture.workspace.windowRegistrationGeneration("a");
  };
  fixture.workspace.state.subscribe(listener);
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.workspace.state.unsubscribe(listener);
    assertEquals(replacementGeneration === originalGeneration, false);
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.workspace.windowIds(), ["a", "b", "c"]);
    assertEquals(fixture.workspace.windowRegistrationGeneration("a"), replacementGeneration);
    assertEquals(fixture.workspace.inspect().windows.find((entry) => entry.id === "a"), {
      id: "a",
      minWidth: 77,
      minHeight: 66,
    });
    assertEquals(fixture.controller.inspect().windows.map((window) => window.id), ["b", "c"]);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.workspace.windowRegistrationGeneration("a"), replacementGeneration);
    assertEquals(fixture.controller.inspect().windows.map((window) => window.id), ["b", "c"]);
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.workspace.windowRegistrationGeneration("a"), replacementGeneration);
    assertEquals(fixture.controller.inspect().windows.map((window) => window.id), ["b", "c"]);
  } finally {
    fixture.workspace.state.unsubscribe(listener);
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves a removed active workspace registration with floating fallback", async () => {
  const workspace = new TiledWorkspaceController({ gap: 1 });
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a"), windowNode("b")),
    workspace,
    overlays,
    compactMode: "never",
  });
  const history = new HistoryStack();
  const adapter = new MarkupWindowHistoryAdapter({ controller, history });
  const fixture: Fixture = { workspace, overlays, controller, history, adapter };
  assertEquals(
    controller.setPlacement("b", "floating", {
      rect: { column: 4, row: 3, width: 30, height: 10 },
    }).status,
    "applied",
  );
  assertEquals(controller.focus("a").status, "applied");
  let removed = false;
  const listener = () => {
    if (removed) return;
    removed = true;
    workspace.reconcile([{ id: "b" }]);
  };
  workspace.state.subscribe(listener);
  try {
    assertEquals(adapter.move("a", 1).status, "applied");
    workspace.state.unsubscribe(listener);
    assertEquals(workspace.windowIds(), ["b"]);
    assertEquals(controller.inspect().windows.map((window) => window.id), ["b"]);

    assertEquals(await history.undo(), true);
    assertEquals(workspace.windowIds(), ["b"]);
    assertEquals(controller.inspect().activeWindowId, "b");
    assertEquals(controller.inspect().windows, [
      {
        id: "b",
        title: undefined,
        minWidth: undefined,
        minHeight: undefined,
        declaredVisible: true,
        state: "normal",
        placement: "floating",
        floatingRect: { column: 4, row: 3, width: 30, height: 10 },
        restoreRect: { column: 4, row: 3, width: 30, height: 10 },
        alwaysOnTop: false,
        focusOrder: 0,
        active: true,
        visible: true,
      },
    ]);
    assertEquals(workspace.inspect().layout.activePaneId, "pane-b");
    assertEquals(await history.redo(), true);
    assertEquals(workspace.windowIds(), ["b"]);
    assertEquals(controller.inspect().activeWindowId, "b");
  } finally {
    workspace.state.unsubscribe(listener);
    disposeFixture(fixture);
  }
});

Deno.test("managed modal replay restores exact external focus including long semantic ids", async () => {
  const fixture = createFixture();
  const longModalId = `modal-${"x".repeat(180)}`;
  try {
    fixture.controller.reconcile(
      markupRoot(windowNode("a"), windowNode("b"), windowNode("c"), modalNode(longModalId, 20)),
    );
    fixture.overlays.register({
      id: "external-focus",
      kind: "toast",
      layer: "system",
      rect: { column: 80, row: 1, width: 12, height: 2 },
    });
    assertEquals(fixture.overlays.inspect().activeId, "external-focus");
    assertEquals(fixture.adapter.focus(longModalId).status, "applied");
    assertEquals(fixture.overlays.inspect().activeId, longModalId);
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.inspect().activeId, "external-focus");
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.inspect().activeId, longModalId);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves hidden external focus and canonical missing focus", async () => {
  const fixture = createFixture();
  try {
    fixture.overlays.register({
      id: "hidden-external",
      kind: "toast",
      layer: "system",
      visible: false,
      rect: { column: 80, row: 1, width: 12, height: 2 },
    });
    fixture.overlays.activeId.value = "hidden-external";
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.activeId.peek(), "hidden-external");
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.activeId.peek(), "hidden-external");

    fixture.history.clear();
    fixture.overlays.activeId.value = "missing";
    assertEquals(fixture.adapter.move("b", 1).status, "applied");
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.activeId.peek(), undefined);
    assertEquals(fixture.history.inspect().poisoned, undefined);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves fresh managed and explicit no-focus changes", async () => {
  const fixture = createFixture();
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.overlays.activeId.value = undefined;
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.activeId.peek(), undefined);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.activeId.peek(), undefined);

    fixture.history.clear();
    fixture.overlays.activeId.value = "modal-two";
    assertEquals(fixture.adapter.move("b", 1).status, "applied");
    fixture.overlays.activeId.value = "modal-one";
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixture.overlays.activeId.peek(), "modal-one");
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.activeId.peek(), "modal-one");
    assertEquals(fixture.history.inspect().poisoned, undefined);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves an external overlay registered during controller restoration", async () => {
  const fixture = createFixture();
  let registered = false;
  const listener = () => {
    if (registered) return;
    registered = true;
    fixture.overlays.register({
      id: "during-replay",
      kind: "toast",
      layer: "system",
      rect: { column: 81, row: 2, width: 14, height: 2 },
    });
  };
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.workspace.state.subscribe(listener);
    assertEquals(await fixture.history.undo(), true);
    fixture.workspace.state.unsubscribe(listener);
    assertEquals(fixture.overlays.surface("during-replay")?.id, "during-replay");
    assertEquals(fixture.overlays.activeId.peek(), "during-replay");
    assertEquals(fixture.history.inspect().poisoned, undefined);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.surface("during-replay")?.id, "during-replay");
  } finally {
    fixture.workspace.state.unsubscribe(listener);
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves an external workspace pane added during controller restoration", async () => {
  const fixture = createFixture();
  let added = false;
  const listener = () => {
    if (added) return;
    added = true;
    fixture.workspace.reconcile([
      ...fixture.workspace.inspect().windows,
      { id: "during-replay", minWidth: 19, minHeight: 4 },
    ]);
  };
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.workspace.state.subscribe(listener);
    assertEquals(await fixture.history.undo(), true);
    fixture.workspace.state.unsubscribe(listener);
    assertEquals(fixture.workspace.windowIds().includes("during-replay"), true);
    assertEquals(fixture.workspace.inspect().windows.find(({ id }) => id === "during-replay"), {
      id: "during-replay",
      minWidth: 19,
      minHeight: 4,
    });
    assertEquals(fixture.history.inspect().poisoned, undefined);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.workspace.windowIds().includes("during-replay"), true);
    assertEquals(fixture.history.inspect().poisoned, undefined);
  } finally {
    fixture.workspace.state.unsubscribe(listener);
    disposeFixture(fixture);
  }
});

for (
  const scenario of [
    { name: "existing external focus", activeId: "existing-replay-toast" },
    { name: "explicit no focus", activeId: undefined },
  ] as const
) {
  Deno.test(`history replay preserves ${scenario.name} assigned during controller restoration`, async () => {
    const fixture = createFixture();
    let assigned = false;
    const listener = () => {
      if (assigned) return;
      assigned = true;
      fixture.overlays.activeId.value = scenario.activeId;
    };
    try {
      fixture.overlays.register({
        id: "existing-replay-toast",
        kind: "toast",
        layer: "system",
        rect: { column: 82, row: 2, width: 18, height: 2 },
      });
      fixture.overlays.activeId.value = "modal-two";
      assertEquals(fixture.adapter.move("b", -1).status, "applied");
      fixture.workspace.state.subscribe(listener);
      assertEquals(await fixture.history.undo(), true);
      fixture.workspace.state.unsubscribe(listener);
      assertEquals(fixture.overlays.activeId.peek(), scenario.activeId);
      assertEquals(fixture.history.inspect().poisoned, undefined);
      assertEquals(await fixture.history.redo(), true);
      assertEquals(fixture.overlays.activeId.peek(), scenario.activeId);
      assertEquals(fixture.history.inspect().poisoned, undefined);
    } finally {
      fixture.workspace.state.unsubscribe(listener);
      disposeFixture(fixture);
    }
  });
}

Deno.test("history replay preserves focus changed through a public overlay operation", async () => {
  const fixture = createFixture();
  let focused = false;
  const listener = () => {
    if (focused) return;
    focused = true;
    fixture.overlays.bringToFront("operation-replay-toast");
  };
  try {
    fixture.overlays.register({
      id: "operation-replay-toast",
      kind: "toast",
      layer: "system",
      rect: { column: 80, row: 2, width: 20, height: 2 },
    });
    fixture.overlays.activeId.value = "modal-two";
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.workspace.state.subscribe(listener);
    assertEquals(await fixture.history.undo(), true);
    fixture.workspace.state.unsubscribe(listener);
    assertEquals(fixture.overlays.activeId.peek(), "operation-replay-toast");
    assertEquals(fixture.history.inspect().poisoned, undefined);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.overlays.activeId.peek(), "operation-replay-toast");
    assertEquals(fixture.history.inspect().poisoned, undefined);
  } finally {
    fixture.workspace.state.unsubscribe(listener);
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves focus assigned during final managed-overlay restoration", async () => {
  const workspace = new TiledWorkspaceController({ gap: 1 });
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("a"),
      windowNode("b"),
      windowNode("c"),
      modalNode("modal-one", 2),
      modalNode("modal-two", 16),
    ),
    workspace,
    overlays,
    compactMode: "never",
  });
  const history = new HistoryStack();
  let installSurfaceListener = false;
  let assigned = false;
  const surfaceListener = () => {
    if (assigned) return;
    assigned = true;
    overlays.activeId.value = "late-replay-toast";
  };
  const adapter = new MarkupWindowHistoryAdapter({
    controller,
    history,
    restoreSnapshot: (snapshot) => {
      const result = controller.restoreSnapshot(snapshot);
      if (installSurfaceListener) {
        installSurfaceListener = false;
        overlays.surfaces.subscribe(surfaceListener);
      }
      return result;
    },
  });
  const fixture: Fixture = { workspace, overlays, controller, history, adapter };
  try {
    overlays.register({
      id: "late-replay-toast",
      kind: "toast",
      layer: "system",
      rect: { column: 78, row: 1, width: 18, height: 2 },
    });
    overlays.activeId.value = "modal-two";
    assertEquals(adapter.move("b", -1).status, "applied");
    installSurfaceListener = true;
    assertEquals(await history.undo(), true);
    overlays.surfaces.unsubscribe(surfaceListener);
    assertEquals(overlays.activeId.peek(), "late-replay-toast");
    assertEquals(history.inspect().poisoned, undefined);
    assertEquals(await history.redo(), true);
    assertEquals(overlays.activeId.peek(), "late-replay-toast");
  } finally {
    overlays.surfaces.unsubscribe(surfaceListener);
    disposeFixture(fixture);
  }
});

Deno.test("history replay rebases a late docked external pane without losing its split geometry", async () => {
  const fixture = createFixture();
  const externalId = "during-replay-docked";
  let mutated = false;
  const listener = () => {
    if (mutated) return;
    mutated = true;
    fixture.workspace.reconcile([
      ...fixture.workspace.inspect().windows,
      { id: externalId, minWidth: 19, minHeight: 4 },
    ]);
    assertEquals(fixture.workspace.dock(externalId, "b", "left", { ratio: 0.27 }), true);
    const split = findDirectWorkspaceSplit(fixture.workspace.snapshot().layout.root, externalId, "b");
    assertEquals(split === undefined, false);
    assertEquals(fixture.workspace.setSplitRatio(split!.id, 0.31), true);
  };
  const beforeRoot = structuredClone(fixture.controller.snapshot().workspace.layout.root);
  try {
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    const afterRoot = structuredClone(fixture.controller.snapshot().workspace.layout.root);
    fixture.workspace.state.subscribe(listener);

    assertEquals(await fixture.history.undo(), true);
    fixture.workspace.state.unsubscribe(listener);
    assertRebasedExternalWorkspace(fixture.workspace, externalId, "b", beforeRoot);
    assertEquals(fixture.history.inspect().poisoned, undefined);

    assertEquals(await fixture.history.redo(), true);
    assertRebasedExternalWorkspace(fixture.workspace, externalId, "b", afterRoot);
    assertEquals(fixture.history.inspect().poisoned, undefined);

    assertEquals(await fixture.history.undo(), true);
    assertRebasedExternalWorkspace(fixture.workspace, externalId, "b", beforeRoot);
    assertEquals(fixture.history.inspect().poisoned, undefined);
  } finally {
    fixture.workspace.state.unsubscribe(listener);
    disposeFixture(fixture);
  }
});

Deno.test("history replay preserves workspace mutations triggered by restored gap publication", async () => {
  const fixture = createFixture();
  const externalId = "gap-replay-pane";
  let changedGap = false;
  const actionListener = () => {
    if (changedGap) return;
    changedGap = true;
    fixture.workspace.gap.value = 2;
  };
  let added = false;
  const gapListener = () => {
    if (added) return;
    added = true;
    fixture.workspace.reconcile([
      ...fixture.workspace.inspect().windows,
      { id: externalId, minWidth: 17, minHeight: 3 },
    ]);
    assertEquals(fixture.workspace.dock(externalId, "b", "right", { ratio: 0.24 }), true);
  };
  try {
    fixture.workspace.state.subscribe(actionListener);
    assertEquals(fixture.adapter.move("b", -1).status, "applied");
    fixture.workspace.state.unsubscribe(actionListener);
    assertEquals(fixture.workspace.gap.peek(), 2);

    fixture.workspace.gap.subscribe(gapListener);
    assertEquals(await fixture.history.undo(), true);
    fixture.workspace.gap.unsubscribe(gapListener);
    assertEquals(fixture.workspace.gap.peek(), 1);
    assertEquals(fixture.workspace.windowIds().includes(externalId), true);
    assertEquals(fixture.history.inspect().poisoned, undefined);

    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixture.workspace.gap.peek(), 2);
    assertEquals(fixture.workspace.windowIds().includes(externalId), true);
    assertEquals(fixture.history.inspect().poisoned, undefined);
  } finally {
    fixture.workspace.state.unsubscribe(actionListener);
    fixture.workspace.gap.unsubscribe(gapListener);
    disposeFixture(fixture);
  }
});

Deno.test("replay lease blocks a second adapter reentrantly during signal publication", async () => {
  const fixture = createFixture();
  const secondHistory = new HistoryStack();
  const second = new MarkupWindowHistoryAdapter({ controller: fixture.controller, history: secondHistory });
  const statuses: string[] = [];
  try {
    assertEquals(fixture.adapter.move("b", 1).status, "applied");
    const subscription = () => {
      statuses.push(second.minimize("a").status);
    };
    fixture.workspace.state.subscribe(subscription);
    try {
      assertEquals(await fixture.history.undo(), true);
    } finally {
      fixture.workspace.state.unsubscribe(subscription);
    }
    assertEquals(statuses.length > 0, true);
    assertEquals(new Set(statuses), new Set(["blocked"]));
    assertEquals(secondHistory.undoDepth, 0);
  } finally {
    second.dispose();
    disposeFixture(fixture);
  }
});

Deno.test("replay rejects divergent shared workspace state without clobbering or poisoning", async () => {
  const fixture = createFixture();
  try {
    fixture.workspace.reconcile([...fixture.workspace.inspect().windows, { id: "external" }]);
    fixture.controller.reconcile(markupRoot(windowNode("a"), windowNode("b"), windowNode("c")));
    assertEquals(fixture.adapter.move("b", 1).status, "applied");
    assertEquals(fixture.workspace.move("external", -2), true);
    const diverged = fixtureState(fixture);

    const error = await assertRejects(() => fixture.history.undo(), HistoryOperationError);
    assertEquals(error.poisoned, false);
    assertEquals(fixture.history.isPoisoned(), false);
    assertEquals(fixtureState(fixture), diverged);
    assertEquals(fixture.history.undoDepth, 1);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("gesture cancellation excludes reentrant commit during rollback publication", () => {
  const fixture = createFixture();
  try {
    const splitId = firstSplitId(fixture.controller);
    const before = fixtureState(fixture);
    const gesture = fixture.adapter.beginGesture({ action: "resize-ratio", id: splitId });
    assertEquals(fixture.controller.resizeRatio(splitId, 0.1).status, "applied");
    const reentrantCommits: boolean[] = [];
    const listener = () => reentrantCommits.push(gesture.commit());
    fixture.workspace.state.subscribe(listener);
    try {
      assertEquals(gesture.cancel(), true);
    } finally {
      fixture.workspace.state.unsubscribe(listener);
    }
    assertEquals(reentrantCommits, [false]);
    assertEquals(gesture.inspect().state, "cancelled");
    assertEquals(fixture.history.undoDepth, 0);
    assertEquals(fixtureState(fixture), before);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("history docking stores the controller-normalized safe ratio", async () => {
  const fixture = createFixture();
  try {
    const before = fixtureState(fixture);
    assertEquals(fixture.adapter.dock("c", "a", "left", { ratio: 99 }).status, "applied");
    const after = fixtureState(fixture);
    assertEquals(
      after.controller.placements.find((entry) => entry.id === "c")?.snapTarget,
      { kind: "dock", targetId: "a", edge: "left", ratio: 0.95 },
    );
    assertEquals(await fixture.history.undo(), true);
    assertEquals(fixtureState(fixture), before);
    assertEquals(await fixture.history.redo(), true);
    assertEquals(fixtureState(fixture), after);
  } finally {
    disposeFixture(fixture);
  }
});

Deno.test("disposed window controllers reject snapshots while history preflights lifecycle", () => {
  const fixture = createFixture();
  try {
    fixture.controller.dispose();
    assertThrows(() => fixture.controller.snapshot(), Error, "disposed; cannot snapshot");
    assertEquals(fixture.adapter.focus("a"), {
      action: "focus",
      status: "disposed",
      ok: false,
      id: "a",
      targetId: undefined,
      reason: "window-controller-disposed",
    });
    const gesture = fixture.adapter.beginGesture({ action: "move-by", id: "a" });
    assertEquals(gesture.inspect().state, "unavailable");
    assertEquals(gesture.inspect().reason, "window-controller-disposed");
    assertEquals(fixture.history.undoDepth, 0);
  } finally {
    disposeFixture(fixture);
  }
});

function createFixture(
  adapterOptions: Omit<MarkupWindowHistoryAdapterOptions, "controller" | "history"> = {},
): Fixture {
  const workspace = new TiledWorkspaceController({ gap: 1 });
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("a"),
      windowNode("b"),
      windowNode("c"),
      modalNode("modal-one", 2),
      modalNode("modal-two", 16),
    ),
    workspace,
    overlays,
    compactMode: "never",
  });
  const history = new HistoryStack();
  const adapter = new MarkupWindowHistoryAdapter({
    ...adapterOptions,
    controller,
    history,
  });
  return { workspace, overlays, controller, history, adapter };
}

function disposeFixture(fixture: Fixture): void {
  fixture.adapter.dispose();
  fixture.controller.dispose();
  fixture.workspace.dispose();
  fixture.overlays.dispose();
}

function fixtureState(fixture: Fixture) {
  return structuredClone({
    controller: fixture.controller.snapshot(),
    overlays: fixture.overlays.inspect(),
  });
}

function snapshotKey(snapshot: MarkupWindowSnapshot): string {
  return JSON.stringify(snapshot);
}

function firstSplitId(controller: MarkupWindowController): string {
  return controller.project(bounds, { compactMode: "never" }).workspace.separators[0]!.splitId;
}

function findDirectWorkspaceSplit(
  node: TiledWorkspaceLayoutNode | undefined,
  firstWindowId: string,
  secondWindowId: string,
): TiledWorkspaceSplitNode | undefined {
  if (!node || node.kind === "pane") return undefined;
  if (
    node.first.kind === "pane" && node.second.kind === "pane" &&
    node.first.windowId === firstWindowId && node.second.windowId === secondWindowId
  ) return node;
  return findDirectWorkspaceSplit(node.first, firstWindowId, secondWindowId) ??
    findDirectWorkspaceSplit(node.second, firstWindowId, secondWindowId);
}

function assertRebasedExternalWorkspace(
  workspace: TiledWorkspaceController,
  externalId: string,
  anchorId: string,
  managedRoot: TiledWorkspaceLayoutNode | undefined,
): void {
  const root = workspace.snapshot().layout.root;
  const split = findDirectWorkspaceSplit(root, externalId, anchorId);
  assertEquals(split?.direction, "row");
  assertEquals(split?.ratio, 0.31);
  assertEquals(split?.first.kind, "pane");
  assertEquals(split?.first.kind === "pane" ? split.first.minWidth : undefined, 19);
  assertEquals(split?.first.kind === "pane" ? split.first.minHeight : undefined, 4);
  assertEquals(pruneWorkspaceWindow(root, externalId), managedRoot);
}

function pruneWorkspaceWindow(
  node: TiledWorkspaceLayoutNode | undefined,
  windowId: string,
): TiledWorkspaceLayoutNode | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return node.windowId === windowId ? undefined : structuredClone(node);
  const first = pruneWorkspaceWindow(node.first, windowId);
  const second = pruneWorkspaceWindow(node.second, windowId);
  if (!first || !second) return first ?? second;
  return { ...structuredClone(node), first, second };
}

function markupRoot(...children: LayoutNode[]): LayoutNode {
  return createLayoutNode({ id: "root", tag: "main", children });
}

function windowNode(id: string): LayoutNode {
  return createLayoutNode({ id, tag: "window" });
}

function modalNode(id: string, column: number): LayoutNode {
  return createLayoutNode({
    id,
    tag: "modal",
    attributes: {
      column: String(column),
      row: "2",
      width: "12",
      height: "5",
    },
  });
}
