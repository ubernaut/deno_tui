// Copyright 2023 Im-Beast. MIT license.

/** Stability levels used by the package surface manifest. */
export type ApiStabilityTier = "stable" | "beta" | "experimental" | "internal";

/** Runtime target associated with a public or internal API surface. */
export type PackageRuntime = "shared" | "terminal" | "browser" | "remote" | "demo";

/** Manifest record for a Deno package export. */
export interface PackageEntrypointManifest {
  specifier: "." | "./web" | "./remote" | "./three-ascii" | "./layout/yoga";
  path: "./mod.ts" | "./mod.web.ts" | "./mod.remote.ts" | "./mod.three_ascii.ts" | "./src/layout/solvers/yoga.ts";
  runtime: PackageRuntime;
  stability: ApiStabilityTier;
  description: string;
  includes: readonly string[];
  excludes: readonly string[];
}

/** Query options for package entrypoint metadata. */
export interface PackageEntrypointQuery {
  runtime?: PackageRuntime;
  stability?: ApiStabilityTier;
}

/** Policy record for broader source-tree API stability. */
export interface ApiSurfacePolicy {
  pattern: string;
  runtime: PackageRuntime;
  stability: ApiStabilityTier;
  public: boolean;
  description: string;
}

/** Query options for broader source-tree API stability policy. */
export interface ApiSurfacePolicyQuery {
  runtime?: PackageRuntime;
  stability?: ApiStabilityTier;
  public?: boolean;
}

/** Release policy metadata for docs, release notes, and package checks. */
export interface PackageReleasePolicy {
  changelogFile: string;
  stableBreakingChanges: string;
  betaBreakingChanges: string;
  experimentalBreakingChanges: string;
  deprecationPolicy: string;
  releaseChecklist: readonly string[];
}

/** Public package entrypoints exposed by the Deno export map. */
export const packageEntrypoints = [
  {
    specifier: ".",
    path: "./mod.ts",
    runtime: "terminal",
    stability: "stable",
    description:
      "Full terminal package with core TUI runtime, widgets, app primitives, themes, runtime helpers, and demos.",
    includes: [
      "terminal Tui runtime",
      "components and controllers",
      "app framework",
      "runtime/concurrency primitives",
      "testing and benchmark helpers",
      "Three ASCII renderer",
    ],
    excludes: ["browser-only host helpers", "remote terminal bridge transport"],
  },
  {
    specifier: "./web",
    path: "./mod.web.ts",
    runtime: "browser",
    stability: "beta",
    description: "Standalone browser-safe package for shared controllers, themes, layout, canvas sinks, and web hosts.",
    includes: [
      "platform-neutral app/controllers",
      "browser platform and Canvas2D sink",
      "DOM render target",
      "IndexedDB/Worker-capable runtime primitives",
      "Three ASCII browser helpers",
    ],
    excludes: ["terminal Tui runtime", "Deno stdio lifecycle"],
  },
  {
    specifier: "./remote",
    path: "./mod.remote.ts",
    runtime: "remote",
    stability: "experimental",
    description: "Hosted terminal/client bridge protocol and browser WebSocket transport.",
    includes: ["remote terminal protocol", "browser transport", "input/resize/ping message types"],
    excludes: ["server-side PTY host", "standalone browser renderer"],
  },
  {
    specifier: "./three-ascii",
    path: "./mod.three_ascii.ts",
    runtime: "shared",
    stability: "experimental",
    description: "Focused Three.js/WebGPU ASCII renderer package for glyph, block, mixed, and Kitty-capable scenes.",
    includes: [
      "Acerola-style ASCII node",
      "terminal glyph modes",
      "renderer frame helpers",
      "demo presets and shared renderer options",
      "WebGPU compatibility helpers",
    ],
    excludes: ["terminal Tui runtime", "browser Canvas2D host", "workbench demo shell"],
  },
  {
    specifier: "./layout/yoga",
    path: "./src/layout/solvers/yoga.ts",
    runtime: "shared",
    stability: "experimental",
    description: "Optional Yoga-backed Flexbox solver for HTML/CSS-style layout trees.",
    includes: ["Yoga Flexbox solver", "cell-rect conversion", "text measurement hooks"],
    excludes: ["default dependency-free layout solver", "CSS parser and markup hydration helpers"],
  },
] as const satisfies readonly PackageEntrypointManifest[];

