# Changelog

This project follows a semver-oriented changelog policy. Stable public APIs should only break in a major release, or
with explicit pre-1.0 breaking-change notes while this fork stabilizes. Beta and experimental surfaces may change more
quickly, but the affected entrypoint or module family should be named here.

## Unreleased

### Breaking changes (pre-1.0)

- The pre-1.0 `MarkupWindowSnapshot` shape advances from V1 to V2 to persist floating rectangles, restore/snap metadata,
  groups, focus tiers, and active identity. Restore accepts and deterministically migrates supported V1 payloads;
  persisted writers and TypeScript consumers should emit the V2 shape.
- `PlatformInputEvents` and the beta `WebTuiHostEvents` contract now include normalized `pointerInput` events. Custom
  platform and browser-host event maps must expose that event alongside the legacy mouse adapters. Browser hosts emit
  both streams for compatibility; controller code should route one stream only, preferring `pointerInput` in new code.
- The stable `MouseInteractionTarget.zIndex` field now accepts `number | (() => number)`. Writers remain compatible;
  consumers that read or compare the field directly must resolve the function form before treating it as a number.
- `RouteManager` now owns snapshots of registered route objects. Code that relied on route object identity or mutated
  the original caller-owned object must instead mutate the managed `manager.routes.value[...]` view or use
  `register(route, { replace: true })`.
- `FormController` now defensively clones and owns object/array initial values, root replacements, and field writes.
  Code that relied on retained object identity or later caller-side mutations must update the controller's managed
  `values`/field signals instead.

### Added

- Added the Muxstone `[ Network ]` menu and left-docked panel with remembered SSH hosts (persisted, deletable) and
  live Tailscale devices from a strict LocalAPI-with-CLI-fallback status source, with visibility-gated jittered
  polling and one-keystroke SSH session spawning through the detached host.
- Added a Muxstone end-session control: a header `[ ✕ ]` button opening a Cancel / Detach / Terminate modal, where
  detach exits the client leaving the daemon running and terminate shuts the daemon down first.
- Added five selectable animated Muxstone desktop backgrounds — dense matrix glyph rain, a window-aware procedural
  circuitboard whose wires route around windows, tap into their borders, and glow brighter toward the focused
  window, a full-coverage Giger-style biomechanical wall, a dense breeze-reactive palm-frond canopy, and a
  block-style vaporwave/outrun sunset with a rising/setting scanline sun and a grid that drives toward the viewer —
  all theme-derived, deterministic, pointer-aware, persisted, and cycled with prefix `b`.
- Muxstone's network panel lists each host's open shells beneath it (persisted session→host mapping); activating a
  shell focuses its window.
- Added the beta `./app` entrypoint with `TerminalApp`, declarative app definitions, default interaction/lifecycle
  wiring, disposable input handling, component registration, and a focused runnable example.
- Added a headless `TerminalAppPilot` through `./testing` for deterministic key, pointer, paste, focus, resize, command,
  action, settle, wait, and canvas snapshot tests.
- Added parser-backed Markdown documents, terminal rendering, semantic styling, scrolling, and the `Markdown` component
  through the beta `./app` entrypoint.
- Added a renderer-neutral HTML/CSS-style layout foundation with markup parsing, CSS-like cascade, block/flex solving,
  computed layout boxes, and a runnable `deno task html-css-layout` example.
- Added markup widget hydration for common controls, including a default registry, focus order, controller lookup,
  dispatch helpers, and custom registry support.
- Added experimental Kitty graphics protocol helpers for command encoding, payload chunking, tmux passthrough wrapping,
  delete commands, and terminal support detection.
- Added a renderer-neutral graphics surface interface with no-op and Kitty command-surface implementations.
- Added the experimental `./layout/yoga` package subpath for the optional Yoga-backed Flexbox solver.
- Added the experimental `./layout/taffy` bridge protocol, strict backend validation, intrinsic-measurement callbacks,
  deterministic cell projection, lifecycle isolation, and a checked-in backend probe/adoption report.
- Added advanced Simple-solver Flexbox and sizing support for reverse axes, wrapped-line `align-content`,
  `space-evenly`, aspect ratios, content/border box sizing, percentage spacing, auto margins, and relative insets.
- Added renderer-neutral screen stacks, typed modal results, safe versioned persistence, router-owned named-mode
  projection, declarative tiled windows/modals, compact projection, and shared failure-atomic window undo/redo.
- Added a renderer-neutral advanced-windowing foundation with latent tiled and durable floating placement, constrained
  move and eight-edge resize, workspace/corner/dock snapping, grouped movement, deterministic normal/always-on-top focus
  tiers, bounds recovery, strict V1-to-V2 snapshots, capture-driven pointer gestures, and one-entry gesture undo/redo.
