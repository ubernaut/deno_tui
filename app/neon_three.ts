import * as THREE from "npm:three@0.183.2";
import { colors } from "./neon_theme.ts";
import type { ThreeSceneMode, ThreeSceneSignal } from "./types.ts";

function neonLine(color: string) {
  return new THREE.LineBasicMaterial({ color });
}

function addBoxWire(group: THREE.Group, size: number, color: string) {
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)),
    neonLine(color),
  );
  group.add(wire);
  return wire;
}

function createHelix(color: string, radius: number, turns: number, height: number) {
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

function createPointsShell() {
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

function createMapSlabMesh() {
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

export interface NeonThreeSceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  tick: (time: number, signal: ThreeSceneSignal) => void;
  dispose: () => void;
}

export function createNeonThreeScene(mode: ThreeSceneMode): NeonThreeSceneBundle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.void);
  const group = new THREE.Group();
  scene.add(new THREE.AmbientLight("#ffffff", 1.15));
  scene.add(group);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.1, 5.8);

  const tickBase = (time: number) => {
    group.rotation.y = time * 0.00018;
    group.rotation.x = Math.sin(time * 0.00013) * 0.24;
  };

  const bundle = (() => {
    switch (mode) {
      case "lattice": {
        const wires = [1.1, 1.7, 2.3].map((size, index) => {
          const wire = addBoxWire(group, size, index === 1 ? colors.phosphor : colors.signal);
          wire.rotation.x = index * 0.4;
          wire.rotation.y = index * 0.5;
          return wire;
        });
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            tickBase(time);
            wires.forEach((wire, index) => {
              const factor = 1 + signal.depth * 0.18 * ((index + 1) / wires.length);
              wire.scale.setScalar(factor);
              wire.rotation.z = signal.twist * 0.4 * (index + 1);
              wire.position.y = signal.lift * 0.16 * (index - 1);
            });
          },
        };
      }
      case "atfield": {
        const rings = [0.8, 1.25, 1.7].map((radius, index) => {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius, 0.04, 18, 84),
            new THREE.MeshBasicMaterial({
              color: [colors.amber, colors.phosphor, colors.signal][index],
              transparent: true,
              opacity: 0.9,
              wireframe: true,
            }),
          );
          ring.rotation.x = Math.PI / 2;
          group.add(ring);
          return ring;
        });
        const axis = createHelix(colors.violet, 0.34, 1.5, 2.8);
        axis.rotation.z = Math.PI / 2;
        group.add(axis);
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            tickBase(time);
            rings.forEach((ring, index) => {
              const scale = 1 + signal.depth * 0.14 * (index + 1);
              ring.scale.setScalar(scale);
              ring.rotation.z = time * 0.0004 * (index + 1) + signal.twist * 0.6 * (index + 1);
            });
            axis.rotation.y = time * 0.0009 + signal.twist * 0.9;
            axis.scale.setScalar(1 + signal.pulse * 0.12);
            axis.position.y = signal.lift * 0.25;
          },
        };
      }
      case "hexshell": {
        const mesh = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.65, 0)),
          neonLine(colors.phosphor),
        );
        const shellPoints = createPointsShell();
        group.add(mesh, shellPoints);
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            tickBase(time);
            mesh.rotation.z = signal.twist * 0.9;
            mesh.scale.setScalar(1 + signal.depth * 0.16);
            shellPoints.rotation.y = time * 0.0006 + signal.twist * 0.8;
            shellPoints.rotation.x = signal.lift * 0.7;
            shellPoints.position.y = signal.lift * 0.2;
          },
        };
      }
      case "capture": {
        const outer = addBoxWire(group, 2.2, colors.amber);
        const inner = addBoxWire(group, 1.28, colors.signal);
        const axis = createHelix(colors.alarm, 0.55, 3, 2.4);
        axis.rotation.z = Math.PI / 2;
        group.add(axis);
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            tickBase(time);
            outer.rotation.z = time * 0.0004 + signal.twist * 0.8;
            inner.rotation.x = time * 0.0007 - signal.lift * 0.8;
            outer.scale.setScalar(1 + signal.depth * 0.16);
            inner.scale.setScalar(1 + signal.pulse * 0.18);
            axis.rotation.y = time * 0.0008 + signal.twist * 0.8;
            axis.position.y = signal.lift * 0.26;
          },
        };
      }
      case "mapslab": {
        const slab = createMapSlabMesh();
        group.add(slab);
        group.position.y = -0.1;
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            tickBase(time);
            slab.rotation.z = 0.4 + signal.twist * 0.22;
            slab.rotation.x = -0.85 + signal.lift * 0.12;
            slab.scale.set(1 + signal.depth * 0.22, 1 + signal.depth * 0.12, 1);
            slab.position.z = signal.pulse * 0.16;
          },
        };
      }
      case "solenoid": {
        const helixA = createHelix(colors.phosphor, 0.78, 4.5, 3.2);
        const helixB = createHelix(colors.alarm, 1.02, 4.5, 3.2);
        helixB.rotation.y = Math.PI / 2;
        group.add(helixA, helixB);
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            tickBase(time);
            helixA.rotation.y = time * 0.0009 + signal.twist;
            helixB.rotation.x = time * 0.0007 - signal.lift;
            helixA.scale.setScalar(1 + signal.depth * 0.12);
            helixB.scale.setScalar(1 + signal.pulse * 0.18);
            helixA.position.x = signal.twist * -0.35;
            helixB.position.x = signal.twist * 0.35;
          },
        };
      }
      case "studio": {
        scene.background = new THREE.Color("#071017");
        scene.clear();
        scene.add(new THREE.AmbientLight(new THREE.Color("#71828a"), 1.5));

        const keyLight = new THREE.DirectionalLight(new THREE.Color("#fff1c4"), 2.6);
        keyLight.position.set(5, 6, 3);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(new THREE.Color("#7fc0ff"), 1.1);
        fillLight.position.set(-4, 2, 5);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(new THREE.Color("#ff4fd8"), 0.85);
        rimLight.position.set(-3, 4, -2);
        scene.add(rimLight);
        scene.add(group);
        camera.position.set(0, 1.4, 7);

        const torus = new THREE.Mesh(
          new THREE.TorusKnotGeometry(1.25, 0.45, 256, 36),
          new THREE.MeshPhongMaterial({
            color: new THREE.Color("#9cff3a"),
            emissive: new THREE.Color("#163a05"),
            shininess: 60,
            specular: new THREE.Color("#ffffff"),
          }),
        );
        torus.position.set(-1.35, 1.3, 0.2);
        group.add(torus);

        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.9, 64, 64),
          new THREE.MeshPhongMaterial({
            color: new THREE.Color("#1ee7d2"),
            emissive: new THREE.Color("#052f2a"),
            shininess: 100,
            specular: new THREE.Color("#d7f6ff"),
          }),
        );
        sphere.position.set(1.9, 0.7, -0.6);
        group.add(sphere);

        const block = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 1.2, 1.2),
          new THREE.MeshPhongMaterial({
            color: new THREE.Color("#ff4fd8"),
            emissive: new THREE.Color("#3a042e"),
            shininess: 48,
          }),
        );
        block.position.set(0.4, 2.55, -1.9);
        block.rotation.set(0.5, 0.4, 0.2);
        group.add(block);

        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(18, 18, 1, 1),
          new THREE.MeshPhongMaterial({
            color: new THREE.Color("#12212a"),
            specular: new THREE.Color("#0f4039"),
            shininess: 14,
          }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.45;
        scene.add(floor);

        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            const seconds = time * 0.001;
            group.rotation.y = seconds * 0.22 + signal.twist * 0.3;
            torus.rotation.x += 0.028 + signal.pulse * 0.01;
            torus.rotation.y += 0.044 + signal.depth * 0.01;
            sphere.position.y = 0.7 + Math.sin(seconds * 1.1) * (0.2 + signal.depth * 0.1);
            sphere.rotation.y += 0.055;
            block.rotation.x += 0.035 + signal.lift * 0.01;
            block.rotation.z += 0.025 + signal.twist * 0.01;
          },
        };
      }
    }
  })();

  return {
    scene,
    camera,
    tick: bundle.tick,
    dispose: () => releaseScene(scene),
  };
}

function releaseScene(root: THREE.Object3D) {
  // ThreeAsciiObject tears down its renderer first. Disposing WebGPU-backed
  // materials after that triggers a Three.js NodeManager crash during layout
  // switches, so we only detach the graph and let GC reclaim the scene objects.
  root.clear();
}
