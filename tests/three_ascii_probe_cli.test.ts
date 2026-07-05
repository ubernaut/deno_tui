import { assertEquals } from "./deps.ts";
import {
  average,
  averageWhere,
  choiceArg,
  formatFps,
  formatMs,
  numberArg,
  stringArg,
} from "../src/three_ascii/probe_cli.ts";

Deno.test("Three ASCII probe CLI helpers parse typed arguments", () => {
  const args = ["--frames=24", "--mode=studio", "--name=demo"];
  const separatedArgs = ["--frames", "48", "--mode", "lattice", "--name", "separated"];

  assertEquals(numberArg(args, "--frames", 1), 24);
  assertEquals(numberArg(separatedArgs, "--frames", 1), 48);
  assertEquals(numberArg(args, "--missing", 7), 7);
  assertEquals(numberArg(["--frames=bad"], "--frames", 5), 5);
  assertEquals(numberArg(["--frames=-1"], "--frames", 5), 5);
  assertEquals(numberArg(["--frames", "--mode", "studio"], "--frames", 5), 5);
  assertEquals(stringArg(args, "--name", "fallback"), "demo");
  assertEquals(stringArg(separatedArgs, "--name", "fallback"), "separated");
  assertEquals(stringArg(args, "--missing", "fallback"), "fallback");
  assertEquals(choiceArg(args, "--mode", "studio", ["studio", "lattice"]), "studio");
  assertEquals(choiceArg(separatedArgs, "--mode", "studio", ["studio", "lattice"]), "lattice");
  assertEquals(choiceArg(["--mode=nope"], "--mode", "studio", ["studio", "lattice"]), "studio");
  assertEquals(choiceArg(["--mode", "--frames", "4"], "--mode", "studio", ["studio", "lattice"]), "studio");
});

Deno.test("Three ASCII probe CLI helpers format timing summaries", () => {
  assertEquals(average([]), 0);
  assertEquals(average([2, 4, 6]), 4);
  assertEquals(averageWhere([{ n: 1 }, { n: 5 }, { n: 7 }], (entry) => entry.n, (entry) => entry.n > 1), 6);
  assertEquals(averageWhere([{ n: 1 }], (entry) => entry.n, (entry) => entry.n > 10), 0);
  assertEquals(formatMs(1.234), "1.23ms");
  assertEquals(formatMs(undefined), "0.00ms");
  assertEquals(formatFps(20), "50.0");
  assertEquals(formatFps(0), "0.0");
});
