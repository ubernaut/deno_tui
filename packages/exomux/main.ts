// Copyright 2023 Im-Beast. MIT license.

import { DiagnosticsCollector } from "@ubernaut/deno-tui";
import { createShowcaseTerminalStore } from "@showcase/kit";
import { createExomuxTerminalApp, type ExomuxTerminalAppRuntime } from "./app.ts";
import {
  connectOrLaunchExomuxLocalHost,
  defaultExomuxStateDirectory,
  removeExomuxHostDescriptor,
  writeExomuxHostDescriptor,
} from "./client.ts";
import { createExomuxController, type ExomuxController } from "./controller.ts";
import { type ExomuxHostServer, serveExomuxHost } from "./host.ts";
import { isExomuxAuthToken } from "./protocol.ts";

/** Deliberately small launcher/daemon CLI surface. */
export interface ExomuxShowcaseLaunchOptions {
  readonly daemon: boolean;
  readonly stateDirectory?: string;
  readonly descriptorPath?: string;
  readonly layoutPath?: string;
  readonly persistLayout: boolean;
}

/** Parses Exomux options without performing filesystem or network I/O. */
export function parseExomuxShowcaseArgs(args: readonly string[]): ExomuxShowcaseLaunchOptions {
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
    } else throw new TypeError(`Unknown Exomux option: ${argument}`);
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
export async function runExomuxShowcase(options: ExomuxShowcaseLaunchOptions): Promise<void> {
  if (options.daemon) {
    await runExomuxDaemon(options);
    return;
  }
  await runExomuxClient(options);
}

/** Starts the UI client; destroying it never shuts down the detached host. */
export async function runExomuxClient(options: ExomuxShowcaseLaunchOptions): Promise<void> {
  const stateDirectory = options.stateDirectory ?? defaultExomuxStateDirectory();
  const descriptorPath = options.descriptorPath ?? joinPath(stateDirectory, "host.json");
  const diagnostics = new DiagnosticsCollector();
  const connection = await connectOrLaunchExomuxLocalHost({ stateDirectory, descriptorPath });
  const layoutPath = options.persistLayout ? options.layoutPath ?? joinPath(stateDirectory, "layout.json") : undefined;
  const storage = await createShowcaseTerminalStore({
    enabled: options.persistLayout,
    path: layoutPath,
    diagnostics,
  });
  const controller = await createExomuxController({
    client: connection.client,
    store: storage.store,
    diagnostics,
    persistenceDebounceMs: storage.inspect().durable ? 120 : 0,
  });
  const connectionStatus = connection.launched
    ? "Detached host launched · terminals survive UI exit · Ctrl-N ? commands"
    : "Reattached to detached host · Ctrl-N ? commands";
  await launchInitialExomuxTerminalIfEmpty(controller, connectionStatus);
  const runtime = await createExomuxTerminalApp({ controller });
  bindAwaitedExomuxClientShutdown(runtime);
  runtime.start();
}

/** Launches the default floating shell only when the persistent host is empty. */
export async function launchInitialExomuxTerminalIfEmpty(
  controller: ExomuxController,
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
export async function runExomuxDaemon(options: ExomuxShowcaseLaunchOptions): Promise<void> {
  const stateDirectory = options.stateDirectory ?? defaultExomuxStateDirectory();
  const descriptorPath = options.descriptorPath ?? joinPath(stateDirectory, "host.json");
  let authToken: string | undefined;
  try {
    authToken = Deno.env.get("EXOMUX_TOKEN");
    Deno.env.delete("EXOMUX_TOKEN");
  } catch {
    authToken = undefined;
  }
  if (!isExomuxAuthToken(authToken)) throw new TypeError("Exomux daemon requires a valid private startup token.");

  const server = serveExomuxHost({ authToken });
  const address = await server.address;
  await writeExomuxHostDescriptor(descriptorPath, {
    schemaVersion: 1,
    flowControlledReplay: true,
    hostId: server.controller.id,
    url: address.url,
    token: authToken,
    pid: Deno.pid,
    startedAt: Date.now(),
  });
  const unbind = bindExomuxDaemonSignals(server);
  try {
    await server.finished;
  } finally {
    unbind();
    await removeExomuxHostDescriptor(descriptorPath, server.controller.id);
  }
}

function bindAwaitedExomuxClientShutdown(runtime: ExomuxTerminalAppRuntime): void {
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

function bindExomuxDaemonSignals(server: ExomuxHostServer): () => void {
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
  if (!value || value.includes("\0")) throw new TypeError(`Exomux option ${prefix.slice(0, -1)} needs a path.`);
  return value;
}

function joinPath(parent: string, child: string): string {
  const separator = Deno.build.os === "windows" ? "\\" : "/";
  return `${parent.replace(/[\\/]+$/g, "")}${separator}${child}`;
}

if (import.meta.main) await runExomuxShowcase(parseExomuxShowcaseArgs(Deno.args));
