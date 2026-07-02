// Copyright 2023 Im-Beast. MIT license.
import { emptyStyle } from "./theme_ansi.ts";
import type {
  ComponentThemeDefinition,
  Style,
  Theme,
  ThemeEngineOptions,
  ThemeState,
  ThemeStateDefinition,
  ThemeStyleReference,
  ThemeTokens,
} from "./theme.ts";

export function hierarchizeThemeCore(input: Partial<Theme> = {}): Theme {
  input.base ??= emptyStyle;
  input.disabled ??= input.base;
  input.focused ??= input.base;
  input.active ??= input.focused;

  const output = input as Theme & Record<string, Theme>;
  for (const key in output) {
    if (key === "base" || key === "focused" || key === "active" || key === "disabled" || output === output[key]) {
      continue;
    }
    output[key] = hierarchizeThemeCore(output[key]);
  }

  return output;
}

export function createThemeCore(tokens: Partial<ThemeTokens> = {}): Theme & { tokens: ThemeTokens } {
  const fallback = tokens.foreground ?? emptyStyle;
  return {
    base: fallback,
    focused: tokens.accent ?? fallback,
    active: tokens.success ?? tokens.accent ?? fallback,
    disabled: tokens.muted ?? fallback,
    tokens: {
      foreground: fallback,
      muted: tokens.muted ?? fallback,
      accent: tokens.accent ?? fallback,
      success: tokens.success ?? fallback,
      warning: tokens.warning ?? fallback,
      danger: tokens.danger ?? fallback,
      surface: tokens.surface ?? emptyStyle,
    },
  };
}

export function mergeComponentThemeDefinitionCore(
  base: ComponentThemeDefinition = {},
  extension: ComponentThemeDefinition = {},
): ComponentThemeDefinition {
  const variants = { ...(base.variants ?? {}) };
  for (const [name, variant] of Object.entries(extension.variants ?? {})) {
    variants[name] = {
      ...(variants[name] ?? {}),
      ...variant,
    };
  }

  return {
    extends: mergeThemeExtends(base.extends, extension.extends),
    base: {
      ...(base.base ?? {}),
      ...(extension.base ?? {}),
    },
    variants,
  };
}

export function composeStylesCore(...styles: Style[]): Style {
  let first: Style | undefined;
  let active: Style[] | undefined;
  for (const style of styles) {
    if (style === emptyStyle) continue;
    if (!first) {
      first = style;
    } else {
      active ??= [first];
      active.push(style);
    }
  }
  if (!first) return emptyStyle;
  if (!active) return first;
  return (value) => {
    let output = value;
    for (let index = 0; index < active.length; index += 1) {
      output = active[index]!(output);
    }
    return output;
  };
}

export function resolveThemeStyleReferenceCore(reference: ThemeStyleReference, tokens: ThemeTokens): Style {
  if (isThemeStyleReferencePipeline(reference)) {
    return composeStylesCore(...reference.map((part) => resolveThemeStyleReferenceCore(part, tokens)));
  }
  return typeof reference === "string" ? tokens[reference] : reference;
}

export function resolveThemeStateDefinitionCore(
  definition: ThemeStateDefinition = {},
  tokens: ThemeTokens,
): Partial<Theme> {
  const resolved: Partial<Theme> = {};
  for (const [state, reference] of Object.entries(definition) as [ThemeState, ThemeStyleReference][]) {
    if (reference === undefined) continue;
    resolved[state] = resolveThemeStyleReferenceCore(reference, tokens);
  }
  return resolved;
}

export function composeThemeOptionsCore(...options: ThemeEngineOptions[]): ThemeEngineOptions {
  const tokens: Partial<ThemeTokens> = {};
  const components: Record<string, ComponentThemeDefinition> = {};

  for (const option of options) {
    Object.assign(tokens, option.tokens ?? {});
    for (const [name, definition] of Object.entries(option.components ?? {})) {
      components[name] = mergeComponentThemeDefinitionCore(components[name], definition);
    }
  }

  return { tokens, components };
}

export function mergeThemeExtends(
  base: string | readonly string[] | undefined,
  extension: string | readonly string[] | undefined,
): string | readonly string[] | undefined {
  const names = [...normalizeThemeExtends(base), ...normalizeThemeExtends(extension)];
  return names.length === 0 ? undefined : [...new Set(names)];
}

export function normalizeThemeExtends(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : [...value];
}

export function isThemeStyleReferencePipeline(
  reference: ThemeStyleReference,
): reference is readonly ThemeStyleReference[] {
  return Array.isArray(reference);
}
