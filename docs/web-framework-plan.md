# Browser Framework Plan

This branch explores how to make interfaces built with this library usable from a browser while preserving the terminal
runtime. The goal is not to fork the widget model into separate terminal and web libraries. The goal is to split the
platform concerns so app controllers, commands, themes, layout recipes, selections, forms, data queries, runtime plans,
and most widgets can run in both places.

Two browser use cases should be supported:

- **Standalone client-side package:** import the library into a browser bundle and run the full interface locally with
  browser APIs only. This path uses DOM, Canvas2D, OffscreenCanvas, WebGL, WebGPU, IndexedDB, and Workers directly, with
  no Deno server process required.
- **Hosted terminal/client bridge:** run an existing terminal app on a server or local Deno process and connect to it
  from the browser through an ANSI terminal stream. This path is useful for remote admin tools, compatibility demos, and
  apps that need host filesystem/process access.

Both are valuable, but they should not be conflated. The standalone package is the framework target; the terminal bridge
is the compatibility and remote-control target.

## Current Shape

The repo already has useful browser-ready pieces:

- `mod.web.ts` is the standalone browser-safe entrypoint. It exports platform-neutral controllers, themes, layouts,
  component helpers, app/controller command surfaces, runtime primitives, perf utilities, canvas cell sinks, and
  `createWebTui()` without exporting the terminal `Tui` runtime.
- `BrowserPlatform`, `BrowserInputSource`, `BrowserCellCanvasSink`, and `WebTuiHost` provide the first client-side
  runtime path.
- `mod.remote.ts` exposes the browser/client bridge protocol for hosted terminal apps, including a transport-neutral
  client and WebSocket transport.
- `examples/web/standalone.ts` demonstrates a browser-only app using the shared `Canvas`, `BoxObject`, `TextObject`,
  ANSI theme styles, and Canvas2D sink.
- `examples/web/neon_exodus_page.ts` is the default GitHub Pages source. `deno task web:pages:build` bundles it into
  `docs/index.html` and `docs/assets/neon-exodus.js`.
- Signals, controllers, commands, plugins, layouts, theme engines, data resources, worker pools, settings, and runtime
  capability planning are mostly platform-neutral.
- `Canvas` now flushes changed cells through `CanvasCellSink`; terminal output is handled by `AnsiCanvasSink`, and
  browser output is handled by `BrowserCellCanvasSink`.
- `Tui` is terminal-specific. It owns Deno stdio, console sizing, signal handling, alternate-screen setup, cursor
  visibility, and process exit behavior.
- `Component` currently depends on `Tui`, which makes component construction pull in terminal lifecycle assumptions.
- `ThreeAsciiRenderer` already has a WebGPU-centered path, but the terminal adapter converts the result into ANSI grid
  cells. Browser usage should be able to render into a real canvas as well as a cell surface.

## Options

### Option 1: Browser Terminal Emulator

Run the existing terminal app mostly unchanged, stream ANSI into a browser terminal such as xterm-style emulation, and
map browser keyboard/mouse events back to the app.

Pros:

- Fastest path to "it works in a browser".
- Preserves almost all terminal rendering behavior.
- Good for demos, hosted docs, remote admin consoles, and compatibility testing.

Cons:

- Requires a server-side Deno process for real apps.
- Browser output is still a terminal stream, not a browser-native UI.
- Accessibility, layout inspection, theming through CSS, and embedding individual widgets remain limited.

Best use: compatibility bridge and remote app runner, not the primary framework.

### Option 1B: Standalone Browser Runtime

Publish a browser-safe entrypoint that runs entirely client-side. Apps import `mod.web.ts`, mount into a DOM element,
and use browser-native capabilities for rendering, input, storage, concurrency, and GPU acceleration.

Pros:

- No server process or WebSocket bridge required.
- Works for static hosting, embedded widgets, docs, playgrounds, dashboards, and local-first browser apps.
- Can use IndexedDB for settings/data, Workers for background pipelines, and WebGPU/WebGL for visualizers.
- Enables real browser integration: history, routing, accessibility, CSS, pointer events, clipboard, and installable
  examples.

Cons:

- Cannot access host processes, local shell commands, or filesystem paths unless the app provides browser-safe adapters.
- Needs a browser-safe public entrypoint with no accidental Deno stdio/process imports.
- Requires deterministic fallbacks for browsers without WebGPU, OffscreenCanvas, or module worker support.

Best use: the default browser package target.

### Option 2: DOM Renderer

Introduce a browser renderer that maps components and draw objects to DOM nodes styled with CSS variables from the theme
engine.

Pros:

