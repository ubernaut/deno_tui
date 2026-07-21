// Copyright 2023 Im-Beast. MIT license.

import { assert, assertEquals, assertRejects, assertStrictEquals, assertStringIncludes } from "../deps.ts";
import { MemoryStore } from "../../mod.ts";
import {
  buildInkstoneIndex,
  createInkstoneController,
  parseInkstoneMetadata,
} from "../../examples/showcases/inkstone/controller.ts";
import { InMemoryInkstoneVaultProvider } from "../../examples/showcases/inkstone/fixture_provider.ts";
import { createInkstoneFixtures } from "../../examples/showcases/inkstone/fixtures.ts";
import type { InkstoneNote } from "../../examples/showcases/inkstone/model.ts";
import { InkstoneVaultConflictError } from "../../examples/showcases/inkstone/model.ts";

Deno.test("Inkstone fixture provider is sorted defensive abort-aware and optimistic", async () => {
  let now = 1_800_000_000_000;
  const provider = new InMemoryInkstoneVaultProvider(createInkstoneFixtures(), { now: () => now++ });
  try {
    const listing = await provider.list();
    assert(Object.isFrozen(listing));
    assertEquals(listing.map((note) => note.path), [
      "Design/Workbench.md",
      "Projects/Orbital Command.md",
      "Reference/Citations.md",
      "Research/Unicode.md",
      "Welcome.md",
    ]);

    const original = await provider.read("welcome");
    assert(Object.isFrozen(original));
    const saved = await provider.write({
      noteId: "welcome",
      source: `${original.source}\n\nSaved fixture override.`,
      expectedRevision: original.revision,
    });
    assertEquals(saved.revision, original.revision + 1);
    assert(saved.updatedAt > original.updatedAt);

    await assertRejects(
      () =>
        provider.write({
          noteId: "welcome",
          source: "stale replacement",
          expectedRevision: original.revision,
        }),
      InkstoneVaultConflictError,
      "expected revision",
    );
    assertEquals(await provider.read("welcome"), saved);
    assertEquals(provider.inspect().conflicts, 1);
    assertEquals(provider.inspect().overrideCount, 1);

    const snapshot = provider.snapshot();
    assertEquals(snapshot.overrides.length, 1);
    const restored = new InMemoryInkstoneVaultProvider(createInkstoneFixtures(), { snapshot });
    try {
      assertEquals(await restored.read("welcome"), saved);
    } finally {
      restored.dispose();
    }

    const abort = new AbortController();
    abort.abort(new Error("fixture read cancelled"));
    await assertRejects(() => provider.list({ signal: abort.signal }), Error, "fixture read cancelled");
  } finally {
    provider.dispose();
  }
  assertEquals(provider.inspect().disposed, true);
  await assertRejects(() => provider.read("welcome"), Error, "disposed");
});

Deno.test("Inkstone indexing resolves Unicode headings links aliases backlinks and exclusions", () => {
  const notes = fixtureNotes();
  const index = buildInkstoneIndex(notes, 7);
  assertEquals(index.revision, 7);
  assertEquals(index.notes.length, 5);
  assertEquals(index.unresolved, [{ sourceNoteId: "welcome", target: "Missing Observatory", line: 14 }]);

  const unicode = index.notes.find((note) => note.noteId === "unicode")!;
  assertEquals(unicode.title, "Café 👩🏽‍💻 and Graphemes");
  assertEquals(unicode.headings.map((heading) => heading.id), [
    "cafe-and-graphemes",
    "grapheme-safety",
    "width-fixtures",
  ]);
  assert(unicode.metadata.tags.includes("i18n"));

  const orbital = index.notes.find((note) => note.noteId === "orbital")!;
  assertEquals(orbital.outgoing.map((link) => link.resolvedNoteId), ["welcome", "unicode"]);
  assertEquals(orbital.outgoing.some((link) => link.line === 18), false);
  assertEquals(orbital.metadata.tags.includes("not-a-tag"), false);
  assertEquals(index.backlinks.orbital.some((link) => link.sourceNoteId === "welcome"), true);
  assertEquals(index.backlinks.unicode.map((link) => link.sourceNoteId), ["orbital", "welcome", "workbench"]);

  assertEquals(parseInkstoneMetadata(notes.find((note) => note.id === "orbital")!.source, "x.md"), {
    title: "Orbital Command",
    tags: ["project", "telemetry"],
    aliases: ["Mission Control", "Orbital"],
    status: "in-progress",
  });
});

