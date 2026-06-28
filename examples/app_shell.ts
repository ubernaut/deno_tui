import { crayon } from "https://deno.land/x/crayon@3.3.3/mod.ts";

import {
  CommandPalette,
  Computed,
  ContextMenu,
  createApp,
  createThemeEngine,
  dockRect,
  Frame,
  handleInput,
  handleKeyboardControls,
  KeyHelp,
  List,
  MenuBar,
  Modal,
  resolveBreakpoint,
  ScrollArea,
  Signal,
  StatusBar,
  Text,
  type TextRectangle,
  type ToastMessage,
  ToastStack,
  Tree,
} from "../mod.ts";

type DemoAction =
  | { type: "route"; payload: string }
  | { type: "toast"; payload: string }
  | { type: "palette"; payload: boolean }
  | { type: "context"; payload: boolean };

const app = createApp<DemoAction>({
  tuiOptions: {
    style: crayon.bgBlack,
    refreshRate: 1000 / 30,
  },
  routes: [
    { id: "overview", title: "Overview" },
    { id: "widgets", title: "Widgets" },
    { id: "runtime", title: "Runtime" },
  ],
});

handleInput(app.tui);
handleKeyboardControls(app.tui);

const themeEngine = createThemeEngine("neon", {
  tokens: { foreground: crayon.white },
  components: {
    Modal: {
      variants: {
        palette: { base: crayon.bgBlack.white, focused: crayon.bgBlack.cyan },
      },
    },
  },
});

const paletteVisible = new Signal(false);
const contextVisible = new Signal(false);
const activeMenu = new Signal(0);
const toasts = new Signal<ToastMessage[]>([
  { id: "boot", level: "success", message: "App shell ready" },
], { deepObserve: true });
const routeList = new Signal(app.routes.routes.peek().map((route) => route.title ?? route.id), { deepObserve: true });
const scrollLines = [
  "Composable primitives",
  "  ActionBus dispatches app events without coupling widgets to routes.",
  "  RouteManager keeps route state observable and testable.",
  "  FocusScope lets modal-like surfaces trap and restore focus.",
  "  ScrollArea owns a View so children can render in local coordinates.",
  "",
  "Runtime direction",
  "  WorkerPool handles CPU-bound jobs without blocking input.",
  "  AsyncScheduler limits concurrent async work.",
  "  Runtime capability checks keep WebGPU, WebGL, workers, and storage optional.",
  "",
  "Theming direction",
  "  ThemeEngine resolves semantic tokens, component variants, and palette presets.",
  "  Components consume theme slices instead of hard-coded styles.",
  "  Demos use the same theming API exported to application authors.",
];

app.commands.register({
  id: "route.overview",
  label: "Go to Overview",
  group: "routes",
  keywords: ["home", "route"],
  binding: { key: "1" },
  action: { type: "route", payload: "overview" },
});
app.commands.register({
  id: "route.widgets",
  label: "Go to Widgets",
  group: "routes",
  keywords: ["components", "route"],
  binding: { key: "2" },
  action: { type: "route", payload: "widgets" },
});
app.commands.register({
  id: "route.runtime",
  label: "Go to Runtime",
  group: "routes",
  keywords: ["workers", "webgpu", "route"],
  binding: { key: "3" },
  action: { type: "route", payload: "runtime" },
});
app.commands.register({
  id: "palette.toggle",
  label: "Toggle Command Palette",
  group: "global",
  keywords: ["command", "search"],
  binding: { key: "p" },
  action: () => ({ type: "palette", payload: !paletteVisible.peek() }),
});
app.commands.register({
  id: "context.toggle",
  label: "Toggle Context Menu",
  group: "global",
  keywords: ["actions", "menu"],
  binding: { key: "c" },
  action: () => ({ type: "context", payload: !contextVisible.peek() }),
});
app.commands.register({
  id: "toast.show",
  label: "Show Toast",
  group: "global",
  keywords: ["notification"],
  action: { type: "toast", payload: "Command executed" },
});
app.commands.register({
  id: "app.quit",
  label: "Quit",
  group: "global",
  binding: { key: "q" },
  action: () => {
    app.destroy();
    Deno.exit(0);
  },
});

