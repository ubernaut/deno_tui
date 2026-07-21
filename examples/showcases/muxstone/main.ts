// Copyright 2023 Im-Beast. MIT license.

import { DiagnosticsCollector } from "../../../mod.ts";
import { createShowcaseTerminalStore } from "../shared/mod.ts";
import { createMuxstoneTerminalApp, type MuxstoneTerminalAppRuntime } from "./app.ts";
import {
  connectOrLaunchMuxstoneLocalHost,
  defaultMuxstoneStateDirectory,
  removeMuxstoneHostDescriptor,
  writeMuxstoneHostDescriptor,
} from "./client.ts";
import { createMuxstoneController, type MuxstoneController } from "./controller.ts";
import { type MuxstoneHostServer, serveMuxstoneHost } from "./host.ts";
import { isMuxstoneAuthToken } from "./protocol.ts";

/** Deliberately small launcher/daemon CLI surface. */
export interface MuxstoneShowcaseLaunchOptions {
  readonly daemon: boolean;
  readonly stateDirectory?: string;
  readonly descriptorPath?: string;
  readonly layoutPath?: string;
  readonly persistLayout: boolean;
}

/** Parses Muxstone options without performing filesystem or network I/O. */
export function parseMuxstoneShowcaseArgs(args: readonly string[]): MuxstoneShowcaseLaunchOptions {
  let daemon = false;
  let stateDirectory: string | undefined;
  let descriptorPath: string | undefined;
  let layoutPath: string | undefined;
  let persistLayout = true;
  for (const argument of args) {
    if (argument === "--daemon") daemon = true;
    else if (argument === "--memory") persistLayout = false;
    else if (argument === "--persist") persistLayout = true;
    else if (argument.startsWith("--state-dir=")) stateDirectory = requiredOption(argument, "--state-dir=");
    else if (argument.startsWith("--descriptor=")) descriptorPath = requiredOption(argument, "--descriptor=");
    else if (argument.startsWith("--layout-file=")) {
      layoutPath = requiredOption(argument, "--layout-file=");
      persistLayout = true;
    } else throw new TypeError(`Unknown Muxstone option: ${argument}`);
  }
  return Object.freeze({
    daemon,
    persistLayout,
    ...(stateDirectory ? { stateDirectory } : {}),
    ...(descriptorPath ? { descriptorPath } : {}),
    ...(layoutPath ? { layoutPath } : {}),
  });
}

/** Runs either the persistent local host or its detachable terminal workbench client. */
export async function runMuxstoneShowcase(options: MuxstoneShowcaseLaunchOptions): Promise<void> {
  if (options.daemon) {
    await runMuxstoneDaemon(options);
    return;
  }
  await runMuxstoneClient(options);
}

/** Starts the UI client; destroying it never shuts down the detached host. */
export async function runMuxstoneClient(options: MuxstoneShowcaseLaunchOptions): Promise<void> {
  const stateDirectory = options.stateDirectory ?? defaultMuxstoneStateDirectory();
  const descriptorPath = options.descriptorPath ?? joinPath(stateDirectory, "host.json");
  const diagnostics = new DiagnosticsCollector();
  const connection = await connectOrLaunchMuxstoneLocalHost({ stateDirectory, descriptorPath });
  const layoutPath = options.persistLayout ? options.layoutPath ?? joinPath(stateDirectory, "layout.json") : undefined;
  const storage = await createShowcaseTerminalStore({
    enabled: options.persistLayout,
    path: layoutPath,
    diagnostics,
  });
  const controller = await createMuxstoneController({
    client: connection.client,
    store: storage.store,
    diagnostics,
    persistenceDebounceMs: storage.inspect().durable ? 120 : 0,
  });
  const connectionStatus = connection.launched
    ? "Detached host launched · terminals survive UI exit · Ctrl-B ? commands"
    : "Reattached to detached host · Ctrl-B ? commands";
  await launchInitialMuxstoneTerminalIfEmpty(controller, connectionStatus);
  const runtime = await createMuxstoneTerminalApp({ controller });
  bindAwaitedMuxstoneClientShutdown(runtime);
  runtime.start();
}

