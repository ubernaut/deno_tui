// SPIKE: translates a MilkDrop preset `shader_body` from GLSL to WGSL.
//
// Preset shaders ship already converted from HLSL to GLSL ES 3.0 upstream, and
// the surviving subset is small: declarations, assignments, swizzles, if/else,
// a handful of for loops, and about twenty builtins. This covers that surface.
//
// The one structural difference that matters is swizzle assignment. GLSL allows
// `v.xyz = e;`; WGSL only permits assigning a single component, so those are
// expanded into per-component writes through a temporary.

type Kind = "name" | "number" | "punct" | "end";
interface Token {
  kind: Kind;
  text: string;
  at: number;
}

const PUNCT = [
  "<<=",
  ">>=",
  "&&",
  "||",
  "^^",
  "==",
  "!=",
  "<=",
  ">=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "++",
  "--",
  "<<",
  ">>",
  "(",
  ")",
  "{",
  "}",
  "[",
  "]",
  ",",
  ";",
  "=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "!",
  "?",
  ":",
  ".",
  "&",
  "|",
  "^",
  "~",
];

function lex(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      i = e === -1 ? src.length : e + 2;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const start = i;
      while (i < src.length && /[0-9.]/.test(src[i]!)) i += 1;
      if (/[eE]/.test(src[i] ?? "")) {
        i += 1;
        if (/[+-]/.test(src[i] ?? "")) i += 1;
        while (i < src.length && /[0-9]/.test(src[i]!)) i += 1;
      }
      // GLSL float suffixes have no WGSL equivalent; drop them.
      if (/[fFuU]/.test(src[i] ?? "")) i += 1;
      out.push({ kind: "number", text: src.slice(start, i).replace(/[fFuU]$/, ""), at: start });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i]!)) i += 1;
      out.push({ kind: "name", text: src.slice(start, i), at: start });
      continue;
    }
    const p = PUNCT.find((cand) => src.startsWith(cand, i));
    if (!p) throw new SyntaxError(`glsl: unexpected ${JSON.stringify(c)} at ${i}`);
    out.push({ kind: "punct", text: p, at: i });
    i += p.length;
  }
  out.push({ kind: "end", text: "", at: src.length });
  return out;
}

const TYPES: Record<string, string> = {
  float: "f32",
  int: "i32",
  uint: "u32",
  bool: "bool",
  vec2: "vec2<f32>",
  vec3: "vec3<f32>",
  vec4: "vec4<f32>",
  ivec2: "vec2<i32>",
  ivec3: "vec3<i32>",
  ivec4: "vec4<i32>",
  bvec2: "vec2<bool>",
  bvec3: "vec3<bool>",
  bvec4: "vec4<bool>",
  mat2: "mat2x2<f32>",
  mat3: "mat3x3<f32>",
  mat4: "mat4x4<f32>",
};

/** Builtins whose GLSL name differs from WGSL's. */
const RENAMED: Record<string, string> = {
  inversesqrt: "inverseSqrt",
  dFdx: "dpdx",
  dFdy: "dpdy",
  fma: "fma",
  atan: "atan", // one-argument form; the two-argument form becomes atan2
};

/** Builtins that pass straight through. */
const PASSTHROUGH = new Set([
  "abs",
  "acos",
  "asin",
  "atan2",
  "ceil",
  "clamp",
  "cos",
  "cosh",
  "cross",
  "degrees",
  "distance",
  "dot",
  "exp",
  "exp2",
  "faceForward",
  "floor",
  "fract",
  "length",
  "log",
  "log2",
  "max",
  "min",
  "mix",
  "normalize",
  "pow",
  "radians",
  "reflect",
  "refract",
  "round",
  "sign",
  "sin",
  "sinh",
  "smoothstep",
  "sqrt",
  "step",
  "tan",
  "tanh",
  "trunc",
  "saturate",
]);

/** Samplers the template exposes; each becomes a texture/sampler pair. */
export const SAMPLERS = [
  "sampler_main",
  "sampler_fc_main",
  "sampler_fw_main",
  "sampler_pc_main",
  "sampler_pw_main",
  "sampler_blur1",
  "sampler_blur2",
  "sampler_blur3",
  "sampler_noise_lq",
  "sampler_noise_lq_lite",
  "sampler_noise_mq",
  "sampler_noise_hq",
  "sampler_pw_noise_lq",
  "sampler_noisevol_lq",
  "sampler_noisevol_hq",
];
const SAMPLER_SET = new Set(SAMPLERS);