for (const binding of app.commands.keyBindings()) {
  app.keymap.register(binding);
}

app.actions.subscribe((action) => {
  if (action.type === "route") {
    app.routes.navigate(action.payload);
    pushToast(`Route changed to ${action.payload}`, "info");
  } else if (action.type === "toast") {
    pushToast(action.payload, "success");
  } else if (action.type === "palette") {
    paletteVisible.value = action.payload;
  } else if (action.type === "context") {
    contextVisible.value = action.payload;
  }
});

new StatusBar({
  parent: app.tui,
  theme: themeEngine.component("StatusBar"),
  zIndex: 1,
  left: new Computed(() => `Deno TUI app shell / ${app.routes.active()?.title ?? "No route"}`),
  right: new Computed(() =>
    resolveBreakpoint(app.tui.rectangle.value, [
      { id: "mobile" },
      { id: "wide", minWidth: 100 },
    ])
  ),
  rectangle: new Computed(() => ({ column: 0, row: 0, width: app.tui.rectangle.value.width, height: 1 })),
});

const menuBar = new MenuBar({
  parent: app.tui,
  theme: themeEngine.component("MenuBar"),
  zIndex: 2,
  items: [
    { id: "routes", label: "Routes" },
    { id: "widgets", label: "Widgets" },
    { id: "runtime", label: "Runtime" },
  ],
  activeIndex: activeMenu,
  rectangle: new Computed(() => ({
    column: 2,
    row: 2,
    width: Math.max(20, app.tui.rectangle.value.width - 4),
    height: 1,
  })),
});

const bodyRect = new Computed(() => dockRect(app.tui.rectangle.value, "top", 1).second);

new Frame({
  parent: app.tui,
  theme: themeEngine.component("Frame"),
  zIndex: 1,
  charMap: "rounded",
  rectangle: new Computed(() => {
    const rect = bodyRect.value;
    return {
      column: rect.column + 2,
      row: rect.row + 2,
      width: Math.max(10, rect.width - 35),
      height: Math.max(6, rect.height - 7),
    };
  }),
});

new Text({
  parent: app.tui,
  theme: themeEngine.component("Text"),
  zIndex: 2,
  text: new Computed(() =>
    [
      `Route: ${app.routes.active()?.title ?? "none"}`,
      "This demo wires app primitives, keymap, routes, command palette, context menu, tree, list, toasts, and responsive layout.",
      "Press p for palette, c for context actions, 1/2/3 for routes, q to quit.",
    ].join("  ")
  ),
  overwriteWidth: true,
  rectangle: new Computed<TextRectangle>(() => ({
    column: 4,
    row: 4,
    width: Math.max(20, app.tui.rectangle.value.width - 42),
  })),
});

new Tree({
  parent: app.tui,
  theme: themeEngine.component("Tree"),
  zIndex: 2,
  nodes: [
    {
      id: "app",
      label: "App",
      expanded: true,
      children: [
        { id: "routes", label: "RouteManager" },
        { id: "actions", label: "ActionBus" },
        { id: "focus", label: "FocusManager" },
      ],
    },
    {
      id: "widgets",
      label: "Widgets",
      expanded: true,
      children: [
        { id: "palette", label: "CommandPalette" },
        { id: "toasts", label: "ToastStack" },
      ],
    },
  ],
  rectangle: new Computed(() => ({
    column: 4,
    row: 7,
    width: 36,
    height: Math.max(5, app.tui.rectangle.value.height - 12),
  })),
});

new List({
  parent: app.tui,
  theme: themeEngine.component("List"),
  zIndex: 2,
  items: routeList,
  rectangle: new Computed(() => ({
    column: Math.max(42, app.tui.rectangle.value.width - 30),
    row: 4,
    width: 24,
    height: 5,
  })),
});

