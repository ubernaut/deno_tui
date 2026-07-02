import { formatRate } from "./styles.ts";
import { buildVisualizationDrive, sampleSeriesValue, type VisualizationDrive } from "./visualization_drive.ts";
import type { Accent, PanelRender, RenderContext } from "./types.ts";

export interface NetworkMonitorRenderDependencies {
  plotHistory(values: number[], width: number, height: number, glyph: string): string;
  monitorGlyph(drive: VisualizationDrive, accent: Accent): string;
}

export function renderNetworkMonitor(
  context: RenderContext,
  dependencies: NetworkMonitorRenderDependencies,
): PanelRender {
  const { system } = context;
  const width = Math.max(1, context.width);
  const height = Math.max(1, context.height);
  const drive = buildVisualizationDrive(context, Math.max(width, 24));
  const alert = networkAlert(context);
  const network = busiestNetwork(system.networks);
  const isSurging = Boolean(network && network.rxRate + network.txRate > 125_000_000);

  return {
    body: networkMonitorLines(system, drive, width, height, dependencies).join("\n"),
    footer: networkFooter(system, drive, width),
    alert,
    accent: isSurging ? "amber" : "signal",
    severity: isSurging ? "warning" : "info",
  };
}

function networkMonitorLines(
  system: RenderContext["system"],
  drive: VisualizationDrive,
  width: number,
  height: number,
  dependencies: NetworkMonitorRenderDependencies,
): string[] {
  const lineBudget = Math.max(1, height);
  const chartWidth = Math.max(1, width);

  if (lineBudget <= 3 || width < 20) {
    const lines: string[] = [
      networkSummaryLine(system, width),
      compactNetworkTrace(system, chartWidth),
    ];
    appendNetworkInterfaceRows(lines, system, width, lineBudget - 2);
    return fitNetworkLines(lines, width, lineBudget);
  }

  if (lineBudget <= 6) {
    const interfaceRows = Math.min(system.networks.length, Math.max(0, lineBudget - 3));
    const chartHeight = Math.max(1, lineBudget - 1 - interfaceRows);
    const lines: string[] = [width >= 32 ? "RX/TX BUS" : "RX/TX"];
    appendSplitLines(
      lines,
      dependencies.plotHistory(
        combinedNetworkHistory(system),
        chartWidth,
        chartHeight,
        dependencies.monitorGlyph(drive, "signal"),
      ),
    );
    appendNetworkInterfaceRows(lines, system, width, interfaceRows);
    return fitNetworkLines(lines, width, lineBudget);
  }

  const interfaceRows = Math.min(system.networks.length, width >= 36 ? 2 : 1, Math.max(0, lineBudget - 6));
  const graphRows = Math.max(2, lineBudget - 2 - interfaceRows);
  const rxHeight = Math.max(1, Math.floor(graphRows / 2));
  const txHeight = Math.max(1, graphRows - rxHeight);

  const lines: string[] = [width >= 28 ? "RX BUS" : "RX"];
  appendSplitLines(
    lines,
    dependencies.plotHistory(system.rxHistory, chartWidth, rxHeight, dependencies.monitorGlyph(drive, "signal")),
  );
  lines.push(width >= 28 ? "TX BUS" : "TX");
  appendSplitLines(
    lines,
    dependencies.plotHistory(system.txHistory, chartWidth, txHeight, dependencies.monitorGlyph(drive, "amber")),
  );
  appendNetworkInterfaceRows(lines, system, width, interfaceRows);
  return fitNetworkLines(lines, width, lineBudget);
}

function networkSummaryLine(system: RenderContext["system"], width: number): string {
  const network = busiestNetwork(system.networks);
  if (!network) {
    return "NET IDLE";
  }

  const name = crop(network.name.toUpperCase(), width < 24 ? 5 : 10);
  if (width < 28) {
    return `NET ${name} ${compactRate(network.rxRate)}↓ ${compactRate(network.txRate)}↑`;
  }
  return `NET ${name} RX ${formatRate(network.rxRate)}  TX ${formatRate(network.txRate)}`;
}

