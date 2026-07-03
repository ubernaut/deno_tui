import { assertEquals } from "./deps.ts";
import {
  sameThreeSceneSignal,
  sameWorkbenchThreeScene,
  setWorkbenchThreeSceneSignal,
  type WorkbenchThreeScene,
} from "../app/workbench_three_scene.ts";

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
