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
import { formatPackageExportValidation, validatePackageExports } from "../scripts/package_check.ts";

Deno.test("package entrypoint manifest separates terminal web and remote surfaces", () => {
  assertEquals(packageEntrypoints.map((entrypoint) => entrypoint.specifier), [
    ".",
    "./web",
    "./remote",
    "./layout/yoga",
  ]);
  assertEquals(packageEntrypointFor(".")?.path, "./mod.ts");
  assertEquals(packageEntrypointFor("./mod.web.ts")?.specifier, "./web");
  assertEquals(filterPackageEntrypoints({ runtime: "browser" }).map((entrypoint) => entrypoint.specifier), ["./web"]);
  assertEquals(filterPackageEntrypoints({ stability: "experimental" }).map((entrypoint) => entrypoint.specifier), [
    "./remote",
    "./layout/yoga",
  ]);
  assertEquals(formatPackageEntrypointMarkdown().includes("`./web`"), true);
});

Deno.test("api surface policies mark public experimental and demo-only code", () => {
  assertEquals(filterApiSurfacePolicies({ public: true }).map((policy) => policy.pattern), [
    "mod.ts",
    "mod.web.ts",
    "mod.remote.ts",
    "src/layout/solvers/yoga.ts",
    "src/three_ascii/*",
    "src/runtime/kitty_graphics.ts",
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
        "./layout/yoga": "./src/layout/solvers/yoga.ts",
      },
    },
    packageEntrypoints,
    { exists: () => true },
  );
  assertEquals(valid.ok, true);
  assertEquals(formatPackageExportValidation(valid), "ok package exports match the stability manifest");

  const invalid = validatePackageExports(
    {
      exports: {
        ".": "./mod.ts",
        "./extra": "./extra.ts",
        "./web": "./wrong.ts",
      },
    },
    packageEntrypoints,
    { exists: (path) => path !== "mod.remote.ts" && path !== "src/layout/solvers/yoga.ts" },
  );
  assertEquals(invalid.ok, false);
  assertEquals(invalid.missingExports, ["./remote", "./layout/yoga"]);
  assertEquals(invalid.mismatchedExports, [{ specifier: "./web", expected: "./mod.web.ts", actual: "./wrong.ts" }]);
  assertEquals(invalid.unexpectedExports, ["./extra"]);
  assertEquals(invalid.missingFiles, ["./mod.remote.ts", "./src/layout/solvers/yoga.ts"]);
});
