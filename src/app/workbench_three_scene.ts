export interface WorkbenchThreeSceneSignal {
  x: number;
  y: number;
  depth: number;
  twist: number;
  lift: number;
  pulse: number;
  active: boolean;
  pressed: boolean;
}

export interface WorkbenchThreeScene<TMode extends string = string> {
  mode: TMode;
  signal: WorkbenchThreeSceneSignal;
}

export interface WorkbenchStudioSceneInput {
  blocked?: boolean;
  minimized?: boolean;
  available?: boolean;
  density: number;
  progress: number;
  progressRatio: number;
  compactRows?: boolean;
  livePreview?: boolean;
  active?: boolean;
  pressed?: boolean;
}

export interface WorkbenchVisualizationThreeSceneInput {
  blocked?: boolean;
  available?: boolean;
  width: number;
  height: number;
  scene?: WorkbenchThreeScene | null;
  minWidth?: number;
  minHeight?: number;
}

export interface WorkbenchThreeSceneSignalTarget<TMode extends string = string> {
  peek(): WorkbenchThreeScene<TMode> | null;
  value: WorkbenchThreeScene<TMode> | null;
}

export function workbenchStudioScene(input: WorkbenchStudioSceneInput): WorkbenchThreeScene<"studio"> | null {
  if (input.blocked || input.minimized || input.available === false) return null;
  const density = input.density / 10;
  return {
    mode: "studio",
    signal: {
      x: density,
      y: input.progress / 100,
      depth: density,
      twist: input.compactRows ? 0.8 : 0.25,
      lift: input.progressRatio,
      pulse: input.livePreview ? 0.7 : 0.15,
      active: input.active ?? false,
      pressed: input.pressed ?? false,
    },
  };
}

export function workbenchVisualizationThreeScene<TMode extends string>(
  input: Omit<WorkbenchVisualizationThreeSceneInput, "scene"> & { scene?: WorkbenchThreeScene<TMode> | null },
): WorkbenchThreeScene<TMode> | null {
  if (
    input.blocked ||
    input.available === false ||
    !input.scene ||
    input.width < (input.minWidth ?? 8) ||
    input.height < (input.minHeight ?? 9)
  ) return null;
  return input.scene;
}

export function setWorkbenchThreeSceneSignal(
  target: WorkbenchThreeSceneSignalTarget,
  next: WorkbenchThreeScene | null,
): boolean {
  if (sameWorkbenchThreeScene(target.peek(), next)) return false;
  target.value = next;
  return true;
}

export function sameWorkbenchThreeScene<TMode extends string>(
  left: WorkbenchThreeScene<TMode> | null,
  right: WorkbenchThreeScene<TMode> | null,
): boolean {
  if (left === right) return true;
  if (!left || !right || left.mode !== right.mode) return false;
  return sameThreeSceneSignal(left.signal, right.signal);
}

export function sameThreeSceneSignal(left: WorkbenchThreeSceneSignal, right: WorkbenchThreeSceneSignal): boolean {
  return left.x === right.x &&
    left.y === right.y &&
    left.depth === right.depth &&
    left.twist === right.twist &&
    left.lift === right.lift &&
    left.pulse === right.pulse &&
    left.active === right.active &&
    left.pressed === right.pressed;
}
