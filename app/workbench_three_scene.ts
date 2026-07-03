import type { ThreeSceneMode, ThreeSceneSignal } from "./types.ts";

export interface WorkbenchThreeScene {
  mode: ThreeSceneMode;
  signal: ThreeSceneSignal;
}

export interface WorkbenchThreeSceneSignalTarget {
  peek(): WorkbenchThreeScene | null;
  value: WorkbenchThreeScene | null;
}

export function setWorkbenchThreeSceneSignal(
  target: WorkbenchThreeSceneSignalTarget,
  next: WorkbenchThreeScene | null,
): boolean {
  if (sameWorkbenchThreeScene(target.peek(), next)) return false;
  target.value = next;
  return true;
}

export function sameWorkbenchThreeScene(
  left: WorkbenchThreeScene | null,
  right: WorkbenchThreeScene | null,
): boolean {
  if (left === right) return true;
  if (!left || !right || left.mode !== right.mode) return false;
  return sameThreeSceneSignal(left.signal, right.signal);
}

export function sameThreeSceneSignal(left: ThreeSceneSignal, right: ThreeSceneSignal): boolean {
  return left.x === right.x &&
    left.y === right.y &&
    left.depth === right.depth &&
    left.twist === right.twist &&
    left.lift === right.lift &&
    left.pulse === right.pulse &&
    left.active === right.active &&
    left.pressed === right.pressed;
}
