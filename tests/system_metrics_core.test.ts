import { assertEquals } from "./deps.ts";
import { emptyGpuSnapshot, parseNvidiaSmiGpuRow } from "../app/system_metrics_gpu.ts";
import { insertTopProcessSnapshot, parseProcessStat, processComparator } from "../app/system_metrics.ts";
import { collectAlerts, emptySnapshot, pushHistory } from "../app/system_metrics_snapshot.ts";
import type { SystemMetricsNetworkInterface } from "../app/system_metrics_provider.ts";
import { sampleNetworkStats } from "../app/system_metrics_sources.ts";
import type { ProcessSnapshot } from "../app/types.ts";

Deno.test("parseNvidiaSmiGpuRow parses utilization memory and nullable telemetry", () => {
  const gpu = parseNvidiaSmiGpuRow("Fixture RTX, 75, 1024, 4096, 66, 120, 1800, 5000");

  assertEquals(gpu, {
    available: true,
    name: "Fixture RTX",
    utilizationPercent: 75,
    memoryUsed: 1024 * 1024 ** 2,
    memoryTotal: 4096 * 1024 ** 2,
    memoryPercent: 25,
    temperatureCelsius: 66,
    powerWatts: 120,
    graphicsClockMhz: 1800,
    memoryClockMhz: 5000,
  });
});

Deno.test("parseNvidiaSmiGpuRow handles unsupported optional fields", () => {
  const gpu = parseNvidiaSmiGpuRow("Fixture GPU, 150, n/a, 0, Not Supported, N/A, , ");

  assertEquals(gpu?.utilizationPercent, 100);
  assertEquals(gpu?.memoryPercent, 0);
  assertEquals(gpu?.temperatureCelsius, null);
  assertEquals(gpu?.powerWatts, null);
  assertEquals(gpu?.graphicsClockMhz, null);
  assertEquals(gpu?.memoryClockMhz, null);
});

Deno.test("emptyGpuSnapshot exposes stable unavailable GPU state", () => {
  assertEquals(emptyGpuSnapshot(), {
    available: false,
    name: "GPU unavailable",
    utilizationPercent: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    memoryPercent: 0,
    temperatureCelsius: null,
    powerWatts: null,
    graphicsClockMhz: null,
    memoryClockMhz: null,
  });
});

Deno.test("sampleNetworkStats computes interface rates and ignores loopback totals", () => {
  const interfaces: SystemMetricsNetworkInterface[] = [
    { name: "eth0", address: "10.0.0.2" },
    { name: "wlan0", address: "192.168.1.7" },
    { name: "lo", address: "127.0.0.1" },
  ];
  const previous = sampleNetworkStats(
    procNetDev({ eth0: [100, 50], wlan0: [20, 10], lo: [1, 1] }),
    interfaces,
    new Map(),
    1_000,
  );
  const next = sampleNetworkStats(
    procNetDev({ eth0: [300, 250], wlan0: [20, 40], lo: [1_000, 1_000] }),
    interfaces,
    previous.counters,
    3_000,
  );

  assertEquals(next.totalRxRate, 100);
  assertEquals(next.totalTxRate, 115);
  assertEquals(next.networks.map((network) => [network.name, network.addresses, network.rxRate, network.txRate]), [
    ["eth0", ["10.0.0.2"], 100, 100],
    ["wlan0", ["192.168.1.7"], 0, 15],
  ]);
});

Deno.test("sampleNetworkStats clamps negative rates and hides inactive unaddressed interfaces", () => {
  const previous = new Map([
    ["eth0", { rxBytes: 500, txBytes: 500, sampledAt: 1_000 }],
    ["ghost0", { rxBytes: 100, txBytes: 100, sampledAt: 1_000 }],
  ]);
  const sample = sampleNetworkStats(
    procNetDev({ eth0: [400, 450], ghost0: [100, 100] }),
    [{ name: "eth0", address: "10.0.0.2" }],
    previous,
    2_000,
  );

  assertEquals(sample.networks.map((network) => [network.name, network.rxRate, network.txRate]), [
    ["eth0", 0, 0],
  ]);
});

Deno.test("parseProcessStat reads selected proc fields without splitting names", () => {
  const tail = Array.from({ length: 37 }, () => "0");
  tail[0] = "S";
  tail[11] = "120";
  tail[12] = "30";
  tail[21] = "256";
  tail[36] = "17";

  assertEquals(parseProcessStat(`42 (worker (render) thread) ${tail.join(" ")}`, 4096), {
    name: "worker (render) thread",
    state: "S",
    cpuTime: 150,
    memoryBytes: 256 * 4096,
    processor: 17,
  });
});

Deno.test("processComparator applies stable sort key fallbacks", () => {
  const rows: ProcessSnapshot[] = [
    processRow(30, "zeta", 10, 1024),
    processRow(10, "alpha", 10, 4096),
    processRow(20, "alpha", 20, 1024),
  ];

  assertEquals([...rows].sort(processComparator("cpu")).map((row) => row.pid), [20, 10, 30]);
  assertEquals([...rows].sort(processComparator("memory")).map((row) => row.pid), [10, 20, 30]);
  assertEquals([...rows].sort(processComparator("pid")).map((row) => row.pid), [10, 20, 30]);
  assertEquals([...rows].sort(processComparator("name")).map((row) => row.pid), [20, 10, 30]);
});

