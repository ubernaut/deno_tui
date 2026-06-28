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
loading/empty/error state. `componentCatalog`, `listComponents()`, `findComponent()`, `componentsByCategory()`,
`componentsWithCapability()`, `queryComponents()`, and `inspectComponentCatalog()` provide an inspectable widget
inventory for docs, launchers, settings screens, and command palettes:

```ts
const overlays = componentsByCategory("overlay");
const dashboardWidgets = componentsWithCapability("dashboard");
const threeAscii = findComponent("ThreeAscii");
const selectableControllers = queryComponents({ capabilities: ["controller", "selection"] });
const catalogState = inspectComponentCatalog();
const catalogReport = createComponentCatalogReport({ query: { category: "visualization" } });
const catalogMarkdown = formatComponentCatalogMarkdown({ query: { capability: "three" } });

const stopCatalogCommands = bindComponentCatalogCommands(app.commands, {
  query: { category: "visualization" },
  group: "components",
});
```

`componentCatalogCommands()` and `bindComponentCatalogCommands()` turn catalog entries into normal command registry
items with searchable keywords and a default `component.selected` action. Use them for command palettes, launcher
screens, docs browsers, and plugin marketplaces that need to expose available widgets without duplicating catalog data.
`createComponentCatalogReport()` and `formatComponentCatalogMarkdown()` expose the same metadata as deterministic
JSON-friendly reports and Markdown tables. Run `deno task component-catalog -- --json`, `deno task component-catalog`,
or `./visualization components -- --category=overlay` to generate catalog output for docs, CI, or marketplace tooling.

`ToastStackController` owns notification queue state for `ToastStack`: `show()`, `push()`, `dismiss()`,
`dismissLatest()`, `clear()`, and `inspect()` keep notification overlays bounded and testable without local helper
queues in each app. `toastCommands()` and `bindToastCommands()` expose clear and dismiss-latest actions for command
palettes, menu bars, key help, and plugin surfaces.

`ComboBoxController` owns dropdown items, placeholder text, selected index, expanded state, keyboard movement, selection
callbacks, and inspection state for `ComboBox`. Use `comboBoxCommands()` or `bindComboBoxCommands()` to expose
open/close/toggle, first/previous/next/last, active selection, and optional direct item-selection commands:

```ts
const environment = new ComboBoxController({
  items: ["development", "staging", "production"],
  placeholder: "choose environment",
});

const stopEnvironmentCommands = bindComboBoxCommands(app.commands, environment, {
  idPrefix: "deploy.environment",
  group: "input",
  includeItemCommands: true,
});
```

`ListController` gives compact single-selection lists the same reusable state layer as the larger virtualized list. It
owns item data, selected-index clamping, keyboard movement, active-item selection callbacks, and inspection state, while
`listCommands()` and `bindListCommands()` expose first, previous, next, last, active select, and optional direct item
commands:

```ts
const files = new ListController({
  items: ["README.md", "mod.ts", "deno.json"],
});

const stopListCommands = bindListCommands(app.commands, files, {
  idPrefix: "files",
  group: "navigation",
  includeItemCommands: true,
});
```

`TreeController` separates hierarchical expansion and selection behavior from the `Tree` renderer. It exposes flattened
rows with depth and expansion metadata, keyboard handling for arrow/home/end/page navigation, expand/collapse/toggle,
selection callbacks, and inspection state. Use `treeCommands()` or `bindTreeCommands()` to expose tree movement,
expand/collapse/toggle, active selection, and optional direct visible-node selection actions:

```ts
const projectTree = new TreeController({
  nodes: [
    {
      id: "src",
      label: "src",
      expanded: true,
      children: [{ id: "mod", label: "mod.ts" }],
    },
  ],
});

const stopTreeCommands = bindTreeCommands(app.commands, projectTree, {
  idPrefix: "project.tree",
  group: "navigation",
  includeNodeCommands: true,
});
```

`VirtualListController` keeps large-list interaction separate from rendering. It exposes viewport rows, selection
movement, keyboard handling, selected-value persistence helpers, and inspection state for status bars or tests:

```ts
const processes = new VirtualListController({
  items: processRows,
  mode: "multiple",
  valueForItem: (row) => row.pid,
  format: (row) => `${row.pid} ${row.name}`,
});

processes.setViewportHeight(20);
processes.selectValues([persistedPid]);
const visibleRows = processes.rows.value;
const selectedPids = processes.selectedValues<number>();
const listState = processes.inspect();
```

`TabsController` owns tab data, active index, disabled-tab skipping, keyboard handling, and inspection state for
navigation bars that need to be reused by route managers, command palettes, key bindings, or alternate renderers.
`tabsCommands()` and `bindTabsCommands()` expose first, previous, next, last, and optional direct tab-selection actions:

```ts
const tabs = new TabsController({
  tabs: [
    { id: "overview", label: "Overview" },
    { id: "logs", label: "Logs" },
    { id: "settings", label: "Settings", disabled: true },
  ],
});

const stopTabsCommands = bindTabsCommands(app.commands, tabs, {
  idPrefix: "tabs.main",
  group: "navigation",
  includeTabCommands: true,
});
```

`StepperController` does the same for workflow navigation: it owns step data, active index, disabled-step skipping,
orientation, keyboard handling, and inspection state. Use `stepperCommands()` or `bindStepperCommands()` to expose
first, previous, next, last, and optional direct step-selection actions through command palettes, menus, or key help.

`MenuBarController` provides the same reusable state layer for top-level menus: it owns item data, active item movement,
disabled-item skipping, keyboard handling, selection callbacks, and inspection state. `menuBarCommands()` and
`bindMenuBarCommands()` expose first, previous, next, last, active-item selection, and optional direct item-selection
commands. The controller is intentionally styling-agnostic so theme engines can own visual treatment while apps reuse
the same navigation model across terminal components, command palettes, and alternate renderers:

```ts
const menu = new MenuBarController({
  items: [
    { id: "file", label: "File" },
    { id: "view", label: "View" },
    { id: "help", label: "Help", disabled: true },
  ],
});

const stopMenuCommands = bindMenuBarCommands(app.commands, menu, {
  idPrefix: "menubar.main",
  group: "menu",
  includeItemCommands: true,
});
```

