import { assertEquals } from "./deps.ts";
import { ThreePanelGraphicsImageController } from "../app/three_panel_graphics.ts";
import { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import type {
  GraphicsDeleteMode,
  GraphicsHandle,
  GraphicsImage,
  GraphicsPlacement,
  GraphicsSurface,
  GraphicsSurfaceInspection,
} from "../src/runtime/graphics_surface.ts";
import type { ThreeAsciiImageFrame } from "../src/three_ascii/renderer.ts";

Deno.test("ThreePanelGraphicsImageController replaces and clears image handles", async () => {
  const surface = new FakeGraphicsSurface();
  let generation = 1;
  let disposed = false;
  const controller = new ThreePanelGraphicsImageController({
    currentGeneration: () => generation,
    disposed: () => disposed,
  });

  await controller.put(surface, imageFrame(), { column: 2, row: 3, width: 8, height: 4 }, generation);
  assertEquals(controller.hasHandle, true);
  assertEquals(surface.puts.length, 1);
  assertEquals(surface.puts[0]?.placement, { column: 2, row: 3, width: 8, height: 4, zIndex: 1 });

  await controller.put(surface, imageFrame(), { column: 4, row: 5, width: 6, height: 3 }, generation);
  assertEquals(surface.deleted.map((entry) => entry.mode), ["image"]);
  assertEquals(surface.puts.length, 2);
  assertEquals(controller.hasHandle, true);

  disposed = true;
  await controller.clear(surface);
  assertEquals(surface.deleted.length, 2);
  assertEquals(controller.hasHandle, false);
});

Deno.test("ThreePanelGraphicsImageController deletes stale frame handles and preserves current state", async () => {
  const surface = new FakeGraphicsSurface();
  let generation = 1;
  const controller = new ThreePanelGraphicsImageController({
    currentGeneration: () => generation,
    disposed: () => false,
  });

  generation = 2;
  await controller.put(surface, imageFrame(), { column: 0, row: 0, width: 4, height: 2 }, 1);

  assertEquals(surface.puts.length, 1);
  assertEquals(surface.deleted.length, 1);
  assertEquals(controller.hasHandle, false);
});

Deno.test("ThreePanelGraphicsImageController forgets handles even when no surface can clear them", async () => {
  const surface = new FakeGraphicsSurface();
  const controller = new ThreePanelGraphicsImageController({
    currentGeneration: () => 1,
    disposed: () => false,
  });

  await controller.put(surface, imageFrame(), { column: 0, row: 0, width: 4, height: 2 }, 1);
  await controller.clear(undefined);

  assertEquals(controller.hasHandle, false);
  assertEquals(surface.deleted.length, 0);
});

Deno.test("ThreePanelGraphicsImageController reports cleanup failures", async () => {
  const surface = new FakeGraphicsSurface();
  const diagnostics = new DiagnosticsCollector();
  const controller = new ThreePanelGraphicsImageController({
    diagnostics,
    currentGeneration: () => 1,
    disposed: () => false,
  });

  await controller.put(surface, imageFrame(), { column: 0, row: 0, width: 4, height: 2 }, 1);
  surface.failDeletes = true;
  await controller.clear(surface);

  assertEquals(diagnostics.entries().map((entry) => [entry.source, entry.code, entry.severity, entry.detail]), [
    ["three-panel", "graphics-delete-failed", "debug", "delete unavailable"],
  ]);
});

function imageFrame(): ThreeAsciiImageFrame {
  return {
    data: new Uint8Array([1, 2, 3, 4]),
    encoding: "bytes",
    format: 32,
    pixelWidth: 1,
    pixelHeight: 1,
  };
}

class FakeGraphicsSurface implements GraphicsSurface {
  readonly kind = "kitty" as const;
  readonly puts: Array<{ image: GraphicsImage; placement: GraphicsPlacement }> = [];
  readonly deleted: Array<{ handle: GraphicsHandle; mode?: GraphicsDeleteMode }> = [];
  failDeletes = false;
  private nextId = 1;

  async putImage(image: GraphicsImage, placement: GraphicsPlacement): Promise<GraphicsHandle> {
    this.puts.push({ image, placement });
    return {
      id: `kitty:${this.nextId}:1`,
      kind: this.kind,
      imageId: this.nextId++,
      placementId: 1,
      placement,
    };
  }

  async moveImage(): Promise<void> {}

  async deleteImage(handle: GraphicsHandle, mode?: GraphicsDeleteMode): Promise<void> {
    this.deleted.push({ handle, mode });
    if (this.failDeletes) throw new Error("delete unavailable");
  }

  async clear(): Promise<void> {}

  inspect(): GraphicsSurfaceInspection {
    return {
      kind: this.kind,
      available: true,
      handles: [],
      commandCount: this.puts.length + this.deleted.length,
      mode: "direct",
    };
  }
}
