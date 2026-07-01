import type { SystemMetricsProvider } from "./system_metrics_provider.ts";
import type { SystemMetricDiagnostic, TemperatureSnapshot } from "./types.ts";

export interface TemperatureSample {
  temperatures: TemperatureSnapshot[];
  diagnostic?: SystemMetricDiagnostic;
}

/** Samples Linux thermal zones from `/sys/class/thermal`. */
export async function sampleTemperatures(provider: SystemMetricsProvider): Promise<TemperatureSample> {
  const started = performance.now();
  const sampledAt = provider.now();
  const zones: TemperatureSnapshot[] = [];
  try {
    for await (const entry of provider.readDir("/sys/class/thermal")) {
      if (!entry.name.startsWith("thermal_zone")) {
        continue;
      }

      const base = `/sys/class/thermal/${entry.name}`;
      const [labelText, tempText] = await Promise.all([
        provider.readTextFile(`${base}/type`).catch(() => ""),
        provider.readTextFile(`${base}/temp`).catch(() => ""),
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
    return {
      temperatures: [],
      diagnostic: {
        source: "temperature",
        status: "unavailable",
        detail: "thermal zone scan failed",
        durationMs: performance.now() - started,
        sampledAt,
      },
    };
  }

  const temperatures = zones.sort((a, b) => b.celsius - a.celsius);
  return {
    temperatures,
    diagnostic: {
      source: "temperature",
      status: temperatures.length > 0 ? "ok" : "unavailable",
      detail: temperatures.length > 0 ? `sampled ${temperatures.length} thermal zone(s)` : "no thermal zones available",
      durationMs: performance.now() - started,
      sampledAt,
    },
  };
}
