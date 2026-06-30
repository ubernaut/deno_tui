// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { Rectangle } from "../types.ts";

/** Coordinate used for renderer-neutral hit testing. */
export interface OverlayPoint {
  column: number;
  row: number;
}

/** Size used when placing a popover around an anchor rectangle. */
export interface OverlaySize {
  width: number;
  height: number;
}

/** Coarse overlay layer. Larger layers are rendered and hit-tested above lower layers. */
export type OverlayLayer = "workspace" | "window" | "chrome" | "popover" | "modal" | "system";

/** Semantic surface kind for diagnostics and renderer-specific styling. */
export type OverlayKind =
  | "workspace"
  | "window"
  | "titlebar"
  | "shelf"
  | "tab"
  | "menu"
  | "popover"
  | "modal"
  | "toast"
  | "tooltip"
  | "custom";

/** Preferred popover placement relative to an anchor rectangle. */
export type PopoverPlacement =
  | "bottom-start"
  | "bottom-end"
  | "top-start"
  | "top-end"
  | "right-start"
  | "left-start"
  | "center";

/** Registered overlay surface. */
export interface OverlaySurface {
  id: string;
  rect: Rectangle;
  layer?: OverlayLayer;
  kind?: OverlayKind;
  zIndex?: number;
  order?: number;
  visible?: boolean;
  modal?: boolean;
  closeOnOutsideClick?: boolean;
  ownerId?: string;
}

/** Normalized overlay surface with deterministic z-order metadata. */
export interface OverlaySurfaceInspection extends Required<Omit<OverlaySurface, "ownerId">> {
  ownerId?: string;
}

/** Result of an overlay hit test. */
export interface OverlayHit {
  surface: OverlaySurfaceInspection;
  column: number;
  row: number;
  localColumn: number;
  localRow: number;
}

/** Result of processing a pointer press through an overlay stack. */
export interface OverlayPointerResult {
  hit?: OverlayHit;
  blockingModal?: OverlaySurfaceInspection;
  closedIds: string[];
}

/** Options for placing a popover around an anchor rectangle. */
export interface PopoverPlacementOptions {
  placement?: PopoverPlacement;
  gap?: number;
  margin?: number;
  allowFlip?: boolean;
}

/** Options for creating an overlay stack controller. */
export interface OverlayStackOptions {
  surfaces?: readonly OverlaySurface[];
  activeId?: string;
}

/** Serializable overlay stack state for diagnostics, tests, and renderers. */
export interface OverlayStackInspection {
  activeId?: string;
  surfaces: OverlaySurfaceInspection[];
  visible: OverlaySurfaceInspection[];
  zOrder: OverlaySurfaceInspection[];
  top?: OverlaySurfaceInspection;
}

const OVERLAY_LAYER_Z_INDEX: Record<OverlayLayer, number> = {
  workspace: 0,
  window: 1_000,
  chrome: 2_000,
  popover: 3_000,
  modal: 4_000,
  system: 5_000,
};

/** Returns the base z-index used by a semantic overlay layer. */
export function overlayLayerZIndex(layer: OverlayLayer): number {
  return OVERLAY_LAYER_Z_INDEX[layer];
}

/** Returns true when a point is inside a rectangle. Edges are left/top inclusive and right/bottom exclusive. */
export function pointInRect(point: OverlayPoint, rect: Rectangle): boolean {
  return point.column >= rect.column && point.column < rect.column + rect.width &&
    point.row >= rect.row && point.row < rect.row + rect.height;
}

