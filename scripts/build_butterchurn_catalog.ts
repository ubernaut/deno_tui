// Copyright 2023 Im-Beast. MIT license.

/**
 * Regenerates `packages/exomux/butterchurn_catalog.ts` from the upstream
 * `butterchurn-presets` npm package.
 *
 * The catalog is vendored rather than fetched at runtime: Exomux ships as a
 * single compiled binary with no npm dependencies, and the presets are static
 * data. Only what the terminal renderer can actually use is carried over —
 * each preset's base values, its three EEL equation blocks, and its warp and
 * composite shaders. The shaders ship as GLSL — upstream already converted them
 * from MilkDrop's HLSL — and `glsl_wgsl.ts` translates them to WGSL for the
 * WebGPU renderer. Custom waves and custom shapes are still dropped.
 *
 * Usage, pointed at a checkout that has the package installed:
 *
 *   deno run -A scripts/build_butterchurn_catalog.ts \
 *     --presets ~/projects/butterchurnxr/node_modules/butterchurn-presets
 *
 * `butterchurn-presets` is MIT licensed, Copyright (c) 2013-2018 Jordan Berg.
 */

const OUTPUT = new URL("../packages/exomux/butterchurn_catalog.ts", import.meta.url);

interface PresetSource {
  readonly name: string;
  readonly baseVals: Record<string, number>;
  readonly init: string;
  readonly frame: string;
  readonly pixel: string;
  readonly warp: string;
  readonly comp: string;
}

/** Reads `presets["name"] = require("./path")` pairs out of a pack index. */
async function readPack(root: string, pack: string): Promise<Map<string, string>> {
  const source = await Deno.readTextFile(`${root}/${pack}`);
  const entries = new Map<string, string>();
  const pattern = /presets\[("(?:[^"\\]|\\.)*")\]\s*=\s*require\("((?:[^"\\]|\\.)*)"\)/g;
  for (const match of source.matchAll(pattern)) {
    entries.set(JSON.parse(match[1]!) as string, JSON.parse(`"${match[2]!}"`) as string);
  }
  return entries;
}

if (import.meta.main) {
  // Parsed by hand rather than with `@std/cli`: this is a build-time script for
  // a checked-in artifact, and it should not put a dependency in the root
  // lockfile that nothing in the library or the app ever imports.
  const flag = Deno.args.indexOf("--presets");
  const root = flag === -1 ? undefined : Deno.args[flag + 1];
  if (!root) {
    console.error("Pass --presets <path to butterchurn-presets package>");
    Deno.exit(2);
  }

  // base + extra is the pack pair the parent ButterchurnXR demo merges, and so
  // the set asciichurn reports as its 293-preset catalog.
  const entries = new Map<string, string>();
  for (const pack of ["base.js", "extra.js"]) {
    for (const [name, path] of await readPack(root, pack)) entries.set(name, path);
  }

  const presets: PresetSource[] = [];
  for (const [name, path] of entries) {
    const resolved = `${root}/${path.replace(/^\.\//, "")}`;
    const preset = JSON.parse(await Deno.readTextFile(resolved)) as Record<string, unknown>;
    presets.push({
      name,
      baseVals: (preset.baseVals ?? {}) as Record<string, number>,
      init: (preset.init_eqs_eel as string | undefined) ?? "",
      frame: (preset.frame_eqs_eel as string | undefined) ?? "",
      pixel: (preset.pixel_eqs_eel as string | undefined) ?? "",
      warp: (preset.warp as string | undefined) ?? "",
      comp: (preset.comp as string | undefined) ?? "",
    });
  }

  // The parent demo sorts case-insensitively before indexing, so preset order —
  // and therefore what "next preset" means — matches upstream.
  presets.sort((left, right) => {
    const a = left.name.toLowerCase();
    const b = right.name.toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
  });

  // Emitted as one JSON string rather than a TypeScript literal. A 293-entry
  // object literal is half a megabyte of syntax for `deno check` to walk on
  // every typecheck; `JSON.parse` of the same data costs a few milliseconds
  // once at module load and nothing at all at typecheck time.
  const payload = JSON.stringify(presets);
  const module = `// Copyright 2023 Im-Beast. MIT license.

// GENERATED FILE — do not edit by hand.
// Regenerate with: deno run -A scripts/build_butterchurn_catalog.ts --presets <path>
//
// The MilkDrop preset catalog used by the butterchurn desktop background,
// vendored from the \`butterchurn-presets\` npm package (MIT, Copyright (c)
// 2013-2018 Jordan Berg). Each entry carries a preset's base values and its
// three EEL equation blocks, plus its warp and composite shaders as GLSL.
// Custom waves and custom shapes are omitted.

/** One preset as authored: base values plus unparsed EEL equation blocks. */
export interface ExomuxButterchurnPresetSource {
  readonly name: string;
  readonly baseVals: Readonly<Record<string, number>>;
  /** Equations run once when the preset is selected. */
  readonly init: string;
  /** Equations run once per frame. */
  readonly frame: string;
  /** Equations run once per warp-mesh vertex per frame. */
  readonly pixel: string;
  /** GLSL body of the warp shader, run per fragment of the feedback pass. */
  readonly warp: string;
  /** GLSL body of the composite shader, run per fragment of the output pass. */
  readonly comp: string;
}

// Parsed rather than written as a literal so typechecking stays cheap; see
// scripts/build_butterchurn_catalog.ts for why.
export const EXOMUX_BUTTERCHURN_CATALOG: readonly ExomuxButterchurnPresetSource[] = JSON.parse(
  ${JSON.stringify(payload)},
);
`;
  await Deno.writeTextFile(OUTPUT, module);
  // Formatted here so regenerating never leaves the tree failing `deno fmt`.
  await new Deno.Command(Deno.execPath(), { args: ["fmt", OUTPUT.pathname], stdout: "null", stderr: "null" }).output();
  const bytes = new TextEncoder().encode(module).length;
  console.log(`wrote ${presets.length} presets to ${OUTPUT.pathname} (${(bytes / 1024).toFixed(0)} KB)`);
}
