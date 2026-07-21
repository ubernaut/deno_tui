import { assertEquals, assertNotStrictEquals, assertThrows } from "./deps.ts";
import { OverlayStackController } from "../src/layout/overlay.ts";
import { createLayoutNode, type LayoutNode } from "../src/layout/solver.ts";
import { cellLength, defaultComputedLayoutStyle } from "../src/layout/style.ts";
import { TiledWorkspaceController, type TiledWorkspaceLayoutNode } from "../src/layout/tiled_workspace.ts";
import { batchSignalUpdates } from "../src/signals/mod.ts";
import {
  MARKUP_WINDOW_SNAPSHOT_V1_VERSION,
  MARKUP_WINDOW_SNAPSHOT_VERSION,
  MarkupWindowController,
  type MarkupWindowLayoutLookup,
} from "../src/markup/windows.ts";
import type { Rectangle } from "../src/types.ts";

const wideBounds: Rectangle = { column: 0, row: 0, width: 120, height: 30 };

Deno.test("markup windows reconcile declarations into shared workspace and overlay controllers", () => {
  const workspace = new TiledWorkspaceController({ windows: [{ id: "imperative", minWidth: 8 }] });
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("editor", { title: "Editor" }, [modalNode("confirm", { "close-on-outside-click": "true" })], 30, 8),
      windowNode("logs", { title: "Logs" }, [], 20, 5),
    ),
    workspace,
    overlays,
    layout: modalLayout({ confirm: { column: 11, row: 4, width: 30, height: 8 } }),
    compactMode: "never",
  });

  assertEquals(workspace.windowIds(), ["imperative", "editor", "logs"]);
  assertEquals(controller.workspace, workspace);
  assertEquals(controller.overlays, overlays);
  assertEquals(controller.inspect().windows, [
    {
      id: "editor",
      title: "Editor",
      minWidth: 30,
      minHeight: 8,
      declaredVisible: true,
      state: "normal",
      placement: "tiled",
      alwaysOnTop: false,
      focusOrder: 0,
      active: false,
      visible: true,
    },
    {
      id: "logs",
      title: "Logs",
      minWidth: 20,
      minHeight: 5,
      declaredVisible: true,
      state: "normal",
      placement: "tiled",
      alwaysOnTop: false,
      focusOrder: 1,
      active: false,
      visible: true,
    },
  ]);
  assertEquals(overlays.surface("confirm"), {
    id: "confirm",
    rect: { column: 11, row: 4, width: 30, height: 8 },
    layer: "modal",
    kind: "modal",
    zIndex: 4_000,
    order: 0,
    visible: true,
    modal: true,
    closeOnOutsideClick: true,
    ownerId: "editor",
  });

  const inspection = controller.inspect();
  assertNotStrictEquals(inspection.workspace, workspace.inspect());
  inspection.windows[0]!.title = "mutated";
  inspection.modals[0]!.rect!.width = 999;
  inspection.modals[0]!.surface!.rect.column = 999;
  assertEquals(controller.inspect().windows[0]!.title, "Editor");
  assertEquals(controller.inspect().modals[0]!.rect, { column: 11, row: 4, width: 30, height: 8 });
  assertEquals(overlays.surface("confirm")?.rect.column, 11);

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("markup window actions delegate focus move swap dock and resize to one tiled tree", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a"), windowNode("b"), windowNode("c")),
    workspace,
    overlays,
    compactMode: "never",
  });

  assertEquals(controller.focus("b"), { action: "focus", status: "applied", ok: true, id: "b" });
  assertEquals(workspace.inspect().activeWindowId, "b");
  assertEquals(controller.move("b", 1), { action: "move", status: "applied", ok: true, id: "b" });
  assertEquals(workspace.windowIds(), ["a", "c", "b"]);
  assertEquals(controller.swap("a", "c"), {
    action: "swap",
    status: "applied",
    ok: true,
    id: "a",
    targetId: "c",
  });
  assertEquals(workspace.windowIds(), ["c", "a", "b"]);
  assertEquals(controller.dock("b", "c", "left", { ratio: 0.25 }).status, "applied");
  assertEquals(workspace.inspect().activeWindowId, "b");

  const splitId = controller.project(wideBounds, { compactMode: "never" }).workspace.separators[0]!.splitId;
  const beforeRatio = splitRatio(workspace, splitId);
  assertEquals(controller.resizeRatio(splitId, 0.05).status, "applied");
  assertEquals(splitRatio(workspace, splitId) === beforeRatio, false);
  assertEquals(controller.resize(splitId, 3, wideBounds, { compactMode: "never" }).status, "applied");
  assertEquals(controller.move("a", 0), {
    action: "move",
    status: "invalid",
    ok: false,
    id: "a",
    reason: "delta-must-be-a-non-zero-finite-number",
  });
  assertEquals(controller.focus("missing").status, "not-found");

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("minimize maximize hidden and compact projections preserve durable tiled geometry", () => {
  const workspace = new TiledWorkspaceController({ gap: 1 });
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a", {}, [], 20), windowNode("b", {}, [], 20), windowNode("c", {}, [], 20)),
    workspace,
    overlays,
  });
  controller.focus("b");
  const durableRoot = structuredClone(workspace.snapshot().layout.root);

  assertEquals(controller.minimize("b").status, "applied");
  assertEquals(workspace.snapshot().layout.root, durableRoot);
  const minimized = controller.project(wideBounds, { compactMode: "never" });
  assertEquals(minimized.workspace.panes.map((pane) => pane.windowId), ["a", "c"]);
  assertEquals(minimized.hiddenWindowIds, ["b"]);
  assertEquals(controller.inspect().activeWindowId, "a");

  assertEquals(controller.restore("b").status, "applied");
  assertEquals(controller.maximize("b").status, "applied");
  const maximized = controller.project(wideBounds);
  assertEquals(maximized.visibleWindowIds, ["b"]);
  assertEquals(maximized.workspace.panes.map((pane) => [pane.windowId, pane.rect]), [["b", wideBounds]]);
  assertEquals(workspace.snapshot().layout.root, durableRoot);
  assertEquals(controller.restore("b").status, "applied");
  assertEquals(workspace.snapshot().layout.root, durableRoot);

  controller.focus("c");
  const compact = controller.project({ column: 2, row: 3, width: 10, height: 4 });
  assertEquals(compact.compact, true);
  assertEquals(compact.compactWindowId, "c");
  assertEquals(compact.workspace.panes.map((pane) => pane.windowId), ["c"]);
  assertEquals(compact.workspace.separators, []);

  controller.reconcile(
    markupRoot(
      windowNode("a", {}, [], 20),
      windowNode("b", {}, [], 20),
      hiddenWindowNode("c", 20),
    ),
  );
  assertEquals(workspace.windowIds(), ["a", "b", "c"]);
  assertEquals(controller.inspect().activeWindowId, "a");
  assertEquals(controller.project(wideBounds, { compactMode: "never" }).workspace.panes.map((pane) => pane.windowId), [
    "a",
    "b",
  ]);
  assertEquals(controller.focus("c"), {
    action: "focus",
    status: "blocked",
    ok: false,
    id: "c",
    reason: "window-not-visible",
  });

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("markup window snapshots restore visibility modal state and shared geometry clone-safely", () => {
  const workspace = new TiledWorkspaceController({ gap: 2 });
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a"), windowNode("b"), windowNode("c"), modalNode("help")),
    workspace,
    overlays,
    layout: modalLayout({ help: { column: 4, row: 2, width: 24, height: 7 } }),
    compactMode: "always",
  });

  controller.minimize("a");
  controller.maximize("b");
  controller.close("c");
  controller.close("help");
  const snapshot = controller.snapshot();
  const persisted = structuredClone(snapshot);
  assertEquals(snapshot.version, MARKUP_WINDOW_SNAPSHOT_VERSION);
  assertEquals(snapshot.minimizedWindowIds, ["a"]);
  assertEquals(snapshot.closedWindowIds, ["c"]);
  assertEquals(snapshot.maximizedWindowId, "b");
  assertEquals(snapshot.modals, [{ id: "help", open: false }]);

  snapshot.minimizedWindowIds.push("b");
  snapshot.closedWindowIds.length = 0;
  snapshot.modals[0]!.open = true;
  if (snapshot.workspace.layout.root?.kind === "split") snapshot.workspace.layout.root.ratio = 0.05;
  assertEquals(controller.snapshot(), persisted);

  controller.restore("a");
  controller.restore("b");
  controller.restore("c");
  controller.restore("help");
  assertEquals(controller.restoreSnapshot(persisted), {
    action: "restore-snapshot",
    status: "applied",
    ok: true,
  });
  assertEquals(controller.inspect().windows.map((window) => [window.id, window.state]), [
    ["a", "minimized"],
    ["b", "maximized"],
    ["c", "closed"],
  ]);
  assertEquals(workspace.windowIds(), ["a", "b", "c"]);
  assertEquals(overlays.surface("help")?.visible, false);
  assertEquals(controller.project(wideBounds).visibleWindowIds, ["b"]);

  const restored = controller.snapshot();
  persisted.minimizedWindowIds.length = 0;
  persisted.modals[0]!.open = true;
  assertEquals(controller.snapshot(), restored);
  const unsupported = { ...restored, version: 99 as typeof MARKUP_WINDOW_SNAPSHOT_VERSION };
  assertEquals(controller.restoreSnapshot(unsupported), {
    action: "restore-snapshot",
    status: "unsupported",
    ok: false,
    reason: "unsupported-snapshot-version:99",
  });
  assertEquals(controller.snapshot(), restored);

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("modal integration follows overlay close state owner visibility and fail-closed geometry", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController({
    surfaces: [{
      id: "external-conflict",
      rect: { column: 50, row: 0, width: 10, height: 3 },
      kind: "toast",
      layer: "system",
    }],
  });
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("owner", {}, [modalNode("owned", { "close-on-outside-click": "true" })], 20),
      windowNode("other", {}, [], 20),
      modalNode("missing"),
      modalNode("external-conflict"),
    ),
    workspace,
    overlays,
    layout: modalLayout({ owned: { column: 10, row: 5, width: 20, height: 6 } }),
  });

  assertEquals(controller.inspect().diagnostics.map((entry) => [entry.code, entry.id]), [
    ["missing-modal-geometry", "missing"],
    ["overlay-id-conflict", "external-conflict"],
  ]);
  assertEquals(overlays.surface("missing")?.visible, false);
  assertEquals(controller.restore("missing"), {
    action: "restore",
    status: "unsupported",
    ok: false,
    id: "missing",
    reason: "modal-layout-geometry-unavailable",
  });
  assertEquals(overlays.surface("external-conflict")?.kind, "toast");

  workspace.focus("other");
  const compact = controller.project({ column: 0, row: 0, width: 10, height: 4 });
  assertEquals(compact.compactWindowId, "other");
  assertEquals(compact.modals.map((modal) => modal.id), ["owned"]);
  assertEquals(compact.topModalId, "owned");
  workspace.focus("owner");

  const pointer = overlays.handlePointerDown({ column: 0, row: 0 });
  assertEquals(pointer.closedIds, ["owned"]);
  assertEquals(controller.inspect().modals.find((modal) => modal.id === "owned")?.requestedOpen, false);
  assertEquals(controller.restore("owned").status, "applied");
  assertEquals(overlays.surface("owned")?.visible, true);
  assertEquals(controller.minimize("owner").status, "applied");
  assertEquals(overlays.surface("owned")?.visible, false);
  assertEquals(controller.inspect().modals.find((modal) => modal.id === "owned")?.requestedOpen, true);
  assertEquals(controller.restore("owner").status, "applied");
  assertEquals(overlays.surface("owned")?.visible, true);

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("managed modal registration provenance preserves external replacements and ABA takeovers", () => {
  for (const takeover of ["replace", "aba"] as const) {
    const workspace = new TiledWorkspaceController();
    const overlays = new OverlayStackController();
    const controller = new MarkupWindowController({
      root: markupRoot(modalNode("dialog")),
      workspace,
      overlays,
      layout: modalLayout({ dialog: { column: 3, row: 2, width: 12, height: 5 } }),
    });
    const original = overlays.surface("dialog")!;
    const originalGeneration = overlays.registrationGeneration("dialog");
    if (takeover === "replace") {
      overlays.register({
        ...original,
        kind: "toast",
        layer: "system",
        modal: false,
      });
    } else {
      overlays.remove("dialog");
      overlays.register({ ...original, visible: true });
    }

    assertEquals(overlays.registrationGeneration("dialog") === originalGeneration, false);
    assertEquals(controller.close("dialog").reason, "modal-overlay-id-conflict");
    assertEquals(controller.inspect().modals[0]!.registered, false);
    assertEquals(controller.inspect().diagnostics.some((entry) => entry.code === "overlay-id-conflict"), true);
    const replacement = overlays.surface("dialog");
    controller.dispose();
    assertEquals(overlays.surface("dialog"), replacement);

    overlays.remove("dialog");
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("declarative state changes are reconciled without overriding controller actions on unchanged markup", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const minimizedRoot = markupRoot(windowNode("panel", { state: "minimized" }));
  const controller = new MarkupWindowController({ root: minimizedRoot, workspace, overlays });

  assertEquals(controller.inspect().windows[0]!.state, "minimized");
  assertEquals(controller.restore("panel").status, "applied");
  controller.reconcile(minimizedRoot);
  assertEquals(controller.inspect().windows[0]!.state, "normal");
  controller.reconcile(markupRoot(windowNode("panel", { state: "closed" })));
  assertEquals(controller.inspect().windows[0]!.state, "closed");
  assertEquals(workspace.windowIds(), ["panel"]);

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("duplicate declarations diagnose deterministically and disposal preserves injected owners", () => {
  const workspace = new TiledWorkspaceController({ windows: [{ id: "external" }] });
  const overlays = new OverlayStackController({
    surfaces: [{ id: "external-overlay", rect: { column: 0, row: 0, width: 2, height: 2 } }],
  });
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("same", { state: "maximized" }),
      modalNode("same"),
      windowNode("second", { state: "maximized" }),
      modalNode("managed"),
    ),
    workspace,
    overlays,
    layout: modalLayout({ managed: { column: 3, row: 2, width: 10, height: 4 } }),
  });

  assertEquals(controller.inspect().diagnostics.map((entry) => entry.code), [
    "duplicate-surface-id",
    "multiple-maximized-windows",
  ]);
  assertEquals(controller.inspect().maximizedWindowId, "same");
  assertEquals(overlays.surface("managed")?.visible, true);
  controller.dispose();
  controller.dispose();
  assertEquals(controller.inspect().disposed, true);
  assertEquals(overlays.surface("managed"), undefined);
  assertEquals(overlays.surface("external-overlay")?.id, "external-overlay");
  assertEquals(workspace.focus("external"), true);
  assertEquals(controller.focus("same"), {
    action: "focus",
    status: "disposed",
    ok: false,
    id: "same",
    reason: "controller-disposed",
  });
  assertThrows(() => controller.project(wideBounds), Error, "disposed");

  workspace.dispose();
  overlays.dispose();
});

Deno.test("floating geometry clamps declared minima and maxima while viewport recovery stays projection-only", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode(
        "float",
        { placement: "floating", column: "70", row: "20", width: "30", height: "10" },
        [],
        10,
        5,
        20,
        8,
      ),
    ),
    workspace,
    overlays,
  });

  assertEquals(controller.inspect().windows[0], {
    id: "float",
    title: undefined,
    minWidth: 10,
    minHeight: 5,
    maxWidth: 20,
    maxHeight: 8,
    declaredVisible: true,
    state: "normal",
    placement: "floating",
    floatingRect: { column: 70, row: 20, width: 20, height: 8 },
    restoreRect: { column: 70, row: 20, width: 20, height: 8 },
    alwaysOnTop: false,
    focusOrder: 0,
    active: true,
    visible: true,
  });
  assertEquals(
    controller.setFloatingRect("float", { column: 5, row: 5, width: 2, height: 100 }).status,
    "applied",
  );
  assertEquals(controller.inspect().windows[0]!.floatingRect, { column: 5, row: 5, width: 10, height: 8 });
  const beforeInvalid = controller.snapshot();
  assertEquals(
    controller.setFloatingRect("float", { column: Number.NaN, row: 0, width: 12, height: 6 }).status,
    "invalid",
  );
  assertEquals(controller.snapshot(), beforeInvalid);

  assertEquals(controller.moveBy("float", { columns: 500, rows: 20 }).status, "applied");
  const projection = controller.project({ column: 0, row: 0, width: 40, height: 10 });
  assertEquals(projection.visibleWindowIds, []);
  assertEquals(projection.workspace.panes, []);
  assertEquals(workspace.windowIds(), ["float"]);
  assertEquals(projection.floatingWindows[0]!.floatingRect, { column: 505, row: 25, width: 10, height: 8 });
  assertEquals(projection.floatingWindows[0]!.rect, { column: 35, row: 9, width: 10, height: 8 });
  assertEquals(projection.floatingWindows[0]!.constraintsSatisfied, true);
  assertEquals(controller.recoverBounds("float", { column: 0, row: 0, width: 40, height: 10 }).status, "applied");
  assertEquals(controller.inspect().windows[0]!.floatingRect, { column: 35, row: 9, width: 10, height: 8 });
  assertEquals(controller.resizeWindow("float", "right", { columns: 100, rows: 0 }).status, "applied");
  assertEquals(controller.inspect().windows[0]!.floatingRect?.width, 20);
  assertEquals(controller.resizeWindow("float", "bottom", { columns: 0, rows: -100 }).status, "applied");
  assertEquals(controller.inspect().windows[0]!.floatingRect?.height, 5);

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("floating groups move atomically and reject any member overflow without mutation", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("a", { placement: "floating", column: "0", row: "0", width: "10", height: "4" }),
      windowNode("b", { placement: "floating", column: "10", row: "2", width: "10", height: "4" }),
      windowNode("c", { placement: "floating", column: "20", row: "4", width: "10", height: "4" }),
    ),
    workspace,
    overlays,
  });

  assertEquals(controller.setGroup("a", "pair").status, "applied");
  assertEquals(controller.setGroup("b", "pair").status, "applied");
  assertEquals(controller.moveBy("a", { columns: 3, rows: 2 }).status, "applied");
  assertEquals(controller.inspect().windows.map((entry) => entry.floatingRect), [
    { column: 3, row: 2, width: 10, height: 4 },
    { column: 13, row: 4, width: 10, height: 4 },
    { column: 20, row: 4, width: 10, height: 4 },
  ]);

  assertEquals(
    controller.setFloatingRect("b", { column: 1_000_000, row: 4, width: 10, height: 4 }).status,
    "applied",
  );
  const beforeOverflow = controller.snapshot();
  assertEquals(controller.moveBy("a", { columns: 1, rows: 0 }).status, "invalid");
  assertEquals(controller.snapshot(), beforeOverflow);
  assertEquals(controller.setGroup("a", "x".repeat(129)).status, "invalid");

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("floating focus order is stable within normal and always-on-top tiers", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("a", { placement: "floating" }),
      windowNode("b", { placement: "floating" }),
      windowNode("c", { placement: "floating" }),
    ),
    workspace,
    overlays,
  });

  assertEquals(controller.focus("a").status, "applied");
  assertEquals(controller.focus("a").status, "unchanged");
  assertEquals(controller.setAlwaysOnTop("b", true).status, "applied");
  assertEquals(controller.focus("c").status, "applied");
  let projection = controller.project(wideBounds);
  assertEquals(projection.floatingZOrder.map((entry) => entry.id), ["a", "c", "b"]);
  assertEquals(projection.floatingZOrder.at(-1)?.alwaysOnTop, true);
  assertEquals(controller.setAlwaysOnTop("b", false).status, "applied");
  projection = controller.project(wideBounds);
  assertEquals(projection.floatingZOrder.at(-1)?.id, "b");
  assertEquals(new Set(controller.inspect().windows.map((entry) => entry.focusOrder)).size, 3);

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("workspace and corner snap honor maxima, preserve restore geometry, and can commit to docking", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode(
        "source",
        { placement: "floating", column: "4", row: "3", width: "10", height: "5" },
        [],
        8,
        4,
        12,
        6,
      ),
      windowNode("target"),
    ),
    workspace,
    overlays,
  });
  const bounds = { column: 0, row: 0, width: 100, height: 40 };

  assertEquals(controller.snap("source", { kind: "workspace", edge: "right" }, bounds).status, "applied");
  assertEquals(controller.inspect().windows[0]!.floatingRect, { column: 88, row: 0, width: 12, height: 6 });
  assertEquals(controller.inspect().windows[0]!.restoreRect, { column: 4, row: 3, width: 10, height: 5 });
  assertEquals(controller.snap("source", { kind: "corner", corner: "bottom-right" }, bounds).status, "applied");
  assertEquals(controller.inspect().windows[0]!.floatingRect, { column: 88, row: 34, width: 12, height: 6 });
  assertEquals(controller.project(bounds).floatingWindows[0]!.rect, { column: 88, row: 34, width: 12, height: 6 });

  assertEquals(
    controller.snap("source", { kind: "dock", targetId: "target", edge: "left", ratio: 0.3 }, bounds).status,
    "applied",
  );
  assertEquals(controller.inspect().windows[0]!.placement, "tiled");
  assertEquals(controller.project(bounds).workspace.panes.map((entry) => entry.windowId).sort(), ["source", "target"]);

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("floating lifecycle preserves durable geometry across maximize minimize close and restore", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("float", { placement: "floating", column: "7", row: "4", width: "18", height: "7" }),
      windowNode("tile"),
    ),
    workspace,
    overlays,
  });
  const durable = controller.inspect().windows[0]!.floatingRect;

  assertEquals(controller.maximize("float").status, "applied");
  assertEquals(controller.project(wideBounds).floatingWindows[0]!.rect, wideBounds);
  assertEquals(controller.restore("float").status, "applied");
  assertEquals(controller.minimize("float").status, "applied");
  assertEquals(controller.restore("float").status, "applied");
  assertEquals(controller.close("float").status, "applied");
  assertEquals(workspace.windowIds().includes("float"), true);
  assertEquals(controller.restore("float").status, "applied");
  assertEquals(controller.inspect().windows[0]!.floatingRect, durable);

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("V2 snapshots migrate strict V1 state and reject hostile input without partial mutation", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("a", { placement: "floating", column: "3", row: "2", width: "14", height: "6" }),
      windowNode("b"),
    ),
    workspace,
    overlays,
  });
  const v2 = controller.snapshot();
  const v1 = {
    version: MARKUP_WINDOW_SNAPSHOT_V1_VERSION,
    compactMode: v2.compactMode,
    windowIds: v2.windowIds,
    minimizedWindowIds: v2.minimizedWindowIds,
    closedWindowIds: v2.closedWindowIds,
    maximizedWindowId: v2.maximizedWindowId,
    modals: v2.modals,
    workspace: v2.workspace,
  };

  assertEquals(controller.restoreSnapshot(v1).status, "applied");
  assertEquals(controller.snapshot().version, MARKUP_WINDOW_SNAPSHOT_VERSION);
  assertEquals(controller.inspect().windows.map((entry) => entry.placement), ["tiled", "tiled"]);
  assertEquals(controller.restoreSnapshot(v2).status, "applied");
  assertEquals(controller.inspect().windows[0]!.placement, "floating");

  const stable = controller.snapshot();
  const overlap = structuredClone(stable);
  overlap.minimizedWindowIds = ["a"];
  overlap.closedWindowIds = ["a"];
  assertEquals(controller.restoreSnapshot(overlap).status, "invalid");
  assertEquals(controller.snapshot(), stable);

  const malformedWorkspace = structuredClone(stable) as unknown as Record<string, unknown>;
  (malformedWorkspace.workspace as Record<string, unknown>).layout = null;
  assertEquals(controller.restoreSnapshot(malformedWorkspace).status, "invalid");
  assertEquals(controller.snapshot(), stable);

  const sparse = structuredClone(stable);
  sparse.windowIds = new Array<string>(1);
  assertEquals(controller.restoreSnapshot(sparse).status, "invalid");
  assertEquals(controller.snapshot(), stable);

  const foreignWorkspace = new TiledWorkspaceController();
  const foreignOverlays = new OverlayStackController();
  const foreignController = new MarkupWindowController({
    root: markupRoot(
      windowNode("ghost", { placement: "floating", column: "3", row: "2", width: "14", height: "6" }),
      windowNode("b"),
    ),
    workspace: foreignWorkspace,
    overlays: foreignOverlays,
  });
  const foreign = foreignController.snapshot();
  assertEquals(controller.restoreSnapshot(foreign).reason, "snapshot-window-ids-do-not-match-declarations");
  assertEquals(controller.snapshot(), stable);
  foreignController.dispose();
  foreignWorkspace.dispose();
  foreignOverlays.dispose();

  const accessor: Record<string, unknown> = {};
  Object.defineProperty(accessor, "version", { enumerable: true, get: () => MARKUP_WINDOW_SNAPSHOT_VERSION });
  assertEquals(controller.restoreSnapshot(accessor).status, "invalid");
  assertEquals(controller.snapshot(), stable);

  controller.dispose();
  workspace.dispose();
  overlays.dispose();
});

