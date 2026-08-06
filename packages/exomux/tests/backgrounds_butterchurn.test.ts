import { assert, assertAlmostEquals, assertEquals } from "./deps.ts";
import { EXOMUX_BUTTERCHURN_PRESETS, ExomuxButterchurnField } from "../butterchurn_background.ts";
import { EXOMUX_BUTTERCHURN_CATALOG, type ExomuxButterchurnPresetSource } from "../butterchurn_catalog.ts";
import { EXOMUX_BUTTERCHURN_ROTATION } from "../butterchurn_rotation.ts";
import { ExomuxButterchurnPreset, MILKDROP_DEFAULTS } from "../butterchurn_preset.ts";
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
  readonly level?: number;
  readonly beatEvery?: number;
}

/**
 * Deterministic stand-in for the microphone. Every test drives the field
 * through this so nothing spawns a recorder and frames are reproducible.
 */
function scriptedAudio(options: ScriptOptions = {}): ExomuxAudioSource {
  const level = options.level ?? 0.7;
  const bands = new Float32Array(EXOMUX_AUDIO_BANDS);
  const waveform = new Float32Array(EXOMUX_AUDIO_WAVEFORM);
  let frames = 0;
  return {
    frame(): ExomuxAudioFrame {
      frames += 1;
      const phase = frames * 0.125;
      const kick = Math.max(0, Math.sin(phase * Math.PI * 2));
      for (let band = 0; band < bands.length; band += 1) {
        bands[band] = level * Math.max(0, 0.5 + 0.4 * Math.sin(phase * (0.9 + band * 0.2) + band));
      }
      for (let index = 0; index < waveform.length; index += 1) {
        waveform[index] = level * Math.sin((index / waveform.length) * Math.PI * 6 + phase * 4);
      }
      const beatEvery = options.beatEvery ?? 0;
      return {
        level,
        bass: level * (0.5 + 0.4 * kick),
        mid: level * 0.6,
        treble: level * 0.5,
        bands,
        waveform,
        beat: beatEvery > 0 && frames % beatEvery === 0,
        source: "synth",
      };
    },
    label: () => "scripted",
    close: () => {},
  };
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
    .map((row) => row.map((cell) => (cell ? `${cell.char}${cell.foreground.join(",")}` : " ")).join("|"))
    .join("\n");
}

/** A preset source with everything defaulted, for pipeline tests. */
function source(overrides: Partial<ExomuxButterchurnPresetSource>): ExomuxButterchurnPresetSource {
  return { name: "test", baseVals: {}, init: "", frame: "", pixel: "", warp: "", comp: "", ...overrides };
}

// ── catalog ─────────────────────────────────────────────────────────────────

Deno.test("butterchurn: the vendored catalog is the upstream base+extra packs", () => {
  assertEquals(EXOMUX_BUTTERCHURN_CATALOG.length, 293, "base (107) + extra (186) is what asciichurn reports");
  const names = new Set(EXOMUX_BUTTERCHURN_CATALOG.map((preset) => preset.name));
  assertEquals(names.size, EXOMUX_BUTTERCHURN_CATALOG.length, "preset names identify entries, so they must be unique");

  // Case-insensitive ordering, matching the parent demo's own sort, so that
  // "next preset" walks the catalog in the same order upstream does.
  const sorted = [...EXOMUX_BUTTERCHURN_CATALOG].sort((left, right) => {
    const a = left.name.toLowerCase();
    const b = right.name.toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
  });
  assertEquals(EXOMUX_BUTTERCHURN_CATALOG.map((p) => p.name), sorted.map((p) => p.name));

  // Equations are what make presets differ; a catalog of bare parameters would
  // render 293 variations of the same picture.
  const withFrame = EXOMUX_BUTTERCHURN_CATALOG.filter((preset) => preset.frame.trim().length > 0);
  assert(withFrame.length > 250, `expected most presets to carry frame equations, got ${withFrame.length}`);
});

