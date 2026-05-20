import { BoxObject } from "../src/canvas/box.ts";
import { TextObject, type TextRectangle } from "../src/canvas/text.ts";
import { handleInput } from "../src/input.ts";
import { Computed, Effect, Signal } from "../src/signals/mod.ts";
import { probeCompatibleWebGPUDevice } from "../src/three_ascii/webgpu_compat.ts";
import { Tui } from "../src/tui.ts";
import {
  ASCII_DEMO_PRESETS,
  applyAsciiPreset,
  asciiControlValues,
  asciiPresetLabel,
  createDefaultAsciiOptions,
  formatAsciiControlValue,
} from "./ascii_options.ts";
import { AudioRegistry, discoverAudioSources } from "./audio.ts";
import { detectViewportMode, resolveResponsiveLayout, slotRect, visibleSlotIds } from "./layout.ts";
import {
  type MultiPaneLayoutId,
  shiftOutputTarget,
  shiftVisualizationForSlot,
  toggleFullscreenLayout,
} from "./navigation.ts";
import { defaultVisualizationForSlot, orderVisualizationsForSlot } from "./panel_defaults.ts";
import { buildSourceCatalog, resolveSourceFrames } from "./sources.ts";
import { accentColor, formatDuration, makeStyle, palette, severityAccent } from "./styles.ts";
import { SystemMonitor } from "./system_metrics.ts";
import { ThreePanelView } from "./three_panel.ts";
import { centeredRect, fitTextWidth, FrameView, ListView, MultilineTextView, PanelView } from "./ui.ts";
import {
  type Accent,
  type BorderMode,
  borderModes,
  type LayoutId,
  layoutIds,
  type MenuLine,
  type MenuState,
  type Rect,
  type SlotConfig,
  type SlotId,
  type ViewportMode,
  slotIds,
} from "./types.ts";
import { renderVisualization, visualizations } from "./visualizations.ts";

const tui = new Tui({
  style: makeStyle({ bg: palette.void }),
  refreshRate: 1000 / 24,
});

const audioCatalog = await discoverAudioSources();
const audioRegistry = new AudioRegistry(audioCatalog);
const systemMonitor = new SystemMonitor(60);
await systemMonitor.start(1000);
const threeAsciiAvailable = new Signal(await probeCompatibleWebGPUDevice());

const slots = new Signal<Record<SlotId, SlotConfig>>(createDefaultSlots(), { deepObserve: true });
const layout = new Signal<LayoutId>("monitor");
const selectedSlotId = new Signal<SlotId>("cpu");
const menu = new Signal<MenuState | null>(null);
const sourceCatalog = new Signal(buildSourceCatalog(audioCatalog));
const phase = new Signal(0);
const restoreLayout = new Signal<MultiPaneLayoutId>("monitor");

const cycleClock = new Map<SlotId, number>();
const timers = [
  setInterval(() => {
    phase.value += 1;
    const now = Date.now();
    for (const slot of Object.values(slots.peek())) {
      if (!slot.cycleEnabled) {
        continue;
      }
      const lastSwitch = cycleClock.get(slot.id) ?? now;
      if (now - lastSwitch >= slot.cycleIntervalMs) {
        slot.visualizationId = nextVisualization(slot.visualizationId, slot.id);
        cycleClock.set(slot.id, now);
      }
    }
  }, 250),
];

new Effect(() => {
  const ids = new Set<string>();
  for (const slot of Object.values(slots.value)) {
    for (const inputSourceId of slot.inputSourceIds) {
      if (inputSourceId.startsWith("audio:")) {
        ids.add(inputSourceId);
      }
    }
  }
  audioRegistry.setActiveSources([...ids]);
});

const appRect = new Computed<Rect>(() => {
  const bounds = tui.rectangle.value;
  return {
    column: 0,
    row: 0,
    width: bounds.width,
    height: bounds.height,
  };
});

const contentRect = new Computed<Rect>(() => {
  const bounds = appRect.value;
  return {
    column: 1,
    row: 2,
    width: Math.max(0, bounds.width - 2),
    height: Math.max(0, bounds.height - 4),
  };
});

const viewportMode = new Computed<ViewportMode>(() => detectViewportMode(contentRect.value));
const activeLayout = new Computed<LayoutId>(() => resolveResponsiveLayout(layout.value, contentRect.value));
const visibleSlots = new Computed(() => visibleSlotIds(activeLayout.value, selectedSlotId.value));

new Effect(() => {
  if (layout.value !== "single") {
    restoreLayout.value = layout.value;
  }
});

new Effect(() => {
  const current = selectedSlotId.value;
  if (!visibleSlots.value.includes(current)) {
    selectedSlotId.value = visibleSlots.value[0] ?? "cpu";
  }
});

const shellObjects: Array<{ draw: () => void }> = [];

const alertBackground = new BoxObject({
  canvas: tui.canvas,
  zIndex: 100,
  style: new Computed(() => {
    const alert = systemMonitor.snapshot.value.alerts[0];
    const accent = alert ? accentColor(severityAccent(alert.severity)) : palette.panel;
    return makeStyle({ bg: accent, fg: alert ? palette.void : palette.paper, bold: true });
  }),
  rectangle: new Computed(() => ({
    column: 0,
    row: 0,
    width: appRect.value.width,
    height: appRect.value.height > 0 ? 1 : 0,
  })),
});
shellObjects.push(alertBackground);

