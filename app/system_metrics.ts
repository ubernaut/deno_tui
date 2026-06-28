import { Signal } from "../src/signals/mod.ts";
import { clamp } from "./styles.ts";
import type {
  AlertMessage,
  CpuCoreSnapshot,
  DiskSnapshot,
  NetworkSnapshot,
  ProcessSnapshot,
  SystemSnapshot,
  TemperatureSnapshot,
} from "./types.ts";

type CpuTimes = {
  total: number;
  idle: number;
};

type NetCounters = {
  rxBytes: number;
  txBytes: number;
};

type DiskCache = {
  sampledAt: number;
  disks: DiskSnapshot[];
};

export class SystemMonitor {
  snapshot: Signal<SystemSnapshot>;

  #cpuTimes: CpuTimes[] = [];
  #netCounters = new Map<string, NetCounters>();
  #processCpu = new Map<number, number>();
  #timer: number | undefined;
  #sampleInFlight = false;
  #pageSize = 4096;
  #diskCache: DiskCache = { sampledAt: 0, disks: [] };
  #historyLength: number;
  #hostname: string;
  #osRelease: string;

  constructor(historyLength = 60) {
    this.#historyLength = historyLength;
    this.#hostname = safeHostname();
    this.#osRelease = safeOsRelease();
    this.snapshot = new Signal(emptySnapshot(this.#hostname, this.#osRelease, historyLength));
  }

  async start(intervalMs = 1000) {
    await this.sample();
    this.#timer = setInterval(() => {
      void this.sample();
    }, intervalMs);
  }

