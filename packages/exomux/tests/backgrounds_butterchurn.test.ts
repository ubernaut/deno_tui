import { assert, assertAlmostEquals, assertEquals } from "./deps.ts";
import { EXOMUX_BUTTERCHURN_PRESETS, ExomuxButterchurnField } from "../butterchurn_background.ts";
import { EXOMUX_AUDIO_BANDS, EXOMUX_AUDIO_WAVEFORM, type ExomuxAudioFrame, type ExomuxAudioSource } from "../audio.ts";
import { EXOMUX_BACKGROUND_IDS, type ExomuxBackgroundId, exomuxBackgroundId, exomuxTheme } from "../model.ts";
import { exomuxBackgroundOvergrows } from "../overgrowth.ts";
import {
  type ExomuxAnimatedBackground,
  type ExomuxDisposableBackground,
  releaseExomuxIdleBackgrounds,
} from "../background.ts";

const THEME = exomuxTheme("midnight");
const BOUNDS = { column: 4, row: 3, width: 60, height: 20 };

/** Every glyph the field is allowed to paint. */
const SHADES = new Set(["░", "▒", "▓", "█"]);

interface ScriptOptions {
  /** Overall loudness, and the scale of the synthesized waveform. */
  readonly level?: number;
  readonly bass?: number;
  readonly mid?: number;
  readonly treble?: number;
  /** Fire a beat every `beatEvery` frames; 0 never beats. */
  readonly beatEvery?: number;
}

/**
 * Deterministic stand-in for the microphone. Every test drives the field
 * through this so nothing spawns a recorder and frames are reproducible.
 */
function scriptedAudio(options: ScriptOptions = {}): ExomuxAudioSource & { frames: number } {
  const level = options.level ?? 0.7;
  const bands = new Float32Array(EXOMUX_AUDIO_BANDS);
  const waveform = new Float32Array(EXOMUX_AUDIO_WAVEFORM);
  const source = {
    frames: 0,
    frame(): ExomuxAudioFrame {
      source.frames += 1;
      const phase = source.frames * 0.125;
      for (let band = 0; band < bands.length; band += 1) {
        bands[band] = level * Math.max(0, 0.5 + 0.4 * Math.sin(phase * (0.9 + band * 0.2) + band));
      }
      for (let index = 0; index < waveform.length; index += 1) {
        waveform[index] = level * Math.sin(index / waveform.length * Math.PI * 6 + phase * 4);
      }
      const beatEvery = options.beatEvery ?? 0;
      return {
        level,
        bass: options.bass ?? level * 0.7,
        mid: options.mid ?? level * 0.6,
        treble: options.treble ?? level * 0.5,
        bands,
        waveform,
        beat: beatEvery > 0 && source.frames % beatEvery === 0,
        source: "synth",
      };
    },
    label: () => "scripted",
    close: () => {},
  };
  return source;
}

function run(field: ExomuxButterchurnField, frames: number, startAt = 0): number {
  let now = startAt;
  for (let frame = 0; frame < frames; frame += 1) {
    now += 125;
    field.advance({ bounds: BOUNDS, now });
  }
  return now;
}

/** Total painted cells and the summed brightness of the rendered frame. */
function inkStats(field: ExomuxButterchurnField): { painted: number; brightness: number } {
  let painted = 0;
  let brightness = 0;
  for (const row of field.rasterizeCells(BOUNDS, THEME)) {
    for (const cell of row) {
      if (!cell) continue;
      painted += 1;
      brightness += cell.foreground[0] + cell.foreground[1] + cell.foreground[2];
    }
  }
  return { painted, brightness };
}

function frameText(field: ExomuxButterchurnField): string {
  return field.rasterizeCells(BOUNDS, THEME)
    .map((row) => row.map((cell) => cell ? `${cell.char}${cell.foreground.join(",")}` : " ").join("|"))
    .join("\n");
}

Deno.test("ExomuxButterchurnField: registered as a desktop background that does not overgrow windows", () => {
  assert(EXOMUX_BACKGROUND_IDS.includes("butterchurn"), "the background must be selectable");
  assertEquals(exomuxBackgroundId("butterchurn"), "butterchurn");
  // A visualizer composed around the screen centre smears into noise when it is
  // tiled over window chrome, so it stays out of the reclaim set.
  assertEquals(exomuxBackgroundOvergrows("butterchurn"), false);
});

