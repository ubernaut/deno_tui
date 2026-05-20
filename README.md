# Tui

<img src="https://raw.githubusercontent.com/Im-Beast/deno_tui/main/docs/logo-transparent.png" align="right" width="250" height="250" alt="Deno mascot made as ASCII art" />

[![Deno](https://github.com/Im-Beast/deno_tui/actions/workflows/deno.yml/badge.svg)](https://github.com/Im-Beast/deno_tui/actions/workflows/deno.yml)
[![Deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https://deno.land/x/tui/mod.ts)

A [Deno](https://github.com/denoland/deno/) module for building Terminal User Interfaces. Reactive, composable, and zero-dependency.

## Features

- **Reactive by default** — UI updates automatically via a built-in signals system (`Signal`, `Computed`, `Effect`)
- **Rich component library** — Box, Button, CheckBox, ComboBox, Input, TextBox, Label, Slider, ProgressBar, Table, Frame, and more
- **Flexible layouts** — `GridLayout`, `HorizontalLayout`, and `VerticalLayout` for declarative, proportional positioning
- **Keyboard and mouse input** — full support including drag events
- **Views** — scrollable viewports with offset control
- **Three.js ASCII renderer** — render 3D scenes as ASCII art in the terminal via the `ThreeAscii` component
- **Styling framework agnostic** — works with any terminal styling library; [Crayon](https://github.com/crayon-js/crayon) is recommended
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
import { Signal, Computed } from "https://deno.land/x/tui@VERSION/mod.ts";

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

| Component     | Description                                               |
| ------------- | --------------------------------------------------------- |
| `Box`         | Filled rectangle                                          |
| `Button`      | Clickable box with an optional label                      |
| `CheckBox`    | Toggle between checked and unchecked states               |
| `ComboBox`    | Dropdown selector                                         |
| `Frame`       | Decorative border around a region                         |
| `Input`       | Single-line text input with optional password masking     |
| `TextBox`     | Multi-line text editor with line numbers and highlighting |
| `Label`       | Text with configurable horizontal/vertical alignment      |
| `Text`        | Raw text drawn directly on the canvas                     |
| `ProgressBar` | Horizontal or vertical progress indicator (smooth-capable)|
| `Slider`      | Horizontal or vertical value slider                       |
| `Table`       | Scrollable data table with headers and row selection      |
| `ThreeAscii`  | Renders a three.js scene as ASCII art in the terminal     |

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

## Reactivity

The signals system drives all reactive updates in Tui.

| Primitive       | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| `Signal`        | A mutable reactive value                                     |
| `Computed`      | A derived value that recomputes when dependencies change     |
| `LazyComputed`  | Like `Computed`, but only recomputes when accessed           |
| `Effect`        | Runs a side-effect whenever its dependencies change          |
| `LazyEffect`    | Like `Effect`, but deferred until the next flush             |

```ts
import { Signal, Computed, Effect } from "https://deno.land/x/tui@VERSION/mod.ts";

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
import { Scene, PerspectiveCamera } from "npm:three@0.183.2";

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

## Examples

| File                       | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `examples/demo.ts`         | Kitchen-sink demo of all components                  |
| `examples/calculator.ts`   | Functional calculator built with `GridLayout`        |
| `examples/layout.ts`       | Grid layout with draggable, colored buttons          |
| `examples/three_ascii.ts`  | Interactive 3D ASCII renderer powered by three.js    |

```sh
deno run --watch --allow-hrtime examples/demo.ts
deno run --allow-hrtime examples/calculator.ts
deno run --allow-hrtime examples/three_ascii.ts
```

## Contributing

Tui is open to contributions. Open an issue or pull request for bug fixes, features, or improvements.

This project follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Add comments to any code that may be hard to follow.

## License

MIT — see [LICENSE.md](./LICENSE.md).
