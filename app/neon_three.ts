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

function addPanel(
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

function addWirePanel(
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

function createPolyline(points: THREE.Vector3[], color: string) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, neonLine(color));
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

function createWaveRibbon(color: string, count = 96) {
  const points = Array.from({ length: count }, (_, index) => {
    const x = (index / (count - 1) - 0.5) * 4.2;
    const y = Math.sin(index * 0.28) * 0.42 + Math.sin(index * 0.071) * 0.18;
    return new THREE.Vector3(x, y, Math.cos(index * 0.19) * 0.22);
  });
  return createPolyline(points, color);
}

function createReticle(color: string, radius: number) {
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
      case "emergency": {
        camera.position.set(0, 0.2, 6.2);
        const stripes = Array.from({ length: 10 }, (_, index) => {
          const color = index % 2 === 0 ? colors.alarm : colors.void;
          const stripe = addPanel(group, 0.32, 3.4, color, [(index - 4.5) * 0.48, 0, 0], index % 2 === 0 ? 0.94 : 0.35);
          stripe.rotation.z = Math.PI / 4;
          return stripe;
        });
        const topRail = addWirePanel(group, 4.8, 0.42, colors.amber, [0, 1.48, 0.12]);
        const bottomRail = addWirePanel(group, 4.8, 0.42, colors.amber, [0, -1.48, 0.12]);
        const warning = addWirePanel(group, 1.9, 0.82, colors.alarm, [0, 0, 0.22]);
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            const seconds = time * 0.001;
            group.rotation.y = signal.twist * 0.24;
            group.rotation.x = Math.sin(seconds * 0.7) * 0.08;
            stripes.forEach((stripe, index) => {
              stripe.position.x = ((index - 4.5) * 0.48 + (seconds * (signal.pressed ? 1.4 : 0.48)) % 0.96) - 0.48;
              stripe.scale.y = 1 + signal.pulse * 0.18;
            });
            topRail.scale.x = 1 + signal.depth * 0.08;
            bottomRail.scale.x = 1 + signal.depth * 0.08;
            warning.scale.setScalar(1 + Math.sin(seconds * 5.5) * 0.08 + signal.pulse * 0.08);
          },
        };
      }
      case "launch": {
        camera.position.set(0, 0.4, 6.8);
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.86, 1.08, 3.2, 36, 4, true),
          new THREE.MeshBasicMaterial({ color: colors.signal, wireframe: true, transparent: true, opacity: 0.85 }),
        );
        shaft.rotation.x = Math.PI / 2;
        group.add(shaft);
        const plug = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.34, 2.6, 24, 2, false),
          new THREE.MeshBasicMaterial({ color: colors.alarm, wireframe: true }),
        );
        plug.rotation.x = Math.PI / 2;
        group.add(plug);
        const rails = [-1.35, -0.78, 0.78, 1.35].map((x) =>
          createPolyline([new THREE.Vector3(x, -1.65, 0.3), new THREE.Vector3(x, 1.65, -0.3)], colors.amber)
        );
        group.add(...rails);
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            tickBase(time);
            shaft.rotation.z = time * 0.00035 + signal.twist * 0.25;
            plug.position.y = signal.lift * 0.55;
            plug.scale.setScalar(1 + signal.pulse * 0.1);
            rails.forEach((rail, index) => {
              rail.position.z = Math.sin(time * 0.001 + index) * 0.12 * signal.depth;
            });
          },
        };
      }
      case "magi": {
        camera.position.set(0, 0.25, 6.3);
        const panels = [
          addWirePanel(group, 1.52, 2.1, colors.alarm, [-1.42, 0.08, 0]),
          addWirePanel(group, 1.52, 2.1, colors.signal, [0, 0.08, 0.1]),
          addWirePanel(group, 1.52, 2.1, colors.phosphor, [1.42, 0.08, 0]),
        ];
        const nodes = Array.from({ length: 18 }, (_, index) => {
          const node = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.1, 0.04),
            new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? colors.amber : colors.phosphor }),
          );
          node.position.set((index % 6 - 2.5) * 0.42, 1.1 - Math.floor(index / 6) * 0.45, 0.2);
          group.add(node);
          return node;
        });
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            group.rotation.y = signal.twist * 0.32;
            group.rotation.x = signal.lift * 0.12;
            panels.forEach((panel, index) => {
              panel.rotation.y = (index - 1) * 0.18 + signal.twist * 0.16;
              panel.scale.y = 1 + signal.depth * 0.12 * (index + 1);
            });
            nodes.forEach((node, index) => {
              node.scale.x = 0.5 + ((Math.sin(time * 0.002 + index) + 1) / 2) * (0.5 + signal.pulse);
            });
          },
        };
      }
      case "target": {
        camera.position.set(0, 0.05, 6.1);
        const reticles = [0.72, 1.18, 1.62].map((radius, index) => {
          const reticle = createReticle([colors.phosphor, colors.amber, colors.alarm][index], radius);
          reticle.rotation.x = Math.PI / 2;
          group.add(reticle);
          return reticle;
        });
        const target = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          new THREE.MeshBasicMaterial({ color: colors.signal, wireframe: true }),
        );
        group.add(target);
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            group.rotation.y = signal.twist * 0.38;
            reticles.forEach((reticle, index) => {
              reticle.rotation.z = time * 0.00035 * (index + 1) * (index % 2 === 0 ? 1 : -1);
              reticle.scale.setScalar(1 + signal.depth * 0.08 * (index + 1));
            });
            target.position.set((signal.x - 0.5) * 1.8, (0.5 - signal.y) * 1.2, signal.pulse * 0.35);
            target.rotation.y = time * 0.0011;
          },
        };
      }
      case "waveform": {
        camera.position.set(0, 0, 6.4);
        const ribbons = [colors.signal, colors.alarm, colors.amber].map((color, index) => {
          const ribbon = createWaveRibbon(color);
          ribbon.position.y = (index - 1) * 0.55;
          group.add(ribbon);
          return ribbon;
        });
        const grid = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.PlaneGeometry(4.6, 2.4, 12, 6)),
          neonLine(colors.violet),
        );
        grid.rotation.x = 0.08;
        group.add(grid);
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            group.rotation.x = signal.lift * 0.16;
            group.rotation.y = signal.twist * 0.24;
            ribbons.forEach((ribbon, index) => {
              ribbon.position.x = Math.sin(time * 0.0014 + index) * 0.38;
              ribbon.scale.y = 0.8 + signal.pulse * (0.4 + index * 0.18);
              ribbon.rotation.z = Math.sin(time * 0.0009 + index) * 0.12;
            });
          },
        };
      }
      case "angel": {
        camera.position.set(0, 0.15, 6.5);
        const core = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.7, 1),
          new THREE.MeshBasicMaterial({ color: colors.alarm, wireframe: true }),
        );
        group.add(core);
        const helixA = createHelix(colors.signal, 0.55, 2.7, 3.4);
        const helixB = createHelix(colors.amber, 0.9, 1.7, 3.2);
        helixA.rotation.z = Math.PI / 2;
        helixB.rotation.z = Math.PI / 2;
        const wings = [-1, 1].map((side) => {
          const wing = createPolyline(
            [
              new THREE.Vector3(0.25 * side, -0.4, 0),
              new THREE.Vector3(1.05 * side, 0.1, 0.18),
              new THREE.Vector3(1.55 * side, 0.82, -0.1),
              new THREE.Vector3(0.68 * side, 0.48, 0.22),
            ],
            colors.phosphor,
          );
          group.add(wing);
          return wing;
        });
        group.add(helixA, helixB);
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            tickBase(time);
            core.rotation.x = time * 0.0008 + signal.lift * 0.5;
            core.rotation.y = time * 0.001 + signal.twist;
            core.scale.setScalar(1 + signal.pulse * 0.22);
            helixA.rotation.y = time * 0.0009;
            helixB.rotation.x = time * 0.0007;
            wings.forEach((wing, index) => {
              wing.rotation.z = (index === 0 ? 1 : -1) * (0.18 + signal.depth * 0.22);
            });
          },
        };
      }
      case "gate": {
        camera.position.set(0, 0.15, 6.0);
        const gates = Array.from({ length: 8 }, (_, index) => {
          const gate = addPanel(
            group,
            0.34,
            2.8,
            index % 2 === 0 ? colors.signal : colors.alarm,
            [(index - 3.5) * 0.42, 0, 0],
            0.86,
          );
          return gate;
        });
        const clamps = [-1.72, 1.72].map((x) => addWirePanel(group, 0.44, 3.25, colors.amber, [x, 0, 0.18]));
        return {
          tick: (time: number, signal: ThreeSceneSignal) => {
            group.rotation.y = signal.twist * 0.2;
            gates.forEach((gate, index) => {
              const open = Math.sin(time * 0.0012 + index * 0.65) * 0.18 + signal.depth * 0.16;
              gate.position.x = (index - 3.5) * 0.42 + (index < 4 ? -open : open);
              gate.scale.y = 1 + signal.pulse * 0.12;
            });
            clamps.forEach((clamp, index) => {
              clamp.position.x = (index === 0 ? -1.72 : 1.72) + (index === 0 ? -signal.depth : signal.depth) * 0.14;
            });
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