/** Launches the default floating shell only when the persistent host is empty. */
export async function launchInitialMuxstoneTerminalIfEmpty(
  controller: MuxstoneController,
  connectionStatus: string,
): Promise<boolean> {
  if (controller.sessions.peek().length > 0) {
    controller.status.value = connectionStatus;
    return false;
  }
  const firstTerminal = await controller.spawn();
  controller.status.value = firstTerminal
    ? `${connectionStatus} · floating terminal ready`
    : `${connectionStatus} · ${controller.status.peek()}`;
  return firstTerminal !== undefined;
}

/** Runs the retaining host until an authenticated shutdown or process signal. */
export async function runMuxstoneDaemon(options: MuxstoneShowcaseLaunchOptions): Promise<void> {
  const stateDirectory = options.stateDirectory ?? defaultMuxstoneStateDirectory();
  const descriptorPath = options.descriptorPath ?? joinPath(stateDirectory, "host.json");
  let authToken: string | undefined;
  try {
    authToken = Deno.env.get("MUXSTONE_TOKEN");
    Deno.env.delete("MUXSTONE_TOKEN");
  } catch {
    authToken = undefined;
  }
  if (!isMuxstoneAuthToken(authToken)) throw new TypeError("Muxstone daemon requires a valid private startup token.");

  const server = serveMuxstoneHost({ authToken });
  const address = await server.address;
  await writeMuxstoneHostDescriptor(descriptorPath, {
    schemaVersion: 1,
    flowControlledReplay: true,
    hostId: server.controller.id,
    url: address.url,
    token: authToken,
    pid: Deno.pid,
    startedAt: Date.now(),
  });
  const unbind = bindMuxstoneDaemonSignals(server);
  try {
    await server.finished;
  } finally {
    unbind();
    await removeMuxstoneHostDescriptor(descriptorPath, server.controller.id);
  }
}

function bindAwaitedMuxstoneClientShutdown(runtime: MuxstoneTerminalAppRuntime): void {
  const signals: Deno.Signal[] = Deno.build.os === "windows" ? ["SIGINT", "SIGBREAK"] : ["SIGINT", "SIGTERM"];
  let shutdown: Promise<void> | undefined;
  const removeSignals = () => {
    for (const signal of signals) {
      try {
        Deno.removeSignalListener(signal, requestShutdown);
      } catch {
        // Listener was unavailable or already removed.
      }
    }
  };
  const requestShutdown = () => {
    shutdown ??= (async () => {
      removeSignals();
      await runtime.destroy();
      Deno.exit(0);
    })();
    void shutdown;
  };
  for (const signal of signals) Deno.addSignalListener(signal, requestShutdown);
  runtime.app.tui.on("destroy", requestShutdown);
}

function bindMuxstoneDaemonSignals(server: MuxstoneHostServer): () => void {
  const signals: Deno.Signal[] = Deno.build.os === "windows" ? ["SIGINT", "SIGBREAK"] : ["SIGINT", "SIGTERM"];
  const shutdown = () => void server.shutdown();
  for (const signal of signals) Deno.addSignalListener(signal, shutdown);
  return () => {
    for (const signal of signals) {
      try {
        Deno.removeSignalListener(signal, shutdown);
      } catch {
        // Listener was unavailable or already removed.
      }
    }
  };
}

function requiredOption(argument: string, prefix: string): string {
  const value = argument.slice(prefix.length);
  if (!value || value.includes("\0")) throw new TypeError(`Muxstone option ${prefix.slice(0, -1)} needs a path.`);
  return value;
}

function joinPath(parent: string, child: string): string {
  const separator = Deno.build.os === "windows" ? "\\" : "/";
  return `${parent.replace(/[\\/]+$/g, "")}${separator}${child}`;
}

if (import.meta.main) await runMuxstoneShowcase(parseMuxstoneShowcaseArgs(Deno.args));