- Added the shared `WorkbenchWindowHostController` for renderer-neutral tiled/floating chrome, titlebar controls,
  separator and edge gestures, snap previews, minimized-window shelves, projection-aware MRU switching, semantic nodes,
  direct commands, exact window history, and terminal/browser pointer adapters over one workspace owner.
- Added Showcase Session V2 window-state persistence with V1 migration and commit-boundary writes, plus Inkstone as the
  first production-shaped terminal adopter with responsive tiled/floating projection, shared chrome, window commands,
  route-aware focus, row-level pointer targets, and deterministic recovery tests.
- Added nestable transactional history with compensation, poisoned-state recovery, fake-clock keyed coalescing, semantic
  boundaries, and explicit replay-safety barriers plus a versioned, causal, canonical action journal with deterministic
  pure replay, component-owned migration-aware checkpoints, and replay-safe count/byte/age retention.
- Added layered keymaps, named multi-stroke commands and leaders, caller-driven sequence deadlines, live remapping,
  typed host-owned plugin slots, and data-only core/markup/optional-view slot adapters.
- Added conservative terminal OSC services for theme/palette queries, title/background control, OSC 52 clipboard,
  desktop notifications, raw OSC routing, bounded parsing, and capability diagnostics.
- Added injected host and deterministic virtual monotonic schedulers with cancellable one-shot timers, stable
  same-deadline ordering, bounded advancement, error isolation, and no global timer replacement.
- Added structured parent/child task groups with propagated cancellation, deterministic joining, fail-fast/fail-late
  policies, always-settling results, and explicit supervisor ownership for detached work.
- Added one strict versioned input envelope shared by terminal, browser, remote, and test adapters, with per-factory
  monotonic sequencing, conservative trust defaults, opt-in bounded raw payloads, and canonical serialization.
- Added normalized mouse, touch, pen, and terminal pointer adapters plus explicit per-pointer capture ownership,
  deterministic transfer/release routing, bounded diagnostics, and device-independent controller seams.
- Added opaque secret values with callback-only reveal, best-effort byte disposal, fail-closed schema redaction, bounded
  JSON-safe log/history/persistence projections, and sanitized inspection and error surfaces.
- Added deterministic input lifecycle reconciliation for focus loss, transport disconnect, capture disposal, and host
  disposal, synthesizing only held-key releases and active pointer/gesture/drag cancellations.
- Added caller-clock deadline budgets with parent-child tightening, typed timeout/cancellation causes, external abort
  linkage, TaskGroup/task/resource propagation, and virtual-time inspection, plus bounded async channels with five
  explicit overflow policies, finite waiter limits, and FIFO rendezvous/backpressure semantics.
- Added strict versioned runtime permission manifests for filesystem, network, environment, subprocess, FFI, clipboard,
  notification, and remote-session adapters, including required/optional activation reports with provenance and
  pre-probe reports from process and PTY terminal backend providers.
- Added generated Unicode 17.0.0 grapheme-break, East Asian Width, and emoji data with pinned upstream hashes, immutable
  deterministic registries, binary lookups, and reproducible offline drift/update commands.
- Added a process-local structural resource-cache coordinator with ownership counts, bounded subscriptions, atomic
  status/value revisions, opaque diagnostics, and last-owner eviction without invalidating active reads.
- Added disposable `AsyncIterable` map, filter, merge, switch-latest, debounce, throttle, buffer, window, and retry
  operators with injected schedulers, bounded work, prompt cancellation, and exactly-once upstream cleanup.
- Added an experimental strict remote version/capability handshake and negotiated terminal client/bridge factories that
  reject incompatible peers and all application traffic before negotiation completes.
- Added exact Unicode 17.0.0 UAX #29 extended-grapheme segmentation, chunked scanning, boundary/range helpers, and
  grapheme-safe input, textbox, command-palette, and workbench editing backed by a reproducible compact browser pack.
- Added injectable-clock resource-cache freshness and retention policies with stale-while-revalidate focus/reconnect
  refresh, retained-data resurrection, deterministic inspection, and safe caller-owned scheduler integration.
- Added typed immutable nested form paths with canonical serialization, bounded get/set/delete helpers, path-aware
  diagnostics, nested registration/reset/dirty/error state, and recursively managed direct value mutations.
- Added versioned typed route locations with canonical parse/format support for params, query, fragments, and state,
  plus bounded immutable locations and synchronized read-only RouteManager observation.
- Added opt-in immutable Unicode 17 terminal-width profiles for UAX #11 ambiguous, combining, private-use, and
  unassigned policy, backed by pinned General Category data and a shared terminal/browser entrypoint corpus.
- Added independently cancellable resource-load handles with deduplicating join, supersede, and force-new policies,
  revision-guarded publication, bounded ownership, and exception-atomic reentrant transitions.
