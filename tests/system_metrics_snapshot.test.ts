import { assertEquals } from "./deps.ts";
import { collectAlerts, emptySnapshot, pushHistory } from "../app/system_metrics_snapshot.ts";

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