`RadioGroupController` gives single-choice inputs the same separation of behavior and rendering: it owns options, active
index, selected value, disabled-option skipping, keyboard handling, and inspection state. `radioGroupCommands()` and
`bindRadioGroupCommands()` expose movement, active-option selection, and optional direct option-selection commands for
settings panes, forms, palettes, and menu surfaces:

```ts
const priority = new RadioGroupController({
  options: [
    { value: "low", label: "Low" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High", disabled: true },
  ],
  selectedValue: "normal",
});

const stopPriorityCommands = bindRadioGroupCommands(app.commands, priority, {
  idPrefix: "settings.priority",
  group: "settings",
  includeOptionCommands: true,
});
```

`SliderController` extracts numeric range behavior from `Slider`: it owns min/max/step/value signals, orientation,
keyboard handling, drag and scroll deltas, thumb geometry, and inspection state. `sliderCommands()` and
`bindSliderCommands()` expose increment, decrement, min, max, and optional preset-value commands for dashboards,
settings panes, command palettes, and key bindings:

```ts
const volume = new SliderController({
  min: 0,
  max: 100,
  step: 5,
  value: 40,
  orientation: "horizontal",
});

const stopVolumeCommands = bindSliderCommands(app.commands, volume, {
  idPrefix: "settings.volume",
  group: "settings",
  includeValueCommands: true,
  values: [0, 50, 100],
});
```

`ButtonController` extracts activation state from `Button`: it owns the label and disabled signals, tracks press count
and the last activation method/time, exposes `press()`, `enable()`, `disable()`, and `inspect()`, and can run an
`onPress` hook without coupling command surfaces to a rendered component. `buttonCommands()` and `bindButtonCommands()`
expose press, enable, and disable actions for dialogs, toolbars, forms, command palettes, and key bindings:

```ts
const saveButton = new ButtonController({
  label: "Save",
  onPress: (state) => submitForm(state.pressCount),
});

const stopSaveCommands = bindButtonCommands(app.commands, saveButton, {
  idPrefix: "form.save",
  group: "form",
});
```

`InputController` extracts single-line text editing from `Input`: it owns text, cursor position, placeholder, password
mode, validator, key handling, clear/submit behavior, and inspection state. `inputCommands()` and `bindInputCommands()`
expose submit, clear, cursor movement, and optional preset-value actions for search boxes, form fields, command
palettes, and settings panes:

```ts
const searchInput = new InputController({
  text: "",
  placeholder: "Filter widgets",
  validator: /[a-z0-9 -]/i,
  onSubmit: (query) => runSearch(query),
});

const stopSearchCommands = bindInputCommands(app.commands, searchInput, {
  idPrefix: "widgets.search",
  group: "search",
  includeValueCommands: true,
  values: ["theme", "layout", "runtime"],
});
```

`TextBoxController` applies the same controller pattern to multiline editing: it owns text, cursor position, line
splitting, validators, line numbering/highlighting flags, key handling, clear/set helpers, and inspection state.
`textBoxCommands()` and `bindTextBoxCommands()` expose clear, cursor movement, and optional preset-value actions for
notes panes, script editors, logs with editable filters, and settings text areas:

```ts
const notes = new TextBoxController({
  text: "Investigate GPU backend",
  lineNumbering: true,
  lineHighlighting: true,
  onChange: (value) => draftStore.set("notes", value),
});

const stopNotesCommands = bindTextBoxCommands(app.commands, notes, {
  idPrefix: "notes",
  group: "editor",
});
```

`CheckBoxController` does the same for boolean inputs: it owns the checked signal, exposes `check()`, `uncheck()`,
`toggle()`, and `inspect()`, and keeps the rendered `CheckBox` focused on presentation. `checkBoxCommands()` and
`bindCheckBoxCommands()` expose toggle, check, and uncheck actions for settings panes, command palettes, and key
bindings:

```ts
const autosave = new CheckBoxController({ checked: false });

const stopAutosaveCommands = bindCheckBoxCommands(app.commands, autosave, {
  idPrefix: "settings.autosave",
  group: "settings",
});
```

`ProgressBarController` extracts bounded progress state from `ProgressBar`: it owns min/max/value, smooth rendering
mode, orientation, direction, character maps, progress geometry, smooth row text, clamping, and inspection state. Use
`progressBarCommands()` or `bindProgressBarCommands()` to expose increment/decrement, min/max, and optional preset
values for build monitors, upload panes, installers, and dashboard tasks:

```ts
const buildProgress = new ProgressBarController({
  min: 0,
  max: 100,
  value: 35,
  smooth: true,
  direction: "normal",
  orientation: "horizontal",
});

const stopBuildProgressCommands = bindProgressBarCommands(app.commands, buildProgress, {
  idPrefix: "build.progress",
  group: "build",
  step: 5,
  includeValueCommands: true,
  values: [0, 50, 100],
});
```

`CommandPaletteController` and `ContextMenuController` expose the overlay widgets' query, selection, navigation, key
handling, and inspection state without requiring a rendered component. Use them when a command surface, menu bar,
shortcut handler, or test needs to drive the same behavior as the built-in widgets:

```ts
const palette = new CommandPaletteController({
  items: [
    { id: "open", label: "Open File", keywords: ["find"] },
    { id: "close", label: "Close Pane", disabled: true },
  ],
});

palette.setQuery("open");
palette.move(1);
const selectedCommand = palette.selected();
const paletteState = palette.inspect();
```

`filterCommandPaletteItems()` returns query-ranked items for typed command surfaces, while `rankCommandPaletteItems()`
exposes each item's score and matched fields for previews, diagnostics, and searchable theme or plugin catalogs.

`TableController` extracts row selection and scroll-window state from the `Table` renderer. It owns row count, viewport
height, selected row, offset row, key handling, mouse/scroll handling, page movement, and inspection state. Use
`tableCommands()` or `bindTableCommands()` when a rendered table should be controllable from command palettes, menus, or
key help without reimplementing row math:

