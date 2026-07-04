import { assertEquals } from "./deps.ts";
import {
  sameThreeSceneSignal,
  sameWorkbenchThreeScene,
  setWorkbenchThreeSceneSignal,
  workbenchStudioScene,
  type WorkbenchThreeScene,
  workbenchVisualizationThreeScene,
} from "../src/app/workbench_three_scene.ts";

const signal = {
  x: 0.1,
  y: 0.2,
  depth: 0.3,
  twist: 0.4,
  lift: 0.5,
  pulse: 0.6,
  active: true,
  pressed: false,
};

Deno.test("workbench three scene helpers compare every signal field", () => {
  assertEquals(sameThreeSceneSignal(signal, { ...signal }), true);
  assertEquals(sameThreeSceneSignal(signal, { ...signal, pulse: 0.7 }), false);
  assertEquals(sameThreeSceneSignal(signal, { ...signal, pressed: true }), false);
});

Deno.test("workbench three scene helpers compare mode and nullable scenes", () => {
  const scene: WorkbenchThreeScene = { mode: "studio", signal };
  assertEquals(sameWorkbenchThreeScene(scene, scene), true);
  assertEquals(sameWorkbenchThreeScene(scene, { mode: "studio", signal: { ...signal } }), true);
  assertEquals(sameWorkbenchThreeScene(scene, { mode: "lattice", signal: { ...signal } }), false);
  assertEquals(sameWorkbenchThreeScene(scene, null), false);
  assertEquals(sameWorkbenchThreeScene(null, null), true);
});

Deno.test("workbench three scene signal setter skips unchanged payloads", () => {
  const initial: WorkbenchThreeScene = { mode: "studio", signal };
  const target = new FakeSceneSignal(initial);

  assertEquals(setWorkbenchThreeSceneSignal(target, { mode: "studio", signal: { ...signal } }), false);
  assertEquals(target.writes, 0);

  assertEquals(setWorkbenchThreeSceneSignal(target, { mode: "studio", signal: { ...signal, active: false } }), true);
  assertEquals(target.writes, 1);

  assertEquals(setWorkbenchThreeSceneSignal(target, null), true);
  assertEquals(target.writes, 2);
});

Deno.test("workbench studio scene projects control state into a Three scene signal", () => {
  assertEquals(
    workbenchStudioScene({
      density: 6,
      progress: 42,
      progressRatio: 0.42,
      compactRows: true,
      livePreview: true,
      active: true,
      pressed: true,
    }),
    {
      mode: "studio",
      signal: {
        x: 0.6,
        y: 0.42,
        depth: 0.6,
        twist: 0.8,
        lift: 0.42,
        pulse: 0.7,
        active: true,
        pressed: true,
      },
    },
  );

  assertEquals(
    workbenchStudioScene({
      density: 3,
      progress: 10,
      progressRatio: 0.1,
      compactRows: false,
      livePreview: false,
    })?.signal,
    {
      x: 0.3,
      y: 0.1,
      depth: 0.3,
      twist: 0.25,
      lift: 0.1,
      pulse: 0.15,
      active: false,
      pressed: false,
    },
  );
});

Deno.test("workbench studio scene returns null while blocked hidden or unavailable", () => {
  const input = {
    density: 6,
    progress: 42,
    progressRatio: 0.42,
  };

  assertEquals(workbenchStudioScene({ ...input, blocked: true }), null);
  assertEquals(workbenchStudioScene({ ...input, minimized: true }), null);
  assertEquals(workbenchStudioScene({ ...input, available: false }), null);
});

Deno.test("workbench visualization three scene gates live rendering", () => {
  const scene: WorkbenchThreeScene = { mode: "lattice", signal };

  assertEquals(workbenchVisualizationThreeScene({ scene, width: 16, height: 12 }), scene);
  assertEquals(workbenchVisualizationThreeScene({ scene, width: 7, height: 12 }), null);
  assertEquals(workbenchVisualizationThreeScene({ scene, width: 16, height: 8 }), null);
  assertEquals(workbenchVisualizationThreeScene({ scene, width: 7, height: 8, minWidth: 6, minHeight: 6 }), scene);
  assertEquals(workbenchVisualizationThreeScene({ scene, width: 16, height: 12, blocked: true }), null);
  assertEquals(workbenchVisualizationThreeScene({ scene, width: 16, height: 12, available: false }), null);
  assertEquals(workbenchVisualizationThreeScene({ scene: null, width: 16, height: 12 }), null);
});

class FakeSceneSignal {
  writes = 0;

  constructor(private current: WorkbenchThreeScene | null) {}

  peek(): WorkbenchThreeScene | null {
    return this.current;
  }

  set value(next: WorkbenchThreeScene | null) {
    this.current = next;
    this.writes += 1;
  }
}
