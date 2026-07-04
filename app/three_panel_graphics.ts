import type { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import type { GraphicsHandle, GraphicsSurface } from "../src/runtime/graphics_surface.ts";
import type { ThreeAsciiImageFrame } from "../src/three_ascii/renderer.ts";
import type { Rect } from "./types.ts";

/** Owns the active raster graphics image handle for a workbench-hosted Three panel. */
export class ThreePanelGraphicsImageController {
  private handle?: GraphicsHandle;

  constructor(
    private readonly options: {
      diagnostics?: DiagnosticsCollector;
      currentGeneration: () => number;
      disposed: () => boolean;
    },
  ) {}

  get hasHandle(): boolean {
    return this.handle !== undefined;
  }

  /** Replaces the current image and deletes stale handles if the owning panel generation changes mid-publish. */
  async put(
    surface: GraphicsSurface,
    image: ThreeAsciiImageFrame,
    rect: Rect,
    frameGeneration: number,
  ): Promise<void> {
    if (this.options.disposed() || rect.width <= 0 || rect.height <= 0) return;
    if (this.handle) {
      await this.delete(surface, this.handle, "replace");
      this.handle = undefined;
    }
    const handle = await surface.putImage({
      data: image.data,
      encoding: image.encoding,
      format: image.format,
      pixelWidth: image.pixelWidth,
      pixelHeight: image.pixelHeight,
    }, {
      column: rect.column,
      row: rect.row,
      width: rect.width,
      height: rect.height,
      zIndex: 1,
    });
    if (this.options.disposed() || this.options.currentGeneration() !== frameGeneration) {
      await this.delete(surface, handle, "stale-frame");
      return;
    }
    this.handle = handle;
  }

  /** Deletes the current image handle if a graphics surface is available. */
  async clear(surface: GraphicsSurface | undefined): Promise<void> {
    const handle = this.handle;
    if (!handle) return;
    this.handle = undefined;
    if (!surface) return;
    await this.delete(surface, handle, "clear");
  }

  private async delete(
    surface: GraphicsSurface,
    handle: GraphicsHandle,
    reason: "replace" | "stale-frame" | "clear",
  ): Promise<void> {
    try {
      await surface.deleteImage(handle, "image");
    } catch (error) {
      this.options.diagnostics?.report({
        source: "three-panel",
        code: "graphics-delete-failed",
        severity: "debug",
        message: "Three panel graphics image cleanup failed",
        detail: error instanceof Error ? error.message : String(error),
        context: {
          reason,
          handleId: handle.id,
          surface: surface.kind,
        },
      });
    }
  }
}
