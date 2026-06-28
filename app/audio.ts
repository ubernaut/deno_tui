import type { AudioCatalogEntry, AudioMeterSnapshot } from "./types.ts";

type MeterState = {
  process: Deno.ChildProcess | null;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  snapshot: AudioMeterSnapshot;
  active: boolean;
  carry: Uint8Array;
};

export async function discoverAudioSources() {
  try {
    const result = await new Deno.Command("ffmpeg", {
      args: ["-hide_banner", "-f", "pulse", "-sources", "pulse", "-i", "dummy"],
      stdout: "null",
      stderr: "piped",
    }).output();

    const output = new TextDecoder().decode(result.stderr);
    const sources: AudioCatalogEntry[] = [];

    for (const line of output.split("\n")) {
      const match = line.match(/^\s*(\*)?\s*([^\s]+)\s+\[(.+?)\]/);
      if (!match) {
        continue;
      }

      const [, defaultMarker, sourceName, description] = match;
      const role = sourceName.includes(".monitor") || description.startsWith("Monitor of") ? "audio-out" : "audio-in";

      sources.push({
        id: `audio:${sourceName}`,
        sourceName,
        label: role === "audio-out" ? `System: ${description}` : `Mic: ${description}`,
        description,
        role,
        isDefault: defaultMarker === "*",
      });
    }

    return sources.sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      if (a.role !== b.role) {
        return a.role === "audio-in" ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });
  } catch {
    return [] as AudioCatalogEntry[];
  }
}

export class AudioRegistry {
  readonly catalog: AudioCatalogEntry[];
  #meters = new Map<string, MeterState>();

  constructor(catalog: AudioCatalogEntry[]) {
    this.catalog = catalog;
    for (const entry of catalog) {
      this.#meters.set(entry.id, {
        process: null,
        reader: null,
        carry: new Uint8Array(0),
        active: false,
        snapshot: {
          rms: 0,
          peak: 0,
          history: Array.from({ length: 64 }, () => 0),
          active: false,
        },
      });
    }
  }

  getSnapshot(id: string) {
    return this.#meters.get(id)?.snapshot ?? {
      rms: 0,
      peak: 0,
      history: Array.from({ length: 64 }, () => 0),
      active: false,
    };
  }

  setActiveSources(ids: string[]) {
    const active = new Set(ids);
    for (const entry of this.catalog) {
      const meter = this.#meters.get(entry.id);
      if (!meter) {
        continue;
      }
      if (active.has(entry.id)) {
        if (!meter.active) {
          meter.active = true;
          meter.snapshot.active = true;
          void this.#startMeter(entry, meter);
        }
      } else if (meter.active) {
        this.#stopMeter(meter);
      }
    }
  }

  dispose() {
    for (const meter of this.#meters.values()) {
      this.#stopMeter(meter);
    }
  }

  async #startMeter(entry: AudioCatalogEntry, meter: MeterState) {
    if (meter.process) {
      return;
    }

    const process = new Deno.Command("ffmpeg", {
      args: [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "pulse",
        "-i",
        entry.sourceName,
        "-ac",
        "1",
        "-ar",
        "8000",
        "-f",
        "s16le",
        "pipe:1",
      ],
      stdin: "null",
      stdout: "piped",
      stderr: "null",
    }).spawn();

    meter.process = process;
    meter.reader = process.stdout.getReader();
    meter.carry = new Uint8Array(0);

    try {
      while (meter.active && meter.reader) {
        const { value, done } = await meter.reader.read();
        if (done || !value) {
          break;
        }
        this.#updateMeter(meter, value);
      }
    } catch {
      // Ignore stream-level failures and fall back to the last good sample.
    } finally {
      if (meter.reader) {
        try {
          meter.reader.releaseLock();
        } catch {
          // ignore
        }
      }
      meter.reader = null;
      meter.process = null;
      meter.carry = new Uint8Array(0);
      if (meter.active) {
        meter.snapshot.active = false;
      }
    }
  }

  #stopMeter(meter: MeterState) {
    meter.active = false;
    meter.snapshot.active = false;
    meter.snapshot.rms = 0;
    meter.snapshot.peak = 0;
    meter.snapshot.history = meter.snapshot.history.slice(-63);
    meter.snapshot.history.push(0);
    meter.process?.kill("SIGTERM");
    meter.process = null;
    meter.reader = null;
    meter.carry = new Uint8Array(0);
  }

  #updateMeter(meter: MeterState, chunk: Uint8Array) {
    const data = concatUint8Arrays(meter.carry, chunk);
    const sampleLength = data.length - (data.length % 2);
    const view = new DataView(data.buffer, data.byteOffset, sampleLength);

    let sum = 0;
    let peak = 0;
    let samples = 0;

    for (let index = 0; index < sampleLength; index += 2) {
      const sample = view.getInt16(index, true) / 32768;
      const amplitude = Math.abs(sample);
      sum += amplitude * amplitude;
      peak = Math.max(peak, amplitude);
      samples += 1;
    }

    meter.carry = data.slice(sampleLength);

    if (samples === 0) {
      return;
    }

    const rms = Math.sqrt(sum / samples);
    meter.snapshot.rms = rms;
    meter.snapshot.peak = peak;
    meter.snapshot.history = meter.snapshot.history.slice(-63);
    meter.snapshot.history.push(rms);
    meter.snapshot.active = true;
  }
}

function concatUint8Arrays(a: Uint8Array, b: Uint8Array) {
  if (a.length === 0) {
    return b;
  }
  const output = new Uint8Array(a.length + b.length);
  output.set(a);
  output.set(b, a.length);
  return output;
}
