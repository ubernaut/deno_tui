// Copyright 2023 Im-Beast. MIT license.

// System-microphone analyser for reactive Exomux backgrounds.
//
// Ported from butterchurnxr's `asciichurn/audio.ts`. Raw PCM is captured from
// the first CLI recorder that produces samples (parec, pw-record, arecord),
// kept in a ring buffer, and reduced per frame to log-spaced spectrum bands,
// bass/mid/treble energy, a decimated waveform, and beat pulses.
//
// Capture is refcounted and lazy: nothing spawns until a background asks for
// audio, and the recorder is killed once the last reader releases it. When no
// recorder works — no microphone, no `--allow-run`, a headless host — the
// analyser synthesizes a musical signal so reactive fields keep moving instead
// of freezing on a silent screen.

const SAMPLE_RATE = 44_100;
const FFT_SIZE = 2_048;
const RING_SIZE = FFT_SIZE * 4;
const MIN_FREQ = 35;
const MAX_FREQ = 12_000;
const MIN_DB = -62;
const MAX_DB = -14;
/** Milliseconds to wait for a recorder's first bytes before trying the next. */
const FIRST_DATA_TIMEOUT_MS = 2_000;

/** Spectrum bands published on every frame. */
export const EXOMUX_AUDIO_BANDS = 24;
/** Waveform samples published on every frame. */
export const EXOMUX_AUDIO_WAVEFORM = 256;

/** Where the current frame's numbers came from. */
export type ExomuxAudioSourceKind = "starting" | "mic" | "synth";

/** One analysed slice of the incoming signal. All energies are 0..1. */
export interface ExomuxAudioFrame {
  /** Overall loudness. */
  readonly level: number;
  /** Low-band energy (< 160 Hz). */
  readonly bass: number;
  /** Mid-band energy (160 Hz .. 2 kHz). */
  readonly mid: number;
  /** High-band energy (> 2 kHz). */
  readonly treble: number;
  /** Smoothed log-spaced spectrum, `EXOMUX_AUDIO_BANDS` entries. */
  readonly bands: Float32Array;
  /** Recent time-domain samples in -1..1, `EXOMUX_AUDIO_WAVEFORM` entries. */
  readonly waveform: Float32Array;
  /** True on frames where a bass transient was detected. */
  readonly beat: boolean;
  readonly source: ExomuxAudioSourceKind;
}

/**
 * Pull-based audio source. Backgrounds call `frame()` once per tick; the
 * returned arrays are reused between calls and must not be retained.
 */
export interface ExomuxAudioSource {
  frame(now?: number): ExomuxAudioFrame;
  /** Short status label, e.g. `mic:parec` or `synth`. */
  label(): string;
  /** Releases this reader's claim on the capture process. */
  close(): void;
}

/**
 * Environment override naming the capture device.
 *
 * Without it each recorder uses the system default, which is not always a
 * microphone: on a PipeWire desktop the default source is often the monitor of
 * an output, so an idle machine records digital silence. Pointing this at a
 * source name (`pactl list sources short`) selects a real input — or, if that
 * is what you want, the monitor of whatever is playing.
 */
export const EXOMUX_AUDIO_DEVICE_ENV = "EXOMUX_AUDIO_DEVICE";

interface RecorderCandidate {
  readonly name: string;
  readonly args: readonly string[];
  /** Flag this recorder uses to select a capture device. */
  readonly deviceFlag: string;
  /** Extra arguments that point this recorder at the system output instead. */
  readonly monitorArgs?: readonly string[];
}

const RECORDERS: readonly RecorderCandidate[] = Object.freeze([
  Object.freeze({
    name: "parec",
    args: Object.freeze(["--format=s16le", `--rate=${SAMPLE_RATE}`, "--channels=1", "--latency-msec=30"]),
    deviceFlag: "-d",
    monitorArgs: Object.freeze(["-d", "@DEFAULT_MONITOR@"]),
  }),
  Object.freeze({
    name: "pw-record",
    args: Object.freeze(["--format", "s16", "--rate", `${SAMPLE_RATE}`, "--channels", "1", "-"]),
    deviceFlag: "--target",
    monitorArgs: Object.freeze(["-P", "stream.capture.sink=true"]),
  }),
  Object.freeze({
    name: "arecord",
    args: Object.freeze(["-f", "S16_LE", "-r", `${SAMPLE_RATE}`, "-c", "1", "-t", "raw", "-q"]),
    deviceFlag: "-D",
  }),
]);

