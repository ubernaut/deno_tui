import { assertEquals } from "./deps.ts";
import { emptyGpuSnapshot, parseNvidiaSmiGpuRow } from "../app/system_metrics_gpu.ts";

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