Deno.test("ExomuxButterchurnField: paints only the block shade ramp", () => {
  const field = new ExomuxButterchurnField({ audio: scriptedAudio() });
  run(field, 60);

  const chars = new Set<string>();
  for (const row of field.rasterizeCells(BOUNDS, THEME)) {
    for (const cell of row) {
      if (cell) chars.add(cell.char);
    }
  }
  assert(chars.size > 1, "a settled frame should use more than one shade");
  for (const char of chars) assert(SHADES.has(char), `unexpected glyph ${JSON.stringify(char)}`);
});

Deno.test("ExomuxButterchurnField: brightness tracks the microphone level", () => {
  const readings = [0.15, 0.45, 0.9].map((level) => {
    const field = new ExomuxButterchurnField({ audio: scriptedAudio({ level }), autoCycle: false });
    run(field, 80);
    return { level, ...inkStats(field) };
  });

  for (let index = 1; index < readings.length; index += 1) {
    const quieter = readings[index - 1]!;
    const louder = readings[index]!;
    assert(
      louder.brightness > quieter.brightness * 1.2,
      `level ${louder.level} should be clearly brighter than ${quieter.level}: ` +
        `${quieter.brightness} -> ${louder.brightness}`,
    );
  }
});

Deno.test("ExomuxButterchurnField: a beat deposits extra ink", () => {
  const quiet = new ExomuxButterchurnField({ audio: scriptedAudio({ beatEvery: 0 }), autoCycle: false });
  const pulsing = new ExomuxButterchurnField({ audio: scriptedAudio({ beatEvery: 4 }), autoCycle: false });
  run(quiet, 60);
  run(pulsing, 60);
  assert(
    inkStats(pulsing).brightness > inkStats(quiet).brightness,
    "beat frames should add ink the beatless run does not have",
  );
});

Deno.test("ExomuxButterchurnField: silence leaves the desktop mostly clear", () => {
  const silent = new ExomuxButterchurnField({ audio: scriptedAudio({ level: 0, bass: 0, mid: 0, treble: 0 }) });
  run(silent, 120);
  const quiet = inkStats(silent);
  const loud = new ExomuxButterchurnField({ audio: scriptedAudio({ level: 1 }) });
  run(loud, 120);

  // MilkDrop draws a flat trace rather than nothing on silence, so this is a
  // ratio rather than an assertion of zero.
  assert(
    quiet.painted * 3 < inkStats(loud).painted,
    `silence should cover far less of the desktop: ${quiet.painted} vs ${inkStats(loud).painted}`,
  );
});

Deno.test("ExomuxButterchurnField: same audio and frame timeline replay identically", () => {
  const left = new ExomuxButterchurnField({ audio: scriptedAudio({ beatEvery: 5 }), presetIndex: 2 });
  const right = new ExomuxButterchurnField({ audio: scriptedAudio({ beatEvery: 5 }), presetIndex: 2 });
  run(left, 150);
  run(right, 150);
  assertEquals(frameText(left), frameText(right));

  const other = new ExomuxButterchurnField({ audio: scriptedAudio({ beatEvery: 5 }), presetIndex: 5 });
  run(other, 150);
  assert(frameText(other) !== frameText(left), "a different preset should look different");
});