class Translator {
  #tokens: Token[];
  #i = 0;
  #temp = 0;
  /** Samplers this body actually referenced, so bindings can be minimal. */
  readonly used = new Set<string>();
  /** Samplers the preset declared itself, which need a placeholder texture. */
  readonly custom = new Set<string>();

  constructor(src: string) {
    this.#tokens = lex(src);
  }

  get #tok(): Token {
    return this.#tokens[this.#i]!;
  }

  #take(text: string): boolean {
    if (this.#tok.kind === "punct" && this.#tok.text === text) {
      this.#i += 1;
      return true;
    }
    return false;
  }

  #expect(text: string): void {
    if (!this.#take(text)) throw new SyntaxError(`glsl: expected ${text} near offset ${this.#tok.at}`);
  }

  #peek(text: string): boolean {
    const token = this.#tokens[this.#i]!;
    return token.kind === "punct" && token.text === text;
  }

  #isType(): boolean {
    return this.#tok.kind === "name" && this.#tok.text in TYPES &&
      this.#tokens[this.#i + 1]?.kind === "name";
  }

  /** Translates a whole `shader_body { ... }` into WGSL statements. */
  translateBody(): string {
    // A third of the catalog hoists scratch variables above the body, as
    // `vec3 xlat_mutableneu;` — the GLSL optimizer's doing. They are
    // per-invocation temporaries despite being written at file scope, so they
    // become locals rather than module-scope `var`, which WGSL would require an
    // address space for anyway.
    const hoisted: string[] = [];
    while (this.#tok.kind !== "end" && !(this.#tok.kind === "name" && this.#tok.text === "shader_body")) {
      hoisted.push(this.#statement());
    }
    if (this.#tok.kind === "name" && this.#tok.text === "shader_body") this.#i += 1;
    const statements = this.#take("{") ? this.#block() : this.#statementsUntilEnd();
    return hoisted.length > 0 ? `${hoisted.join("\n")}\n${statements}` : statements;
  }

  #statementsUntilEnd(): string {
    const parts: string[] = [];
    while (this.#tok.kind !== "end") parts.push(this.#statement());
    return parts.join("\n");
  }

  #block(): string {
    const parts: string[] = [];
    while (!this.#take("}")) {
      if (this.#tok.kind === "end") throw new SyntaxError("glsl: unterminated block");
      parts.push(this.#statement());
    }
    return parts.join("\n");
  }

  #statement(): string {
    if (this.#take(";")) return "";
    if (this.#take("{")) return `{\n${this.#block()}\n}`;

    if (this.#tok.kind === "name") {
      const word = this.#tok.text;
      if (word === "if") {
        this.#i += 1;
        this.#expect("(");
        const cond = this.#expression(0);
        this.#expect(")");
        const then = this.#statement();
        if (this.#tok.kind === "name" && this.#tok.text === "else") {
          this.#i += 1;
          return `if (${cond}) {\n${then}\n} else {\n${this.#statement()}\n}`;
        }
        return `if (${cond}) {\n${then}\n}`;
      }
      if (word === "for") {
        this.#i += 1;
        this.#expect("(");
        const init = this.#take(";") ? "" : this.#statement();
        const cond = this.#peek(";") ? "true" : this.#expression(0);
        this.#expect(";");
        const step = this.#peek(")") ? "" : this.#simpleStatement();
        this.#expect(")");
        return `${init}\nloop {\n  if (!(${cond})) { break; }\n${this.#statement()}\n  ${step}\n}`;
      }
      if (word === "while") {
        this.#i += 1;
        this.#expect("(");
        const cond = this.#expression(0);
        this.#expect(")");
        return `loop {\n  if (!(${cond})) { break; }\n${this.#statement()}\n}`;
      }
      if (word === "return") {
        this.#i += 1;
        if (this.#take(";")) return "return;";
        const value = this.#expression(0);
        this.#expect(";");
        return `return ${value};`;
      }
      if (word === "discard") {
        this.#i += 1;
        this.#take(";");
        return "discard;";
      }
      if (word === "break" || word === "continue") {
        this.#i += 1;
        this.#take(";");
        return `${word};`;
      }
    }

    const out = this.#simpleStatement();
    this.#expect(";");
    return out;
  }

  /** A declaration or assignment, without its trailing semicolon. */
  #simpleStatement(): string {
    // `uniform sampler2D sampler_cells;` — a preset asking for a texture from
    // an image pack we do not ship. Recorded so the caller can bind a
    // placeholder, and otherwise dropped.
    if (this.#tok.kind === "name" && (this.#tok.text === "uniform" || this.#tok.text === "varying")) {
      this.#i += 1;
      let last = "";
      while (this.#tok.kind === "name") {
        last = this.#tok.text;
        this.#i += 1;
      }
      if (last) this.custom.add(last);
      return "";
    }
    if (this.#isType()) {
      const glslType = this.#tok.text;
      this.#i += 1;
      const parts: string[] = [];
      do {
        const name = this.#tok.text;
        this.#i += 1;
        if (this.#take("=")) parts.push(`var ${name}: ${TYPES[glslType]!} = ${this.#expression(0)};`);
        else parts.push(`var ${name}: ${TYPES[glslType]!};`);
      } while (this.#take(","));
      return parts.join("\n");
    }

    // Assignment, possibly to a swizzle.
    const start = this.#i;
    const target = this.#unary();
    if (this.#peek("++") || this.#peek("--")) {
      const step = this.#tokens[this.#i]!.text === "++" ? "+" : "-";
      this.#i += 1;
      return `${target} = ${target} ${step} 1;`;
    }
    const op = this.#tok;
    if (op.kind === "punct" && ["=", "+=", "-=", "*=", "/="].includes(op.text)) {
      this.#i += 1;
      const value = this.#expression(0);
      return this.#assign(target, op.text, value);
    }
    this.#i = start;
    // A bare expression statement; WGSL needs it bound to something.
    const expr = this.#expression(0);
    return `_ = ${expr};`;
  }

  /**
   * WGSL forbids assigning to a multi-component swizzle, so `v.xyz = e` is
   * expanded into per-component writes through a temporary.
   */
  #assign(target: string, op: string, value: string): string {
    const match = /^(.*)\.([xyzwrgbastpq]{2,4})$/.exec(target);
    if (!match) return `${target} ${op} ${value};`;
    const base = match[1]!;
    const swizzle = [...match[2]!];
    const temp = `_sw${this.#temp++}`;
    const lines = [`let ${temp} = ${op === "=" ? value : `(${target}) ${op[0]} (${value})`};`];
    swizzle.forEach((component, index) => {
      const to = NORMALIZE[component] ?? component;
      lines.push(`${base}.${to} = ${temp}[${index}];`);
    });
    return lines.join("\n");
  }

  #expression(min: number): string {
    let left = this.#unary();
    for (;;) {
      const tok = this.#tok;
      if (tok.kind !== "punct") break;
      const prec = BINARY[tok.text];
      if (prec === undefined || prec < min) break;
      this.#i += 1;
      const right = this.#expression(prec + 1);
      left = `(${left} ${tok.text} ${right})`;
    }
    if (min <= 1 && this.#take("?")) {
      const yes = this.#expression(0);
      this.#expect(":");
      const no = this.#expression(1);
      return `select(${no}, ${yes}, ${left})`;
    }
    return left;
  }

  #unary(): string {
    const tok = this.#tok;
    if (tok.kind === "punct" && (tok.text === "-" || tok.text === "!" || tok.text === "+" || tok.text === "~")) {
      this.#i += 1;
      const operand = this.#unary();
      return tok.text === "+" ? operand : `${tok.text}(${operand})`;
    }
    return this.#postfix(this.#primary());
  }

  #postfix(base: string): string {
    for (;;) {
      if (this.#take(".")) {
        const field = this.#tok.text;
        this.#i += 1;
        base = `${base}.${[...field].map((c) => NORMALIZE[c] ?? c).join("")}`;
        continue;
      }
      if (this.#take("[")) {
        const index = this.#expression(0);
        this.#expect("]");
        base = `${base}[${index}]`;
        continue;
      }
      break;
    }
    return base;
  }

  #primary(): string {
    const tok = this.#tok;
    if (tok.kind === "number") {
      this.#i += 1;
      // WGSL will not implicitly widen an integer literal in every position, so
      // anything that was a float in GLSL stays a float here.
      return tok.text.includes(".") || /[eE]/.test(tok.text) ? tok.text : `${tok.text}.0`;
    }
    if (tok.kind === "punct" && tok.text === "(") {
      this.#i += 1;
      const inner = this.#expression(0);
      this.#expect(")");
      return `(${inner})`;
    }
    if (tok.kind === "name") {
      const name = tok.text;
      this.#i += 1;
      if (this.#take("(")) return this.#call(name);
      if (name === "true" || name === "false") return name;
      if (SAMPLER_SET.has(name)) this.used.add(name);
      return name;
    }
    throw new SyntaxError(`glsl: unexpected ${JSON.stringify(tok.text)} at ${tok.at}`);
  }

  #call(name: string): string {
    const args: string[] = [];
    if (!this.#take(")")) {
      do args.push(this.#expression(0)); while (this.#take(","));
      this.#expect(")");
    }

    if (name === "texture" || name === "texture2D" || name === "texture3D") {
      const sampler = args[0]!.trim();
      this.used.add(sampler);
      // Sampling in a fragment shader with an explicit level keeps the call
      // uniform-safe inside the conditionals presets like to wrap it in.
      return `textureSampleLevel(${sampler}_tex, ${sampler}_smp, ${args[1]}, 0.0)`;
    }
    if (name === "textureLod") {
      const sampler = args[0]!.trim();
      this.used.add(sampler);
      return `textureSampleLevel(${sampler}_tex, ${sampler}_smp, ${args[1]}, ${args[2] ?? "0.0"})`;
    }
    if (name in TYPES) return `${TYPES[name]!}(${args.join(", ")})`;
    if (name === "mod") return `((${args[0]}) - (${args[1]}) * floor((${args[0]}) / (${args[1]})))`;
    if (name === "atan") return args.length === 2 ? `atan2(${args[0]}, ${args[1]})` : `atan(${args[0]})`;
    if (name === "greaterThan") return `((${args[0]}) > (${args[1]}))`;
    if (name === "greaterThanEqual") return `((${args[0]}) >= (${args[1]}))`;
    if (name === "lessThan") return `((${args[0]}) < (${args[1]}))`;
    if (name === "lessThanEqual") return `((${args[0]}) <= (${args[1]}))`;
    if (name === "equal") return `((${args[0]}) == (${args[1]}))`;
    if (name === "notEqual") return `((${args[0]}) != (${args[1]}))`;
    if (name === "any" || name === "all") return `${name}(${args.join(", ")})`;
    if (name in RENAMED) return `${RENAMED[name]!}(${args.join(", ")})`;
    if (PASSTHROUGH.has(name)) return `${name}(${args.join(", ")})`;
    throw new SyntaxError(`glsl: unsupported function ${name}`);
  }
}

/** `rgba`/`stpq` swizzles normalised to `xyzw`. */
const NORMALIZE: Record<string, string> = {
  r: "x",
  g: "y",
  b: "z",
  a: "w",
  s: "x",
  t: "y",
  p: "z",
  q: "w",
  x: "x",
  y: "y",
  z: "z",
  w: "w",
};

const BINARY: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "|": 3,
  "^": 4,
  "&": 5,
  "==": 6,
  "!=": 6,
  "<": 7,
  "<=": 7,
  ">": 7,
  ">=": 7,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 10,
};

export interface TranslatedShader {
  readonly body: string;
  readonly samplers: readonly string[];
  /** Samplers the preset declared itself; these have no texture to bind. */
  readonly custom: readonly string[];
}

/** Translates one preset shader body; throws on anything unsupported. */
export function translateShaderBody(source: string): TranslatedShader {
  const translator = new Translator(source);
  const body = translator.translateBody();
  const used = [...translator.used];
  return {
    body,
    samplers: used.filter((name) => SAMPLER_SET.has(name)),
    custom: [...new Set([...translator.custom, ...used.filter((name) => !SAMPLER_SET.has(name))])],
  };
}