Deno.test("butterchurn: the rotation is a curated subset of the catalog", () => {
  const catalog = new Set(EXOMUX_BUTTERCHURN_CATALOG.map((preset) => preset.name));
  assert(EXOMUX_BUTTERCHURN_ROTATION.length > 250, `rotation is too small: ${EXOMUX_BUTTERCHURN_ROTATION.length}`);
  assert(EXOMUX_BUTTERCHURN_ROTATION.length <= catalog.size);
  for (const name of EXOMUX_BUTTERCHURN_ROTATION) {
    assert(catalog.has(name), `rotation names a preset the catalog does not have: ${name}`);
  }
  assertEquals(new Set(EXOMUX_BUTTERCHURN_ROTATION).size, EXOMUX_BUTTERCHURN_ROTATION.length, "no duplicates");
  assertEquals(EXOMUX_BUTTERCHURN_PRESETS.length, EXOMUX_BUTTERCHURN_ROTATION.length);
});

Deno.test("butterchurn: every preset in the catalog loads without throwing", () => {
  // A preset whose equations fail to compile still has to render as a static
  // parameter dump rather than take the desktop down.
  const audio = {
    bass: 1.2,
    mid: 1,
    treb: 0.8,
    bassAttack: 1.1,
    midAttack: 1,
    trebleAttack: 0.8,
    waveform: new Float32Array(64).map((_unused, index) => Math.sin(index * 0.3)),
  };
  let animated = 0;
  for (const entry of EXOMUX_BUTTERCHURN_CATALOG) {
    const preset = new ExomuxButterchurnPreset(entry, { random: () => 0.5 });
    preset.setSize(40, 12);
    preset.advance(audio, 1, 8, 8);
    if (preset.animated) animated += 1;
    for (const value of preset.mesh) assert(Number.isFinite(value), `${entry.name} produced a non-finite mesh`);
    for (let index = 0; index < preset.waveCount * 2; index += 1) {
      assert(Number.isFinite(preset.wave[index]!), `${entry.name} produced a non-finite wave vertex`);
    }
    assert(Number.isFinite(preset.values.decay), `${entry.name} produced a non-finite decay`);
  }
  // 288 of 293 carry frame equations that compile. Two have none at all, and
  // three have `is_beat` split across a newline in the upstream JSON — corrupt
  // source Butterchurn cannot parse either. Those five load as static parameter
  // dumps instead of failing. Pinned exactly so a parser regression that
  // silently drops presets shows up here.
  assertEquals(animated, 288, "the number of presets with usable frame equations changed");
});

// ── the MilkDrop pipeline ───────────────────────────────────────────────────

Deno.test("butterchurn: base values are restored before every frame", () => {
  // The catalog's most common idiom is `wave_r = wave_r + <oscillation>`. It
  // only oscillates because MilkDrop resets wave_r to its base value first;
  // without that it walks off to infinity within seconds.
  const preset = new ExomuxButterchurnPreset(
    source({ baseVals: { wave_r: 0.4 }, frame: "wave_r = wave_r + 0.1;" }),
    { random: () => 0.5 },
  );
  preset.setSize(40, 12);
  const audio = silentAudio();
  for (let frame = 0; frame < 20; frame += 1) preset.advance(audio, frame * 0.125, frame, 8);
  assertAlmostEquals(preset.values.waveR, 0.5, 1e-9, "wave_r must restart from its base value each frame");
});

Deno.test("butterchurn: user variables persist across frames but q variables reset", () => {
  const preset = new ExomuxButterchurnPreset(
    source({ init: "q1 = 5; carried = 100;", frame: "carried = carried + 1; q1 = q1 + 1; seen = q1;" }),
    { random: () => 0.5 },
  );
  preset.setSize(40, 12);
  const audio = silentAudio();
  for (let frame = 0; frame < 4; frame += 1) preset.advance(audio, frame * 0.125, frame, 8);
  // An accumulator the preset invented keeps counting...
  assertEquals(preset.variable("carried"), 104);
  // ...while q1 restarts from its post-init value every frame, so it only ever
  // reaches 6. This is the rule that makes q variables a frame-local channel.
  assertEquals(preset.variable("seen"), 6);
});

