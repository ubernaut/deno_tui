// Copyright 2023 Im-Beast. MIT license.
import type {
  ThemeCoverageInspection,
  ThemeCoverageOptions,
  ThemeEngineOptions,
  ThemeProvider,
  ThemeProviderPreview,
  ThemeProviderPreviewOptions,
  ThemeProviderReport,
  ThemeProviderReportIssue,
  ThemeProviderReportOptions,
} from "./theme.ts";

/** Injectable report dependencies keep provider report assembly independent of facade helpers. */
export interface ThemeProviderReportCoreDeps {
  activeOptions: (provider: ThemeProvider) => ThemeEngineOptions;
  inspectCoverage: (options: ThemeEngineOptions, coverageOptions: ThemeCoverageOptions) => ThemeCoverageInspection;
  inspectIssues: (provider: ThemeProvider) => ThemeProviderReportIssue[];
  previewProvider: (provider: ThemeProvider, options: ThemeProviderPreviewOptions) => ThemeProviderPreview;
}

/** Creates an audit-ready report from a provider plus injected preview, coverage, and issue collectors. */
export function createThemeProviderReportCore(
  provider: ThemeProvider,
  options: ThemeProviderReportOptions,
  deps: ThemeProviderReportCoreDeps,
): ThemeProviderReport {
  const catalog = provider.catalog();
  const activeLayers = provider.layers.activeIds();
  const coverageOptions = options.coverage === false ? undefined : options.coverage ?? {};
  const componentNames = new Array<string>(catalog.components.length);
  let variantCount = 0;
  for (let index = 0; index < catalog.components.length; index += 1) {
    const component = catalog.components[index]!;
    componentNames[index] = component.name;
    variantCount += component.variants.length;
  }
  const coverage = coverageOptions
    ? deps.inspectCoverage(deps.activeOptions(provider), {
      components: componentNames,
      ...coverageOptions,
    })
    : undefined;
  const preview = options.preview === false ? undefined : deps.previewProvider(provider, options.preview ?? {});
  const issues = deps.inspectIssues(provider);

  return {
    title: options.title ?? "Theme Provider Report",
    activeId: catalog.activeId,
    activeLayers,
    catalog,
    preview,
    coverage,
    issues,
    summary: {
      themeCount: catalog.themes.length,
      layerCount: catalog.layers.length,
      activeLayerCount: activeLayers.length,
      componentCount: catalog.components.length,
      variantCount,
      issueCount: issues.length,
      missingStateCount: coverage?.missingStateCount ?? 0,
      completeCoverage: coverage?.complete ?? true,
    },
  };
}

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
