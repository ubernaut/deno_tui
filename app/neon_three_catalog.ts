import { type ThreeSceneMode, threeSceneModes } from "./types.ts";

export interface NeonThreeSceneDescriptor {
  mode: ThreeSceneMode;
  label: string;
  family: "acerola" | "monitor" | "nge";
}

const modeLabels = {
  lattice: "LATTICE",
  atfield: "AT-FIELD",
  hexshell: "HEX SHELL",
  capture: "CAPTURE",
  mapslab: "MAP SLAB",
  solenoid: "SOLENOID",
  studio: "ACEROLA",
  emergency: "EMERGENCY",
  counter: "COUNTER",
  plug: "TEST PLUG",
  surveillance: "SURVEIL",
  relay: "RELAY",
  rack: "RACK",
  scope: "SCOPE",
  biosignal: "BIOSIGNAL",
  harmonic: "HARMONIC",
  psychograph: "PSYCHO",
  field: "FIELD",
  heat: "HEX FIELD",
  route: "ROUTE",
  topology: "TOPOLOGY",
  command: "COMMAND",
  launch: "LAUNCH",
  magi: "MAGI",
  target: "TARGET",
  waveform: "WAVEFORM",
  angel: "ANGEL",
  gate: "GATE",
} as const satisfies Record<ThreeSceneMode, string>;

const modeFamilies = {
  lattice: "monitor",
  atfield: "monitor",
  hexshell: "monitor",
  capture: "monitor",
  mapslab: "monitor",
  solenoid: "monitor",
  studio: "acerola",
  emergency: "nge",
  counter: "nge",
  plug: "nge",
  surveillance: "nge",
  relay: "nge",
  rack: "nge",
  scope: "nge",
  biosignal: "nge",
  harmonic: "nge",
  psychograph: "nge",
  field: "nge",
  heat: "nge",
  route: "nge",
  topology: "nge",
  command: "nge",
  launch: "nge",
  magi: "nge",
  target: "nge",
  waveform: "nge",
  angel: "nge",
  gate: "nge",
} as const satisfies Record<ThreeSceneMode, NeonThreeSceneDescriptor["family"]>;

export const neonThreeSceneCatalog: readonly NeonThreeSceneDescriptor[] = threeSceneModes.map((mode) => ({
  mode,
  label: modeLabels[mode],
  family: modeFamilies[mode],
}));

export const neonThreeSceneModeLabels: Readonly<Record<ThreeSceneMode, string>> = modeLabels;

export function neonThreeSceneModeLabel(mode: ThreeSceneMode): string {
  return modeLabels[mode];
}