```ts
const processTable = new TableController({
  rowCount: processRows.value.length,
  viewportHeight: 14,
  onSelect: (row) => openProcess(processRows.value[row]),
});

processTable.pageDown();
processTable.revealSelected();
const tableFocusState = processTable.inspect();

const stopProcessTableCommands = bindTableCommands(app.commands, processTable, {
  idPrefix: "process-table",
  group: "process-table",
});
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
  rowKey: (row) => String(row.pid),
  initialState: { pageSize: 20 },
});

table.setQuery(search.value);
table.selectKey(String(persistedPid));
table.toggleSort("cpu");
const visibleRows = table.view.value.rows;
const selectedProcess = table.selectedRow();
const selectedPid = table.selectedKey();
const tableState = table.inspect();

const stopTableCommands = bindDataTableCommands(app.commands, table, {
  idPrefix: "processes",
  group: "process-table",
});
```

Use `table.handleKeyPress(event)` when a table view should consume arrow, page, home/end, and return keys without
duplicating pagination and selection logic in the component shell. Use `dataTableCommands()` or
`bindDataTableCommands()` when the same table actions should also appear in command palettes, menu bars, key help, or
plugin-provided command surfaces. The generated commands cover row movement, paging, query clearing, and sortable
columns with dynamic disabled state.

For metric-heavy dashboards, `MetricSeriesController`, `pushMetricValue()`, and `metricSeriesStats()` provide the shared
bounded-history layer used by sparklines, bar charts, gauges, logs, worker-fed telemetry, and system-monitor panels:

```ts
const cpu = new MetricSeriesController({ limit: 120, clamp: true });

cpu.push(snapshot.cpuRatio);
const sparkline = renderSparkline(cpu.values.value, 30);
const latestCpu = cpu.stats.value.latest;

const stopCpuCommands = bindMetricSeriesCommands(app.commands, cpu, {
  id: "cpu",
  idPrefix: "metrics.cpu",
  group: "metrics",
  includeLimitCommands: true,
  limits: [60, 120, 240],
});
```

`metricSeriesCommands()` and `bindMetricSeriesCommands()` expose clear and sample-window actions for dashboards that
need runtime controls in command palettes, menus, or key help. `MetricSeriesController.inspect()` returns values, stats,
limit, and empty state for status panels, tests, and plugin diagnostics.

`LogViewerController` provides the same split between log state and rendering for `LogViewer`: `append()`,
`appendMany()`, `clear()`, `setLimit()`, `setFollow()`, `toggleFollow()`, `visible()`, and `inspect()` keep bounded log
buffers reusable across system monitors, worker consoles, and diagnostic panes. `logViewerCommands()` and
`bindLogViewerCommands()` expose clear and follow-toggle actions through the shared command registry.

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
import { bindSplitPaneCommands, SplitPaneController, splitPaneRects } from "https://deno.land/x/tui@VERSION/mod.ts";

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

const stopSplitCommands = bindSplitPaneCommands(app.commands, split, {
  id: "main",
  idPrefix: "layout.mainSplit",
  bounds: () => app.tui.rectangle.value,
  group: "layout",
  includeRatioCommands: true,
  includeReset: true,
});
```

`splitPaneCommands()` and `bindSplitPaneCommands()` expose resize, direction, ratio preset, and reset actions through
the same command registry used by palettes, menus, keymaps, and plugins. Pass a static rectangle, rectangle signal, or
bounds callback so the commands can resize against the current viewport while keeping `SplitPaneController` independent
of any specific app shell.

Responsive helpers are also exported for common app shell layout:

- `resolveBreakpoint()`
- `insetRect()`
- `splitRect()`
- `dockRect()`
- `resolveLayoutRecipe()`
- `createLayoutRecipeController()`
- `layoutRecipeSlots()`
- `inspectLayoutRecipe()`
- `formatLayoutRecipeMarkdown()`
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
const shellInspection = inspectLayoutRecipe(recipe);
const shellMarkdown = formatLayoutRecipeMarkdown(recipe);
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

Run `deno task layout-recipe`, `deno task layout-recipe -- --json`, or `./visualization layout-recipe` to inspect the
sample responsive shell recipe as Markdown or JSON. The report includes breakpoint coverage, missing breakpoint layouts,
and visible slot ids per layout so app shells can debug responsive behavior before components are mounted.

## App Primitives

This fork exports lightweight app primitives for larger TUIs:

- `createApp()` / `TuiApp`
- `createAppPlugin()` / `inspectAppPluginDefinition()` / plugin catalog reports
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
Tab/Shift+Tab traversal for registered focusable components. Use `focusCommands()` or `bindFocusCommands()` to expose
next/previous focus, clear focus, and optional direct focus-target commands through command palettes, menus, keymaps,
and plugin surfaces:

```ts
const stopFocusCommands = bindFocusCommands(app.commands, app.focus, {
  idPrefix: "focus.main",
  group: "focus",
  includeTargetCommands: true,
  targets: [
    { id: "menu", label: "Menu", item: menuBar },
    { id: "content", label: "Content", item: scrollArea },
  ],
});
```

Use `ActionBus.subscribeType()` or `app.onActionType()` to handle one action family at a time while preserving typed
payloads. `ActionBus.use()` and `app.useActionMiddleware()` install middleware that can observe, transform, reroute, or
stop actions before subscribers run. The app-level helpers track cleanup automatically:

```ts
app.useActionMiddleware(async (action, next) => {
  if (action.type === "command.blocked") return;
  await next(action.type === "route.alias" ? { type: "route", payload: "overview" } : action);
});

app.onActionType("route", (action) => app.routes.navigate(action.payload));
app.onActionType("toast", (action) => pushToast(action.payload, "success"));

const actionBusState = app.actions.inspect();
```

`EventEmitter` powers `Tui`, components, and canvas objects. It now exposes disposer-returning `on()` / `once()`,
`listenerCount()`, `eventNames()`, and `inspect()` for custom widgets, debug panels, and leak checks.

`KeymapRegistry` supports disposer-friendly `register()` / `registerAll()`, `get()`, `has()`, group-aware `clear()`, and
`inspect()` for key-help rows, settings screens, and conflict diagnostics:

```ts
const stopKeys = app.keymap.registerAll([
  { key: "p", ctrl: true, description: "Command palette", group: "global" },
  { key: "z", ctrl: true, description: "Undo", group: "edit" },
]);