/** Clamps a rectangle into bounds while preserving its requested size as much as possible. */
export function clampRectToBounds(rect: Rectangle, bounds: Rectangle, margin = 0): Rectangle {
  const safeMargin = Math.max(0, Math.floor(margin));
  const width = Math.max(0, Math.min(Math.floor(rect.width), Math.max(0, bounds.width - safeMargin * 2)));
  const height = Math.max(0, Math.min(Math.floor(rect.height), Math.max(0, bounds.height - safeMargin * 2)));
  const minColumn = bounds.column + safeMargin;
  const minRow = bounds.row + safeMargin;
  const maxColumn = bounds.column + bounds.width - safeMargin - width;
  const maxRow = bounds.row + bounds.height - safeMargin - height;
  return {
    column: Math.max(minColumn, Math.min(Math.floor(rect.column), maxColumn)),
    row: Math.max(minRow, Math.min(Math.floor(rect.row), maxRow)),
    width,
    height,
  };
}

/** Places a popover as an overlay without changing the surrounding layout flow. */
export function placePopover(
  anchor: Rectangle,
  size: OverlaySize,
  viewport: Rectangle,
  options: PopoverPlacementOptions = {},
): Rectangle {
  const placement = options.placement ?? "bottom-start";
  const gap = Math.max(0, Math.floor(options.gap ?? 1));
  const margin = Math.max(0, Math.floor(options.margin ?? 0));
  const rectSize = {
    width: Math.max(0, Math.floor(size.width)),
    height: Math.max(0, Math.floor(size.height)),
  };
  const primary = popoverRectForPlacement(anchor, rectSize, placement, gap);
  if (options.allowFlip ?? true) {
    const flipped = popoverRectForPlacement(anchor, rectSize, flippedPopoverPlacement(placement), gap);
    if (!rectInsideBounds(primary, viewport, margin) && rectInsideBounds(flipped, viewport, margin)) return flipped;
  }
  return clampRectToBounds(primary, viewport, margin);
}

/** Sorts surfaces from back to front using layer, z-index, and registration order. */
export function sortOverlaySurfaces(surfaces: readonly OverlaySurface[]): OverlaySurfaceInspection[] {
  return surfaces.map(normalizeOverlaySurface)
    .sort((left, right) => left.zIndex - right.zIndex || left.order - right.order || left.id.localeCompare(right.id));
}

/** Returns the topmost visible surface at a point, optionally respecting a modal blocker. */
export function hitTestOverlaySurfaces(
  surfaces: readonly OverlaySurface[],
  point: OverlayPoint,
  options: { respectModal?: boolean } = {},
): OverlayHit | undefined {
  const zOrder = sortOverlaySurfaces(surfaces).filter((surface) => surface.visible);
  const modal = options.respectModal === false ? undefined : topmostModal(zOrder);
  const candidates = modal
    ? zOrder.filter((surface) => surface.id === modal.id || surface.ownerId === modal.id)
    : zOrder;
  for (const surface of [...candidates].reverse()) {
    if (pointInRect(point, surface.rect)) return overlayHit(surface, point);
  }
  return undefined;
}

/** Controller for renderer-neutral overlay stacks, popovers, menus, and modal blockers. */
export class OverlayStackController {
  readonly surfaces: Signal<OverlaySurfaceInspection[]>;
  readonly activeId: Signal<string | undefined>;
  #nextOrder = 0;

  constructor(options: OverlayStackOptions = {}) {
    const surfaces = (options.surfaces ?? []).map((surface, index) => {
      this.#nextOrder = Math.max(this.#nextOrder, (surface.order ?? index) + 1);
      return normalizeOverlaySurface(surface, surface.order ?? index);
    });
    this.surfaces = new Signal(surfaces, { deepObserve: true });
    this.activeId = new Signal(options.activeId);
  }

