export interface SystemMetricsDirEntry {
  name: string;
  isDirectory: boolean;
}

export interface SystemMetricsCommandOutput {
  success: boolean;
  stdout: Uint8Array;
}

export interface SystemMetricsCommandOptions {
  timeoutMs?: number;
}

export interface SystemMetricsNetworkInterface {
  name: string;
  address: string;
}

export interface SystemMetricsProvider {
  now(): number;
  hostname(): string;
  osRelease(): string;
  hardwareConcurrency(): number;
  systemMemoryInfo(): Deno.SystemMemoryInfo;
  loadavg(): [number, number, number];
  networkInterfaces(): SystemMetricsNetworkInterface[];
  readTextFile(path: string): Promise<string>;
  readDir(path: string): AsyncIterable<SystemMetricsDirEntry>;
  command(command: string, args: string[], options?: SystemMetricsCommandOptions): Promise<SystemMetricsCommandOutput>;
}

export class DenoSystemMetricsProvider implements SystemMetricsProvider {
  now(): number {
    return Date.now();
  }

  hostname(): string {
    return Deno.hostname();
  }

  osRelease(): string {
    return Deno.osRelease();
  }

  hardwareConcurrency(): number {
    return navigator.hardwareConcurrency || 1;
  }

  systemMemoryInfo(): Deno.SystemMemoryInfo {
    return Deno.systemMemoryInfo();
  }

  loadavg(): [number, number, number] {
    const loadavg = Deno.loadavg();
    return [loadavg[0] ?? 0, loadavg[1] ?? 0, loadavg[2] ?? 0];
  }

  networkInterfaces(): SystemMetricsNetworkInterface[] {
    return Deno.networkInterfaces();
  }

  readTextFile(path: string): Promise<string> {
    return Deno.readTextFile(path);
  }

  readDir(path: string): AsyncIterable<SystemMetricsDirEntry> {
    return Deno.readDir(path);
  }

  async command(
    command: string,
    args: string[],
    options: SystemMetricsCommandOptions = {},
  ): Promise<SystemMetricsCommandOutput> {
    const child = new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "null",
    }).spawn();
    let timeout: number | undefined;
    try {
      const output = child.output();
      const result = options.timeoutMs && options.timeoutMs > 0
        ? await Promise.race([
          output,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              try {
                child.kill("SIGKILL");
              } catch {
                // The process may have exited between the timer firing and kill.
              }
              reject(new Error(`${command} timed out after ${options.timeoutMs}ms`));
            }, options.timeoutMs);
          }),
        ])
        : await output;
      return {
        success: result.success,
        stdout: result.stdout,
      };
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
}