Deno.test("ExomuxButterchurnField: presets cycle on a timer and crossfade rather than snap", () => {
  const field = new ExomuxButterchurnField({ audio: scriptedAudio(), presetIndex: 0 });
  assertEquals(field.presetIndex, 0);

  // The hold is 15 s; at 125 ms a frame that is 120 frames.
  run(field, 100);
  assertEquals(field.presetIndex, 0, "the first preset should still be holding");
  run(field, 40, 100 * 125);
  assertEquals(field.presetIndex, 1, "the field should have advanced one preset");

  const held = new ExomuxButterchurnField({ audio: scriptedAudio(), presetIndex: 0, autoCycle: false });
  run(held, 400);
  assertEquals(held.presetIndex, 0, "auto-cycle off must leave the opening preset alone");

  // A manual cycle blends: partway through, the frame differs from both the
  // preset held alone and the incoming preset held alone.
  const blending = new ExomuxButterchurnField({ audio: scriptedAudio(), presetIndex: 0, autoCycle: false });
  run(blending, 60);
  blending.nextPreset();
  const midBlend = run(blending, 8, 60 * 125);
  assertEquals(blending.presetIndex, 1);
  const straight = new ExomuxButterchurnField({ audio: scriptedAudio(), presetIndex: 1, autoCycle: false });
  run(straight, 68);
  assert(frameText(blending) !== frameText(straight), "a blend in progress is not the destination preset");
  assert(midBlend > 0);
});

Deno.test("ExomuxButterchurnField: every preset name is distinct and every wave mode is exercised", () => {
  const names = new Set(EXOMUX_BUTTERCHURN_PRESETS.map((preset) => preset.name));
  assertEquals(names.size, EXOMUX_BUTTERCHURN_PRESETS.length, "preset names label the catalog, so they must be unique");

  // Each mode has its own plotting path and its own ink density; an unexercised
  // one is an untested one.
  const modes = new Set(EXOMUX_BUTTERCHURN_PRESETS.map((preset) => preset.wave));
  assertEquals([...modes].sort(), ["circle", "dual", "figure", "line", "radial", "spectrum"]);

  for (const preset of EXOMUX_BUTTERCHURN_PRESETS) {
    assert(preset.decay > 0 && preset.decay < 1, `${preset.name} needs a decay inside (0, 1)`);
    assert(preset.zoom > 0.5, `${preset.name} needs a positive zoom`);
  }
});

Deno.test("ExomuxButterchurnField: no preset saturates or blanks the desktop", () => {
  for (let index = 0; index < EXOMUX_BUTTERCHURN_PRESETS.length; index += 1) {
    const preset = EXOMUX_BUTTERCHURN_PRESETS[index]!;
    const field = new ExomuxButterchurnField({
      audio: scriptedAudio({ level: 0.9 }),
      presetIndex: index,
      autoCycle: false,
    });
    run(field, 200);
    const share = inkStats(field).painted / (BOUNDS.width * BOUNDS.height);
    // A feedback loop that outruns its own decay fills the screen with white
    // and never recovers; one that underruns it fades to nothing.
    assert(share > 0.05, `${preset.name} faded to nothing (${(share * 100).toFixed(1)}% covered)`);
    assert(share < 0.98, `${preset.name} saturated the desktop (${(share * 100).toFixed(1)}% covered)`);
  }
});

Deno.test("ExomuxButterchurnField: the output palette stays inside the painter's style cache", () => {
  // The desktop painter caches ANSI styles per color and drops the whole cache
  // at 8192 entries. An unquantized frame of this field mints hundreds of new
  // colors per tick, which would flush that cache every couple of seconds and
  // then miss on nearly every cell.
  const field = new ExomuxButterchurnField({ audio: scriptedAudio({ level: 0.9 }) });
  const palette = new Set<number>();
  let now = 0;
  for (let frame = 0; frame < 600; frame += 1) {
    now += 125;
    field.advance({ bounds: BOUNDS, now });
    for (const row of field.rasterizeCells(BOUNDS, THEME)) {
      for (const cell of row) {
        if (!cell) continue;
        const [red, green, blue] = cell.foreground;
        palette.add((red << 16) | (green << 8) | blue);
      }
    }
  }
  assert(palette.size > 8, "a visualizer with under a dozen colors is not rendering a gradient");
  assert(palette.size < 4913, `palette grew past the quantization grid: ${palette.size}`);
});

