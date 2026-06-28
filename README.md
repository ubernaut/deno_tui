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
- **Runtime capability layer** — Workers, WebGPU, WebGL, OffscreenCanvas, and IndexedDB are detected through a
  standards-oriented runtime module with configurable fallbacks.
- **Theme engine** — semantic tokens, palette presets, named theme packs, runtime providers, component variants,
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

Additional fork components include `List`, `VirtualList`, `Tabs`, `Breadcrumbs`, `Stepper`, `MenuBar`, `ContextMenu`,
`RadioGroup`, `ScrollArea`, `Modal`, `KeyHelp`, `CommandPalette`, `Tree`, `ToastStack`, `Sparkline`, `Gauge`, `Chart`,
`LogViewer`, and `StatusBar`. `VirtualList` combines viewport windowing and `SelectionController` for large custom data
views. For table-heavy apps, `createDataTableView()`, `sortDataRows()`, and the data-table render helpers provide
reusable filtering, sorting, pagination, and row formatting without coupling data logic to the `Table` renderer.

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
`resizeSplitPane()` to apply keyboard or pointer deltas while preserving pane constraints:

```ts
import { resizeSplitPane, splitPaneRects } from "https://deno.land/x/tui@VERSION/mod.ts";

const panes = splitPaneRects(bounds, {
  direction: "row",
  ratio: 0.65,
  minFirst: 32,
  minSecond: 24,
  gap: 1,
});

const nextOptions = resizeSplitPane(bounds, { direction: "row", firstSize: panes.firstSize }, 4);
```

Responsive helpers are also exported for common app shell layout:

- `resolveBreakpoint()`
- `insetRect()`
- `splitRect()`
- `dockRect()`
- `splitPaneRects()`
- `resizeSplitPane()`

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
- viewport helpers such as `viewportWindow()`, `viewportOffsetBy()`, and `viewportThumb()`

They are optional and composable. Existing component-first apps continue to work. Use `app.enableFocusNavigation()` or
`bindFocusNavigation()` to opt into Tab/Shift+Tab traversal for registered focusable components.

`FormController` keeps form state separate from rendering:

```ts
const form = new FormController([
  { name: "route", initialValue: "overview", validators: [required()] },
]);

form.setValue("route", "runtime");
const ok = form.validate();
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

Viewport helpers keep scrolling, virtual rows, and scrollbar thumbs consistent:

```ts
const maxOffset = maxViewportOffset(contentWidth, contentHeight, width, height);
const offset = viewportOffsetBy(currentOffset, maxOffset, 0, 1);
const rows = viewportWindow(items.length, selection.state.value.activeIndex, height);
```

## Theming

Use `createTheme()` for semantic tokens, `createThemeEngine()` for built-in palettes, `ThemeRegistry` for named theme
packs, or `ThemeProvider` for runtime theme selection. This fork also adds `composeThemeOptions()`,
`ThemeEngine.extend()`, and `ThemeEngine.inspect()` so larger apps can layer reusable theme packs without mutating a
base engine:

```ts
import {
  composeThemeOptions,
  createThemeEngine,
  createThemeProvider,
  createThemeRegistry,
} from "https://deno.land/x/tui@VERSION/mod.ts";

const appTheme = composeThemeOptions({
  components: {
    Button: {
      variants: {
        danger: { base: crayon.red },
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
const provider = createThemeProvider({ registry, activeId: "neon-ops" });

provider.setTheme("terminal");
const activeButtonTheme = provider.component("Button", "danger").value;
const themeInventory = provider.inspect();
```

`ThemeRegistry.engine(id, overrides)` composes a named pack with per-app overrides, while `ThemeProvider.component()`
and `ThemeProvider.resolve()` expose computed signals for active component themes and individual state styles. That
keeps theme switching centralized and testable without requiring widgets to know where their theme came from.

## Runtime Capabilities

Optional high-performance APIs are surfaced through `src/runtime/mod.ts`:

- `detectRuntimeCapabilities()`
- `AsyncScheduler`
- `AsyncResource` / `createAsyncResource()`
- `runDataPipeline()` / `LatestDataPipeline`
- `WorkerPool`
- `MemoryStore`
- `IndexedDbStore`
- `createRuntimeStore()`
- `createPersistentSignal()` / `PersistentSignal`

Use these instead of hard-coding global checks inside components.

`AsyncResource` exposes signal-backed async state for loading data, handling errors, aborting stale work, and preserving
previous data during refreshes:

```ts
const metrics = createAsyncResource({
  loader: async ({ signal }) => await fetchMetrics({ signal }),
  scheduler: new AsyncScheduler({ concurrency: 1 }),
});

await metrics.load();
if (metrics.state.value.status === "success") render(metrics.state.value.data);
```

`runDataPipeline()` composes expensive row transforms behind an optional scheduler. `LatestDataPipeline` protects
interactive views from stale async results when users type or change filters quickly:

```ts
import { filterRows, LatestDataPipeline, mapRows, sortRows } from "https://deno.land/x/tui@VERSION/mod.ts";

const pipeline = new LatestDataPipeline([
  filterRows((row) => row.name.includes(query)),
  sortRows((left, right) => left.name.localeCompare(right.name)),
  mapRows((row) => ({ ...row, label: `${row.pid} ${row.name}` })),
]);

const result = await pipeline.run(processes);
if (result.status === "ok") renderRows(result.value);
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

| File                      | Description                                               |
| ------------------------- | --------------------------------------------------------- |
| `examples/demo.ts`        | Kitchen-sink demo of all components                       |
| `examples/calculator.ts`  | Functional calculator built with `GridLayout`             |
| `examples/layout.ts`      | Grid layout with draggable, colored buttons               |
| `examples/app_shell.ts`   | App primitives, routes, command palette, tree, and toasts |
| `examples/dashboard.ts`   | Dashboard widgets, semantic theme tokens, and key help    |
| `examples/worker_pool.ts` | WorkerPool concurrency example                            |
| `examples/three_ascii.ts` | Interactive 3D ASCII renderer powered by three.js         |
| `app/showcase.ts`         | Full Neon Exodus-style widget and visualization showcase  |
| `app/main.ts`             | Live system monitor dashboard with selectable panels      |

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
deno task viz
```

Launches the system monitor dashboard. Use `F4` to open options, select panel visualizations, and change the ASCII style
for 3D panels. Added 3D visualization IDs include `three-lattice`, `three-atfield`, `three-hexshell`, `three-capture`,
`three-mapslab`, `three-solenoid`, and `three-ascii-studio`.

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
