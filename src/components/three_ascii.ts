import type { Camera, Scene } from "npm:three@0.183.2";

import { Component, type ComponentOptions } from "../component.ts";
import { ThreeAsciiObject } from "../canvas/three_ascii.ts";
import type { AcerolaAsciiNodeOptions } from "../three_ascii/AcerolaAsciiNode.ts";

export interface ThreeAsciiOptions extends ComponentOptions {
  scene: Scene;
  camera: Camera;
  frameInterval?: number;
  pixelAspectRatio?: number;
  terminalEdgeBias?: number;
  effect?: AcerolaAsciiNodeOptions;
  onFrame?: (deltaTime: number) => void | Promise<void>;
}

export class ThreeAscii extends Component {
  declare drawnObjects: { three_ascii: ThreeAsciiObject };

  readonly scene: Scene;
  readonly camera: Camera;
  readonly frameInterval?: number;
  readonly pixelAspectRatio?: number;
  readonly terminalEdgeBias?: number;
  readonly effect?: AcerolaAsciiNodeOptions;
  readonly onFrame?: (deltaTime: number) => void | Promise<void>;

  constructor(options: ThreeAsciiOptions) {
    super(options);
    this.scene = options.scene;
    this.camera = options.camera;
    this.frameInterval = options.frameInterval;
    this.pixelAspectRatio = options.pixelAspectRatio;
    this.terminalEdgeBias = options.terminalEdgeBias;
    this.effect = options.effect;
    this.onFrame = options.onFrame;
  }

  override draw(): void {
    super.draw();

    const object = new ThreeAsciiObject({
      canvas: this.tui.canvas,
      view: this.view,
      zIndex: this.zIndex,
      style: this.style,
      rectangle: this.rectangle,
      scene: this.scene,
      camera: this.camera,
      frameInterval: this.frameInterval,
      pixelAspectRatio: this.pixelAspectRatio,
      terminalEdgeBias: this.terminalEdgeBias,
      effect: this.effect,
      onFrame: this.onFrame,
    });

    this.drawnObjects.three_ascii = object;
    object.draw();
  }
}
