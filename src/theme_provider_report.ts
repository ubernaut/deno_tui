// Copyright 2023 Im-Beast. MIT license.
import type { ThemeProviderReport } from "./theme.ts";

/** Formats a computed theme provider report as Markdown. */
export function formatThemeProviderReportMarkdownFromReport(report: ThemeProviderReport): string {
  const lines = [`# ${report.title}`, ""];
  lines.push(
    `Active theme: ${report.activeId}. Active layers: ${report.activeLayers.join(", ") || "none"}.`,
    "",
  );
  lines.push(
    `${report.summary.themeCount} themes, ${report.summary.layerCount} layers, ${report.summary.componentCount} components, ${report.summary.variantCount} variants, ${report.summary.issueCount} issues.`,
    "",
  );

  lines.push("| Theme | Label | Palette | Active | Components |");
  lines.push("| --- | --- | --- | --- | ---: |");
  for (const theme of report.catalog.themes) {
    lines.push(
      `| ${escapeMarkdownCell(theme.id)} | ${escapeMarkdownCell(theme.label)} | ${
        escapeMarkdownCell(theme.palette)
      } | ${theme.active ? "yes" : "no"} | ${theme.components.length} |`,
    );
  }

  if (report.catalog.layers.length > 0) {
    lines.push("", "| Layer | Label | Active | Components |");
    lines.push("| --- | --- | --- | ---: |");
    for (const layer of report.catalog.layers) {
      lines.push(
        `| ${escapeMarkdownCell(layer.id)} | ${escapeMarkdownCell(layer.label)} | ${
          layer.active ? "yes" : "no"
        } | ${layer.components.length} |`,
      );
    }
  }

  if (report.issues.length > 0) {
    lines.push("", "| Issue | Source | Path | Message |");
    lines.push("| --- | --- | --- | --- |");
    for (const issue of report.issues) {
      lines.push(
        `| ${issue.kind} | ${issue.source}:${escapeMarkdownCell(issue.sourceId)} | ${
          escapeMarkdownCell(issue.path)
        } | ${escapeMarkdownCell(issue.message)} |`,
      );
    }
  }

  if (report.coverage) {
    lines.push("", "| Component | Variant | Complete | Missing States |");
    lines.push("| --- | --- | --- | --- |");
    for (const component of report.coverage.components) {
      for (const variant of component.variants) {
        lines.push(
          `| ${escapeMarkdownCell(component.name)} | ${escapeMarkdownCell(variant.name)} | ${
            variant.complete ? "yes" : "no"
          } | ${variant.missingStates.join(", ") || "-"} |`,
        );
      }
    }
  }

  return lines.join("\n");
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