Deno.test("declarative identity bounds keep every emitted snapshot self-restorable", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const children = Array.from({ length: 1_025 }, (_, index) => windowNode(`window-${index}`));
  children.unshift(windowNode(`bad\ncontrol`), windowNode("x".repeat(257)));
  const controller = new MarkupWindowController({ root: markupRoot(...children), workspace, overlays });
  try {
    assertEquals(controller.inspect().windows.length, 1_024);
    assertEquals(controller.inspect().diagnostics.map((entry) => entry.code), [
      "invalid-surface-id",
      "invalid-surface-id",
      "surface-limit-exceeded",
    ]);
    const snapshot = controller.snapshot();
    assertEquals(controller.restoreSnapshot(snapshot).status, "applied");
    assertEquals(controller.snapshot(), snapshot);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("maximized focus remains coherent across latent window operations and strict restore", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a"), windowNode("b"), windowNode("c")),
    workspace,
    overlays,
  });
  try {
    assertEquals(controller.maximize("a").status, "applied");
    assertEquals(controller.focus("b").reason, "window-hidden-by-maximized-window");
    assertEquals(controller.move("b", 1).status, "applied");
    assertEquals(controller.setPlacement("c", "floating").status, "applied");
    assertEquals(controller.inspect().activeWindowId, "a");
    assertEquals(workspace.inspect().activeWindowId, "a");

    const contradictory = controller.snapshot();
    contradictory.activeWindowId = "b";
    assertEquals(controller.restoreSnapshot(contradictory).status, "invalid");
    assertEquals(controller.inspect().activeWindowId, "a");
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("snapshot restore rejects constraint and placement-snap contradictions atomically", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("float", { placement: "floating", width: "18", height: "7" }, [], 10, 5, 20, 8),
      windowNode("tile"),
    ),
    workspace,
    overlays,
  });
  try {
    const stable = controller.snapshot();
    const oversized = structuredClone(stable);
    oversized.placements.find((entry) => entry.id === "float")!.floatingRect!.width = 999;
    assertEquals(controller.restoreSnapshot(oversized).reason, "snapshot-floating-rect-violates-constraints:float");
    assertEquals(controller.snapshot(), stable);

    const tiledWorkspaceSnap = structuredClone(stable);
    const tile = tiledWorkspaceSnap.placements.find((entry) => entry.id === "tile")!;
    tile.snapTarget = { kind: "workspace", edge: "left" };
    assertEquals(controller.restoreSnapshot(tiledWorkspaceSnap).status, "invalid");

    const floatingDock = structuredClone(stable);
    floatingDock.placements.find((entry) => entry.id === "float")!.snapTarget = {
      kind: "dock",
      targetId: "ghost",
      edge: "left",
    };
    assertEquals(controller.restoreSnapshot(floatingDock).status, "invalid");
    assertEquals(controller.snapshot(), stable);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("reconcile clears dock metadata whose target declaration disappeared", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("source"), windowNode("target")),
    workspace,
    overlays,
  });
  try {
    assertEquals(controller.dock("source", "target", "left").status, "applied");
    controller.reconcile(markupRoot(windowNode("source")));
    assertEquals(controller.inspect().windows[0]!.snapTarget, undefined);
    const snapshot = controller.snapshot();
    assertEquals(controller.restoreSnapshot(snapshot).status, "applied");
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("restoreSnapshot rolls every injected and local state back after throwing subscribers", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a"), windowNode("b"), modalNode("modal")),
    workspace,
    overlays,
    layout: modalLayout({ modal: { column: 4, row: 2, width: 14, height: 5 } }),
  });
  const workspaceListener = () => {
    // A legacy rollback through Signal.value would invoke this a second time.
  };
  const overlayListener = () => {
    throw new Error("injected-overlay-listener-failure");
  };
  try {
    const before = controller.snapshot();
    const overlaysBefore = overlays.snapshot();
    controller.move("b", -1);
    controller.close("modal");
    const target = controller.snapshot();
    assertEquals(controller.restoreSnapshot(before).status, "applied");

    workspace.state.subscribe(workspaceListener);
    overlays.surfaces.subscribe(overlayListener);
    const result = controller.restoreSnapshot(target);
    assertEquals(result.reason, "snapshot-restore-and-rollback-failed");
    assertEquals(controller.snapshot(), before);
    assertEquals(overlays.snapshot(), overlaysBefore);
  } finally {
    workspace.state.unsubscribe(workspaceListener);
    overlays.surfaces.unsubscribe(overlayListener);
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("constraint reconciliation clamps surviving durable and restore rectangles", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a", {}, [], 4, 3, 100, 40)),
    workspace,
    overlays,
  });
  try {
    controller.setPlacement("a", "floating", { rect: { column: 3, row: 2, width: 50, height: 20 } });
    controller.reconcile(markupRoot(windowNode("a", {}, [], 4, 3, 20, 8)));
    assertEquals(controller.inspect().windows[0]!.floatingRect, { column: 3, row: 2, width: 20, height: 8 });
    assertEquals(controller.inspect().windows[0]!.restoreRect, { column: 3, row: 2, width: 20, height: 8 });
    const snapshot = controller.snapshot();
    assertEquals(controller.restoreSnapshot(snapshot).status, "applied");
    assertEquals(controller.snapshot(), snapshot);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("snap partitions odd workspaces without overlap and recovery exposes the move affordance", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(
      windowNode("left", { placement: "floating" }),
      windowNode("right", { placement: "floating" }),
      windowNode("wide", { placement: "floating", width: "100", height: "5" }),
    ),
    workspace,
    overlays,
  });
  try {
    const odd = { column: 0, row: 0, width: 5, height: 5 };
    controller.snap("left", { kind: "workspace", edge: "left" }, odd);
    controller.snap("right", { kind: "workspace", edge: "right" }, odd);
    assertEquals(controller.project(odd).floatingWindows.slice(0, 2).map((window) => window.rect), [
      { column: 0, row: 0, width: 3, height: 5 },
      { column: 3, row: 0, width: 2, height: 5 },
    ]);

    controller.moveBy("wide", { columns: 500, rows: 0 });
    const recovered = controller.project({ column: 0, row: 0, width: 10, height: 6 }).floatingWindows[2]!.rect;
    assertEquals(recovered.column + Math.floor((recovered.width - 1) / 2), 9);
    assertEquals(controller.recoverBounds("wide", { column: 0, row: 0, width: 10, height: 6 }).status, "applied");
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("snapshots canonicalize tiled active focus against direct shared-workspace focus", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a"), windowNode("b")),
    workspace,
    overlays,
  });
  try {
    controller.focus("a");
    workspace.focus("b");
    const snapshot = controller.snapshot();
    assertEquals(controller.restoreSnapshot(snapshot).status, "applied");
    assertEquals(controller.snapshot(), snapshot);
    assertEquals(workspace.inspect().activeWindowId, "a");
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("external workspace id collisions are diagnosed and never commandeered", () => {
  const workspace = new TiledWorkspaceController({
    windows: [{ id: "shared", minWidth: 9, minHeight: 7 }, { id: "external", minWidth: 3 }],
  });
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("shared"), windowNode("managed")),
    workspace,
    overlays,
  });
  try {
    assertEquals(controller.inspect().windows.map((window) => window.id), ["managed"]);
    assertEquals(controller.inspect().diagnostics.map((entry) => [entry.code, entry.id]), [
      ["workspace-id-conflict", "shared"],
    ]);
    assertEquals(workspace.inspect().windows.find((window) => window.id === "shared"), {
      id: "shared",
      minWidth: 9,
      minHeight: 7,
    });

    controller.reconcile(markupRoot());
    assertEquals(workspace.windowIds(), ["shared", "external"]);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("managed workspace registration provenance preserves same-id ABA replacements", () => {
  const workspace = new TiledWorkspaceController({ windows: [{ id: "external" }] });
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("managed")),
    workspace,
    overlays,
  });
  const originalGeneration = workspace.windowRegistrationGeneration("managed");
  try {
    workspace.reconcile([{ id: "external" }]);
    workspace.reconcile([
      { id: "external" },
      { id: "managed", minWidth: 77, minHeight: 66 },
    ]);
    assertEquals(workspace.windowRegistrationGeneration("managed") === originalGeneration, false);
    assertEquals(controller.close("managed").status, "not-found");
    assertEquals(controller.inspect().diagnostics.some((entry) => entry.code === "workspace-id-conflict"), true);
    controller.dispose();
    assertEquals(workspace.windowIds(), ["external", "managed"]);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("direct shared-signal ABA replacements rotate provenance and survive disposal", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("managed"), modalNode("dialog")),
    workspace,
    overlays,
    layout: modalLayout({ dialog: { column: 3, row: 2, width: 12, height: 5 } }),
  });
  const originalWindowGeneration = workspace.windowRegistrationGeneration("managed");
  const originalModalGeneration = overlays.registrationGeneration("dialog");
  const originalModal = structuredClone(overlays.surface("dialog")!);
  try {
    workspace.state.value = {};
    workspace.state.value = {
      root: {
        kind: "pane",
        id: "external-pane",
        windowId: "managed",
        minWidth: 77,
        minHeight: 66,
      },
      activePaneId: "external-pane",
    };
    const assignedWindowGeneration = workspace.windowRegistrationGeneration("managed");
    workspace.state.value.root = undefined;
    workspace.state.value.root = {
      kind: "pane",
      id: "external-pane-deep",
      windowId: "managed",
      minWidth: 88,
      minHeight: 55,
    };
    workspace.state.value.activePaneId = "external-pane-deep";
    overlays.surfaces.value = [];
    overlays.surfaces.value = [{ ...originalModal, rect: { ...originalModal.rect } }];
    const assignedModalGeneration = overlays.registrationGeneration("dialog");
    overlays.surfaces.value.splice(0, 1);
    overlays.surfaces.value.push({ ...originalModal, rect: { ...originalModal.rect } });
    const deepWindowGeneration = workspace.windowRegistrationGeneration("managed");
    const deepModalGeneration = overlays.registrationGeneration("dialog");
    const pane = workspace.state.value.root;
    const surface = overlays.surface("dialog");
    if (!pane || pane.kind !== "pane" || !surface) throw new Error("Expected external window registrations.");
    batchSignalUpdates(() => {
      pane.windowId = "temporary-managed";
      pane.windowId = "managed";
      surface.id = "temporary-dialog";
      surface.id = "dialog";
    });

    assertEquals(workspace.windowRegistrationGeneration("managed") === originalWindowGeneration, false);
    assertEquals(workspace.windowRegistrationGeneration("managed") === assignedWindowGeneration, false);
    assertEquals(workspace.windowRegistrationGeneration("managed") === deepWindowGeneration, false);
    assertEquals(overlays.registrationGeneration("dialog") === originalModalGeneration, false);
    assertEquals(overlays.registrationGeneration("dialog") === assignedModalGeneration, false);
    assertEquals(overlays.registrationGeneration("dialog") === deepModalGeneration, false);
    assertEquals(controller.inspect().windows, []);
    assertEquals(controller.inspect().modals[0]!.registered, false);
    assertEquals(controller.inspect().diagnostics.some((entry) => entry.code === "workspace-id-conflict"), true);
    assertEquals(controller.inspect().diagnostics.some((entry) => entry.code === "overlay-id-conflict"), true);

    controller.dispose();
    assertEquals(workspace.inspect().windows, [{ id: "managed", minWidth: 88, minHeight: 55 }]);
    assertEquals(overlays.surface("dialog"), originalModal);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("dispose cleans only owned workspace panes and modals despite throwing listeners", () => {
  const workspace = new TiledWorkspaceController({ windows: [{ id: "external" }] });
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("managed"), modalNode("managed-modal")),
    workspace,
    overlays,
    layout: modalLayout({ "managed-modal": { column: 2, row: 1, width: 10, height: 4 } }),
  });
  const workspaceListener = () => {
    throw new Error("workspace-dispose-listener");
  };
  const overlayListener = () => {
    throw new Error("overlay-dispose-listener");
  };
  workspace.state.subscribe(workspaceListener);
  overlays.surfaces.subscribe(overlayListener);
  try {
    assertThrows(() => controller.dispose(), Error, "workspace-dispose-listener");
    assertEquals(controller.disposed, true);
    assertEquals(workspace.windowIds(), ["external"]);
    assertEquals(overlays.surface("managed-modal"), undefined);
    controller.dispose();
  } finally {
    workspace.state.unsubscribe(workspaceListener);
    overlays.surfaces.unsubscribe(overlayListener);
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("reconcile rolls local and shared ownership back after workspace or overlay publication failures", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a"), windowNode("b")),
    workspace,
    overlays,
  });
  try {
    const initial = controller.snapshot();
    const workspaceFailure = () => {
      throw new Error("workspace-reconcile-listener");
    };
    workspace.state.subscribe(workspaceFailure);
    try {
      assertThrows(
        () => controller.reconcile(markupRoot(windowNode("a"), windowNode("c"))),
        Error,
        "reconciliation and rollback publication failed",
      );
    } finally {
      workspace.state.unsubscribe(workspaceFailure);
    }
    assertEquals(controller.snapshot(), initial);
    assertEquals(workspace.windowIds(), ["a", "b"]);

    controller.reconcile(markupRoot(windowNode("a"), windowNode("c")));
    const beforeOverlayFailure = controller.snapshot();
    const overlayFailure = () => {
      throw new Error("overlay-reconcile-listener");
    };
    overlays.surfaces.subscribe(overlayFailure);
    try {
      assertThrows(
        () =>
          controller.reconcile(
            markupRoot(windowNode("a"), windowNode("c"), modalNode("dialog")),
            { layout: modalLayout({ dialog: { column: 2, row: 1, width: 10, height: 4 } }) },
          ),
        Error,
        "reconciliation and rollback publication failed",
      );
    } finally {
      overlays.surfaces.unsubscribe(overlayFailure);
    }
    assertEquals(controller.snapshot(), beforeOverlayFailure);
    assertEquals(overlays.surface("dialog"), undefined);

    controller.reconcile(
      markupRoot(windowNode("a"), windowNode("c"), modalNode("dialog")),
      { layout: modalLayout({ dialog: { column: 2, row: 1, width: 10, height: 4 } }) },
    );
    assertEquals(controller.inspect().modals[0]!.registered, true);
  } finally {
    controller.dispose();
    assertEquals(workspace.windowIds(), []);
    assertEquals(overlays.surface("dialog"), undefined);
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("declarative discovery bounds cycles depth and total live layout nodes", () => {
  const cycleRoot = markupRoot(windowNode("cycle-window"));
  cycleRoot.children.push(cycleRoot);
  const depthRoot = markupRoot();
  let cursor = depthRoot;
  for (let index = 0; index < 66; index += 1) {
    const child = createLayoutNode({ id: `depth-${index}`, tag: "section" });
    cursor.children.push(child);
    cursor = child;
  }
  const hugeRoot = markupRoot(
    ...Array.from({ length: 4_097 }, (_, index) => createLayoutNode({ id: `node-${index}`, tag: "section" })),
  );

  for (
    const [root, expected] of [
      [cycleRoot, "layout-cycle-detected"],
      [depthRoot, "layout-depth-exceeded"],
      [hugeRoot, "layout-node-limit-exceeded"],
    ] as const
  ) {
    const workspace = new TiledWorkspaceController();
    const overlays = new OverlayStackController();
    const controller = new MarkupWindowController({ root, workspace, overlays });
    try {
      assertEquals(controller.inspect().diagnostics.some((entry) => entry.code === expected), true);
    } finally {
      controller.dispose();
      workspace.dispose();
      overlays.dispose();
    }
  }
});

Deno.test("strict snapshots reject tiled focus and floating tier contradictions", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a"), windowNode("b")),
    workspace,
    overlays,
  });
  try {
    controller.focus("a");
    const stable = controller.snapshot();
    const tiledMismatch = structuredClone(stable);
    const bPane = tiledMismatch.workspace.layout.root && findPaneId(tiledMismatch.workspace.layout.root, "b");
    tiledMismatch.workspace.layout.activePaneId = bPane;
    assertEquals(controller.restoreSnapshot(tiledMismatch).status, "invalid");
    assertEquals(controller.snapshot(), stable);

    controller.setPlacement("a", "floating", { rect: { column: 2, row: 2, width: 20, height: 8 } });
    controller.setPlacement("b", "floating", { rect: { column: 5, row: 3, width: 20, height: 8 } });
    controller.setAlwaysOnTop("a", true);
    controller.setAlwaysOnTop("b", true);
    controller.focus("a");
    const floatingStable = controller.snapshot();
    const coveredActive = structuredClone(floatingStable);
    coveredActive.focusOrderWindowIds = ["a", "b"];
    assertEquals(controller.restoreSnapshot(coveredActive).status, "invalid");
    assertEquals(controller.snapshot(), floatingStable);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("always-on-top tier changes preserve a self-restorable active z-order", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a"), windowNode("b")),
    workspace,
    overlays,
  });
  try {
    controller.setPlacement("a", "floating");
    controller.setPlacement("b", "floating");
    controller.setAlwaysOnTop("a", true);
    controller.focus("b");
    assertEquals(controller.setAlwaysOnTop("a", false).status, "applied");
    assertEquals(controller.inspect().activeWindowId, "a");
    const snapshot = controller.snapshot();
    assertEquals(controller.restoreSnapshot(snapshot).status, "applied");
    assertEquals(controller.snapshot(), snapshot);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("reconcile keeps a surviving floating active window frontmost", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const firstRoot = markupRoot(windowNode("b", { placement: "floating" }));
  const controller = new MarkupWindowController({ root: firstRoot, workspace, overlays });
  try {
    controller.focus("b");
    controller.reconcile(markupRoot(
      windowNode("b", { placement: "floating" }),
      windowNode("a", { placement: "floating", "always-on-top": "true" }),
    ));
    controller.reconcile(markupRoot(
      windowNode("b", { placement: "floating" }),
      windowNode("a", { placement: "floating", "always-on-top": "false" }),
    ));
    assertEquals(controller.inspect().activeWindowId, "b");
    const snapshot = controller.snapshot();
    assertEquals(snapshot.focusOrderWindowIds.at(-1), "b");
    assertEquals(controller.restoreSnapshot(snapshot).status, "applied");
    assertEquals(controller.snapshot(), snapshot);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("dock ratios normalize safely and extreme bounds cannot poison snapshots", () => {
  const workspace = new TiledWorkspaceController();
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("a"), windowNode("b")),
    workspace,
    overlays,
  });
  try {
    assertEquals(controller.dock("a", "b", "left", { ratio: 99 }).status, "applied");
    const docked = controller.snapshot();
    assertEquals(docked.placements.find((entry) => entry.id === "a")?.snapTarget, {
      kind: "dock",
      targetId: "b",
      edge: "left",
      ratio: 0.95,
    });
    assertEquals(controller.restoreSnapshot(docked).status, "applied");
    assertEquals(controller.dock("a", "b", "left", { ratio: Number.NaN }).status, "invalid");

    controller.setPlacement("a", "floating", {
      rect: { column: 0, row: 0, width: 1_000_000, height: 4 },
    });
    const stable = controller.snapshot();
    assertEquals(
      controller.snap("a", { kind: "workspace", edge: "right" }, {
        column: 1_000_000,
        row: 0,
        width: 1_000_000,
        height: 10,
      }).status,
      "invalid",
    );
    assertEquals(
      controller.recoverBounds("a", { column: -1_000_000, row: 0, width: 1, height: 1 }).status,
      "invalid",
    );
    controller.project({ column: -1_000_000, row: 0, width: 1, height: 1 });
    assertEquals(controller.snapshot(), stable);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

Deno.test("ratio resize cannot mutate external or mixed shared-workspace splits", () => {
  const workspace = new TiledWorkspaceController({ windows: [{ id: "external-a" }, { id: "external-b" }] });
  const overlays = new OverlayStackController();
  const controller = new MarkupWindowController({
    root: markupRoot(windowNode("managed")),
    workspace,
    overlays,
  });
  try {
    const before = workspace.snapshot();
    const splitIds = collectSplitIds(before.layout.root);
    for (const splitId of splitIds) {
      assertEquals(controller.resizeRatio(splitId, 0.2).status, "blocked");
    }
    assertEquals(workspace.snapshot(), before);
  } finally {
    controller.dispose();
    workspace.dispose();
    overlays.dispose();
  }
});

function markupRoot(...children: LayoutNode[]): LayoutNode {
  return createLayoutNode({ id: "root", tag: "main", children });
}

function windowNode(
  id: string,
  attributes: Record<string, string> = {},
  children: LayoutNode[] = [],
  minWidth?: number,
  minHeight?: number,
  maxWidth?: number,
  maxHeight?: number,
): LayoutNode {
  const style = defaultComputedLayoutStyle();
  if (minWidth !== undefined) style.minWidth = cellLength(minWidth);
  if (minHeight !== undefined) style.minHeight = cellLength(minHeight);
  if (maxWidth !== undefined) style.maxWidth = cellLength(maxWidth);
  if (maxHeight !== undefined) style.maxHeight = cellLength(maxHeight);
  return createLayoutNode({ id, tag: "window", attributes, children, style });
}

function hiddenWindowNode(id: string, minWidth?: number): LayoutNode {
  const node = windowNode(id, {}, [], minWidth);
  node.style.visibility = "hidden";
  return node;
}

function modalNode(id: string, attributes: Record<string, string> = {}): LayoutNode {
  return createLayoutNode({ id, tag: "modal", attributes });
}

function modalLayout(rects: Record<string, Rectangle>): MarkupWindowLayoutLookup {
  return {
    byId: new Map(Object.entries(rects).map(([id, rect]) => [id, { rect }])),
  };
}

function splitRatio(workspace: TiledWorkspaceController, splitId: string): number | undefined {
  return findSplitRatio(workspace.inspect().layout.root, splitId);
}

function findSplitRatio(
  node: TiledWorkspaceLayoutNode | undefined,
  splitId: string,
): number | undefined {
  if (!node) return undefined;
  if (node.kind === "pane") return undefined;
  if (node.id === splitId) return node.ratio;
  return findSplitRatio(node.first, splitId) ?? findSplitRatio(node.second, splitId);
}

function findPaneId(node: TiledWorkspaceLayoutNode, windowId: string): string | undefined {
  if (node.kind === "pane") return node.windowId === windowId ? node.id : undefined;
  return findPaneId(node.first, windowId) ?? findPaneId(node.second, windowId);
}

function collectSplitIds(node: TiledWorkspaceLayoutNode | undefined): string[] {
  if (!node || node.kind === "pane") return [];
  return [node.id, ...collectSplitIds(node.first), ...collectSplitIds(node.second)];
}