Deno.test("Inkstone controller keeps editor preview index history save and conflicts coherent", async () => {
  const controller = createInkstoneController({ now: () => 1_900_000_000_000 });
  await controller.ready;
  try {
    assertEquals(controller.status.peek(), "ready");
    assertEquals(controller.activeNoteId.peek(), "welcome");
    assertStrictEquals(controller.markdown.source, controller.editorSource);
    assertEquals(controller.kernel.workspace.windowIds(), ["vault", "editor", "preview", "inspector"]);
    assert(controller.outline.peek().some((heading) => heading.text === "Tour"));

    const before = controller.editorSource.peek();
    const privateMarker = "PRIVATE-FULL-NOTE-CONTENT-42";
    const edited = `${before}\n\n## Live Graph\n\n[[Sources]] ${privateMarker} #session-test`;
    controller.editor.setText(edited, { x: 0, y: 23 });
    assertEquals(controller.dirtyNoteIds.peek(), ["welcome"]);
    assert(controller.outline.peek().some((heading) => heading.id === "live-graph"));
    assert(controller.index.peek().backlinks.citations.some((link) => link.sourceNoteId === "welcome"));
    assertStringIncludes(controller.markdown.source.peek(), privateMarker);
    assertEquals(JSON.stringify(controller.inspect()).includes(privateMarker), false);

    const results = await controller.setSearch("grapheme");
    assert(results.some((row) => row.noteId === "unicode"));
    assertEquals(JSON.stringify(controller.inspect()).includes("grapheme"), false);

    assertEquals(await controller.undo(), true);
    assertEquals(controller.editorSource.peek(), before);
    assertEquals(controller.index.peek().backlinks.citations.some((link) => link.sourceNoteId === "welcome"), false);
    assertEquals(await controller.redo(), true);
    assertEquals(controller.editorSource.peek(), edited);
    assertEquals(controller.closeNote("welcome"), false);

    const saved = await controller.saveActive();
    assertEquals(saved.status, "saved");
    assertEquals(controller.dirtyNoteIds.peek(), []);

    controller.editor.setText(`${controller.editorSource.peek()}\nlocal conflicting edit`);
    const current = await controller.provider.read("welcome");
    await controller.provider.write({
      noteId: "welcome",
      source: `${current.source}\nexternal fixture edit`,
      expectedRevision: current.revision,
    });
    const conflict = await controller.saveActive();
    assertEquals(conflict.status, "conflict");
    assertEquals(controller.status.peek(), "conflict");
    assertStringIncludes(controller.editorSource.peek(), "local conflicting edit");
    assertEquals(controller.dirtyNoteIds.peek(), ["welcome"]);

    assertEquals(await controller.followLink("Orbital"), true);
    assertEquals(controller.activeNoteId.peek(), "orbital");
    assertEquals(controller.updateMetadata({ tags: ["mission", "telemetry"], status: "review" }), true);
    assertEquals(parseInkstoneMetadata(controller.editorSource.peek(), "Projects/Orbital Command.md").status, "review");
  } finally {
    await controller.dispose();
  }
});