/** The configured capture device, or undefined when the default should be used. */
function configuredDevice(): string | undefined {
  try {
    return Deno.env.get(EXOMUX_AUDIO_DEVICE_ENV) || undefined;
  } catch {
    // No `--allow-env`; fall back to the recorder's own default.
    return undefined;
  }
}

/** In-place radix-2 FFT; `re`/`im` must be the same power-of-two length. */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = -2 * Math.PI / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curR = 1;
      let curI = 0;
      for (let j = 0; j < half; j += 1) {
        const a = i + j;
        const b = a + half;
        const vr = re[b]! * curR - im[b]! * curI;
        const vi = re[b]! * curI + im[b]! * curR;
        re[b] = re[a]! - vr;
        im[b] = im[a]! - vi;
        re[a] = re[a]! + vr;
        im[a] = im[a]! + vi;
        const nr = curR * wr - curI * wi;
        curI = curR * wi + curI * wr;
        curR = nr;
      }
    }
  }
}

function clamp01(value: number): number {
  return value > 1 ? 1 : value < 0 ? 0 : value;
}

/**
 * Creates an independent analyser with its own recorder process. Most callers
 * want `acquireExomuxAudio` instead, which shares one capture between fields.
 */
/** What the analyser should listen to. */
export type ExomuxAudioCaptureMode = "mic" | "system" | "synth";

export interface ExomuxAudioSourceOptions {
  /**
   * "mic" records the default input; "system" the monitor of the default
   * output, so the field visualizes whatever is playing; "synth" spawns no
   * recorder at all and runs on the generated signal.
   */
  readonly mode?: ExomuxAudioCaptureMode;
}