- Added grapheme-safe `TextBox` directional selection, selection-aware multiline edits and paste, terminal-cell-aware
  selection/cursor projection, and failure-atomic bounded literal find/replace APIs, plus Inkstone current-note
  find/replace and latest-wins, permission-scoped durable session/draft recovery with a deterministic in-memory
  fallback.
- Added typed field-array controllers with stable item IDs, structural mutations, per-item interaction metadata,
  caller-owned history transactions, and bounded identity-preserving external reconciliation.
- Added compiled typed route patterns with parameter codecs, deterministic build/match behavior, static/parameter/splat
  ranking, immutable registries, and bounded ambiguity diagnostics.
- Added a package stability manifest for terminal, browser, remote, experimental, and demo-only surfaces.
- Added `deno task package-check` to verify the Deno export map stays aligned with the stability manifest.
- Added `@ubernaut/deno-tui` package metadata, a lean JSR publish allowlist, and `deno task release-check` for strict
  publish dry runs with artifact-size reporting.

### Changed

- The Muxstone showcase prefix key moved from tmux-conflicting Ctrl-B to Ctrl-N; double Ctrl-N forwards a literal
  Ctrl-N byte to the focused terminal.
- The Muxstone network panel browses hosts and tailnet machines through the shared workbench `TreeController`
  hierarchy, and freshly spawned floating terminals open centered and focused above the panel.
- Text-row components now allocate and retire visible rows as their terminal height changes, including styled ANSI rows.
- Tightened the contributor API inventory gate to require duplicate-free public exports and 100% JSDoc coverage.
- Made every published entrypoint pass JSR fast-type and declaration-output validation without `--allow-slow-types`.
- Expanded the normalized layout capability inventory from 46 to 48 public fields while preserving legacy numeric
  spacing APIs and making solver-specific limitations inspectable.
- Mouse interaction targets can resolve z-order lazily, and app-level mouse dispatch now preserves source order across
  asynchronous capture handlers while dropping disabled or removed captured gestures without retargeting releases.

### Fixed

- The terminal screen model now consumes ECMA-35 charset designations (`ESC ( B`, `ESC ) 0`), keypad mode selects,
  and SO/SI shifts, rendering DEC Special Graphics as box-drawing glyphs; curses apps such as nano no longer leak
  `(B`-style artifacts or draw ACS borders as letters, including across chunk-split writes.
- The input reader no longer decodes SGR or legacy X10 horizontal-wheel codes as vertical scrolls, and legacy X10
  wheel-up bytes now decode as scroll events instead of drags.
- Muxstone wheel input over an alternate-screen child without mouse tracking now sends cursor-key fallback bytes to
  the child instead of trapping the window in workbench copy mode, so full-screen apps scroll naturally.
- Three ASCII now verifies mapped GPU readback before selecting an adapter and falls back to a compatible software
  adapter when the primary device cannot support terminal readback.
- Three ASCII canvas objects keep their startup or last complete grid visible while deferred readback warms, including
  across terminal resizes.
- Screenshot generation serializes GPU access and rejects startup, fallback, sparse, or unavailable renderer captures;
  the Neon Exodus capture now exercises a maximized Three scene.
- Three ASCII block-glyph rendering preserves the renderer's mapped per-cell colors instead of collapsing scenes toward
  a nearly white foreground, in both terminal and browser workbench paths.
- Kept advanced-window host focus, responsive component focus, chrome clicks, shelf restore, task switching, and route
  changes synchronized without registering hidden surfaces; task switching also excludes responsively hidden tiled
  windows and safely rebases when the viewport changes while the switcher is open.
- Prevented focus-navigation Tab events from leaking into the newly focused input and prevented provisional window
  drag/resize frames from crossing Showcase persistence commit boundaries.
- Hardened the new history, journal, pointer, scheduler, task-group, secret, and window-history contracts against late
  async work, counter exhaustion, hostile arrays/thenables, false cancellation, reentrant cleanup, and inexact overlay
  restoration.
- Hardened input reconciliation, deadline trees, async-channel waiter cleanup, and permission parsing against hostile
  provenance, forged synthetic envelopes, deep cancellation, reentrant abort signals, proxy length races, and oversized
  JSON before parsing.
- Hardened Unicode packs, resource caches, async-iterable operators, and negotiated remote terminals against hostile
  reflection, reentrant disposal, late async completion, forged protocol results, unbounded inputs, and cleanup races.
- Hardened grapheme editing, temporal cache timers, nested forms, and typed routing against quadratic scans, oversized
  aggregate data, reentrant callbacks, raw descriptor/proxy escapes, aliasing, partial commits, forged signals,
  unbounded diagnostics, no-op emissions, and stale or uncancellable host work.
