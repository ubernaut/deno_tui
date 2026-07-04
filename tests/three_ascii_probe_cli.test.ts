import { assertEquals } from "./deps.ts";
import { average, choiceArg, formatFps, formatMs, numberArg, stringArg } from "../src/three_ascii/probe_cli.ts";

Deno.test("Three ASCII probe CLI helpers parse typed arguments", () => {
  const args = ["--frames=24", "--mode=studio", "--name=demo"];

  assertEquals(numberArg(args, "--frames", 1), 24);
  assertEquals(numberArg(args, "--missing", 7), 7);
  assertEquals(numberArg(["--frames=bad"], "--frames", 5), 5);
  assertEquals(numberArg(["--frames=-1"], "--frames", 5), 5);
  assertEquals(stringArg(args, "--name", "fallback"), "demo");
  assertEquals(stringArg(args, "--missing", "fallback"), "fallback");
  assertEquals(choiceArg(args, "--mode", "studio", ["studio", "lattice"]), "studio");
  assertEquals(choiceArg(["--mode=nope"], "--mode", "studio", ["studio", "lattice"]), "studio");
});

Deno.test("Three ASCII probe CLI helpers format timing summaries", () => {
  assertEquals(average([]), 0);
  assertEquals(average([2, 4, 6]), 4);
  assertEquals(formatMs(1.234), "1.23ms");
  assertEquals(formatMs(undefined), "0.00ms");
  assertEquals(formatFps(20), "50.0");
  assertEquals(formatFps(0), "0.0");
});