const keymapState = app.keymap.inspect("global");
```

`TuiApp.onDispose()` tracks cleanup callbacks and runs them once on `app.destroy()`. Built-in app binders such as
`app.enableFocusNavigation()` and `app.enableCommandKeys()` are tracked automatically:

```ts
app.onDispose(bindModalFocus(app.tui, paletteVisible, app.focus, [commandPalette]));
```

Use `createAppPlugin()`, `app.use()`, or `app.useAll()` to install reusable app plugins. A plugin can declaratively
register routes, commands, action middleware, key bindings, and focus items, then run an optional installer for theme
providers, runtime resources, async data, or other module-level state. Generated disposers remove declarative
registrations in reverse order and keep teardown tied to the app lifecycle. Identified plugins are tracked by
`app.plugins()`, `app.pluginIds()`, and `app.hasPlugin(id)`, so larger apps can inspect active modules and avoid
duplicate installs. Passing `{ replace: true }` to `app.use(plugin, options)` swaps an existing identified plugin before
installing the replacement:

```ts
const settingsPluginDefinition = {
  id: "settings",
  label: "Settings Pack",
  routes: [{ id: "settings", title: "Settings" }],
  commands: [
    {
      id: "settings.open",
      label: "Settings",
      action: { type: "route.alias", payload: "settings" },
    },
  ],
  actionMiddleware: [
    (action, next) => next(action.type === "route.alias" ? { type: "route", payload: action.payload } : action),
  ],
  keyBindings: [{ key: ",", ctrl: true, description: "Settings", group: "global" }],
  install(app) {
    const stop = app.onActionType("route", (action) => app.routes.navigate(action.payload));
    return stop;
  },
};

const pluginShape = inspectAppPluginDefinition(settingsPluginDefinition);
const pluginReport = createAppPluginCatalogReport({ plugins: [settingsPluginDefinition] });
const pluginMarkdown = formatAppPluginCatalogMarkdown({ plugins: [settingsPluginDefinition] });
const settingsPlugin = createAppPlugin(settingsPluginDefinition);
const stopSettings = app.use(settingsPlugin);

const activePlugins = app.plugins();
```

`createAppPluginCatalogReport()`, `queryAppPluginDefinitions()`, and `formatAppPluginCatalogMarkdown()` turn plugin
definitions into docs, marketplace, and diagnostics data with tag, route, command, key binding, focus, middleware, and
installer counts.

`app.inspect()` returns one diagnostic snapshot for route state, command counts, key bindings, focus state, installed
plugins, lifecycle status, and tracked disposers. It is intended for status bars, debug panels, health checks, and
tests:

```ts
const state = app.inspect();
const activeRoute = state.routes.activeRouteId;
const commandCount = state.commands.count;
const plugins = state.plugins.map((plugin) => plugin.id);
```

`SettingsController` wraps `PersistentSignal` with app-level namespacing, caching, aggregate readiness, flushing, reset,
and disposal. Use it for preferences such as active route, theme pack, layout density, split ratios, hidden controls, or
visualization settings while keeping storage configurable. `bindSettingSignal()`, `bindRouteSetting()`,
`bindThemeSetting()`, `bindThemeLayerSetting()`, and `bindSplitPaneSetting()` wire those preferences into app state
without each app rebuilding two-way synchronization logic. `settingsCommands()` and `bindSettingsCommands()` expose
registered preferences as reset commands for palettes, menus, settings screens, and plugin surfaces:

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
const stopSettingsCommands = bindSettingsCommands(app.commands, settings, {
  idPrefix: "preferences",
  group: "settings",
});

await settings.ready();
activeRoute.set("runtime");
activeTheme.set("terminal");
await settings.flush();

app.onDispose(stopRouteSetting.dispose);
app.onDispose(stopThemeSetting.dispose);
app.onDispose(stopThemeLayers.dispose);
app.onDispose(stopSplitSetting.dispose);
app.onDispose(stopSettingsCommands);
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

const commandState = app.commands.inspect("routes");
```

Use `app.commands.has(id)`, `groups()`, and group-aware `clear(group)` for plugin teardown, settings screens, and
diagnostics without reaching into the registry internals.

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
`searchCommandSurfaceItems()` and `rankCommandSurfaceItems()` add deterministic command lookup across labels, ids,
descriptions, keywords, and key bindings, so palettes, menu launchers, docs browsers, and plugin marketplaces can share
the same ranking behavior without reimplementing filtering.

`FormController` keeps form state separate from rendering:

```ts
const form = new FormController([
  { name: "route", initialValue: "overview", validators: [required()] },
]);

const stopBinding = bindFormField(form, "route", input.text);
form.setValue("route", "runtime");
const ok = form.validate();
const formState = form.inspect();

const stopFormCommands = bindFormCommands(app.commands, form, {
  id: "settings",
  idPrefix: "settingsForm",
  group: "settings",
  includeFieldCommands: true,
});
```

`bindFormField()` connects a controller field to any `Signal`-backed widget value, including `Input.text`,
`CheckBox.checked`, `RadioGroup.selectedValue`, or a custom adapter signal. It accepts `parse` and `format` transforms
for non-string values and returns a disposer for dynamic forms. `FormController.register()` and `registerAll()` also
return disposers, while `setValues()`, `touchAll()`, `isDirty()`, `isTouched()`, `isValid()`, and `inspect()` keep
multi-field settings panels testable without coupling them to a concrete widget tree. `formCommands()` and
`bindFormCommands()` expose validate, reset, touch-all, and optional per-field validate/touch actions through the shared
command registry so form workflows can appear in command palettes, menus, key help, or plugin-provided surfaces.

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
route valid when routes are added, replaced, or removed. `get()`, `has()`, `ids()`, `activeIndex()`, and `inspect()`
provide stable route metadata for tabs, breadcrumbs, status bars, and tests:

```ts
const routeState = app.routes.inspect();
const activeIndex = app.routes.activeIndex();
```

`bindRouteIndex()` connects route state to index-backed widgets such as tabs, steppers, menu bars, or custom segmented
controls:

```ts
const routeStepIndex = new Signal(0);
const stopRouteSteps = bindRouteIndex(app.routes, routeStepIndex, {
  routeIds: ["overview", "widgets", "runtime"],
});
```

