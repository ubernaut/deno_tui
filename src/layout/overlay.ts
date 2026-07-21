// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import { makeObjectPropertiesReactive } from "../signals/reactivity.ts";
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

/** Options for synchronizing focus from an owning overlay integration. */
export interface OverlayActiveIdSynchronizationOptions {
  /** Whether subscribers should be notified. Defaults to true. */
  propagate?: boolean;
}

/** Options for mutations performed by an owning overlay integration. */
export interface OverlayStackMutationOptions {
  /** Treat automatic focus repair as integration synchronization instead of host intent. */
  synchronizeFocus?: boolean;
}

/** Serializable overlay stack state for diagnostics, tests, and renderers. */
export interface OverlayStackInspection {
  activeId?: string;
  surfaces: OverlaySurfaceInspection[];
  visible: OverlaySurfaceInspection[];
  zOrder: OverlaySurfaceInspection[];
  top?: OverlaySurfaceInspection;
}

interface OverlayStackSnapshot {
  activeId?: string;
  nextOrder: number;
  surfaces: readonly OverlaySurfaceInspection[];
}

interface OverlayRegistrationInventory {
  readonly surfaces: readonly OverlaySurfaceInspection[];
  readonly byId: ReadonlyMap<string, OverlaySurfaceInspection>;
  readonly rollback: readonly OverlaySurfaceInspection[];
}

class OverlayActiveIdSignal extends Signal<string | undefined> {
  #externalMutationRevision = 0;
  #lastExternallyAssignedValue: string | undefined;

  override get value(): string | undefined {
    return super.value;
  }

  override set value(value: string | undefined) {
    this.#recordExternalAssignment(value);
    super.value = value;
  }

  override jink(value: string | undefined): void {
    this.#recordExternalAssignment(value);
    super.jink(value);
  }

  get externalMutationRevision(): number {
    return this.#externalMutationRevision;
  }

  get lastExternallyAssignedValue(): string | undefined {
    return this.#lastExternallyAssignedValue;
  }

  publishOwned(value: string | undefined, propagate: boolean): void {
    if (propagate) super.value = value;
    else super.jink(value);
  }

  #recordExternalAssignment(value: string | undefined): void {
    this.#lastExternallyAssignedValue = value;
    this.#externalMutationRevision = nextOpaqueRevision(this.#externalMutationRevision);
  }
}

const OVERLAY_LAYER_Z_INDEX: Record<OverlayLayer, number> = {
  workspace: 0,
  window: 1_000,
  chrome: 2_000,
  popover: 3_000,
  modal: 4_000,
  system: 5_000,
};

function nextOpaqueRevision(current: number): number {
  return current === Number.MAX_SAFE_INTEGER ? 0 : current + 1;
}

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
  const sorted: OverlaySurfaceInspection[] = [];
  for (let index = 0; index < surfaces.length; index += 1) {
    sorted.push(normalizeOverlaySurface(surfaces[index]!));
  }
  sorted.sort((left, right) =>
    left.zIndex - right.zIndex || left.order - right.order || left.id.localeCompare(right.id)
  );
  return sorted;
}

/** Returns the topmost visible surface at a point, optionally respecting a modal blocker. */
export function hitTestOverlaySurfaces(
  surfaces: readonly OverlaySurface[],
  point: OverlayPoint,
  options: { respectModal?: boolean } = {},
): OverlayHit | undefined {
  return hitTestSortedOverlaySurfaces(sortOverlaySurfaces(surfaces), point, options.respectModal);
}

/** Controller for renderer-neutral overlay stacks, popovers, menus, and modal blockers. */
export class OverlayStackController {
  readonly surfaces: Signal<OverlaySurfaceInspection[]>;
  readonly activeId: Signal<string | undefined>;
  readonly #surfacesSignal: OverlaySurfacesSignal;
  readonly #activeIdSignal: OverlayActiveIdSignal;
  #nextOrder = 0;
  #nextRegistrationGeneration = 1;
  #registrationGenerations = new Map<string, number>();
  #surfaceFocusIsSynchronized = false;
  #sortedSource?: readonly OverlaySurfaceInspection[];
  #sortedCache?: OverlaySurfaceInspection[];
  #visibleSource?: readonly OverlaySurfaceInspection[];
  #visibleCache?: OverlaySurfaceInspection[];

