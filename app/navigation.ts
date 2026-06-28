import { visibleSlotIds } from "./layout.ts";
import { orderVisualizationsForSlot } from "./panel_defaults.ts";
import { type LayoutId, type SlotId, slotIds } from "./types.ts";

export type MultiPaneLayoutId = Exclude<LayoutId, "single">;

export function toggleFullscreenLayout(currentLayout: LayoutId, restoreLayout: MultiPaneLayoutId): LayoutId {
  return currentLayout === "single" ? restoreLayout : "single";
}

export function shiftVisualizationForSlot<T extends { id: string }>(
  slotId: SlotId,
  currentId: string,
  step: number,
  entries: readonly T[],
) {
  const ordered = orderVisualizationsForSlot(slotId, entries);
  if (ordered.length === 0) {
    return currentId;
  }

  const currentIndex = ordered.findIndex((entry) => entry.id === currentId);
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const normalizedStep = ((step % ordered.length) + ordered.length) % ordered.length;
  return ordered[(baseIndex + normalizedStep) % ordered.length]!.id;
}

export function shiftOutputTarget(currentLayout: LayoutId, currentSlotId: SlotId, step: number): SlotId {
  const ordered = currentLayout === "single" ? slotIds : visibleSlotIds(currentLayout, currentSlotId);
  const currentIndex = ordered.indexOf(currentSlotId);
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const normalizedStep = ((step % ordered.length) + ordered.length) % ordered.length;
  return ordered[(baseIndex + normalizedStep) % ordered.length] ?? ordered[0]!;
}