Deno.test("insertTopProcessSnapshot preserves bounded comparator order", () => {
  const rows: ProcessSnapshot[] = [
    processRow(30, "zeta", 10, 1024),
    processRow(10, "alpha", 10, 4096),
    processRow(20, "alpha", 20, 1024),
    processRow(40, "beta", 50, 512),
  ];
  const top: ProcessSnapshot[] = [];
  const compare = processComparator("cpu");
  for (let index = 0; index < rows.length; index += 1) {
    insertTopProcessSnapshot(top, rows[index]!, 2, compare);
  }

  assertEquals(top.map((row) => row.pid), [...rows].sort(compare).slice(0, 2).map((row) => row.pid));
});

Deno.test("insertTopProcessSnapshot ignores rows when limit is zero", () => {
  const top: ProcessSnapshot[] = [];
  insertTopProcessSnapshot(top, processRow(1, "init", 100, 1024), 0, processComparator("cpu"));
  assertEquals(top, []);
});

Deno.test("pushHistory clamps values and pads short histories", () => {
  assertEquals(pushHistory([0.2, 0.4], 2, 4), [0, 0.2, 0.4, 1]);
  assertEquals(pushHistory([0.2, 0.4, 0.6, 0.8], -1, 3), [0.6, 0.8, 0]);
});

Deno.test("emptySnapshot initializes fixed-length histories", () => {
  const snapshot = emptySnapshot("host", "os", 3);

  assertEquals(snapshot.hostname, "host");
  assertEquals(snapshot.osRelease, "os");
  assertEquals(snapshot.cpuHistory, [0, 0, 0]);
  assertEquals(snapshot.gpu.available, false);
  assertEquals(snapshot.memoryHistory, [0, 0, 0]);
  assertEquals(snapshot.rxHistory, [0, 0, 0]);
});

Deno.test("collectAlerts reports high-priority system pressure and caps output", () => {
  const alerts = collectAlerts({
    cpuOverall: 95,
    memoryPercent: 93,
    swapPercent: 92,
    temperatures: [{ label: "pkg", celsius: 88 }],
    disks: [{ filesystem: "/dev/nvme0n1", mount: "/", total: 100, used: 96, available: 4, percent: 96 }],
    networks: [{ name: "eth0", addresses: [], rxBytes: 0, txBytes: 0, rxRate: 126_000_000, txRate: 1 }],
    gpu: {
      available: true,
      name: "Fixture GPU",
      utilizationPercent: 99,
      memoryUsed: 92,
      memoryTotal: 100,
      memoryPercent: 92,
      temperatureCelsius: null,
      powerWatts: null,
      graphicsClockMhz: null,
      memoryClockMhz: null,
    },
  });

  assertEquals(alerts.map((alert) => alert.title), [
    "CPU LIMIT",
    "MEMORY SATURATION",
    "SWAP CRITICAL",
    "THERMAL LIMIT",
  ]);
});

Deno.test("collectAlerts scans busiest network without input ordering assumptions", () => {
  const alerts = collectAlerts({
    cpuOverall: 10,
    memoryPercent: 10,
    swapPercent: 0,
    temperatures: [],
    disks: [],
    networks: [
      { name: "lo", addresses: [], rxBytes: 0, txBytes: 0, rxRate: 1, txRate: 1 },
      { name: "eth1", addresses: [], rxBytes: 0, txBytes: 0, rxRate: 10_000, txRate: 10_000 },
      { name: "uplink0", addresses: [], rxBytes: 0, txBytes: 0, rxRate: 126_000_000, txRate: 2_000_000 },
    ],
    gpu: {
      available: false,
      name: "unavailable",
      utilizationPercent: 0,
      memoryUsed: 0,
      memoryTotal: 0,
      memoryPercent: 0,
      temperatureCelsius: null,
      powerWatts: null,
      graphicsClockMhz: null,
      memoryClockMhz: null,
    },
  });

  assertEquals(alerts, [{
    severity: "warning",
    title: "NETWORK SURGE",
    detail: "UPLINK0 ABOVE 125 MiB/s",
  }]);
});

function procNetDev(counters: Record<string, [number, number]>): string {
  const rows = Object.entries(counters).map(([name, [rxBytes, txBytes]]) =>
    `${name}: ${rxBytes} 0 0 0 0 0 0 0 ${txBytes} 0 0 0 0 0 0 0`
  );
  return [
    "Inter-|   Receive                                                |  Transmit",
    " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
    ...rows,
  ].join("\n");
}

function processRow(pid: number, name: string, cpuPercent: number, memoryBytes: number): ProcessSnapshot {
  return {
    pid,
    name,
    state: "R",
    cpuPercent,
    memoryPercent: 0,
    memoryBytes,
  };
}