  constructor(options: OverlayStackOptions = {}) {
    const inputSurfaces = options.surfaces ?? [];
    const surfaces: OverlaySurfaceInspection[] = [];
    const ids = new Set<string>();
    for (let index = 0; index < inputSurfaces.length; index += 1) {
      const surface = inputSurfaces[index]!;
      const normalized = normalizeOverlaySurface(surface, surface.order ?? index);
      assertSnapshotSafeOverlaySurface(normalized, `Overlay surface ${index}`);
      if (ids.has(normalized.id)) {
        throw new TypeError(`Overlay stack contains duplicate surface id ${JSON.stringify(normalized.id)}.`);
      }
      ids.add(normalized.id);
      this.#nextOrder = advancedOverlayOrder(this.#nextOrder, normalized.order, false);
      surfaces.push(normalized);
      this.#registrationGenerations.set(normalized.id, this.#allocateRegistrationGeneration());
    }
    this.#surfacesSignal = new OverlaySurfacesSignal(
      surfaces,
      (current, next) => {
        this.#syncExternalRegistrationGenerations(current, next);
      },
      () => {
        this.#invalidateProjectionCaches();
        this.#repairExternalActiveId();
      },
    );
    this.surfaces = this.#surfacesSignal;
    this.#activeIdSignal = new OverlayActiveIdSignal(
      options.activeId && surfaces.some((surface) => surface.id === options.activeId) ? options.activeId : undefined,
    );
    this.activeId = this.#activeIdSignal;
  }

  register(
    surface: OverlaySurface,
    options: OverlayStackMutationOptions = {},
  ): OverlaySurfaceInspection {
    const source = this.surfaces.peek();
    const existing = findOverlaySurface(source, surface.id);
    if (!existing) assertOverlayOrderAvailable(this.#nextOrder);
    const next = normalizeOverlaySurface(surface, existing?.order ?? this.#nextOrder);
    assertSnapshotSafeOverlaySurface(next, "Registered overlay surface");
    const nextOrder = advancedOverlayOrder(this.#nextOrder, next.order, !existing);
    const generation = this.#allocateRegistrationGeneration();
    this.#registrationGenerations.set(next.id, generation);
    this.#nextOrder = nextOrder;
    const nextSurfaces = existing
      ? replaceOverlaySurface(source, surface.id, next)
      : appendOverlaySurface(source, next);
    try {
      this.#publishSurfaces(nextSurfaces, options);
    } finally {
      if (next.visible) this.#setActiveIdCanonical(next.id, options.synchronizeFocus);
    }
    return next;
  }

  update(
    id: string,
    patch: Partial<OverlaySurface>,
    options: OverlayStackMutationOptions = {},
  ): OverlaySurfaceInspection | undefined {
    const source = this.surfaces.peek();
    const existing = findOverlaySurface(source, id);
    if (!existing) return undefined;
    const next = normalizeOverlaySurface({ ...existing, ...patch, id }, existing.order);
    assertSnapshotSafeOverlaySurface(next, "Updated overlay surface");
    const nextOrder = advancedOverlayOrder(this.#nextOrder, next.order, false);
    this.#nextOrder = nextOrder;
    this.#publishSurfaces(replaceOverlaySurface(source, id, next), options);
    return next;
  }

  open(id: string, options: OverlayStackMutationOptions = {}): OverlaySurfaceInspection | undefined {
    const surface = this.update(id, { visible: true }, options);
    if (surface) this.bringToFront(id, options);
    return this.surface(id);
  }

  close(id: string, options: OverlayStackMutationOptions = {}): OverlaySurfaceInspection | undefined {
    const surface = this.surface(id);
    this.#closeSurfaceTree(id, options);
    return surface;
  }

  toggle(id: string, options: OverlayStackMutationOptions = {}): OverlaySurfaceInspection | undefined {
    const surface = this.surface(id);
    return surface?.visible ? this.close(id, options) : this.open(id, options);
  }

  remove(id: string, options: OverlayStackMutationOptions = {}): OverlaySurfaceInspection | undefined {
    const existing = this.surface(id);
    if (!existing) return undefined;
    this.#registrationGenerations.delete(id);
    const next = removeOverlaySurface(this.surfaces.peek(), id);
    const nextActiveId = this.activeId.peek() === id ? topVisibleOverlayId(next) : this.activeId.peek();
    try {
      this.#publishSurfaces(next, options);
    } finally {
      this.#setActiveIdCanonical(nextActiveId, options.synchronizeFocus);
    }
    return existing;
  }

  bringToFront(id: string, options: OverlayStackMutationOptions = {}): OverlaySurfaceInspection | undefined {
    const existing = this.surface(id);
    if (!existing) return undefined;
    const order = this.#allocateOrder();
    const next = normalizeOverlaySurface({ ...existing, order, zIndex: undefined }, order);
    try {
      this.#publishSurfaces(replaceOverlaySurface(this.surfaces.peek(), id, next), options);
    } finally {
      this.#setActiveIdCanonical(id, options.synchronizeFocus);
    }
    return next;
  }

  surface(id: string): OverlaySurfaceInspection | undefined {
    return findOverlaySurface(this.surfaces.peek(), id);
  }

  /** Opaque generation that changes whenever an id is registered or replaced. */
  registrationGeneration(id: string): number | undefined {
    return this.#registrationGenerations.get(id);
  }

  /**
   * Opaque revision that changes whenever a host directly assigns `activeId`.
   * Owning integrations can use it to preserve focus changes that race with a
   * transactional stack restoration.
   */
  activeMutationRevision(): number {
    return this.#activeIdSignal.externalMutationRevision;
  }

  /** Returns the last focus value directly assigned by a host. */
  lastExternallyAssignedActiveId(): string | undefined {
    return this.#activeIdSignal.lastExternallyAssignedValue;
  }

  /**
   * Synchronizes focus from an owning integration without classifying the
   * assignment as a competing host focus change.
   */
  synchronizeActiveId(
    activeId?: string,
    options: OverlayActiveIdSynchronizationOptions = {},
  ): void {
    const canonical = activeId === undefined
      ? undefined
      : activeId && this.surface(activeId)
      ? activeId
      : topVisibleOverlayId(this.surfaces.peek());
    this.#activeIdSignal.publishOwned(canonical, options.propagate ?? true);
  }

  zOrder(): OverlaySurfaceInspection[] {
    const source = this.#visibleZOrder();
    const zOrder: OverlaySurfaceInspection[] = [];
    for (let index = 0; index < source.length; index += 1) zOrder.push(source[index]!);
    return zOrder;
  }

  top(): OverlaySurfaceInspection | undefined {
    const zOrder = this.#visibleZOrder();
    return zOrder[zOrder.length - 1];
  }

  topModal(): OverlaySurfaceInspection | undefined {
    return topmostModal(this.#visibleZOrder());
  }

  hitTest(point: OverlayPoint, options: { respectModal?: boolean } = {}): OverlayHit | undefined {
    return hitTestSortedOverlaySurfaces(this.#sortedZOrder(), point, options.respectModal);
  }

  handlePointerDown(point: OverlayPoint): OverlayPointerResult {
    const zOrder = this.#visibleZOrder();
    const modal = topmostModal(zOrder);
    const modalTreeIds = modal ? collectVisibleOverlayTreeIds(zOrder, modal.id) : undefined;
    const insideModalTree = modal && modalTreeIds
      ? zOrder.some((surface) => modalTreeIds.has(surface.id) && pointInRect(point, surface.rect))
      : false;
    if (modal && !insideModalTree) {
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
    const source = this.surfaces.peek();
    const surfaces = new Array<OverlaySurfaceInspection>(source.length);
    for (let index = 0; index < source.length; index += 1) {
      const surface = source[index]!;
      surfaces[index] = cloneOverlaySurface(surface);
    }
    const visible: OverlaySurfaceInspection[] = [];
    for (const surface of source) {
      if (surface.visible) visible.push(cloneOverlaySurface(surface));
    }
    const zOrderSource = this.#visibleZOrder();
    const zOrder = new Array<OverlaySurfaceInspection>(zOrderSource.length);
    for (let index = 0; index < zOrderSource.length; index += 1) {
      const surface = zOrderSource[index]!;
      zOrder[index] = cloneOverlaySurface(surface);
    }
    const top = zOrder[zOrder.length - 1];
    return {
      activeId: this.activeId.peek(),
      surfaces,
      visible,
      zOrder,
      top: top ? cloneOverlaySurface(top) : undefined,
    };
  }

  /** Captures the complete clone-safe state required for deterministic restoration. */
  snapshot(): Readonly<{
    activeId?: string;
    nextOrder: number;
    surfaces: readonly OverlaySurfaceInspection[];
  }> {
    const surfaces = this.surfaces.peek();
    const activeId = this.activeId.peek();
    return freezeOverlayStackSnapshot({
      activeId: activeId && findOverlaySurface(surfaces, activeId) ? activeId : undefined,
      nextOrder: this.#nextOrder,
      surfaces,
    });
  }

  /** Replaces the complete stack from a strictly validated snapshot. */
  restoreSnapshot(snapshot: unknown, options: OverlayStackMutationOptions = {}): void {
    const restored = normalizeOverlayStackSnapshot(snapshot);
    const current = this.surfaces.peek();
    const generations = new Map<string, number>();
    for (const surface of restored.surfaces) {
      const existing = findOverlaySurface(current, surface.id);
      const existingGeneration = this.#registrationGenerations.get(surface.id);
      generations.set(
        surface.id,
        existing && existingGeneration !== undefined && sameOverlayRegistrationIdentity(existing, surface)
          ? existingGeneration
          : this.#allocateRegistrationGeneration(),
      );
    }
    this.#nextOrder = restored.nextOrder;
    this.#registrationGenerations = generations;
    try {
      this.#publishSurfaces(restored.surfaces.map(cloneOverlaySurface), options);
    } finally {
      this.#setActiveIdCanonical(restored.activeId, options.synchronizeFocus);
    }
  }

  dispose(): void {
    this.#registrationGenerations.clear();
    this.surfaces.dispose();
    this.activeId.dispose();
  }

  #allocateOrder(): number {
    assertOverlayOrderAvailable(this.#nextOrder);
    const order = this.#nextOrder;
    this.#nextOrder = order + 1;
    return order;
  }

  #allocateRegistrationGeneration(): number {
    if (!Number.isSafeInteger(this.#nextRegistrationGeneration)) {
      throw new RangeError("Overlay registration generation space exhausted.");
    }
    return this.#nextRegistrationGeneration++;
  }

  #closeSurfaceTree(id: string, options: OverlayStackMutationOptions = {}): string[] {
    const source = this.surfaces.peek();
    const closedIds = collectOverlayTreeIds(source, id);
    const ids = new Set(closedIds);
    const next = new Array<OverlaySurfaceInspection>(source.length);
    for (let index = 0; index < source.length; index += 1) {
      const entry = source[index]!;
      next[index] = ids.has(entry.id) ? normalizeOverlaySurface({ ...entry, visible: false }, entry.order) : entry;
    }
    const activeId = this.activeId.peek();
    const nextActiveId = activeId && ids.has(activeId) ? topVisibleOverlayId(next) : activeId;
    try {
      this.#publishSurfaces(next, options);
    } finally {
      this.#setActiveIdCanonical(nextActiveId, options.synchronizeFocus);
    }
    return closedIds;
  }

  #syncExternalRegistrationGenerations(
    current: OverlayRegistrationInventory,
    next: OverlayRegistrationInventory,
  ): void {
    assertSnapshotSafeOverlayInventory(next.surfaces, "Externally assigned overlay surfaces");
    const generations = new Map(this.#registrationGenerations);
    let nextGeneration = this.#nextRegistrationGeneration;
    let nextOrder = this.#nextOrder;
    for (const id of [...generations.keys()]) {
      if (!next.byId.has(id)) generations.delete(id);
    }
    for (const [id, surface] of next.byId) {
      nextOrder = advancedOverlayOrder(nextOrder, surface.order, false);
      if (current.byId.get(id) === surface && generations.has(id)) continue;
      if (!Number.isSafeInteger(nextGeneration)) {
        throw new RangeError("Overlay registration generation space exhausted.");
      }
      generations.set(id, nextGeneration++);
    }
    this.#registrationGenerations = generations;
    this.#nextRegistrationGeneration = nextGeneration;
    this.#nextOrder = nextOrder;
  }

  #repairExternalActiveId(): void {
    const activeId = this.activeId.peek();
    if (!activeId || this.surface(activeId)) return;
    this.#setActiveIdCanonical(activeId, this.#surfaceFocusIsSynchronized);
  }

  #setActiveIdCanonical(activeId?: string, synchronizeFocus = false): void {
    const canonical = activeId === undefined
      ? undefined
      : activeId && this.surface(activeId)
      ? activeId
      : topVisibleOverlayId(this.surfaces.peek());
    if (synchronizeFocus) this.#activeIdSignal.publishOwned(canonical, true);
    else this.#activeIdSignal.value = canonical;
  }

  #publishSurfaces(
    next: OverlaySurfaceInspection[],
    options: OverlayStackMutationOptions = {},
  ): void {
    const previous = this.#surfaceFocusIsSynchronized;
    this.#surfaceFocusIsSynchronized = options.synchronizeFocus ?? false;
    try {
      this.#surfacesSignal.publishOwned(next);
    } finally {
      this.#surfaceFocusIsSynchronized = previous;
    }
  }

  #invalidateProjectionCaches(): void {
    this.#sortedSource = undefined;
    this.#sortedCache = undefined;
    this.#visibleSource = undefined;
    this.#visibleCache = undefined;
  }

  #sortedZOrder(): readonly OverlaySurfaceInspection[] {
    const source = this.surfaces.peek();
    if (this.#sortedSource !== source) {
      this.#sortedSource = source;
      this.#sortedCache = sortOverlaySurfaces(source);
      this.#visibleSource = undefined;
      this.#visibleCache = undefined;
    }
    return this.#sortedCache ?? [];
  }

  #visibleZOrder(): readonly OverlaySurfaceInspection[] {
    const source = this.surfaces.peek();
    if (this.#visibleSource !== source) {
      const sorted = this.#sortedZOrder();
      const visible: OverlaySurfaceInspection[] = [];
      for (const surface of sorted) {
        if (surface.visible) visible.push(surface);
      }
      this.#visibleSource = source;
      this.#visibleCache = visible;
    }
    return this.#visibleCache ?? [];
  }
}

