import { type ApiInventory, createApiInventory } from "./api_inventory.ts";

export interface ApiReferenceMarkdownOptions {
  title?: string;
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
    "| Module | Re-exports | Symbols | Documented |",
    "| --- | ---: | ---: | ---: |",
  ];

  for (const module of inventory.modules) {
    const documented = module.symbols.filter((symbol) => symbol.documented).length;
    lines.push(
      `| [\`${module.module}\`](#${
        moduleAnchor(module.module)
      }) | ${module.exports.length} | ${module.symbols.length} | ${documented} |`,
    );
  }

  lines.push("", "## Modules", "");

  for (const module of inventory.modules) {
    lines.push(`### ${module.module}`, "");
    if (module.exports.length > 0) {
      lines.push("| Re-export Target | Kind | Names |", "| --- | --- | --- |");
      for (const declaration of module.exports) {
        lines.push(
          `| \`${declaration.target}\` | ${declaration.kind} | ${
            declaration.names.length > 0
              ? declaration.names.map((name) => `\`${escapeMarkdown(name)}\``).join(", ")
              : "-"
          } |`,
        );
      }
      lines.push("");
    }

    if (module.symbols.length > 0) {
      lines.push("| Symbol | Kind | Type Only | JSDoc |", "| --- | --- | --- | --- |");
      for (const symbol of module.symbols) {
        lines.push(
          `| \`${escapeMarkdown(symbol.name)}\` | ${symbol.kind} | ${symbol.typeOnly ? "yes" : "no"} | ${
            symbol.documented ? "yes" : "no"
          } |`,
        );
      }
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

function moduleAnchor(module: string): string {
  return module.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|");
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

if (import.meta.main) {
  const entrypoint = Deno.args.find((arg) => !arg.startsWith("--")) ?? "mod.ts";
  const inventory = await createApiInventory(entrypoint);
  console.log(formatApiReferenceMarkdown(inventory));
}
