/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import {
  ASCII_DEMO_PRESETS,
  type AsciiDemoPreset,
  BoxObject,
  Computed,
  createAnsiStyle,
  createWebTui,
  DEFAULT_ASCII_DEMO_EFFECT,
  probeCompatibleWebGPUDevice,
  Signal,
  TERMINAL_GLYPH_STYLES,
  type TerminalGlyphStyle,
  TextObject,
  type TextRectangle,
  ThreeAsciiObject,
} from "../../mod.web.ts";
import { createNeonThreeScene } from "../../app/neon_three.ts";
import { type ThreeSceneMode, threeSceneModes } from "../../app/types.ts";

const root = document.querySelector<HTMLElement>("#three-ascii");
if (!root) throw new Error("Missing #three-ascii mount element.");

const host = createWebTui({
  root,
  refreshRate: 1000 / 60,
  sinkOptions: {
    cellWidth: 8,
    cellHeight: 14,
    foreground: "#eff7ff",
    background: "#05070d",
    font: "13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
});

const sceneModes: ThreeSceneMode[] = [...threeSceneModes];
const sceneIndex = new Signal(0);
const presetIndex = new Signal(Math.max(0, ASCII_DEMO_PRESETS.findIndex((preset) => preset.id === "opentui-blocks")));
const glyphIndex = new Signal(Math.max(0, TERMINAL_GLYPH_STYLES.indexOf("blocks")));
const paused = new Signal(false);
const webgpuReady = new Signal("probing webgpu");
const status = new Signal("initializing acerola ascii renderer");

let bundle = createNeonThreeScene(sceneModes[sceneIndex.peek()]!);

new BoxObject({
  canvas: host.canvas,
  rectangle: new Computed(() => ({ column: 0, row: 0, width: columns(), height: rows() })),
  filler: " ",
  style: createAnsiStyle({ background: [5, 7, 13] }),
  zIndex: -2,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: new Computed<TextRectangle>(() => ({ column: 2, row: 0, width: Math.max(0, columns() - 4) })),
  value: new Computed(() =>
    `THREE ASCII WEBGPU / ${
      sceneModes[sceneIndex.value]!.toUpperCase()
    } / ${activePreset().label.toUpperCase()} / ${activeGlyph().toUpperCase()}`
  ),
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [255, 66, 49], bold: true }),
  zIndex: 3,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: new Computed<TextRectangle>(() => ({ column: 2, row: 1, width: Math.max(0, columns() - 4) })),
  value: new Computed(() =>
    `${webgpuReady.value} | ${status.value} | P preset  G glyph  S scene  Space pause  Arrows orbit`
  ),
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [91, 176, 255] }),
  zIndex: 3,
}).draw();

const ascii = new ThreeAsciiObject({
  canvas: host.canvas,
  rectangle: new Computed(() => ({
    column: 1,
    row: 3,
    width: Math.max(24, columns() - 2),
    height: Math.max(12, rows() - 5),
  })),
  style: createAnsiStyle({}),
  zIndex: 1,
  scene: bundle.scene,
  camera: bundle.camera,
  effect: { ...DEFAULT_ASCII_DEMO_EFFECT, ...activePreset().effect },
  terminalGlyphStyle: activeGlyph(),
  terminalEdgeBias: activePreset().terminalEdgeBias,
  frameInterval: 1000 / 24,
  onFrame: (deltaTime) => {
    if (paused.peek()) return;
    const time = performance.now();
    bundle.tick(time, {
      x: Math.sin(time * 0.0008),
      y: Math.cos(time * 0.0007),
      pulse: 0.5 + Math.sin(time * 0.0016) * 0.5,
      lift: Math.sin(time * 0.0011),
      twist: Math.cos(time * 0.0009),
      depth: 0.5 + Math.sin(time * 0.0013) * 0.5,
      active: true,
      pressed: false,
    });
    status.value = `frame ${deltaTime.toFixed(3)}s`;
  },
});
ascii.draw();

host.on("keyPress", ({ key }) => {
  if (key === "p") applyPreset(presetIndex.peek() + 1);
  else if (key === "g") applyGlyph(glyphIndex.peek() + 1);
  else if (key === "s") applyScene(sceneIndex.peek() + 1);
  else if (key === "space") paused.value = !paused.peek();
  else if (key === "left") bundle.camera.position.x -= 0.18;
  else if (key === "right") bundle.camera.position.x += 0.18;
  else if (key === "up") bundle.camera.position.z = Math.max(2.2, bundle.camera.position.z - 0.22);
  else if (key === "down") bundle.camera.position.z = Math.min(9, bundle.camera.position.z + 0.22);
});

host.start();

probeCompatibleWebGPUDevice().then((ready) => {
  webgpuReady.value = ready ? "webgpu ready" : "webgpu unavailable";
});

globalThis.addEventListener("beforeunload", () => {
  bundle.dispose();
  host.destroy();
});

function applyPreset(index: number): void {
  presetIndex.value = wrap(index, ASCII_DEMO_PRESETS.length);
  const preset = activePreset();
  ascii.setEffectOptions(preset.effect);
  ascii.setTerminalEdgeBias(preset.terminalEdgeBias ?? 1);
  if (preset.terminalGlyphStyle) applyGlyph(TERMINAL_GLYPH_STYLES.indexOf(preset.terminalGlyphStyle));
}

function applyGlyph(index: number): void {
  glyphIndex.value = wrap(index, TERMINAL_GLYPH_STYLES.length);
  ascii.setTerminalGlyphStyle(activeGlyph());
}

function applyScene(index: number): void {
  bundle.dispose();
  sceneIndex.value = wrap(index, sceneModes.length);
  bundle = createNeonThreeScene(sceneModes[sceneIndex.peek()]!);
  ascii.renderer.scene.clear();
  ascii.renderer.scene.background = bundle.scene.background;
  for (const child of [...bundle.scene.children]) {
    ascii.renderer.scene.add(child);
  }
  ascii.renderer.camera.copy(bundle.camera);
  status.value = `scene ${sceneModes[sceneIndex.peek()]}`;
}

function activePreset(): AsciiDemoPreset {
  return ASCII_DEMO_PRESETS[presetIndex.value] ?? ASCII_DEMO_PRESETS[0]!;
}

function activeGlyph(): TerminalGlyphStyle {
  return TERMINAL_GLYPH_STYLES[glyphIndex.value] ?? "blocks";
}

function columns(): number {
  return host.platform.size.value.columns;
}

function rows(): number {
  return host.platform.size.value.rows;
}

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}
