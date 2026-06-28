import { assertEquals } from "./deps.ts";
import {
  applyCalibrationProfile,
  categorizeTaskStatus,
  createRunTag,
  fitLabel,
  type GoalPreset,
  type HardwareSummary,
} from "../app/grwizard_backend.ts";

const cpuOnlyHardware: HardwareSummary = {
  cpuCores: 16,
  systemRamGb: 64,
  gpuPresent: false,
  gpuName: "none",
  gpuVramGb: 0,
  deviceDefault: "cpu",
  hfAuthLoaded: false,
  dockerComposeAvailable: true,
};

const gpuHardware: HardwareSummary = {
  ...cpuOnlyHardware,
  gpuPresent: true,
  gpuName: "RTX 4090",
  gpuVramGb: 24,
  deviceDefault: "cuda",
};

const goal: GoalPreset = {
  name: "smoke",
  label: "Smoke Test",
  template: "minimal",
  threshold: 0.03,
  calTokens: 512,
  proxyTokens: 128,
  sweeps: 1,
  strict: false,
  autonomous: false,
  monitorInterval: 15,
  description: "Fast viability run with light calibration and search.",
};

Deno.test("fitLabel matches bash-style hardware guidance", () => {
  assertEquals(fitLabel(0, "cpu", cpuOnlyHardware), "good");
  assertEquals(fitLabel(8, "cuda", cpuOnlyHardware), "cpu-only");
  assertEquals(fitLabel(20, "cuda", gpuHardware), "good");
  assertEquals(fitLabel(28, "cuda", gpuHardware), "stretch");
  assertEquals(fitLabel(40, "cuda", gpuHardware), "unlikely");
});

Deno.test("heavy calibration doubles budgets and respects floors", () => {
  assertEquals(applyCalibrationProfile(goal, "standard").effectiveCalTokens, 512);
  assertEquals(applyCalibrationProfile(goal, "standard").effectiveProxyTokens, 128);
  assertEquals(applyCalibrationProfile(goal, "heavy").effectiveCalTokens, 8192);
  assertEquals(applyCalibrationProfile(goal, "heavy").effectiveProxyTokens, 2048);
});

Deno.test("createRunTag sanitizes container refs and goal names", () => {
  const tag = createRunTag(new Date("2026-04-20T10:31:24"), "/app/models/TinyLlama:1.1B", "quality-first");
  assertEquals(tag, "20260420_103124__app_models_TinyLlama_1.1B_quality-first");
});

Deno.test("categorizeTaskStatus maps swarm states into board columns", () => {
  assertEquals(categorizeTaskStatus("available"), "backlog");
  assertEquals(categorizeTaskStatus("in_progress"), "active");
  assertEquals(categorizeTaskStatus("blocked"), "review");
  assertEquals(categorizeTaskStatus("completed"), "done");
});
