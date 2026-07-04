import { assert, assertEquals } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import { createDefaultAsciiOptions } from "../app/ascii_options.ts";
import { createWorkbenchThreePanelFrameView } from "../app/workbench_three_panel.ts";
import type { ThreePanelGridRenderer, ThreeSceneState } from "../app/three_panel.ts";
import type { TerminalGlyphStyle } from "../src/three_ascii/glyphs.ts";
import type {
  ThreeAsciiRendererOptions,
  ThreeAsciiRendererPerformance,
  ThreeAsciiRenderFrameOptions,
} from "../src/three_ascii/renderer.ts";
import { WORKBENCH_THREE_READBACK_STRATEGY, WORKBENCH_THREE_RESCUE_CELLS } from "../app/workbench_three_policy.ts";

Deno.test("createWorkbenchThreePanelFrameView applies shared workbench Three defaults", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 48, height: 20 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal({ ...createDefaultAsciiOptions("sharp"), renderMaxCells: 960 });
  const interactive = new Signal(false);
  let renderer: FactoryGridRenderer | undefined;
  let readbackStrategy: ThreeAsciiRendererOptions["readbackStrategy"];

  const panel = createWorkbenchThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    interactive,
    frameInterval: 1,
    maxRenderCells: 960,
    rendererFactory: (options) => {
      readbackStrategy = options.readbackStrategy;
      renderer = new FactoryGridRenderer(options.columns, options.rows);
      return renderer;
    },
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) > 0);
    assert((renderer?.columns ?? 0) * (renderer?.rows ?? 0) <= WORKBENCH_THREE_RESCUE_CELLS);
    assertEquals(readbackStrategy, WORKBENCH_THREE_READBACK_STRATEGY);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    interactive.dispose();
  }
});

function sceneState(): ThreeSceneState {
  return {
    mode: "studio",
    signal: {
      x: 0.5,
      y: 0.5,
      depth: 0.5,
      twist: 0,
      lift: 0,
      pulse: 0.4,
      active: true,
      pressed: false,
    },
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for workbench Three panel factory test condition.");
}

class FactoryGridRenderer implements ThreePanelGridRenderer {
  renderCount = 0;
  private terminalEdgeBias = 1;
  private terminalGlyphStyle: TerminalGlyphStyle = "blocks";

  constructor(public columns: number, public rows: number) {}

  setSize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
  }

  setEffectOptions(): void {}

  setTerminalEdgeBias(value: number): void {
    this.terminalEdgeBias = value;
  }

  setTerminalGlyphStyle(value: TerminalGlyphStyle): void {
    this.terminalGlyphStyle = value;
  }

  async renderToAnsiGrid(): Promise<string[][]> {
    this.renderCount += 1;
    return this.grid();
  }

  async renderFrame(
    _deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
    _options?: ThreeAsciiRenderFrameOptions,
  ) {
    await onFrame?.(0.016);
    return { grid: await this.renderToAnsiGrid(), gridRevision: this.renderCount };
  }

  inspectPerformance(): ThreeAsciiRendererPerformance {
    return {
      totalMs: 1,
      initMs: 0,
      sceneMs: 1,
      sceneUpdateMs: 0,
      sceneRenderMs: 1,
      ansiMs: 0,
      readbackMs: 0,
      assemblyMs: 0,
      columns: this.columns,
      rows: this.rows,
      cells: this.columns * this.rows,
      terminalGlyphStyle: this.terminalGlyphStyle,
    };
  }

  destroy(): void {}

  private grid(): string[][] {
    return Array.from({ length: this.rows }, () => Array.from({ length: this.columns }, () => "█"));
  }
}