  register(surface: OverlaySurface): OverlaySurfaceInspection {
    const existing = this.surfaces.peek().find((entry) => entry.id === surface.id);
    const next = normalizeOverlaySurface(surface, existing?.order ?? this.#nextOrder++);
    this.surfaces.value = existing
      ? this.surfaces.peek().map((entry) => entry.id === surface.id ? next : entry)
      : [...this.surfaces.peek(), next];
    if (next.visible) this.activeId.value = next.id;
    return next;
  }

  update(id: string, patch: Partial<OverlaySurface>): OverlaySurfaceInspection | undefined {
    const existing = this.surfaces.peek().find((entry) => entry.id === id);
    if (!existing) return undefined;
    const next = normalizeOverlaySurface({ ...existing, ...patch, id }, existing.order);
    this.surfaces.value = this.surfaces.peek().map((entry) => entry.id === id ? next : entry);
    return next;
  }

  open(id: string): OverlaySurfaceInspection | undefined {
    const surface = this.update(id, { visible: true });
    if (surface) this.bringToFront(id);
    return this.surface(id);
  }

  close(id: string): OverlaySurfaceInspection | undefined {
    const surface = this.surface(id);
    this.#closeSurfaceTree(id);
    return surface;
  }

  toggle(id: string): OverlaySurfaceInspection | undefined {
    const surface = this.surface(id);
    return surface?.visible ? this.close(id) : this.open(id);
  }

  remove(id: string): OverlaySurfaceInspection | undefined {
    const existing = this.surface(id);
    if (!existing) return undefined;
    this.surfaces.value = this.surfaces.peek().filter((entry) => entry.id !== id);
    if (this.activeId.peek() === id) this.activeId.value = this.top()?.id;
    return existing;
  }

  bringToFront(id: string): OverlaySurfaceInspection | undefined {
    const existing = this.surface(id);
    if (!existing) return undefined;
    const order = this.#nextOrder++;
    const next = normalizeOverlaySurface({ ...existing, order, zIndex: undefined }, order);
    this.surfaces.value = this.surfaces.peek().map((entry) => entry.id === id ? next : entry);
    this.activeId.value = id;
    return next;
  }

  surface(id: string): OverlaySurfaceInspection | undefined {
    return this.surfaces.peek().find((entry) => entry.id === id);
  }

  zOrder(): OverlaySurfaceInspection[] {
    return sortOverlaySurfaces(this.surfaces.peek()).filter((surface) => surface.visible);
  }

  top(): OverlaySurfaceInspection | undefined {
    return this.zOrder().at(-1);
  }

  topModal(): OverlaySurfaceInspection | undefined {
    return topmostModal(this.zOrder());
  }

  hitTest(point: OverlayPoint, options: { respectModal?: boolean } = {}): OverlayHit | undefined {
    return hitTestOverlaySurfaces(this.surfaces.peek(), point, options);
  }

  handlePointerDown(point: OverlayPoint): OverlayPointerResult {
    const zOrder = this.zOrder();
    const modal = topmostModal(zOrder);
    if (modal && !pointInRect(point, modal.rect)) {
      if (modal.closeOnOutsideClick) {
        return { blockingModal: modal, closedIds: this.#closeSurfaceTree(modal.id) };
      }
      return { blockingModal: modal, closedIds: [] };
    }

    const hit = this.hitTest(point, { respectModal: Boolean(modal) });
    if (hit) this.bringToFront(hit.surface.id);
    return { hit, blockingModal: modal, closedIds: [] };
  }

  inspect(): OverlayStackInspection {
    const surfaces = this.surfaces.peek().map((surface) => ({ ...surface, rect: { ...surface.rect } }));
    const visible = surfaces.filter((surface) => surface.visible);
    const zOrder = sortOverlaySurfaces(visible);
    const top = zOrder.at(-1);
    return {
      activeId: this.activeId.peek(),
      surfaces,
      visible,
      zOrder,
      top: top ? { ...top, rect: { ...top.rect } } : undefined,
    };
  }

  dispose(): void {
    this.surfaces.dispose();
    this.activeId.dispose();
  }

  #closeSurfaceTree(id: string): string[] {
    const ids = new Set([id, ...this.surfaces.peek().filter((entry) => entry.ownerId === id).map((entry) => entry.id)]);
    this.surfaces.value = this.surfaces.peek().map((entry) =>
      ids.has(entry.id) ? normalizeOverlaySurface({ ...entry, visible: false }, entry.order) : entry
    );
    if (this.activeId.peek() && ids.has(this.activeId.peek()!)) this.activeId.value = this.top()?.id;
    return [...ids];
  }
}

function normalizeOverlaySurface(
  surface: OverlaySurface,
  fallbackOrder = surface.order ?? 0,
): OverlaySurfaceInspection {
  const layer = surface.layer ?? defaultOverlayLayer(surface.kind);
  const order = Math.max(0, Math.floor(surface.order ?? fallbackOrder));
  const zIndex = Math.floor(surface.zIndex ?? overlayLayerZIndex(layer) + order);
  return {
    id: surface.id,
    rect: { ...surface.rect },
    layer,
    kind: surface.kind ?? "custom",
    zIndex,
    order,
    visible: surface.visible ?? true,
    modal: surface.modal ?? surface.kind === "modal",
    closeOnOutsideClick: surface.closeOnOutsideClick ?? false,
    ownerId: surface.ownerId,
  };
}

function defaultOverlayLayer(kind: OverlayKind | undefined): OverlayLayer {
  switch (kind) {
    case "workspace":
      return "workspace";
    case "window":
      return "window";
    case "titlebar":
    case "shelf":
    case "tab":
      return "chrome";
    case "menu":
    case "popover":
    case "tooltip":
      return "popover";
    case "modal":
      return "modal";
    case "toast":
      return "system";
    case "custom":
    case undefined:
      return "window";
  }
}

function overlayHit(surface: OverlaySurfaceInspection, point: OverlayPoint): OverlayHit {
  return {
    surface,
    column: point.column,
    row: point.row,
    localColumn: point.column - surface.rect.column,
    localRow: point.row - surface.rect.row,
  };
}

function topmostModal(surfaces: readonly OverlaySurfaceInspection[]): OverlaySurfaceInspection | undefined {
  return [...surfaces].reverse().find((surface) => surface.visible && surface.modal);
}

function popoverRectForPlacement(
  anchor: Rectangle,
  size: OverlaySize,
  placement: PopoverPlacement,
  gap: number,
): Rectangle {
  switch (placement) {
    case "bottom-start":
      return { column: anchor.column, row: anchor.row + anchor.height + gap, ...size };
    case "bottom-end":
      return { column: anchor.column + anchor.width - size.width, row: anchor.row + anchor.height + gap, ...size };
    case "top-start":
      return { column: anchor.column, row: anchor.row - size.height - gap, ...size };
    case "top-end":
      return { column: anchor.column + anchor.width - size.width, row: anchor.row - size.height - gap, ...size };
    case "right-start":
      return { column: anchor.column + anchor.width + gap, row: anchor.row, ...size };
    case "left-start":
      return { column: anchor.column - size.width - gap, row: anchor.row, ...size };
    case "center":
      return {
        column: anchor.column + Math.floor((anchor.width - size.width) / 2),
        row: anchor.row + Math.floor((anchor.height - size.height) / 2),
        ...size,
      };
  }
}

function flippedPopoverPlacement(placement: PopoverPlacement): PopoverPlacement {
  switch (placement) {
    case "bottom-start":
      return "top-start";
    case "bottom-end":
      return "top-end";
    case "top-start":
      return "bottom-start";
    case "top-end":
      return "bottom-end";
    case "right-start":
      return "left-start";
    case "left-start":
      return "right-start";
    case "center":
      return "center";
  }
}

function rectInsideBounds(rect: Rectangle, bounds: Rectangle, margin: number): boolean {
  return rect.column >= bounds.column + margin &&
    rect.row >= bounds.row + margin &&
    rect.column + rect.width <= bounds.column + bounds.width - margin &&
    rect.row + rect.height <= bounds.row + bounds.height - margin;
}