class OverlaySurfacesSignal extends Signal<OverlaySurfaceInspection[]> {
  readonly #beforeReplace: (
    current: OverlayRegistrationInventory,
    next: OverlayRegistrationInventory,
  ) => void;
  readonly #afterReplace: () => void;
  readonly #reactiveTargets = new WeakMap<object, object>();
  #observed: OverlayRegistrationInventory;

  constructor(
    value: OverlaySurfaceInspection[],
    beforeReplace: (
      current: OverlayRegistrationInventory,
      next: OverlayRegistrationInventory,
    ) => void,
    afterReplace: () => void,
  ) {
    super(value);
    this.#beforeReplace = beforeReplace;
    this.#afterReplace = afterReplace;
    this.$value = this.#prepareSurfaces(value);
    this.#observed = captureOverlayRegistrationInventory(this.peek());
  }

  override get value(): OverlaySurfaceInspection[] {
    return super.value;
  }

  override set value(value: OverlaySurfaceInspection[]) {
    const next = this.#prepareSurfaces(value);
    const nextObserved = captureOverlayRegistrationInventory(next);
    this.#beforeReplace(this.#observed, nextObserved);
    this.#observed = nextObserved;
    try {
      super.value = next;
    } finally {
      this.#observed = captureOverlayRegistrationInventory(this.peek());
      this.#afterReplace();
    }
  }

  override jink(value: OverlaySurfaceInspection[]): void {
    const next = this.#prepareSurfaces(value);
    const nextObserved = captureOverlayRegistrationInventory(next);
    this.#beforeReplace(this.#observed, nextObserved);
    this.#observed = nextObserved;
    super.jink(next);
    this.#afterReplace();
  }

  override propagate(): void {
    try {
      this.#prepareNestedSurfaces(this.peek());
      const nextObserved = captureOverlayRegistrationInventory(this.peek());
      this.#beforeReplace(this.#observed, nextObserved);
      this.#observed = nextObserved;
      this.#afterReplace();
    } catch (error) {
      const restored = this.#prepareSurfaces(this.#observed.rollback.map(cloneOverlaySurface));
      super.jink(restored);
      this.#observed = captureOverlayRegistrationInventory(restored);
      this.#afterReplace();
      throw error;
    }
    super.propagate();
  }

  publishOwned(value: OverlaySurfaceInspection[]): void {
    const next = this.#prepareSurfaces(value);
    this.#observed = captureOverlayRegistrationInventory(next);
    try {
      super.value = next;
    } finally {
      this.#observed = captureOverlayRegistrationInventory(this.peek());
      this.#afterReplace();
    }
  }

  #prepareSurfaces(value: OverlaySurfaceInspection[]): OverlaySurfaceInspection[] {
    const knownTarget = this.#reactiveTargets.get(value) as OverlaySurfaceInspection[] | undefined;
    if (knownTarget) {
      this.#prepareNestedSurfaces(value);
      return value;
    }

    const raw = [...value];
    for (let index = 0; index < raw.length; index += 1) {
      raw[index] = this.#prepareSurface(raw[index]!);
    }
    const reactive = makeObjectPropertiesReactive(raw, this);
    this.#reactiveTargets.set(reactive, raw);
    return reactive;
  }

  #prepareNestedSurfaces(surfaces: OverlaySurfaceInspection[]): void {
    const raw = (this.#reactiveTargets.get(surfaces) ?? surfaces) as OverlaySurfaceInspection[];
    for (let index = 0; index < surfaces.length; index += 1) {
      raw[index] = this.#prepareSurface(surfaces[index]!);
    }
  }

  #prepareSurface(surface: OverlaySurfaceInspection): OverlaySurfaceInspection {
    const knownTarget = this.#reactiveTargets.get(surface) as OverlaySurfaceInspection | undefined;
    if (knownTarget) {
      knownTarget.rect = this.#prepareRect(surface.rect);
      return surface;
    }

    const raw = { ...surface };
    raw.rect = this.#prepareRect(raw.rect);
    const reactive = makeObjectPropertiesReactive(raw, this);
    this.#reactiveTargets.set(reactive, raw);
    return reactive;
  }

  #prepareRect(rect: Rectangle): Rectangle {
    const knownTarget = this.#reactiveTargets.get(rect);
    if (knownTarget) return rect;
    const raw = { ...rect };
    const reactive = makeObjectPropertiesReactive(raw, this);
    this.#reactiveTargets.set(reactive, raw);
    return reactive;
  }
}

