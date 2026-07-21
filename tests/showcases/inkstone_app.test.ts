import { assert, assertEquals, assertNotEquals, assertStrictEquals, assertStringIncludes } from "../deps.ts";
import { createTestMousePress, createTestTerminalApp, type TestTerminalAppHarness } from "../../mod.testing.ts";
import {
  createInkstoneAppDefinition,
  type InkstoneAppAction,
  type InkstoneAppDefinition,
  type InkstoneAppMount,
} from "../../examples/showcases/inkstone/app.ts";
import { parseInkstoneShowcaseArgs } from "../../examples/showcases/inkstone/main.ts";
import type { InkstoneSearchRow } from "../../examples/showcases/inkstone/model.ts";

interface InkstoneHarness {
  readonly definition: InkstoneAppDefinition;
  readonly harness: TestTerminalAppHarness<InkstoneAppAction>;
  readonly mount: InkstoneAppMount;
}

Deno.test("Inkstone renders the complete fixture-backed workbench", async () => {
  const fixture = await createInkstoneHarness(132, 34);
  try {
    const snapshot = fixture.harness.pilot.snapshot();
    assertStringIncludes(snapshot, "INKSTONE");
    assertStringIncludes(snapshot, "VAULT");
    assertStringIncludes(snapshot, "EDITOR");
    assertStringIncludes(snapshot, "MARKDOWN PREVIEW");
    assertStringIncludes(snapshot, "INSPECTOR");
    assertStringIncludes(snapshot, "OUTLINE");
    assertStringIncludes(snapshot, "BACKLINKS");
    assertStringIncludes(snapshot, "SEARCH RESULTS");
    assertStringIncludes(snapshot, "DIAGNOSTICS");
    assertStringIncludes(snapshot, "Welcome to Inkstone");
    assertEquals(fixture.mount.breakpoint.peek(), "wide");
    assertEquals(fixture.mount.visibleWindowIds.peek(), ["vault", "editor", "preview", "inspector"]);
    assertEquals(
      fixture.mount.workspaceLayout.peek().panes.map((pane) => pane.windowId),
      ["vault", "editor", "preview", "inspector"],
    );
    assertEquals(fixture.definition.controller.inspect().initialized, true);
    assertEquals(fixture.definition.controller.inspect().noteCount, 5);
  } finally {
    await destroyInkstoneHarness(fixture);
  }
});

Deno.test("Inkstone edits Unicode, updates Markdown, supports history, and saves", async () => {
  const fixture = await createInkstoneHarness(132, 34);
  const { controller } = fixture.definition;
  try {
    const lines = controller.editor.inspect().lines;
    const headingLine = lines.findIndex((line: string) => line.startsWith("# "));
    assert(headingLine >= 0);
    const heading = lines[headingLine]!;
    controller.editor.setCursorPosition({ x: heading.length, y: headingLine });
    fixture.harness.app.focus.focus(fixture.mount.editor);

    await fixture.harness.pilot.press("!");
    await fixture.harness.pilot.paste(" 🛰️");
    assertStringIncludes(controller.editorSource.peek(), "# Welcome to Inkstone! 🛰️");
    assertStrictEquals(controller.markdown.source, controller.editorSource);
    assert(controller.inspect().dirtyCount > 0);
    assertStringIncludes(fixture.harness.pilot.snapshot(), "Welcome to Inkstone! 🛰️");

    const edited = controller.editorSource.peek();
    await fixture.harness.pilot.press("s", { ctrl: true });
    await fixture.harness.pilot.waitFor(() => controller.inspect().dirtyCount === 0);
    assertEquals(controller.status.peek(), "ready");
    assertStringIncludes(fixture.harness.pilot.snapshot(), "Saved revision");

    await fixture.harness.pilot.press("z", { ctrl: true });
    assertNotEquals(controller.editorSource.peek(), edited);
    await fixture.harness.pilot.press("y", { ctrl: true });
    assertEquals(controller.editorSource.peek(), edited);
  } finally {
    await destroyInkstoneHarness(fixture);
  }
});

