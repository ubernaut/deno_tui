// Copyright 2023 Im-Beast. MIT license.
import {
  createProcessTerminalBackend,
  type ProcessTerminalBackendOptions,
  type TerminalBackend,
} from "./terminal_backend.ts";
import type { DiagnosticsCollector } from "./diagnostics.ts";

type MaybePromise<T> = T | Promise<T>;

/** Availability information for a terminal backend provider. */
export interface TerminalBackendAvailability {
  available: boolean;
  reason?: string;
  backendId?: string;
  label?: string;
  pty?: boolean;
  detachable?: boolean;
  reconnectable?: boolean;
}

/** Lazy terminal backend provider registered with a TerminalBackendRegistry. */
export interface TerminalBackendProvider {
  id: string;
  label: string;
  pty: boolean;
  priority?: number;
  detachable?: boolean;
  reconnectable?: boolean;
  probe?: () => MaybePromise<TerminalBackendAvailability>;
  create: () => MaybePromise<TerminalBackend>;
}

/** Serializable inspection entry for a registered terminal backend provider. */
export interface TerminalBackendProviderInspection extends TerminalBackendAvailability {
  id: string;
  label: string;
  pty: boolean;
  priority: number;
  detachable: boolean;
  reconnectable: boolean;
}

/** Options for resolving a backend from a registry. */
export interface TerminalBackendResolveOptions {
  id?: string;
  preferPty?: boolean;
  requirePty?: boolean;
}

/** Options for the default terminal backend registry. */
export interface DefaultTerminalBackendRegistryOptions {
  process?: ProcessTerminalBackendOptions | false;
  diagnostics?: DiagnosticsCollector;
}

/** Registry for optional process, PTY, tmux, and remote terminal backend providers. */
export class TerminalBackendRegistry {
  readonly #providers = new Map<string, TerminalBackendProvider>();
  readonly #diagnostics?: DiagnosticsCollector;
  #ids?: string[];
  #providersSnapshot?: TerminalBackendProvider[];
  #sortedProviders?: TerminalBackendProvider[];
  #sortedPtyProviders?: TerminalBackendProvider[];

  constructor(
    providers: readonly TerminalBackendProvider[] = [],
    options: { diagnostics?: DiagnosticsCollector } = {},
  ) {
    this.#diagnostics = options.diagnostics;
    for (const provider of providers) this.register(provider);
  }

  register(provider: TerminalBackendProvider): this {
    this.#providers.set(provider.id, normalizeTerminalBackendProvider(provider));
    this.#invalidate();
    return this;
  }

  unregister(id: string): boolean {
    const deleted = this.#providers.delete(id);
    if (deleted) this.#invalidate();
    return deleted;
  }

  has(id: string): boolean {
    return this.#providers.has(id);
  }

  get(id: string): TerminalBackendProvider | undefined {
    const provider = this.#providers.get(id);
    return provider ? cloneTerminalBackendProvider(provider) : undefined;
  }

