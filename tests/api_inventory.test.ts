import { assertEquals } from "./deps.ts";
import {
  createApiInventory,
  createApiInventoryBaseline,
  diffApiInventories,
  diffApiInventoryBaseline,
  formatApiInventory,
  formatApiInventoryDiff,
  inventorySucceeded,
  parseApiExports,
  parseApiSymbols,
} from "../scripts/api_inventory.ts";

Deno.test("parseApiExports extracts star named and type re-exports", () => {
  assertEquals(
    parseApiExports(
      [
        `export * from "./src/app/mod.ts";`,
        `export { Button, type ButtonOptions as Options } from "./src/components/button.ts";`,
        `export type { Theme, ThemeState } from "./src/theme.ts";`,
        `export const local = 1;`,
      ].join("\n"),
      "mod.ts",
    ),
    [
      { module: "mod.ts", target: "src/app/mod.ts", kind: "star", names: [] },
      {
        module: "mod.ts",
        target: "src/components/button.ts",
        kind: "named",
        names: ["Button", "ButtonOptions"],
      },
      {
        module: "mod.ts",
        target: "src/theme.ts",
        kind: "named",
        names: ["type Theme", "type ThemeState"],
      },
    ],
  );
});

Deno.test("parseApiSymbols extracts public declarations and local named exports", () => {
  assertEquals(
    parseApiSymbols(
      [
        `export class Button {}`,
        `/** Button configuration. */`,
        `export interface ButtonOptions {}`,
        `export type ButtonState = "base";`,
        `export const buttonKinds = [];`,
        `export let mutableButton = 1;`,
        `export function renderButton() {}`,
        `export enum ButtonMode { Primary }`,
        `const internal = 1;`,
        `type InternalType = string;`,
        `export { internal as exposedInternal, type InternalType as ExposedType };`,
        `export { Other } from "./other.ts";`,
      ].join("\n"),
      "src/components/button.ts",
    ),
    [
      { module: "src/components/button.ts", name: "Button", kind: "class", typeOnly: false, documented: false },
      { module: "src/components/button.ts", name: "buttonKinds", kind: "const", typeOnly: false, documented: false },
      { module: "src/components/button.ts", name: "ButtonMode", kind: "enum", typeOnly: false, documented: false },
      {
        module: "src/components/button.ts",
        name: "ButtonOptions",
        kind: "interface",
        typeOnly: true,
        documented: true,
      },
      { module: "src/components/button.ts", name: "ButtonState", kind: "type", typeOnly: true, documented: false },
      {
        module: "src/components/button.ts",
        name: "exposedInternal",
        kind: "variable",
        typeOnly: false,
        documented: false,
      },
      { module: "src/components/button.ts", name: "ExposedType", kind: "type", typeOnly: true, documented: false },
      {
        module: "src/components/button.ts",
        name: "mutableButton",
        kind: "variable",
        typeOnly: false,
        documented: false,
      },
      {
        module: "src/components/button.ts",
        name: "renderButton",
        kind: "function",
        typeOnly: false,
        documented: false,
      },
    ],
  );
});

Deno.test("createApiInventory crawls local re-export modules and formats results", async () => {
  const files = new Map([
    [
      "/repo/mod.ts",
      [
        `export * from "./src/components/mod.ts";`,
        `export * from "./src/runtime/mod.ts";`,
        `export * from "npm:three";`,
      ].join("\n"),
    ],
    ["/repo/src/components/mod.ts", `export * from "./button.ts";`],
    ["/repo/src/components/button.ts", `export interface ButtonOptions { label: string }`],
    ["/repo/src/runtime/mod.ts", `export { AsyncScheduler } from "./scheduler.ts";`],
    ["/repo/src/runtime/scheduler.ts", `export class AsyncScheduler {}`],
  ]);

  const inventory = await createApiInventory("mod.ts", {
    root: "/repo",
    readTextFile: (path) => files.get(path) ?? "",
    exists: (path) => files.has(path),
  });

  assertEquals(inventory.entrypoint, "mod.ts");
  assertEquals(inventory.modules.map((module) => module.module), [
    "mod.ts",
    "src/components/button.ts",
    "src/components/mod.ts",
    "src/runtime/mod.ts",
    "src/runtime/scheduler.ts",
  ]);
  assertEquals(inventory.exportCount, 5);
  assertEquals(inventory.symbolCount, 2);
  assertEquals(inventory.documentedSymbolCount, 0);
  assertEquals(inventory.undocumentedSymbolCount, 2);
  assertEquals(inventory.documentationCoverage, 0);
  assertEquals(inventory.duplicateSymbols, {});
  assertEquals(inventorySucceeded(inventory), true);
  assertEquals(inventorySucceeded(inventory, { minDocumentationCoverage: 0.1 }), false);
  assertEquals(formatApiInventory(inventory).includes("Exported symbols: 2"), true);
  assertEquals(formatApiInventory(inventory).includes("Documentation coverage: 0.0%"), true);
  assertEquals(formatApiInventory(inventory).includes("| `src/components/mod.ts` | 1 | 0 | none |"), true);
});

