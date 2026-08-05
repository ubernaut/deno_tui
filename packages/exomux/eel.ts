// Copyright 2023 Im-Beast. MIT license.

// A small interpreter for the EEL2 expression language MilkDrop presets are
// written in.
//
// Every Butterchurn preset carries three equation blocks — `init_eqs` run once,
// `frame_eqs` run per frame, `pixel_eqs` run per warp-mesh vertex — written in
// Nullsoft's EEL2. They are what make a preset move: `zoom` pulsing with bass,
// `wave_r` cycling with time, `rot` driven by an accumulator. Without them a
// preset is a static parameter dump and every preset looks like every other.
//
// The language is small. Across the 293-preset base+extra catalog it uses one
// statement form (assignment), the usual arithmetic and comparison operators,
// and about thirty builtins. This implements that surface and nothing more.
//
// Source is compiled to a tree of closures over a shared `Float64Array` of
// variable slots, resolved at compile time. `pixel_eqs` run once per mesh
// vertex per frame, so name lookup in the hot path would dominate.

// ── values ──────────────────────────────────────────────────────────────────

/** A compiled expression, reading and writing the scope it was compiled for. */
type Node = (memory: Float64Array) => number;

/** Deterministic source for `rand`; presets that use it stay reproducible. */
export interface EelRandom {
  (): number;
}

/**
 * The variable pool one preset's equations share.
 *
 * MilkDrop keeps per-preset variables alive between frames — an accumulator
 * assigned in `frame_eqs` still holds its value next frame — so the scope
 * outlives any single program and is owned by the caller.
 */
export class EelScope {
  readonly #slots = new Map<string, number>();
  #memory = new Float64Array(64);
  #used = 0;
  /** `megabuf`/`gmegabuf` backing store; presets index it sparsely. */
  readonly #buffers: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];
  random: EelRandom;

  constructor(random: EelRandom = Math.random) {
    this.random = random;
  }