const alertText = new TextObject({
  canvas: tui.canvas,
  zIndex: 101,
  style: new Computed(() => {
    const alert = systemMonitor.snapshot.value.alerts[0];
    return makeStyle({
      bg: alert ? accentColor(severityAccent(alert.severity)) : palette.panel,
      fg: alert ? palette.void : palette.paper,
      bold: true,
    });
  }),
  overwriteRectangle: true,
  rectangle: new Computed<TextRectangle>(() => ({
    column: 0,
    row: 0,
    width: appRect.value.width,
  })),
  value: new Computed(() => {
    const width = appRect.value.width;
    const alert = systemMonitor.snapshot.value.alerts[0];
    const message = alert
      ? (phase.value % 6 < 3
        ? `${alert.title} / ${alert.detail}`
        : `ALERT BUS / ${systemMonitor.snapshot.value.alerts.length} ACTIVE CONDITION(S)`)
      : "NEON VISUALIZATION APP / GENERIC SOURCE ROUTING / F1 HELP";
    return crop(message, width).padEnd(width, " ");
  }),
});
shellObjects.push(alertText);

const statusBackground = new BoxObject({
  canvas: tui.canvas,
  zIndex: 100,
  style: makeStyle({ bg: palette.panel }),
  rectangle: new Computed(() => ({
    column: 0,
    row: 1,
    width: appRect.value.width,
    height: appRect.value.height > 1 ? 1 : 0,
  })),
});
shellObjects.push(statusBackground);

const statusText = new TextObject({
  canvas: tui.canvas,
  zIndex: 101,
  style: makeStyle({ bg: palette.panel, fg: palette.paper, bold: true }),
  overwriteRectangle: true,
  rectangle: new Computed<TextRectangle>(() => ({
    column: 0,
    row: 1,
    width: appRect.value.width,
  })),
  value: new Computed(() => {
    const slot = slots.value[selectedSlotId.value];
    const width = appRect.value.width;
    const layoutLabel = activeLayout.value === layout.value
      ? activeLayout.value.toUpperCase()
      : `${activeLayout.value.toUpperCase()}(${layout.value.toUpperCase()})`;
    const message = [
      `LAYOUT ${layoutLabel}`,
      `VIEW ${viewportMode.value.toUpperCase()}`,
      `FOCUS ${slot.name.toUpperCase()}`,
      `VIS ${slot.visualizationId.toUpperCase()}`,
      `INPUTS ${slot.inputSourceIds.length}`,
      `CYCLE ${slot.cycleEnabled ? `${Math.round(slot.cycleIntervalMs / 1000)}S` : "OFF"}`,
    ].join("  /  ");
    return crop(message, width).padEnd(width, " ");
  }),
});
shellObjects.push(statusText);

const footerBackground = new BoxObject({
  canvas: tui.canvas,
  zIndex: 100,
  style: makeStyle({ bg: palette.panel }),
  rectangle: new Computed(() => ({
    column: 0,
    row: Math.max(0, appRect.value.height - 1),
    width: appRect.value.width,
    height: appRect.value.height > 2 ? 1 : 0,
  })),
});
shellObjects.push(footerBackground);

const footerText = new TextObject({
  canvas: tui.canvas,
  zIndex: 101,
  style: makeStyle({ bg: palette.panel, fg: palette.dim }),
  overwriteRectangle: true,
  rectangle: new Computed<TextRectangle>(() => ({
    column: 0,
    row: Math.max(0, appRect.value.height - 1),
    width: appRect.value.width,
  })),
  value: new Computed(() => {
    const mobileFooter =
      "MOBILE VIEW ACTIVE  /  ENTER FULLSCREEN  ,/. OUTPUT  </> VIZ  F2 ROUTING  F3 LAYOUT  F4 OPTIONS  Q EXIT";
    const desktopFooter =
      "F1 HELP  F2 ROUTING  F3 LAYOUT  F4 OPTIONS  ENTER FULLSCREEN  ,/. OUTPUT  </> VIZ  F5 CYCLE  TAB/ARROWS FOCUS  Q EXIT";
    return crop(
      viewportMode.value === "mobile" ? mobileFooter : desktopFooter,
      appRect.value.width,
    ).padEnd(appRect.value.width, " ");
  }),
});
shellObjects.push(footerText);

const slotPanels = new Map<SlotId, PanelView>();
const slotScenes = new Map<SlotId, ThreePanelView>();