export function createExomuxAudioSource(options: ExomuxAudioSourceOptions = {}): ExomuxAudioSource {
  const mode: ExomuxAudioCaptureMode = options.mode ?? "mic";
  const ring = new Float32Array(RING_SIZE);
  let ringWrite = 0;
  let totalSamples = 0;
  let source: ExomuxAudioSourceKind = "starting";
  let recorderName = "";
  let recorder: Deno.ChildProcess | undefined;
  let closed = false;

  const hann = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i += 1) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));

  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);

  // Log-spaced band edges expressed as FFT bin indices.
  const binHz = SAMPLE_RATE / FFT_SIZE;
  const bandEdges = new Int32Array(EXOMUX_AUDIO_BANDS + 1);
  for (let i = 0; i <= EXOMUX_AUDIO_BANDS; i += 1) {
    const freq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, i / EXOMUX_AUDIO_BANDS);
    bandEdges[i] = Math.max(1, Math.min(FFT_SIZE / 2 - 1, Math.round(freq / binHz)));
  }
  const bandFreq = (band: number): number =>
    MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, (band + 0.5) / EXOMUX_AUDIO_BANDS);

  const rawBands = new Float32Array(EXOMUX_AUDIO_BANDS);
  const bands = new Float32Array(EXOMUX_AUDIO_BANDS);
  const waveform = new Float32Array(EXOMUX_AUDIO_WAVEFORM);
  let level = 0;
  let bassAverage = 0.08;
  let beatCooldown = 0;
  let lastFrameAt: number | undefined;
  let synthTime = 0;
  let synthBeatClock = 0;

  function pushSamples(bytes: Uint8Array, carry: { byte: number | undefined }): void {
    let start = 0;
    if (carry.byte !== undefined && bytes.length > 0) {
      const value = (bytes[0]! << 8) | carry.byte;
      ring[ringWrite] = ((value << 16) >> 16) / 32_768;
      ringWrite = (ringWrite + 1) % RING_SIZE;
      totalSamples += 1;
      carry.byte = undefined;
      start = 1;
    }
    const usable = bytes.length - start;
    const pairs = usable >> 1;
    for (let i = 0; i < pairs; i += 1) {
      const lo = bytes[start + i * 2]!;
      const hi = bytes[start + i * 2 + 1]!;
      ring[ringWrite] = ((((hi << 8) | lo) << 16) >> 16) / 32_768;
      ringWrite = (ringWrite + 1) % RING_SIZE;
      totalSamples += 1;
    }
    if (usable & 1) carry.byte = bytes[bytes.length - 1]!;
  }

  async function readStream(process: Deno.ChildProcess): Promise<void> {
    const carry: { byte: number | undefined } = { byte: undefined };
    const reader = process.stdout.getReader();
    try {
      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) pushSamples(value, carry);
      }
    } finally {
      reader.releaseLock();
    }
  }

  async function startCapture(): Promise<void> {
    const device = configuredDevice();
    for (const candidate of RECORDERS) {
      if (closed) return;
      // System mode uses each recorder's own way of reaching the output
      // monitor; a recorder with none is skipped rather than silently
      // recording the microphone instead.
      if (mode === "system" && !candidate.monitorArgs && !device) continue;
      const extra = device ? [candidate.deviceFlag, device] : mode === "system" ? [...candidate.monitorArgs!] : [];
      let process: Deno.ChildProcess;
      try {
        process = new Deno.Command(candidate.name, {
          args: [...candidate.args, ...extra],
          stdin: "null",
          stdout: "piped",
          stderr: "null",
        }).spawn();
      } catch {
        // Missing binary, or no `--allow-run` for it. Try the next recorder.
        continue;
      }

      const before = totalSamples;
      const streaming = readStream(process).catch(() => {});
      const deadline = performance.now() + FIRST_DATA_TIMEOUT_MS;
      while (!closed && totalSamples === before && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (totalSamples > before && !closed) {
        recorder = process;
        recorderName = candidate.name;
        source = "mic";
        await streaming;
        // The recorder exited: device unplugged, audio daemon restarted, ...
        if (closed) return;
        recorder = undefined;
        source = "starting";
        continue;
      }

      try {
        process.kill();
      } catch {
        // Already gone.
      }
      await process.status.catch(() => {});
    }
    if (!closed && source !== "mic") source = "synth";
  }

  // Attached here rather than in `close`: a recorder that fails before anything
  // releases the analyser would otherwise be an unhandled rejection, which
  // takes the desktop down over a missing audio device.
  const capturing = mode === "synth" ? Promise.resolve(source = "synth" as const) : startCapture().catch(() => {
    if (!closed) source = "synth";
  });

  function analyseMic(): void {
    const offset = (ringWrite - FFT_SIZE + RING_SIZE) % RING_SIZE;
    let sumSquares = 0;
    for (let i = 0; i < FFT_SIZE; i += 1) {
      const sample = ring[(offset + i) % RING_SIZE]!;
      sumSquares += sample * sample;
      re[i] = sample * hann[i]!;
      im[i] = 0;
    }
    fft(re, im);

    for (let band = 0; band < EXOMUX_AUDIO_BANDS; band += 1) {
      const from = bandEdges[band]!;
      const to = Math.max(from + 1, bandEdges[band + 1]!);
      let peak = 0;
      for (let bin = from; bin < to; bin += 1) {
        const magnitude = Math.hypot(re[bin]!, im[bin]!) * (2 / FFT_SIZE);
        if (magnitude > peak) peak = magnitude;
      }
      const db = 20 * Math.log10(peak + 1e-9);
      rawBands[band] = clamp01((db - MIN_DB) / (MAX_DB - MIN_DB));
    }

    const rms = Math.sqrt(sumSquares / FFT_SIZE);
    level = clamp01((20 * Math.log10(rms + 1e-9) - MIN_DB) / (MAX_DB - MIN_DB));

    // Newest samples, decimated to the published waveform length.
    const step = FFT_SIZE / EXOMUX_AUDIO_WAVEFORM;
    for (let i = 0; i < EXOMUX_AUDIO_WAVEFORM; i += 1) {
      waveform[i] = ring[(offset + Math.floor(i * step)) % RING_SIZE]!;
    }
  }

  function analyseSynth(dt: number): void {
    synthTime += dt;
    synthBeatClock += dt;
    const pulse = synthBeatClock > 0.62;
    if (pulse) synthBeatClock = 0;
    for (let band = 0; band < EXOMUX_AUDIO_BANDS; band += 1) {
      const wobble = 0.5 +
        0.28 * Math.sin(synthTime * (0.7 + band * 0.13) + band * 1.7) +
        0.18 * Math.sin(synthTime * (1.9 + band * 0.07) + band * 0.6);
      const rolloff = 1 - band / (EXOMUX_AUDIO_BANDS * 1.6);
      rawBands[band] = clamp01(wobble * rolloff * 0.75 + (pulse && band < 5 ? 0.45 : 0));
    }
    level = clamp01(0.35 + 0.2 * Math.sin(synthTime * 0.9) + (pulse ? 0.25 : 0));

    const kick = Math.max(0, 1 - synthBeatClock / 0.16);
    for (let i = 0; i < EXOMUX_AUDIO_WAVEFORM; i += 1) {
      const t = synthTime - (EXOMUX_AUDIO_WAVEFORM - i) / SAMPLE_RATE * 64;
      waveform[i] = Math.sin(t * Math.PI * 2 * 55) * (0.22 + kick * 0.34) +
        Math.sin(t * Math.PI * 2 * 173) * 0.16 +
        Math.sin(t * Math.PI * 2 * 811) * 0.08;
    }
  }

  function frame(now = performance.now()): ExomuxAudioFrame {
    const dt = lastFrameAt === undefined ? 0.125 : Math.min(0.25, Math.max(0.001, (now - lastFrameAt) / 1000));
    lastFrameAt = now;

    if (source === "mic" && totalSamples >= FFT_SIZE) {
      analyseMic();
    } else if (source === "synth") {
      analyseSynth(dt);
    } else {
      rawBands.fill(0);
      waveform.fill(0);
      level = 0;
    }

    // Fast attack, slow release: transients read as hits, tails as glow.
    for (let band = 0; band < EXOMUX_AUDIO_BANDS; band += 1) {
      const target = rawBands[band]!;
      const rate = target > bands[band]! ? 22 : 5;
      bands[band] = bands[band]! + (target - bands[band]!) * Math.min(1, rate * dt);
    }

    let bass = 0;
    let bassCount = 0;
    let mid = 0;
    let midCount = 0;
    let treble = 0;
    let trebleCount = 0;
    for (let band = 0; band < EXOMUX_AUDIO_BANDS; band += 1) {
      const freq = bandFreq(band);
      if (freq < 160) {
        bass += bands[band]!;
        bassCount += 1;
      } else if (freq < 2_000) {
        mid += bands[band]!;
        midCount += 1;
      } else {
        treble += bands[band]!;
        trebleCount += 1;
      }
    }
    bass /= Math.max(1, bassCount);
    mid /= Math.max(1, midCount);
    treble /= Math.max(1, trebleCount);

    beatCooldown = Math.max(0, beatCooldown - dt);
    let beat = false;
    if (beatCooldown === 0 && bass > 0.18 && bass > bassAverage * 1.45) {
      beat = true;
      beatCooldown = 0.18;
    }
    bassAverage += (bass - bassAverage) * Math.min(1, 1.4 * dt);

    return { level, bass, mid, treble, bands, waveform, beat, source };
  }

  return {
    frame,
    label: () => {
      if (source !== "mic") return source;
      const device = configuredDevice();
      return device ? `mic:${recorderName}:${device}` : `mic:${recorderName}`;
    },
    close: () => {
      if (closed) return;
      closed = true;
      try {
        recorder?.kill();
      } catch {
        // Already gone.
      }
      void capturing;
    },
  };
}