Deno.test("butterchurn: pixel equations run per vertex and reshape the warp mesh", () => {
  const flat = new ExomuxButterchurnPreset(source({ baseVals: { zoom: 1 } }), { random: () => 0.5 });
  flat.setSize(40, 12);
  flat.advance(silentAudio(), 0, 0, 8);

  // A zoom that varies with radius must bend the mesh, not translate it.
  const domed = new ExomuxButterchurnPreset(
    source({ baseVals: { zoom: 1 }, pixel: "zoom = 1 + 0.3 * rad;" }),
    { random: () => 0.5 },
  );
  domed.setSize(40, 12);
  domed.advance(silentAudio(), 0, 0, 8);

  const centre = (flat.meshHeight / 2) * (flat.meshWidth + 1) + flat.meshWidth / 2;
  assertAlmostEquals(flat.mesh[centre * 2]!, domed.mesh[centre * 2]!, 1e-6, "the centre has rad 0, so it cannot move");
  const corner = 0;
  assert(
    Math.abs(flat.mesh[corner * 2]! - domed.mesh[corner * 2]!) > 0.01,
    "a radius-dependent zoom must displace the corners",
  );
});

Deno.test("butterchurn: an identity preset leaves the warp mesh as the identity map", () => {
  // zoom 1, no rotation, translation, stretch or warp should sample each cell
  // from itself; anything else means the coordinate composition is wrong.
  const preset = new ExomuxButterchurnPreset(source({ baseVals: { warp: 0 } }), { random: () => 0.5 });
  preset.setSize(64, 16);
  preset.advance(silentAudio(), 0, 0, 8);
  const gridX = preset.meshWidth;
  const gridY = preset.meshHeight;
  for (let iy = 0; iy <= gridY; iy += 1) {
    for (let ix = 0; ix <= gridX; ix += 1) {
      const offset = (iy * (gridX + 1) + ix) * 2;
      assertAlmostEquals(preset.mesh[offset]!, ix / gridX, 1e-5, `u at ${ix},${iy}`);
      // Mesh row 0 is the top of the screen, matching how the renderer walks
      // cells, so v runs 0..1 downward.
      assertAlmostEquals(preset.mesh[offset + 1]!, iy / gridY, 1e-5, `v at ${ix},${iy}`);
    }
  }
});

Deno.test("butterchurn: defaults fill in the values a preset omits", () => {
  const preset = new ExomuxButterchurnPreset(source({ baseVals: { zoom: 1.5 } }), { random: () => 0.5 });
  preset.setSize(40, 12);
  preset.advance(silentAudio(), 0, 0, 8);
  assertEquals(preset.variable("zoom"), 1.5, "the preset's own value wins");
  assertEquals(preset.variable("decay"), MILKDROP_DEFAULTS.decay, "and everything else comes from MilkDrop's defaults");
  assertEquals(preset.variable("cx"), 0.5);
});

function silentAudio() {
  return {
    bass: 1,
    mid: 1,
    treb: 1,
    bassAttack: 1,
    midAttack: 1,
    trebleAttack: 1,
    waveform: new Float32Array(64),
  };
}

// ── the field ───────────────────────────────────────────────────────────────

Deno.test("butterchurn: registered as a desktop background that does not overgrow windows", () => {
  assert(EXOMUX_BACKGROUND_IDS.includes("butterchurn"), "the background must be selectable");
  assertEquals(exomuxBackgroundId("butterchurn"), "butterchurn");
  // A visualizer composed around the screen centre smears into noise when it is
  // tiled over window chrome, so it stays out of the reclaim set.
  assertEquals(exomuxBackgroundOvergrows("butterchurn"), false);
});

