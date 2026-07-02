/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import {
  ASCII_DEMO_PRESETS,
  BoxObject,
  Computed,
  createAnsiStyle,
  createWebTui,
  probeCompatibleWebGPUDevice,
  Signal,
  TERMINAL_GLYPH_STYLES,
  TextObject,
  type TextRectangle,
  ThreeAsciiObject,
} from "../../mod.web.ts";
import { createNeonThreeScene } from "../../app/neon_three.ts";
import {
  layoutThreeAsciiDemoWindow,
  THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT,
  THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH,
  threeAsciiDemoBodyRect,
  threeAsciiDemoControlRect,
  threeAsciiDemoTitlebarControlAt,
  threeAsciiDemoTitleRect,
} from "../../app/three_ascii_demo_window.ts";
import { type ThreeSceneMode, threeSceneModes } from "../../app/types.ts";
import { applyAsciiPreset, asciiEffectOptions, createDefaultAsciiOptions } from "../../src/three_ascii/options.ts";

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
const asciiOptions = createDefaultAsciiOptions();
const presetIndex = new Signal(
  Math.max(0, ASCII_DEMO_PRESETS.findIndex((preset) => preset.id === asciiOptions.preset)),
);
const asciiConfigVersion = new Signal(0);
const paused = new Signal(false);
const renderMinimized = new Signal(false);
const renderMaximized = new Signal(false);
const webgpuReady = new Signal("probing webgpu");
const status = new Signal("initializing acerola ascii renderer");

let bundle = createNeonThreeScene(sceneModes[sceneIndex.peek()]!);
const renderWindowRectangle = new Computed(() =>
  layoutThreeAsciiDemoWindow({
    terminalWidth: columns(),
    terminalHeight: rows(),
    menuVisible: false,
    minimized: renderMinimized.value,
    maximized: renderMaximized.value,
  })
);
const renderBodyRectangle = new Computed(() => threeAsciiDemoBodyRect(renderWindowRectangle.value));

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
  value: new Computed(() => {
    void asciiConfigVersion.value;
    return `THREE ASCII WEBGPU / ${
      sceneModes[sceneIndex.value]!.toUpperCase()
    } / ${activePresetLabel().toUpperCase()} / ${asciiOptions.terminalGlyphStyle.toUpperCase()}`;
  }),
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

new BoxObject({
  canvas: host.canvas,
  rectangle: renderWindowRectangle,
  filler: " ",
  style: createAnsiStyle({ background: [3, 5, 10] }),
  zIndex: 0,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: new Computed<TextRectangle>(() => ({
    column: renderWindowRectangle.value.column,
    row: renderWindowRectangle.value.row,
    width: renderWindowRectangle.value.width,
  })),
  value: new Computed(() => frameTop(renderWindowRectangle.value.width)),
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [185, 242, 255], background: [3, 5, 10] }),
  zIndex: 4,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: new Computed<TextRectangle>(() => ({
    column: renderWindowRectangle.value.column,
    row: renderWindowRectangle.value.row + Math.max(0, renderWindowRectangle.value.height - 1),
    width: renderWindowRectangle.value.width,
  })),
  value: new Computed(() => frameBottom(renderWindowRectangle.value.width)),
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [185, 242, 255], background: [3, 5, 10] }),
  zIndex: 4,
}).draw();

new BoxObject({
  canvas: host.canvas,
  rectangle: new Computed(() => ({
    column: renderWindowRectangle.value.column,
    row: renderWindowRectangle.value.row + 1,
    width: 1,
    height: Math.max(0, renderWindowRectangle.value.height - 2),
  })),
  filler: "│",
  style: createAnsiStyle({ foreground: [185, 242, 255], background: [3, 5, 10] }),
  zIndex: 4,
}).draw();

new BoxObject({
  canvas: host.canvas,
  rectangle: new Computed(() => ({
    column: renderWindowRectangle.value.column + Math.max(0, renderWindowRectangle.value.width - 1),
    row: renderWindowRectangle.value.row + 1,
    width: 1,
    height: Math.max(0, renderWindowRectangle.value.height - 2),
  })),
  filler: "│",
  style: createAnsiStyle({ foreground: [185, 242, 255], background: [3, 5, 10] }),
  zIndex: 4,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: new Computed<TextRectangle>(() => threeAsciiDemoTitleRect(renderWindowRectangle.value)),
  value: new Computed(() => {
    const label = renderMinimized.value ? "THREE ASCII WEBGPU · MINIMIZED" : "THREE ASCII WEBGPU";
    return ` ${label} `.slice(
      0,
      Math.max(0, renderWindowRectangle.value.width - THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH - 3),
    );
  }),
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [3, 5, 10], background: [185, 242, 255], bold: true }),
  zIndex: 5,
}).draw();

