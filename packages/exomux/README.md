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
binary running over a tailnet cannot do, so the pipeline is reimplemented on the CPU at cell resolution.

The presets are the real ones, not imitations. `butterchurn_catalog.ts` vendors the upstream `base` + `extra` packs —
the same 293 MilkDrop presets asciichurn reports — with each preset's base values and its three EEL equation blocks.
`eel.ts` is an interpreter for EEL2, the language those equations are written in; `butterchurn_preset.ts` runs them
through Butterchurn's own pipeline, restoring base values every frame, resetting `q1..q32` while letting user variables
persist, and building MilkDrop's warp mesh from the per-vertex equations. That mesh is what the previous frame is
resampled through, so each preset moves the way it does upstream rather than being approximated.

Three parts of a preset cannot come along: the HLSL warp and composite shaders, custom waves and custom shapes, and the
blur chain. They need a GPU and a shader translator. A preset's motion is therefore faithful while its colour grading
and fine texture are approximate — and since two thirds of the catalog draws its image with exactly those features,
`butterchurn_rotation.ts` narrows auto-cycling to the 171 presets that resolve to a moving image here. The other 122 are
still reachable by index through `EXOMUX_BUTTERCHURN_CATALOG`.

Both generated files are checked in and rebuilt with:

```sh
# Re-vendor the catalog from a butterchurn-presets install, then re-render every
# preset to rewrite the rotation. Neither is needed for a normal build.
deno task exomux:presets --presets ~/projects/butterchurnxr/node_modules/butterchurn-presets
deno task exomux:audit
```

`butterchurn-presets` is MIT licensed, Copyright (c) 2013-2018 Jordan Berg.

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