- Browser-native interaction, accessibility, selection, scrolling, responsive layout, and CSS integration.
- Easiest path to embedding individual widgets into existing web apps.
- Natural fit for component catalogs, forms, tables, palettes, modals, and docs surfaces.

Cons:

- Harder to preserve exact terminal cell semantics.
- Potentially slower for dense animated cell surfaces unless virtualization is strict.
- Requires a second renderer for high-density ASCII and 3D demos.

Best use: app framework, widget embedding, accessibility-first browser experiences.

### Option 3: Canvas/WebGL Cell Renderer

Keep the current cell-grid rendering model, but replace stdout with a browser renderer that paints changed cells into a
`<canvas>`, `OffscreenCanvas`, WebGL, or WebGPU-backed atlas renderer.

Pros:

- Closest browser-native match to the existing terminal compositor.
- Fast for dense text UIs, ASCII art, and animated visualizations.
- Fits workers and OffscreenCanvas well.
- Keeps terminal-style layouts predictable.

Cons:

- Accessibility needs a parallel semantic layer.
- Native browser controls and text selection are not automatic.
- Styling is still a render pipeline concern rather than regular CSS.

Best use: terminal-faithful web target, visual demos, dashboards, and high-performance ASCII rendering.

### Option 4: Hybrid Browser Framework

Add a platform adapter layer and support both DOM and canvas render targets. Standard widgets can render through DOM or
cell canvas. Dense terminal/ASCII surfaces use canvas/WebGPU. App-level controllers, commands, themes, data, and layout
stay shared.

Pros:

- Gives the library a real browser-native future without abandoning terminal fidelity.
- Lets users choose per app or per surface: DOM for forms/tables, canvas for terminals/visualizers.
- Aligns with the existing runtime capability layer and renderer backend catalog.
- Supports progressive enhancement: CPU cells, Canvas2D, OffscreenCanvas, WebGL, WebGPU.

Cons:

- More architecture work up front.
- Needs strict interfaces to prevent terminal assumptions from leaking back into shared code.
- Requires a disciplined testing story across render targets.

Best use: recommended long-term path.

## Recommended Direction

Build Option 4, with Option 1B as the primary browser package target and Option 1 as an early compatibility demo.

The main design move is to introduce a platform and renderer boundary:

```ts
export interface TuiPlatform {
  readonly kind: "terminal" | "browser";
  readonly size: Signal<ConsoleSize>;
  readonly input: InputSource;
  readonly lifecycle: LifecycleController;
  now(): number;
  scheduleFrame(callback: () => void): Disposable;
}

export interface CellSink {
  resize(size: ConsoleSize): void;
  beginFrame(): void;
  writeCell(row: number, column: number, value: string | Uint8Array): void;
  endFrame(stats: CanvasRenderStats): void;
}

export interface RenderTarget {
  readonly kind: "ansi" | "dom" | "canvas2d" | "webgl" | "webgpu";
  mount(root: unknown): void;
  unmount(): void;
  render(frame: RenderFrame): void;
  inspect(): RenderTargetInspection;
}
```

`Canvas` is now a compositor that writes dirty cells to `CanvasCellSink`, not directly to stdout. The terminal target
provides an ANSI sink, and the browser target provides a Canvas2D sink. `Tui` should still become a thinner terminal
runtime wrapper around a shared app host.

## Proposed Package Surface

- `mod.ts`: existing full package, preserving terminal compatibility.
- `mod.web.ts`: browser-safe public entrypoint with no Deno stdio imports. It includes practical shared APIs today:
  signals, layouts, themes, app/controller command surfaces, runtime resource/data/concurrency primitives, perf
  utilities, web platform APIs, canvas objects, DOM render targets, and remote bridge helpers.
- `mod.remote.ts`: optional browser/client bridge types for connecting to an ANSI stream or remote app host.
- `src/platform/`: shared platform interfaces plus terminal and browser adapters.
- `src/renderers/ansi/`: terminal stdout sink and terminal session integration.
- `src/renderers/canvas/`: Canvas2D cell renderer with font atlas and dirty-cell painting.
- `src/renderers/dom/`: semantic DOM renderer for common widgets and overlays.
- `src/renderers/webgpu/`: accelerated ASCII/scene renderer hooks and future cell atlas backend.
- `src/web/`: `createWebTui()`, browser event adapter, resize observer, mounting helpers, CSS token emission.
- `examples/web/`: browser-hosted demos for showcase, theme gallery, Neon Exodus, system monitor sample data, and Three
  ASCII.

## Milestones

### Phase 1: Platform Boundary

