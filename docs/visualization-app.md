# Visualization App

This project now includes a generic terminal visualization app at `app/main.ts`.

It combines:

- A default `bottom`-style resource monitor wall.
- A routing model where each output target can bind multiple input sources.
- Neon Exodus visualizations sourced from `../neon-exodus/opentui-neon-exodus/src/theme.ts` and adapted to this app's
  signal routing.
- Live system audio monitor and microphone inputs when Pulse/PipeWire sources are available.

## Run

```bash
deno task viz
```

Typecheck with:

```bash
deno task viz:check
```

## Controls

- `F1`: Help
- `F2`: Routing menu for output target, visualization, and input sources
- `F3`: Screen layout selection
- `F4`: Visualization options
- `F5` or `c`: Toggle cycle mode on the focused target
- `Tab` / arrow keys: Move focus
- `Esc`: Close the current menu
- `q`: Quit

## Inputs

Available routing inputs include:

- System metrics such as CPU, memory, swap, temperature, disks, network, and processes
- Synthetic signal generators
- Pulse/PipeWire audio monitor sources for system output
- Pulse/PipeWire microphone / capture sources

Most visualizations accept any combination of sources. Source values drive either direct content, severity, or animation
phase depending on the visualization.

## Layouts

The default `monitor` layout mirrors the local `bottom` arrangement:

- CPU graph
- CPU legend
- Memory graph
- Temperature panel
- Disk panel
- Network graph
- Process table

Additional layouts include single-pane, vertical split, horizontal split, and quad deck.

## Options

Each output target keeps its own visualization settings:

- ASCII mode
- Border mode
- Density
- Contrast
- Cycle enabled
- Cycle interval

Cycle mode rotates through visualizations every 10 seconds by default and can be changed per target.