function captureOverlayRegistrationInventory(
  surfaces: readonly OverlaySurfaceInspection[],
): OverlayRegistrationInventory {
  return {
    surfaces: [...surfaces],
    byId: new Map(surfaces.map((surface) => [surface.id, surface])),
    rollback: surfaces.map(cloneOverlaySurface),
  };
}

function hitTestSortedOverlaySurfaces(
  zOrder: readonly OverlaySurfaceInspection[],
  point: OverlayPoint,
  respectModal?: boolean,
): OverlayHit | undefined {
  const modal = respectModal === false ? undefined : topmostModal(zOrder);
  const modalTreeIds = modal ? collectVisibleOverlayTreeIds(zOrder, modal.id) : undefined;
  for (let index = zOrder.length - 1; index >= 0; index -= 1) {
    const surface = zOrder[index]!;
    if (!surface.visible) continue;
    if (modalTreeIds && !modalTreeIds.has(surface.id)) continue;
    if (pointInRect(point, surface.rect)) return overlayHit(surface, point);
  }
  return undefined;
}

function collectOverlayTreeIds(
  surfaces: readonly OverlaySurfaceInspection[],
  rootId: string,
  visibleOnly = false,
): string[] {
  const children = new Map<string, string[]>();
  for (const surface of surfaces) {
    if (!surface.ownerId || (visibleOnly && !surface.visible)) continue;
    const owned = children.get(surface.ownerId);
    if (owned) owned.push(surface.id);
    else children.set(surface.ownerId, [surface.id]);
  }
  const ids = new Set([rootId]);
  const ordered = [rootId];
  for (let index = 0; index < ordered.length; index += 1) {
    for (const childId of children.get(ordered[index]!) ?? []) {
      if (ids.has(childId)) continue;
      ids.add(childId);
      ordered.push(childId);
    }
  }
  return ordered;
}

