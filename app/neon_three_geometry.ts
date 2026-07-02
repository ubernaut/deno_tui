import * as THREE from "npm:three@0.183.2";
import { colors } from "./neon_theme.ts";

export function neonLine(color: string) {
  return new THREE.LineBasicMaterial({ color });
}

export function addBoxWire(group: THREE.Group, size: number, color: string) {
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)),
    neonLine(color),
  );
  group.add(wire);
  return wire;
}

export function addPanel(
  group: THREE.Group,
  width: number,
  height: number,
  color: string,
  position: [number, number, number],
  opacity = 0.72,
) {
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
    }),
  );
  panel.position.set(...position);
  group.add(panel);
  return panel;
}

export function addWirePanel(
  group: THREE.Group,
  width: number,
  height: number,
  color: string,
  position: [number, number, number],
) {
  const panel = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, 0.04)),
    neonLine(color),
  );
  panel.position.set(...position);
  group.add(panel);
  return panel;
}

export function addSolidBox(
  group: THREE.Group,
  width: number,
  height: number,
  depth: number,
  color: string,
  position: [number, number, number],
  opacity = 0.82,
) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );
  box.position.set(...position);
  group.add(box);
  return box;
}

export function createPolyline(points: THREE.Vector3[], color: string) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, neonLine(color));
}

export function createHelix(color: string, radius: number, turns: number, height: number) {
  const points: number[] = [];
  const count = 220;
  for (let index = 0; index < count; index += 1) {
    const t = (index / (count - 1)) * Math.PI * 2 * turns;
    points.push(Math.cos(t) * radius, (index / (count - 1) - 0.5) * height, Math.sin(t) * radius);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.Line(geometry, neonLine(color));
}

export function createPointsShell() {
  const geometry = new THREE.BufferGeometry();
  const points: number[] = [];
  for (let index = 0; index < 90; index += 1) {
    const t = (index / 89) * Math.PI * 2;
    points.push(
      Math.cos(t) * 1.45 * Math.sin(index * 0.19),
      Math.sin(t * 0.7) * 1.2,
      Math.sin(t) * 1.45 * Math.cos(index * 0.13),
    );
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: colors.amber, size: 0.04 }));
}

export function createMapSlabMesh() {
  const geometry = new THREE.PlaneGeometry(2.8, 2.8, 16, 16);
  const positions = geometry.attributes.position as THREE.Float32BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    positions.setZ(index, Math.sin(x * 2.6) * 0.22 + Math.cos(y * 2.8) * 0.17);
  }
  positions.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    color: colors.phosphor,
    wireframe: true,
    transparent: true,
    opacity: 0.82,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -0.85;
  mesh.rotation.z = 0.4;
  return mesh;
}

export function createWaveRibbon(color: string, count = 96) {
  const points = new Array<THREE.Vector3>(count);
  for (let index = 0; index < count; index += 1) {
    const x = (index / (count - 1) - 0.5) * 4.2;
    const y = Math.sin(index * 0.28) * 0.42 + Math.sin(index * 0.071) * 0.18;
    points[index] = new THREE.Vector3(x, y, Math.cos(index * 0.19) * 0.22);
  }
  return createPolyline(points, color);
}

export function createLissajousTrace(color: string, scaleX: number, scaleY: number, phase = 0) {
  const points = new Array<THREE.Vector3>(180);
  for (let index = 0; index < points.length; index += 1) {
    const t = (index / 179) * Math.PI * 2;
    points[index] = new THREE.Vector3(
      Math.sin(t * 3 + phase) * scaleX,
      Math.sin(t * 4 + phase * 0.7) * scaleY,
      Math.cos(t * 5 + phase) * 0.18,
    );
  }
  return createPolyline(points, color);
}

export function createReticle(color: string, radius: number) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.018, 12, 96),
    new THREE.MeshBasicMaterial({ color, wireframe: true }),
  );
  group.add(ring);
  const horizontal = createPolyline(
    [new THREE.Vector3(-radius * 1.45, 0, 0), new THREE.Vector3(radius * 1.45, 0, 0)],
    color,
  );
  const vertical = createPolyline(
    [new THREE.Vector3(0, -radius * 1.45, 0), new THREE.Vector3(0, radius * 1.45, 0)],
    color,
  );
  group.add(horizontal, vertical);
  return group;
}

export function createGrid(width: number, height: number, columns: number, rows: number, color: string) {
  const grid = new THREE.Group();
  for (let column = 0; column <= columns; column += 1) {
    const x = (column / columns - 0.5) * width;
    grid.add(createPolyline([new THREE.Vector3(x, -height / 2, 0), new THREE.Vector3(x, height / 2, 0)], color));
  }
  for (let row = 0; row <= rows; row += 1) {
    const y = (row / rows - 0.5) * height;
    grid.add(createPolyline([new THREE.Vector3(-width / 2, y, 0), new THREE.Vector3(width / 2, y, 0)], color));
  }
  return grid;
}

export function createContourField(color: string, layers = 9): THREE.Group {
  const field = new THREE.Group();
  for (let layer = 0; layer < layers; layer += 1) {
    const points = new Array<THREE.Vector3>(90);
    for (let index = 0; index < points.length; index += 1) {
      const t = (index / 89) * Math.PI * 2;
      const radius = 0.5 + layer * 0.14 + Math.sin(index * 0.33 + layer) * 0.05;
      points[index] = new THREE.Vector3(
        Math.cos(t) * radius * (0.78 + layer * 0.035),
        Math.sin(t) * radius * (1.05 - layer * 0.025),
        Math.sin(t * 2.7 + layer) * 0.05,
      );
    }
    const line = createPolyline(points, color);
    line.position.set(-1.25 + layer * 0.055, 0.2 - layer * 0.025, -0.2 + layer * 0.018);
    field.add(line);
  }
  return field;
}

export function createSegmentBoard(color: string): THREE.Group {
  const board = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const segmentSpecs: Array<[number, number, number, number]> = [
    [0, 0.48, 0.62, 0.08],
    [0, 0, 0.62, 0.08],
    [0, -0.48, 0.62, 0.08],
    [-0.34, 0.24, 0.08, 0.48],
    [0.34, 0.24, 0.08, 0.48],
    [-0.34, -0.24, 0.08, 0.48],
    [0.34, -0.24, 0.08, 0.48],
  ];
  segmentSpecs.forEach(([x, y, width, height], index) => {
    const segment = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.05), material.clone());
    segment.position.set(x, y, index * 0.006);
    board.add(segment);
  });
  return board;
}

export function createHexTile(color: string) {
  const tile = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.08, 6),
    new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.9 }),
  );
  tile.rotation.x = Math.PI / 2;
  return tile;
}

export function createTopologyNode(color: string, radius = 0.09) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    new THREE.MeshBasicMaterial({ color, wireframe: true }),
  );
}
