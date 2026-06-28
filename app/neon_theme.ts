import type { Accent } from "./types.ts";

export const colors = {
  void: "#05070d",
  alarm: "#ff4231",
  amber: "#ff9f24",
  phosphor: "#7dffba",
  signal: "#5bb0ff",
  violet: "#b17cff",
};

export type NeonSection = "overview" | "signals" | "control" | "three";

export interface NeonDemo {
  id: string;
  title: string;
  code: string;
  badge: string;
  subtitle: string;
  accent: Accent;
  section: NeonSection;
}

export const demos: NeonDemo[] = [
  {
    id: "warning-stack",
    title: "Warning Stack",
    code: "ALERT-000",
    badge: "WARN",
    subtitle: "Typography as interrupt",
    accent: "alarm",
    section: "overview",
  },
  {
    id: "counter-board",
    title: "Counter And Clock Boards",
    code: "TIME-SEG",
    badge: "TIME",
    subtitle: "Stepped numeric boards",
    accent: "signal",
    section: "overview",
  },
  {
    id: "profile-card",
    title: "Pilot State Card",
    code: "TEST-PLUG-02",
    badge: "PILOT",
    subtitle: "Identity and diagnostics overlay",
    accent: "violet",
    section: "overview",
  },
  {
    id: "live-feed",
    title: "Live Feed / Corruption",
    code: "LIVE-07",
    badge: "LIVE",
    subtitle: "Low-fidelity surveillance panel",
    accent: "alarm",
    section: "overview",
  },
  {
    id: "event-log",
    title: "Event Log",
    code: "LOG-223.229",
    badge: "LOG",
    subtitle: "Dense edge-annotated telemetry",
    accent: "amber",
    section: "overview",
  },
  {
    id: "channel-matrix",
    title: "Channel Matrix",
    code: "MATRIX-C",
    badge: "MATRIX",
    subtitle: "Stepped test-plug and reserve columns",
    accent: "phosphor",
    section: "overview",
  },
  {
    id: "telemetry-rack",
    title: "Telemetry Rack",
    code: "LIFE-SUPPORT",
    badge: "RACK",
    subtitle: "Asynchronous meter walls",
    accent: "alarm",
    section: "signals",
  },
  {
    id: "biosignal-strip",
    title: "Biosignal Strip",
    code: "WAVE-85",
    badge: "BIO",
    subtitle: "Drifting traces and threshold events",
    accent: "phosphor",
    section: "signals",
  },
  {
    id: "harmonic-graph",
    title: "Harmonic Graph",
    code: "SIM-GRAPH A+",
    badge: "HARM",
    subtitle: "Interference curves and psychograph bleed",
    accent: "violet",
    section: "signals",
  },
  {
    id: "psychograph",
    title: "Psychograph Display",
    code: "PHASE-4",
    badge: "PSY",
    subtitle: "Behavioral scribble display",
    accent: "amber",
    section: "signals",
  },
  {
    id: "field-ring",
    title: "Field Ring Capture",
    code: "CAPTURE-01",
    badge: "FIELD",
    subtitle: "Locking reticle and field concentration",
    accent: "signal",
    section: "signals",
  },
  {
    id: "hex-heatmap",
    title: "Hex Heatmap",
    code: "AREA-DENSITY",
    badge: "HEX",
    subtitle: "Concentrated field occupation",
    accent: "amber",
    section: "signals",
  },
  {
    id: "magi-board",
    title: "MAGI Decision Board",
    code: "CODE-239",
    badge: "MAGI",
    subtitle: "Discrete voting reconfiguration",
    accent: "amber",
    section: "control",
  },
  {
    id: "route-board",
    title: "Route / Gate Board",
    code: "ENTRY-PLUG",
    badge: "ROUTE",
    subtitle: "Mechanical routing and disconnect states",
    accent: "alarm",
    section: "control",
  },
  {
    id: "gate-status",
    title: "Infrastructure Gates",
    code: "CL3-SEG",
    badge: "GATES",
    subtitle: "Open, locked, and refused mechanical states",
    accent: "signal",
    section: "control",
  },
  {
    id: "tactical-map",
    title: "Tactical Map",
    code: "TOKYO-3 / LIVE",
    badge: "MAP",
    subtitle: "Topographic scan sweep and target boxes",
    accent: "phosphor",
    section: "control",
  },
  {
    id: "network-topology",
    title: "Network Topology",
    code: "NERV-TOPOLOGY",
    badge: "NET",
    subtitle: "Localized breaks and mesh redraw",
    accent: "amber",
    section: "control",
  },
  {
    id: "component-index",
    title: "Component Index",
    code: "SUITE-ALL",
    badge: "INDEX",
    subtitle: "All selectable demo surfaces",
    accent: "amber",
    section: "control",
  },
  {
    id: "three-lattice",
    title: "Wireframe Lattice Chamber",
    code: "THREE-5",
    badge: "LATTICE",
    subtitle: "Nested cubic rails with slow axial drift and pilot-cage geometry.",
    accent: "signal",
    section: "three",
  },
  {
    id: "three-atfield",
    title: "A.T.Field Ring Volume",
    code: "THREE-6",
    badge: "A.T",
    subtitle: "Rotating torus stack wrapped around a violet harmonic spine.",
    accent: "amber",
    section: "three",
  },
  {
    id: "three-hexshell",
    title: "Hex Cell Shell",
    code: "THREE-7",
    badge: "HEXCELL",
    subtitle: "Geodesic shell study for defensive barrier and armor-cell readouts.",
    accent: "phosphor",
    section: "three",
  },
  {
    id: "three-capture",
    title: "Capture Cage",
    code: "THREE-8",
    badge: "CAGE",
    subtitle: "Twin containment cages with a live central helix for lock-state sweeps.",
    accent: "alarm",
    section: "three",
  },
  {
    id: "three-mapslab",
    title: "Volumetric Map Slab",
    code: "THREE-9",
    badge: "SLAB",
    subtitle: "Topographic wire slab for city-grid terrain and underground route plots.",
    accent: "phosphor",
    section: "three",
  },
  {
    id: "three-solenoid",
    title: "Solenoid Field Volume",
    code: "THREE-0",
    badge: "COIL",
    subtitle: "Crossed coils for field compression, inductive resonance, and surge scans.",
    accent: "violet",
    section: "three",
  },
  {
    id: "three-ascii-studio",
    title: "Acerola ASCII Studio",
    code: "ASCII-GPU",
    badge: "ACEROLA",
    subtitle: "The torus, sphere, block, and stage scene from the Three ASCII demo.",
    accent: "signal",
    section: "three",
  },
];

export function formatCountdown(phase: number): string {
  const total = Math.max(0, 7 * 60 + 12 - (Math.floor(phase) % 380));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  const centiseconds = String((Math.floor(phase) * 3) % 100).padStart(2, "0");
  return `${minutes}:${seconds}:${centiseconds}`;
}
