// Copyright 2023 Im-Beast. MIT license.
import type { ThemeEngineOptions, ThemeProvider, ThemeProviderReportIssue, ThemeValidationIssue } from "./theme.ts";
import { composeThemeOptionsCore } from "./theme_core.ts";

/** Returns the active base pack plus active layer options for provider coverage/reporting. */
export function themeProviderActiveOptions(provider: ThemeProvider): ThemeEngineOptions {
  const activePack = provider.registry.get(provider.activeId.peek());
  return composeThemeOptionsCore(
    activePack?.options ?? {},
    ...provider.layers.activeLayers().map((layer) => layer.options),
  );
}

/** Returns all registered pack options that contribute validation context for layer checks. */
export function themeRegistryOptions(provider: ThemeProvider): ThemeEngineOptions[] {
  return provider.registry.ids()
    .map((id) => provider.registry.get(id)?.options)
    .filter((options): options is ThemeEngineOptions => options !== undefined);
}

/** Collects provider theme and layer validation issues with stable source metadata. */
export function inspectThemeProviderIssues(
  provider: ThemeProvider,
  validateThemeOptions: (options: ThemeEngineOptions) => ThemeValidationIssue[],
): ThemeProviderReportIssue[] {
  const issues: ThemeProviderReportIssue[] = [];
  for (const id of provider.registry.ids()) {
    const pack = provider.registry.get(id);
    if (!pack?.options) continue;
    issues.push(
      ...validateThemeOptions(pack.options).map((issue) => ({
        ...issue,
        source: "theme" as const,
        sourceId: id,
      })),
    );
  }

  for (const id of provider.layers.ids()) {
    const layer = provider.layers.get(id);
    if (!layer) continue;
    const layerComponents = new Set(Object.keys(layer.options.components ?? {}));
    issues.push(
      ...validateThemeOptions(composeThemeOptionsCore(...themeRegistryOptions(provider), layer.options))
        .filter((issue) => !issue.component || layerComponents.has(issue.component))
        .map((issue) => ({
          ...issue,
          source: "layer" as const,
          sourceId: id,
        })),
    );
  }
  return issues;
}