function compactNetworkTrace(system: RenderContext["system"], width: number): string {
  let trace = "";
  for (let index = 0; index < width; index++) {
    const rxValue = sampleSeriesValue(system.rxHistory, index, width);
    const txValue = sampleSeriesValue(system.txHistory, index, width);
    const combined = Math.max(rxValue, txValue);
    if (combined >= 0.82) trace += "█";
    else if (rxValue >= 0.5 && txValue >= 0.5) trace += "▓";
    else if (rxValue >= txValue && rxValue >= 0.22) trace += "▄";
    else if (txValue > rxValue && txValue >= 0.22) trace += "▀";
    else trace += "·";
  }
  return trace;
}

function appendNetworkInterfaceRows(
  lines: string[],
  system: RenderContext["system"],
  width: number,
  count: number,
): void {
  if (count <= 0) {
    return;
  }
  if (system.networks.length === 0) {
    lines.push("NO ACTIVE INTERFACES");
    return;
  }
  const limit = Math.min(count, system.networks.length);
  for (let index = 0; index < limit; index++) {
    lines.push(networkInterfaceLine(system.networks[index], width));
  }
}

function networkInterfaceLine(
  network: RenderContext["system"]["networks"][number],
  width: number,
): string {
  const name = crop(network.name.toUpperCase(), width < 28 ? 6 : 10);
  if (width < 30) {
    return `${name} R${compactRate(network.rxRate)} T${compactRate(network.txRate)}`;
  }
  if (width < 48) {
    return `${name.padEnd(10, " ")} R ${formatRate(network.rxRate)}  T ${formatRate(network.txRate)}`;
  }
  const address = network.addresses[0] ? ` ${network.addresses[0]}` : "";
  return `${name.padEnd(10, " ")}${address}  RX ${formatRate(network.rxRate)}  TX ${formatRate(network.txRate)}`;
}

function networkFooter(system: RenderContext["system"], drive: VisualizationDrive, width: number): string {
  const network = busiestNetwork(system.networks);
  if (!network) {
    return "NO ACTIVE INTERFACES";
  }
  const name = crop(network.name.toUpperCase(), width < 30 ? 6 : 10);
  if (width < 34) {
    return crop(`${name} ${compactRate(network.rxRate)}↓ ${compactRate(network.txRate)}↑`, width);
  }
  const address = network.addresses[0] ?? "NO ADDRESS";
  return crop(
    `${name} ${address}  RX ${formatRate(network.rxRate)}  TX ${formatRate(network.txRate)}  BURST ${
      (drive.volatility * 100).toFixed(0)
    }%`,
    width,
  );
}

function combinedNetworkHistory(system: RenderContext["system"]): number[] {
  const length = Math.max(system.rxHistory.length, system.txHistory.length, 1);
  const combined = new Array<number>(length);
  for (let index = 0; index < length; index++) {
    combined[index] = Math.max(system.rxHistory[index] ?? 0, system.txHistory[index] ?? 0);
  }
  return combined;
}

function compactRate(value: number): string {
  return formatRate(value)
    .replace(/\s+/g, "")
    .replace("KiB/s", "K/s")
    .replace("MiB/s", "M/s")
    .replace("GiB/s", "G/s")
    .replace("TiB/s", "T/s");
}

function fitNetworkLines(lines: string[], width: number, height: number): string[] {
  const limit = Math.min(lines.length, Math.max(1, height));
  const fitted = new Array<string>(limit);
  for (let index = 0; index < limit; index++) {
    fitted[index] = crop(lines[index].trimEnd(), width);
  }
  return fitted;
}

function appendSplitLines(lines: string[], text: string): void {
  let start = 0;
  while (start <= text.length) {
    const next = text.indexOf("\n", start);
    if (next === -1) {
      lines.push(text.slice(start));
      return;
    }
    lines.push(text.slice(start, next));
    start = next + 1;
  }
}

function networkAlert(context: RenderContext) {
  const network = busiestNetwork(context.system.networks);
  if (!network) {
    return "";
  }
  const totalRate = network.rxRate + network.txRate;
  return totalRate > 125_000_000 ? `${network.name.toUpperCase()} SURGE ABOVE ${formatRate(totalRate)}` : "";
}

function busiestNetwork(networks: RenderContext["system"]["networks"]) {
  return networks.reduce<RenderContext["system"]["networks"][number] | undefined>((busiest, network) => {
    if (!busiest) {
      return network;
    }
    return network.rxRate + network.txRate > busiest.rxRate + busiest.txRate ? network : busiest;
  }, undefined);
}

function crop(text: string, width: number) {
  if (width <= 0) return "";
  return text.length > width ? text.slice(0, Math.max(0, width - 1)) + "…" : text;
}
