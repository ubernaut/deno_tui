// Copyright 2023 Im-Beast. MIT license.
import * as THREE from "npm:three@0.183.2";
import { colors } from "./neon_theme.ts";

const asciiWireOverlay = Symbol("asciiWireOverlay");

function asciiWireRadius(thickness = 2): number {
  return Math.max(0.002, Math.min(0.04, thickness * 0.0045));
}

function materialColor(material: THREE.Material | THREE.Material[] | undefined): string {
  const selected = Array.isArray(material) ? material[0] : material;
  const color = (selected as { color?: THREE.Color } | undefined)?.color;
  return color ? `#${color.getHexString()}` : colors.phosphor;
}

function isWireframeMaterial(material: THREE.Material | THREE.Material[] | undefined): boolean {
  const selected = Array.isArray(material) ? material[0] : material;
  return Boolean((selected as { wireframe?: boolean } | undefined)?.wireframe);
}

function createThickSegment(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh | undefined {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length <= 0.0001) return undefined;

  const geometry = new THREE.CylinderGeometry(radius, radius, length, 6, 1, false);
  const segment = new THREE.Mesh(geometry, material);
  segment.position.copy(start).add(end).multiplyScalar(0.5);
  segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return segment;
}

function createThickSegmentsFromGeometry(
  geometry: THREE.BufferGeometry,
  segmented: boolean,
  color: string,
  radius: number,
): THREE.Group | undefined {
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!positions || positions.count < 2) return undefined;

  const overlay = new THREE.Group();
  overlay.userData[asciiWireOverlay] = true;
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
  const maxSegments = Math.min(segmented ? positions.count / 2 : positions.count - 1, 520);
  for (let index = 0; index < maxSegments; index += 1) {
    const startIndex = segmented ? index * 2 : index;
    const endIndex = segmented ? startIndex + 1 : index + 1;
    const start = new THREE.Vector3().fromBufferAttribute(positions, startIndex);
    const end = new THREE.Vector3().fromBufferAttribute(positions, endIndex);
    const segment = createThickSegment(start, end, radius, material.clone());
    if (segment) overlay.add(segment);
  }

  if (overlay.children.length === 0) {
    material.dispose();
    return undefined;
  }
  return overlay;
}

/** Adds mesh-backed line overlays to thin wireframe objects so ASCII sampling sees them clearly. */
export function addAsciiWireOverlays(root: THREE.Object3D, thickness = 2): void {
  if (thickness <= 0.55) return;
  const radius = asciiWireRadius(thickness);
  const overlays: Array<{ parent: THREE.Object3D; overlay: THREE.Object3D }> = [];

  root.traverse((object: THREE.Object3D) => {
    if (object.userData[asciiWireOverlay]) return;
    if (object instanceof THREE.LineSegments) {
      const overlay = createThickSegmentsFromGeometry(object.geometry, true, materialColor(object.material), radius);
      if (overlay) overlays.push({ parent: object, overlay });
      return;
    }
    if (object instanceof THREE.Line) {
      const overlay = createThickSegmentsFromGeometry(object.geometry, false, materialColor(object.material), radius);
      if (overlay) overlays.push({ parent: object, overlay });
      return;
    }
    if (object instanceof THREE.Mesh && isWireframeMaterial(object.material)) {
      const edges = new THREE.EdgesGeometry(object.geometry);
      const overlay = createThickSegmentsFromGeometry(edges, true, materialColor(object.material), radius);
      edges.dispose();
      if (overlay) overlays.push({ parent: object, overlay });
    }
  });

  for (const { parent, overlay } of overlays) {
    parent.add(overlay);
  }
}