Deno.test("createApiInventory reports missing public export targets", async () => {
  const files = new Map([
    ["/repo/mod.ts", `export * from "./src/missing.ts";`],
  ]);
  const inventory = await createApiInventory("mod.ts", {
    root: "/repo",
    readTextFile: (path) => files.get(path) ?? "",
    exists: (path) => files.has(path),
  });

  assertEquals(inventorySucceeded(inventory), false);
  assertEquals(inventory.missingTargets, ["src/missing.ts"]);
  assertEquals(inventory.modules[0].missingTargets, ["src/missing.ts"]);
});

Deno.test("createApiInventory reports duplicate exported symbol names", async () => {
  const files = new Map([
    ["/repo/mod.ts", [`export * from "./a.ts";`, `export * from "./b.ts";`].join("\n")],
    ["/repo/a.ts", `export interface Options { a: string }`],
    ["/repo/b.ts", `export type Options = { b: string };`],
  ]);
  const inventory = await createApiInventory("mod.ts", {
    root: "/repo",
    readTextFile: (path) => files.get(path) ?? "",
    exists: (path) => files.has(path),
  });

  assertEquals(inventory.duplicateSymbols, { Options: ["a.ts", "b.ts"] });
  assertEquals(inventorySucceeded(inventory), true);
  assertEquals(inventorySucceeded(inventory, { failDuplicates: true }), false);
  assertEquals(formatApiInventory(inventory).includes("## Duplicate Symbols"), true);
});

Deno.test("api inventory diffs group symbol changes by stability tier", async () => {
  const baseline = await createApiInventory("mod.ts", {
    root: "/repo",
    readTextFile: (path) =>
      ({
        "/repo/mod.ts": `export * from "./src/widgets.ts";`,
        "/repo/src/widgets.ts": [
          `export class Button {}`,
          `export function oldHelper() {}`,
        ].join("\n"),
      })[path] ?? "",
    exists: () => true,
  });
  const current = await createApiInventory("mod.ts", {
    root: "/repo",
    readTextFile: (path) =>
      ({
        "/repo/mod.ts": `export * from "./src/widgets.ts";`,
        "/repo/src/widgets.ts": [
          `export class Button {}`,
          `export function newHelper() {}`,
        ].join("\n"),
      })[path] ?? "",
    exists: () => true,
  });

  const diff = diffApiInventories(baseline, current);
  const report = formatApiInventoryDiff(diff);

  assertEquals(diff.stability, "stable");
  assertEquals(diff.added.map((symbol) => symbol.name), ["newHelper"]);
  assertEquals(diff.removed.map((symbol) => symbol.name), ["oldHelper"]);
  assertEquals(diff.addedByStability.stable.map((symbol) => symbol.name), ["newHelper"]);
  assertEquals(diff.addedByStability.beta, []);
  assertEquals(report.includes("### stable"), true);
  assertEquals(report.includes("`newHelper`"), true);
  assertEquals(report.includes("`oldHelper`"), true);
});

Deno.test("api inventory baseline detects accidental stable export drift", async () => {
  const baselineInventory = await createApiInventory("mod.ts", {
    root: "/repo",
    readTextFile: (path) =>
      ({
        "/repo/mod.ts": `export * from "./src/widgets.ts";`,
        "/repo/src/widgets.ts": `export class Button {}`,
      })[path] ?? "",
    exists: () => true,
  });
  const current = await createApiInventory("mod.ts", {
    root: "/repo",
    readTextFile: (path) =>
      ({
        "/repo/mod.ts": `export * from "./src/widgets.ts";`,
        "/repo/src/widgets.ts": [`export class Button {}`, `export function surpriseExport() {}`].join("\n"),
      })[path] ?? "",
    exists: () => true,
  });

  const baseline = createApiInventoryBaseline(baselineInventory, { stability: "stable" });
  const diff = diffApiInventoryBaseline(baseline, current);

  assertEquals(baseline.symbols.map((symbol) => symbol.name), ["Button"]);
  assertEquals(diff.stability, "stable");
  assertEquals(diff.added.map((symbol) => symbol.name), ["surpriseExport"]);
  assertEquals(diff.addedByStability.stable.map((symbol) => symbol.name), ["surpriseExport"]);
  assertEquals(diff.removed, []);
});