  /** Slot index for a name, allocating one the first time it is seen. */
  slot(name: string): number {
    const existing = this.#slots.get(name);
    if (existing !== undefined) return existing;
    const slot = this.#used;
    this.#used += 1;
    if (this.#used > this.#memory.length) {
      const grown = new Float64Array(this.#memory.length * 2);
      grown.set(this.#memory);
      this.#memory = grown;
    }
    this.#slots.set(name, slot);
    return slot;
  }

  /** Backing array; the reference changes when the pool grows, so re-read it. */
  get memory(): Float64Array {
    return this.#memory;
  }

  get(name: string): number {
    // The slot must be resolved before `#memory` is read: allocating a new one
    // can replace the backing store, and JavaScript evaluates the array
    // reference of `a[b()]` before the index, so the fetch would land on the
    // old, shorter array and read undefined.
    const slot = this.slot(name);
    return this.#memory[slot]!;
  }

  set(name: string, value: number): void {
    const slot = this.slot(name);
    this.#memory[slot] = Number.isFinite(value) ? value : 0;
  }

  /** True when the preset ever mentioned this name; reads are not allocating. */
  has(name: string): boolean {
    return this.#slots.has(name);
  }

  buffer(global: boolean): Map<number, number> {
    return this.#buffers[global ? 1 : 0];
  }

  /** Clears variables and buffers, e.g. when a preset is reloaded. */
  reset(): void {
    this.#memory.fill(0);
    this.#buffers[0].clear();
    this.#buffers[1].clear();
  }
}

/** A compiled equation block, bound to the scope it was compiled against. */
export interface EelProgram {
  run(): void;
  /** Names the block assigns to; lets callers skip reading untouched outputs. */
  readonly assigns: ReadonlySet<string>;
}

// ── lexer ───────────────────────────────────────────────────────────────────

type TokenKind = "number" | "name" | "punct" | "end";

interface Token {
  readonly kind: TokenKind;
  readonly text: string;
  readonly value: number;
  readonly at: number;
}

/** Multi-character operators, longest first so `<=` wins over `<`. */
const PUNCTUATORS: readonly string[] = Object.freeze([
  "||",
  "&&",
  "==",
  "!=",
  "<=",
  ">=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "(",
  ")",
  ",",
  ";",
  "=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "<",
  ">",
  "&",
  "|",
  "!",
  "?",
  ":",
]);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    if (char === " " || char === "\t" || char === "\r" || char === "\n") {
      index += 1;
      continue;
    }
    if (char === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      const close = source.indexOf("*/", index + 2);
      index = close === -1 ? source.length : close + 2;
      continue;
    }
    if ((char >= "0" && char <= "9") || (char === "." && isDigit(source[index + 1]))) {
      const start = index;
      while (index < source.length && isNumeric(source[index]!)) index += 1;
      // Exponent, e.g. `1e-3`. Only consume the sign when a digit follows it.
      if (
        (source[index] === "e" || source[index] === "E") &&
        (isDigit(source[index + 1]) ||
          ((source[index + 1] === "+" || source[index + 1] === "-") && isDigit(source[index + 2])))
      ) {
        index += 2;
        while (index < source.length && isDigit(source[index])) index += 1;
      }
      const text = source.slice(start, index);
      tokens.push({ kind: "number", text, value: Number(text), at: start });
      continue;
    }
    if (isNameStart(char)) {
      const start = index;
      while (index < source.length && isNamePart(source[index]!)) index += 1;
      // EEL is case-insensitive; one catalog preset writes `Sin(`.
      tokens.push({ kind: "name", text: source.slice(start, index).toLowerCase(), value: 0, at: start });
      continue;
    }
    const punct = PUNCTUATORS.find((candidate) => source.startsWith(candidate, index));
    if (!punct) throw new SyntaxError(`Unexpected character ${JSON.stringify(char)} at ${index}`);
    tokens.push({ kind: "punct", text: punct, value: 0, at: index });
    index += punct.length;
  }
  tokens.push({ kind: "end", text: "", value: 0, at: source.length });
  return tokens;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function isNumeric(char: string): boolean {
  return isDigit(char) || char === ".";
}

function isNameStart(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
}

function isNamePart(char: string): boolean {
  return isNameStart(char) || isDigit(char);
}

// ── builtins ────────────────────────────────────────────────────────────────

/** Guards every division and modulo; EEL yields 0 rather than a non-finite. */
function safeDivide(left: number, right: number): number {
  return right === 0 ? 0 : left / right;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Builtins taking a fixed argument count and evaluating all of them. */
const STRICT_BUILTINS: Readonly<Record<string, { arity: number; apply: (args: number[]) => number }>> = Object.freeze({
  sin: { arity: 1, apply: (a) => Math.sin(a[0]!) },
  cos: { arity: 1, apply: (a) => Math.cos(a[0]!) },
  tan: { arity: 1, apply: (a) => Math.tan(a[0]!) },
  asin: { arity: 1, apply: (a) => Math.asin(clampUnit(a[0]!)) },
  acos: { arity: 1, apply: (a) => Math.acos(clampUnit(a[0]!)) },
  atan: { arity: 1, apply: (a) => Math.atan(a[0]!) },
  atan2: { arity: 2, apply: (a) => Math.atan2(a[0]!, a[1]!) },
  abs: { arity: 1, apply: (a) => Math.abs(a[0]!) },
  sqrt: { arity: 1, apply: (a) => Math.sqrt(Math.abs(a[0]!)) },
  sqr: { arity: 1, apply: (a) => a[0]! * a[0]! },
  pow: { arity: 2, apply: (a) => finite(Math.pow(a[0]!, a[1]!)) },
  exp: { arity: 1, apply: (a) => finite(Math.exp(a[0]!)) },
  log: { arity: 1, apply: (a) => (a[0]! > 0 ? Math.log(a[0]!) : 0) },
  log10: { arity: 1, apply: (a) => (a[0]! > 0 ? Math.log10(a[0]!) : 0) },
  min: { arity: 2, apply: (a) => Math.min(a[0]!, a[1]!) },
  max: { arity: 2, apply: (a) => Math.max(a[0]!, a[1]!) },
  int: { arity: 1, apply: (a) => Math.floor(a[0]!) },
  floor: { arity: 1, apply: (a) => Math.floor(a[0]!) },
  ceil: { arity: 1, apply: (a) => Math.ceil(a[0]!) },
  sign: { arity: 1, apply: (a) => Math.sign(a[0]!) },
  // MilkDrop's comparison helpers return 1 or 0 rather than a boolean.
  above: { arity: 2, apply: (a) => (a[0]! > a[1]! ? 1 : 0) },
  below: { arity: 2, apply: (a) => (a[0]! < a[1]! ? 1 : 0) },
  equal: { arity: 2, apply: (a) => (a[0]! === a[1]! ? 1 : 0) },
  bnot: { arity: 1, apply: (a) => (a[0]! === 0 ? 1 : 0) },
  band: { arity: 2, apply: (a) => (a[0]! !== 0 && a[1]! !== 0 ? 1 : 0) },
  bor: { arity: 2, apply: (a) => (a[0]! !== 0 || a[1]! !== 0 ? 1 : 0) },
  sigmoid: { arity: 2, apply: (a) => finite(1 / (1 + Math.exp(-a[0]! * a[1]!))) },
  invsqrt: { arity: 1, apply: (a) => (a[0]! > 0 ? 1 / Math.sqrt(a[0]!) : 0) },
});

function clampUnit(value: number): number {
  return value > 1 ? 1 : value < -1 ? -1 : value;
}

/** Highest index a preset may address in `megabuf`/`gmegabuf`. */
const MAX_BUFFER_INDEX = 1 << 20;

// ── parser and compiler ─────────────────────────────────────────────────────

/**
 * Binding power of each binary operator, loosest first. EEL follows C here
 * apart from `^`, which is exponentiation rather than xor.
 */
const BINARY_PRECEDENCE: Readonly<Record<string, number>> = Object.freeze({
  "||": 1,
  "&&": 2,
  "|": 3,
  "&": 4,
  "==": 5,
  "!=": 5,
  "<": 6,
  "<=": 6,
  ">": 6,
  ">=": 6,
  "+": 7,
  "-": 7,
  "*": 8,
  "/": 8,
  "%": 8,
  "^": 10,
});

const ASSIGN_OPERATORS: Readonly<Record<string, (left: number, right: number) => number>> = Object.freeze({
  "=": (_left, right) => right,
  "+=": (left, right) => left + right,
  "-=": (left, right) => left - right,
  "*=": (left, right) => left * right,
  "/=": (left, right) => safeDivide(left, right),
  "%=": (left, right) => (right === 0 ? 0 : left % right),
});

class Parser {
  #tokens: Token[];
  #index = 0;
  readonly #scope: EelScope;
  readonly assigns = new Set<string>();

  constructor(source: string, scope: EelScope) {
    this.#tokens = tokenize(source);
    this.#scope = scope;
  }

  get #current(): Token {
    return this.#tokens[this.#index]!;
  }

  #take(text: string): boolean {
    if (this.#current.kind === "punct" && this.#current.text === text) {
      this.#index += 1;
      return true;
    }
    return false;
  }

  #expect(text: string): void {
    if (!this.#take(text)) {
      throw new SyntaxError(`Expected ${JSON.stringify(text)} at offset ${this.#current.at}`);
    }
  }

