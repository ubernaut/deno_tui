import { type Canvas } from "../src/canvas/canvas.ts";
import { buildFallbackGrid, formatThreeAsciiFallbackDetail, ThreeAsciiObject } from "../src/canvas/three_ascii.ts";
import { Effect, Signal, type SignalOfObject } from "../src/signals/mod.ts";
import { emptyStyle } from "../src/theme.ts";
import { ThreeAsciiRenderer, type ThreeAsciiRendererOptions } from "../src/three_ascii/renderer.ts";
import * as THREE from "npm:three@0.183.2";
import { asciiEffectOptions } from "./ascii_options.ts";
import { createNeonThreeScene, type NeonThreeSceneBundle } from "./neon_three.ts";
import type { AsciiOptions, Rect, ThreeSceneMode, ThreeSceneSignal } from "./types.ts";

export interface ThreeSceneState {
  mode: ThreeSceneMode;
  signal: ThreeSceneSignal;
}

export interface ThreePanelInteractionState {
  rotationX: number;
  rotationY: number;
  zoom: number;
}

export interface ThreePanelGridRenderer {
  setSize(columns: number, rows: number): void;
  setEffectOptions(options: ReturnType<typeof asciiEffectOptions>): void;
  setTerminalEdgeBias(value: number): void;
  setTerminalGlyphStyle(value: AsciiOptions["terminalGlyphStyle"]): void;
  renderToAnsiGrid(deltaTime?: number, onFrame?: (deltaTime: number) => void | Promise<void>): Promise<string[][]>;
  destroy(): void;
}

export type ThreePanelRendererFactory = (options: ThreeAsciiRendererOptions) => ThreePanelGridRenderer;

const minInteractionZoom = 0.35;
const maxInteractionZoom = 3.25;
const zoomStep = 1.14;
const rotationSensitivity = 0.035;

