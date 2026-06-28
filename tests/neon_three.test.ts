import { createNeonThreeScene } from "../app/neon_three.ts";
import type { ThreeSceneMode, ThreeSceneSignal } from "../app/types.ts";

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

for (
  const mode of [
    "lattice",
    "atfield",
    "hexshell",
    "capture",
    "mapslab",
    "solenoid",
    "studio",
  ] as const satisfies ThreeSceneMode[]
) {
  Deno.test(`createNeonThreeScene supports ${mode}`, () => {
    const bundle = createNeonThreeScene(mode);
    bundle.tick(performance.now(), signal);
    bundle.dispose();
  });
}