Deno.test("Inkstone current-note find and replace are grapheme-safe atomic and transient", async () => {
  const controller = createInkstoneController({ now: () => 1_950_000_000_000 });
  await controller.ready;
  try {
    controller.editor.setText("A e\u0301 orbit\nB e\u0301 orbit\nC", { x: 0, y: 0 });
    const first = controller.findInActiveEditor("e\u0301 orbit", "forward");
    assertEquals(first, { status: "match", matchCount: 2, matchIndex: 0, wrapped: false });
    assertEquals(controller.editor.selectedText(), "e\u0301 orbit");

    const second = controller.findInActiveEditor("e\u0301 orbit", "forward");
    assertEquals(second, { status: "match", matchCount: 2, matchIndex: 1, wrapped: false });
    const wrapped = controller.findInActiveEditor("e\u0301 orbit", "forward");
    assertEquals(wrapped, { status: "match", matchCount: 2, matchIndex: 0, wrapped: true });

    const beforeOne = controller.editorSource.peek();
    assertEquals(controller.replaceInActiveEditor("e\u0301 orbit", "café").replacements, 1);
    assertStringIncludes(controller.editorSource.peek(), "A café");
    assertEquals(await controller.undo(), true);
    assertEquals(controller.editorSource.peek(), beforeOne);

    const all = controller.replaceAllInActiveEditor("e\u0301 orbit", "cluster");
    assertEquals(all, { replacements: 2, remainingMatches: 0, truncated: false });
    assertStringIncludes(controller.editorSource.peek(), "A cluster\nB cluster");
    assertEquals(await controller.undo(), true);
    assertEquals(controller.editorSource.peek(), beforeOne);

    controller.editor.setSelection({ x: 0, y: 0 }, { x: 1, y: 0 });
    await controller.openNote("unicode");
    await controller.openNote("welcome");
    assertEquals(controller.editor.selectedText(), "A");

    const privateQuery = "PRIVATE-FIND-QUERY-NOT-IN-SOURCE";
    assertEquals(controller.findInActiveEditor(privateQuery).status, "not-found");
    assertEquals(JSON.stringify(controller.snapshot()).includes(privateQuery), false);

    assertEquals(controller.findInActiveEditor("q".repeat(513)), {
      status: "limited",
      matchCount: 0,
      matchIndex: -1,
      wrapped: false,
    });
    controller.editor.setText("a".repeat(100), { x: 0, y: 0 });
    const limited = controller.replaceAllInActiveEditor("a", "x".repeat(16_384));
    assertEquals(limited, { replacements: 0, remainingMatches: 100, truncated: true });
    assertEquals(controller.editorSource.peek(), "a".repeat(100));
  } finally {
    await controller.dispose();
  }
});

Deno.test("Inkstone undo restores the actual cursor from before a moved-then-edit action", async () => {
  const controller = createInkstoneController({ now: () => 1_975_000_000_000 });
  await controller.ready;
  try {
    controller.editor.setText("abcd", { x: 4, y: 0 });
    assertEquals((await controller.saveActive()).status, "saved");
    controller.editor.setCursorPosition({ x: 2, y: 0 });
    assertEquals(controller.editor.insertText("X"), true);
    assertEquals(controller.editorSource.peek(), "abXcd");
    assertEquals(await controller.undo(), true);
    assertEquals(controller.editorSource.peek(), "abcd");
    assertEquals(controller.editor.cursorPosition.peek(), { x: 2, y: 0 });
  } finally {
    await controller.dispose();
  }
});

Deno.test("Inkstone sessions restore provider overrides drafts tabs queries and canonical routes", async () => {
  const store = new MemoryStore<unknown>();
  const first = createInkstoneController({ store, now: () => 2_000_000_000_000 });
  await first.ready;
  const savedMarker = "SAVED-FIXTURE-OVERRIDE";
  const draftMarker = "UNSAVED-PRIVATE-DRAFT";
  try {
    first.editor.setText(`${first.editorSource.peek()}\n\n${savedMarker}`);
    assertEquals((await first.saveActive()).status, "saved");
    first.editor.setText(`${first.editorSource.peek()}\n${draftMarker}`);
    await first.openNote("unicode");
    await first.setSearch("telemetry", "project");
    assertEquals(first.kernel.navigate("diagnostics"), true);
  } finally {
    await first.dispose();
  }

  const restored = createInkstoneController({ store, now: () => 2_000_000_000_100 });
  await restored.ready;
  try {
    assertEquals(restored.kernel.routeId.peek(), "diagnostics");
    assertEquals(restored.activeNoteId.peek(), "unicode");
    assertEquals(restored.tabs.tabs.peek().map((tab) => tab.id), ["welcome", "unicode"]);
    assertEquals(restored.searchQuery.peek(), "telemetry");
    assertEquals(restored.dirtyNoteIds.peek(), ["welcome"]);
    assertEquals(restored.inspect().recoveredDraftCount, 1);
    assertEquals(restored.inspect().recoveryConflictCount, 0);
    assertEquals(restored.inspect().storageMode, "memory");
    const recoveryDiagnostics = JSON.stringify(restored.diagnostics.entries());
    assertStringIncludes(recoveryDiagnostics, "drafts-recovered");
    assertEquals(recoveryDiagnostics.includes(draftMarker), false);

    const savedProviderNote = await restored.provider.read("welcome");
    assertStringIncludes(savedProviderNote.source, savedMarker);
    assertEquals(savedProviderNote.source.includes(draftMarker), false);
    await restored.openNote("welcome");
    assertStringIncludes(restored.editorSource.peek(), savedMarker);
    assertStringIncludes(restored.editorSource.peek(), draftMarker);
    assertEquals(JSON.stringify(restored.inspect()).includes(draftMarker), false);
    assert(JSON.stringify(restored.kernel.snapshot()).length > 0);
  } finally {
    await restored.dispose();
    await restored.dispose();
  }
});

