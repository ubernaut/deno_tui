import { assertEquals } from "./deps.ts";
import {
  apiSurfacePolicies,
  filterApiSurfacePolicies,
  filterPackageEntrypoints,
  formatPackageEntrypointMarkdown,
  packageEntrypointFor,
  packageEntrypoints,
  packageReleasePolicy,
} from "../mod.ts";
import {
  formatPackageExportValidation,
  formatStableAppExportValidation,
  formatStableDemoExportValidation,
  validatePackageExports,
  validateStableAppExports,
  validateStableDemoExports,
} from "../scripts/package_check.ts";

Deno.test("package entrypoint manifest separates terminal web and remote surfaces", () => {
  assertEquals(packageEntrypoints.map((entrypoint) => entrypoint.specifier), [
    ".",
    "./web",
    "./remote",
    "./three-ascii",
    "./theme",
    "./runtime",
    "./terminal",
    "./testing",
    "./layout/yoga",
  ]);
  assertEquals(packageEntrypointFor(".")?.path, "./mod.ts");
  assertEquals(packageEntrypointFor("./mod.web.ts")?.specifier, "./web");
  assertEquals(packageEntrypointFor("./mod.three_ascii.ts")?.specifier, "./three-ascii");
  assertEquals(packageEntrypointFor("./mod.theme.ts")?.specifier, "./theme");
  assertEquals(filterPackageEntrypoints({ runtime: "browser" }).map((entrypoint) => entrypoint.specifier), ["./web"]);
  assertEquals(filterPackageEntrypoints({ stability: "experimental" }).map((entrypoint) => entrypoint.specifier), [
    "./remote",
    "./three-ascii",
    "./layout/yoga",
  ]);
  assertEquals(filterPackageEntrypoints({ stability: "beta" }).map((entrypoint) => entrypoint.specifier), [
    "./web",
    "./theme",
    "./runtime",
    "./terminal",
    "./testing",
  ]);
  assertEquals(formatPackageEntrypointMarkdown().includes("`./web`"), true);
  assertEquals(formatPackageEntrypointMarkdown().includes("`./three-ascii`"), true);
  assertEquals(formatPackageEntrypointMarkdown().includes("`./theme`"), true);
});

Deno.test("api surface policies mark public experimental and demo-only code", () => {
  assertEquals(filterApiSurfacePolicies({ public: true }).map((policy) => policy.pattern), [
    "mod.ts",
    "mod.web.ts",
    "mod.remote.ts",
    "mod.three_ascii.ts",
    "mod.theme.ts",
    "mod.runtime.ts",
    "mod.terminal.ts",
    "mod.testing.ts",
    "src/layout/solvers/yoga.ts",
    "src/three_ascii/*",
    "src/runtime/kitty_graphics.ts",
    "src/runtime/graphics_surface.ts",
  ]);
  assertEquals(filterApiSurfacePolicies({ stability: "internal" }).map((policy) => policy.pattern), [
    "app/*",
    "examples/*",
    "scripts/*",
  ]);
  assertEquals(apiSurfacePolicies.some((policy) => policy.runtime === "demo" && !policy.public), true);
});

Deno.test("package release policy lists the package quality gate", () => {
  assertEquals(packageReleasePolicy.changelogFile, "CHANGELOG.md");
  assertEquals(packageReleasePolicy.releaseChecklist.includes("deno task package-check -- --quiet"), true);
  assertEquals(
    packageReleasePolicy.releaseChecklist.includes(
      "deno task api-inventory -- --check --quiet --fail-duplicates --min-doc-coverage=1",
    ),
    true,
  );
});

