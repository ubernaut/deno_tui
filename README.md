# Tui

<img src="https://raw.githubusercontent.com/Im-Beast/deno_tui/main/docs/logo-transparent.png" align="right" width="250" height="250" alt="Deno mascot made as ASCII art" />

[![Deno](https://github.com/Im-Beast/deno_tui/actions/workflows/deno.yml/badge.svg)](https://github.com/Im-Beast/deno_tui/actions/workflows/deno.yml)
[![Deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https://deno.land/x/tui/mod.ts)

A [Deno](https://github.com/denoland/deno/) module for building Terminal User Interfaces. Reactive, composable, and
zero-dependency.

This fork extends the original TUI toolkit into a WebGPU-backed terminal visualization lab. The core component set is
still here, but the headline additions are a richer three.js ASCII renderer, Neon Exodus-style visualization demos, and
a system monitor shell that can render live data through those scenes.

## Fork Highlights

- **Acerola-inspired three.js ASCII backend** — the `ThreeAscii` renderer now drives a WebGPU post-processing path with
  edge, fill, depth, color, and fog controls.
- **Terminal glyph modes** — switch between chunky block output, ASCII glyph output, or a mixed mode that chooses the
  best block/glyph match for the scene.
- **Visualization launcher** — run the added demos from the project root with `./visualization`.
- **Standalone geometry demo** — renders a torus knot, sphere, cube, and floor through the terminal ASCII renderer.
- **Neon Exodus showcase** — recreates the Neon Exodus widget wall and 3D scene set inside this TUI framework.
- **System monitor dashboard** — `deno task viz` renders CPU, memory, disk, network, process, and 3D panels with
  selectable inputs and visualizations.
- **Expanded widget surface** — List, Tabs, Breadcrumbs, MenuBar, ContextMenu, RadioGroup, ScrollArea, Modal, KeyHelp,
  CommandPalette, Tree, ToastStack, Sparkline, Gauge, Chart, LogViewer, and StatusBar build on the original component
  set.
- **Dashboard data controllers** — bounded metric series state keeps charts, sparklines, gauges, and telemetry panels
  composable without every app rebuilding the same history buffer.
- **Runtime capability layer** — Workers, WebGPU, WebGL, OffscreenCanvas, and IndexedDB are detected through a
  standards-oriented runtime module with configurable fallbacks.
- **Theme engine focus** — semantic tokens, palette presets, named theme packs, runtime providers, component variants,
  composition helpers, and inspection APIs produce normal `Theme` objects while keeping app-level styling reusable.

## Features

- **Reactive by default** — UI updates automatically via a built-in signals system (`Signal`, `Computed`, `Effect`)
- **Rich component library** — Box, Button, CheckBox, ComboBox, Input, TextBox, Label, Slider, ProgressBar, Table,
  Frame, and more
- **Flexible layouts** — `GridLayout`, `HorizontalLayout`, and `VerticalLayout` for declarative, proportional
  positioning
- **Keyboard and mouse input** — full support including drag events
- **Views** — scrollable viewports with offset control
- **Three.js ASCII renderer** — render 3D scenes as ASCII art in the terminal via the `ThreeAscii` component
- **Styling framework agnostic** — works with any terminal styling library;
  [Crayon](https://github.com/crayon-js/crayon) is recommended
- **Zero dependencies** — no external runtime dependencies required

## OS Support

| Operating system | Linux | macOS | Windows* | WSL |
| ---------------- | ----- | ----- | -------- | --- |
| Base             | yes   | yes   | yes      | yes |
| Keyboard support | yes   | yes   | yes      | yes |
| Mouse support    | yes   | yes   | yes      | yes |

\* On Windows, if Unicode characters display incorrectly, run `chcp 65001` to switch the console to UTF-8.

## Quick Start

### 1. Create a Tui instance

```ts
import { crayon } from "https://deno.land/x/crayon@3.3.3/mod.ts";
import { Tui } from "https://deno.land/x/tui@VERSION/mod.ts";

const tui = new Tui({
  style: crayon.bgBlack,
  refreshRate: 1000 / 60, // 60 FPS
});

tui.dispatch(); // exits on Ctrl+C
tui.run();
```

### 2. Enable keyboard and mouse input

```ts
import { handleInput, handleKeyboardControls, handleMouseControls } from "https://deno.land/x/tui@VERSION/mod.ts";

handleInput(tui);
handleKeyboardControls(tui);
handleMouseControls(tui);
```

### 3. Add components

```ts
import { Button } from "https://deno.land/x/tui@VERSION/src/components/mod.ts";
import { Computed, Signal } from "https://deno.land/x/tui@VERSION/mod.ts";

const count = new Signal(0);

const button = new Button({
  parent: tui,
  zIndex: 0,
  label: {
    text: new Computed(() => `Count: ${count.value}`),
  },
  theme: {
    base: crayon.bgBlue,
    focused: crayon.bgLightBlue,
    active: crayon.bgCyan,
  },
  rectangle: { column: 2, row: 2, height: 3, width: 16 },
});

button.state.when("active", () => {
  count.value++;
});
```

Run the demo to see all components in action:

```sh
deno task demo
```

## Components

| Component     | Description                                                |
| ------------- | ---------------------------------------------------------- |
| `Box`         | Filled rectangle                                           |
| `Button`      | Clickable box with an optional label                       |
| `CheckBox`    | Toggle between checked and unchecked states                |
| `ComboBox`    | Dropdown selector                                          |
| `Frame`       | Decorative border around a region                          |
| `Input`       | Single-line text input with optional password masking      |
| `TextBox`     | Multi-line text editor with line numbers and highlighting  |
| `Label`       | Text with configurable horizontal/vertical alignment       |
| `Text`        | Raw text drawn directly on the canvas                      |
| `ProgressBar` | Horizontal or vertical progress indicator (smooth-capable) |
| `Slider`      | Horizontal or vertical value slider                        |
| `Table`       | Scrollable data table with headers and row selection       |
| `ThreeAscii`  | Renders a three.js scene as ASCII art in the terminal      |

Additional fork components include `List`, `VirtualList`, `Tabs`, `Breadcrumbs`, `Stepper`, `Spinner`, `EmptyState`,
`MenuBar`, `ContextMenu`, `RadioGroup`, `ScrollArea`, `Modal`, `KeyHelp`, `CommandPalette`, `Tree`, `ToastStack`,
`Sparkline`, `Gauge`, `Chart`, `LogViewer`, and `StatusBar`. `VirtualList` combines viewport windowing and
`SelectionController` for large custom data views, while `Spinner` and `EmptyState` pair naturally with `AsyncResource`
loading/empty/error state. `componentCatalog`, `listComponents()`, `findComponent()`, `componentsByCategory()`, and
`componentsWithCapability()` provide an inspectable widget inventory for docs, launchers, settings screens, and command
palettes:

```ts
const overlays = componentsByCategory("overlay");
const dashboardWidgets = componentsWithCapability("dashboard");
const threeAscii = findComponent("ThreeAscii");
```

For table-heavy apps, `DataTableController`, `createDataTableView()`, `sortDataRows()`, and the data-table render
helpers provide reusable filtering, sorting, pagination, selection, and row formatting without coupling data logic to
the `Table` renderer:

```ts
const table = new DataTableController({
  rows: processRows,
  columns: [
    { id: "pid", label: "PID", width: 6 },
    { id: "name", label: "Name", sortable: true },
    { id: "cpu", label: "CPU", sortable: true },
  ],
  initialState: { pageSize: 20 },
});

table.setQuery(search.value);
table.toggleSort("cpu");
const visibleRows = table.view.value.rows;
```

For metric-heavy dashboards, `MetricSeriesController`, `pushMetricValue()`, and `metricSeriesStats()` provide the shared
bounded-history layer used by sparklines, bar charts, gauges, logs, worker-fed telemetry, and system-monitor panels:

```ts
const cpu = new MetricSeriesController({ limit: 120, clamp: true });

cpu.push(snapshot.cpuRatio);
const sparkline = renderSparkline(cpu.values.value, 30);
const latestCpu = cpu.stats.value.latest;
```

## Layouts

Layouts compute reactive `Rectangle` signals for each named element. Pass them directly as a component's `rectangle`.

### GridLayout

Arrange elements in a named grid pattern:

```ts
import { GridLayout } from "https://deno.land/x/tui@VERSION/mod.ts";

const layout = new GridLayout({
  pattern: [
    ["header", "header"],
    ["sidebar", "main"],
    ["footer", "footer"],
  ],
  gapX: 1,
  gapY: 0,
  rectangle: tui.rectangle,
});

new Button({ parent: tui, rectangle: layout.element("header"), zIndex: 0, ... });
new Button({ parent: tui, rectangle: layout.element("sidebar"), zIndex: 0, ... });
```

Elements that appear multiple times in the pattern occupy proportionally more space.

### HorizontalLayout / VerticalLayout

Divide space into named slices along one axis:

```ts
import { HorizontalLayout } from "https://deno.land/x/tui@VERSION/mod.ts";

const layout = new HorizontalLayout({
  pattern: ["left", "right"],
  rectangle: tui.rectangle,
  gapX: 1,
});
```

### Flex Layout

`flexRects()` provides a small, public flexbox-like rectangle solver for row or column layouts:

```ts
import { flexRects } from "https://deno.land/x/tui@VERSION/mod.ts";

const rects = flexRects(bounds, "row", [
  { id: "sidebar", basis: 24, min: 16 },
  { id: "main", grow: 1, min: 40 },
], 1);
```

### Split Panes

`splitPaneRects()` returns first pane, separator, and second pane rectangles for resizable app shells. Use
`resizeSplitPane()` for pixel-sized panes, `resizeSplitPaneRatio()` for responsive ratios, or `SplitPaneController` when
pane state should be observable, persisted, or shared across input handlers:

```ts
import { SplitPaneController, splitPaneRects } from "https://deno.land/x/tui@VERSION/mod.ts";

const panes = splitPaneRects(bounds, {
  direction: "row",
  ratio: 0.65,
  minFirst: 32,
  minSecond: 24,
  gap: 1,
});

const split = new SplitPaneController({
  direction: "row",
  ratio: 0.65,
  minFirst: 32,
  minSecond: 24,
  resizeMode: "ratio",
});

const nextPanes = split.resize(bounds, 4);
splitRatioSetting.set(split.snapshot().ratio ?? 0.65);
```

Responsive helpers are also exported for common app shell layout:

- `resolveBreakpoint()`
- `insetRect()`
- `splitRect()`
- `dockRect()`
- `resolveLayoutRecipe()`
- `createLayoutRecipeController()`
- `layoutRecipeSlots()`
- `splitPaneRects()`
- `resizeSplitPane()`
- `resizeSplitPaneRatio()`
- `SplitPaneController`

`resolveLayoutRecipe()` layers named app-shell regions over those primitives. Define breakpoint-specific trees with
`split`, `dock`, and leaf `id` nodes, then pass the resulting rectangles directly to components:

```ts
const shell = resolveLayoutRecipe(tui.rectangle.value, {
  breakpoints: [{ id: "compact" }, { id: "wide", minWidth: 100 }],
  fallback: "compact",
  layouts: {
    compact: { id: "main", inset: 1 },
    wide: {
      split: "row",
      ratio: 0.25,
      gap: 1,
      first: { id: "nav", minWidth: 16 },
      second: { id: "main" },
    },
  },
});

const mainRect = shell.rects.main;
```

Use `createLayoutRecipeController()` when the app shell should react to a viewport signal and expose derived slot
rectangles without rebuilding computed state in each component module:

```ts
const shell = createLayoutRecipeController(tui.rectangle, recipe);
const mainRect = shell.rect("main");

app.onDispose(() => {
  mainRect.dispose();
  shell.dispose();
});
```

## App Primitives

This fork exports lightweight app primitives for larger TUIs:

- `createApp()` / `TuiApp`
- `ActionBus`
- `CommandRegistry`
- `FormController`
- `HistoryStack`
- `RouteManager`
- `FocusManager`
- `FocusScope`
- `KeymapRegistry`
- `SelectionController` and selection helpers
- `SettingsController`
- viewport helpers such as `viewportWindow()`, `viewportOffsetBy()`, and `viewportThumb()`

They are optional and composable. Existing component-first apps continue to work. Use `FocusManager.register()` or
`registerAll()` to add focusable components with disposer-friendly ownership, `inspect()` for status/debug panels, and
`clear()` when replacing a whole focus region. Use `app.enableFocusNavigation()` or `bindFocusNavigation()` to opt into
Tab/Shift+Tab traversal for registered focusable components.

Use `ActionBus.subscribeType()` or `app.onActionType()` to handle one action family at a time while preserving typed
payloads. The app-level helpers track cleanup automatically:

```ts
app.onActionType("route", (action) => app.routes.navigate(action.payload));
app.onActionType("toast", (action) => pushToast(action.payload, "success"));
```

`TuiApp.onDispose()` tracks cleanup callbacks and runs them once on `app.destroy()`. Built-in app binders such as
`app.enableFocusNavigation()` and `app.enableCommandKeys()` are tracked automatically:

```ts
app.onDispose(bindModalFocus(app.tui, paletteVisible, app.focus, [commandPalette]));
```

Use `app.use()` or `app.useAll()` to install reusable app plugins. A plugin receives the app instance and can register
routes, commands, focus items, theme providers, runtime resources, or any other module-level state. Returning a disposer
keeps teardown tied to the app lifecycle. Identified plugins are tracked by `app.plugins()`, `app.pluginIds()`, and
`app.hasPlugin(id)`, so larger apps can inspect active modules and avoid duplicate installs. Passing `{ replace: true }`
to `app.use(plugin, options)` swaps an existing identified plugin before installing the replacement:

```ts
const stopSettings = app.use({
  id: "settings",
  label: "Settings Pack",
  install(app) {
    app.commands.register({
      id: "settings.open",
      label: "Settings",
      action: { type: "route", payload: "settings" },
    });

    return () => app.commands.unregister("settings.open");
  },
});

const activePlugins = app.plugins();
```

`SettingsController` wraps `PersistentSignal` with app-level namespacing, caching, aggregate readiness, flushing, reset,
and disposal. Use it for preferences such as active route, theme pack, layout density, split ratios, hidden controls, or
visualization settings while keeping storage configurable. `bindSettingSignal()`, `bindRouteSetting()`,
`bindThemeSetting()`, `bindThemeLayerSetting()`, and `bindSplitPaneSetting()` wire those preferences into app state
without each app rebuilding two-way synchronization logic:

```ts
const settings = new SettingsController({
  namespace: "dashboard",
  store: createRuntimeStore({ databaseName: "dashboard", storeName: "preferences" }),
});

const activeRoute = settings.signal({ key: "route", initialValue: "overview" });
const activeTheme = settings.signal({ key: "theme", initialValue: "neon" });
const stopRouteSetting = bindRouteSetting(app.routes, settings);
const stopThemeSetting = bindThemeSetting(themeProvider, settings);
const stopThemeLayers = bindThemeLayerSetting(themeProvider, settings, {
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});
const stopSplitSetting = bindSplitPaneSetting(splitController, settings, {
  key: "main-split",
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

await settings.ready();
activeRoute.set("runtime");
activeTheme.set("terminal");
await settings.flush();

app.onDispose(stopRouteSetting.dispose);
app.onDispose(stopThemeSetting.dispose);
app.onDispose(stopThemeLayers.dispose);
app.onDispose(stopSplitSetting.dispose);
```

`bindModalFocus()` ties a visibility signal to a `FocusScope`, traps focus while modal-like surfaces are open, restores
the previous focused item when they close, and can close on `Escape`:

```ts
const stopModalFocus = bindModalFocus(app.tui, paletteVisible, app.focus, [commandPalette]);
```

Commands can also bind directly to key events:

```ts
app.commands.register({
  id: "route.runtime",
  label: "Runtime",
  binding: { key: "2" },
  action: { type: "route", payload: "runtime" },
});

const stopCommandKeys = app.enableCommandKeys();
```

`CommandRegistry.register()` and `CommandRegistry.registerAll()` return disposers, so plugin-provided commands can be
installed and removed without tracking ids separately:

```ts
const stopCommands = app.commands.registerAll([
  { id: "route.overview", label: "Overview", action: { type: "route", payload: "overview" } },
  { id: "route.logs", label: "Logs", action: { type: "route", payload: "logs" } },
]);
```

For embedded command surfaces, use `bindCommandKeys(target, registry, dispatch)` with any object that emits `keyPress`
events. Use `app.enableCommandKeymap()` or `bindCommandKeymap()` to keep help overlays synchronized with the currently
registered command bindings:

```ts
const stopCommandHelp = app.enableCommandKeymap();
```

Use `createCommandSurface()` or `bindCommandSurface()` to feed command registries into palettes, context menus, or
custom launchers without duplicating projection, synchronization, and dispatch code:

```ts
const commandSurface = createCommandSurface(app.commands, (action) => app.actions.dispatch(action), {
  includeDisabled: false,
});

const items = commandSurface.items;
await commandSurface.execute(items.value[0]);
app.onDispose(commandSurface.dispose);
```

For one-off projections, `commandSurfaceItems()` and `executeCommandSurfaceItem()` remain available.

`FormController` keeps form state separate from rendering:

```ts
const form = new FormController([
  { name: "route", initialValue: "overview", validators: [required()] },
]);

const stopBinding = bindFormField(form, "route", input.text);
form.setValue("route", "runtime");
const ok = form.validate();
```

`bindFormField()` connects a controller field to any `Signal`-backed widget value, including `Input.text`,
`CheckBox.checked`, `RadioGroup.selectedValue`, or a custom adapter signal. It accepts `parse` and `format` transforms
for non-string values and returns a disposer for dynamic forms.

`bindRouteSignal()` keeps a `RouteManager` active route synchronized with a plain or persistent route id signal:

```ts
app.routes.register({ id: "settings", title: "Settings" });
app.routes.unregister("settings", { fallbackRouteId: "overview" });

const stopRouteBinding = bindRouteSignal(app.routes, activeRoute.value, {
  initialSync: "signal",
  fallbackRouteId: "overview",
});
```

`RouteManager.register()` and `RouteManager.unregister()` are useful for plugin-provided routes and keep the active
route valid when routes are added, replaced, or removed.

`bindRouteIndex()` connects route state to index-backed widgets such as tabs, steppers, menu bars, or custom segmented
controls:

```ts
const routeStepIndex = new Signal(0);
const stopRouteSteps = bindRouteIndex(app.routes, routeStepIndex, {
  routeIds: ["overview", "widgets", "runtime"],
});
```

`HistoryStack` keeps undo/redo separate from widgets and route managers:

```ts
const history = new HistoryStack({ capacity: 50 });

await history.apply({
  label: "Rename item",
  redo: () => renameItem(id, nextName),
  undo: () => renameItem(id, previousName),
});

await history.undo();
await history.redo();
```

`bindRouteHistory()` records `RouteManager` changes as undoable route transitions and can replay them through your app
action bus:

```ts
const stopRouteHistory = bindRouteHistory(app.routes, history, {
  navigate: (routeId) => app.actions.dispatch({ type: "route", payload: routeId, history: false }),
});
```

Selection helpers keep large lists, tables, and custom browsers consistent:

```ts
const selection = new SelectionController({
  length: rows.length,
  mode: "multiple",
});

selection.move(1);
selection.toggle();
const window = selection.window(12);
```

`bindSelectionValue()` connects a controller to stable domain values, which is useful when selected rows need to survive
filtering, persistence, or list reordering:

```ts
const selectedProcessId = new Signal<number | undefined>(persistedPid);
const stopSelectionBinding = bindSelectionValue(selection, rows, selectedProcessId, {
  valueForItem: (row) => row.pid,
  initialSync: "value",
});

const stopSelectionCommands = bindSelectionCommands(app.commands, selection, {
  idPrefix: "processes",
  group: "process-list",
  pageSize: () => processListHeight.value,
  includeClear: true,
});
```

Viewport helpers keep scrolling, virtual rows, and scrollbar thumbs consistent:

```ts
const maxOffset = maxViewportOffset(contentWidth, contentHeight, width, height);
const offset = viewportOffsetBy(currentOffset, maxOffset, 0, 1);
const rows = viewportWindow(items.length, selection.state.value.activeIndex, height);
```

## Theming

Use `createTheme()` for semantic tokens, `createThemeEngine()` for built-in palettes, `ThemeRegistry` for named theme
packs, or `ThemeProvider` for runtime theme selection. This fork treats theming as an engine layer, not just a bag of
component props: it adds `composeThemeOptions()`, `composeStyles()`, component inheritance, token-backed style
pipelines, app-level provider cycling, runtime theme layers, optional async persistence, `ThemeEngine.extend()`, and
`ThemeEngine.inspect()` so larger apps can layer reusable theme packs without mutating a base engine:

```ts
import {
  bindComponentTheme,
  composeThemeOptions,
  createRuntimeStore,
  createThemeEngine,
  createThemeLayerStack,
  createThemeProvider,
  createThemeRegistry,
} from "https://deno.land/x/tui@VERSION/mod.ts";

const appTheme = composeThemeOptions({
  components: {
    Field: {
      base: {
        base: "foreground",
        focused: ["accent", crayon.bold],
      },
    },
    ComboBox: {
      extends: "Field",
    },
    Button: {
      variants: {
        danger: { base: "danger", active: ["danger", crayon.bold] },
      },
    },
  },
});

const themeEngine = createThemeEngine("neon", appTheme)
  .extend({
    components: {
      Modal: { variants: { palette: { focused: crayon.cyan } } },
    },
  });

const buttonTheme = themeEngine.component("Button", "danger");
const availableThemes = themeEngine.inspect();

const registry = createThemeRegistry([
  { id: "terminal", label: "Terminal", palette: "terminal" },
  { id: "neon-ops", label: "Neon Ops", palette: "neon", options: appTheme },
]);
const layers = createThemeLayerStack([
  {
    id: "high-contrast",
    enabled: false,
    options: {
      components: {
        Field: { base: { focused: ["warning", crayon.bold] } },
      },
    },
  },
]);
const themeStore = createRuntimeStore<string>({
  databaseName: "my-tui-app",
  storeName: "settings",
});
const provider = createThemeProvider({
  registry,
  layers,
  activeId: "neon-ops",
  store: themeStore,
  storageKey: "theme",
});

provider.setTheme("terminal");
layers.toggle("high-contrast");
provider.nextTheme();
await provider.flush();

const activeButtonTheme = provider.component("Button", "danger").value;
const themeInventory = provider.inspect();

// After constructing a Button component instance named `button`:
const stopBinding = bindComponentTheme(button, provider, "Button", {
  variant: "danger",
});
```

`ThemeRegistry.engine(id, overrides)` composes a named pack with per-app overrides, while `ThemeProvider.component()`
and `ThemeProvider.resolve()` expose computed signals for active component themes and individual state styles.
`ThemeProvider.themeIds()`, `nextTheme()`, `previousTheme()`, and `cycleTheme(direction)` keep theme switching
deterministic across command palettes, menus, and key bindings. Pass any `AsyncStore<string>` to persist the active pack
through `MemoryStore`, `IndexedDbStore`, or a custom settings backend; `provider.ready` reports the loaded theme and
`provider.flush()` waits for pending writes. `bindComponentTheme()` bridges those provider signals back into normal
components and returns a disposer, so live theme switching stays centralized and testable without requiring widgets to
know where their theme came from. `ThemeLayerStack` adds runtime overlays for density, contrast, accessibility, or
brand-specific state treatments; `enable()`, `disable()`, `toggle()`, `activeIds()`, and `inspect()` make those overlays
usable from command palettes and settings screens while preserving deterministic composition order. Component
definitions can also reference semantic token names such as `"foreground"`, `"accent"`, `"danger"`, or `"surface"`
instead of concrete style functions, so variants automatically follow the active palette. A state style may also be an
array of token names and style functions; the engine composes the pipeline in order. Component definitions can `extend`
one or more other definitions, which makes aliases like `ComboBox -> Field` or shared role themes cheap while preserving
variants and app-level overrides.

## Runtime Capabilities

Optional high-performance APIs are surfaced through `src/runtime/mod.ts`:

- `detectRuntimeCapabilities()`
- `AsyncScheduler` / `runTaskBatch()`
- `AsyncResource` / `createAsyncResource()` / `bindResourceParams()`
- `runDataPipeline()` / `LatestDataPipeline` / `bindDataPipeline()` / `workerTransform()`
- `WorkerPool`
- `MemoryStore`
- `IndexedDbStore`
- `createRuntimeStore()`
- `createPersistentSignal()` / `PersistentSignal`

Use these instead of hard-coding global checks inside components.

`AsyncScheduler` caps concurrent work, prioritizes queued tasks, exposes queue inspection, and can wait for or clear
pending work. `runTaskBatch()` builds on the same scheduler for ordered fan-out work:

```ts
const scheduler = new AsyncScheduler({ concurrency: 2 });
const controller = new AbortController();

await scheduler.run(() => refreshVisibleRows(), {
  priority: 10,
  signal: controller.signal,
});

const status = scheduler.inspect();
await scheduler.waitForIdle();
scheduler.clearPending();

const rows = await runTaskBatch(processIds, {
  scheduler,
  priority: 5,
  signal: controller.signal,
  task: async (pid) => await loadProcessRow(pid),
});
```

Use higher priorities for focused panels or visible rows, and abort pending tasks when filters, routes, or visualization
inputs change before queued work starts. `inspect()`, `pending()`, `running()`, `capacity()`, and `idle()` are useful
for status bars, diagnostics, and backpressure controls. Batch results preserve input order even when queued tasks run
by priority, so callers can hydrate lists and tables without rebuilding index bookkeeping.

`AsyncResource` exposes signal-backed async state for loading data, handling errors, aborting stale work, and preserving
previous data during refreshes:

```ts
const metrics = createAsyncResource({
  loader: async ({ signal }) => await fetchMetrics({ signal }),
  scheduler: new AsyncScheduler({ concurrency: 1 }),
  priority: 5,
});

await metrics.load();
if (metrics.state.value.status === "success") render(metrics.state.value.data);
```

`bindResourceParams()` connects a params signal to a resource, with optional debounce for search boxes, filters, route
params, and other fast-changing UI state:

```ts
const query = new Signal("");
const stopMetrics = bindResourceParams(metrics, query, {
  debounceMs: 100,
  abortOnDispose: true,
});
```

`runDataPipeline()` composes expensive row transforms behind an optional scheduler. `workerTransform()` lets any stage
offload work through a `WorkerPool` or compatible runner. `LatestDataPipeline` protects interactive views from stale
async results when users type or change filters quickly:

```ts
import {
  filterRows,
  LatestDataPipeline,
  mapRows,
  sortRows,
  WorkerPool,
  workerTransform,
} from "https://deno.land/x/tui@VERSION/mod.ts";

const processPool = new WorkerPool({
  workerUrl: new URL("./workers/process_rows.ts", import.meta.url),
});

const pipeline = new LatestDataPipeline([
  filterRows((row) => row.name.includes(query)),
  workerTransform(processPool),
  sortRows((left, right) => left.name.localeCompare(right.name)),
  mapRows((row) => ({ ...row, label: `${row.pid} ${row.name}` })),
]);

const result = await pipeline.run(processes);
if (result.status === "ok") renderRows(result.value);
```

Pass `priority` and `signal` to `runDataPipeline()` or `LatestDataPipeline.run()` to prioritize visible work and cancel
queued transforms when search text, route state, or source data changes before the work starts.

`bindDataPipeline()` connects an input signal to a pipeline output signal, aborting superseded work and optionally
debouncing rapid input changes. The returned handle is still callable as a disposer, and also exposes `inspect()`,
`flush()`, `run()`, and `abort()` for status bars, command handlers, and tests:

```ts
const visibleRows = new Signal<ProcessRow[] | undefined>(undefined);
const rowsBinding = bindDataPipeline(processes, visibleRows, [
  filterRows((row) => row.name.includes(query.value)),
  workerTransform(processPool),
  sortRows((left, right) => left.cpu - right.cpu),
], { debounceMs: 50, scheduler });

const pipelineStatus = rowsBinding.inspect();
rowsBinding.flush();
app.onDispose(rowsBinding);
```

`createRuntimeStore()` chooses IndexedDB when available and falls back to memory. `PersistentSignal` layers reactive app
state on top, which is useful for preferences, selected routes, panel layout, and visualization options:

```ts
import { createPersistentSignal, createRuntimeStore } from "https://deno.land/x/tui@VERSION/mod.ts";

const store = createRuntimeStore<string>({
  databaseName: "my-tui",
  storeName: "preferences",
});
const activeRoute = createPersistentSignal({
  key: "active-route",
  initialValue: "overview",
  store,
});

await activeRoute.ready;
activeRoute.set("runtime");
await activeRoute.flush();
```

`WorkerPool.run(payload, { signal })` supports abortable jobs and exposes `pendingCount()` plus `size` for dashboards,
backpressure, and tests. Pass `workerFactory` in `WorkerPoolOptions` when you need a deterministic fake worker in unit
tests without broad permissions.

## Reactivity

The signals system drives all reactive updates in Tui.

| Primitive      | Description                                              |
| -------------- | -------------------------------------------------------- |
| `Signal`       | A mutable reactive value                                 |
| `Computed`     | A derived value that recomputes when dependencies change |
| `LazyComputed` | Like `Computed`, but only recomputes when accessed       |
| `Effect`       | Runs a side-effect whenever its dependencies change      |
| `LazyEffect`   | Like `Effect`, but deferred until the next flush         |

```ts
import { Computed, Effect, Signal } from "https://deno.land/x/tui@VERSION/mod.ts";

const x = new Signal(2);
const y = new Signal(3);
const sum = new Computed(() => x.value + y.value); // 5

new Effect(() => {
  console.log("sum changed:", sum.value);
});

x.value = 10; // logs "sum changed: 13"
```

Use `signal.peek()` to read a signal's value without registering a dependency.

Signals can deeply observe objects:

```ts
const rect = new Signal({ column: 0, row: 0 }, { deepObserve: true });
rect.value.column = 5; // triggers dependants
```

Use `LazyComputed` and `LazyEffect` when fast-changing inputs should be coalesced. Pass an interval to debounce updates,
or pass a `Flusher` to hold updates until an explicit frame boundary:

```ts
const frame = new Flusher();
const visibleTotal = new LazyComputed(() => rows.value.length, frame);

rows.value = nextRows;
// visibleTotal.value is still the previous value here.
frame.flush();
// visibleTotal.value now reflects nextRows.
```

## Views

A `View` creates a scrollable region. Mount components inside it by passing the view instance as the `view` option:

```ts
import { View } from "https://deno.land/x/tui@VERSION/mod.ts";

const view = new View({
  rectangle: { column: 10, row: 5, width: 30, height: 15 },
  maxOffset: { columns: 0, rows: 50 },
});

new Text({ parent: tui, view, rectangle: { column: 2, row: 40 }, text: "way down here", ... });
```

Adjust `view.offset.value.rows` to scroll.

## Three.js ASCII Renderer

Render 3D scenes as ASCII art using the `ThreeAscii` component, which uses WebGPU via Deno:

```ts
import { ThreeAscii } from "https://deno.land/x/tui@VERSION/src/components/mod.ts";
import { PerspectiveCamera, Scene } from "npm:three@0.183.2";

const scene = new Scene();
const camera = new PerspectiveCamera(75, 1, 0.1, 1000);

const ascii = new ThreeAscii({
  parent: tui,
  scene,
  camera,
  rectangle: { column: 0, row: 0, width: 80, height: 24 },
  zIndex: 0,
});
```

See `examples/three_ascii.ts` for a full demo with lighting, geometry, and post-processing effects.

### ASCII renderer extensions in this fork

The terminal renderer exposes the same scene through multiple glyph strategies:

| Mode     | Description                                                                 |
| -------- | --------------------------------------------------------------------------- |
| `blocks` | Uses block characters for dense, chunky OpenTUI-style visualizations        |
| `glyphs` | Uses a traditional ASCII ramp for lighter character-based scene rendering   |
| `mixed`  | Compares block and glyph coverage and chooses whichever best matches a cell |

The interactive demos expose presets for edges, fill, exposure, attenuation, blend, depth fog, and terminal edge bias.
The `mixed` mode keeps strong edge glyphs when they are useful, then chooses between block and ASCII fill glyphs for the
underlying scene coverage.

## Examples

| File                      | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `examples/demo.ts`        | Kitchen-sink demo of all components                          |
| `examples/calculator.ts`  | Functional calculator built with `GridLayout`                |
| `examples/layout.ts`      | Grid layout with draggable, colored buttons                  |
| `examples/app_shell.ts`   | App primitives, settings-backed routes, commands, and toasts |
| `examples/dashboard.ts`   | Dashboard widgets, semantic theme tokens, and key help       |
| `examples/worker_pool.ts` | WorkerPool concurrency example                               |
| `examples/three_ascii.ts` | Interactive 3D ASCII renderer powered by three.js            |
| `app/showcase.ts`         | Full Neon Exodus-style widget and visualization showcase     |
| `app/main.ts`             | Live system monitor dashboard with selectable panels         |

### Launching the added visualizations

From the project root:

```sh
./visualization
./visualization showcase
```

Launches the full showcase app. This is the quickest way to see the expanded widget set, Neon Exodus-inspired panels,
and the three.js ASCII renderer together.

```sh
./visualization polygons
./visualization polygons --no-controls
```

Launches the standalone geometry renderer with the torus knot, sphere, cube, and floor. Press `m` while it is running to
show or hide the controls. Use the controls panel to switch presets, glyph style, edge/fill options, and renderer
tuning.

```sh
./visualization monitor
./visualization dashboard
./visualization app-shell
./visualization worker
./visualization capabilities
./visualization benchmark
./visualization grwizard
./visualization health
deno task viz
```

Launches the system monitor dashboard. Use `F4` to open options, select panel visualizations, and change the ASCII style
for 3D panels. Added 3D visualization IDs include `three-lattice`, `three-atfield`, `three-hexshell`, `three-capture`,
`three-mapslab`, `three-solenoid`, and `three-ascii-studio`. The same launcher also exposes runtime and tooling demos:
`worker` for abortable worker-pool concurrency, `capabilities` for platform feature detection, `benchmark` for
performance smoke checks, `grwizard` for the responsive GPU/model wizard, and `health` for the contributor gate.

Direct Deno tasks are also available:

```sh
deno task showcase
deno task app-shell
deno task three-ascii
deno task dashboard
deno task viz
deno task capabilities
deno task benchmark
deno task health
deno task worker-demo
```

```sh
deno run --watch --allow-hrtime examples/demo.ts
deno run --allow-hrtime examples/calculator.ts
deno run -A examples/app_shell.ts
deno run -A examples/dashboard.ts
deno run -A examples/worker_pool.ts
deno run -A examples/three_ascii.ts
```

## Testing

See [docs/testing-and-performance.md](./docs/testing-and-performance.md) for snapshot helpers, runtime capability
guidance, and the checklist used for new feature clusters.

## Contributing

Tui is open to contributions. Open an issue or pull request for bug fixes, features, or improvements.

This project follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Add comments to any code
that may be hard to follow.

## License

MIT — see [LICENSE.md](./LICENSE.md).
