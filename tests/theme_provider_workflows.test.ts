// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertInstanceOf, assertStringIncludes } from "./deps.ts";
import { MemoryStore } from "../src/runtime/storage.ts";
import {
  createThemeLayerStack,
  createThemeProvider,
  createThemeProviderReport,
  createThemeRegistry,
  formatThemeProviderReportMarkdown,
  previewThemeProvider,
  type ThemeLayer,
  type ThemePack,
  ThemeProvider,
} from "../src/theme.ts";

Deno.test("theme provider exposes public persistence and resolution behavior", async () => {
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

  const report = createThemeProviderReport(provider, { preview: false });
  assertEquals(report.coverage?.components.map((component) => component.name).sort(), ["button", "label"]);
  assertEquals(report.summary.themeCount, 1);
  assertEquals(report.summary.activeLayerCount, 1);
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

  const issues = createThemeProviderReport(provider, { preview: false, coverage: false }).issues;
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

  const catalog = provider.catalog();
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

  const preview = previewThemeProvider(provider, {
    sample: "Go",
    tokens: ["danger", "accent"],
    components: ["button"],
    states: ["active"],
    variants: () => ["danger"],
  });

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
  const report = createThemeProviderReport(provider, { title: "Ops Report", preview: { sample: "OK" } });

  assertEquals(report.title, "Ops Report");
  assertEquals(report.preview?.sample, "OK");
  assertEquals(report.summary.themeCount, 1);
  assertEquals(report.summary.layerCount, 0);
  assertEquals(report.summary.componentCount, 1);
  assertEquals(report.summary.variantCount, 2);
  assertEquals(report.coverage?.components.map((component) => component.name), ["button"]);
});

Deno.test("theme provider report formatter escapes table cells", () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "unit|01",
        label: "Unit | 01",
        palette: "neon",
        options: {
          components: { button: { base: { active: "accent" } } },
        },
      },
    ]),
    activeId: "unit|01",
    layers: createThemeLayerStack([
      {
        id: "scan|line",
        label: "Scan\nLine",
        options: {
          components: { modal: { base: { active: "accent" } } },
        },
      },
    ]),
  });

  assertEquals(
    formatThemeProviderReportMarkdown(provider, { title: "Theme | Report", preview: false, coverage: false }),
    [
      "# Theme | Report",
      "",
      "Active theme: unit|01. Active layers: scan|line.",
      "",
      "1 themes, 1 layers, 2 components, 2 variants, 0 issues.",
      "",
      "| Theme | Label | Palette | Active | Components |",
      "| --- | --- | --- | --- | ---: |",
      "| unit\\|01 | Unit \\| 01 | neon | yes | 1 |",
      "",
      "| Layer | Label | Active | Components |",
      "| --- | --- | --- | ---: |",
      "| scan\\|line | Scan Line | yes | 1 |",
    ].join("\n"),
  );
});
