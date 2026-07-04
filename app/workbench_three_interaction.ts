export interface WorkbenchThreeInteractivePanel {
  rotateBy(deltaColumns: number, deltaRows: number): unknown;
  zoomBy(scrollSteps: number): unknown;
}

export interface WorkbenchThreeViewportHit<TId extends string> {
  action: { type: "threeViewport"; id: TId } | { type: string };
}

export interface WorkbenchThreeMousePress {
  x: number;
  y: number;
  drag: boolean;
  release: boolean;
  movementX: number;
  movementY: number;
}

export interface WorkbenchThreeMouseScroll {
  x: number;
  y: number;
  scroll: number;
}

export interface WorkbenchThreeViewportInteractionOptions<TId extends string> {
  findHit: (x: number, y: number) => WorkbenchThreeViewportHit<TId> | undefined;
  panelForWindow: (id: TId) => WorkbenchThreeInteractivePanel | undefined;
  focusWindow: (id: TId) => void;
}

export interface WorkbenchThreePointerPressResult<TId extends string> {
  handled: boolean;
  dragWindow: TId | null;
}

/** Routes mouse drag and wheel events for workbench-hosted Three renderer viewports. */
export class WorkbenchThreeViewportInteractionController<TId extends string> {
  #dragWindow: TId | null = null;

  constructor(private readonly options: WorkbenchThreeViewportInteractionOptions<TId>) {}

  get dragWindow(): TId | null {
    return this.#dragWindow;
  }

  handlePress(event: WorkbenchThreeMousePress): WorkbenchThreePointerPressResult<TId> {
    if (event.release) {
      this.#dragWindow = null;
      return { handled: true, dragWindow: this.#dragWindow };
    }

    if (event.drag && this.#dragWindow) {
      if (this.rotateWindow(this.#dragWindow, event.movementX, event.movementY)) {
        return { handled: true, dragWindow: this.#dragWindow };
      }
      this.#dragWindow = null;
    }

    const hit = this.options.findHit(event.x, event.y);
    if (!isWorkbenchThreeViewportHit(hit)) {
      this.#dragWindow = null;
      return { handled: false, dragWindow: this.#dragWindow };
    }

    const id = hit.action.id;
    this.#dragWindow = id;
    this.options.focusWindow(id);
    if (event.drag) this.rotateWindow(id, event.movementX, event.movementY);
    return { handled: true, dragWindow: this.#dragWindow };
  }

  handleScroll(event: WorkbenchThreeMouseScroll): boolean {
    const hit = this.options.findHit(event.x, event.y);
    if (!isWorkbenchThreeViewportHit(hit)) return false;
    const panel = this.options.panelForWindow(hit.action.id);
    if (!panel) return false;
    panel.zoomBy(event.scroll);
    this.options.focusWindow(hit.action.id);
    return true;
  }

  rotateWindow(id: TId, movementX: number, movementY: number): boolean {
    const panel = this.options.panelForWindow(id);
    if (!panel) return false;
    panel.rotateBy(movementX, movementY);
    this.options.focusWindow(id);
    return true;
  }
}

function isWorkbenchThreeViewportHit<TId extends string>(
  hit: WorkbenchThreeViewportHit<TId> | undefined,
): hit is { action: { type: "threeViewport"; id: TId } } {
  return hit?.action.type === "threeViewport";
}