Deno.test("butterchurn: paints only the block shade ramp", () => {
  const field = new ExomuxButterchurnField({ gpu: false, audio: scriptedAudio() });
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

Deno.test("butterchurn: brightness tracks the microphone level", () => {
  const readings = [0.15, 0.5, 0.95].map((level) => {
    const field = new ExomuxButterchurnField({ gpu: false, audio: scriptedAudio({ level }), autoCycle: false });
    run(field, 90);
    return { level, ...inkStats(field) };
  });
  for (let index = 1; index < readings.length; index += 1) {
    const quieter = readings[index - 1]!;
    const louder = readings[index]!;
    assert(
      louder.brightness > quieter.brightness * 1.1,
      `level ${louder.level} should be brighter than ${quieter.level}: ${quieter.brightness} -> ${louder.brightness}`,
    );
  }
});

Deno.test("butterchurn: same audio and frame timeline replay identically", () => {
  const left = new ExomuxButterchurnField({
    gpu: false,
    audio: scriptedAudio({ beatEvery: 5 }),
    presetIndex: 3,
    seed: 9,
  });
  const right = new ExomuxButterchurnField({
    gpu: false,
    audio: scriptedAudio({ beatEvery: 5 }),
    presetIndex: 3,
    seed: 9,
  });
  run(left, 120);
  run(right, 120);
  assertEquals(frameText(left), frameText(right));

  const other = new ExomuxButterchurnField({
    gpu: false,
    audio: scriptedAudio({ beatEvery: 5 }),
    presetIndex: 11,
    seed: 9,
  });
  run(other, 120);
  assert(frameText(other) !== frameText(left), "a different preset should look different");
});

Deno.test("butterchurn: presets cycle on a timer and crossfade rather than snap", () => {
  const field = new ExomuxButterchurnField({ gpu: false, audio: scriptedAudio(), presetIndex: 0 });
  assertEquals(field.presetIndex, 0);
  assertEquals(field.presetName, EXOMUX_BUTTERCHURN_PRESETS[0]!.name);

  // The hold is 15 s; at 125 ms a frame that is 120 frames.
  run(field, 100);
  assertEquals(field.presetIndex, 0, "the first preset should still be holding");
  run(field, 40, 100 * 125);
  assertEquals(field.presetIndex, 1, "the field should have advanced one preset");

  const held = new ExomuxButterchurnField({ gpu: false, audio: scriptedAudio(), presetIndex: 0, autoCycle: false });
  run(held, 400);
  assertEquals(held.presetIndex, 0, "auto-cycle off must leave the opening preset alone");

  // Selection wraps in both directions rather than throwing.
  const wrapping = new ExomuxButterchurnField({ gpu: false, audio: scriptedAudio(), autoCycle: false });
  wrapping.selectPreset(-1);
  assertEquals(wrapping.presetIndex, EXOMUX_BUTTERCHURN_PRESETS.length - 1);
  wrapping.selectPreset(EXOMUX_BUTTERCHURN_PRESETS.length + 2);
  assertEquals(wrapping.presetIndex, 2);
});

Deno.test("butterchurn: clicking the bare desktop skips to the next preset", () => {
  const field = new ExomuxButterchurnField({ gpu: false, audio: scriptedAudio(), presetIndex: 4, autoCycle: false });
  run(field, 20);
  assertEquals(field.presetIndex, 4);

  // The click is claimed, which is what stops the desktop treating it as a
  // plain background click, and it lands on the next preset.
  assertEquals(field.pick(10, 10), true);
  assertEquals(field.presetIndex, 5);
  assertEquals(field.pick(0, 0), true);
  assertEquals(field.presetIndex, 6);

  // It works with auto-cycling off, which is the case where waiting is not an
  // option, and it wraps at the end of the rotation.
  const last = new ExomuxButterchurnField({
    gpu: false,
    audio: scriptedAudio(),
    presetIndex: EXOMUX_BUTTERCHURN_PRESETS.length - 1,
    autoCycle: false,
  });
  last.pick(1, 1);
  assertEquals(last.presetIndex, 0);
});

Deno.test("butterchurn: presets can be stepped in both directions", () => {
  const field = new ExomuxButterchurnField({ gpu: false, audio: scriptedAudio(), presetIndex: 3, autoCycle: false });
  field.selectPreset(field.presetIndex + 1);
  assertEquals(field.presetIndex, 4);
  field.selectPreset(field.presetIndex - 1);
  assertEquals(field.presetIndex, 3);
  field.selectPreset(field.presetIndex - 1);
  assertEquals(field.presetIndex, 2);
  assertEquals(field.presetName, EXOMUX_BUTTERCHURN_PRESETS[2]!.name);
  assertEquals(field.presetCount, EXOMUX_BUTTERCHURN_PRESETS.length);
});

Deno.test("butterchurn: a crossfade draws both presets before settling on the new one", () => {
  const blending = new ExomuxButterchurnField({
    gpu: false,
    audio: scriptedAudio(),
    presetIndex: 0,
    autoCycle: false,
    seed: 4,
  });
  run(blending, 60);
  blending.nextPreset();
  run(blending, 6, 60 * 125);
  assertEquals(blending.presetIndex, 1);

  const straight = new ExomuxButterchurnField({
    gpu: false,
    audio: scriptedAudio(),
    presetIndex: 1,
    autoCycle: false,
    seed: 4,
  });
  run(straight, 66);
  assert(frameText(blending) !== frameText(straight), "a blend in progress is not the destination preset alone");
});

Deno.test("butterchurn: the software fallback never saturates the desktop", () => {
  // The rotation is selected against the GPU renderer, which resolves nearly
  // the whole catalog. The software fallback resolves far fewer of them to an
  // image, so blanks here are expected rather than a defect. What must not
  // happen is a preset whose feedback loop runs away and floods the desktop,
  // because that is both unreadable and unrecoverable.
  let saturated = 0;
  let rendered = 0;
  const cells = BOUNDS.width * BOUNDS.height;
  for (let index = 0; index < EXOMUX_BUTTERCHURN_PRESETS.length; index += 1) {
    const field = new ExomuxButterchurnField({
      gpu: false,
      audio: scriptedAudio({ level: 0.9 }),
      presetIndex: index,
      autoCycle: false,
    });
    run(field, 50);
    // Full coverage is normal — MilkDrop fills the frame. The failure is a
    // flat field of the brightest shade, which carries no image at all.
    let full = 0;
    let painted = 0;
    for (const row of field.rasterizeCells(BOUNDS, THEME)) {
      for (const cell of row) {
        if (!cell) continue;
        painted += 1;
        if (cell.char === "█") full += 1;
      }
    }
    if (full / cells > 0.9) saturated += 1;
    if (painted / cells > 0.02) rendered += 1;
  }
  // The brightness governor is what makes this zero: without it ten presets
  // accumulate into a flat white field, having lost the composite shader that
  // would have held them down.
  assertEquals(saturated, 0, `${saturated} presets saturated the desktop on the software path`);
  assert(rendered > 100, `the software fallback should still render many presets, got ${rendered}`);
});

Deno.test("butterchurn: the output palette stays inside the painter's style cache", () => {
  // The desktop painter caches ANSI styles per colour and drops the whole cache
  // at 8192 entries. Unquantized this field mints hundreds of new colours per
  // tick, which would flush that cache every couple of seconds.
  const field = new ExomuxButterchurnField({ gpu: false, audio: scriptedAudio({ level: 0.9 }) });
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
  assert(palette.size > 8, "a visualizer with under a dozen colours is not rendering a gradient");
  assert(palette.size < 4913, `palette grew past the quantization grid: ${palette.size}`);
});

Deno.test("butterchurn: survives resizing and rejects an empty rect", () => {
  const field = new ExomuxButterchurnField({ gpu: false, audio: scriptedAudio() });
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

Deno.test("butterchurn: the pointer leaves a mark and dispose leaves an injected source alone", () => {
  let closed = false;
  const tracked: ExomuxAudioSource = { ...scriptedAudio({ level: 0.2 }), close: () => (closed = true) };
  const withPointer = new ExomuxButterchurnField({ gpu: false, audio: tracked, autoCycle: false, presetIndex: 0 });
  for (let frame = 0; frame < 30; frame += 1) {
    const now = (frame + 1) * 125;
    withPointer.setPointer({ column: BOUNDS.column + 1, row: BOUNDS.row + 1 }, now);
    withPointer.advance({ bounds: BOUNDS, now });
  }
  assert(withPointer.rasterizeCells(BOUNDS, THEME)[1]![1], "the pointer should deposit ink under the cursor");

  withPointer.clearPointer();
  // The field did not open this source, so it must not close it either.
  withPointer.dispose();
  assertEquals(closed, false);
});

Deno.test("butterchurn: a stalled desktop tick fades rather than freezing", () => {
  const steady = new ExomuxButterchurnField({ gpu: false, audio: scriptedAudio(), autoCycle: false });
  run(steady, 40);
  const before = inkStats(steady).brightness;
  // One 400 ms tick is worth several frames of decay; the field must apply it
  // instead of treating the gap as a single frame and leaving a bright ghost.
  steady.advance({ bounds: BOUNDS, now: 40 * 125 + 400 });
  const after = inkStats(steady).brightness;
  assert(after > 0, "a stall should not blank the field");
  assert(after < before * 1.6, `a stalled tick brightened the field: ${before} -> ${after}`);
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