  /** Parses the whole source into one node evaluating every statement. */
  parseProgram(): Node {
    const statements: Node[] = [];
    for (;;) {
      if (this.#atEnd()) break;
      if (this.#take(";")) continue;
      statements.push(this.#parseExpression(0));
      // A trailing statement may omit its semicolon.
      if (!this.#take(";") && !this.#atEnd()) {
        throw new SyntaxError(`Expected ";" at offset ${this.#current.at}`);
      }
    }
    return sequence(statements);
  }

  #atEnd(): boolean {
    return this.#tokens[this.#index]!.kind === "end";
  }

  #parseExpression(minimumPrecedence: number): Node {
    let left = this.#parseUnary();

    // Assignment is right-associative and binds loosest, so it is handled
    // before the binary loop rather than inside the precedence table.
    if (this.#current.kind === "punct" && this.#current.text in ASSIGN_OPERATORS && minimumPrecedence === 0) {
      const operator = this.#current.text;
      const target = this.#pendingTarget;
      if (!target) throw new SyntaxError(`Cannot assign at offset ${this.#current.at}`);
      this.#index += 1;
      const value = this.#parseExpression(0);
      return this.#compileAssignment(target, operator, value);
    }

    for (;;) {
      const token = this.#current;
      if (token.kind !== "punct") break;
      const precedence = BINARY_PRECEDENCE[token.text];
      if (precedence === undefined || precedence < minimumPrecedence) break;
      this.#index += 1;
      // `^` is right-associative; everything else is left.
      const right = this.#parseExpression(token.text === "^" ? precedence : precedence + 1);
      left = binary(token.text, left, right);
      this.#pendingTarget = undefined;
    }

    // Ternary binds looser than every binary operator but tighter than
    // assignment, so it is resolved after the precedence loop.
    if (minimumPrecedence <= 1 && this.#take("?")) {
      const whenTrue = this.#parseExpression(1);
      this.#expect(":");
      const whenFalse = this.#parseExpression(1);
      const condition = left;
      this.#pendingTarget = undefined;
      return (memory) => (condition(memory) !== 0 ? whenTrue(memory) : whenFalse(memory));
    }
    return left;
  }

  /** Set by `#parseUnary` when the parsed value could be an assignment target. */
  #pendingTarget: AssignTarget | undefined;

  #parseUnary(): Node {
    this.#pendingTarget = undefined;
    const token = this.#current;
    if (token.kind === "punct" && token.text === "-") {
      this.#index += 1;
      const operand = this.#parseUnary();
      this.#pendingTarget = undefined;
      return (memory) => -operand(memory);
    }
    if (token.kind === "punct" && token.text === "+") {
      this.#index += 1;
      return this.#parseUnary();
    }
    if (token.kind === "punct" && token.text === "!") {
      this.#index += 1;
      const operand = this.#parseUnary();
      this.#pendingTarget = undefined;
      return (memory) => (operand(memory) === 0 ? 1 : 0);
    }
    return this.#parsePrimary();
  }

