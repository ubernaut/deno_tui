import type { SystemMetricsNetworkInterface } from "./system_metrics_provider.ts";
import type { NetworkSnapshot } from "./types.ts";

export interface NetCounters {
  rxBytes: number;
  txBytes: number;
  sampledAt: number;
}

export interface NetworkStatsSample {
  networks: NetworkSnapshot[];
  totalRxRate: number;
  totalTxRate: number;
  counters: Map<string, NetCounters>;
}

/** Parses `/proc/net/dev` rows and computes byte rates from previous counters. */
export function sampleNetworkStats(
  text: string,
  interfaces: readonly SystemMetricsNetworkInterface[],
  previousCounters: ReadonlyMap<string, NetCounters>,
  sampledAt: number,
): NetworkStatsSample {
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
  const counters = new Map<string, NetCounters>();

  const networks = text
    .split("\n")
    .slice(2)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, countersPart] = line.split(":");
      const name = namePart?.trim() ?? "";
      const values = countersPart?.trim().split(/\s+/).map(Number) ?? [];
      const rxBytes = values[0] ?? 0;
      const txBytes = values[8] ?? 0;
      const previous = previousCounters.get(name) ?? { rxBytes, txBytes, sampledAt };
      const elapsedSeconds = Math.max(0.001, (sampledAt - previous.sampledAt) / 1000);
      const rxRate = Math.max(0, (rxBytes - previous.rxBytes) / elapsedSeconds);
      const txRate = Math.max(0, (txBytes - previous.txBytes) / elapsedSeconds);
      counters.set(name, { rxBytes, txBytes, sampledAt });
      if (name !== "lo") {
        totalRxRate += rxRate;
        totalTxRate += txRate;
      }
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
    counters,
  };
}
