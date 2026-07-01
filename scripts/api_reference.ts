import { type ApiInventory, createApiInventory } from "./api_inventory.ts";
import { type ApiStabilityTier, packageEntrypoints, type PackageRuntime } from "../src/api_stability.ts";
import { textWidth } from "../src/utils/strings.ts";

export interface ApiReferenceMarkdownOptions {
  title?: string;
}

export interface PackageApiReferenceSection {
  specifier: string;
  path: string;
  runtime: PackageRuntime;
  stability: ApiStabilityTier;
  description: string;
  inventory: ApiInventory;
}

export function formatApiReferenceMarkdown(
  inventory: ApiInventory,
  options: ApiReferenceMarkdownOptions = {},
): string {
  const lines = [
    `# ${options.title ?? "API Reference"}`,
    "",
    "This document is generated from the public re-export graph rooted at `mod.ts`. It is intended as a complete",
    "map of the modules and exported symbols that make up the package API.",
    "",
    "## Summary",
    "",
    `- Entrypoint: \`${inventory.entrypoint}\``,
    `- Modules: ${inventory.modules.length}`,
    `- Re-export declarations: ${inventory.exportCount}`,
    `- Exported symbols: ${inventory.symbolCount}`,
    `- Documented symbols: ${inventory.documentedSymbolCount}`,
    `- Documentation coverage: ${formatPercent(inventory.documentationCoverage)}`,
    `- Duplicate symbols: ${Object.keys(inventory.duplicateSymbols).length}`,
    `- Missing targets: ${inventory.missingTargets.length}`,
    "",
    "## Module Index",
    "",
  ];

  const moduleRows: string[][] = [];
  for (const module of inventory.modules) {
    const documented = module.symbols.filter((symbol) => symbol.documented).length;
    moduleRows.push([
      `[\`${module.module}\`](#${moduleAnchor(module.module)})`,
      String(module.exports.length),
      String(module.symbols.length),
      String(documented),
    ]);
  }
  lines.push(
    ...formatMarkdownTable(
      ["Module", "Re-exports", "Symbols", "Documented"],
      ["left", "right", "right", "right"],
      moduleRows,
    ),
  );

  lines.push("", "## Modules", "");

  for (const module of inventory.modules) {
    lines.push(`### ${module.module}`, "");
    if (module.exports.length > 0) {
      const exportRows: string[][] = [];
      for (const declaration of module.exports) {
        exportRows.push([
          `\`${declaration.target}\``,
          declaration.kind,
          `${
            declaration.names.length > 0
              ? declaration.names.map((name) => `\`${escapeMarkdown(name)}\``).join(", ")
              : "-"
          }`,
        ]);
      }
      lines.push(...formatMarkdownTable(["Re-export Target", "Kind", "Names"], ["left", "left", "left"], exportRows));
      lines.push("");
    }

    if (module.symbols.length > 0) {
      const symbolRows: string[][] = [];
      for (const symbol of module.symbols) {
        symbolRows.push([
          `\`${escapeMarkdown(symbol.name)}\``,
          symbol.kind,
          symbol.typeOnly ? "yes" : "no",
          symbol.documented ? "yes" : "no",
        ]);
      }
      lines.push(
        ...formatMarkdownTable(["Symbol", "Kind", "Type Only", "JSDoc"], ["left", "left", "left", "left"], symbolRows),
      );
      lines.push("");
    } else {
      lines.push("_No direct exported symbols._", "");
    }
  }

  if (Object.keys(inventory.duplicateSymbols).length > 0) {
    lines.push("## Duplicate Symbols", "");
    for (const [name, modules] of Object.entries(inventory.duplicateSymbols)) {
      lines.push(`- \`${escapeMarkdown(name)}\`: ${modules.map((module) => `\`${module}\``).join(", ")}`);
    }
    lines.push("");
  }

  if (inventory.missingTargets.length > 0) {
    lines.push("## Missing Targets", "");
    for (const target of inventory.missingTargets) {
      lines.push(`- \`${target}\``);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function formatPackageApiReferenceMarkdown(
  sections: readonly PackageApiReferenceSection[],
  options: ApiReferenceMarkdownOptions = {},
): string {
  const totals = sections.reduce(
    (total, section) => ({
      modules: total.modules + section.inventory.modules.length,
      exports: total.exports + section.inventory.exportCount,
      symbols: total.symbols + section.inventory.symbolCount,
      documented: total.documented + section.inventory.documentedSymbolCount,
      duplicates: total.duplicates + Object.keys(section.inventory.duplicateSymbols).length,
      missing: total.missing + section.inventory.missingTargets.length,
    }),
    { modules: 0, exports: 0, symbols: 0, documented: 0, duplicates: 0, missing: 0 },
  );
  const lines = [
    `# ${options.title ?? "API Reference"}`,
    "",
    "This document is generated from every public package entrypoint in the Deno export map. It is intended as a",
    "complete map of stable, beta, and experimental modules and exported symbols that make up the package API.",
    "",
    "## Summary",
    "",
    `- Entrypoints: ${sections.length}`,
    `- Module visits: ${totals.modules}`,
    `- Re-export declarations: ${totals.exports}`,
    `- Exported symbols: ${totals.symbols}`,
    `- Documented symbols: ${totals.documented}`,
    `- Documentation coverage: ${formatPercent(totals.symbols === 0 ? 1 : totals.documented / totals.symbols)}`,
    `- Duplicate symbol groups: ${totals.duplicates}`,
    `- Missing targets: ${totals.missing}`,
    "",
    "## Entrypoints",
    "",
  ];

  lines.push(
    ...formatMarkdownTable(
      ["Specifier", "Path", "Runtime", "Stability", "Modules", "Symbols", "Docs"],
      ["left", "left", "left", "left", "right", "right", "right"],
      sections.map((section) => [
        `\`${section.specifier}\``,
        `\`${section.path}\``,
        section.runtime,
        section.stability,
        String(section.inventory.modules.length),
        String(section.inventory.symbolCount),
        formatPercent(section.inventory.documentationCoverage),
      ]),
    ),
  );

  for (const section of sections) {
    lines.push(
      "",
      `## Entrypoint ${section.specifier}`,
      "",
      section.description,
      "",
      `- Path: \`${section.path}\``,
      `- Runtime: ${section.runtime}`,
      `- Stability: ${section.stability}`,
      "",
    );
    appendInventoryDetails(lines, section.inventory, 3);
  }

  return lines.join("\n").trimEnd() + "\n";
}

