import { assertEquals } from "./deps.ts";
import {
  formatApiReferenceMarkdown,
  formatPackageApiReferenceMarkdown,
  type PackageApiReferenceSection,
} from "../scripts/api_reference.ts";
import type { ApiInventory } from "../scripts/api_inventory.ts";

function inventory(entrypoint: string, symbolName: string): ApiInventory {
  return {
    entrypoint,
    modules: [
      {
        module: entrypoint,
        exports: [],
        symbols: [
          {
            module: entrypoint,
            name: symbolName,
            kind: "function",
            typeOnly: false,
            documented: true,
          },
        ],
        missingTargets: [],
      },
    ],
    exportCount: 0,
    symbolCount: 1,
    documentedSymbolCount: 1,
    undocumentedSymbolCount: 0,
    documentationCoverage: 1,
    duplicateSymbols: {},
    missingTargets: [],
  };
}

Deno.test("formatApiReferenceMarkdown preserves the single-entrypoint report", () => {
  const markdown = formatApiReferenceMarkdown(inventory("mod.ts", "Tui"));
  assertEquals(markdown.includes("Entrypoint: `mod.ts`"), true);
  assertEquals(markdown.includes("`Tui`"), true);
});

Deno.test("formatPackageApiReferenceMarkdown groups public entrypoints by stability", () => {
  const sections: PackageApiReferenceSection[] = [
    {
      specifier: ".",
      path: "./mod.ts",
      runtime: "terminal",
      stability: "stable",
      description: "Terminal package.",
      inventory: inventory("mod.ts", "Tui"),
    },
    {
      specifier: "./web",
      path: "./mod.web.ts",
      runtime: "browser",
      stability: "beta",
      description: "Browser package.",
      inventory: inventory("mod.web.ts", "createWebTui"),
    },
  ];

  const markdown = formatPackageApiReferenceMarkdown(sections);
  assertEquals(markdown.includes("Entrypoints: 2"), true);
  assertEquals(markdown.includes("`./mod.ts`"), true);
  assertEquals(markdown.includes("terminal"), true);
  assertEquals(markdown.includes("stable"), true);
  assertEquals(markdown.includes("`./mod.web.ts`"), true);
  assertEquals(markdown.includes("browser"), true);
  assertEquals(markdown.includes("beta"), true);
  assertEquals(markdown.includes("## Entrypoint ./web"), true);
  assertEquals(markdown.includes("`createWebTui`"), true);
});
