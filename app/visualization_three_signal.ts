import { clamp } from "./styles.ts";
import type { RenderContext, ThreeSceneMode, ThreeSceneSignal } from "./types.ts";
import type { VisualizationDrive } from "./visualization_drive.ts";

export function driveThreeSignal(
  context: RenderContext,
  drive: VisualizationDrive,
  mode: ThreeSceneMode,
): ThreeSceneSignal {
  const modeBias = modeTwist(mode);
  const wobble = Math.sin((drive.phase + modeBias.phase) * modeBias.speed);
  const twist = clamp(drive.imbalance * 1.2 + wobble * modeBias.offset * (0.6 + drive.divergence * 0.8), -1, 1);
  const lift = clamp(
    drive.slope * 1.7 + drive.jerk * 0.55 + modeBias.lift * (drive.current - 0.5) +
      Math.cos(drive.phase * 0.09) * 0.12,
    -1,
    1,
  );
  const pulse = clamp(0.12 + drive.current * 0.3 + drive.volatility * 0.2 + drive.hazard * 0.38, 0.12, 1);
  const depth = clamp(0.14 + drive.absolute * 0.24 + drive.divergence * 0.16 + drive.hazard * 0.34, 0.12, 0.98);

  return {
    x: clamp(0.5 + twist * 0.22 + Math.sin((drive.phase + modeBias.phase) * 0.04) * drive.cadence * 0.08, 0, 1),
    y: clamp(0.5 - lift * 0.22 + Math.cos((drive.phase + modeBias.phase) * 0.05) * drive.volatility * 0.07, 0, 1),
    depth,
    twist,
    lift,
    pulse,
    active: pulse > 0.18 || drive.activeCount > 0,
    pressed: context.system.alerts.some((alert) => alert.severity === "alarm") || drive.hazard >= 0.9,
  };
}

export function modeTwist(mode: ThreeSceneMode) {
  switch (mode) {
    case "lattice":
      return { phase: 0, speed: 0.12, offset: 0.18, lift: 0.32 };
    case "atfield":
      return { phase: 5, speed: 0.1, offset: 0.24, lift: 0.24 };
    case "hexshell":
      return { phase: 9, speed: 0.08, offset: 0.2, lift: 0.5 };
    case "capture":
      return { phase: 13, speed: 0.11, offset: 0.26, lift: 0.18 };
    case "mapslab":
      return { phase: 17, speed: 0.07, offset: 0.14, lift: 0.58 };
    case "solenoid":
      return { phase: 21, speed: 0.14, offset: 0.22, lift: 0.28 };
    case "studio":
      return { phase: 25, speed: 0.09, offset: 0.3, lift: 0.2 };
    case "emergency":
      return { phase: 29, speed: 0.16, offset: 0.32, lift: 0.16 };
    case "counter":
      return { phase: 31, speed: 0.13, offset: 0.18, lift: 0.12 };
    case "plug":
      return { phase: 32, speed: 0.08, offset: 0.16, lift: 0.3 };
    case "surveillance":
      return { phase: 34, speed: 0.09, offset: 0.24, lift: 0.18 };
    case "relay":
      return { phase: 35, speed: 0.15, offset: 0.26, lift: 0.2 };
    case "rack":
      return { phase: 36, speed: 0.14, offset: 0.2, lift: 0.16 };
    case "scope":
      return { phase: 38, speed: 0.18, offset: 0.34, lift: 0.34 };
    case "biosignal":
      return { phase: 38, speed: 0.2, offset: 0.32, lift: 0.3 };
    case "harmonic":
      return { phase: 39, speed: 0.09, offset: 0.22, lift: 0.24 };
    case "psychograph":
      return { phase: 40, speed: 0.17, offset: 0.36, lift: 0.32 };
    case "field":
      return { phase: 41, speed: 0.13, offset: 0.28, lift: 0.24 };
    case "heat":
      return { phase: 39, speed: 0.1, offset: 0.22, lift: 0.42 };
    case "route":
      return { phase: 40, speed: 0.1, offset: 0.2, lift: 0.48 };
    case "topology":
      return { phase: 42, speed: 0.09, offset: 0.22, lift: 0.24 };
    case "command":
      return { phase: 44, speed: 0.07, offset: 0.16, lift: 0.18 };
    case "launch":
      return { phase: 33, speed: 0.1, offset: 0.2, lift: 0.5 };
    case "magi":
      return { phase: 37, speed: 0.06, offset: 0.14, lift: 0.18 };
    case "target":
      return { phase: 41, speed: 0.13, offset: 0.28, lift: 0.22 };
    case "waveform":
      return { phase: 45, speed: 0.18, offset: 0.34, lift: 0.34 };
    case "angel":
      return { phase: 49, speed: 0.08, offset: 0.22, lift: 0.48 };
    case "gate":
      return { phase: 53, speed: 0.12, offset: 0.18, lift: 0.42 };
  }
}