  #parsePrimary(): Node {
    const token = this.#current;
    if (token.kind === "number") {
      this.#index += 1;
      const value = token.value;
      return () => value;
    }
    if (token.kind === "punct" && token.text === "(") {
      this.#index += 1;
      const parts = this.#parseSeparatedList(")");
      this.#pendingTarget = undefined;
      return parts.length === 1 ? parts[0]! : sequence(parts);
    }
    if (token.kind === "name") {
      this.#index += 1;
      const name = token.text;
      if (this.#take("(")) return this.#parseCall(name);
      const slot = this.#scope.slot(name);
      this.#pendingTarget = { kind: "variable", name, slot };
      return (memory) => memory[slot]!;
    }
    throw new SyntaxError(`Unexpected token ${JSON.stringify(token.text)} at offset ${token.at}`);
  }

  /**
   * Parses expressions up to `close`, separated by `,` or `;`.
   *
   * EEL treats both as sequencing inside parentheses, which is how presets
   * write multi-statement loop bodies: `loop(n, a = 1; b = 2;)`. A separator
   * immediately before the closing paren is allowed and contributes nothing.
   */
  #parseSeparatedList(close: string): Node[] {
    const parts: Node[] = [];
    for (;;) {
      // Runs of separators are empty statements. Catalog presets produce them
      // freely, e.g. `loop(n, a = 1; , b)` where a body ends in `;` and the
      // next argument still leads with `,`.
      while (this.#take(",") || this.#take(";"));
      if (this.#take(close)) break;
      parts.push(this.#parseExpression(0));
      if (this.#take(close)) break;
      if (!this.#peek(",") && !this.#peek(";")) {
        this.#expect(close);
        break;
      }
    }
    return parts;
  }

  #peek(text: string): boolean {
    const token = this.#tokens[this.#index]!;
    return token.kind === "punct" && token.text === text;
  }

  #parseCall(name: string): Node {
    const args = this.#parseSeparatedList(")");

    if (name === "megabuf" || name === "gmegabuf") {
      if (args.length !== 1) throw new SyntaxError(`${name} takes one argument`);
      const index = args[0]!;
      const buffer = this.#scope.buffer(name === "gmegabuf");
      this.#pendingTarget = { kind: "buffer", index, buffer };
      return (memory) => buffer.get(bufferIndex(index(memory))) ?? 0;
    }
    this.#pendingTarget = undefined;

    // Lazy forms: `if` must not evaluate the branch it does not take, because
    // presets rely on it to guard divisions and out-of-range roots.
    if (name === "if") {
      if (args.length < 2) throw new SyntaxError("if takes a condition and at least one branch");
      const condition = args[0]!;
      const whenTrue = args[1]!;
      // A few catalog presets write the two-argument form; MilkDrop treats the
      // missing else branch as zero.
      const whenFalse = args[2] ?? ZERO;
      return (memory) => (condition(memory) !== 0 ? whenTrue(memory) : whenFalse(memory));
    }
    if (name === "exec2" || name === "exec3" || name === "execute") return sequence(args);
    if (name === "loop") {
      if (args.length < 2) throw new SyntaxError("loop takes a count and a body");
      const count = args[0]!;
      const body = sequence(args.slice(1));
      return (memory) => {
        const times = Math.min(MAX_LOOP_ITERATIONS, Math.floor(count(memory)));
        let last = 0;
        for (let step = 0; step < times; step += 1) last = body(memory);
        return last;
      };
    }
    if (name === "while") {
      const body = sequence(args);
      return (memory) => {
        let last = 0;
        for (let step = 0; step < MAX_LOOP_ITERATIONS; step += 1) {
          last = body(memory);
          if (last === 0) break;
        }
        return last;
      };
    }
    if (name === "rand") {
      const bound = args[0];
      const scope = this.#scope;
      return bound === undefined ? () => scope.random() : (memory) => scope.random() * Math.max(0, bound(memory));
    }

    const builtin = STRICT_BUILTINS[name];
    if (!builtin) throw new SyntaxError(`Unknown function ${JSON.stringify(name)}`);
    if (args.length < builtin.arity) throw new SyntaxError(`${name} takes ${builtin.arity} arguments`);
    const values = new Array<number>(builtin.arity).fill(0);
    const nodes = args.slice(0, builtin.arity);
    const apply = builtin.apply;
    return (memory) => {
      for (let index = 0; index < nodes.length; index += 1) values[index] = nodes[index]!(memory);
      return finite(apply(values));
    };
  }

  #compileAssignment(target: AssignTarget, operator: string, value: Node): Node {
    const combine = ASSIGN_OPERATORS[operator]!;
    if (target.kind === "variable") {
      this.assigns.add(target.name);
      const slot = target.slot;
      return (memory) => {
        const next = finite(combine(memory[slot]!, value(memory)));
        memory[slot] = next;
        return next;
      };
    }
    const { index, buffer } = target;
    return (memory) => {
      const at = bufferIndex(index(memory));
      const next = finite(combine(buffer.get(at) ?? 0, value(memory)));
      buffer.set(at, next);
      return next;
    };
  }
}

