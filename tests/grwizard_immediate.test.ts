import { assertEquals } from "./deps.ts";
import {
  detectViewportClass,
  recommendModelIndex,
  sortCandidatesForDisplay,
  windowRange,
} from "../app/grwizard_immediate.ts";
import type { ModelCandidate } from "../app/grwizard_backend.ts";

function candidate(
  display: string,
  overrides: Partial<ModelCandidate> = {},
): ModelCandidate {
  return {
    section: "huggingface",
    source: "huggingface",
    fit: "good",
    display,
    ref: display,
    containerRef: display,
    localOnly: false,
    remoteCode: false,
    gated: false,
    paramsB: 1,
    minVramGb: 8,
    notes: "",
    modelId: display,
    family: "test",
    ...overrides,
  };
}

Deno.test("sortCandidatesForDisplay keeps local good fits ahead of remote stretch fits", () => {
  const sorted = sortCandidatesForDisplay([
    candidate("remote-stretch", { fit: "stretch" }),
    candidate("local-good", { section: "local", source: "hf-cache", localOnly: true }),
    candidate("remote-good"),
    candidate("local-cpu", { section: "local", source: "local-dir", fit: "cpu-only" }),
  ]);

  assertEquals(sorted.map((entry) => entry.display), [
    "local-good",
    "local-cpu",
    "remote-good",
    "remote-stretch",
  ]);
});

Deno.test("recommendModelIndex prefers a local good fit over remote options", () => {
  const candidates = [
    candidate("remote-good"),
    candidate("local-good", { section: "local", source: "hf-cache", localOnly: true }),
    candidate("remote-stretch", { fit: "stretch" }),
  ];

  assertEquals(recommendModelIndex(candidates), 1);
});

Deno.test("windowRange centers around the selected row when possible", () => {
  assertEquals(windowRange(30, 15, 7), { start: 12, end: 19 });
  assertEquals(windowRange(30, 1, 7), { start: 0, end: 7 });
  assertEquals(windowRange(30, 28, 7), { start: 23, end: 30 });
});

Deno.test("detectViewportClass matches the intended responsive breakpoints", () => {
  assertEquals(detectViewportClass(70, 18), "tiny");
  assertEquals(detectViewportClass(96, 24), "small");
  assertEquals(detectViewportClass(124, 32), "medium");
  assertEquals(detectViewportClass(150, 40), "large");
});
