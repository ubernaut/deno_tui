import * as THREE from "npm:three@0.183.2";
import { assertEquals, assertInstanceOf } from "./deps.ts";
import {
  addBoxWire,
  addPanel,
  addSolidBox,
  addWirePanel,
  createContourField,
  createGrid,
  createHelix,
  createHexTile,
  createLissajousTrace,
  createMapSlabMesh,
  createPointsShell,
  createPolyline,
  createReticle,
  createSegmentBoard,
  createTopologyNode,
  createWaveRibbon,
  neonLine,
} from "../app/neon_three_geometry.ts";
import { colors } from "../app/neon_theme.ts";

Deno.test("neon three geometry helpers add primitive meshes and lines to groups", () => {
  const group = new THREE.Group();

  assertInstanceOf(neonLine(colors.signal), THREE.LineBasicMaterial);
  assertInstanceOf(addBoxWire(group, 1, colors.signal), THREE.LineSegments);
  assertInstanceOf(addPanel(group, 1.2, 0.8, colors.amber, [1, 2, 3]), THREE.Mesh);
  assertInstanceOf(addWirePanel(group, 1.2, 0.8, colors.phosphor, [0, 0, 0]), THREE.LineSegments);
  assertInstanceOf(addSolidBox(group, 1, 2, 3, colors.alarm, [-1, 0, 1]), THREE.Mesh);

  assertEquals(group.children.length, 4);
  assertEquals(group.children[1].position.toArray(), [1, 2, 3]);
});

Deno.test("neon three line helpers create deterministic sampled geometries", () => {
  const polyline = createPolyline([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)], colors.signal);
  const helix = createHelix(colors.alarm, 0.5, 2, 1.5);
  const wave = createWaveRibbon(colors.phosphor, 12);
  const trace = createLissajousTrace(colors.violet, 1.2, 0.8, 0.3);

  assertEquals((polyline.geometry.attributes.position as THREE.BufferAttribute).count, 2);
  assertEquals((helix.geometry.attributes.position as THREE.BufferAttribute).count, 220);
  assertEquals((wave.geometry.attributes.position as THREE.BufferAttribute).count, 12);
  assertEquals((trace.geometry.attributes.position as THREE.BufferAttribute).count, 180);
});

Deno.test("neon three composite helpers expose expected child structure", () => {
  const grid = createGrid(4, 3, 4, 3, colors.signal);
  const contour = createContourField(colors.phosphor, 5);
  const reticle = createReticle(colors.alarm, 0.75);
  const segmentBoard = createSegmentBoard(colors.amber);
  const shell = createPointsShell();
  const slab = createMapSlabMesh();
  const tile = createHexTile(colors.signal);
  const node = createTopologyNode(colors.violet);

  assertEquals(grid.children.length, 9);
  assertEquals(contour.children.length, 5);
  assertEquals(reticle.children.length, 3);
  assertEquals(segmentBoard.children.length, 7);
  assertEquals((shell.geometry.attributes.position as THREE.BufferAttribute).count, 90);
  assertEquals((slab.geometry.attributes.position as THREE.BufferAttribute).count, 289);
  assertInstanceOf(tile.geometry, THREE.CylinderGeometry);
  assertInstanceOf(node.geometry, THREE.SphereGeometry);
});