new TextObject({
  canvas: host.canvas,
  rectangle: new Computed<TextRectangle>(() => threeAsciiDemoControlRect(renderWindowRectangle.value)),
  value: new Computed<string>(() =>
    threeAsciiDemoControlRect(renderWindowRectangle.value).width > 0 ? THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT : ""
  ),
  overwriteRectangle: true,
  style: createAnsiStyle({ foreground: [3, 5, 10], background: [255, 207, 64], bold: true }),
  zIndex: 6,
}).draw();

const ascii = new ThreeAsciiObject({
  canvas: host.canvas,
  rectangle: new Computed(() =>
    renderMinimized.value ? { ...renderBodyRectangle.value, height: 1 } : renderBodyRectangle.value
  ),
  style: createAnsiStyle({}),
  zIndex: 1,
  scene: bundle.scene,
  camera: bundle.camera,
  effect: asciiEffectOptions(asciiOptions),
  terminalGlyphStyle: asciiOptions.terminalGlyphStyle,
  terminalEdgeBias: asciiOptions.terminalEdgeBias,
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
  else if (key === "g") applyGlyph(TERMINAL_GLYPH_STYLES.indexOf(asciiOptions.terminalGlyphStyle) + 1);
  else if (key === "s") applyScene(sceneIndex.peek() + 1);
  else if (key === "space") paused.value = !paused.peek();
  else if (key === "m") {
    renderMinimized.value = true;
    renderMaximized.value = false;
  } else if (key === "f") {
    renderMaximized.value = true;
    renderMinimized.value = false;
  } else if (key === "r") {
    renderMinimized.value = false;
    renderMaximized.value = false;
  } else if (key === "x") host.destroy();
  else if (key === "left") bundle.camera.position.x -= 0.18;
  else if (key === "right") bundle.camera.position.x += 0.18;
  else if (key === "up") bundle.camera.position.z = Math.max(2.2, bundle.camera.position.z - 0.22);
  else if (key === "down") bundle.camera.position.z = Math.min(9, bundle.camera.position.z + 0.22);
});

host.on("mousePress", ({ x, y, release, drag, ctrl, meta, shift }) => {
  if (release || drag || ctrl || meta || shift) return;
  const hit = threeAsciiDemoTitlebarControlAt(renderWindowRectangle.peek(), x, y);
  if (hit === "minimize") {
    renderMinimized.value = true;
    renderMaximized.value = false;
  } else if (hit === "maximize") {
    renderMaximized.value = true;
    renderMinimized.value = false;
  } else if (hit === "restore") {
    renderMinimized.value = false;
    renderMaximized.value = false;
  } else if (hit === "close") {
    host.destroy();
  }
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
  const preset = ASCII_DEMO_PRESETS[presetIndex.peek()] ?? ASCII_DEMO_PRESETS[0]!;
  applyAsciiPreset(asciiOptions, preset.id);
  applyRendererOptions();
}

function applyGlyph(index: number): void {
  asciiOptions.terminalGlyphStyle = TERMINAL_GLYPH_STYLES[wrap(index, TERMINAL_GLYPH_STYLES.length)] ?? "blocks";
  asciiOptions.preset = "custom";
  ascii.setTerminalGlyphStyle(asciiOptions.terminalGlyphStyle);
  asciiConfigVersion.value += 1;
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

function activePresetLabel(): string {
  return ASCII_DEMO_PRESETS.find((preset) => preset.id === asciiOptions.preset)?.label ?? "Custom";
}

function applyRendererOptions(): void {
  ascii.setEffectOptions(asciiEffectOptions(asciiOptions));
  ascii.setTerminalEdgeBias(asciiOptions.terminalEdgeBias);
  ascii.setTerminalGlyphStyle(asciiOptions.terminalGlyphStyle);
  asciiConfigVersion.value += 1;
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

function frameTop(width: number): string {
  const inner = Math.max(0, width - 2);
  return width <= 0 ? "" : width === 1 ? "╭" : `╭${"─".repeat(inner)}╮`;
}

function frameBottom(width: number): string {
  const inner = Math.max(0, width - 2);
  return width <= 0 ? "" : width === 1 ? "╰" : `╰${"─".repeat(inner)}╯`;
}