for (const slotId of slotIds) {
  const rect = new Computed(() => slotRect(activeLayout.value, contentRect.value, slotId, selectedSlotId.value));
  const render = new Computed(() => {
    if (rect.value.width <= 0 || rect.value.height <= 0) {
      return {
        title: "",
        body: "",
        footer: "",
        alert: "",
        accent: "signal" as const,
        severity: "info" as const,
        three: undefined,
      };
    }
    const slot = slots.value[slotId];
    const sources = resolveSourceFrames(slot.inputSourceIds, systemMonitor.snapshot.value, audioRegistry, phase.value);
    return renderVisualization({
      slot,
      system: systemMonitor.snapshot.value,
      sources,
      phase: phase.value,
      width: Math.max(8, rect.value.width - 2),
      height: Math.max(4, rect.value.height - 4),
    });
  });
  const selected = new Computed(() => selectedSlotId.value === slotId);

  const panel = new PanelView({
    canvas: tui.canvas,
    rectangle: rect,
    title: new Computed(() => {
      const renderValue = render.value;
      const slot = slots.value[slotId];
      const title = renderValue.title ?? slot.visualizationId.toUpperCase();
      return rect.value.width > 0 ? `${slot.name.toUpperCase()} / ${title}` : "";
    }),
    alert: new Computed(() => render.value.alert),
    body: new Computed(() => render.value.body),
    bodyPadToWidth: new Computed(() => !(render.value.three && threeAsciiAvailable.value)),
    footer: new Computed(() => {
      const renderValue = render.value;
      const slot = slots.value[slotId];
      const cycle = slot.cycleEnabled ? ` / CYCLE ${Math.round(slot.cycleIntervalMs / 1000)}S` : "";
      return `${renderValue.footer}${cycle}`;
    }),
    backgroundStyle: new Computed(() =>
      makeStyle({
        bg: selected.value ? palette.panelSoft : palette.panel,
        fg: palette.paper,
      })
    ),
    frameStyle: new Computed(() =>
      makeStyle({
        fg: selected.value ? palette.paper : accentColor(render.value.accent),
        bg: selected.value ? palette.panelSoft : undefined,
        bold: selected.value || render.value.severity !== "info",
      })
    ),
    titleStyle: new Computed(() =>
      makeStyle({
        fg: titleInk(render.value.accent),
        bg: accentColor(render.value.accent),
        bold: true,
      })
    ),
    alertStyle: new Computed(() =>
      makeStyle({
        fg: titleInk(severityAccent(render.value.severity)),
        bg: accentColor(severityAccent(render.value.severity)),
        bold: render.value.alert.length > 0,
      })
    ),
    bodyStyle: new Computed(() =>
      makeStyle({
        fg: render.value.severity === "alarm"
          ? accentColor("alarm")
          : render.value.severity === "warning"
          ? accentColor("amber")
          : palette.paper,
        bg: selected.value ? palette.panelSoft : palette.panel,
      })
    ),
    footerStyle: new Computed(() =>
      makeStyle({
        fg: selected.value ? accentColor(render.value.accent) : palette.dim,
        bg: selected.value ? palette.panelSoft : palette.panel,
      })
    ),
    borderMode: new Computed(() => slots.value[slotId].ascii.border),
    zIndex: 10,
  });

  slotPanels.set(slotId, panel);
  slotScenes.set(slotId, new ThreePanelView({
    canvas: tui.canvas,
    rectangle: panel.bodyRect,
    scene: new Computed(() => render.value.three ?? null),
    ascii: new Computed(() => slots.value[slotId].ascii),
    enabled: threeAsciiAvailable,
    zIndex: 11,
  }));
}

const menuOverlay = new BoxObject({
  canvas: tui.canvas,
  zIndex: 200,
  style: new Computed(() => menu.value ? makeStyle({ bg: palette.shade }) : makeStyle({})),
  rectangle: new Computed(() =>
    menu.value
      ? ({
        column: 0,
        row: 0,
        width: appRect.value.width,
        height: appRect.value.height,
      })
      : ({
        column: 0,
        row: 0,
        width: 0,
        height: 0,
      })
  ),
});

const menuModel = new Computed(() =>
  buildMenuModel(menu.value, slots.value, sourceCatalog.value, layout.value, activeLayout.value, viewportMode.value)
);

const menuRect = new Computed<Rect>(() => {
  if (!menu.value) {
    return { column: 0, row: 0, width: 0, height: 0 };
  }
  const descriptionWidth = fitTextWidth(menuModel.value.descriptionLines, 30, Math.max(40, appRect.value.width - 6));
  const listWidth = fitTextWidth(
    menuModel.value.lines.map((line) => line.text),
    26,
    Math.max(36, appRect.value.width - 6),
  );
  const width = Math.min(appRect.value.width - 4, Math.max(descriptionWidth, listWidth, 36) + 2);
  const height = Math.min(
    appRect.value.height - 4,
    Math.max(8, menuModel.value.descriptionLines.length + Math.max(3, menuModel.value.lines.length) + 5),
  );
  return centeredRect(appRect.value, width, height);
});

const menuFrame = new FrameView({
  canvas: tui.canvas,
  rectangle: menuRect,
  style: new Computed(() => makeStyle({ fg: accentColor(menuModel.value.accent), bg: palette.panel, bold: true })),
  borderMode: new Computed<BorderMode>(() => menu.value?.kind === "help" ? "rounded" : "sharp"),
  zIndex: 202,
});

const menuBackground = new BoxObject({
  canvas: tui.canvas,
  zIndex: 201,
  style: makeStyle({ bg: palette.panel }),
  rectangle: new Computed(() => ({
    column: menuRect.value.column + 1,
    row: menuRect.value.row + 1,
    width: Math.max(0, menuRect.value.width - 2),
    height: Math.max(0, menuRect.value.height - 2),
  })),
});