  stop() {
    clearInterval(this.#timer);
  }

  async sample() {
    if (this.#sampleInFlight) {
      return;
    }
    this.#sampleInFlight = true;

    try {
      const current = this.snapshot.peek();
      const [
        cpuText,
        uptimeText,
        netText,
        temperatures,
        disks,
        rawProcesses,
      ] = await Promise.all([
        Deno.readTextFile("/proc/stat"),
        Deno.readTextFile("/proc/uptime"),
        Deno.readTextFile("/proc/net/dev"),
        sampleTemperatures(),
        this.#sampleDisks(),
        this.#collectProcessStats(),
      ]);

      const cpuSample = this.#sampleCpu(cpuText, current);
      const memoryInfo = Deno.systemMemoryInfo();
      const memoryUsed = memoryInfo.total - memoryInfo.available;
      const swapUsed = memoryInfo.swapTotal - memoryInfo.swapFree;
      const memoryPercent = memoryInfo.total > 0 ? (memoryUsed / memoryInfo.total) * 100 : 0;
      const swapPercent = memoryInfo.swapTotal > 0 ? (swapUsed / memoryInfo.swapTotal) * 100 : 0;
      const networkSample = this.#sampleNetwork(netText);
      const processes = this.#finalizeProcesses(rawProcesses, cpuSample.totalDelta, memoryInfo.total);
      const uptimeSeconds = Number.parseFloat(uptimeText.split(" ")[0] ?? "0");
      const loadavg = Deno.loadavg();

      const nextSnapshot: SystemSnapshot = {
        timestamp: Date.now(),
        hostname: this.#hostname,
        osRelease: this.#osRelease,
        uptimeSeconds,
        loadavg: [loadavg[0] ?? 0, loadavg[1] ?? 0, loadavg[2] ?? 0],
        cpuOverall: cpuSample.overall,
        cpuCores: cpuSample.cores,
        cpuHistory: pushHistory(current.cpuHistory, cpuSample.overall / 100, this.#historyLength),
        memory: {
          total: memoryInfo.total,
          used: memoryUsed,
          available: memoryInfo.available,
          free: memoryInfo.free,
          swapTotal: memoryInfo.swapTotal,
          swapUsed,
          percent: memoryPercent,
          swapPercent,
        },
        memoryHistory: pushHistory(current.memoryHistory, memoryPercent / 100, this.#historyLength),
        swapHistory: pushHistory(current.swapHistory, swapPercent / 100, this.#historyLength),
        temperatures,
        disks,
        networks: networkSample.networks,
        rxHistory: pushHistory(
          current.rxHistory,
          clamp(networkSample.totalRxRate / 125_000_000, 0, 1),
          this.#historyLength,
        ),
        txHistory: pushHistory(
          current.txHistory,
          clamp(networkSample.totalTxRate / 125_000_000, 0, 1),
          this.#historyLength,
        ),
        processes,
        alerts: collectAlerts({
          cpuOverall: cpuSample.overall,
          memoryPercent,
          swapPercent,
          temperatures,
          disks,
          networks: networkSample.networks,
        }),
      };

      this.snapshot.value = nextSnapshot;
    } catch {
      // Keep the last successful snapshot visible if a sample fails.
    } finally {
      this.#sampleInFlight = false;
    }
  }

  #sampleCpu(text: string, current: SystemSnapshot) {
    const rows = text.split("\n").filter((line) => line.startsWith("cpu"));
    const nextTimes: CpuTimes[] = [];
    const cores: CpuCoreSnapshot[] = [];
    let overall = 0;
    let totalDelta = 1;

    for (const [index, row] of rows.entries()) {
      const parts = row.trim().split(/\s+/).slice(1).map(Number);
      const idle = (parts[3] ?? 0) + (parts[4] ?? 0);
      const total = parts.reduce((sum, value) => sum + value, 0);
      const previous = this.#cpuTimes[index] ?? { total, idle };
      const nextTotalDelta = total - previous.total;
      const idleDelta = idle - previous.idle;
      const usage = nextTotalDelta > 0 ? clamp(1 - idleDelta / nextTotalDelta, 0, 1) * 100 : 0;

      nextTimes[index] = { total, idle };
      if (index === 0) {
        overall = usage;
        totalDelta = Math.max(1, nextTotalDelta);
      } else {
        cores.push({
          label: String(index - 1),
          usage,
        });
      }
    }

    this.#cpuTimes = nextTimes;

    return {
      overall,
      cores: cores.length > 0 ? cores : current.cpuCores,
      totalDelta,
    };
  }

  #sampleNetwork(text: string) {
    const interfaces = Deno.networkInterfaces();
    const addressMap = new Map<string, string[]>();
    for (const entry of interfaces) {
      if (entry.name === "lo") {
        continue;
      }
      const addresses = addressMap.get(entry.name) ?? [];
      addresses.push(entry.address);
      addressMap.set(entry.name, addresses);
    }

    let totalRxRate = 0;
    let totalTxRate = 0;

    const networks = text
      .split("\n")
      .slice(2)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [namePart, countersPart] = line.split(":");
        const name = namePart?.trim() ?? "";
        const counters = countersPart?.trim().split(/\s+/).map(Number) ?? [];
        const rxBytes = counters[0] ?? 0;
        const txBytes = counters[8] ?? 0;
        const previous = this.#netCounters.get(name) ?? { rxBytes, txBytes };
        const rxRate = Math.max(0, rxBytes - previous.rxBytes);
        const txRate = Math.max(0, txBytes - previous.txBytes);
        this.#netCounters.set(name, { rxBytes, txBytes });
        totalRxRate += rxRate;
        totalTxRate += txRate;
        return {
          name,
          addresses: addressMap.get(name) ?? [],
          rxBytes,
          txBytes,
          rxRate,
          txRate,
        } satisfies NetworkSnapshot;
      })
      .filter((entry) => entry.name !== "lo")
      .filter((entry) => entry.addresses.length > 0 || entry.rxRate > 0 || entry.txRate > 0)
      .sort((a, b) => {
        const aWeight = a.rxRate + a.txRate + (a.addresses.length > 0 ? 10_000_000_000 : 0);
        const bWeight = b.rxRate + b.txRate + (b.addresses.length > 0 ? 10_000_000_000 : 0);
        return bWeight - aWeight;
      })
      .slice(0, 8);

    return {
      networks,
      totalRxRate,
      totalTxRate,
    };
  }

  async #sampleDisks() {
    const now = Date.now();
    if (now - this.#diskCache.sampledAt < 10_000 && this.#diskCache.disks.length > 0) {
      return this.#diskCache.disks;
    }

    const result = await new Deno.Command("df", {
      args: ["-B1P", "-x", "tmpfs", "-x", "devtmpfs", "-x", "squashfs"],
      stdout: "piped",
      stderr: "null",
    }).output();

    const output = new TextDecoder().decode(result.stdout);
    const lines = output.split("\n").slice(1).filter(Boolean);

