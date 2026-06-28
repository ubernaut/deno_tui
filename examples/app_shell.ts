import { crayon } from "https://deno.land/x/crayon@3.3.3/mod.ts";

import {
  CommandPalette,
  Computed,
  createApp,
  dockRect,
  Frame,
  handleInput,
  handleKeyboardControls,
  KeyHelp,
  List,
  Modal,
  resolveBreakpoint,
  Signal,
  StatusBar,
  Text,
  type TextRectangle,
  ThemeEngine,
  type ToastMessage,
  ToastStack,
  Tree,
} from "../mod.ts";

type DemoAction =
  | { type: "route"; payload: string }
  | { type: "toast"; payload: string }
  | { type: "palette"; payload: boolean };

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

const themeEngine = new ThemeEngine({
  tokens: {
    foreground: crayon.white,
    muted: crayon.lightBlack,
    accent: crayon.cyan,
    success: crayon.green,
    warning: crayon.yellow,
    danger: crayon.red,
  },
  components: {
    Modal: {
      variants: {
        palette: { base: crayon.bgBlack.white, focused: crayon.bgBlack.cyan },
      },
    },
  },
});

const paletteVisible = new Signal(false);
const toasts = new Signal<ToastMessage[]>([
  { id: "boot", level: "success", message: "App shell ready" },
], { deepObserve: true });
const routeList = new Signal(app.routes.routes.peek().map((route) => route.title ?? route.id), { deepObserve: true });

app.keymap.register({ key: "1", description: "overview", group: "routes" });
app.keymap.register({ key: "2", description: "widgets", group: "routes" });
app.keymap.register({ key: "3", description: "runtime", group: "routes" });
app.keymap.register({ key: "p", description: "palette", group: "global" });
app.keymap.register({ key: "q", description: "quit", group: "global" });

app.actions.subscribe((action) => {
  if (action.type === "route") {
    app.routes.navigate(action.payload);
    pushToast(`Route changed to ${action.payload}`, "info");
  } else if (action.type === "toast") {
    pushToast(action.payload, "success");
  } else if (action.type === "palette") {
    paletteVisible.value = action.payload;
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
      "This demo wires app primitives, keymap, routes, command palette, tree, list, toasts, and responsive layout.",
      "Press p for palette, 1/2/3 for routes, q to quit.",
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
  items: [
    { id: "overview", label: "Go to Overview", keywords: ["route", "home"] },
    { id: "widgets", label: "Go to Widgets", keywords: ["route", "components"] },
    { id: "runtime", label: "Go to Runtime", keywords: ["route", "workers", "webgpu"] },
    { id: "toast", label: "Show Toast", keywords: ["notification"] },
  ],
  rectangle: new Computed(() => ({
    column: Math.max(3, Math.floor(app.tui.rectangle.value.width / 2) - 23),
    row: 5,
    width: 46,
    height: 7,
  })),
  visible: paletteVisible,
});

app.tui.on("keyPress", ({ key, ctrl, meta }) => {
  if (ctrl || meta) return;
  if (key === "q") {
    app.destroy();
    Deno.exit(0);
  } else if (key === "p") {
    void app.actions.dispatch({ type: "palette", payload: !paletteVisible.peek() });
  } else if (key === "1") {
    void app.actions.dispatch({ type: "route", payload: "overview" });
  } else if (key === "2") {
    void app.actions.dispatch({ type: "route", payload: "widgets" });
  } else if (key === "3") {
    void app.actions.dispatch({ type: "route", payload: "runtime" });
  } else if (key === "escape") {
    void app.actions.dispatch({ type: "palette", payload: false });
  }
});

app.start();

function pushToast(message: string, level: ToastMessage["level"]) {
  toasts.value.push({ id: crypto.randomUUID(), level, message });
  while (toasts.value.length > 4) {
    toasts.value.shift();
  }
}