function collectVisibleOverlayTreeIds(
  surfaces: readonly OverlaySurfaceInspection[],
  rootId: string,
): Set<string> {
  return new Set(collectOverlayTreeIds(surfaces, rootId, true));
}

function topVisibleOverlayId(surfaces: readonly OverlaySurfaceInspection[]): string | undefined {
  const visible = sortOverlaySurfaces(surfaces).filter((surface) => surface.visible);
  return visible[visible.length - 1]?.id;
}

function assertSnapshotSafeOverlayInventory(
  surfaces: readonly OverlaySurfaceInspection[],
  label: string,
): void {
  const ids = new Set<string>();
  for (let index = 0; index < surfaces.length; index += 1) {
    const surface = surfaces[index]!;
    assertSnapshotSafeOverlaySurface(surface, `${label} entry ${index}`);
    if (ids.has(surface.id)) throw new TypeError(`${label} contains duplicate id ${JSON.stringify(surface.id)}.`);
    ids.add(surface.id);
  }
}

function assertSnapshotSafeOverlaySurface(surface: OverlaySurfaceInspection, label: string): void {
  if (typeof surface.id !== "string") throw new TypeError(`${label} id must be a string.`);
  if (!isOverlayLayer(surface.layer)) throw new TypeError(`${label} layer is invalid.`);
  if (!isOverlayKind(surface.kind)) throw new TypeError(`${label} kind is invalid.`);
  if (!Number.isSafeInteger(surface.zIndex)) throw new TypeError(`${label} zIndex must be a safe integer.`);
  if (!Number.isSafeInteger(surface.order) || surface.order < 0 || surface.order >= Number.MAX_SAFE_INTEGER) {
    throw new TypeError(`${label} order must be a bounded non-negative safe integer.`);
  }
  for (const [name, value] of Object.entries(surface.rect)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(`${label} rect ${name} must be finite.`);
    }
  }
  if (typeof surface.visible !== "boolean" || typeof surface.modal !== "boolean") {
    throw new TypeError(`${label} visibility and modal flags must be boolean.`);
  }
  if (typeof surface.closeOnOutsideClick !== "boolean") {
    throw new TypeError(`${label} closeOnOutsideClick must be boolean.`);
  }
  if (surface.ownerId !== undefined && typeof surface.ownerId !== "string") {
    throw new TypeError(`${label} ownerId must be a string when present.`);
  }
}