    const disks = lines
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 6)
      .map((parts) => {
        const filesystem = parts[0] ?? "";
        const total = Number(parts[1] ?? 0);
        const used = Number(parts[2] ?? 0);
        const available = Number(parts[3] ?? 0);
        const percent = Number((parts[4] ?? "0").replace("%", ""));
        const mount = parts[5] ?? "/";
        return {
          filesystem,
          mount,
          total,
          used,
          available,
          percent,
        } satisfies DiskSnapshot;
      })
      .filter((entry) => entry.filesystem.startsWith("/dev/") || entry.mount === "/")
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 8);

    this.#diskCache = {
      sampledAt: now,
      disks,
    };

    return disks;
  }

  async #collectProcessStats() {
    const entries: number[] = [];
    for await (const entry of Deno.readDir("/proc")) {
      if (entry.isDirectory && /^\d+$/.test(entry.name)) {
        entries.push(Number(entry.name));
      }
    }

    const stats = await Promise.allSettled(
      entries.map(async (pid) => {
        const stat = await Deno.readTextFile(`/proc/${pid}/stat`);
        return { pid, stat };
      }),
    );

    return stats;
  }

  #finalizeProcesses(
    stats: PromiseSettledResult<{ pid: number; stat: string }>[],
    totalDelta: number,
    totalMemory: number,
  ) {
    const cpuCount = Math.max(1, navigator.hardwareConcurrency || 1);

    const nextProcessCpu = new Map<number, number>();
    const processes: ProcessSnapshot[] = [];

    for (const result of stats) {
      if (result.status !== "fulfilled") {
        continue;
      }

      const parsed = parseProcessStat(result.value.stat, this.#pageSize);
      if (!parsed) {
        continue;
      }

      const previousTime = this.#processCpu.get(result.value.pid) ?? parsed.cpuTime;
      const cpuDelta = Math.max(0, parsed.cpuTime - previousTime);
      nextProcessCpu.set(result.value.pid, parsed.cpuTime);

      const cpuPercent = clamp((cpuDelta / Math.max(1, totalDelta)) * 100 * cpuCount, 0, 999);

      processes.push({
        pid: result.value.pid,
        name: parsed.name,
        state: parsed.state,
        cpuPercent,
        memoryPercent: clamp((parsed.memoryBytes / totalMemory) * 100, 0, 100),
        memoryBytes: parsed.memoryBytes,
      });
    }

    this.#processCpu = nextProcessCpu;

    return processes.sort((a, b) => b.cpuPercent - a.cpuPercent || b.memoryBytes - a.memoryBytes).slice(0, 14);
  }
}

function parseProcessStat(stat: string, pageSize: number) {
  const open = stat.indexOf("(");
  const close = stat.lastIndexOf(")");
  if (open === -1 || close === -1) {
    return null;
  }
  const name = stat.slice(open + 1, close);
  const tail = stat.slice(close + 2).trim().split(/\s+/);
  const state = tail[0] ?? "?";
  const utime = Number(tail[11] ?? 0);
  const stime = Number(tail[12] ?? 0);
  const rssPages = Number(tail[21] ?? 0);
  return {
    name,
    state,
    cpuTime: utime + stime,
    memoryBytes: rssPages * pageSize,
  };
}

async function sampleTemperatures() {
  const zones: TemperatureSnapshot[] = [];
  try {
    for await (const entry of Deno.readDir("/sys/class/thermal")) {
      if (!entry.name.startsWith("thermal_zone")) {
        continue;
      }

      const base = `/sys/class/thermal/${entry.name}`;
      const [labelText, tempText] = await Promise.all([
        Deno.readTextFile(`${base}/type`).catch(() => ""),
        Deno.readTextFile(`${base}/temp`).catch(() => ""),
      ]);

      const celsius = Number.parseFloat(tempText.trim());
      if (!Number.isFinite(celsius)) {
        continue;
      }

      zones.push({
        label: labelText.trim() || entry.name,
        celsius: celsius > 1000 ? celsius / 1000 : celsius,
      });
    }
  } catch {
    return [];
  }

  return zones.sort((a, b) => b.celsius - a.celsius);
}

function pushHistory(history: number[], value: number, limit: number) {
  const next = history.slice(-Math.max(0, limit - 1));
  next.push(clamp(value, 0, 1));
  while (next.length < limit) {
    next.unshift(0);
  }
  return next;
}

