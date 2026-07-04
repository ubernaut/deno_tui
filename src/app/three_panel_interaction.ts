import * as THREE from "npm:three@0.183.2";

export interface ThreePanelInteractionState {
  rotationX: number;
  rotationY: number;
  zoom: number;
}

export interface ThreePanelTransformBundle {
  camera: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  };
  scene: {
    rotation: THREE.Euler;
  };
}

const minInteractionZoom = 0.35;
const maxInteractionZoom = 3.25;
const zoomStep = 1.14;
const rotationSensitivity = 0.035;

export function defaultThreePanelInteractionState(): ThreePanelInteractionState {
  return { rotationX: 0, rotationY: 0, zoom: 1 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeRadians(value: number): number {
  const full = Math.PI * 2;
  return ((value + Math.PI) % full + full) % full - Math.PI;
}

export class ThreePanelInteractionController {
  readonly state = defaultThreePanelInteractionState();
  private baseCameraPosition?: THREE.Vector3;
  private baseCameraQuaternion?: THREE.Quaternion;
  private baseSceneRotation?: THREE.Euler;

  rotateBy(deltaColumns: number, deltaRows: number): ThreePanelInteractionState {
    if (deltaColumns === 0 && deltaRows === 0) return this.inspect();
    this.state.rotationY = normalizeRadians(this.state.rotationY + deltaColumns * rotationSensitivity);
    this.state.rotationX = clamp(
      this.state.rotationX + deltaRows * rotationSensitivity,
      -Math.PI,
      Math.PI,
    );
    return this.inspect();
  }

  zoomBy(scrollSteps: number): ThreePanelInteractionState {
    if (scrollSteps === 0) return this.inspect();
    this.state.zoom = clamp(
      this.state.zoom * Math.pow(zoomStep, -scrollSteps),
      minInteractionZoom,
      maxInteractionZoom,
    );
    return this.inspect();
  }

  reset(): ThreePanelInteractionState {
    Object.assign(this.state, defaultThreePanelInteractionState());
    return this.inspect();
  }

  inspect(): ThreePanelInteractionState {
    return { ...this.state };
  }

  captureBaseTransform(bundle: ThreePanelTransformBundle): void {
    this.baseCameraPosition = bundle.camera.position.clone();
    this.baseCameraQuaternion = bundle.camera.quaternion.clone();
    this.baseSceneRotation = bundle.scene.rotation.clone();
  }

  apply(bundle: ThreePanelTransformBundle | undefined): void {
    if (!bundle || !this.baseCameraPosition || !this.baseCameraQuaternion || !this.baseSceneRotation) return;
    const cameraDistanceScale = 1 / this.state.zoom;
    bundle.camera.position.copy(this.baseCameraPosition).multiplyScalar(cameraDistanceScale);
    bundle.camera.quaternion.copy(this.baseCameraQuaternion);
    bundle.scene.rotation.set(
      this.baseSceneRotation.x + this.state.rotationX,
      this.baseSceneRotation.y + this.state.rotationY,
      this.baseSceneRotation.z,
      this.baseSceneRotation.order,
    );
  }

  clearBaseTransform(): void {
    this.baseCameraPosition = undefined;
    this.baseCameraQuaternion = undefined;
    this.baseSceneRotation = undefined;
  }
}