Deno.test("Inkstone local find replace commands preserve the separate vault search", async () => {
  const fixture = await createInkstoneHarness(132, 34);
  const { controller } = fixture.definition;
  try {
    fixture.harness.app.focus.focus(fixture.mount.editor);
    const editorHeight = fixture.mount.editor.rectangle.peek().height;
    await fixture.harness.pilot.press("f", { ctrl: true });
    assertEquals(fixture.mount.findVisible.peek(), true);
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.findInput);
    assertEquals(fixture.mount.editor.rectangle.peek().height, editorHeight - 2);

    fixture.mount.findInput.controller.setText("Inkstone");
    await fixture.harness.pilot.press("return");
    assertEquals(controller.editor.selectedText(), "Inkstone");
    assertStringIncludes(fixture.mount.findFeedback.peek(), "/");

    await fixture.harness.pilot.press("h", { ctrl: true });
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.replaceInput);
    fixture.mount.replaceInput.controller.setText("Inkwell");
    await fixture.harness.pilot.press("return");
    assertStringIncludes(controller.editorSource.peek(), "Welcome to Inkwell");
    assertStringIncludes(fixture.mount.findFeedback.peek(), "replaced");

    await fixture.harness.pilot.press("f", { ctrl: true });
    fixture.mount.findInput.controller.setText("q".repeat(513));
    await fixture.harness.pilot.press("return");
    assertStringIncludes(fixture.mount.findFeedback.peek(), "exceeds");
    await fixture.harness.pilot.press("h", { ctrl: true });
    fixture.mount.replaceInput.controller.setText("x".repeat(16_385));
    await fixture.harness.pilot.press("return");
    assertStringIncludes(fixture.mount.findFeedback.peek(), "limits");

    await fixture.harness.pilot.press("f", { ctrl: true, shift: true });
    assertEquals(fixture.mount.findVisible.peek(), false);
    assertEquals(controller.kernel.routeId.peek(), "search");
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.searchInput);
  } finally {
    await destroyInkstoneHarness(fixture);
  }
});

Deno.test("Inkstone palette restores focus and search and backlinks navigate", async () => {
  const fixture = await createInkstoneHarness(132, 34);
  const { controller } = fixture.definition;
  try {
    fixture.harness.app.focus.focus(fixture.mount.editor);
    await fixture.harness.pilot.press("p", { ctrl: true });
    assertEquals(fixture.mount.paletteVisible.peek(), true);
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.palette);
    assertStringIncludes(fixture.harness.pilot.snapshot(), "Command Palette");
    assertStringIncludes(fixture.harness.pilot.snapshot(), "Save active note");

    await fixture.harness.pilot.press("escape");
    assertEquals(fixture.mount.paletteVisible.peek(), false);
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.editor);

    await fixture.harness.pilot.press("f", { ctrl: true, shift: true });
    assertEquals(controller.kernel.routeId.peek(), "search");
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.searchInput);
    for (const key of ["m", "o", "d", "i", "f", "i", "e", "r"] as const) {
      await fixture.harness.pilot.press(key);
    }
    await fixture.harness.pilot.waitFor(() =>
      controller.searchResults.peek().some((row: InkstoneSearchRow) => row.noteId === "unicode")
    );
    await fixture.harness.pilot.press("return");
    await fixture.harness.pilot.waitFor(() => controller.activeNoteId.peek() === "unicode");
    assertEquals(controller.kernel.routeId.peek(), "note");

    await fixture.harness.pilot.waitFor(() => controller.backlinks.peek().length > 0);
    const previous = controller.activeNoteId.peek();
    fixture.harness.app.focus.focus(fixture.mount.backlinks);
    await fixture.harness.pilot.press("return");
    await fixture.harness.pilot.waitFor(() => controller.activeNoteId.peek() !== previous);
    assertNotEquals(controller.activeNoteId.peek(), previous);
  } finally {
    await destroyInkstoneHarness(fixture);
  }
});