Deno.test("package export validation compares deno export maps with the stability manifest", () => {
  const valid = validatePackageExports(
    {
      exports: {
        ".": "./mod.ts",
        "./web": "./mod.web.ts",
        "./remote": "./mod.remote.ts",
        "./three-ascii": "./mod.three_ascii.ts",
        "./theme": "./mod.theme.ts",
        "./runtime": "./mod.runtime.ts",
        "./terminal": "./mod.terminal.ts",
        "./testing": "./mod.testing.ts",
        "./layout/yoga": "./src/layout/solvers/yoga.ts",
      },
    },
    packageEntrypoints,
    { exists: () => true },
  );
  assertEquals(valid.ok, true);
  assertEquals(
    formatPackageExportValidation(valid),
    [
      "ok package exports match the stability manifest",
      "stable: ok",
      "beta: ok",
      "experimental: ok",
      "internal: ok",
    ].join("\n"),
  );

  const invalid = validatePackageExports(
    {
      exports: {
        ".": "./mod.ts",
        "./extra": "./extra.ts",
        "./web": "./wrong.ts",
      },
    },
    packageEntrypoints,
    {
      exists: (path) =>
        path !== "mod.remote.ts" && path !== "mod.three_ascii.ts" && path !== "mod.theme.ts" &&
        path !== "mod.runtime.ts" && path !== "mod.terminal.ts" && path !== "mod.testing.ts" &&
        path !== "src/layout/solvers/yoga.ts",
    },
  );
  assertEquals(invalid.ok, false);
  assertEquals(invalid.missingExports, [
    "./remote",
    "./three-ascii",
    "./theme",
    "./runtime",
    "./terminal",
    "./testing",
    "./layout/yoga",
  ]);
  assertEquals(invalid.mismatchedExports, [{ specifier: "./web", expected: "./mod.web.ts", actual: "./wrong.ts" }]);
  assertEquals(invalid.unexpectedExports, ["./extra"]);
  assertEquals(invalid.missingFiles, [
    "./mod.remote.ts",
    "./mod.three_ascii.ts",
    "./mod.theme.ts",
    "./mod.runtime.ts",
    "./mod.terminal.ts",
    "./mod.testing.ts",
    "./src/layout/solvers/yoga.ts",
  ]);
  assertEquals(invalid.byStability.stable.ok, true);
  assertEquals(invalid.byStability.beta.ok, false);
  assertEquals(invalid.byStability.experimental.ok, false);
  assertEquals(invalid.byStability.beta.mismatchedExports, [
    { specifier: "./web", expected: "./mod.web.ts", actual: "./wrong.ts" },
  ]);
  assertEquals(invalid.byStability.experimental.missingExports, ["./remote", "./three-ascii", "./layout/yoga"]);
});

Deno.test("package check guards stable entrypoint against new demo-only modules", () => {
  const current = validateStableDemoExports({
    modules: [
      { module: "mod.ts" },
      { module: "src/components/button.ts" },
      { module: "src/markup/demo_fixtures.ts" },
      { module: "src/three_ascii/demo_presets.ts" },
    ],
  });

  assertEquals(current.ok, true);
  assertEquals(
    formatStableDemoExportValidation(current),
    [
      "ok stable exports contain no new demo-only modules",
      "legacy allowed: src/markup/demo_fixtures.ts, src/three_ascii/demo_presets.ts",
    ].join("\n"),
  );

  const drift = validateStableDemoExports({
    modules: [
      { module: "mod.ts" },
      { module: "src/examples/new_widget_demo.ts" },
      { module: "src/markup/demo_fixtures.ts" },
    ],
  });

  assertEquals(drift.ok, false);
  assertEquals(drift.unexpectedModules, ["src/examples/new_widget_demo.ts"]);
  assertEquals(
    formatStableDemoExportValidation(drift).includes("unexpected stable demo export: src/examples/new_widget_demo.ts"),
    true,
  );
});

Deno.test("package check guards stable entrypoint against new app and workbench modules", () => {
  const current = validateStableAppExports({
    modules: [
      { module: "mod.ts" },
      { module: "src/app/actions.ts" },
      { module: "src/app/workbench/mod.ts" },
      { module: "src/app/workbench_terminal.ts" },
      { module: "src/components/button.ts" },
    ],
  });

  assertEquals(current.ok, true);
  assertEquals(
    formatStableAppExportValidation(current),
    [
      "ok stable exports contain no new app/workbench modules",
      "legacy app modules allowed: 61",
    ].join("\n"),
  );

  const drift = validateStableAppExports({
    modules: [
      { module: "mod.ts" },
      { module: "src/app/actions.ts" },
      { module: "src/app/workbench/new_internal_helper.ts" },
      { module: "src/app/workbench_terminal.ts" },
      { module: "src/app/workbench_z_layer_experiment.ts" },
    ],
  });

  assertEquals(drift.ok, false);
  assertEquals(drift.unexpectedModules, [
    "src/app/workbench/new_internal_helper.ts",
    "src/app/workbench_z_layer_experiment.ts",
  ]);
  assertEquals(
    formatStableAppExportValidation(drift).includes(
      "unexpected stable app export: src/app/workbench/new_internal_helper.ts",
    ),
    true,
  );
});
