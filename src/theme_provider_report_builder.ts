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
  const coverage = coverageOptions
    ? deps.inspectCoverage(deps.activeOptions(provider), {
      components: catalog.components.map((component) => component.name),
      ...coverageOptions,
    })
    : undefined;
  const preview = options.preview === false ? undefined : deps.previewProvider(provider, options.preview ?? {});
  const issues = deps.inspectIssues(provider);
  const variantCount = catalog.components.reduce((total, component) => total + component.variants.length, 0);

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