Deno.test("Inkstone collapses its single tiled workspace responsively", async () => {
  const fixture = await createInkstoneHarness(132, 34);
  try {
    fixture.harness.app.focus.focus(fixture.mount.outline);
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.outline);
    await fixture.harness.pilot.resize(90, 26);
    assertEquals(fixture.mount.breakpoint.peek(), "medium");
    assertEquals(fixture.mount.visibleWindowIds.peek(), ["vault", "editor", "preview"]);
    assertEquals(fixture.mount.workspaceLayout.peek().panes.map((pane) => pane.windowId), [
      "vault",
      "editor",
      "preview",
    ]);
    assertEquals(fixture.harness.pilot.snapshot().includes("KNOWLEDGE INSPECTOR"), false);
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.explorer);

    fixture.harness.app.focus.focus(fixture.mount.preview);
    await fixture.harness.pilot.resize(64, 20);
    assertEquals(fixture.mount.breakpoint.peek(), "narrow");
    assertEquals(fixture.mount.visibleWindowIds.peek(), ["editor"]);
    assertEquals(fixture.mount.workspaceLayout.peek().panes.map((pane) => pane.windowId), ["editor"]);
    const narrow = fixture.harness.pilot.snapshot();
    assertStringIncludes(narrow, "EDITOR");
    assertEquals(narrow.includes("MARKDOWN PREVIEW"), false);
    assertEquals(narrow.includes("VAULT"), false);
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.editor);
    const hidden = new Set([
      fixture.mount.explorer,
      fixture.mount.preview,
      fixture.mount.outline,
      fixture.mount.backlinks,
      fixture.mount.searchResults,
      fixture.mount.diagnostics,
    ]);
    for (let index = 0; index < 12; index += 1) {
      assertEquals(hidden.has(fixture.harness.app.focus.next() as never), false);
    }
    const host = fixture.definition.controller.kernel.windowHost!;
    const beforeHiddenFocus = host.controller.inspect().activeWindowId;
    await fixture.harness.app.actions.dispatch({ type: "inkstone.focus", windowId: "preview" });
    assertEquals(host.controller.inspect().activeWindowId, beforeHiddenFocus);
    assertNotEquals(fixture.harness.app.focus.current(), fixture.mount.preview);

    await fixture.harness.pilot.press("d", { ctrl: true, shift: true });
    assertEquals(fixture.mount.visibleWindowIds.peek(), ["editor"]);
    assertEquals(fixture.mount.windowProjection.peek().floatingWindows.some((window) => window.id === "preview"), true);
    assertStringIncludes(fixture.harness.pilot.snapshot(), "MARKDOWN PREVIEW");
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.preview);
    await fixture.harness.pilot.press("t", { ctrl: true, shift: true });
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.editor);

    await fixture.harness.pilot.press("2", { ctrl: true });
    assertEquals(fixture.mount.visibleWindowIds.peek(), ["inspector"]);
    assertEquals(fixture.mount.searchResults.visible.peek(), true);
    assertStringIncludes(fixture.harness.pilot.snapshot(), "SEARCH RESULTS");
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.searchInput);
    assertEquals(host.controller.inspect().activeWindowId, "inspector");
    await fixture.harness.pilot.press("3", { ctrl: true });
    assertEquals(fixture.mount.visibleWindowIds.peek(), ["inspector"]);
    assertEquals(fixture.mount.diagnostics.visible.peek(), true);
    assertStringIncludes(fixture.harness.pilot.snapshot(), "DIAGNOSTICS");
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.diagnostics);
    assertEquals(host.controller.inspect().activeWindowId, "inspector");
    await fixture.harness.app.actions.dispatch({ type: "inkstone.focus", windowId: "inspector" });
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.diagnostics);

    await fixture.harness.pilot.press("1", { ctrl: true });
    assertEquals(fixture.mount.visibleWindowIds.peek(), ["editor"]);
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.editor);
    assertEquals(host.controller.inspect().activeWindowId, "editor");
    await fixture.harness.pilot.press("tab", { meta: true });
    assertEquals(fixture.mount.windowProjection.peek().switcher?.items.map((item) => item.id), ["editor"]);
    await fixture.harness.pilot.press("return");
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.editor);
    assertEquals(host.controller.inspect().activeWindowId, "editor");
  } finally {
    await destroyInkstoneHarness(fixture);
  }
});