const menuTitle = new TextObject({
  canvas: tui.canvas,
  zIndex: 203,
  style: new Computed(() => makeStyle({ fg: accentColor(menuModel.value.accent), bg: palette.void, bold: true })),
  overwriteRectangle: true,
  rectangle: new Computed<TextRectangle>(() => ({
    column: menuRect.value.column + 2,
    row: menuRect.value.row,
    width: Math.max(0, menuRect.value.width - 4),
  })),
  value: new Computed(() =>
    crop(menuModel.value.title.toUpperCase(), Math.max(0, menuRect.value.width - 4)).padEnd(
      Math.max(0, menuRect.value.width - 4),
      " ",
    )
  ),
});

const menuDescription = new MultilineTextView({
  canvas: tui.canvas,
  rectangle: new Computed(() => ({
    column: menuRect.value.column + 2,
    row: menuRect.value.row + 1,
    width: Math.max(0, menuRect.value.width - 4),
    height: Math.max(0, menuModel.value.descriptionLines.length),
  })),
  text: new Computed(() => menuModel.value.descriptionLines.join("\n")),
  style: new Computed(() => makeStyle({ fg: palette.paper, bg: palette.panel })),
  zIndex: 203,
  lineLimit: 8,
});

const menuList = new ListView({
  canvas: tui.canvas,
  rectangle: new Computed(() => ({
    column: menuRect.value.column + 2,
    row: menuRect.value.row + 1 + menuModel.value.descriptionLines.length,
    width: Math.max(0, menuRect.value.width - 4),
    height: Math.max(0, menuRect.value.height - 4 - menuModel.value.descriptionLines.length),
  })),
  lines: new Computed(() => menuModel.value.lines),
  emptyStyle: makeStyle({ bg: palette.panel }),
  zIndex: 203,
});

const menuFooter = new TextObject({
  canvas: tui.canvas,
  zIndex: 203,
  style: new Computed(() => makeStyle({ fg: palette.dim, bg: palette.panel })),
  overwriteRectangle: true,
  rectangle: new Computed<TextRectangle>(() => ({
    column: menuRect.value.column + 2,
    row: menuRect.value.row + Math.max(0, menuRect.value.height - 2),
    width: Math.max(0, menuRect.value.width - 4),
  })),
  value: new Computed(() =>
    crop(menuModel.value.footer, Math.max(0, menuRect.value.width - 4)).padEnd(
      Math.max(0, menuRect.value.width - 4),
      " ",
    )
  ),
});

tui.on("keyPress", (event) => {
  if (event.ctrl && event.key === "c") {
    return;
  }

  const currentMenu = menu.peek();
  if (currentMenu) {
    handleMenuKey(event.key, currentMenu);
    return;
  }

  switch (event.key) {
    case "q":
      tui.emit("destroy");
      return;
    case "return":
      layout.value = toggleFullscreenLayout(layout.value, restoreLayout.value);
      return;
    case "tab":
      selectNextSlot(1);
      return;
    case "left":
    case "right":
    case "up":
    case "down":
      moveSelection(event.key);
      return;
    case "f1":
      menu.value = { kind: "help", column: 0, index: 0, targetSlotId: selectedSlotId.value };
      return;
    case "f2":
      menu.value = {
        kind: "routing",
        column: 0,
        index: slotIds.indexOf(selectedSlotId.value),
        targetSlotId: selectedSlotId.value,
      };
      return;
    case "f3":
      menu.value = {
        kind: "layout",
        column: 0,
        index: layoutIds.indexOf(layout.value),
        targetSlotId: selectedSlotId.value,
      };
      return;
    case "f4":
      menu.value = { kind: "options", column: 0, index: 0, targetSlotId: selectedSlotId.value };
      return;
    case "f5":
    case "c": {
      const slot = slots.value[selectedSlotId.value];
      slot.cycleEnabled = !slot.cycleEnabled;
      cycleClock.set(slot.id, Date.now());
      return;
    }
    case ",":
      shiftSelectedOutput(-1);
      return;
    case ".":
      shiftSelectedOutput(1);
      return;
    case "<":
      shiftSelectedVisualization(-1);
      return;
    case ">":
      shiftSelectedVisualization(1);
      return;
  }
});

function handleMenuKey(key: string, currentMenu: MenuState) {
  if (key === "escape" || key === "q") {
    menu.value = null;
    return;
  }

  if (key === "f1") {
    menu.value = { kind: "help", column: 0, index: 0, targetSlotId: currentMenu.targetSlotId };
    return;
  }
  if (key === "f2") {
    menu.value = {
      kind: "routing",
      column: 0,
      index: slotIds.indexOf(currentMenu.targetSlotId),
      targetSlotId: currentMenu.targetSlotId,
    };
    return;
  }
  if (key === "f3") {
    menu.value = {
      kind: "layout",
      column: 0,
      index: layoutIds.indexOf(layout.value),
      targetSlotId: currentMenu.targetSlotId,
    };
    return;
  }
  if (key === "f4") {
    menu.value = { kind: "options", column: 0, index: 0, targetSlotId: currentMenu.targetSlotId };
    return;
  }

  const model = buildMenuModel(
    currentMenu,
    slots.peek(),
    sourceCatalog.peek(),
    layout.peek(),
    activeLayout.peek(),
    viewportMode.peek(),
  );
  if (model.sections.length === 0) {
    return;
  }

  if (key === "left") {
    currentMenu.column = (currentMenu.column - 1 + model.sections.length) % model.sections.length;
    currentMenu.index = 0;
    menu.value = { ...currentMenu };
    return;
  }

  if (key === "right" || key === "tab") {
    currentMenu.column = (currentMenu.column + 1) % model.sections.length;
    currentMenu.index = 0;
    menu.value = { ...currentMenu };
    return;
  }

  const currentSection = model.sections[currentMenu.column] ?? model.sections[0];
  if (!currentSection) {
    return;
  }

  if (key === "up") {
    currentMenu.index = (currentMenu.index - 1 + currentSection.items.length) % currentSection.items.length;
    menu.value = { ...currentMenu };
    return;
  }

  if (key === "down") {
    currentMenu.index = (currentMenu.index + 1) % currentSection.items.length;
    menu.value = { ...currentMenu };
    return;
  }

  if (key === "return" || key === "space") {
    applyMenuSelection(currentMenu, currentSection.items[currentMenu.index]?.id ?? "");
    return;
  }
}

