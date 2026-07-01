import { assertEquals } from "./deps.ts";
import { AudioRegistry, type AudioRuntimeOptions, discoverAudioSources } from "../app/audio.ts";
import { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";

Deno.test("discoverAudioSources reports diagnostics when ffmpeg discovery fails", async () => {
  const diagnostics = new DiagnosticsCollector();
  const sources = await discoverAudioSources({
    diagnostics,
    commandFactory: () => {
      throw new Error("ffmpeg missing");
    },
  });

  assertEquals(sources, []);
  assertEquals(diagnostics.entries().map((entry) => [entry.source, entry.code, entry.severity, entry.detail]), [
    ["audio", "discover-failed", "warning", "ffmpeg missing"],
  ]);
});

Deno.test("AudioRegistry reports meter startup failures without leaving the source active", async () => {
  const diagnostics = new DiagnosticsCollector();
  const registry = new AudioRegistry([audioSource()], {
    diagnostics,
    commandFactory: () => ({
      output: async () => ({ stderr: new Uint8Array() }),
      spawn: () => {
        throw new Error("pulse unavailable");
      },
    }),
  });

  registry.setActiveSources(["audio:test"]);
  await tick();

  assertEquals(registry.getSnapshot("audio:test").active, false);
  assertEquals(diagnostics.entries().map((entry) => [entry.code, entry.detail, entry.context?.sourceName]), [
    ["meter-start-failed", "pulse unavailable", "test.monitor"],
  ]);
  registry.dispose();
});

Deno.test("AudioRegistry reports meter stream failures and keeps the last usable sample", async () => {
  const diagnostics = new DiagnosticsCollector();
  const registry = new AudioRegistry([audioSource()], {
    diagnostics,
    commandFactory: () => new FailingStreamCommand(),
  });

  registry.setActiveSources(["audio:test"]);
  await tick();
  await tick();

  const snapshot = registry.getSnapshot("audio:test");
  assertEquals(snapshot.active, false);
  assertEquals(snapshot.history.some((value) => value > 0), true);
  assertEquals(diagnostics.entries().some((entry) => entry.code === "meter-stream-failed"), true);
  registry.dispose();
});

function audioSource() {
  return {
    id: "audio:test",
    sourceName: "test.monitor",
    label: "System: Test",
    description: "Monitor of Test",
    role: "audio-out" as const,
    isDefault: true,
  };
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

class FailingStreamCommand implements ReturnType<NonNullable<AudioRuntimeOptions["commandFactory"]>> {
  output(): Promise<{ stderr: Uint8Array }> {
    return Promise.resolve({ stderr: new Uint8Array() });
  }

  spawn() {
    let sent = false;
    return {
      stdout: new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!sent) {
            sent = true;
            controller.enqueue(new Uint8Array([0xff, 0x7f]));
            return;
          }
          controller.error(new Error("stream broke"));
        },
      }),
      kill() {},
    };
  }
}