Use `routeCommands()` or `bindRouteCommands()` to expose route navigation through command palettes, menu bars, key maps,
or contextual command surfaces without hand-writing one command per route:

```ts
const stopRouteCommands = bindRouteCommands(app.commands, app.routes, {
  idPrefix: "nav",
  routeIds: ["overview", "widgets", "runtime"],
});
```

The generated commands include previous/next route cycling and explicit route selection. Pass a
`Signal<readonly
string[]>` as `routeIds` when a responsive shell should expose only the currently visible route set;
disabled predicates update from the active route and visible route count at execution/render time.

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

Use `historyCommands()` or `bindHistoryCommands()` to expose undo, redo, and optional clear actions through the shared
command registry:

```ts
const stopHistoryCommands = bindHistoryCommands(app.commands, history, {
  group: "edit",
  includeClear: true,
});
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

const selectedPids = selectedValues(rows, selection.state.value, {
  valueForItem: (row) => row.pid,
});
selection.state.value = selectionFromValues(nextRows, selectedPids, {
  valueForItem: (row) => row.pid,
  mode: "multiple",
});
```

Viewport helpers keep scrolling, virtual rows, and scrollbar thumbs consistent:

```ts
const maxOffset = maxViewportOffset(contentWidth, contentHeight, width, height);
const offset = viewportOffsetBy(currentOffset, maxOffset, 0, 1);
const rows = viewportWindow(items.length, selection.state.value.activeIndex, height);
const viewportState = inspectViewport(contentWidth, contentHeight, width, height, offset);

const scroll = new ScrollAreaController({
  contentWidth,
  contentHeight,
  viewportWidth: width,
  viewportHeight: height,
});
scroll.scrollBy(0, 1);
const stopScrollCommands = bindScrollAreaCommands(app.commands, scroll, {
  idPrefix: "viewport.main",
  includeScrollbarCommands: true,
});
```

`ScrollAreaController` wraps the same viewport math in a reusable state object with `scrollBy()`, `scrollTo()`,
`setContentSize()`, `setViewportSize()`, `setScrollbarVisible()`, and `inspect()`. `scrollAreaCommands()` and
`bindScrollAreaCommands()` expose movement, page, edge, and optional scrollbar visibility actions through the command
registry for scrollable panes that are controlled by menus, key bindings, palettes, or plugins.

## Theming

Use `createTheme()` for semantic tokens, `createThemeEngine()` for built-in palettes, `ThemeRegistry` for named theme
packs, or `ThemeProvider` for runtime theme selection. This fork treats theming as an engine layer, not just a bag of
component props: it adds `composeThemeOptions()`, `composeStyles()`, component inheritance, token-backed style
pipelines, serializable ANSI theme manifests, app-level provider cycling, runtime theme layers, optional async
persistence, `ThemeEngine.extend()`, and `ThemeEngine.inspect()` so larger apps can layer reusable theme packs without
mutating a base engine:

```ts
import {
  assertThemeOptions,
  bindComponentTheme,
  CommandRegistry,
  compileThemeManifestOptions,
  composeThemeOptions,
  createAnsiStyle,
  createAnsiThemeTokens,
  createCommandSurface,
  createRuntimeStore,
  createThemeCatalog,
  createThemeEngine,
  createThemeEngineCache,
  createThemeEngineFactoryRegistry,
  createThemeEngineFromManifest,
  createThemeEngineFromPalette,
  createThemeEnginePipeline,
  createThemeLayerStack,
  createThemePaletteRegistry,
  createThemePlugin,
  createThemeProvider,
  createThemeProviderCache,
  createThemeRegistry,
  createThemeRegistryFromManifests,
  diffThemeEngines,
  inspectThemeCoverage,
  inspectThemeManifest,
  previewThemeManifest,
  prewarmThemeEnginePipelines,
  themeCommands,
  validateThemeOptions,
} from "https://deno.land/x/tui@VERSION/mod.ts";

const appTheme = composeThemeOptions({
  tokens: createAnsiThemeTokens({
    foreground: { foreground: [230, 255, 246] },
    accent: { foreground: "cyan", bold: true },
    surface: { background: 235 },
  }),
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
      Modal: { variants: { palette: { focused: createAnsiStyle({ foreground: "cyan" }) } } },
    },
  });

const palettes = createThemePaletteRegistry([
  "terminal",
  {
    id: "contrast",
    label: "Contrast",
    tokens: createAnsiThemeTokens({
      foreground: { foreground: "brightWhite" },
      accent: { foreground: "brightCyan", bold: true },
      danger: { foreground: "brightRed", bold: true },
      surface: { background: 235 },
    }),
  },
]);
const contrastEngine = palettes.engine("contrast", appTheme);
const detachedPaletteEngine = createThemeEngineFromPalette(palettes.tokens("contrast"), appTheme);

const themeFactories = createThemeEngineFactoryRegistry([
  {
    id: "ops-neon",
    label: "Ops Neon",
    palette: "neon",
    tags: ["dashboard", "dark"],
    priority: 20,
    options: appTheme,
  },
]);
const warmedThemeEngines = await themeFactories.prewarm();

const runtimePipeline = createThemeEnginePipeline({
  id: "runtime-accessibility",
  steps: [
    {
      id: "high-contrast",
      options: {
        tokens: { accent: createAnsiStyle({ foreground: "brightCyan", bold: true }) },
        components: { Button: { base: { focused: "accent" } } },
      },
    },
    {
      id: "focus-ring",
      transform: (engine) =>
        engine.extend({
          components: { Input: { base: { focused: ["accent", createAnsiStyle({ underline: true })] } } },
        }),
    },
  ],
});
const accessibleTheme = runtimePipeline.apply(themeEngine);
const warmedPipelines = await prewarmThemeEnginePipelines([runtimePipeline], { base: themeEngine });

const themeIssues = validateThemeOptions(appTheme);
assertThemeOptions(appTheme);
const themeCoverage = inspectThemeCoverage(appTheme, {
  components: ["Button", "ComboBox", "Modal"],
});
const buttonTheme = themeEngine.component("Button", "danger");
const availableThemes = themeEngine.inspect();

const opsManifest = {
  id: "ops",
  label: "Operations",
  palette: "terminal",
  options: {
    tokens: {
      accent: { foreground: "cyan", bold: true },
      danger: { foreground: "red", underline: true },
    },
    components: {
      Field: { base: { focused: "accent" } },
      Button: {
        extends: "Field",
        variants: {
          danger: { active: ["danger", { bold: true }] },
        },
      },
    },
  },
} as const;
const manifestOptions = compileThemeManifestOptions(opsManifest.options);
const manifestEngine = createThemeEngineFromManifest(opsManifest);
const manifestInspection = inspectThemeManifest(opsManifest);
const manifestPreview = previewThemeManifest(opsManifest, {
  sample: "Aa",
  components: ["Button"],
});

const themeRegistry = createThemeRegistry([
  { id: "terminal", label: "Terminal", palette: "terminal" },
  { id: "neon-ops", label: "Neon Ops", palette: "neon", options: appTheme },
]);
const manifestRegistry = createThemeRegistryFromManifests([opsManifest]);
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
  registry: themeRegistry,
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
const themeCatalog = provider.catalog();
const detachedCatalog = createThemeCatalog(provider);
const themeDiff = diffThemeEngines(
  createThemeEngine("terminal"),
  provider.engine.value,
  { sample: "Aa" },
);
const themeEngineCache = createThemeEngineCache(provider.engine.value);
const cachedButtonTheme = themeEngineCache.component("Button", "danger");
const providerThemeCache = createThemeProviderCache(provider);
const cachedActiveStyle = providerThemeCache.resolve("Button", "active", "danger");

// After constructing a Button component instance named `button`:
const stopBinding = bindComponentTheme(button, provider, "Button", {
  variant: "danger",
});

const commandRegistry = new CommandRegistry();
commandRegistry.registerAll(themeCommands(provider));
const themeSurface = createCommandSurface(commandRegistry);

const themePlugin = createThemePlugin({
  provider,
  settings,
  persistTheme: { key: "theme" },
  persistLayers: {
    key: "theme-layers",
    serialize: (ids) => JSON.stringify(ids),
    deserialize: (value) => JSON.parse(value as string),
  },
  commands: { group: "theme" },
  mirrorKeymap: true,
});
app.use(themePlugin);
```