function applyMenuSelection(currentMenu: MenuState, itemId: string) {
  switch (currentMenu.kind) {
    case "layout":
      if (layoutIds.includes(itemId as LayoutId)) {
        layout.value = itemId as LayoutId;
        menu.value = null;
      }
      return;
    case "routing": {
      if (currentMenu.column === 0 && slotIds.includes(itemId as SlotId)) {
        currentMenu.targetSlotId = itemId as SlotId;
        selectedSlotId.value = itemId as SlotId;
        currentMenu.index = 0;
        menu.value = { ...currentMenu };
        return;
      }
      const slot = slots.value[currentMenu.targetSlotId];
      if (currentMenu.column === 1) {
        slot.visualizationId = itemId;
        cycleClock.set(slot.id, Date.now());
        return;
      }
      if (currentMenu.column === 2) {
        if (slot.inputSourceIds.includes(itemId)) {
          slot.inputSourceIds = slot.inputSourceIds.filter((value) => value !== itemId);
        } else {
          slot.inputSourceIds = [...slot.inputSourceIds, itemId];
        }
        return;
      }
      return;
    }
    case "options": {
      const slot = slots.value[currentMenu.targetSlotId];
      switch (currentMenu.column) {
        case 0:
          if (ASCII_DEMO_PRESETS.some((preset) => preset.id === itemId)) {
            applyAsciiPreset(slot.ascii, itemId);
          }
          return;
        case 1:
          if (borderModes.includes(itemId as BorderMode)) {
            slot.ascii.border = itemId as BorderMode;
          }
          return;
        case 2:
          slot.ascii.preset = "custom";
          slot.ascii.edges = itemId === "on";
          return;
        case 3:
          slot.ascii.preset = "custom";
          slot.ascii.fill = itemId === "on";
          return;
        case 4:
          slot.ascii.preset = "custom";
          slot.ascii.invertLuminance = itemId === "on";
          return;
        case 5:
          slot.ascii.preset = "custom";
          slot.ascii.edgeThreshold = Number(itemId);
          return;
        case 6:
          slot.ascii.preset = "custom";
          slot.ascii.normalThreshold = Number(itemId);
          return;
        case 7:
          slot.ascii.preset = "custom";
          slot.ascii.depthThreshold = Number(itemId);
          return;
        case 8:
          slot.ascii.preset = "custom";
          slot.ascii.exposure = Number(itemId);
          return;
        case 9:
          slot.ascii.preset = "custom";
          slot.ascii.attenuation = Number(itemId);
          return;
        case 10:
          slot.ascii.preset = "custom";
          slot.ascii.blendWithBase = Number(itemId);
          return;
        case 11:
          slot.ascii.preset = "custom";
          slot.ascii.depthFalloff = Number(itemId);
          return;
        case 12:
          slot.ascii.preset = "custom";
          slot.ascii.depthOffset = Number(itemId);
          return;
        case 13:
          slot.ascii.preset = "custom";
          slot.ascii.terminalEdgeBias = Number(itemId);
          return;
        case 14:
          slot.cycleEnabled = itemId === "on";
          cycleClock.set(slot.id, Date.now());
          return;
        case 15:
          slot.cycleIntervalMs = Number(itemId);
          cycleClock.set(slot.id, Date.now());
          return;
      }
      return;
    }
    case "help":
      menu.value = null;
      return;
  }
}

function moveSelection(direction: "left" | "right" | "up" | "down") {
  const visible = visibleSlotIds(activeLayout.peek(), selectedSlotId.peek());
  if (visible.length === 0) {
    return;
  }
  const current = selectedSlotId.peek();
  const currentRect = slotRect(activeLayout.peek(), contentRect.peek(), current, selectedSlotId.peek());
  const currentCenter = {
    x: currentRect.column + currentRect.width / 2,
    y: currentRect.row + currentRect.height / 2,
  };

  let bestSlot: SlotId | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const slotId of visible) {
    if (slotId === current) {
      continue;
    }
    const rect = slotRect(activeLayout.peek(), contentRect.peek(), slotId, selectedSlotId.peek());
    const center = {
      x: rect.column + rect.width / 2,
      y: rect.row + rect.height / 2,
    };

    const dx = center.x - currentCenter.x;
    const dy = center.y - currentCenter.y;

    if (direction === "left" && dx >= 0) {
      continue;
    }
    if (direction === "right" && dx <= 0) {
      continue;
    }
    if (direction === "up" && dy >= 0) {
      continue;
    }
    if (direction === "down" && dy <= 0) {
      continue;
    }

    const distance = Math.hypot(dx, dy) +
      (direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx)) * 0.4;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSlot = slotId;
    }
  }

  if (bestSlot) {
    selectedSlotId.value = bestSlot;
  }
}