export async function createPackageApiReferenceSections(): Promise<PackageApiReferenceSection[]> {
  const sections: PackageApiReferenceSection[] = [];
  for (const entrypoint of packageEntrypoints) {
    sections.push({
      specifier: entrypoint.specifier,
      path: entrypoint.path,
      runtime: entrypoint.runtime,
      stability: entrypoint.stability,
      description: entrypoint.description,
      inventory: await createApiInventory(entrypoint.path.replace(/^\.\//, "")),
    });
  }
  return sections;
}

function appendInventoryDetails(lines: string[], inventory: ApiInventory, headingLevel: number): void {
  const heading = "#".repeat(headingLevel);
  lines.push(
    `${heading} Summary`,
    "",
    `- Entrypoint: \`${inventory.entrypoint}\``,
    `- Modules: ${inventory.modules.length}`,
    `- Re-export declarations: ${inventory.exportCount}`,
    `- Exported symbols: ${inventory.symbolCount}`,
    `- Documented symbols: ${inventory.documentedSymbolCount}`,
    `- Documentation coverage: ${formatPercent(inventory.documentationCoverage)}`,
    `- Duplicate symbols: ${Object.keys(inventory.duplicateSymbols).length}`,
    `- Missing targets: ${inventory.missingTargets.length}`,
    "",
    `${heading} Module Index`,
    "",
  );

  const moduleRows: string[][] = [];
  for (const module of inventory.modules) {
    const documented = module.symbols.filter((symbol) => symbol.documented).length;
    moduleRows.push([
      `[\`${module.module}\`](#${moduleAnchor(module.module)})`,
      String(module.exports.length),
      String(module.symbols.length),
      String(documented),
    ]);
  }
  lines.push(
    ...formatMarkdownTable(
      ["Module", "Re-exports", "Symbols", "Documented"],
      ["left", "right", "right", "right"],
      moduleRows,
    ),
    "",
    `${heading} Modules`,
    "",
  );

  for (const module of inventory.modules) {
    lines.push(`${heading}# ${module.module}`, "");
    if (module.exports.length > 0) {
      const exportRows: string[][] = [];
      for (const declaration of module.exports) {
        exportRows.push([
          `\`${declaration.target}\``,
          declaration.kind,
          `${
            declaration.names.length > 0
              ? declaration.names.map((name) => `\`${escapeMarkdown(name)}\``).join(", ")
              : "-"
          }`,
        ]);
      }
      lines.push(...formatMarkdownTable(["Re-export Target", "Kind", "Names"], ["left", "left", "left"], exportRows));
      lines.push("");
    }

    if (module.symbols.length > 0) {
      const symbolRows: string[][] = [];
      for (const symbol of module.symbols) {
        symbolRows.push([
          `\`${escapeMarkdown(symbol.name)}\``,
          symbol.kind,
          symbol.typeOnly ? "yes" : "no",
          symbol.documented ? "yes" : "no",
        ]);
      }
      lines.push(
        ...formatMarkdownTable(["Symbol", "Kind", "Type Only", "JSDoc"], ["left", "left", "left", "left"], symbolRows),
      );
      lines.push("");
    } else {
      lines.push("_No direct exported symbols._", "");
    }
  }

  if (Object.keys(inventory.duplicateSymbols).length > 0) {
    lines.push(`${heading} Duplicate Symbols`, "");
    for (const [name, modules] of Object.entries(inventory.duplicateSymbols)) {
      lines.push(`- \`${escapeMarkdown(name)}\`: ${modules.map((module) => `\`${module}\``).join(", ")}`);
    }
    lines.push("");
  }

  if (inventory.missingTargets.length > 0) {
    lines.push(`${heading} Missing Targets`, "");
    for (const target of inventory.missingTargets) {
      lines.push(`- \`${target}\``);
    }
    lines.push("");
  }
}