function defaultInteractionState(): ThreePanelInteractionState {
  return { rotationX: 0, rotationY: 0, zoom: 1 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeRadians(value: number): number {
  const full = Math.PI * 2;
  return ((value + Math.PI) % full + full) % full - Math.PI;
}

export class ThreePanelView {
  private object?: ThreeAsciiObject;
  private bundle?: NeonThreeSceneBundle;
  private activeMode?: ThreeSceneMode;
  private activeWireframeThickness?: number;
  private readonly effect: Effect;
  private readonly onUpdate?: () => void;
  private readonly interaction = defaultInteractionState();
  private baseCameraPosition?: THREE.Vector3;
  private baseCameraQuaternion?: THREE.Quaternion;
  private baseSceneRotation?: THREE.Euler;

  constructor(options: {
    canvas: Canvas;
    rectangle: SignalOfObject<Rect>;
    scene: SignalOfObject<ThreeSceneState | null>;
    ascii: SignalOfObject<AsciiOptions>;
    enabled?: boolean | Signal<boolean>;
    zIndex: number;
    frameInterval?: number;
    onUpdate?: () => void;
  }) {
    this.onUpdate = options.onUpdate;
    this.effect = new Effect(() => {
      const rect = options.rectangle.value;
      const current = options.scene.value;
      const ascii = options.ascii.value;
      const enabled = options.enabled instanceof Signal ? options.enabled.value : options.enabled ?? true;
      const visible = enabled && !!current && rect.width > 0 && rect.height > 0;

      if (!visible || !current) {
        this.destroy();
        return;
      }

      if (
        !this.object || this.activeMode !== current.mode ||
        this.activeWireframeThickness !== ascii.wireframeThickness ||
        !this.object.isOperational()
      ) {
        this.destroy();
        const bundle = createNeonThreeScene(current.mode, { wireframeThickness: ascii.wireframeThickness });
        this.bundle = bundle;
        this.activeMode = current.mode;
        this.activeWireframeThickness = ascii.wireframeThickness;
        this.captureBaseTransform(bundle);
        this.object = new ThreeAsciiObject({
          canvas: options.canvas,
          rectangle: options.rectangle,
          zIndex: options.zIndex,
          style: emptyStyle,
          scene: bundle.scene,
          camera: bundle.camera,
          frameInterval: options.frameInterval ?? 1000 / 10,
          effect: asciiEffectOptions(ascii),
          terminalEdgeBias: ascii.terminalEdgeBias,
          terminalGlyphStyle: ascii.terminalGlyphStyle,
          onFrame: () => {
            const latest = options.scene.peek();
            if (!latest) {
              return;
            }
            bundle.tick(performance.now(), latest.signal);
            this.applyInteraction();
          },
        });
        this.applyInteraction();
        this.object.draw();
        return;
      }

      this.object.setEffectOptions(asciiEffectOptions(ascii));
      this.object.setTerminalEdgeBias(ascii.terminalEdgeBias);
      this.object.setTerminalGlyphStyle(ascii.terminalGlyphStyle);
    });
  }

  rotateBy(deltaColumns: number, deltaRows: number): ThreePanelInteractionState {
    if (deltaColumns === 0 && deltaRows === 0) return this.inspectInteraction();
    this.interaction.rotationY = normalizeRadians(this.interaction.rotationY + deltaColumns * rotationSensitivity);
    this.interaction.rotationX = clamp(
      this.interaction.rotationX + deltaRows * rotationSensitivity,
      -Math.PI,
      Math.PI,
    );
    this.applyInteraction();
    this.onUpdate?.();
    return this.inspectInteraction();
  }

  zoomBy(scrollSteps: number): ThreePanelInteractionState {
    if (scrollSteps === 0) return this.inspectInteraction();
    this.interaction.zoom = clamp(
      this.interaction.zoom * Math.pow(zoomStep, -scrollSteps),
      minInteractionZoom,
      maxInteractionZoom,
    );
    this.applyInteraction();
    this.onUpdate?.();
    return this.inspectInteraction();
  }

  resetInteraction(): ThreePanelInteractionState {
    Object.assign(this.interaction, defaultInteractionState());
    this.applyInteraction();
    this.onUpdate?.();
    return this.inspectInteraction();
  }

  inspectInteraction(): ThreePanelInteractionState {
    return { ...this.interaction };
  }

  private captureBaseTransform(bundle: NeonThreeSceneBundle): void {
    this.baseCameraPosition = bundle.camera.position.clone();
    this.baseCameraQuaternion = bundle.camera.quaternion.clone();
    this.baseSceneRotation = bundle.scene.rotation.clone();
  }

  private applyInteraction(): void {
    if (!this.bundle || !this.baseCameraPosition || !this.baseCameraQuaternion || !this.baseSceneRotation) return;
    const cameraDistanceScale = 1 / this.interaction.zoom;
    this.bundle.camera.position.copy(this.baseCameraPosition).multiplyScalar(cameraDistanceScale);
    this.bundle.camera.quaternion.copy(this.baseCameraQuaternion);
    this.bundle.scene.rotation.set(
      this.baseSceneRotation.x + this.interaction.rotationX,
      this.baseSceneRotation.y + this.interaction.rotationY,
      this.baseSceneRotation.z,
      this.baseSceneRotation.order,
    );
  }

  private destroy() {
    this.object?.erase();
    this.object = undefined;
    this.bundle?.dispose();
    this.bundle = undefined;
    this.activeMode = undefined;
    this.activeWireframeThickness = undefined;
    this.baseCameraPosition = undefined;
    this.baseCameraQuaternion = undefined;
    this.baseSceneRotation = undefined;
  }

  dispose(): void {
    this.effect.dispose();
    this.destroy();
  }
}

export class ThreePanelFrameView {
  readonly grid = new Signal<string[][]>([]);

  private renderer?: ThreePanelGridRenderer;
  private bundle?: NeonThreeSceneBundle;
  private activeMode?: ThreeSceneMode;
  private activeWireframeThickness?: number;
  private readonly effect: Effect;
  private readonly frameInterval: number;
  private readonly onUpdate?: () => void;
  private lastFrameTime = performance.now();
  private rendering = false;
  private running = false;
  private destroyPending = false;
  private rebuildPending = false;
  private syncPending = false;
  private failed = false;
  private disposed = false;
  private frameTimer?: ReturnType<typeof setTimeout>;
  private readonly interaction = defaultInteractionState();
  private baseCameraPosition?: THREE.Vector3;
  private baseCameraQuaternion?: THREE.Quaternion;
  private baseSceneRotation?: THREE.Euler;

  constructor(
    private readonly options: {
      rectangle: SignalOfObject<Rect>;
      scene: SignalOfObject<ThreeSceneState | null>;
      ascii: SignalOfObject<AsciiOptions>;
      enabled?: boolean | Signal<boolean>;
      frameInterval?: number;
      onUpdate?: () => void;
      rendererFactory?: ThreePanelRendererFactory;
    },
  ) {
    this.frameInterval = options.frameInterval ?? 1000 / 10;
    this.onUpdate = options.onUpdate;
    this.effect = new Effect(() => this.sync());
    queueMicrotask(() => {
      if (this.disposed || this.renderer || !this.isVisible()) return;
      this.sync();
    });
  }

  isOperational(): boolean {
    return !this.failed;
  }

  private sync(): void {
    if (this.disposed) return;

    const rect = this.options.rectangle.value;
    const current = this.options.scene.value;
    const ascii = this.options.ascii.value;
    const enabled = this.options.enabled instanceof Signal ? this.options.enabled.value : this.options.enabled ?? true;
    const visible = enabled && !!current && rect.width > 0 && rect.height > 0;

    if (!visible || !current) {
      this.syncPending = false;
      this.rebuildPending = false;
      this.destroyRenderer();
      this.setGrid([]);
      return;
    }

    const needsRenderer = !this.renderer ||
      this.activeMode !== current.mode ||
      this.activeWireframeThickness !== ascii.wireframeThickness ||
      !this.isOperational();

    if (needsRenderer) {
      if (this.rendering) {
        this.running = false;
        this.destroyPending = true;
        this.rebuildPending = true;
        return;
      }

      this.destroyRenderer();
      const bundle = createNeonThreeScene(current.mode, { wireframeThickness: ascii.wireframeThickness });
      this.bundle = bundle;
      this.activeMode = current.mode;
      this.activeWireframeThickness = ascii.wireframeThickness;
      this.captureBaseTransform(bundle);
      this.failed = false;
      const rendererFactory = this.options.rendererFactory ??
        ((rendererOptions) => new ThreeAsciiRenderer(rendererOptions));
      this.renderer = rendererFactory({
        scene: bundle.scene,
        camera: bundle.camera,
        columns: rect.width,
        rows: rect.height,
        effect: asciiEffectOptions(ascii),
        terminalEdgeBias: ascii.terminalEdgeBias,
        terminalGlyphStyle: ascii.terminalGlyphStyle,
      });
      this.setGrid([]);
    }

    if (this.rendering) {
      this.running = false;
      this.syncPending = true;
      return;
    }

    this.renderer?.setSize(rect.width, rect.height);
    this.renderer?.setEffectOptions(asciiEffectOptions(ascii));
    this.renderer?.setTerminalEdgeBias(ascii.terminalEdgeBias);
    this.renderer?.setTerminalGlyphStyle(ascii.terminalGlyphStyle);

    if (!this.running) {
      this.running = true;
      queueMicrotask(() => void this.renderLoop());
    }
  }

  private isVisible(): boolean {
    const rect = this.options.rectangle.peek();
    const current = this.options.scene.peek();
    const enabled = this.options.enabled instanceof Signal ? this.options.enabled.peek() : this.options.enabled ?? true;
    return enabled && !!current && rect.width > 0 && rect.height > 0;
  }

  private async renderLoop(): Promise<void> {
    if (!this.running || this.rendering) return;
    this.frameTimer = undefined;

    const renderer = this.renderer;
    const bundle = this.bundle;
    if (!renderer || !bundle) return;

    this.rendering = true;

    try {
      const rect = this.options.rectangle.peek();
      const current = this.options.scene.peek();
      if (!current || rect.width <= 0 || rect.height <= 0) {
        this.setGrid([]);
        return;
      }

      const now = performance.now();
      const deltaTime = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      renderer.setSize(rect.width, rect.height);
      const grid = await renderer.renderToAnsiGrid(deltaTime, () => {
        const latest = this.options.scene.peek();
        if (!latest) return;
        bundle.tick(performance.now(), latest.signal);
        this.applyInteraction();
      });

      if (!this.running) {
        return;
      }

      this.failed = false;
      this.setGrid(grid);
    } catch (error) {
      this.failed = true;
      this.running = false;
      const rect = this.options.rectangle.peek();
      this.setGrid(buildFallbackGrid(rect.width, rect.height, formatThreeAsciiFallbackDetail(error)));
      this.destroyPending = true;
    } finally {
      this.rendering = false;

      if (this.destroyPending) {
        this.destroyPending = false;
        this.destroyRenderer();
      }

      if (this.rebuildPending || this.syncPending) {
        this.rebuildPending = false;
        this.syncPending = false;
        queueMicrotask(() => this.sync());
      } else if (this.running) {
        this.frameTimer = setTimeout(() => void this.renderLoop(), this.frameInterval);
      }
    }
  }

  private setGrid(grid: string[][]): void {
    if (this.disposed) return;
    this.grid.jink(grid);
    this.onUpdate?.();
  }

  rotateBy(deltaColumns: number, deltaRows: number): ThreePanelInteractionState {
    if (deltaColumns === 0 && deltaRows === 0) return this.inspectInteraction();
    this.interaction.rotationY = normalizeRadians(this.interaction.rotationY + deltaColumns * rotationSensitivity);
    this.interaction.rotationX = clamp(
      this.interaction.rotationX + deltaRows * rotationSensitivity,
      -Math.PI,
      Math.PI,
    );
    this.applyInteraction();
    this.onUpdate?.();
    return this.inspectInteraction();
  }

  zoomBy(scrollSteps: number): ThreePanelInteractionState {
    if (scrollSteps === 0) return this.inspectInteraction();
    this.interaction.zoom = clamp(
      this.interaction.zoom * Math.pow(zoomStep, -scrollSteps),
      minInteractionZoom,
      maxInteractionZoom,
    );
    this.applyInteraction();
    this.onUpdate?.();
    return this.inspectInteraction();
  }

  resetInteraction(): ThreePanelInteractionState {
    Object.assign(this.interaction, defaultInteractionState());
    this.applyInteraction();
    this.onUpdate?.();
    return this.inspectInteraction();
  }

  inspectInteraction(): ThreePanelInteractionState {
    return { ...this.interaction };
  }

  private captureBaseTransform(bundle: NeonThreeSceneBundle): void {
    this.baseCameraPosition = bundle.camera.position.clone();
    this.baseCameraQuaternion = bundle.camera.quaternion.clone();
    this.baseSceneRotation = bundle.scene.rotation.clone();
  }

  private applyInteraction(): void {
    if (!this.bundle || !this.baseCameraPosition || !this.baseCameraQuaternion || !this.baseSceneRotation) return;
    const cameraDistanceScale = 1 / this.interaction.zoom;
    this.bundle.camera.position.copy(this.baseCameraPosition).multiplyScalar(cameraDistanceScale);
    this.bundle.camera.quaternion.copy(this.baseCameraQuaternion);
    this.bundle.scene.rotation.set(
      this.baseSceneRotation.x + this.interaction.rotationX,
      this.baseSceneRotation.y + this.interaction.rotationY,
      this.baseSceneRotation.z,
      this.baseSceneRotation.order,
    );
  }

  private destroyRenderer(): void {
    this.running = false;
    if (this.frameTimer !== undefined) {
      clearTimeout(this.frameTimer);
      this.frameTimer = undefined;
    }

    if (this.rendering) {
      this.destroyPending = true;
      return;
    }

    this.renderer?.destroy();
    this.renderer = undefined;
    this.bundle?.dispose();
    this.bundle = undefined;
    this.activeMode = undefined;
    this.activeWireframeThickness = undefined;
    this.baseCameraPosition = undefined;
    this.baseCameraQuaternion = undefined;
    this.baseSceneRotation = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.syncPending = false;
    this.rebuildPending = false;
    this.effect.dispose();
    this.destroyRenderer();
    this.grid.dispose();
  }
}