`ThemeRegistry.engine(id, overrides)` composes a named pack with per-app overrides, while `ThemeProvider.component()`
and `ThemeProvider.resolve()` expose computed signals for active component themes and individual state styles.
`ThemeEngineFactory` and `ThemeEngineFactoryRegistry` add a reusable engine-construction layer for apps that need
multiple theme engines, white-label packs, demos, or plugin-provided themes. Factories expose metadata, tags, priority,
validation issues, token overrides, components, variants, synchronous `build()`, and scheduler-backed `prewarm()` so
heavy theme catalogs can be prepared before first render without coupling widgets to theme loading.
`ThemeEnginePipeline` adds the runtime side of that engine story: apps can register ordered, enableable transforms that
extend an existing engine with contrast, density, accessibility, brand, or experiment-specific overlays. Pipeline steps
can be plain `ThemeEngineOptions` or functions that receive the current engine and return another engine or extension
options; `inspect()` reports active steps, token overrides, component coverage, and variants for settings UIs, while
`prewarmThemeEnginePipelines()` prepares selected pipelines through the same scheduler-backed runtime path as factory
prewarming. `ThemeProvider.themeIds()`, `nextTheme()`, `previousTheme()`, and `cycleTheme(direction)` keep theme
switching deterministic across command palettes, menus, and key bindings. Pass any `AsyncStore<string>` to persist the
active pack through `MemoryStore`, `IndexedDbStore`, or a custom settings backend; `provider.ready` reports the loaded
theme and `provider.flush()` waits for pending writes. `bindComponentTheme()` bridges those provider signals back into
normal components and returns a disposer, so live theme switching stays centralized and testable without requiring
widgets to know where their theme came from. `provider.catalog()` and `createThemeCatalog(provider)` return a normalized
catalog of theme packs, active flags, layer toggles, engine tokens, states, components, and variants, which is the
preferred surface for building theme pickers, settings panels, inspector panes, and demo controls.
`previewThemeProvider()` renders token and component-state samples from the currently composed provider, including
active runtime layers, so settings panes and demos can show the exact live theme instead of reimplementing preview
logic. `themePreviewCommands()` exposes that same live snapshot through the command registry as a `theme.previewed`
action, and `bindThemeCommands()` registers theme selection, layer toggles, and preview commands with one disposer for
command palettes, menus, key help, and plugin surfaces. `ThemeLayerStack` adds runtime overlays for density, contrast,
accessibility, or brand-specific state treatments; `enable()`, `disable()`, `toggle()`, `activeIds()`, and `inspect()`
make those overlays usable from command palettes and settings screens while preserving deterministic composition order.
Component definitions can also reference semantic token names such as `"foreground"`, `"accent"`, `"danger"`, or
`"surface"` instead of concrete style functions, so variants automatically follow the active palette. A state style may
also be an array of token names and style functions; the engine composes the pipeline in order. Component definitions
can `extend` one or more other definitions, which makes aliases like `ComboBox -> Field` or shared role themes cheap
while preserving variants and app-level overrides. `createAnsiStyle()` and `createAnsiThemeTokens()` provide a small
serializable style-spec layer for theme engines: packs can use named ANSI colors, 256-color indexes, RGB tuples, and
text attributes like bold or underline without embedding raw escape sequences throughout the app.
`compileThemeManifestOptions()`, `createThemeEngineFromManifest()`, and `createThemeRegistryFromManifests()` build on
those specs so reusable theme packs can be plain data: semantic token specs, component inheritance, variants, and state
pipelines can be loaded from JSON-like modules, validated, diffed, and installed without hard-coding style functions.
`inspectThemeManifest()` exposes manifest metadata, declared tokens, component inheritance, variants, state coverage,
and validation issues for editors and settings panels, while `previewThemeManifest()` returns rendered token and
component-state samples for review panes and snapshot tests. The built-in `neon` and `terminal` palettes use the same
helpers. `themeSelectionCommands()`, `themeLayerCommands()`, and `themeCommands()` project the active `ThemeProvider`
into normal command registry entries for "next theme", "previous theme", explicit theme selection, and layer
enable/disable/toggle actions. The generated commands use dynamic disabled predicates, so the active theme and current
layer states stay accurate when they are shown in a command palette, menu bar, context menu, or key binding help
surface. `validateThemeOptions()` and `assertThemeOptions()` give theme authors a first-class diagnostics pass for
unknown token references, missing component parents, and inheritance cycles before a pack is registered.
`themeTokenNames` and `themeStates` expose the stable engine vocabulary for editors, schema generators, inspectors, and
design tooling. `inspectThemeCoverage()` reports explicitly authored state coverage after component inheritance is
resolved, including missing states per component and variant, so theme packs can fail CI before unstyled states
accidentally ship. `diffThemeEngines()` previews changed semantic tokens and resolved component states between two
engines, which makes it practical to build theme review panels, snapshot tests, and migration reports around real
rendered output instead of raw object comparison. `ThemePaletteRegistry` lets apps and plugins register custom palette
engines with stable ids, inspect available token coverage, replace palettes deterministically, and build `ThemeEngine`
instances from the same semantic token contract used by built-in palettes. `createThemeEngineFromPalette()` is the
low-level bridge for detached or generated palettes, while `ThemeRegistry`, `ThemeProvider`, and `ThemeEngineFactory`
also accept custom palette objects for white-label packs and plugin-provided themes. `createThemePlugin()` is the
app-level installer for the same engine layer: it owns or accepts a `ThemeProvider`, registers theme and layer commands,
optionally mirrors command bindings into key help, and connects the active pack and active layers to
`SettingsController` persistence with one disposable plugin. `ThemeEngineCache` and `ThemeProviderCache` are opt-in
runtime accelerators for redraw-heavy apps: they memoize component themes and resolved state styles, expose hit/miss
inspection, and the provider cache automatically invalidates when theme packs or layers change.

