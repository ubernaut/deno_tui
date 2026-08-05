import { assert, assertAlmostEquals, assertEquals, assertThrows } from "./deps.ts";
import { compileEel, EelScope, tryCompileEel } from "../eel.ts";

/** Compiles and runs one block, returning the scope it ran against. */
function run(source: string, seed: () => number = () => 0.5): EelScope {
  const scope = new EelScope(seed);
  compileEel(source, scope).run();
  return scope;
}

Deno.test("eel: arithmetic, precedence and associativity", () => {
  const scope = run("a = 2 + 3 * 4; b = (2 + 3) * 4; c = 2 ^ 3 ^ 2; d = 10 - 3 - 2; e = -2 ^ 2;");
  assertEquals(scope.get("a"), 14);
  assertEquals(scope.get("b"), 20);
  // `^` is exponentiation in EEL and right-associative: 2^(3^2).
  assertEquals(scope.get("c"), 512);
  assertEquals(scope.get("d"), 5);
  // Unary minus binds tighter than `^` here, so this is (-2)^2. Mathematical
  // convention would read it as -(2^2); the shipped catalog contains no `^` at
  // all, so the pinned behaviour is this implementation's rather than a claim
  // about EEL2.
  assertEquals(scope.get("e"), 4);
});

Deno.test("eel: assignment forms and expression statements", () => {
  const scope = run("x = 5; x += 3; x -= 1; x *= 2; x /= 7; y = z = 4;");
  assertEquals(scope.get("x"), 2);
  assertEquals(scope.get("y"), 4);
  assertEquals(scope.get("z"), 4);
});

Deno.test("eel: division and modulo by zero yield zero rather than a non-finite", () => {
  const scope = run("a = 1 / 0; b = 1 % 0; c = 0 / 0; d = 5; d /= 0;");
  assertEquals(scope.get("a"), 0);
  assertEquals(scope.get("b"), 0);
  assertEquals(scope.get("c"), 0);
  assertEquals(scope.get("d"), 0);
});

Deno.test("eel: a non-finite result is stored as zero", () => {
  // Presets divide by expressions that reach zero and take roots of negatives;
  // a NaN reaching the renderer becomes a black frame that never recovers.
  const scope = run("a = log(0); b = sqrt(-4); c = pow(0, -1); d = exp(100000);");
  for (const name of ["a", "b", "c", "d"]) {
    assert(Number.isFinite(scope.get(name)), `${name} should be finite`);
  }
  assertEquals(scope.get("b"), 2, "sqrt takes the magnitude, as MilkDrop does");
});

Deno.test("eel: comparison helpers return one or zero", () => {
  const scope = run(
    "a = above(3, 2); b = below(3, 2); c = equal(2, 2); d = bnot(0); e = band(1, 0); f = bor(1, 0); g = 3 > 4;",
  );
  assertEquals([scope.get("a"), scope.get("b"), scope.get("c")], [1, 0, 1]);
  assertEquals([scope.get("d"), scope.get("e"), scope.get("f"), scope.get("g")], [1, 0, 1, 0]);
});

Deno.test("eel: if evaluates only the branch it takes", () => {
  // Presets lean on this to guard divisions, so a strict `if` would poison
  // variables that the preset never intended to touch.
  const scope = run("taken = 0; skipped = 0; v = if(1, exec2(taken = 1, 7), exec2(skipped = 1, 9));");
  assertEquals(scope.get("v"), 7);
  assertEquals(scope.get("taken"), 1);
  assertEquals(scope.get("skipped"), 0, "the untaken branch must not run");

  const other = run("v = if(0, 1, 2); w = if(0, 1);");
  assertEquals(other.get("v"), 2);
  assertEquals(other.get("w"), 0, "a two-argument if treats the missing branch as zero");
});

Deno.test("eel: ternary matches if", () => {
  const scope = run("a = 1 ? 4 : 5; b = 0 ? 4 : 5; c = 2 > 1 ? 10 : 20;");
  assertEquals([scope.get("a"), scope.get("b"), scope.get("c")], [4, 5, 10]);
});

Deno.test("eel: megabuf and gmegabuf read, write and default to zero", () => {
  const scope = run(
    "megabuf(3) = 7; gmegabuf(3) = 9; a = megabuf(3); b = gmegabuf(3); c = megabuf(999); megabuf(1) += 4;",
  );
  assertEquals(scope.get("a"), 7);
  assertEquals(scope.get("b"), 9, "the two buffers are separate");
  assertEquals(scope.get("c"), 0, "unwritten entries read as zero");
  assertEquals(scope.buffer(false).get(1), 4);
  // Negative and absurd indices are clamped rather than throwing.
  const clamped = run("megabuf(-5) = 1; a = megabuf(-5); megabuf(1e12) = 2; b = megabuf(1e12);");
  assertEquals(clamped.get("a"), 1);
  assertEquals(clamped.get("b"), 2);
});