- Status: started.
- Added `TuiPlatform`, `InputSource`, `LifecycleController`, and `CanvasCellSink` interfaces.
- Refactored `Canvas` to accept a `CanvasCellSink` while keeping stdout behavior through an ANSI sink.
- Split terminal lifecycle from `Tui` into a terminal platform adapter.
- Add browser-safe type aliases so `Stdout`, `Stdin`, and `ConsoleSize` do not force Deno globals into web bundles.
- Added tests proving dirty cells flush through pluggable sinks and ANSI stdout output remains available.

### Phase 2: Browser Cell Canvas

- Status: started.
- Added `mod.web.ts` and a smoke test that proves the package imports without the terminal `Tui` export.
- Implemented `BrowserCellCanvasSink` using Canvas2D and dirty-cell painting.
- Added `ResizeObserver` sizing in rows/columns from configurable cell metrics.
- Added keyboard, pointer, and wheel adapters that emit the same input event shapes as terminal readers. Paste/focus
  handling remains to be expanded.
- Added a minimal `createWebTui(root, options)` API.
- Ported a standalone animated browser demo source in `examples/web/standalone.ts`.
- Added `examples/web/neon_exodus_page.ts` as the default standalone web demo, backed by the existing Neon Exodus suite
  render helpers.

### Phase 3: DOM Renderer

- Status: started.
- Defined a small render tree for semantic browser nodes and a `DomRenderTarget` with mount/update/unmount support.
- Added HTML serialization for tests, docs previews, and server-rendered examples.
- Added theme-token-to-CSS-variable emission for ANSI-backed `ThemeTokens`.
- Add DOM focus management that interoperates with the existing focus/command controllers.
- Add accessibility roles for the first widget set.
- Keep the DOM renderer optional so terminal apps do not pay for browser code.

### Phase 4: Accelerated Browser Visuals

- Expose Three ASCII in the browser with real canvas mounting, not just ANSI cells.
- Add OffscreenCanvas worker mode for high-density cell rendering when available.
- Add renderer backend selection that uses the existing runtime capability plan: `webgpu -> webgl -> canvas2d -> cpu`.
- Add frame telemetry through the runtime workload registry.
- Port Neon Exodus visual modes and the polygon/Three ASCII demos.

### Phase 5: Framework Polish

- Add package/export docs for terminal, standalone browser, and remote browser-client usage.
- Add routing/mount helpers for single-page apps.
- Add persistent browser settings through the existing `Store`/IndexedDB abstractions.
- Add docs for embedding one widget, mounting a full app, and sharing code between terminal and browser.
- Add Playwright tests for rendered DOM, canvas pixel smoke checks, input handling, resize behavior, and theme
  switching.
- Ship browser examples with screenshots or short clips generated from real browser runs.
- Added a GitHub Pages build script: `deno task web:pages:build` generates `docs/index.html` and
  `docs/assets/neon-exodus.js`, with Neon Exodus as the default page.

### Remote Bridge Track

- Status: started.
- Added `mod.remote.ts` for the hosted terminal/client bridge use case.
- Added `RemoteTerminalClient`, a JSON protocol for input/resize/ping messages, server data/error/close messages, and a
  browser `WebSocketRemoteTerminalTransport`.
- Added protocol tests for preserving binary input buffers and emitting terminal data over a fake transport.
- Still needed: server-side Deno bridge that runs a TUI process or app host, PTY integration, auth/session boundaries,
  and an xterm-compatible browser renderer example.

## Key Risks

- `Component` currently imports `Tui`, so shared widgets can accidentally drag in terminal-only code. This should be
  fixed early with an app host interface.
- Terminal `Style` is an ANSI function. Browser themes need a structured style representation or a resolver that can
  emit both ANSI and CSS/canvas colors.
- Unicode cell width and browser font rendering will not perfectly match every terminal. Browser cell targets should
  expose font configuration and measurement diagnostics.
- DOM and canvas renderers should not diverge behaviorally. Controllers should own state; renderers should be thin.
- Three.js WebGPU support differs across browsers. The runtime backend registry must keep fallbacks explicit and
  inspectable.
- Browser-safe packaging can regress if shared modules import Deno globals at top level. Add CI checks that import
  `mod.web.ts` in a browser-like runtime and fail on terminal-only dependencies.

## Decision

Proceed with the hybrid framework. Treat the standalone client-side package as the primary web framework output, and
treat the browser terminal bridge as a compatibility/remoting layer. Start with the platform boundary and browser cell
canvas because that creates a real browser target while preserving the existing terminal mental model. Add DOM rendering
after the shared host is stable, then use the accelerated renderers for the demos that justify this fork: Neon Exodus,
Three ASCII, and rich dashboard visualizations.
