// Copyright 2023 Im-Beast. MIT license.
export interface RuntimeCapabilities {
  workers: boolean;
  webgpu: boolean;
  webgl: boolean;
  offscreenCanvas: boolean;
  indexedDb: boolean;
}

interface CanvasLike {
  getContext(type: string): unknown;
}

export function detectRuntimeCapabilities(scope: typeof globalThis = globalThis): RuntimeCapabilities {
  const offscreenCanvas = "OffscreenCanvas" in scope;
  return {
    workers: "Worker" in scope,
    webgpu: Boolean(scope.navigator && "gpu" in scope.navigator),
    webgl: canCreateWebGlContext(scope, offscreenCanvas),
    offscreenCanvas,
    indexedDb: "indexedDB" in scope,
  };
}

function canCreateWebGlContext(scope: typeof globalThis, offscreenCanvas: boolean): boolean {
  try {
    if (offscreenCanvas) {
      const CanvasCtor = (scope as typeof globalThis & {
        OffscreenCanvas?: new (width: number, height: number) => CanvasLike;
      }).OffscreenCanvas;
      return Boolean(CanvasCtor && new CanvasCtor(1, 1).getContext("webgl"));
    }
    const document = (scope as typeof globalThis & {
      document?: { createElement(tagName: "canvas"): CanvasLike };
    }).document;
    return Boolean(document?.createElement("canvas").getContext("webgl"));
  } catch {
    return false;
  }
}