function findOverlaySurface(
  surfaces: readonly OverlaySurfaceInspection[],
  id: string,
): OverlaySurfaceInspection | undefined {
  for (let index = 0; index < surfaces.length; index += 1) {
    const surface = surfaces[index]!;
    if (surface.id === id) return surface;
  }
  return undefined;
}

function replaceOverlaySurface(
  surfaces: readonly OverlaySurfaceInspection[],
  id: string,
  next: OverlaySurfaceInspection,
): OverlaySurfaceInspection[] {
  const replaced = new Array<OverlaySurfaceInspection>(surfaces.length);
  for (let index = 0; index < surfaces.length; index += 1) {
    const surface = surfaces[index]!;
    replaced[index] = surface.id === id ? next : surface;
  }
  return replaced;
}

function appendOverlaySurface(
  surfaces: readonly OverlaySurfaceInspection[],
  surface: OverlaySurfaceInspection,
): OverlaySurfaceInspection[] {
  const next = new Array<OverlaySurfaceInspection>(surfaces.length + 1);
  for (let index = 0; index < surfaces.length; index += 1) next[index] = surfaces[index]!;
  next[surfaces.length] = surface;
  return next;
}

function removeOverlaySurface(
  surfaces: readonly OverlaySurfaceInspection[],
  id: string,
): OverlaySurfaceInspection[] {
  let count = 0;
  for (let index = 0; index < surfaces.length; index += 1) {
    if (surfaces[index]!.id !== id) count += 1;
  }
  const next = new Array<OverlaySurfaceInspection>(count);
  let write = 0;
  for (let index = 0; index < surfaces.length; index += 1) {
    const surface = surfaces[index]!;
    if (surface.id === id) continue;
    next[write++] = surface;
  }
  return next;
}