## Runtime Capabilities

Optional high-performance APIs are surfaced through `src/runtime/mod.ts`:

- `detectRuntimeCapabilities()`
- `runtimeCapabilityEntries()` / `summarizeRuntimeCapabilities()` / `formatRuntimeCapabilities()`
- `AsyncScheduler` / `runTaskBatch()`
- `RenderLoop` / `createRenderLoop()`
- `AsyncResource` / `createAsyncResource()` / `CachedAsyncResource` / `createCachedAsyncResource()` /
  `bindResourceParams()`
- `runDataPipeline()` / `LatestDataPipeline` / `CachedDataPipeline` / `bindDataPipeline()` / `workerTransform()`
- `WorkerPool`
- `MemoryStore`
- `IndexedDbStore`
- `createRuntimeStore()`
- `createPersistentSignal()` / `PersistentSignal`

Use these instead of hard-coding global checks inside components. `formatRuntimeCapabilities()` produces a readable
diagnostic summary for settings screens, logs, and `deno task capabilities`; pass `--json` to that task for structured
summary output.

`AsyncScheduler` caps concurrent work, prioritizes queued tasks, exposes queue inspection, and can wait for or clear
pending work. `runTaskBatch()` builds on the same scheduler for ordered fan-out work:

```ts
const scheduler = new AsyncScheduler({ concurrency: 2 });
const controller = new AbortController();

await scheduler.run(() => refreshVisibleRows(), {
  priority: 10,
  signal: controller.signal,
});

const hydrate = scheduler.schedule(() => hydrateVisibleRows(), {
  priority: 20,
});
const hydrateStatus = hydrate.inspect();
hydrate.cancel();
await hydrate.promise.catch(() => undefined);

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
inputs change before queued work starts. `schedule()` returns a task handle with `promise`, `cancel()`, and `inspect()`
for per-task backpressure, while `run()` remains the compact promise-only API. Scheduler-level `inspect()`, `pending()`,
`running()`, `capacity()`, and `idle()` are useful for status bars, diagnostics, and queue controls. Batch results
preserve input order even when queued tasks run by priority, so callers can hydrate lists and tables without rebuilding
index bookkeeping.

`RenderLoop` is the small inspectable frame driver used by `Tui.run()`. Apps can also create one directly when they need
manual stepping, timer injection in tests, or a shared frame loop for renderer backends:

```ts
const loop = createRenderLoop({
  intervalMs: 1000 / 30,
  tick: ({ frame, deltaMs }) => {
    updateAnimations(frame, deltaMs);
    canvas.render();
  },
});

loop.start();
const loopState = loop.inspect();
loop.stop();
```

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
const metricsState = metrics.inspect();
```

`CachedAsyncResource` adds optional persistence for resource loaders whose latest successful value should be restored
before a refresh completes. It persists only the latest successful load, ignores cache failures through `onCacheError`,
and uses the same `AsyncStore` contract as settings and data pipelines:

```ts
const metrics = createCachedAsyncResource({
  store: createRuntimeStore<MetricSnapshot>({
    databaseName: "monitor",
    storeName: "resources",
  }),
  key: (id: string) => `metric:${id}`,
  loader: async ({ params, signal }) => await fetchMetric(params, { signal }),
});

const restored = await metrics.restore("cpu");
if (restored?.status === "success") render(restored.data);

const fresh = await metrics.load("cpu");
if (fresh.status === "success") render(fresh.data);
const resourceCacheState = metrics.inspect();
```

`bindResourceParams()` connects a params signal to a resource, with optional debounce for search boxes, filters, route
params, and other fast-changing UI state:

```ts
const query = new Signal("");
const stopMetrics = bindResourceParams(metrics, query, {
  debounceMs: 100,
  abortOnDispose: true,
});

stopMetrics.flush();
const bindingState = stopMetrics.inspect();
```

The binding handle remains callable as a disposer and also exposes `dispose()`, `flush()`, `abort()`, and `inspect()`
for debounced search inputs, route params, and tests.

`runDataPipeline()` composes expensive row transforms behind an optional scheduler. `workerTransform()` lets any stage
offload work through a `WorkerPool` or compatible runner. `LatestDataPipeline` protects interactive views from stale
async results when users type or change filters quickly:

```ts
import {
  createCachedDataPipeline,
  createRuntimeStore,
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

`CachedDataPipeline` adds an optional persistence layer for expensive transforms whose latest successful result should
survive route changes, process refreshes, or app restarts. It uses the same `AsyncStore` contract as settings and can be
backed by `MemoryStore`, `IndexedDbStore`, or a custom store:

```ts
const pipeline = createCachedDataPipeline<ProcessRow[], string[]>([
  filterRows((row) => row.cpu > 0.25),
  workerTransform(processPool),
  sortRows((left, right) => right.cpu - left.cpu),
  mapRows((row) => `${row.pid} ${row.name}`),
], {
  store: createRuntimeStore<string[]>({
    databaseName: "monitor",
    storeName: "pipelines",
  }),
  key: "processes:hot",
  scheduler,
  priority: 5,
});

const restoredRows = await pipeline.restore(processes);
if (restoredRows) renderRows(restoredRows);
const latestRows = await pipeline.run(processes);
if (latestRows.status === "ok") renderRows(latestRows.value);
const pipelineCacheState = pipeline.inspect();
```

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

`WorkerPool.run(payload, { signal })` supports abortable jobs and exposes `pendingCount()`, `idle()`, `inspect()`, and
`waitForIdle()` for dashboards, backpressure, graceful shutdown, and tests. `runWorkerBatch()` dispatches a set of
worker payloads concurrently while preserving result order:

```ts
import { runWorkerBatch, WorkerPool } from "https://deno.land/x/tui@VERSION/mod.ts";

const pool = new WorkerPool<number[], number>({
  workerUrl: new URL("./workers/sum.ts", import.meta.url),
  size: 4,
});

const results = await runWorkerBatch(pool, [[1, 2], [3, 4]]);
const status = pool.inspect(); // { size, pending, idle, terminated, nextWorkerIndex }

await pool.waitForIdle();
```

Pass `workerFactory` in `WorkerPoolOptions` when you need a deterministic fake worker in unit tests without broad
permissions.

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

Preset metadata is exported for custom launchers and settings panes. Use `asciiDemoPresetIds()`,
`findAsciiDemoPreset()`, `asciiDemoPresets()`, or `asciiDemoPresetSummaries()` to build style pickers without depending
on the raw preset table:

```ts
const mixedPresets = asciiDemoPresetSummaries("mixed");
const preset = findAsciiDemoPreset("mixed-best");
```

## Examples

| File                               | Description                                                  |
| ---------------------------------- | ------------------------------------------------------------ |
| `examples/demo.ts`                 | Kitchen-sink demo of all components                          |
| `examples/calculator.ts`           | Functional calculator built with `GridLayout`                |
| `examples/layout.ts`               | Grid layout with draggable, colored buttons                  |
| `examples/layout_recipe_report.ts` | Responsive layout recipe report example                      |
| `examples/app_shell.ts`            | App primitives, settings-backed routes, commands, and toasts |
| `examples/dashboard.ts`            | Dashboard widgets, semantic theme tokens, and key help       |
| `examples/theme_manifest.ts`       | Serializable theme manifest compiler and diff demo           |
| `examples/theme_engines.ts`        | Theme engine factory registry and prewarm demo               |
| `examples/theme_pipeline.ts`       | Runtime theme transform pipeline and prewarm demo            |
| `examples/worker_pool.ts`          | WorkerPool concurrency example                               |
| `examples/action_middleware.ts`    | Action middleware and plugin pipeline example                |
| `examples/cached_resource.ts`      | Cached async resource loader example                         |
| `examples/cached_pipeline.ts`      | Cached scheduler-backed data pipeline example                |
| `examples/three_ascii.ts`          | Interactive 3D ASCII renderer powered by three.js            |
| `app/showcase.ts`                  | Full Neon Exodus-style widget and visualization showcase     |
| `app/main.ts`                      | Live system monitor dashboard with selectable panels         |

Run the theme manifest and engine demos with:

```sh
deno task theme-manifest
deno task theme-engines
deno task theme-pipeline
```

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
./visualization layout-recipe
./visualization worker
./visualization actions
./visualization resource
./visualization pipeline
./visualization theme-manifest
./visualization theme-engines
./visualization theme-pipeline
./visualization capabilities
./visualization benchmark
./visualization api-inventory
./visualization components
./visualization grwizard
./visualization health
deno task viz
```

Launches the system monitor dashboard. Use `F4` to open options, select panel visualizations, and change the ASCII style
for 3D panels. Added 3D visualization IDs include `three-lattice`, `three-atfield`, `three-hexshell`, `three-capture`,
`three-mapslab`, `three-solenoid`, and `three-ascii-studio`. The same launcher also exposes runtime and tooling demos:
`worker` for abortable worker-pool concurrency, `actions` for middleware-based action dispatch, `resource` for cached
async resource loaders, `pipeline` for cached scheduler-backed transforms, `theme-manifest` for serializable theme
packs, `theme-engines` for factory prewarming, `theme-pipeline` for runtime theme transforms, `capabilities` for
platform feature detection, `benchmark` for performance smoke checks, `api-inventory` for public export graph
inspection, `components` for widget catalog reports, `layout-recipe` for responsive recipe inspection, `grwizard` for
the responsive GPU/model wizard, and `health` for the contributor gate. Benchmark runs print per-case timings plus an
aggregate summary; `deno task benchmark -- --json` emits the same threshold-aware summary as structured data and exits
nonzero when a case fails its limits.

Direct Deno tasks are also available:

```sh
deno task showcase
deno task app-shell
deno task layout-recipe
deno task three-ascii
deno task dashboard
deno task viz
deno task cached-resource
deno task theme-manifest
deno task theme-engines
deno task theme-pipeline
deno task capabilities
deno task benchmark
deno task api-inventory
deno task component-catalog
deno task health
deno task worker-demo
deno task action-middleware
deno task cached-pipeline
```

```sh
deno run --watch --allow-hrtime examples/demo.ts
deno run --allow-hrtime examples/calculator.ts
deno run -A examples/app_shell.ts
deno run -A examples/layout_recipe_report.ts
deno run -A examples/dashboard.ts
deno run -A examples/worker_pool.ts
deno run -A examples/action_middleware.ts
deno run -A examples/cached_pipeline.ts
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
