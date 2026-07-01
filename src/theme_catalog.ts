// Copyright 2023 Im-Beast. MIT license.
import type { ThemeCatalogComponent, ThemeComponentInspection } from "./theme.ts";

/** Merges component inspections into a sorted theme catalog component list. */
export function mergeThemeCatalogComponents(
  ...groups: readonly ThemeComponentInspection[][]
): ThemeCatalogComponent[] {
  const components = new Map<string, Set<string>>();

  for (const group of groups) {
    for (const component of group) {
      const variants = components.get(component.name) ?? new Set<string>(["default"]);
      variants.add("default");
      for (const variant of component.variants) variants.add(variant);
      components.set(component.name, variants);
    }
  }

  return [...components.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, variants]) => ({
      name,
      variants: [...variants].sort((a, b) => {
        if (a === "default") return -1;
        if (b === "default") return 1;
        return a.localeCompare(b);
      }),
    }));
}