Deno.test("Inkstone detaches drags pins minimizes restores and docks preview through shared window chrome", async () => {
  const fixture = await createInkstoneHarness(132, 34);
  const { controller } = fixture.definition;
  const host = controller.kernel.windowHost!;
  try {
    const editorBaseline = controller.editorSource.peek();
    controller.editor.setCursorPosition({ x: 0, y: 0 });
    assertEquals(controller.editor.insertText("WINDOW-HISTORY-SEPARATION\n"), true);
    const edited = controller.editorSource.peek();

    await fixture.harness.pilot.press("d", { ctrl: true, shift: true });
    let preview = fixture.mount.windowProjection.peek().floatingWindows.find((window) => window.id === "preview")!;
    assert(preview);
    assertEquals(fixture.mount.workspaceLayout.peek().panes.some((pane) => pane.windowId === "preview"), false);
    assertStringIncludes(fixture.harness.pilot.snapshot(), "MARKDOWN PREVIEW");

    const beforeDrag = { ...preview.rect };
    const moveX = preview.rect.column + Math.floor((preview.rect.width - 1) / 2);
    const moveY = preview.rect.row;
    const depth = host.history.undoDepth;
    assertEquals(
      (await fixture.harness.app.mouse.dispatch(createTestMousePress({ x: moveX, y: moveY }))).handled,
      true,
    );
    assertEquals(
      (await fixture.harness.app.mouse.dispatch(createTestMousePress({
        x: moveX + 6,
        y: moveY + 2,
        drag: true,
        movementX: 6,
        movementY: 2,
      }))).handled,
      true,
    );
    assertEquals(
      (await fixture.harness.app.mouse.dispatch(createTestMousePress({
        x: moveX + 6,
        y: moveY + 2,
        release: true,
        button: undefined,
      }))).handled,
      true,
    );
    await fixture.harness.pilot.waitFor(() => host.history.undoDepth === depth + 1);
    preview = fixture.mount.windowProjection.peek().floatingWindows.find((window) => window.id === "preview")!;
    assertNotEquals(preview.rect, beforeDrag);

    await fixture.harness.pilot.press("z", { meta: true, shift: true });
    preview = fixture.mount.windowProjection.peek().floatingWindows.find((window) => window.id === "preview")!;
    assertEquals(preview.rect, beforeDrag);
    assertEquals(controller.editorSource.peek(), edited);
    await fixture.harness.pilot.press("z", { ctrl: true });
    assertEquals(controller.editorSource.peek(), editorBaseline);
    assertEquals(fixture.mount.windowProjection.peek().floatingWindows.some((window) => window.id === "preview"), true);

    await fixture.harness.pilot.press("p", { ctrl: true, shift: true });
    assertEquals(
      fixture.mount.windowProjection.peek().floatingWindows.find((window) => window.id === "preview")?.alwaysOnTop,
      true,
    );
    await fixture.harness.app.actions.dispatch({ type: "inkstone.focus", windowId: "preview" });
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.preview);
    await fixture.harness.pilot.press("m", { ctrl: true, shift: true });
    const shelfItem = fixture.mount.windowProjection.peek().shelf.find((item) => item.id === "preview")!;
    assert(shelfItem.rect);
    assertStringIncludes(fixture.harness.pilot.snapshot(), "minimized");
    assertNotEquals(fixture.harness.app.focus.current(), fixture.mount.preview);
    const restored = await fixture.harness.pilot.click(shelfItem.rect.column, shelfItem.rect.row);
    assertEquals(restored.press.targetId, "inkstone-window-shelf");
    assertEquals(fixture.mount.windowProjection.peek().shelf.some((item) => item.id === "preview"), false);
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.preview);
    assertEquals(host.controller.inspect().activeWindowId, "preview");

    await fixture.harness.pilot.press("t", { ctrl: true, shift: true });
    assertEquals(
      fixture.mount.windowProjection.peek().floatingWindows.some((window) => window.id === "preview"),
      false,
    );
    assertEquals(fixture.mount.workspaceLayout.peek().panes.some((pane) => pane.windowId === "preview"), true);
  } finally {
    await destroyInkstoneHarness(fixture);
  }
});

Deno.test("Inkstone modal focus blocks global window command bindings", async () => {
  const fixture = await createInkstoneHarness(132, 34);
  const host = fixture.definition.controller.kernel.windowHost!;
  try {
    const before = host.snapshot();
    await fixture.harness.pilot.press("p", { ctrl: true });
    assertEquals(fixture.mount.paletteVisible.peek(), true);
    await fixture.harness.pilot.press("m", { ctrl: true, shift: true });
    assertEquals(host.snapshot(), before);
    assertEquals(fixture.mount.paletteVisible.peek(), true);

    await fixture.harness.pilot.press("escape");
    await fixture.harness.pilot.press("m", { ctrl: true, shift: true });
    assertEquals(host.controller.inspect().windows.find((window) => window.id === "preview")?.state, "minimized");
  } finally {
    await destroyInkstoneHarness(fixture);
  }
});