function moduleAnchor(module: string): string {
  return module.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|");
}

type MarkdownTableAlign = "left" | "right";

function formatMarkdownTable(
  headers: readonly string[],
  aligns: readonly MarkdownTableAlign[],
  rows: readonly (readonly string[])[],
): string[] {
  const widths = headers.map((header, index) =>
    Math.max(textWidth(header), ...rows.map((row) => textWidth(row[index] ?? "")), 3)
  );
  const output = [
    `| ${
      headers.map((header, index) => padMarkdownCell(header, widths[index]!, aligns[index] ?? "left")).join(" | ")
    } |`,
    `| ${
      widths.map((width, index) => {
        const align = aligns[index] ?? "left";
        const dashes = "-".repeat(Math.max(3, width - (align === "right" ? 1 : 0)));
        return align === "right" ? `${dashes}:` : dashes;
      }).join(" | ")
    } |`,
  ];
  for (const row of rows) {
    output.push(
      `| ${
        headers.map((_, index) => padMarkdownCell(row[index] ?? "", widths[index]!, aligns[index] ?? "left")).join(
          " | ",
        )
      } |`,
    );
  }
  return output;
}

function padMarkdownCell(value: string, width: number, align: MarkdownTableAlign): string {
  const padding = " ".repeat(Math.max(0, width - textWidth(value)));
  return align === "right" ? `${padding}${value}` : `${value}${padding}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

if (import.meta.main) {
  const entrypoint = Deno.args.find((arg) => !arg.startsWith("--")) ?? "mod.ts";
  if (Deno.args.includes("--single") || Deno.args.some((arg) => !arg.startsWith("--"))) {
    const inventory = await createApiInventory(entrypoint);
    console.log(formatApiReferenceMarkdown(inventory));
  } else {
    console.log(formatPackageApiReferenceMarkdown(await createPackageApiReferenceSections()));
  }
}
