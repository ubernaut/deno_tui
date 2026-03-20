import { crayon } from "https://deno.land/x/crayon@3.3.3/mod.ts";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusKnotGeometry,
} from "npm:three@0.183.2";

import { handleInput } from "../src/input.ts";
import { handleKeyboardControls } from "../src/controls.ts";
import { Box } from "../src/components/box.ts";
import { Frame } from "../src/components/frame.ts";
import { Text } from "../src/components/text.ts";
import { ThreeAscii } from "../src/components/three_ascii.ts";
import { emptyStyle } from "../src/theme.ts";
import {
  ASCII_DEMO_PRESETS,
  ASCII_NUMERIC_CONTROLS,
  ASCII_TOGGLE_CONTROLS,
  DEFAULT_ASCII_DEMO_EFFECT,
} from "../src/three_ascii/demo_presets.ts";
import { Computed, Signal, Tui } from "../mod.ts";

const tui = new Tui({
  style: crayon.bgBlack,
  refreshRate: 1000 / 30,
});

handleInput(tui);
handleKeyboardControls(tui);
tui.dispatch();
tui.run();

const scene = new Scene();
scene.background = new Color("#071017");

const camera = new PerspectiveCamera(42, 1, 0.1, 40);
camera.position.set(0, 1.4, 7);

scene.add(new AmbientLight(new Color("#71828a"), 1.5));

const keyLight = new DirectionalLight(new Color("#fff1c4"), 2.6);
keyLight.position.set(5, 6, 3);
scene.add(keyLight);

const fillLight = new DirectionalLight(new Color("#7fc0ff"), 1.1);
fillLight.position.set(-4, 2, 5);
scene.add(fillLight);

const rimLight = new DirectionalLight(new Color("#ff4fd8"), 0.85);
rimLight.position.set(-3, 4, -2);
scene.add(rimLight);

const stage = new Group();
scene.add(stage);

const torus = new Mesh(
  new TorusKnotGeometry(1.25, 0.45, 256, 36),
  new MeshPhongMaterial({
    color: new Color("#9cff3a"),
    emissive: new Color("#163a05"),
    shininess: 60,
    specular: new Color("#ffffff"),
  }),
);
torus.position.set(-1.35, 1.3, 0.2);
stage.add(torus);

const sphere = new Mesh(
  new SphereGeometry(0.9, 64, 64),
  new MeshPhongMaterial({
    color: new Color("#1ee7d2"),
    emissive: new Color("#052f2a"),
    shininess: 100,
    specular: new Color("#d7f6ff"),
  }),
);
sphere.position.set(1.9, 0.7, -0.6);
stage.add(sphere);

const block = new Mesh(
  new BoxGeometry(1.2, 1.2, 1.2),
  new MeshPhongMaterial({
    color: new Color("#ff4fd8"),
    emissive: new Color("#3a042e"),
    shininess: 48,
  }),
);
block.position.set(0.4, 2.55, -1.9);
block.rotation.set(0.5, 0.4, 0.2);
stage.add(block);