  ids(): string[] {
    if (!this.#ids) {
      const ids: string[] = [];
      for (const id of this.#providers.keys()) ids.push(id);
      this.#ids = ids;
    }
    return this.#ids.slice();
  }

  providers(): TerminalBackendProvider[] {
    if (!this.#providersSnapshot) {
      const providers: TerminalBackendProvider[] = [];
      for (const provider of this.#providers.values()) providers.push(cloneTerminalBackendProvider(provider));
      this.#providersSnapshot = providers;
    }
    return cloneTerminalBackendProviders(this.#providersSnapshot);
  }

  async inspect(): Promise<TerminalBackendProviderInspection[]> {
    const inspected: TerminalBackendProviderInspection[] = [];
    for (const provider of this.sortedProviders()) {
      const availability = await probeTerminalBackendProvider(provider, this.#diagnostics);
      inspected.push({
        id: provider.id,
        label: provider.label,
        pty: provider.pty,
        priority: provider.priority ?? 0,
        detachable: provider.detachable ?? false,
        reconnectable: provider.reconnectable ?? false,
        ...availability,
      });
    }
    return inspected;
  }

  async resolve(options: TerminalBackendResolveOptions = {}): Promise<TerminalBackend | undefined> {
    if (options.id) {
      const provider = this.#providers.get(options.id);
      if (!provider || (options.requirePty && !provider.pty)) return undefined;
      const availability = await probeTerminalBackendProvider(provider, this.#diagnostics);
      return availability.available ? await provider.create() : undefined;
    }
    const providers = this.sortedProviders(options.preferPty);
    for (let index = 0; index < providers.length; index += 1) {
      const provider = providers[index]!;
      if (options.requirePty && !provider.pty) continue;
      const availability = await probeTerminalBackendProvider(provider, this.#diagnostics);
      if (!availability.available) continue;
      return await provider.create();
    }
    return undefined;
  }

  sortedProviders(preferPty = false): TerminalBackendProvider[] {
    const cached = preferPty ? this.#sortedPtyProviders : this.#sortedProviders;
    if (cached) return cloneTerminalBackendProviders(cached);
    const providers: TerminalBackendProvider[] = [];
    for (const provider of this.#providers.values()) providers.push(provider);
    providers.sort((left, right) => {
      if (preferPty && left.pty !== right.pty) return left.pty ? -1 : 1;
      return (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id);
    });
    if (preferPty) this.#sortedPtyProviders = providers;
    else this.#sortedProviders = providers;
    return cloneTerminalBackendProviders(providers);
  }

  #invalidate(): void {
    this.#ids = undefined;
    this.#providersSnapshot = undefined;
    this.#sortedProviders = undefined;
    this.#sortedPtyProviders = undefined;
  }
}

/** Creates the default backend registry with the non-PTY process backend registered. */
export function createDefaultTerminalBackendRegistry(
  options: DefaultTerminalBackendRegistryOptions = {},
): TerminalBackendRegistry {
  const registry = new TerminalBackendRegistry([], { diagnostics: options.diagnostics });
  if (options.process !== false) {
    registry.register(createProcessTerminalBackendProvider(options.process ?? {}));
  }
  return registry;
}

/** Creates a lazy provider for the built-in non-PTY process backend. */
export function createProcessTerminalBackendProvider(
  options: ProcessTerminalBackendOptions = {},
): TerminalBackendProvider {
  const backendId = options.id ?? "process";
  const label = options.label ?? "Process";
  return {
    id: backendId,
    label,
    pty: false,
    priority: 0,
    detachable: false,
    reconnectable: false,
    probe: () => ({ available: true, backendId, label, pty: false, detachable: false, reconnectable: false }),
    create: () => createProcessTerminalBackend(options),
  };
}

/** Probes a backend provider and normalizes missing metadata. */
export async function probeTerminalBackendProvider(
  provider: TerminalBackendProvider,
  diagnostics?: DiagnosticsCollector,
): Promise<TerminalBackendAvailability> {
  try {
    const availability = provider.probe ? await provider.probe() : { available: true };
    const result: TerminalBackendAvailability = {
      available: availability.available,
      backendId: availability.backendId ?? provider.id,
      label: availability.label ?? provider.label,
      pty: availability.pty ?? provider.pty,
      detachable: availability.detachable ?? provider.detachable ?? false,
      reconnectable: availability.reconnectable ?? provider.reconnectable ?? false,
    };
    if (availability.reason) result.reason = availability.reason;
    return result;
  } catch (error) {
    diagnostics?.report({
      source: "terminal-backend",
      code: "probe-failed",
      severity: "warning",
      message: `Terminal backend probe failed for ${provider.label}`,
      detail: error instanceof Error ? error.message : String(error),
      context: { backendId: provider.id, pty: provider.pty },
    });
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
      backendId: provider.id,
      label: provider.label,
      pty: provider.pty,
      detachable: provider.detachable ?? false,
      reconnectable: provider.reconnectable ?? false,
    };
  }
}

function normalizeTerminalBackendProvider(provider: TerminalBackendProvider): TerminalBackendProvider {
  return {
    ...provider,
    priority: provider.priority ?? 0,
    detachable: provider.detachable ?? false,
    reconnectable: provider.reconnectable ?? false,
  };
}

function cloneTerminalBackendProvider(provider: TerminalBackendProvider): TerminalBackendProvider {
  return { ...provider };
}

function cloneTerminalBackendProviders(providers: readonly TerminalBackendProvider[]): TerminalBackendProvider[] {
  const output = new Array<TerminalBackendProvider>(providers.length);
  for (let index = 0; index < providers.length; index += 1) {
    output[index] = cloneTerminalBackendProvider(
      providers[index]!,
    );
  }
  return output;
}
