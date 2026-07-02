// Copyright 2023 Im-Beast. MIT license.
import type { ThemeEngineOptions, ThemeProvider, ThemeProviderReportIssue, ThemeValidationIssue } from "./theme.ts";
import { composeThemeOptionsCore } from "./theme_core.ts";

/** Returns the active base pack plus active layer options for provider coverage/reporting. */
export function themeProviderActiveOptions(provider: ThemeProvider): ThemeEngineOptions {
  const activePack = provider.registry.get(provider.activeId.peek());
  const activeLayers = provider.layers.activeLayers();
  const options = new Array<ThemeEngineOptions>(activeLayers.length + 1);
  options[0] = activePack?.options ?? {};
  for (let index = 0; index < activeLayers.length; index += 1) {
    options[index + 1] = activeLayers[index]!.options;
  }
  return composeThemeOptionsCore(
    ...options,
  );
}

/** Returns all registered pack options that contribute validation context for layer checks. */
export function themeRegistryOptions(provider: ThemeProvider): ThemeEngineOptions[] {
  const options: ThemeEngineOptions[] = [];
  for (const id of provider.registry.ids()) {
    const packOptions = provider.registry.get(id)?.options;
    if (packOptions !== undefined) options.push(packOptions);
  }
  return options;
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
    const packIssues = validateThemeOptions(pack.options);
    for (const issue of packIssues) {
      issues.push({
        ...issue,
        source: "theme" as const,
        sourceId: id,
      });
    }
  }

  const registryOptions = themeRegistryOptions(provider);
  for (const id of provider.layers.ids()) {
    const layer = provider.layers.get(id);
    if (!layer) continue;
    const layerComponents = new Set(Object.keys(layer.options.components ?? {}));
    const layerIssues = validateThemeOptions(composeThemeOptionsCore(...registryOptions, layer.options));
    for (const issue of layerIssues) {
      if (issue.component && !layerComponents.has(issue.component)) continue;
      issues.push({
        ...issue,
        source: "layer" as const,
        sourceId: id,
      });
    }
  }
  return issues;
}
