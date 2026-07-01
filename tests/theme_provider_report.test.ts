import { assertEquals } from "./deps.ts";
import type { ThemeCoverageOptions, ThemeEngineOptions, ThemeProviderReport } from "../src/theme.ts";
import { createThemeProvider, createThemeRegistry } from "../src/theme.ts";
import { createThemeProviderReportCore } from "../src/theme_provider_report_builder.ts";
import { formatThemeProviderReportMarkdownFromReport } from "../src/theme_provider_report.ts";

Deno.test("theme provider report builder assembles injected coverage preview and issues", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "ops",
        label: "Ops",
        options: {
          components: {
            button: {
              base: { active: "accent" },
              variants: { danger: { active: "danger" } },
            },
          },
        },
      },
    ]),
    activeId: "ops",
  });
  const capturedCoverageOptions: ThemeCoverageOptions[] = [];

  const report = createThemeProviderReportCore(provider, { title: "Ops Report", preview: { sample: "OK" } }, {
    activeOptions: () => ({ components: {} }),
    inspectCoverage: (_options: ThemeEngineOptions, coverageOptions: ThemeCoverageOptions) => {
      capturedCoverageOptions.push(coverageOptions);
      return {
        componentCount: 1,
        variantCount: 2,
        stateCount: 8,
        coveredStateCount: 7,
        missingStateCount: 1,
        complete: false,
        components: [],
      };
    },
    inspectIssues: () => [{
      kind: "unknown-token",
      path: "components.button.default.active",
      message: "bad token",
      source: "theme",
      sourceId: "ops",
    }],
    previewProvider: (_provider, options) => ({
      sample: options.sample ?? "",
      activeId: "ops",
      activeLayers: [],
      catalog: provider.catalog(),
      tokens: [],
      components: [],
    }),
  });

  assertEquals(report.title, "Ops Report");
  assertEquals(report.preview?.sample, "OK");
  assertEquals(report.summary, {
    themeCount: 1,
    layerCount: 0,
    activeLayerCount: 0,
    componentCount: 1,
    variantCount: 2,
    issueCount: 1,
    missingStateCount: 1,
    completeCoverage: false,
  });
  assertEquals([...(capturedCoverageOptions[0].components ?? [])], ["button"]);
});

Deno.test("theme provider report formatter escapes tables and includes diagnostics", () => {
  const report: ThemeProviderReport = {
    title: "Theme | Report",
    activeId: "unit-01",
    activeLayers: ["scan|line"],
    catalog: {
      activeId: "unit-01",
      tokens: ["foreground"],
      states: ["base", "focused", "active", "disabled"],
      themes: [
        {
          id: "unit-01",
          label: "Unit | 01",
          palette: "neon",
          active: true,
          components: [{ name: "button", variants: ["default"] }],
        },
      ],
      layers: [
        {
          id: "scan|line",
          label: "Scan\nLine",
          enabled: true,
          active: true,
          components: [{ name: "modal", variants: ["default"] }],
        },
      ],
      components: [
        { name: "button", variants: ["default"] },
        { name: "modal", variants: ["default"] },
      ],
    },
    issues: [
      {
        kind: "unknown-token",
        path: "components.button.default.focused",
        message: "Missing | focused\nstate",
        source: "theme",
        sourceId: "unit|01",
      },
    ],
    coverage: {
      componentCount: 1,
      variantCount: 1,
      stateCount: 4,
      coveredStateCount: 3,
      missingStateCount: 1,
      complete: false,
      components: [
        {
          name: "button",
          extends: [],
          variants: [
            {
              name: "default",
              states: ["base"],
              missingStates: ["focused"],
              complete: false,
            },
          ],
          stateCount: 4,
          coveredStateCount: 3,
          missingStateCount: 1,
          complete: false,
        },
      ],
    },
    summary: {
      themeCount: 1,
      layerCount: 1,
      activeLayerCount: 1,
      componentCount: 2,
      variantCount: 2,
      issueCount: 1,
      missingStateCount: 1,
      completeCoverage: false,
    },
  };

  assertEquals(
    formatThemeProviderReportMarkdownFromReport(report),
    [
      "# Theme | Report",
      "",
      "Active theme: unit-01. Active layers: scan|line.",
      "",
      "1 themes, 1 layers, 2 components, 2 variants, 1 issues.",
      "",
      "| Theme | Label | Palette | Active | Components |",
      "| --- | --- | --- | --- | ---: |",
      "| unit-01 | Unit \\| 01 | neon | yes | 1 |",
      "",
      "| Layer | Label | Active | Components |",
      "| --- | --- | --- | ---: |",
      "| scan\\|line | Scan Line | yes | 1 |",
      "",
      "| Issue | Source | Path | Message |",
      "| --- | --- | --- | --- |",
      "| unknown-token | theme:unit\\|01 | components.button.default.focused | Missing \\| focused state |",
      "",
      "| Component | Variant | Complete | Missing States |",
      "| --- | --- | --- | --- |",
      "| button | default | no | focused |",
    ].join("\n"),
  );
});
