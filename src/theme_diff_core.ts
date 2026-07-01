// Copyright 2023 Im-Beast. MIT license.

/** Internal style function shape used by theme diffing. */
export type ThemeDiffStyleCore = (value: string) => string;

/** Internal style preview emitted by theme diffing. */
export interface ThemeDiffStylePreviewCore {
  raw: string;
  styled: string;
}

/** Internal token diff emitted by theme diffing. */
export interface ThemeTokenDiffCore<Token extends string = string> {
  token: Token;
  before: ThemeDiffStylePreviewCore;
  after: ThemeDiffStylePreviewCore;
}

/** Internal component state diff emitted by theme diffing. */
export interface ThemeComponentStateDiffCore<State extends string = string> {
  component: string;
  variant: string;
  state: State;
  before: ThemeDiffStylePreviewCore;
  after: ThemeDiffStylePreviewCore;
}

/** Internal engine-shaped interface required by theme diffing. */
export interface ThemeDiffEngineCore<State extends string = string, Token extends string = string> {
  theme: { tokens: Record<Token, ThemeDiffStyleCore> };
  componentNames(): Iterable<string>;
  variants(component: string): Iterable<string>;
  component(component: string, variant?: string): Record<State, ThemeDiffStyleCore>;
}

/** Options for diffing two theme-like engines. */
export interface DiffThemeEnginesCoreOptions<State extends string = string, Token extends string = string> {
  sample?: string;
  tokenNames: readonly Token[];
  states: readonly State[];
  components?: Iterable<string>;
  variants?: (
    component: string,
    engines: readonly [
      ThemeDiffEngineCore<State, Token>,
      ThemeDiffEngineCore<State, Token>,
    ],
  ) => Iterable<string>;
  includeUnchanged?: boolean;
}

/** Internal theme engine diff shape. */
export interface ThemeEngineDiffCore<State extends string = string, Token extends string = string> {
  sample: string;
  tokens: ThemeTokenDiffCore<Token>[];
  components: ThemeComponentStateDiffCore<State>[];
}

/** Diffs two theme-like engines by previewing token and component state output. */
export function diffThemeEnginesCore<State extends string = string, Token extends string = string>(
  before: ThemeDiffEngineCore<State, Token>,
  after: ThemeDiffEngineCore<State, Token>,
  options: DiffThemeEnginesCoreOptions<State, Token>,
): ThemeEngineDiffCore<State, Token> {
  const sample = options.sample ?? "Aa";
  const includeUnchanged = options.includeUnchanged ?? false;
  const tokenDiffs: ThemeTokenDiffCore<Token>[] = [];
  const componentDiffs: ThemeComponentStateDiffCore<State>[] = [];

  for (const token of options.tokenNames) {
    const beforePreview = previewThemeDiffStyleCore(before.theme.tokens[token], sample);
    const afterPreview = previewThemeDiffStyleCore(after.theme.tokens[token], sample);
    if (includeUnchanged || beforePreview.styled !== afterPreview.styled) {
      tokenDiffs.push({ token, before: beforePreview, after: afterPreview });
    }
  }

  const componentNames = options.components
    ? [...options.components]
    : [...new Set([...before.componentNames(), ...after.componentNames()])].sort();

  for (const component of componentNames) {
    const variants = options.variants
      ? [...options.variants(component, [before, after])]
      : themeDiffVariantsCore(component, before, after);
    for (const variant of variants) {
      const beforeTheme = before.component(component, variant);
      const afterTheme = after.component(component, variant);
      for (const state of options.states) {
        const beforePreview = previewThemeDiffStyleCore(beforeTheme[state], sample);
        const afterPreview = previewThemeDiffStyleCore(afterTheme[state], sample);
        if (includeUnchanged || beforePreview.styled !== afterPreview.styled) {
          componentDiffs.push({ component, variant, state, before: beforePreview, after: afterPreview });
        }
      }
    }
  }

  return { sample, tokens: tokenDiffs, components: componentDiffs };
}

/** Internal helper for previewing one style function. */
export function previewThemeDiffStyleCore(
  style: ThemeDiffStyleCore,
  sample: string,
): ThemeDiffStylePreviewCore {
  return { raw: sample, styled: style(sample) };
}

function themeDiffVariantsCore<State extends string, Token extends string>(
  component: string,
  before: ThemeDiffEngineCore<State, Token>,
  after: ThemeDiffEngineCore<State, Token>,
): string[] {
  return [...new Set(["default", ...before.variants(component), ...after.variants(component)])].sort((a, b) => {
    if (a === "default") return -1;
    if (b === "default") return 1;
    return a.localeCompare(b);
  });
}
