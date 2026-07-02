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

  const networks: NetworkSnapshot[] = [];
  const lines = text.split("\n");
  for (let index = 2; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim();
    const { rxBytes, txBytes } = parseNetworkByteCounters(line.slice(separator + 1));
    const previous = previousCounters.get(name) ?? { rxBytes, txBytes, sampledAt };
    const elapsedSeconds = Math.max(0.001, (sampledAt - previous.sampledAt) / 1000);
    const rxRate = Math.max(0, (rxBytes - previous.rxBytes) / elapsedSeconds);
    const txRate = Math.max(0, (txBytes - previous.txBytes) / elapsedSeconds);
    counters.set(name, { rxBytes, txBytes, sampledAt });
    if (name !== "lo") {
      totalRxRate += rxRate;
      totalTxRate += txRate;
      const addresses = addressMap.get(name) ?? [];
      if (addresses.length > 0 || rxRate > 0 || txRate > 0) {
        networks.push({
          name,
          addresses,
          rxBytes,
          txBytes,
          rxRate,
          txRate,
        });
      }
    }
  }
  networks.sort(compareNetworkSnapshots);
  if (networks.length > 8) networks.length = 8;

  return {
    networks,
    totalRxRate,
    totalTxRate,
    counters,
  };
}

function parseNetworkByteCounters(value: string): { rxBytes: number; txBytes: number } {
  let field = 0;
  let start = -1;
  let rxBytes = 0;
  let txBytes = 0;
  for (let index = 0; index <= value.length; index += 1) {
    const char = index < value.length ? value[index] : " ";
    if (char !== undefined && !isNetworkCounterWhitespace(char)) {
      if (start < 0) start = index;
      continue;
    }
    if (start < 0) continue;
    if (field === 0) {
      rxBytes = Number(value.slice(start, index)) || 0;
    } else if (field === 8) {
      txBytes = Number(value.slice(start, index)) || 0;
      break;
    }
    field += 1;
    start = -1;
  }
  return { rxBytes, txBytes };
}

function isNetworkCounterWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\r" || char === "\n" || char === "\f";
}

function compareNetworkSnapshots(a: NetworkSnapshot, b: NetworkSnapshot): number {
  const aWeight = a.rxRate + a.txRate + (a.addresses.length > 0 ? 10_000_000_000 : 0);
  const bWeight = b.rxRate + b.txRate + (b.addresses.length > 0 ? 10_000_000_000 : 0);
  return bWeight - aWeight;
}
