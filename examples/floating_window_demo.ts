import {
  cellLength,
  createLayoutNode,
  createMarkupWindowHistoryAdapter,
  defaultComputedLayoutStyle,
  HistoryStack,
  type LayoutNode,
  type MarkupWindowActionResult,
  MarkupWindowController,
  MarkupWindowInteractionController,
  OverlayStackController,
  POINTER_INPUT_SCHEMA_VERSION,
  PointerCaptureController,
  type PointerInputEvent,
  type Rectangle,
  TiledWorkspaceController,
} from "../mod.ts";

let pointerSequence = 0;

const bounds: Rectangle = { column: 0, row: 0, width: 112, height: 34 };
const workspace = new TiledWorkspaceController({ gap: 1 });
const overlays = new OverlayStackController();
const controller = new MarkupWindowController({
  root: createLayoutNode({
    id: "desktop",
    tag: "main",
    children: [
      windowNode("library", "Library", 24, 12, 52, 28),
      windowNode("playlist", "Playlist", 28, 10, 64, 26),
      windowNode("equalizer", "Equalizer", 24, 8, 48, 18),
      windowNode("diagnostics", "Diagnostics", 30, 9, 72, 24),
    ],
  }),
  workspace,
  overlays,
  compactMode: "auto",
});
const history = new HistoryStack({ capacity: 32 });
const windowHistory = createMarkupWindowHistoryAdapter({ controller, history });
const pointerCapture = new PointerCaptureController();
const interactions = new MarkupWindowInteractionController({
  controller,
  capture: pointerCapture,
  history: windowHistory,
  snapOnRelease: false,
});

expectOk(controller.setPlacement("playlist", "floating", {
  rect: { column: 38, row: 3, width: 42, height: 16 },
}));
expectOk(controller.setPlacement("equalizer", "floating", {
  rect: { column: 62, row: 20, width: 32, height: 10 },
}));
expectOk(controller.setPlacement("diagnostics", "floating", {
  rect: { column: 8, row: 18, width: 38, height: 12 },
}));
expectOk(controller.setAlwaysOnTop("equalizer", true));
expectOk(controller.setGroup("playlist", "audio-suite"));
expectOk(controller.setGroup("equalizer", "audio-suite"));
expectOk(controller.focus("playlist"));

const beforeGesture = floatingRects(controller.project(bounds));
interactions.handlePointer(pointer("down", 42, 4), bounds);
interactions.handlePointer(pointer("move", 49, 6), bounds);
const pointerCommit = interactions.handlePointer(pointer("up", 49, 6), bounds);
if (pointerCommit.status !== "committed" || !pointerCommit.historyRecorded) {
  throw new Error("Captured grouped window move did not produce one history entry.");
}
const afterGesture = floatingRects(controller.project(bounds));

await history.undo();
const afterUndo = floatingRects(controller.project(bounds));
await history.redo();
const afterRedo = floatingRects(controller.project(bounds));

expectOk(controller.snap("diagnostics", { kind: "workspace", edge: "left" }, bounds));
expectOk(controller.resizeWindow("playlist", "bottom-right", { columns: 8, rows: 3 }));
expectOk(controller.setFloatingRect("equalizer", { column: 180, row: -20, width: 32, height: 10 }));
const beforeRecovery = durableFloatingRect(controller, "equalizer");
expectOk(controller.recoverBounds("equalizer", bounds, { margin: 1, titleBarHeight: 1 }));
const afterRecovery = durableFloatingRect(controller, "equalizer");

const snapshot = controller.snapshot();
expectOk(controller.moveBy("diagnostics", { columns: 40, rows: -12 }));
expectOk(controller.restoreSnapshot(snapshot));
if (JSON.stringify(controller.snapshot()) !== JSON.stringify(snapshot)) {
  throw new Error("Snapshot restore did not reproduce the exact controller state.");
}
const finalProjection = controller.project(bounds);

console.log("# Advanced Floating Window Demo");
console.log("");
console.log(
  "The tiled controller owns its tree; one markup integration owns declarative floating state and projects both through shared pointer/history services.",
);
console.log("");
console.log("## One-entry grouped movement");
console.log(`before: ${formatRects(beforeGesture)}`);
console.log(`after:  ${formatRects(afterGesture)}`);
console.log(`undo:   ${formatRects(afterUndo)}`);
console.log(`redo:   ${formatRects(afterRedo)}`);
console.log(`history: undo=${history.undoDepth} redo=${history.redoDepth}`);
console.log("");
console.log("## Bounds recovery");
console.log(`offscreen: ${formatRect(beforeRecovery)}`);
console.log(`recovered: ${formatRect(afterRecovery)}`);
console.log("");
console.log("## Final back-to-front projection");
for (const window of finalProjection.floatingZOrder) {
  const flags = [window.active ? "active" : "", window.alwaysOnTop ? "always-on-top" : "", window.groupId]
    .filter(Boolean)
    .join(",");
  console.log(
    `${window.id.padEnd(12)} ${formatRect(window.rect).padEnd(17)} z=${String(window.zIndex).padEnd(5)} ${flags}`,
  );
}
console.log("");
console.log(`tiled: ${finalProjection.workspace.panes.map((pane) => pane.windowId).join(", ") || "none"}`);
console.log(`snapshot: v${snapshot.version}, ${snapshot.placements.length} placements, restored exactly`);

interactions.dispose();
pointerCapture.dispose();
windowHistory.dispose();
controller.dispose();
workspace.dispose();
overlays.dispose();

function windowNode(
  id: string,
  title: string,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
): LayoutNode {
  const style = defaultComputedLayoutStyle();
  style.minWidth = cellLength(minWidth);
  style.minHeight = cellLength(minHeight);
  style.maxWidth = cellLength(maxWidth);
  style.maxHeight = cellLength(maxHeight);
  return createLayoutNode({ id, tag: "window", attributes: { title }, style });
}

function expectOk(result: MarkupWindowActionResult): void {
  if (!result.ok) throw new Error(`${result.action} failed for ${result.id ?? "workspace"}: ${result.reason}`);
}

function floatingRects(controllerProjection: ReturnType<MarkupWindowController["project"]>): Record<string, Rectangle> {
  return Object.fromEntries(controllerProjection.floatingWindows.map((window) => [window.id, { ...window.rect }]));
}

function durableFloatingRect(controller: MarkupWindowController, id: string): Rectangle {
  const rect = controller.inspect().windows.find((window) => window.id === id)?.floatingRect;
  if (!rect) throw new Error(`Floating rectangle for ${id} is unavailable.`);
  return { ...rect };
}

function formatRects(rects: Readonly<Record<string, Rectangle>>): string {
  return Object.entries(rects).map(([id, rect]) => `${id}=${formatRect(rect)}`).join("; ");
}

function formatRect(rect: Rectangle): string {
  return `${rect.width}x${rect.height}@${rect.column},${rect.row}`;
}

function pointer(kind: "down" | "move" | "up", column: number, row: number): PointerInputEvent {
  return {
    schemaVersion: POINTER_INPUT_SCHEMA_VERSION,
    sequence: ++pointerSequence,
    timestamp: pointerSequence,
    source: "test",
    trust: "trusted",
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    pointerId: 1,
    device: "mouse",
    kind,
    coordinates: { cell: { space: "cell", x: column, y: row } },
    primary: true,
    button: kind === "down" ? 0 : null,
    buttons: kind === "up" ? 0 : 1,
  };
}
