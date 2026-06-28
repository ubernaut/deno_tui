// Copyright 2023 Im-Beast. MIT license.

/** Function that's supposed to return styled text given string as parameter */
export type Style = (text: string) => string;

/** Used as placeholder style when one is not supplied, returns the input */
export function emptyStyle(text: string): string {
  return text;
}

/** Returns {replacement} if {style} is an {emptyStyle} otherwise returns {style} back */
export function replaceEmptyStyle(style: Style, replacement: Style): Style {
  return style === emptyStyle ? replacement : style;
}

/** Applies default values to properties (lower one hierarchy or `emptyStyle`) that aren't set */
export function hierarchizeTheme(input: Partial<Theme> = {}): Theme {
  input.base ??= emptyStyle;
  input.disabled ??= input.base;
  input.focused ??= input.base;
  input.active ??= input.focused;

  const output = input as Theme & Record<string, Theme>;
  for (const key in output) {
    if (key === "base" || key === "focused" || key === "active" || key === "disabled" || output === output[key]) {
      continue;
    }
    output[key] = hierarchizeTheme(output[key]);
  }

  return output;
}

/** Base theme used to style components, can be expanded upon */
export interface Theme {
  /** Default style */
  base: Style;
  /** Style when component is focused */
  focused: Style;
  /** Style when component is active */
  active: Style;
  /** Style when component is disabled */
  disabled: Style;
}

export interface ThemeTokens {
  foreground: Style;
  muted: Style;
  accent: Style;
  success: Style;
  warning: Style;
  danger: Style;
  surface: Style;
}

export function createTheme(tokens: Partial<ThemeTokens> = {}): Theme & { tokens: ThemeTokens } {
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

export type ThemeState = keyof Theme;

export interface ComponentThemeDefinition {
  base?: Partial<Theme>;
  variants?: Record<string, Partial<Theme>>;
}

export interface ThemeEngineOptions {
  tokens?: Partial<ThemeTokens>;
  components?: Record<string, ComponentThemeDefinition>;
}

export interface ThemeComponentInspection {
  name: string;
  variants: string[];
}

export interface ThemeInspection {
  tokens: Array<keyof ThemeTokens>;
  components: ThemeComponentInspection[];
}

export type ThemePaletteName = "plain" | "neon" | "terminal";

export const themePalettes: Record<ThemePaletteName, Partial<ThemeTokens>> = {
  plain: {
    foreground: emptyStyle,
    muted: emptyStyle,
    accent: emptyStyle,
    success: emptyStyle,
    warning: emptyStyle,
    danger: emptyStyle,
    surface: emptyStyle,
  },
  neon: {
    foreground: (value) => `\x1b[38;2;230;255;246m${value}\x1b[0m`,
    muted: (value) => `\x1b[38;2;104;124;132m${value}\x1b[0m`,
    accent: (value) => `\x1b[38;2;31;231;210m${value}\x1b[0m`,
    success: (value) => `\x1b[38;2;156;255;58m${value}\x1b[0m`,
    warning: (value) => `\x1b[38;2;255;196;87m${value}\x1b[0m`,
    danger: (value) => `\x1b[38;2;255;79;216m${value}\x1b[0m`,
    surface: (value) => `\x1b[48;2;7;16;23m${value}\x1b[0m`,
  },
  terminal: {
    foreground: (value) => `\x1b[37m${value}\x1b[0m`,
    muted: (value) => `\x1b[90m${value}\x1b[0m`,
    accent: (value) => `\x1b[36m${value}\x1b[0m`,
    success: (value) => `\x1b[32m${value}\x1b[0m`,
    warning: (value) => `\x1b[33m${value}\x1b[0m`,
    danger: (value) => `\x1b[31m${value}\x1b[0m`,
    surface: emptyStyle,
  },
};

export function mergeComponentThemeDefinition(
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
    base: {
      ...(base.base ?? {}),
      ...(extension.base ?? {}),
    },
    variants,
  };
}

export function composeThemeOptions(...options: ThemeEngineOptions[]): ThemeEngineOptions {
  const tokens: Partial<ThemeTokens> = {};
  const components: Record<string, ComponentThemeDefinition> = {};

  for (const option of options) {
    Object.assign(tokens, option.tokens ?? {});
    for (const [name, definition] of Object.entries(option.components ?? {})) {
      components[name] = mergeComponentThemeDefinition(components[name], definition);
    }
  }

  return { tokens, components };
}

export function createThemeEngine(
  palette: ThemePaletteName = "plain",
  options: Omit<ThemeEngineOptions, "tokens"> & { tokens?: Partial<ThemeTokens> } = {},
): ThemeEngine {
  return new ThemeEngine({
    ...options,
    tokens: {
      ...themePalettes[palette],
      ...(options.tokens ?? {}),
    },
  });
}

export class ThemeEngine {
  readonly theme: Theme & { tokens: ThemeTokens };
  private readonly components: Record<string, ComponentThemeDefinition>;

  constructor(options: ThemeEngineOptions = {}) {
    this.theme = createTheme(options.tokens);
    this.components = composeThemeOptions({ components: options.components }).components ?? {};
  }

  component(componentName: string, variant = "default"): Theme {
    const definition = this.components[componentName];
    return hierarchizeTheme({
      base: this.theme.base,
      focused: this.theme.focused,
      active: this.theme.active,
      disabled: this.theme.disabled,
      ...(definition?.base ?? {}),
      ...(variant === "default" ? {} : definition?.variants?.[variant] ?? {}),
    });
  }

  resolve(componentName: string, state: ThemeState, variant = "default"): Style {
    return this.component(componentName, variant)[state];
  }

  extend(options: ThemeEngineOptions): ThemeEngine {
    return new ThemeEngine(composeThemeOptions({
      tokens: this.theme.tokens,
      components: this.components,
    }, options));
  }

  componentNames(): string[] {
    return Object.keys(this.components).sort();
  }

  variants(componentName: string): string[] {
    return Object.keys(this.components[componentName]?.variants ?? {}).sort();
  }

  inspect(): ThemeInspection {
    return {
      tokens: ["foreground", "muted", "accent", "success", "warning", "danger", "surface"],
      components: this.componentNames().map((name) => ({
        name,
        variants: this.variants(name),
      })),
    };
  }
}