type AssignTarget =
  | { kind: "variable"; name: string; slot: number }
  | { kind: "buffer"; index: Node; buffer: Map<number, number> };

/**
 * Bounds a `while`/`loop` so a malformed preset cannot hang the desktop.
 *
 * Well under MilkDrop's million-entry `megabuf`, which several presets clear
 * with `loop(1024*1024, gmegabuf(i) = 0; i = i + 1;)` at init. That is a no-op
 * here — the buffers are sparse maps that already read as zero — so truncating
 * it costs nothing and saves tens of milliseconds on every preset change.
 */
const MAX_LOOP_ITERATIONS = 65_536;

function bufferIndex(value: number): number {
  const index = Math.floor(value);
  if (!Number.isFinite(index) || index < 0) return 0;
  return index > MAX_BUFFER_INDEX ? MAX_BUFFER_INDEX : index;
}

/** The constant zero, used for omitted optional branches. */
const ZERO: Node = () => 0;

function sequence(nodes: readonly Node[]): Node {
  if (nodes.length === 0) return () => 0;
  if (nodes.length === 1) return nodes[0]!;
  const parts = [...nodes];
  return (memory) => {
    let last = 0;
    for (let index = 0; index < parts.length; index += 1) last = parts[index]!(memory);
    return last;
  };
}