Deno.test("Inkstone exposes row-level mouse targets for explorer tabs preview and inspector lists", async () => {
  const fixture = await createInkstoneHarness(132, 34);
  const { controller } = fixture.definition;
  try {
    const targetIds = new Set(fixture.harness.app.mouse.inspect().map((target) => target.id));
    for (
      const id of [
        "inkstone-vault-explorer-rows",
        "inkstone-editor-tab-items",
        "inkstone-preview-content",
        "inkstone-inspector-outline-rows",
        "inkstone-inspector-backlinks-rows",
        "inkstone-inspector-search-rows",
        "inkstone-inspector-diagnostics-rows",
      ]
    ) {
      assert(targetIds.has(id));
    }

    fixture.harness.app.focus.focus(fixture.mount.explorer);
    const editorWindow = fixture.mount.windowProjection.peek().windows.find((window) => window.id === "editor")!;
    const editorTitleClick = await fixture.harness.pilot.click(
      editorWindow.titleBarRect.column + 1,
      editorWindow.titleBarRect.row,
    );
    assertEquals(editorTitleClick.press.targetId, "inkstone-window-editor-titlebar");
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.editor);
    assertEquals(controller.kernel.windowHost!.controller.inspect().activeWindowId, "editor");

    const outlineRect = fixture.mount.outline.rectangle.peek();
    assert(fixture.mount.outline.controller.items.peek().length > 1);
    const outlineClick = await fixture.harness.app.mouse.dispatch(createTestMousePress({
      x: outlineRect.column,
      y: outlineRect.row + 1,
    }));
    assertEquals(outlineClick.targetId, "inkstone-inspector-outline-rows");
    assertEquals(fixture.mount.outline.controller.selectedIndex.peek(), 1);

    const explorerRect = fixture.mount.explorer.rectangle.peek();
    assert(fixture.mount.explorer.controller.visibleRows().length > 1);
    const explorerClick = await fixture.harness.app.mouse.dispatch(createTestMousePress({
      x: explorerRect.column,
      y: explorerRect.row + 1,
    }));
    assertEquals(explorerClick.targetId, "inkstone-vault-explorer-rows");
    assertEquals(fixture.mount.explorer.controller.selectedIndex.peek(), 1);

    await controller.openNote("unicode");
    assert(controller.tabs.tabs.peek().length > 1);
    const tabsRect = fixture.mount.tabs.rectangle.peek();
    const tabsClick = await fixture.harness.app.mouse.dispatch(createTestMousePress({
      x: tabsRect.column + 1,
      y: tabsRect.row,
    }));
    assertEquals(tabsClick.targetId, "inkstone-editor-tab-items");
    assertEquals(controller.tabs.activeIndex.peek(), 0);

    const previewRect = fixture.mount.preview.rectangle.peek();
    const previewClick = await fixture.harness.app.mouse.dispatch(createTestMousePress({
      x: previewRect.column + 1,
      y: previewRect.row + 1,
    }));
    assertEquals(previewClick.targetId, "inkstone-preview-content");
    assertStrictEquals(fixture.harness.app.focus.current(), fixture.mount.preview);
  } finally {
    await destroyInkstoneHarness(fixture);
  }
});

Deno.test("Inkstone launch options require explicit durable persistence", () => {
  assertEquals(parseInkstoneShowcaseArgs([]), { persist: false });
  assertEquals(parseInkstoneShowcaseArgs(["--persist", "--state-file=/state/inkstone.json"]), {
    persist: true,
    sessionPath: "/state/inkstone.json",
  });
  assertEquals(parseInkstoneShowcaseArgs(["--state-file=/state/inkstone.json", "--memory"]), { persist: false });
});

async function createInkstoneHarness(columns: number, rows: number): Promise<InkstoneHarness> {
  const definition = await createInkstoneAppDefinition();
  const harness = await createTestTerminalApp<InkstoneAppAction>({
    ...definition.terminalOptions,
    size: { columns, rows },
  });
  const mount = definition.mount.current;
  if (!mount) {
    harness.destroy();
    await definition.controller.dispose();
    throw new Error("Inkstone test workbench did not mount.");
  }
  return { definition, harness, mount };
}

async function destroyInkstoneHarness(fixture: InkstoneHarness): Promise<void> {
  fixture.harness.destroy();
  await fixture.definition.controller.dispose();
}
