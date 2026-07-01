import { assertEquals } from "./deps.ts";
import type {
  TerminalBackend,
  TerminalBackendSpawnOptions,
  TerminalSessionHandle,
} from "../src/runtime/terminal_backend.ts";
import { resolveWorkbenchShellBackend } from "../src/app/workbench/mod.ts";

Deno.test("resolveWorkbenchShellBackend prefers an available PTY backend", async () => {
  const ptyBackend = fakeBackend("fake-pty", true);
  const resolution = await resolveWorkbenchShellBackend({
    ptyFactory: () => ptyBackend,
    processFactory: () => fakeBackend("process", false),
  });

  assertEquals(resolution.backend, ptyBackend);
  assertEquals(resolution.fallback, false);
  assertEquals(resolution.reason, undefined);
});

Deno.test("resolveWorkbenchShellBackend falls back to process backend with a reason", async () => {
  const fallbackMessages: string[] = [];
  const processBackend = fakeBackend("process", false);
  const resolution = await resolveWorkbenchShellBackend({
    ptyFactory: () => {
      throw new Error("pty library unavailable");
    },
    processFactory: () => processBackend,
    onFallback: (message) => fallbackMessages.push(message),
  });

  assertEquals(resolution.backend, processBackend);
  assertEquals(resolution.fallback, true);
  assertEquals(resolution.reason, "pty library unavailable");
  assertEquals(fallbackMessages, ["pty library unavailable"]);
});

function fakeBackend(id: string, pty: boolean): TerminalBackend {
  return {
    id,
    label: id,
    pty,
    spawn(_options: TerminalBackendSpawnOptions): TerminalSessionHandle {
      throw new Error("not used");
    },
  };
}
