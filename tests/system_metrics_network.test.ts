import { assertEquals } from "./deps.ts";
import { sampleNetworkStats } from "../app/system_metrics_network.ts";
import type { SystemMetricsNetworkInterface } from "../app/system_metrics_provider.ts";

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