/** Stability markers for public, experimental, demo, terminal-only, and web-only surfaces. */
export const apiSurfacePolicies = [
  {
    pattern: "mod.ts",
    runtime: "terminal",
    stability: "stable",
    public: true,
    description: "Default public API. Changes should follow semver and the changelog policy.",
  },
  {
    pattern: "mod.web.ts",
    runtime: "browser",
    stability: "beta",
    public: true,
    description: "Browser-safe public API. Intended for adoption, but still expected to evolve between minor releases.",
  },
  {
    pattern: "mod.remote.ts",
    runtime: "remote",
    stability: "experimental",
    public: true,
    description: "Remote terminal bridge API. Protocol and transport details may change while PTY hosting matures.",
  },
  {
    pattern: "mod.three_ascii.ts",
    runtime: "shared",
    stability: "experimental",
    public: true,
    description: "Focused Three ASCII package entrypoint for renderer consumers that do not need the full TUI runtime.",
  },
  {
    pattern: "src/layout/solvers/yoga.ts",
    runtime: "shared",
    stability: "experimental",
    public: true,
    description: "Optional Yoga-backed layout solver subpath. Flexbox behavior may evolve with solver integration.",
  },
  {
    pattern: "src/three_ascii/*",
    runtime: "shared",
    stability: "experimental",
    public: true,
    description:
      "Three.js/WebGPU ASCII renderer internals and presets. Useful now, but renderer hooks may keep moving.",
  },
  {
    pattern: "src/runtime/kitty_graphics.ts",
    runtime: "terminal",
    stability: "experimental",
    public: true,
    description:
      "Pure Kitty graphics protocol helpers. Useful for terminal image backends, but the graphics surface API is still forming.",
  },
  {
    pattern: "src/runtime/graphics_surface.ts",
    runtime: "shared",
    stability: "experimental",
    public: true,
    description:
      "Renderer-neutral raster graphics surface abstraction. Useful for Kitty and browser backends, but lifecycle semantics may evolve.",
  },
  {
    pattern: "app/*",
    runtime: "demo",
    stability: "internal",
    public: false,
    description: "Full-screen demo apps. They are adoption examples, not semver-protected package entrypoints.",
  },
  {
    pattern: "examples/*",
    runtime: "demo",
    stability: "internal",
    public: false,
    description: "Focused runnable examples and report emitters. Reuse concepts, not file paths.",
  },
  {
    pattern: "scripts/*",
    runtime: "demo",
    stability: "internal",
    public: false,
    description: "Contributor tooling and generated-report helpers. CLI output can evolve with docs needs.",
  },
] as const satisfies readonly ApiSurfacePolicy[];

/** Release policy for stable, beta, and experimental package surfaces. */
export const packageReleasePolicy: PackageReleasePolicy = {
  changelogFile: "CHANGELOG.md",
  stableBreakingChanges: "Require a major release or an explicit pre-1.0 breaking-change note.",
  betaBreakingChanges: "Allowed in minor releases when documented with migration notes.",
  experimentalBreakingChanges: "Allowed when the changelog calls out the affected experimental surface.",
  deprecationPolicy: "Prefer one minor release of deprecation notice before removing stable public APIs.",
  releaseChecklist: [
    "deno fmt --check",
    "deno check mod.ts mod.web.ts mod.remote.ts",
    "deno task package-check -- --quiet",
    "deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=1",
    "deno task benchmark",
    "deno test",
  ],
};

/** Finds package entrypoint metadata by export specifier or source path. */
export function packageEntrypointFor(specifierOrPath: string): PackageEntrypointManifest | undefined {
  return packageEntrypoints.find((entrypoint) =>
    entrypoint.specifier === specifierOrPath || entrypoint.path === specifierOrPath
  );
}

/** Filters package entrypoint metadata by runtime target or stability tier. */
export function filterPackageEntrypoints(
  query: PackageEntrypointQuery = {},
): PackageEntrypointManifest[] {
  return packageEntrypoints.filter((entrypoint) =>
    (query.runtime === undefined || entrypoint.runtime === query.runtime) &&
    (query.stability === undefined || entrypoint.stability === query.stability)
  );
}

/** Filters source-tree API stability policy records. */
export function filterApiSurfacePolicies(query: ApiSurfacePolicyQuery = {}): ApiSurfacePolicy[] {
  return apiSurfacePolicies.filter((policy) =>
    (query.runtime === undefined || policy.runtime === query.runtime) &&
    (query.stability === undefined || policy.stability === query.stability) &&
    (query.public === undefined || policy.public === query.public)
  );
}

/** Formats package entrypoints as a Markdown table for docs and release notes. */
export function formatPackageEntrypointMarkdown(
  entrypoints: readonly PackageEntrypointManifest[] = packageEntrypoints,
): string {
  const lines = [
    "| Specifier | Path | Runtime | Stability | Purpose |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const entrypoint of entrypoints) {
    lines.push(
      `| \`${entrypoint.specifier}\` | \`${entrypoint.path}\` | ${entrypoint.runtime} | ${entrypoint.stability} | ${entrypoint.description} |`,
    );
  }
  return lines.join("\n");
}
