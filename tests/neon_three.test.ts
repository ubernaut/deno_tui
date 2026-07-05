import { assert } from "./deps.ts";
import type { Object3D } from "npm:three@0.183.2";
import { createNeonThreeScene, neonThreeSceneCatalog, neonThreeSceneModeLabel } from "../app/neon_three.ts";
import { threeSceneModes, type ThreeSceneSignal } from "../app/types.ts";

const signal: ThreeSceneSignal = {
  x: 0.5,
  y: 0.5,
  depth: 0.7,
  twist: 0.2,
  lift: -0.15,
  pulse: 0.8,
  active: true,
  pressed: false,
};

Deno.test("neon three scene catalog covers every mode with labels", () => {
  const catalogModes = neonThreeSceneCatalog.map((entry) => entry.mode);
  assert(catalogModes.length === threeSceneModes.length);
  for (const mode of threeSceneModes) {
    assert(catalogModes.includes(mode));
    assert(neonThreeSceneModeLabel(mode).length > 0);
  }
});

for (const { mode } of neonThreeSceneCatalog) {
  Deno.test(`createNeonThreeScene supports ${mode}`, () => {
    const bundle = createNeonThreeScene(mode);
    bundle.tick(performance.now(), signal);
    bundle.dispose();
  });
}

Deno.test("wireframe thickness adds real geometry for ASCII sampling", () => {
  const thin = createNeonThreeScene("lattice", { wireframeThickness: 0.5 });
  const thick = createNeonThreeScene("lattice", { wireframeThickness: 4 });
  let thinMeshes = 0;
  let thickMeshes = 0;
  let thickInstancedMeshes = 0;
  thin.scene.traverse((object: Object3D) => {
    if (object.type === "Mesh") thinMeshes += 1;
  });
  thick.scene.traverse((object: Object3D) => {
    if (object.type === "Mesh") thickMeshes += 1;
    if ((object as Object3D & { isInstancedMesh?: boolean }).isInstancedMesh) thickInstancedMeshes += 1;
  });
  thin.dispose();
  thick.dispose();

  assert(thickMeshes > thinMeshes);
  assert(thickInstancedMeshes > 0);
});