function selectNextSlot(step: number) {
  const visible = visibleSlotIds(activeLayout.peek(), selectedSlotId.peek());
  if (visible.length === 0) {
    return;
  }
  const currentIndex = Math.max(0, visible.indexOf(selectedSlotId.peek()));
  selectedSlotId.value = visible[(currentIndex + step + visible.length) % visible.length] ?? visible[0]!;
}

function shiftSelectedVisualization(step: number) {
  const slot = slots.value[selectedSlotId.peek()];
  slot.visualizationId = shiftVisualizationForSlot(slot.id, slot.visualizationId, step, visualizations);
  cycleClock.set(slot.id, Date.now());
}

function shiftSelectedOutput(step: number) {
  selectedSlotId.value = shiftOutputTarget(activeLayout.peek(), selectedSlotId.peek(), step);
}

function buildMenuModel(
  currentMenu: MenuState | null,
  slotMap: Record<SlotId, SlotConfig>,
  catalog: ReturnType<typeof buildSourceCatalog>,
  requestedLayout: LayoutId,
  currentLayout: LayoutId,
  currentViewportMode: ViewportMode,
) {
  if (!currentMenu) {
    return {
      title: "",
      accent: "signal" as const,
      descriptionLines: [] as string[],
      footer: "",
      sections: [] as Array<{ title: string; items: Array<{ id: string; label: string; selected: boolean }> }>,
      lines: [] as MenuLine[],
    };
  }

  if (currentMenu.kind === "help") {
    const lines = [
      "ARROWS/TAB MOVE BETWEEN VISIBLE PANES.",
      "ENTER TOGGLES THE FOCUSED PANE INTO AND OUT OF FULLSCREEN.",
      ", AND . STEP THE SELECTED OUTPUT TARGET THROUGH AVAILABLE PANES.",
      "< AND > STEP THE FOCUSED PANE THROUGH ITS CURATED VISUALIZATION ORDER.",
      "F2 ROUTES INPUTS AND VISUALIZATIONS TO OUTPUT TARGETS.",
      "F3 SWITCHES BETWEEN THE BOTTOM-STYLE MONITOR AND SPLIT LAYOUTS.",
      "F4 DRIVES THE THREE ASCII PRESET, GLYPH TOGGLES, THRESHOLDS, BLEND, AND EDGE BIAS.",
      "SYSTEM AUDIO MONITORS AND LIVE MICROPHONE INPUTS APPEAR IN ROUTING.",
      "F5 OR C TOGGLES CYCLE MODE ON THE SELECTED PANE.",
      "Q OR ESC CLOSES WINDOWS OR EXITS THE APP.",
    ];
    return {
      title: "Help",
      accent: "signal" as const,
      descriptionLines: [],
      footer: "ESC CLOSES THIS WINDOW",
      sections: [],
      lines: lines.map((text) => ({
        text,
        style: makeStyle({ fg: palette.paper, bg: palette.panel }),
      })),
    };
  }

  if (currentMenu.kind === "layout") {
    const sections = [{
      title: "Layouts",
      items: [
        { id: "monitor", label: "Monitor Wall", selected: requestedLayout === "monitor" },
        { id: "single", label: "Single Pane", selected: requestedLayout === "single" },
        { id: "vertical", label: "Vertical Split", selected: requestedLayout === "vertical" },
        { id: "horizontal", label: "Horizontal Split", selected: requestedLayout === "horizontal" },
        { id: "quad", label: "Quad Deck", selected: requestedLayout === "quad" },
      ],
    }];
    const responsiveLine = currentLayout === requestedLayout
      ? `VIEW ${currentViewportMode.toUpperCase()} / ACTIVE ${currentLayout.toUpperCase()}`
      : `VIEW ${currentViewportMode.toUpperCase()} / ACTIVE ${currentLayout.toUpperCase()} / REQUESTED ${
        requestedLayout.toUpperCase()
      }`;
    return decorateMenu(currentMenu, {
      title: "Layout Select",
      accent: "signal",
      descriptionLines: [
        "CHOOSE THE ACTIVE SCREEN LAYOUT.",
        "THE DEFAULT MONITOR WALL MIRRORS THE LOCAL BOTTOM PANEL ARRANGEMENT.",
        responsiveLine,
      ],
      footer: "ENTER SELECTS  /  ESC CLOSES",
      sections,
    });
  }

  if (currentMenu.kind === "routing") {
    const targetSlot = slotMap[currentMenu.targetSlotId];
    const sections = [
      {
        title: "Output Target",
        items: slotIds.map((slotId) => ({
          id: slotId,
          label: `${slotLabel(slotId)}${
            visibleSlotIds(currentLayout, selectedSlotId.peek()).includes(slotId) ? " (visible)" : ""
          }`,
          selected: currentMenu.targetSlotId === slotId,
        })),
      },
      {
        title: "Visualization",
        items: orderVisualizationsForSlot(targetSlot.id, visualizations).map((entry) => ({
          id: entry.id,
          label: entry.name,
          selected: targetSlot.visualizationId === entry.id,
        })),
      },
      {
        title: "Input Sources",
        items: catalog.map((entry) => ({
          id: entry.id,
          label: `[${entry.group}] ${entry.name}`,
          selected: targetSlot.inputSourceIds.includes(entry.id),
        })),
      },
    ];
    return decorateMenu(currentMenu, {
      title: "Routing",
      accent: "amber",
      descriptionLines: [
        `OUTPUT ${slotLabel(currentMenu.targetSlotId).toUpperCase()}`,
        `VIS ${targetSlot.visualizationId.toUpperCase()} / INPUTS ${targetSlot.inputSourceIds.length}`,
        "LEFT/RIGHT CHANGES SECTION. ENTER SELECTS OR TOGGLES.",
      ],
      footer: "ROUTING MENU  /  ESC CLOSES",
      sections,
    });
  }

  const targetSlot = slotMap[currentMenu.targetSlotId];
  const sections = [
    {
      title: "ASCII Preset",
      items: ASCII_DEMO_PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.label,
        selected: targetSlot.ascii.preset === preset.id,
      })),
    },
    {
      title: "Border",
      items: borderModes.map((mode) => ({
        id: mode,
        label: mode.toUpperCase(),
        selected: targetSlot.ascii.border === mode,
      })),
    },
    {
      title: "Edge Glyphs",
      items: [
        { id: "on", label: "ON", selected: targetSlot.ascii.edges },
        { id: "off", label: "OFF", selected: !targetSlot.ascii.edges },
      ],
    },
    {
      title: "Fill Glyphs",
      items: [
        { id: "on", label: "ON", selected: targetSlot.ascii.fill },
        { id: "off", label: "OFF", selected: !targetSlot.ascii.fill },
      ],
    },
    {
      title: "Invert Fill",
      items: [
        { id: "off", label: "OFF", selected: !targetSlot.ascii.invertLuminance },
        { id: "on", label: "ON", selected: targetSlot.ascii.invertLuminance },
      ],
    },
    {
      title: "Edge Threshold",
      items: asciiControlValues("edgeThreshold").map((value) => ({
        id: String(value),
        label: formatAsciiControlValue("edgeThreshold", value),
        selected: targetSlot.ascii.edgeThreshold === value,
      })),
    },
    {
      title: "Normal Edge",
      items: asciiControlValues("normalThreshold").map((value) => ({
        id: String(value),
        label: formatAsciiControlValue("normalThreshold", value),
        selected: targetSlot.ascii.normalThreshold === value,
      })),
    },
    {
      title: "Depth Edge",
      items: asciiControlValues("depthThreshold").map((value) => ({
        id: String(value),
        label: formatAsciiControlValue("depthThreshold", value),
        selected: targetSlot.ascii.depthThreshold === value,
      })),
    },
    {
      title: "Exposure",
      items: asciiControlValues("exposure").map((value) => ({
        id: String(value),
        label: formatAsciiControlValue("exposure", value),
        selected: targetSlot.ascii.exposure === value,
      })),
    },
    {
      title: "Attenuation",
      items: asciiControlValues("attenuation").map((value) => ({
        id: String(value),
        label: formatAsciiControlValue("attenuation", value),
        selected: targetSlot.ascii.attenuation === value,
      })),
    },
    {
      title: "Base Blend",
      items: asciiControlValues("blendWithBase").map((value) => ({
        id: String(value),
        label: formatAsciiControlValue("blendWithBase", value),
        selected: targetSlot.ascii.blendWithBase === value,
      })),
    },
    {
      title: "Fog Falloff",
      items: asciiControlValues("depthFalloff").map((value) => ({
        id: String(value),
        label: formatAsciiControlValue("depthFalloff", value),
        selected: targetSlot.ascii.depthFalloff === value,
      })),
    },
    {
      title: "Fog Offset",
      items: asciiControlValues("depthOffset").map((value) => ({
        id: String(value),
        label: formatAsciiControlValue("depthOffset", value),
        selected: targetSlot.ascii.depthOffset === value,
      })),
    },
    {
      title: "Edge Bias",
      items: asciiControlValues("terminalEdgeBias").map((value) => ({
        id: String(value),
        label: formatAsciiControlValue("terminalEdgeBias", value),
        selected: targetSlot.ascii.terminalEdgeBias === value,
      })),
    },
    {
      title: "Cycle",
      items: [
        { id: "off", label: "OFF", selected: !targetSlot.cycleEnabled },
        { id: "on", label: "ON", selected: targetSlot.cycleEnabled },
      ],
    },
    {
      title: "Interval",
      items: [5000, 10000, 15000, 30000].map((value) => ({
        id: String(value),
        label: `${Math.round(value / 1000)}s`,
        selected: targetSlot.cycleIntervalMs === value,
      })),
    },
  ];

  return decorateMenu(currentMenu, {
    title: "Visualization Options",
    accent: "violet",
    descriptionLines: [
      `TARGET ${slotLabel(currentMenu.targetSlotId).toUpperCase()}`,
      `ASCII ${asciiPresetLabel(targetSlot.ascii.preset).toUpperCase()} / BORDER ${targetSlot.ascii.border.toUpperCase()}`,
      `EDGE ${targetSlot.ascii.edgeThreshold.toFixed(1)} / EXP ${targetSlot.ascii.exposure.toFixed(2)} / BLEND ${
        targetSlot.ascii.blendWithBase.toFixed(2)
      }`,
    ],
    footer: "OPTIONS MENU  /  F5 ALSO TOGGLES CYCLE",
    sections,
  });
}

