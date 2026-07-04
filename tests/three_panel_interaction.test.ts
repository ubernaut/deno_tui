import { assert, assertEquals } from "./deps.ts";
import { createNeonThreeScene } from "../app/neon_three.ts";
import {
  defaultThreePanelInteractionState,
  ThreePanelInteractionController,
} from "../src/app/three_panel_interaction.ts";

Deno.test("ThreePanelInteractionController tracks bounded rotation zoom and reset state", () => {
  const interaction = new ThreePanelInteractionController();

  assertEquals(defaultThreePanelInteractionState(), { rotationX: 0, rotationY: 0, zoom: 1 });
  assertEquals(interaction.inspect(), { rotationX: 0, rotationY: 0, zoom: 1 });
  assertEquals(interaction.rotateBy(0, 0), { rotationX: 0, rotationY: 0, zoom: 1 });
  assertEquals(interaction.zoomBy(0), { rotationX: 0, rotationY: 0, zoom: 1 });

  const rotated = interaction.rotateBy(1000, 1000);
  assert(rotated.rotationY >= -Math.PI && rotated.rotationY <= Math.PI);
  assertEquals(rotated.rotationX, Math.PI);

  const zoomedIn = interaction.zoomBy(-200);
  assertEquals(zoomedIn.zoom, 3.25);
  const zoomedOut = interaction.zoomBy(400);
  assertEquals(zoomedOut.zoom, 0.35);

  assertEquals(interaction.reset(), { rotationX: 0, rotationY: 0, zoom: 1 });
});

Deno.test("ThreePanelInteractionController applies captured three scene transforms", () => {
  const bundle = createNeonThreeScene("studio", { wireframeThickness: 8 });
  const interaction = new ThreePanelInteractionController();
  try {
    const baseDistance = bundle.camera.position.length();
    const baseRotationX = bundle.scene.rotation.x;
    const baseRotationY = bundle.scene.rotation.y;

    interaction.captureBaseTransform(bundle);
    interaction.zoomBy(-1);
    interaction.rotateBy(4, -2);
    interaction.apply(bundle);

    assert(bundle.camera.position.length() < baseDistance);
    assert(bundle.scene.rotation.x < baseRotationX);
    assert(bundle.scene.rotation.y > baseRotationY);

    const appliedDistance = bundle.camera.position.length();
    interaction.clearBaseTransform();
    interaction.zoomBy(-1);
    interaction.rotateBy(4, -2);
    interaction.apply(bundle);
    assertEquals(bundle.camera.position.length(), appliedDistance);
  } finally {
    bundle.dispose();
  }
});
