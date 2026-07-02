// Copyright 2023 Im-Beast. MIT license.
import type {
  ComponentThemeDefinition,
  Theme,
  ThemeEngineOptions,
  ThemeInspection,
  ThemeState,
  ThemeTokenName,
  ThemeTokens,
} from "./theme.ts";
import {
  composeThemeOptionsCore,
  createThemeCore,
  hierarchizeThemeCore,
  mergeComponentThemeDefinitionCore,
  normalizeThemeExtends,
  resolveThemeStateDefinitionCore,
} from "./theme_core.ts";

const themeEngineTokenNames = [
  "foreground",
  "muted",
  "accent",
  "success",
  "warning",
  "danger",
  "surface",
] as const satisfies readonly ThemeTokenName[];

/** Public class implementing a theme Engine. */
export class ThemeEngine {
  readonly theme: Theme & { tokens: ThemeTokens };
  protected readonly components: Record<string, ComponentThemeDefinition>;
  readonly #createInheritanceError: (chain: string[]) => Error;
  #componentNames?: string[];
  #variants = new Map<string, string[]>();

  constructor(
    options: ThemeEngineOptions = {},
    createInheritanceError: (chain: string[]) => Error = (chain) => new ThemeInheritanceError(chain),
  ) {
    this.theme = createThemeCore(options.tokens);
    this.components = composeThemeOptionsCore({ components: options.components }).components ?? {};
    this.#createInheritanceError = createInheritanceError;
  }

  component(componentName: string, variant = "default"): Theme {
    const definition = this.resolveComponentDefinition(componentName);
    return hierarchizeThemeCore({
      base: this.theme.base,
      focused: this.theme.focused,
      active: this.theme.active,
      disabled: this.theme.disabled,
      ...resolveThemeStateDefinitionCore(definition?.base, this.theme.tokens),
      ...(variant === "default"
        ? {}
        : resolveThemeStateDefinitionCore(definition?.variants?.[variant], this.theme.tokens)),
    });
  }

  resolve(componentName: string, state: ThemeState, variant = "default"): Theme[ThemeState] {
    return this.component(componentName, variant)[state];
  }

  extend(options: ThemeEngineOptions): ThemeEngine {
    return new ThemeEngine(
      composeThemeOptionsCore({
        tokens: this.theme.tokens,
        components: this.components,
      }, options),
      this.#createInheritanceError,
    );
  }

  componentNames(): string[] {
    if (!this.#componentNames) {
      const names = Object.keys(this.components);
      names.sort();
      this.#componentNames = names;
    }
    return cloneStringArray(this.#componentNames);
  }

  variants(componentName: string): string[] {
    const cached = this.#variants.get(componentName);
    if (cached) return cloneStringArray(cached);
    const variants = Object.keys(this.resolveComponentDefinition(componentName).variants ?? {});
    variants.sort();
    this.#variants.set(componentName, variants);
    return cloneStringArray(variants);
  }

  inspect(): ThemeInspection {
    return {
      tokens: [...themeEngineTokenNames],
      components: this.componentNames().map((name) => ({
        name,
        variants: this.variants(name),
      })),
    };
  }

  private resolveComponentDefinition(
    componentName: string,
    seen = new Set<string>(),
  ): ComponentThemeDefinition {
    const definition = this.components[componentName];
    if (!definition) return {};
    if (seen.has(componentName)) {
      throw this.#createInheritanceError([...seen, componentName]);
    }
    seen.add(componentName);

    let resolved: ComponentThemeDefinition = {};
    for (const parent of normalizeThemeExtends(definition.extends)) {
      resolved = mergeComponentThemeDefinitionCore(
        resolved,
        this.resolveComponentDefinition(parent, new Set(seen)),
      );
    }

    return mergeComponentThemeDefinitionCore(resolved, {
      base: definition.base,
      variants: definition.variants,
    });
  }
}

function cloneStringArray(values: readonly string[]): string[] {
  const output = new Array<string>(values.length);
  for (let index = 0; index < values.length; index += 1) output[index] = values[index]!;
  return output;
}

/** Error thrown for invalid theme Inheritance operations. */
export class ThemeInheritanceError extends Error {
  constructor(chain: string[]) {
    super(`Theme component inheritance cycle detected: ${chain.join(" -> ")}`);
    this.name = "ThemeInheritanceError";
  }
}