Deno.test("Inkstone sessions restore exact detachable preview geometry state and stacking", async () => {
  const store = new MemoryStore<unknown>();
  const bounds = { column: 0, row: 3, width: 132, height: 28 };
  const first = createInkstoneController({ store, now: () => 2_050_000_000_000 });
  await first.ready;
  const host = first.kernel.windowHost!;
  const rect = { column: 54, row: 7, width: 42, height: 18 };
  assertEquals(
    host.execute({ kind: "set-placement", id: "preview", placement: "floating", rect }, bounds).status,
    "applied",
  );
  assertEquals(host.execute({ kind: "toggle-always-on-top", id: "preview" }, bounds).status, "applied");
  assertEquals(host.execute({ kind: "minimize", id: "preview" }, bounds).status, "applied");
  await first.kernel.flush();
  const expected = host.snapshot();
  await first.dispose();

  const restored = createInkstoneController({ store, now: () => 2_050_000_000_100 });
  await restored.ready;
  try {
    assertEquals(restored.kernel.windowHost!.snapshot(), expected);
    const preview = restored.kernel.windowHost!.controller.inspect().windows.find((window) => window.id === "preview")!;
    assertEquals(preview.placement, "floating");
    assertEquals(preview.state, "minimized");
    assertEquals(preview.floatingRect, rect);
    assertEquals(preview.alwaysOnTop, true);
  } finally {
    await restored.dispose();
  }
});

Deno.test("Inkstone reports restored draft revision conflicts without exposing recovered text", async () => {
  const store = new MemoryStore<unknown>();
  const marker = "PRIVATE-RECOVERED-CONFLICT-DRAFT";
  const first = createInkstoneController({ store, now: () => 2_100_000_000_000 });
  await first.ready;
  first.editor.setText(`${first.editorSource.peek()}\n${marker}`);
  const saved = await first.provider.read("welcome");
  await first.provider.write({
    noteId: "welcome",
    source: `${saved.source}\nexternal revision`,
    expectedRevision: saved.revision,
  });
  await first.dispose();

  const restored = createInkstoneController({ store, now: () => 2_100_000_000_100 });
  await restored.ready;
  try {
    assertEquals(restored.inspect().recoveredDraftCount, 1);
    assertEquals(restored.inspect().recoveryConflictCount, 1);
    assertEquals(restored.status.peek(), "conflict");
    const diagnostics = JSON.stringify(restored.diagnostics.entries());
    assertStringIncludes(diagnostics, "restored-draft-conflict");
    assertEquals(diagnostics.includes(marker), false);
  } finally {
    await restored.dispose();
  }
});

Deno.test("Inkstone dispose can cancel initialization immediately", async () => {
  const controller = createInkstoneController();
  await controller.dispose();
  assertEquals(controller.inspect().status, "disposed");
  assertEquals(controller.provider.inspect().disposed, true);
});

function fixtureNotes(): InkstoneNote[] {
  return createInkstoneFixtures().map((fixture, index) =>
    Object.freeze({
      id: fixture.id,
      path: fixture.path,
      source: fixture.source,
      revision: fixture.revision ?? 1,
      updatedAt: fixture.updatedAt ?? index,
    })
  );
}