function collectAlerts(input: {
  cpuOverall: number;
  memoryPercent: number;
  swapPercent: number;
  temperatures: TemperatureSnapshot[];
  disks: DiskSnapshot[];
  networks: NetworkSnapshot[];
}) {
  const alerts: AlertMessage[] = [];

  if (input.cpuOverall >= 90) {
    alerts.push({
      severity: "alarm",
      title: "CPU LIMIT",
      detail: `EXECUTION LOAD AT ${input.cpuOverall.toFixed(1)}%`,
    });
  } else if (input.cpuOverall >= 75) {
    alerts.push({
      severity: "warning",
      title: "CPU RISE",
      detail: `PROCESSOR WALL AT ${input.cpuOverall.toFixed(1)}%`,
    });
  }

  if (input.memoryPercent >= 90) {
    alerts.push({
      severity: "alarm",
      title: "MEMORY SATURATION",
      detail: `RAM USE AT ${input.memoryPercent.toFixed(1)}%`,
    });
  } else if (input.memoryPercent >= 80) {
    alerts.push({
      severity: "warning",
      title: "MEMORY CLIMB",
      detail: `RAM USE AT ${input.memoryPercent.toFixed(1)}%`,
    });
  }

  if (input.swapPercent >= 90) {
    alerts.push({
      severity: "alarm",
      title: "SWAP CRITICAL",
      detail: `SWAP USE AT ${input.swapPercent.toFixed(1)}%`,
    });
  }

  const hottest = input.temperatures[0];
  if (hottest && hottest.celsius >= 84) {
    alerts.push({
      severity: "alarm",
      title: "THERMAL LIMIT",
      detail: `${hottest.label.toUpperCase()} AT ${hottest.celsius.toFixed(1)}C`,
    });
  } else if (hottest && hottest.celsius >= 72) {
    alerts.push({
      severity: "warning",
      title: "THERMAL RISE",
      detail: `${hottest.label.toUpperCase()} AT ${hottest.celsius.toFixed(1)}C`,
    });
  }

  const fullestDisk = input.disks[0];
  if (fullestDisk && fullestDisk.percent >= 95) {
    alerts.push({
      severity: "alarm",
      title: "DISK CAPACITY",
      detail: `${fullestDisk.mount.toUpperCase()} AT ${fullestDisk.percent}%`,
    });
  } else if (fullestDisk && fullestDisk.percent >= 85) {
    alerts.push({
      severity: "warning",
      title: "DISK PRESSURE",
      detail: `${fullestDisk.mount.toUpperCase()} AT ${fullestDisk.percent}%`,
    });
  }

  const busiestNetwork = [...input.networks].sort((a, b) => (b.rxRate + b.txRate) - (a.rxRate + a.txRate))[0];
  if (busiestNetwork && busiestNetwork.rxRate + busiestNetwork.txRate > 125_000_000) {
    alerts.push({
      severity: "warning",
      title: "NETWORK SURGE",
      detail: `${busiestNetwork.name.toUpperCase()} ABOVE 125 MiB/s`,
    });
  }

  return alerts.slice(0, 4);
}

function emptySnapshot(hostname: string, osRelease: string, historyLength: number): SystemSnapshot {
  return {
    timestamp: 0,
    hostname,
    osRelease,
    uptimeSeconds: 0,
    loadavg: [0, 0, 0],
    cpuOverall: 0,
    cpuCores: [],
    cpuHistory: Array.from({ length: historyLength }, () => 0),
    memory: {
      total: 0,
      used: 0,
      available: 0,
      free: 0,
      swapTotal: 0,
      swapUsed: 0,
      percent: 0,
      swapPercent: 0,
    },
    memoryHistory: Array.from({ length: historyLength }, () => 0),
    swapHistory: Array.from({ length: historyLength }, () => 0),
    temperatures: [],
    disks: [],
    networks: [],
    rxHistory: Array.from({ length: historyLength }, () => 0),
    txHistory: Array.from({ length: historyLength }, () => 0),
    processes: [],
    alerts: [],
  };
}

function safeHostname() {
  try {
    return Deno.hostname();
  } catch {
    return "unknown-host";
  }
}

function safeOsRelease() {
  try {
    return Deno.osRelease();
  } catch {
    return "unknown-os";
  }
}
