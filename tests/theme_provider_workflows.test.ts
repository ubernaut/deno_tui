// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertInstanceOf, assertStringIncludes } from "./deps.ts";
import { MemoryStore } from "../src/runtime/storage.ts";
import {
  createThemeLayerStack,
  createThemeProvider,
  createThemeRegistry,
  type ThemeCoverageOptions,
  type ThemeEngineOptions,
  type ThemeLayer,
  type ThemePack,
  ThemeProvider,
  type ThemeProviderReport,
  themeStates,
  themeTokenNames,
  validateThemeOptions,
} from "../src/theme.ts";
import {
  inspectThemeProviderIssues,
  themeProviderActiveOptions,
  themeRegistryOptions,
} from "../src/theme_provider_inspection.ts";
import { createThemeCatalogFromInspection, previewThemeProviderCore } from "../src/theme_provider_preview.ts";
import { ThemeProviderImplementation } from "../src/theme_provider.ts";
import { formatThemeProviderReportMarkdownFromReport } from "../src/theme_provider_report.ts";
import { createThemeProviderReportCore } from "../src/theme_provider_report_builder.ts";

Deno.test("theme provider module backs the public facade class", async () => {
  const store = new MemoryStore<string>();
  await store.set("theme.active", "ops");

  const provider = createThemeProvider({
    registry: createThemeRegistry([
      { id: "plain", label: "Plain", options: {} },
      {
        id: "ops",
        label: "Ops",
        options: {
          tokens: { accent: (text) => `!${text}!` },
          components: { button: { base: { active: "accent" } } },
        },
      },
    ]),
    store,
  });

  assertInstanceOf(provider, ThemeProvider);
  assertInstanceOf(provider, ThemeProviderImplementation);
  assertEquals(await provider.ready, "ops");
  assertEquals(provider.activeId.peek(), "ops");
  assertEquals(provider.resolve("button", "active").peek()("go"), "!go!");

  provider.previousTheme();
  await provider.flush();
  assertEquals(await store.get("theme.active"), "plain");
});

Deno.test("theme provider reset clears persisted active theme", async () => {
  const store = new MemoryStore<string>();
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      { id: "plain", label: "Plain", options: {} },
      { id: "ops", label: "Ops", options: {} },
    ]),
    activeId: "ops",
    store,
  });

  await provider.flush();
  provider.setTheme("plain");
  provider.setTheme("ops");
  await provider.flush();
  assertEquals(await store.get("theme.active"), "ops");
  assertEquals(await provider.resetTheme("plain"), true);
  assertEquals(provider.activeId.peek(), "plain");
  assertEquals(await store.get("theme.active"), undefined);
});

Deno.test("theme provider inspection composes active pack and layers", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "base",
        options: {
          tokens: { accent: (text) => `a${text}` },
          components: { label: { base: { active: "accent" } } },
        },
      },
    ]),
    activeId: "base",
    layers: createThemeLayerStack([
      {
        id: "enabled",
        options: {
          tokens: { danger: (text) => `d${text}` },
          components: { button: { base: { active: "danger" } } },
        },
      },
      {
        id: "disabled",
        enabled: false,
        options: { tokens: { muted: (text) => `m${text}` } },
      },
    ]),
  });

  const active = themeProviderActiveOptions(provider);
  assertEquals(Object.keys(active.tokens ?? {}), ["accent", "danger"]);
  assertEquals(Object.keys(active.components ?? {}), ["label", "button"]);
  assertEquals(themeRegistryOptions(provider).length, 1);
});

Deno.test("theme provider inspection attributes pack and layer validation issues", () => {
  const packs = [
    {
      id: "bad-pack",
      options: {
        components: { panel: { base: { active: "missing-token" } } },
      },
    },
  ] as unknown as ThemePack[];
  const layers = [
    {
      id: "bad-layer",
      options: {
        components: { button: { extends: "missing-parent" } },
      },
    },
    {
      id: "other-layer",
      options: {
        components: { other: { base: { active: "also-missing" } } },
      },
    },
  ] as unknown as ThemeLayer[];
  const provider = createThemeProvider({
    registry: createThemeRegistry(packs),
    activeId: "bad-pack",
    layers: createThemeLayerStack(layers),
  });

  const issues = inspectThemeProviderIssues(provider, validateThemeOptions);
  assertEquals(
    issues.map((issue) => [issue.source, issue.sourceId, issue.kind, issue.component]),
    [
      ["theme", "bad-pack", "unknown-token", "panel"],
      ["layer", "bad-layer", "unknown-component", "button"],
      ["layer", "other-layer", "unknown-token", "other"],
    ],
  );
});

Deno.test("theme provider preview builds catalog from inspection", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "ops",
        label: "Ops",
        options: {
          components: {
            button: { variants: { danger: { active: "danger" } } },
          },
        },
      },
    ]),
    activeId: "ops",
    layers: createThemeLayerStack([
      {
        id: "layer",
        label: "Layer",
        options: {
          components: {
            panel: { base: { active: "accent" } },
          },
        },
      },
    ]),
  });

  const catalog = createThemeCatalogFromInspection(provider.inspect(), themeTokenNames, themeStates);
  assertEquals(catalog.activeId, "ops");
  assertEquals(catalog.themes.map((theme) => [theme.id, theme.active]), [["ops", true]]);
  assertEquals(catalog.layers.map((layer) => [layer.id, layer.active]), [["layer", true]]);
  assertEquals(catalog.components.map((component) => component.name), ["button", "panel"]);
});

Deno.test("theme provider preview honors token component state and variant filters", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "ops",
        options: {
          tokens: {
            accent: (text) => `<${text}>`,
            danger: (text) => `!${text}!`,
          },
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

  const preview = previewThemeProviderCore(
    provider,
    {
      sample: "Go",
      tokens: ["danger", "accent"],
      components: ["button"],
      states: ["active"],
      variants: () => ["danger"],
    },
    themeTokenNames,
    themeStates,
  );

  assertEquals(preview.tokens.map((token) => token.token), ["accent", "danger"]);
  assertEquals(preview.components.map((component) => [component.component, component.variant, component.state]), [
    ["button", "danger", "active"],
  ]);
  assertStringIncludes(preview.tokens[0].preview.styled, "Go");
  assertEquals(preview.components[0].preview.styled, "!Go!");
});

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