function decorateMenu(
  currentMenu: MenuState,
  options: {
    title: string;
    accent: "alarm" | "amber" | "phosphor" | "signal" | "violet";
    descriptionLines: string[];
    footer: string;
    sections: Array<{ title: string; items: Array<{ id: string; label: string; selected: boolean }> }>;
  },
) {
  const section = options.sections[currentMenu.column] ?? options.sections[0];
  const lines = section
    ? [
      {
        text: `${section.title.toUpperCase()} ${
          section.items.length > 0 ? `(${currentMenu.index + 1}/${section.items.length})` : ""
        }`,
        style: makeStyle({ fg: accentColor(options.accent), bg: palette.panel, bold: true }),
      },
      ...section.items.map((item, index) => {
        const active = index === currentMenu.index;
        const marker = item.selected ? "■" : "·";
        return {
          text: `${marker} ${item.label}`,
          style: makeStyle({
            fg: active ? palette.void : item.selected ? palette.paper : palette.dim,
            bg: active ? accentColor(options.accent) : palette.panel,
            bold: active || item.selected,
          }),
        };
      }),
    ]
    : [];

  return {
    ...options,
    lines,
  };
}

function nextVisualization(currentId: string, slotId: SlotId) {
  return shiftVisualizationForSlot(slotId, currentId, 1, visualizations);
}