const floor = new Mesh(
  new PlaneGeometry(18, 18, 1, 1),
  new MeshPhongMaterial({
    color: new Color("#12212a"),
    specular: new Color("#0f4039"),
    shininess: 14,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.45;
scene.add(floor);

new Text({
  parent: tui,
  theme: { base: crayon.white },
  text: "three_ascii demo | M controls | Esc / Ctrl+C to exit",
  rectangle: {
    column: 2,
    row: 0,
  },
  zIndex: 2,
});

const menuVisible = new Signal(true);
const selectedRow = new Signal(0);
const menuWidth = 34;
const panelOuterWidth = menuWidth + 2;
const panelGap = 2;

const ascii = new ThreeAscii({
  parent: tui,
  theme: { base: emptyStyle },
  rectangle: new Computed(() => {
    const reservePanel = menuVisible.value &&
      tui.rectangle.value.width >= 20 + panelOuterWidth + panelGap + 4;

    return {
      column: 2,
      row: 2,
      width: Math.max(
        20,
        tui.rectangle.value.width - 4 - (reservePanel ? panelOuterWidth + panelGap : 0),
      ),
      height: Math.max(10, tui.rectangle.value.height - 4),
    };
  }),
  zIndex: 1,
  scene,
  camera,
  effect: { ...DEFAULT_ASCII_DEMO_EFFECT },
  terminalEdgeBias: 1,
  onFrame: (deltaTime) => {
    stage.rotation.y += deltaTime * 0.22;
    torus.rotation.x += deltaTime * 0.28;
    torus.rotation.y += deltaTime * 0.44;
    sphere.position.y = 0.7 + Math.sin(performance.now() * 0.0011) * 0.26;
    sphere.rotation.y += deltaTime * 0.55;
    block.rotation.x += deltaTime * 0.35;
    block.rotation.z += deltaTime * 0.25;
  },
});

type ToggleKey = (typeof ASCII_TOGGLE_CONTROLS)[number]["key"];
type NumericKey = (typeof ASCII_NUMERIC_CONTROLS)[number]["key"];

interface ToggleRow {
  type: "toggle";
  key: ToggleKey;
  label: string;
}

interface NumericRow {
  type: "numeric";
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
}

interface PresetRow {
  type: "preset";
  label: string;
}

interface EdgeBiasRow {
  type: "terminalEdgeBias";
  label: string;
  min: number;
  max: number;
  step: number;
}

type MenuRow = PresetRow | ToggleRow | NumericRow | EdgeBiasRow;

const panelRows: readonly MenuRow[] = [
  { type: "preset", label: "Preset" },
  ...ASCII_TOGGLE_CONTROLS.map((control) => ({ type: "toggle", key: control.key, label: control.label }) as ToggleRow),
  ...ASCII_NUMERIC_CONTROLS.map((control) => ({
    type: "numeric",
    key: control.key,
    label: control.label,
    min: control.min,
    max: control.max,
    step: control.step,
    format: control.format,
  }) as NumericRow),
  { type: "terminalEdgeBias", label: "Terminal edge bias", min: 0.6, max: 1.8, step: 0.05 },
] as const;
const menuLines = panelRows.map(() => new Signal(""));
const menuSubtitle = new Signal("Arrows tune | 1-5 presets");
const activePresetId = new Signal("balanced");

const effectState = {
  edges: DEFAULT_ASCII_DEMO_EFFECT.edges ?? true,
  fill: DEFAULT_ASCII_DEMO_EFFECT.fill ?? true,
  invertLuminance: DEFAULT_ASCII_DEMO_EFFECT.invertLuminance ?? false,
  edgeThreshold: DEFAULT_ASCII_DEMO_EFFECT.edgeThreshold ?? 10,
  normalThreshold: DEFAULT_ASCII_DEMO_EFFECT.normalThreshold ?? 0.18,
  depthThreshold: DEFAULT_ASCII_DEMO_EFFECT.depthThreshold ?? 0.11,
  exposure: DEFAULT_ASCII_DEMO_EFFECT.exposure ?? 1.25,
  attenuation: DEFAULT_ASCII_DEMO_EFFECT.attenuation ?? 1.2,
  blendWithBase: DEFAULT_ASCII_DEMO_EFFECT.blendWithBase ?? 0.24,
  depthFalloff: DEFAULT_ASCII_DEMO_EFFECT.depthFalloff ?? 0.18,
  depthOffset: DEFAULT_ASCII_DEMO_EFFECT.depthOffset ?? 110,
};
let terminalEdgeBias = 1;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const getAsciiObject = () => ascii.drawnObjects.three_ascii;

function applyEffectPatch(patch: Partial<typeof effectState>): void {
  Object.assign(effectState, patch);
  getAsciiObject()?.setEffectOptions(patch);
}

function applyTerminalEdgeBias(value: number): void {
  terminalEdgeBias = clamp(value, 0.6, 1.8);
  getAsciiObject()?.setTerminalEdgeBias(terminalEdgeBias);
}

function applyPresetByIndex(index: number): void {
  const preset = ASCII_DEMO_PRESETS[(index + ASCII_DEMO_PRESETS.length) % ASCII_DEMO_PRESETS.length];
  const nextEffect = { ...DEFAULT_ASCII_DEMO_EFFECT, ...preset.effect };
  applyEffectPatch({
    edges: nextEffect.edges ?? effectState.edges,
    fill: nextEffect.fill ?? effectState.fill,
    invertLuminance: nextEffect.invertLuminance ?? effectState.invertLuminance,
    edgeThreshold: nextEffect.edgeThreshold ?? effectState.edgeThreshold,
    normalThreshold: nextEffect.normalThreshold ?? effectState.normalThreshold,
    depthThreshold: nextEffect.depthThreshold ?? effectState.depthThreshold,
    exposure: nextEffect.exposure ?? effectState.exposure,
    attenuation: nextEffect.attenuation ?? effectState.attenuation,
    blendWithBase: nextEffect.blendWithBase ?? effectState.blendWithBase,
    depthFalloff: nextEffect.depthFalloff ?? effectState.depthFalloff,
    depthOffset: nextEffect.depthOffset ?? effectState.depthOffset,
  });
  applyTerminalEdgeBias(preset.terminalEdgeBias ?? 1);
  activePresetId.value = preset.id;
  refreshMenu();
}

function cyclePreset(delta: number): void {
  const currentIndex = Math.max(0, ASCII_DEMO_PRESETS.findIndex((preset) => preset.id === activePresetId.peek()));
  applyPresetByIndex(currentIndex + delta);
}

function refreshMenu(): void {
  const activePreset = ASCII_DEMO_PRESETS.find((preset) => preset.id === activePresetId.peek());
  menuSubtitle.value = activePreset
    ? `${activePreset.label} | arrows | 1-5`
    : "Custom | arrows | 1-5";

  panelRows.forEach((row, index) => {
    const marker = selectedRow.peek() === index ? ">" : " ";
    let value = "";

    if (row.type === "preset") {
      value = activePreset?.label ?? "Custom";
    } else if (row.type === "toggle") {
      value = effectState[row.key] ? "on" : "off";
    } else if (row.type === "numeric") {
      const numericValue = effectState[row.key];
      value = row.format ? row.format(numericValue) : numericValue.toString();
    } else {
      value = terminalEdgeBias.toFixed(2);
    }

    menuLines[index].value = `${marker} ${row.label.padEnd(18)} ${value}`;
  });
}

function adjustSelected(delta: number): void {
  const row = panelRows[selectedRow.peek()];
  if (!row) {
    return;
  }

  if (row.type === "preset") {
    cyclePreset(delta);
    return;
  }

  if (row.type === "toggle") {
    applyEffectPatch({ [row.key]: !effectState[row.key] } as Partial<typeof effectState>);
    activePresetId.value = "";
    refreshMenu();
    return;
  }

  if (row.type === "numeric") {
    const nextValue = clamp(effectState[row.key] + delta * row.step, row.min, row.max);
    applyEffectPatch({ [row.key]: nextValue } as Partial<typeof effectState>);
    activePresetId.value = "";
    refreshMenu();
    return;
  }

  applyTerminalEdgeBias(terminalEdgeBias + delta * row.step);
  activePresetId.value = "";
  refreshMenu();
}

const panelRectangle = new Computed(() => ({
  column: Math.max(3, tui.rectangle.value.width - menuWidth - 4),
  row: 3,
  width: menuWidth,
  height: panelRows.length + 2,
}));

new Box({
  parent: tui,
  theme: { base: crayon.bgBlack.white },
  rectangle: panelRectangle,
  visible: menuVisible,
  zIndex: 5,
});

new Frame({
  parent: tui,
  theme: { base: crayon.white },
  rectangle: panelRectangle,
  visible: menuVisible,
  zIndex: 6,
  charMap: "rounded",
});

new Text({
  parent: tui,
  theme: { base: crayon.white },
  text: "ASCII Controls",
  rectangle: new Computed(() => ({
    column: panelRectangle.value.column + 1,
    row: panelRectangle.value.row,
  })),
  visible: menuVisible,
  zIndex: 7,
});

new Text({
  parent: tui,
  theme: { base: crayon.lightBlack },
  text: menuSubtitle,
  rectangle: new Computed(() => ({
    column: panelRectangle.value.column + 1,
    row: panelRectangle.value.row + 1,
  })),
  visible: menuVisible,
  zIndex: 7,
});

menuLines.forEach((line, index) => {
  new Text({
    parent: tui,
    theme: { base: crayon.white },
    text: line,
    rectangle: new Computed(() => ({
      column: panelRectangle.value.column + 1,
      row: panelRectangle.value.row + 2 + index,
    })),
    visible: menuVisible,
    zIndex: 7,
  });
});

tui.on("keyPress", ({ key, ctrl, meta, shift }) => {
  if (ctrl || meta || shift) {
    return;
  }

  if (key === "m") {
    menuVisible.value = !menuVisible.peek();
    return;
  }

  if (key >= "1" && key <= "5") {
    applyPresetByIndex(Number(key) - 1);
    return;
  }

  if (!menuVisible.peek()) {
    return;
  }

  if (key === "up") {
    selectedRow.value = (selectedRow.peek() + panelRows.length - 1) % panelRows.length;
    refreshMenu();
    return;
  }

  if (key === "down") {
    selectedRow.value = (selectedRow.peek() + 1) % panelRows.length;
    refreshMenu();
    return;
  }

  if (key === "left") {
    adjustSelected(-1);
    return;
  }

  if (key === "right" || key === "return") {
    adjustSelected(1);
  }
});

refreshMenu();