Deno.test("eel: loop and while run bodies and are bounded", () => {
  const scope = run("n = 0; i = 0; loop(5, n = n + 2; i = i + 1;);");
  assertEquals(scope.get("n"), 10);
  assertEquals(scope.get("i"), 5);

  // Semicolons inside a call are sequencing, which is how the catalog writes
  // multi-statement loop bodies; consecutive separators are empty statements.
  const separators = run("n = 0; loop(3, n = n + 1; , n = n + 10;);");
  assertEquals(separators.get("n"), 33);

  // A runaway loop is truncated instead of hanging the desktop.
  const bounded = run("n = 0; loop(10000000, n = n + 1);");
  assert(bounded.get("n") <= 65_536, `loop should be capped, got ${bounded.get("n")}`);

  const whileScope = run("n = 0; while(n = n + 1; below(n, 4););");
  assertEquals(whileScope.get("n"), 4);
  const runaway = run("n = 0; while(n = n + 1; 1;);");
  assert(runaway.get("n") <= 65_536, "while should be capped too");
});

Deno.test("eel: variables persist across runs of the same scope", () => {
  // MilkDrop keeps per-preset variables alive between frames; accumulator
  // presets are meaningless without it.
  const scope = new EelScope();
  const program = compileEel("total = total + 3;", scope);
  program.run();
  program.run();
  program.run();
  assertEquals(scope.get("total"), 9);
});

Deno.test("eel: reads and writes survive the variable pool growing", () => {
  // Slot allocation can replace the backing array. Reading through a stale
  // reference silently returned undefined and dropped writes.
  const scope = new EelScope();
  for (let index = 0; index < 500; index += 1) scope.set(`v${index}`, index);
  for (let index = 0; index < 500; index += 1) {
    assertEquals(scope.get(`v${index}`), index, `v${index} lost its value`);
    assert(Number.isFinite(scope.get(`v${index}`)));
  }
  // A program compiled before further growth still sees the current array.
  const program = compileEel("a = 1;", scope);
  for (let index = 500; index < 900; index += 1) scope.set(`v${index}`, index);
  program.run();
  assertEquals(scope.get("a"), 1);
});

Deno.test("eel: rand is drawn from the injected source, keeping frames reproducible", () => {
  const values = [0.25, 0.5, 0.75];
  let index = 0;
  const scope = run("a = rand(1); b = rand(100); c = rand(1);", () => values[index++ % values.length]!);
  assertAlmostEquals(scope.get("a"), 0.25, 1e-9);
  assertAlmostEquals(scope.get("b"), 50, 1e-9);
  assertAlmostEquals(scope.get("c"), 0.75, 1e-9);
});

Deno.test("eel: comments are ignored and builtins are case-insensitive", () => {
  const scope = run("// leading\na = 1; /* block */ b = Sin(0) + COS(0); // trailing\nc = 2; // no newline at end");
  assertEquals(scope.get("a"), 1);
  assertEquals(scope.get("b"), 1);
  assertEquals(scope.get("c"), 2);
});

Deno.test("eel: numbers parse in every form the catalog uses", () => {
  const scope = run("a = .5; b = 1.5; c = 1e3; d = 1.5e-2; e = 2e+2;");
  assertEquals([scope.get("a"), scope.get("b"), scope.get("c")], [0.5, 1.5, 1000]);
  assertAlmostEquals(scope.get("d"), 0.015, 1e-9);
  assertEquals(scope.get("e"), 200);
});

Deno.test("eel: unparseable source is rejected rather than half-run", () => {
  // A block that silently drops its tail renders a plausible but wrong image,
  // which is harder to notice than a preset that simply does not animate.
  assertThrows(() => compileEel("a = ;", new EelScope()), SyntaxError);
  assertThrows(() => compileEel("a = nosuchfunction(1);", new EelScope()), SyntaxError);
  assertThrows(() => compileEel("a b = 2;", new EelScope()), SyntaxError);
  assertThrows(() => compileEel("a = (1 + 2;", new EelScope()), SyntaxError);

  assertEquals(tryCompileEel("a = ;", new EelScope()), undefined);
  assertEquals(tryCompileEel("   ", new EelScope()), undefined, "empty source has nothing to run");
  assert(tryCompileEel("a = 1;", new EelScope()) !== undefined);
});

Deno.test("eel: reports which names a block assigns", () => {
  const scope = new EelScope();
  const program = compileEel("zoom = 1.1; rot = rot + 0.1; unread = zoom * 2;", scope);
  assertEquals([...program.assigns].sort(), ["rot", "unread", "zoom"]);
});
