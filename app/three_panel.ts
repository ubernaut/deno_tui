import { type Canvas } from "../src/canvas/canvas.ts";
import { ThreeAsciiObject } from "../src/canvas/three_ascii.ts";
import { Effect, Signal, type SignalOfObject } from "../src/signals/mod.ts";
import { emptyStyle } from "../src/theme.ts";
import { asciiEffectOptions } from "./ascii_options.ts";
import { createNeonThreeScene, type NeonThreeSceneBundle } from "./neon_three.ts";
import type { AsciiOptions, Rect, ThreeSceneMode, ThreeSceneSignal } from "./types.ts";

interface ThreeSceneState {
  mode: ThreeSceneMode;
  signal: ThreeSceneSignal;
}

export class ThreePanelView {
  private object?: ThreeAsciiObject;
  private bundle?: NeonThreeSceneBundle;
  private activeMode?: ThreeSceneMode;
  private readonly effect: Effect;

  constructor(options: {
    canvas: Canvas;
    rectangle: SignalOfObject<Rect>;
    scene: SignalOfObject<ThreeSceneState | null>;
    ascii: SignalOfObject<AsciiOptions>;
    enabled?: boolean | Signal<boolean>;
    zIndex: number;
    frameInterval?: number;
  }) {
    this.effect = new Effect(() => {
      const rect = options.rectangle.value;
      const current = options.scene.value;
      const enabled = options.enabled instanceof Signal ? options.enabled.value : options.enabled ?? true;
      const visible = enabled && !!current && rect.width > 0 && rect.height > 0;

      if (!visible || !current) {
        this.destroy();
        return;
      }

      if (!this.object || this.activeMode !== current.mode || !this.object.isOperational()) {
        this.destroy();
        const bundle = createNeonThreeScene(current.mode);
        this.bundle = bundle;
        this.activeMode = current.mode;
        this.object = new ThreeAsciiObject({
          canvas: options.canvas,
          rectangle: options.rectangle,
          zIndex: options.zIndex,
          style: emptyStyle,
          scene: bundle.scene,
          camera: bundle.camera,
          frameInterval: options.frameInterval ?? 1000 / 10,
          effect: asciiEffectOptions(options.ascii.peek()),
          terminalEdgeBias: options.ascii.peek().terminalEdgeBias,
          terminalGlyphStyle: options.ascii.peek().terminalGlyphStyle,
          onFrame: () => {
            const latest = options.scene.peek();
            if (!latest) {
              return;
            }
            bundle.tick(performance.now(), latest.signal);
          },
        });
        this.object.draw();
        return;
      }

      this.object.setEffectOptions(asciiEffectOptions(options.ascii.value));
      this.object.setTerminalEdgeBias(options.ascii.value.terminalEdgeBias);
      this.object.setTerminalGlyphStyle(options.ascii.value.terminalGlyphStyle);
    });
  }

  private destroy() {
    this.object?.erase();
    this.object = undefined;
    this.bundle?.dispose();
    this.bundle = undefined;
    this.activeMode = undefined;
  }

  dispose(): void {
    this.effect.dispose();
    this.destroy();
  }
}
