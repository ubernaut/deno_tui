# Exomux

A terminal multiplexer built on `@ubernaut/deno-tui`: a detachable local host owning PTY-backed shells, and a floating
workbench client that can exit and reattach without disturbing them.

## Running

```sh
deno task start          # from this directory
deno task --cwd packages/exomux start   # from the repository root
```

`deno task exomux` at the repository root delegates here. `--memory` skips layout persistence, `--daemon` runs the host
alone (it requires a valid `EXOMUX_TOKEN` and is normally started for you by the client).

## The butterchurn background

`butterchurn_background.ts` is a MilkDrop audio visualizer, selected like any other background with prefix `b`. It is
the ASCII port of [butterchurnxr](https://github.com/ubernaut/butterchurnxr)'s `asciichurn` rendered natively:
`asciichurn` proxies its pixels out to Butterchurn's WebGL2 renderer in headless Chromium, which a single compiled
binary running over a tailnet cannot do, so the renderer is rebuilt here against `navigator.gpu`.

The presets are the real ones. `butterchurn_catalog.ts` vendors the upstream `base` + `extra` packs — the same 293
MilkDrop presets asciichurn reports — with each preset's base values, its three EEL equation blocks, and its warp and
composite shaders.

| Module                      | Role                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| `eel.ts`                    | Interpreter for EEL2, the language preset equations are written in            |
| `butterchurn_preset.ts`     | Butterchurn's frame pipeline: base-value restore, `q` handling, the warp mesh |
| `glsl_wgsl.ts`              | Translates preset shaders from GLSL to WGSL                                   |
| `butterchurn_noise.ts`      | The noise textures and volumes preset shaders sample                          |
| `butterchurn_gpu.ts`        | The render graph: warp pass, blur chain, waveform, composite, readback        |
| `butterchurn_background.ts` | The desktop field: audio, preset cycling, and the software fallback           |

Preset shaders ship as GLSL — upstream already converted them from MilkDrop's HLSL — and all 500 shader bodies in the
catalog translate to WGSL. The graph then runs what MilkDrop runs: the `pixel_eqs` mesh drawn over the previous frame
through the preset's warp shader, a three-level blur chain (295 presets sample `sampler_blur1`), the waveform, and the
composite shader where most presets do their colour grading. The finished frame is downsampled to the cell grid and read
back asynchronously, landing one frame late.

**Skipping presets.** Clicking bare desktop advances to the next preset; `Ctrl-N [` and `Ctrl-N ]` step backwards and
forwards. Presets otherwise auto-cycle every fifteen seconds, and one that renders nothing is skipped after two.

**Telling which renderer is running.** The status line announces the renderer whenever it changes, and stepping a preset
reports it alongside the preset name — `Preset 47/289 · gpu · mic:parec: Geiss - Cauldron`. `software renderer` there
means preset shaders are not running.

One WebGPU device serves the whole client, from `gpu_device.ts`. Deno allows exactly one per process, and the turbulence
background wants one too, so a private device meant whichever field initialised second never got one.

Preset transitions are prepared ahead of time: the next preset's equations are compiled and its shader pipelines built
three seconds before its slot starts, the pipelines asynchronously. Both were previously done on the frame of the
switch, where they stalled the desktop.

**Software fallback.** With no GPU adapter — a headless tailnet host, or `--unstable-webgpu` absent — the field falls
back to a CPU renderer that runs the equations but not the shaders. It still works, but resolves far fewer presets to an
image, and a brightness governor stands in for the composite shader that would otherwise keep the feedback loop bounded.
`butterchurn_rotation.ts` is selected against the GPU renderer, where 289 of 293 presets resolve.

Custom waves and custom shapes are the one part of a preset still not carried over.

`audio.ts` captures the microphone through the first of `parec`, `pw-record` or `arecord` that produces samples, and
reduces it to spectrum bands, bass/mid/treble energy, a waveform and beat pulses. Capture is refcounted and lazy:
nothing spawns until the background is selected, and the recorder is killed when you switch away.

```sh
deno task audio          # print 3s of live levels and a spectrum strip
```

Each recorder defaults to the system default source, which is **not** always a microphone — on a PipeWire desktop it is
often the monitor of an output, which records digital silence on an idle machine. `EXOMUX_AUDIO_DEVICE` overrides it
with a name from `pactl list sources short`; point it at a real input, or at an output monitor to visualize whatever is
playing. With no working recorder at all the analyser synthesizes a signal so the field still moves.

Both generated files are checked in and rebuilt with:

```sh
deno task exomux:presets --presets ~/projects/butterchurnxr/node_modules/butterchurn-presets
deno task exomux:audit
```

`butterchurn-presets` is MIT licensed, Copyright (c) 2013-2018 Jordan Berg.

## Transparent windows

Terminal windows can show the desktop background through their text. `opacity` is a desktop-wide setting in the global
config modal and a per-window override in the titlebar one; a window ships on `Desktop`, meaning it follows the global
value, and can be pinned to its own instead.

At `Opaque` a window paints its own surface colour, as it always has. Below that, every cell the program has **not**
given a background of its own is blended from the desktop background toward the surface colour — so lower opacity means
a lighter, more see-through window, and higher means darker and more solid. Characters themselves always render at full
strength; only their ground changes. Cells a program deliberately coloured keep that colour, because a transparent
window that erased them would wipe out every block of colour on screen.

A terminal cell carries one background colour, so what shows through is the background field's glyph and colour
collapsed into a single colour, weighted by how much of the cell that glyph covers — the `░▒▓█` ramp the fields use is a
coverage ramp already.

One consequence worth knowing: the desktop background normally stops animating once windows cover it, which is a real
saving. Any window below `Opaque` keeps it running, since that is exactly when the background is still on screen.

## Why this is a separate package

Exomux has its own `deno.json` and its own `deno.lock`, and it is deliberately **not** a Deno workspace member. A
workspace shares one npm resolution, and `deno compile` materializes all of it rather than just the module graph — as a
workspace member or as a file inside the library's own config, the compiled binary carried roughly 48MB of packages it
never imports (esbuild and its platform binaries, three.js, the image codecs). Resolved against this config it is
122.5MB instead of 170.4MB, with the dependency set still fully locked.

## Depending on the library

The library is reached exclusively through its public entrypoints, aliased in `deno.json`:

| alias                         | today                   |
| ----------------------------- | ----------------------- |
| `@ubernaut/deno-tui`          | `../../mod.ts`          |
| `@ubernaut/deno-tui/app`      | `../../mod.app.ts`      |
| `@ubernaut/deno-tui/terminal` | `../../mod.terminal.ts` |
| `@ubernaut/deno-tui/testing`  | `../../mod.testing.ts`  |

No file here imports `../../src/...`. Once the library is published, those four path values become JSR specifiers and
nothing else changes — that is the whole point of routing them through the import map.

`@showcase/kit` still points into `examples/showcases/shared`, which Inkstone also uses. It supplies six symbols
(`ShowcaseKernel`, `createShowcaseTerminalStore`, `defineShowcaseManifest` and three provider types) and needs its own
home before Exomux can be published independently.

## Layout

Sources sit flat at the package root; `tests/` holds the suite. `main.ts` is the CLI entry, `mod.ts` the library
surface.