function binary(operator: string, left: Node, right: Node): Node {
  switch (operator) {
    case "+":
      return (memory) => left(memory) + right(memory);
    case "-":
      return (memory) => left(memory) - right(memory);
    case "*":
      return (memory) => left(memory) * right(memory);
    case "/":
      return (memory) => safeDivide(left(memory), right(memory));
    case "%": {
      return (memory) => {
        const divisor = right(memory);
        return divisor === 0 ? 0 : left(memory) % divisor;
      };
    }
    case "^":
      return (memory) => finite(Math.pow(left(memory), right(memory)));
    case "==":
      return (memory) => (left(memory) === right(memory) ? 1 : 0);
    case "!=":
      return (memory) => (left(memory) !== right(memory) ? 1 : 0);
    case "<":
      return (memory) => (left(memory) < right(memory) ? 1 : 0);
    case "<=":
      return (memory) => (left(memory) <= right(memory) ? 1 : 0);
    case ">":
      return (memory) => (left(memory) > right(memory) ? 1 : 0);
    case ">=":
      return (memory) => (left(memory) >= right(memory) ? 1 : 0);
    case "&&":
      return (memory) => (left(memory) !== 0 && right(memory) !== 0 ? 1 : 0);
    case "||":
      return (memory) => (left(memory) !== 0 || right(memory) !== 0 ? 1 : 0);
    // EEL's bitwise operators coerce through int, which presets use as flags.
    case "&":
      return (memory) => (left(memory) | 0) & (right(memory) | 0);
    case "|":
      return (memory) => (left(memory) | 0) | (right(memory) | 0);
    default:
      throw new SyntaxError(`Unknown operator ${JSON.stringify(operator)}`);
  }
}

/**
 * Compiles one equation block against `scope`.
 *
 * Throws `SyntaxError` on anything it does not understand rather than silently
 * dropping statements: a preset that half-runs is worse than one that is
 * skipped, because it renders as a plausible but wrong image.
 */
export function compileEel(source: string, scope: EelScope): EelProgram {
  const parser = new Parser(source, scope);
  const program = parser.parseProgram();
  const assigns = parser.assigns;
  return {
    assigns,
    // Read through the scope rather than capturing the array: allocating a slot
    // for a later block can replace the backing store with a larger one.
    run(): void {
      program(scope.memory);
    },
  };
}

/** Compiles a block, returning undefined when the source will not parse. */
export function tryCompileEel(source: string, scope: EelScope): EelProgram | undefined {
  if (!source.trim()) return undefined;
  try {
    return compileEel(source, scope);
  } catch {
    return undefined;
  }
}