function cloneOverlaySurface(surface: OverlaySurfaceInspection): OverlaySurfaceInspection {
  return { ...surface, rect: { ...surface.rect } };
}

function freezeOverlayStackSnapshot(snapshot: OverlayStackSnapshot): Readonly<OverlayStackSnapshot> {
  const surfaces = snapshot.surfaces.map((surface) =>
    Object.freeze({
      ...surface,
      rect: Object.freeze({ ...surface.rect }),
    })
  );
  return Object.freeze({
    activeId: snapshot.activeId,
    nextOrder: snapshot.nextOrder,
    surfaces: Object.freeze(surfaces),
  });
}

function normalizeOverlayStackSnapshot(value: unknown): Readonly<OverlayStackSnapshot> {
  const snapshot = strictRecord(
    value,
    ["activeId", "nextOrder", "surfaces"],
    ["nextOrder", "surfaces"],
    "overlay stack snapshot",
  );
  const nextOrder = strictNonNegativeInteger(snapshot.nextOrder, "overlay stack snapshot nextOrder");
  if (!Array.isArray(snapshot.surfaces)) {
    throw new TypeError("Overlay stack snapshot surfaces must be an array.");
  }
  assertPlainArray(snapshot.surfaces, "overlay stack snapshot surfaces");

  const surfaces: OverlaySurfaceInspection[] = [];
  const ids = new Set<string>();
  let maxOrder = -1;
  for (let index = 0; index < snapshot.surfaces.length; index += 1) {
    const surface = normalizeOverlaySnapshotSurface(snapshot.surfaces[index], index);
    if (ids.has(surface.id)) {
      throw new TypeError(`Overlay stack snapshot contains duplicate surface id ${JSON.stringify(surface.id)}.`);
    }
    ids.add(surface.id);
    maxOrder = Math.max(maxOrder, surface.order);
    surfaces.push(surface);
  }

  if (surfaces.length > 0 && nextOrder <= maxOrder) {
    throw new RangeError("Overlay stack snapshot nextOrder must be greater than every surface order.");
  }

  const activeId = snapshot.activeId;
  if (activeId !== undefined && typeof activeId !== "string") {
    throw new TypeError("Overlay stack snapshot activeId must be a string when present.");
  }
  if (activeId !== undefined && !ids.has(activeId)) {
    throw new TypeError(`Overlay stack snapshot activeId ${JSON.stringify(activeId)} is not registered.`);
  }
  return freezeOverlayStackSnapshot({ activeId, nextOrder, surfaces });
}