Deno.test("ExomuxButterchurnField: survives resizing and rejects an empty rect", () => {
  const field = new ExomuxButterchurnField({ audio: scriptedAudio() });
  run(field, 40);

  let now = 40 * 125;
  const wide = { column: 0, row: 0, width: 120, height: 40 };
  for (let frame = 0; frame < 20; frame += 1) {
    now += 125;
    assertEquals(field.advance({ bounds: wide, now }), true);
  }
  const rows = field.rasterizeCells(wide, THEME);
  assertEquals(rows.length, wide.height);
  assertEquals(rows[0]!.length, wide.width);

  // A rect the field has not simulated paints nothing rather than reading off
  // the end of the buffer it does have.
  assertEquals(field.rasterizeCells(BOUNDS, THEME).length, 0);
  assertEquals(field.advance({ bounds: { column: 0, row: 0, width: 0, height: 0 }, now: now + 125 }), false);
});

Deno.test("ExomuxButterchurnField: the pointer leaves a mark and dispose leaves an injected source alone", () => {
  const audio = scriptedAudio({ level: 0.2 });
  let closed = false;
  const tracked: ExomuxAudioSource = { ...audio, close: () => closed = true };

  const withPointer = new ExomuxButterchurnField({ audio: tracked, autoCycle: false });
  const without = new ExomuxButterchurnField({ audio: scriptedAudio({ level: 0.2 }), autoCycle: false });
  run(without, 30);
  for (let frame = 0; frame < 30; frame += 1) {
    const now = (frame + 1) * 125;
    // A corner the wave figures do not reach, so the mark is unambiguous.
    withPointer.setPointer({ column: BOUNDS.column + 1, row: BOUNDS.row + 1 }, now);
    withPointer.advance({ bounds: BOUNDS, now });
  }
  const marked = withPointer.rasterizeCells(BOUNDS, THEME)[1]![1];
  assert(marked, "the pointer should deposit ink under the cursor");
  assertEquals(without.rasterizeCells(BOUNDS, THEME)[1]![1], undefined);

  withPointer.clearPointer();
  // The field did not open this source, so it must not close it either.
  withPointer.dispose();
  assertEquals(closed, false);
});

Deno.test("releaseExomuxIdleBackgrounds: frees the microphone when another background takes over", () => {
  const disposals: string[] = [];
  const disposable = (name: string): ExomuxDisposableBackground => ({
    setPointer: () => {},
    clearPointer: () => {},
    advance: () => true,
    rasterizeCells: () => [],
    dispose: () => disposals.push(name),
  });
  const plain = (): ExomuxAnimatedBackground => ({
    setPointer: () => {},
    clearPointer: () => {},
    advance: () => true,
    rasterizeCells: () => [],
  });

  const fields = new Map<ExomuxBackgroundId, ExomuxAnimatedBackground>([
    ["butterchurn", disposable("butterchurn")],
    ["jungle", plain()],
  ]);

  // The selected field keeps its resource; a plain field is never disturbed, so
  // switching away and back still resumes its simulation.
  releaseExomuxIdleBackgrounds(fields, "butterchurn");
  assertEquals(disposals, []);
  assertEquals([...fields.keys()].sort(), ["butterchurn", "jungle"]);

  // Selecting something else releases the microphone and drops the field, so
  // the next selection rebuilds it rather than reviving a closed handle.
  releaseExomuxIdleBackgrounds(fields, "jungle");
  assertEquals(disposals, ["butterchurn"]);
  assertEquals([...fields.keys()], ["jungle"]);

  // Tearing the desktop down releases everything left.
  fields.set("butterchurn", disposable("again"));
  releaseExomuxIdleBackgrounds(fields);
  assertEquals(disposals, ["butterchurn", "again"]);
  assertEquals([...fields.keys()], ["jungle"]);
});

Deno.test("ExomuxButterchurnField: a stalled desktop tick fades rather than freezing", () => {
  const steady = new ExomuxButterchurnField({ audio: scriptedAudio(), autoCycle: false });
  run(steady, 40);
  const before = inkStats(steady).brightness;

  // One 400 ms tick is worth several frames of decay; the field must apply it
  // instead of treating the gap as a single frame and leaving a bright ghost.
  steady.advance({ bounds: BOUNDS, now: 40 * 125 + 400 });
  const after = inkStats(steady).brightness;
  assert(after > 0, "a stall should not blank the field");
  assertAlmostEquals(after / before, 1, 0.6, `a stalled tick changed brightness too sharply: ${before} -> ${after}`);
});