function slotLabel(slotId: SlotId) {
  switch (slotId) {
    case "cpu":
      return "CPU Panel";
    case "cpuLegend":
      return "CPU Legend";
    case "memory":
      return "Memory Panel";
    case "temperature":
      return "Temp Panel";
    case "disk":
      return "Disk Panel";
    case "network":
      return "Network Panel";
    case "processes":
      return "Process Panel";
  }
}

function createDefaultSlots(): Record<SlotId, SlotConfig> {
  return {
    cpu: {
      id: "cpu",
      name: "CPU",
      visualizationId: defaultVisualizationForSlot("cpu"),
      inputSourceIds: ["sys:cpu", "sys:load"],
      cycleEnabled: false,
      cycleIntervalMs: 10000,
      ascii: createDefaultAsciiOptions(),
    },
    cpuLegend: {
      id: "cpuLegend",
      name: "CPU Legend",
      visualizationId: defaultVisualizationForSlot("cpuLegend"),
      inputSourceIds: ["sys:cpu-cores"],
      cycleEnabled: false,
      cycleIntervalMs: 10000,
      ascii: createDefaultAsciiOptions(),
    },
    memory: {
      id: "memory",
      name: "Memory",
      visualizationId: defaultVisualizationForSlot("memory"),
      inputSourceIds: ["sys:memory", "sys:swap"],
      cycleEnabled: false,
      cycleIntervalMs: 10000,
      ascii: createDefaultAsciiOptions(),
    },
    temperature: {
      id: "temperature",
      name: "Temp",
      visualizationId: defaultVisualizationForSlot("temperature"),
      inputSourceIds: ["sys:temperature"],
      cycleEnabled: false,
      cycleIntervalMs: 10000,
      ascii: createDefaultAsciiOptions(),
    },
    disk: {
      id: "disk",
      name: "Disk",
      visualizationId: defaultVisualizationForSlot("disk"),
      inputSourceIds: ["sys:disk"],
      cycleEnabled: false,
      cycleIntervalMs: 10000,
      ascii: createDefaultAsciiOptions(),
    },
    network: {
      id: "network",
      name: "Network",
      visualizationId: defaultVisualizationForSlot("network"),
      inputSourceIds: ["sys:network"],
      cycleEnabled: false,
      cycleIntervalMs: 10000,
      ascii: createDefaultAsciiOptions(),
    },
    processes: {
      id: "processes",
      name: "Processes",
      visualizationId: defaultVisualizationForSlot("processes"),
      inputSourceIds: ["sys:processes", "sys:cpu"],
      cycleEnabled: false,
      cycleIntervalMs: 10000,
      ascii: createDefaultAsciiOptions(),
    },
  };
}

function crop(text: string, width: number) {
  if (width <= 0) {
    return "";
  }
  if (text.length <= width) {
    return text;
  }
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}

function titleInk(accent: Accent) {
  return accent === "alarm" || accent === "violet" ? palette.paper : palette.void;
}

void handleInput(tui);
tui.dispatch();
tui.on("destroy", () => {
  systemMonitor.stop();
  audioRegistry.dispose();
  for (const timer of timers) {
    clearInterval(timer);
  }
});
tui.run();

for (const object of shellObjects) {
  object.draw();
}
for (const panel of slotPanels.values()) {
  panel.draw();
}
menuOverlay.draw();
menuBackground.draw();
menuFrame.draw();
menuTitle.draw();
menuDescription.draw();
menuList.draw();
menuFooter.draw();