let sharedSource: ExomuxAudioSource | undefined;
let sharedMode: ExomuxAudioCaptureMode = "mic";
let sharedReaders = 0;

/**
 * Shared microphone capture. Every caller gets a handle onto one recorder
 * process; the process starts on the first acquire and is killed when the last
 * handle closes, so selecting a non-reactive background stops recording.
 */
export function acquireExomuxAudio(mode: ExomuxAudioCaptureMode = "mic"): ExomuxAudioSource {
  // The shared capture keeps the mode of its first reader; a field wanting a
  // different one gets it once the current capture's last reader releases,
  // which is what happens when a field is rebuilt over a settings change.
  if (!sharedSource) sharedMode = mode;
  sharedReaders += 1;
  const shared = sharedSource ??= createExomuxAudioSource({ mode: sharedMode });
  let released = false;
  return {
    frame: (now) => shared.frame(now),
    label: () => shared.label(),
    close: () => {
      if (released) return;
      released = true;
      sharedReaders -= 1;
      if (sharedReaders > 0) return;
      sharedSource = undefined;
      shared.close();
    },
  };
}

// Standalone probe: `deno run -A audio.ts`
if (import.meta.main) {
  const analyser = createExomuxAudioSource();
  console.log("capturing... (3s)");
  const startedAt = performance.now();
  const timer = setInterval(() => {
    const audio = analyser.frame();
    const bar = Array.from(audio.bands, (value) => " .:-=+*#%@"[Math.min(9, Math.floor(value * 10))]).join("");
    console.log(
      `[${audio.source.padEnd(7)}] level=${audio.level.toFixed(2)} bass=${audio.bass.toFixed(2)} ` +
        `mid=${audio.mid.toFixed(2)} treble=${audio.treble.toFixed(2)} ${audio.beat ? "BEAT" : "    "} |${bar}|`,
    );
    if (performance.now() - startedAt > 3_000) {
      clearInterval(timer);
      analyser.close();
    }
  }, 200);
}