function normalizeOverlaySnapshotSurface(value: unknown, index: number): OverlaySurfaceInspection {
  const label = `overlay stack snapshot surface ${index}`;
  const surface = strictRecord(
    value,
    [
      "id",
      "rect",
      "layer",
      "kind",
      "zIndex",
      "order",
      "visible",
      "modal",
      "closeOnOutsideClick",
      "ownerId",
    ],
    ["id", "rect", "layer", "kind", "zIndex", "order", "visible", "modal", "closeOnOutsideClick"],
    label,
  );
  if (typeof surface.id !== "string") throw new TypeError(`${label} id must be a string.`);
  if (!isOverlayLayer(surface.layer)) throw new TypeError(`${label} layer is invalid.`);
  if (!isOverlayKind(surface.kind)) throw new TypeError(`${label} kind is invalid.`);
  if (surface.ownerId !== undefined && typeof surface.ownerId !== "string") {
    throw new TypeError(`${label} ownerId must be a string when present.`);
  }
  const rect = strictRecord(
    surface.rect,
    ["column", "row", "width", "height"],
    ["column", "row", "width", "height"],
    `${label} rect`,
  );
  return {
    id: surface.id,
    rect: {
      column: strictFiniteNumber(rect.column, `${label} rect column`),
      row: strictFiniteNumber(rect.row, `${label} rect row`),
      width: strictFiniteNumber(rect.width, `${label} rect width`),
      height: strictFiniteNumber(rect.height, `${label} rect height`),
    },
    layer: surface.layer,
    kind: surface.kind,
    zIndex: strictInteger(surface.zIndex, `${label} zIndex`),
    order: strictNonNegativeInteger(surface.order, `${label} order`),
    visible: strictBoolean(surface.visible, `${label} visible`),
    modal: strictBoolean(surface.modal, `${label} modal`),
    closeOnOutsideClick: strictBoolean(surface.closeOnOutsideClick, `${label} closeOnOutsideClick`),
    ownerId: surface.ownerId,
  };
}

function strictRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label} must be a plain object.`);
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedKeys);
  const ownKeys = Reflect.ownKeys(record);
  for (const key of ownKeys) {
    if (typeof key !== "string" || !allowed.has(key)) throw new TypeError(`${label} has an unexpected property.`);
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${label} properties must be enumerable data properties.`);
    }
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(record, key)) throw new TypeError(`${label} is missing property ${JSON.stringify(key)}.`);
  }
  return record;
}

function assertPlainArray(value: unknown[], label: string): void {
  if (Object.getPrototypeOf(value) !== Array.prototype) throw new TypeError(`${label} must be a plain array.`);
  const keys = Reflect.ownKeys(value);
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    if (!Object.hasOwn(value, key)) throw new TypeError(`${label} must not contain holes.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${label} entries must be enumerable data properties.`);
    }
  }
  for (const key of keys) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
      throw new TypeError(`${label} has an unexpected property.`);
    }
  }
}

function strictFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

function strictInteger(value: unknown, label: string): number {
  const number = strictFiniteNumber(value, label);
  if (!Number.isSafeInteger(number)) throw new TypeError(`${label} must be a safe integer.`);
  return number;
}

function strictNonNegativeInteger(value: unknown, label: string): number {
  const number = strictInteger(value, label);
  if (number < 0) throw new TypeError(`${label} must be non-negative.`);
  return number;
}

function strictBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be a boolean.`);
  return value;
}

function advancedOverlayOrder(current: number, surfaceOrder: number, consume: boolean): number {
  if (!Number.isSafeInteger(current) || current < 0) {
    throw new RangeError("Overlay next-order allocator is outside the safe integer range.");
  }
  if (!Number.isSafeInteger(surfaceOrder) || surfaceOrder < 0 || surfaceOrder >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Overlay surface order cannot leave room for a safe next-order allocation.");
  }
  if (consume) assertOverlayOrderAvailable(current);
  const consumedOrder = consume ? current + 1 : current;
  return Math.max(consumedOrder, surfaceOrder + 1);
}

function assertOverlayOrderAvailable(nextOrder: number): void {
  if (!Number.isSafeInteger(nextOrder) || nextOrder < 0 || nextOrder >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Overlay order allocator is exhausted.");
  }
}

function isOverlayLayer(value: unknown): value is OverlayLayer {
  return value === "workspace" || value === "window" || value === "chrome" || value === "popover" ||
    value === "modal" || value === "system";
}

function isOverlayKind(value: unknown): value is OverlayKind {
  return value === "workspace" || value === "window" || value === "titlebar" || value === "shelf" ||
    value === "tab" || value === "menu" || value === "popover" || value === "modal" || value === "toast" ||
    value === "tooltip" || value === "custom";
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

function sameOverlayRegistrationIdentity(
  left: OverlaySurfaceInspection,
  right: OverlaySurfaceInspection,
): boolean {
  return left.id === right.id && left.layer === right.layer && left.kind === right.kind &&
    left.modal === right.modal && left.ownerId === right.ownerId;
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
  for (let index = surfaces.length - 1; index >= 0; index -= 1) {
    const surface = surfaces[index]!;
    if (surface.visible && surface.modal) return surface;
  }
  return undefined;
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
