// Copyright 2023 Im-Beast. MIT license.
import { componentCatalog, type ComponentCatalogEntry } from "./components/catalog.ts";
import type { ComponentThemeDefinition, StandardComponentThemeOptions } from "./theme.ts";

/** Returns the canonical component names covered by the standard theme preset. */
export function standardThemeComponentNames(): string[] {
  return componentCatalog.map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
}

/** Creates component theme definitions for the built-in widget catalog. */
export function createStandardComponentThemeDefinitions(
  options: StandardComponentThemeOptions = {},
): Record<string, ComponentThemeDefinition> {
  const requested = options.components ? new Set([...options.components].map(normalizeThemeComponentName)) : undefined;
  const definitions: Record<string, ComponentThemeDefinition> = {};

  for (const entry of [...componentCatalog].sort((a, b) => a.name.localeCompare(b.name))) {
    if (
      requested && !requested.has(normalizeThemeComponentName(entry.id)) &&
      !requested.has(normalizeThemeComponentName(entry.name))
    ) {
      continue;
    }
    definitions[entry.name] = standardComponentDefinition(entry);
  }

  if (requested) {
    const known = new Set(
      componentCatalog.flatMap((
        entry,
      ) => [normalizeThemeComponentName(entry.id), normalizeThemeComponentName(entry.name)]),
    );
    for (const name of options.components ?? []) {
      if (!known.has(normalizeThemeComponentName(name))) {
        definitions[name] = standardGenericComponentDefinition();
      }
    }
  }

  return definitions;
}

function standardComponentDefinition(entry: ComponentCatalogEntry): ComponentThemeDefinition {
  if (entry.name === "Button") return standardInteractiveComponentDefinition();
  if (entry.name === "Frame" || entry.name === "Box" || entry.name === "WindowManager") {
    return standardSurfaceComponentDefinition();
  }
  if (entry.category === "data") return standardDataComponentDefinition();
  if (entry.category === "input" || entry.capabilities.includes("selection")) {
    return standardInteractiveComponentDefinition();
  }
  if (entry.category === "overlay") return standardOverlayComponentDefinition();
  if (entry.category === "feedback" || entry.category === "visualization") return standardFeedbackComponentDefinition();
  if (entry.category === "navigation" || entry.category === "layout") return standardSurfaceComponentDefinition();
  return standardGenericComponentDefinition();
}

function standardGenericComponentDefinition(): ComponentThemeDefinition {
  return {
    base: {
      base: "foreground",
      focused: "accent",
      active: "success",
      disabled: "muted",
    },
    variants: {
      muted: { base: "muted" },
      danger: { base: "danger" },
      warning: { base: "warning" },
      success: { base: "success" },
    },
  };
}

function standardSurfaceComponentDefinition(): ComponentThemeDefinition {
  return {
    base: {
      base: ["surface", "foreground"],
      focused: ["surface", "accent"],
      active: ["surface", "success"],
      disabled: ["surface", "muted"],
    },
    variants: {
      chrome: { base: ["surface", "accent"], active: ["surface", "success"] },
      quiet: { base: "muted", focused: "accent" },
      danger: { base: ["surface", "danger"], focused: ["surface", "warning"] },
    },
  };
}

function standardInteractiveComponentDefinition(): ComponentThemeDefinition {
  return {
    base: {
      base: ["surface", "foreground"],
      focused: ["surface", "accent"],
      active: ["surface", "success"],
      disabled: ["surface", "muted"],
    },
    variants: {
      primary: { base: ["surface", "accent"], active: ["surface", "success"] },
      quiet: { base: "muted", focused: "accent" },
      danger: { base: "danger", focused: "warning", active: "danger" },
      warning: { base: "warning", focused: "accent", active: "warning" },
      success: { base: "success", focused: "accent", active: "success" },
    },
  };
}

function standardDataComponentDefinition(): ComponentThemeDefinition {
  return {
    base: {
      base: "foreground",
      focused: "accent",
      active: ["surface", "foreground"],
      disabled: "muted",
    },
    variants: {
      header: { base: ["surface", "accent"], active: ["surface", "success"] },
      selected: { base: ["surface", "foreground"], focused: ["surface", "accent"], active: ["surface", "success"] },
      stale: { base: "warning", focused: "accent" },
      danger: { base: "danger", focused: "warning" },
    },
  };
}

function standardOverlayComponentDefinition(): ComponentThemeDefinition {
  return {
    base: {
      base: ["surface", "foreground"],
      focused: ["surface", "accent"],
      active: ["surface", "success"],
      disabled: ["surface", "muted"],
    },
    variants: {
      palette: { base: ["surface", "foreground"], focused: ["surface", "accent"], active: ["surface", "success"] },
      warning: { base: ["surface", "warning"], focused: ["surface", "accent"] },
      danger: { base: ["surface", "danger"], focused: ["surface", "warning"] },
    },
  };
}

function standardFeedbackComponentDefinition(): ComponentThemeDefinition {
  return {
    base: {
      base: "foreground",
      focused: "accent",
      active: "success",
      disabled: "muted",
    },
    variants: {
      info: { base: "accent", active: "accent" },
      success: { base: "success", active: "success" },
      warning: { base: "warning", active: "warning" },
      danger: { base: "danger", active: "danger" },
    },
  };
}

function normalizeThemeComponentName(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}