const scrollArea = new ScrollArea({
  parent: app.tui,
  theme: themeEngine.component("ScrollArea"),
  zIndex: 2,
  contentWidth: 74,
  contentHeight: scrollLines.length,
  rectangle: new Computed(() => ({
    column: Math.max(42, Math.floor(app.tui.rectangle.value.width / 2)),
    row: 10,
    width: Math.max(
      24,
      app.tui.rectangle.value.width - Math.max(42, Math.floor(app.tui.rectangle.value.width / 2)) - 4,
    ),
    height: Math.max(4, app.tui.rectangle.value.height - 17),
  })),
});
app.enableFocusNavigation({ items: [menuBar, scrollArea] });
app.focus.focus(scrollArea);

for (const [index, line] of scrollLines.entries()) {
  new Text({
    parent: scrollArea,
    theme: themeEngine.component("Text"),
    zIndex: 2,
    text: line,
    overwriteWidth: true,
    view: scrollArea.contentView,
    rectangle: {
      column: 0,
      row: index,
      width: 72,
    },
  });
}

new ToastStack({
  parent: app.tui,
  theme: themeEngine.component("ToastStack"),
  zIndex: 4,
  messages: toasts,
  rectangle: new Computed(() => ({
    column: Math.max(0, app.tui.rectangle.value.width - 42),
    row: Math.max(2, app.tui.rectangle.value.height - 6),
    width: 40,
    height: 4,
  })),
});

new KeyHelp({
  parent: app.tui,
  theme: themeEngine.component("KeyHelp"),
  zIndex: 2,
  bindings: app.keymap,
  rectangle: new Computed(() => ({
    column: 0,
    row: Math.max(0, app.tui.rectangle.value.height - 1),
    width: app.tui.rectangle.value.width,
    height: 1,
  })),
});

new Modal({
  parent: app.tui,
  theme: themeEngine.component("Modal", "palette"),
  zIndex: 10,
  title: "Command Palette",
  rectangle: new Computed(() => ({
    column: Math.max(2, Math.floor(app.tui.rectangle.value.width / 2) - 24),
    row: 4,
    width: 48,
    height: 9,
  })),
  visible: paletteVisible,
});

new CommandPalette({
  parent: app.tui,
  theme: themeEngine.component("CommandPalette"),
  zIndex: 11,
  items: new Computed(() => app.commands.projections(undefined, false)),
  rectangle: new Computed(() => ({
    column: Math.max(3, Math.floor(app.tui.rectangle.value.width / 2) - 23),
    row: 5,
    width: 46,
    height: 7,
  })),
  onSelect: (item) => {
    paletteVisible.value = false;
    return app.executeCommand(item.id).then(() => undefined);
  },
  visible: paletteVisible,
});

new ContextMenu({
  parent: app.tui,
  theme: themeEngine.component("ContextMenu"),
  zIndex: 9,
  items: new Computed(() => [
    ...app.commands.projections("routes", false),
    { id: "separator", label: "", separatorBefore: true },
    ...app.commands.projections("global", false).filter((item) => item.id !== "app.quit"),
  ]),
  rectangle: new Computed(() => ({
    column: Math.max(2, app.tui.rectangle.value.width - 34),
    row: 4,
    width: 30,
    height: 7,
  })),
  onSelect: (item) => {
    contextVisible.value = false;
    return app.executeCommand(item.id).then(() => undefined);
  },
  visible: contextVisible,
});

app.tui.on("keyPress", ({ key, ctrl, meta }) => {
  if (ctrl || meta) return;
  if (key === "q") {
    void app.executeCommand("app.quit");
  } else if (key === "p") {
    void app.executeCommand("palette.toggle");
  } else if (key === "c") {
    void app.executeCommand("context.toggle");
  } else if (key === "1") {
    void app.executeCommand("route.overview");
  } else if (key === "2") {
    void app.executeCommand("route.widgets");
  } else if (key === "3") {
    void app.executeCommand("route.runtime");
  } else if (key === "escape") {
    void app.actions.dispatch({ type: "palette", payload: false });
    void app.actions.dispatch({ type: "context", payload: false });
  }
});

app.start();

function pushToast(message: string, level: ToastMessage["level"]) {
  toasts.value.push({ id: crypto.randomUUID(), level, message });
  while (toasts.value.length > 4) {
    toasts.value.shift();
  }
}
