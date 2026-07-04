import { assertEquals } from "./deps.ts";
import { resolveThreeAsciiDeferredReadbackSubmission } from "../src/three_ascii/readback_submission.ts";

Deno.test("resolveThreeAsciiDeferredReadbackSubmission returns unavailable fallback without submitting", () => {
  const grid = [["cached"]];
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({ grid, readbackUnavailable: true }, "slot", [["last"]]),
    { grid, submit: false, queue: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({ readbackUnavailable: true }, "slot", [["last"]]),
    { grid: [], submit: false, queue: false },
  );
});

Deno.test("resolveThreeAsciiDeferredReadbackSubmission returns completed or last grid when no slot is free", () => {
  const completed = [["completed"]];
  const last = [["last"]];
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({ grid: completed }, undefined, last),
    { grid: completed, submit: false, queue: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({}, undefined, last),
    { grid: last, submit: false, queue: false },
  );
});

Deno.test("resolveThreeAsciiDeferredReadbackSubmission submits and queues available slots", () => {
  const readback = { id: 1 };
  const last = [["last"]];
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({}, readback, last),
    { readback, grid: last, submit: true, queue: true },
  );
  const completed = [["completed"]];
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({ grid: completed }, readback, last),
    { readback, grid: completed, submit: true, queue: true },
  );
});
