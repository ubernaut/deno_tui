import type { AudioCatalogEntry, AudioMeterSnapshot } from "./types.ts";
import type { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";

interface AudioCommandOutput {
  stderr: Uint8Array;
}

interface AudioMeterProcess {
  stdout: ReadableStream<Uint8Array>;
  kill(signal?: Deno.Signal): void;
}

interface AudioCommand {
  output(): Promise<AudioCommandOutput>;
  spawn(): AudioMeterProcess;
}

export interface AudioRuntimeOptions {
  diagnostics?: DiagnosticsCollector;
  commandFactory?: (command: string, options: Deno.CommandOptions) => AudioCommand;
}

type MeterState = {
  process: AudioMeterProcess | null;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  snapshot: AudioMeterSnapshot;
  active: boolean;
  carry: Uint8Array;
};

export async function discoverAudioSources(options: AudioRuntimeOptions = {}) {
  try {
    const result = await audioCommand(options, "ffmpeg", {
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
  } catch (error) {
    options.diagnostics?.report({
      source: "audio",
      code: "discover-failed",
      severity: "warning",
      message: "Audio source discovery failed",
      detail: errorDetail(error),
    });
    return [] as AudioCatalogEntry[];
  }
}

export class AudioRegistry {
  readonly catalog: AudioCatalogEntry[];
  #meters = new Map<string, MeterState>();
  #diagnostics?: DiagnosticsCollector;
  #commandFactory?: AudioRuntimeOptions["commandFactory"];

  constructor(catalog: AudioCatalogEntry[], options: AudioRuntimeOptions = {}) {
    this.catalog = catalog;
    this.#diagnostics = options.diagnostics;
    this.#commandFactory = options.commandFactory;
    for (const entry of catalog) {
      this.#meters.set(entry.id, {
        process: null,
        reader: null,
        carry: new Uint8Array(0),
        active: false,
        snapshot: {
          rms: 0,
          peak: 0,
          history: zeroHistory(64),
          active: false,
        },
      });
    }
  }

  getSnapshot(id: string) {
    return this.#meters.get(id)?.snapshot ?? {
      rms: 0,
      peak: 0,
      history: zeroHistory(64),
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

    let process: AudioMeterProcess;
    try {
      process = audioCommand({ commandFactory: this.#commandFactory }, "ffmpeg", {
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
    } catch (error) {
      this.#diagnostics?.report({
        source: "audio",
        code: "meter-start-failed",
        severity: "warning",
        message: "Audio meter failed to start",
        detail: errorDetail(error),
        context: { sourceName: entry.sourceName },
      });
      meter.active = false;
      meter.snapshot.active = false;
      return;
    }

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
    } catch (error) {
      this.#diagnostics?.report({
        source: "audio",
        code: "meter-stream-failed",
        severity: "warning",
        message: "Audio meter stream failed",
        detail: errorDetail(error),
        context: { sourceName: entry.sourceName },
      });
    } finally {
      if (meter.reader) {
        try {
          meter.reader.releaseLock();
        } catch (error) {
          this.#diagnostics?.report({
            source: "audio",
            code: "meter-release-failed",
            severity: "debug",
            message: "Audio meter reader release failed",
            detail: errorDetail(error),
            context: { sourceName: entry.sourceName },
          });
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
    pushAudioHistory(meter.snapshot.history, 0);
    try {
      meter.process?.kill("SIGTERM");
    } catch (error) {
      this.#diagnostics?.report({
        source: "audio",
        code: "meter-stop-failed",
        severity: "debug",
        message: "Audio meter stop failed",
        detail: errorDetail(error),
      });
    }
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
    pushAudioHistory(meter.snapshot.history, rms);
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

function audioCommand(
  options: AudioRuntimeOptions,
  command: string,
  commandOptions: Deno.CommandOptions,
): AudioCommand {
  return options.commandFactory?.(command, commandOptions) ?? new Deno.Command(command, commandOptions);
}

function zeroHistory(length: number): number[] {
  return new Array<number>(length).fill(0);
}

function pushAudioHistory(history: number[], value: number): void {
  if (history.length === 0) {
    history.push(value);
    return;
  }
  for (let index = 1; index < history.length; index += 1) {
    history[index - 1] = history[index] ?? 0;
  }
  history[history.length - 1] = value;
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
