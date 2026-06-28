// Copyright 2023 Im-Beast. MIT license.
import type { Component } from "./component.ts";
import { Computed, Signal } from "./signals/mod.ts";
import type { Theme, ThemeProvider } from "./theme.ts";

export interface ThemeBindable {
  setTheme(theme: Theme): void;
}

export interface ComponentThemeBindingOptions {
  variant?: string | Signal<string>;
  abortSignal?: AbortSignal;
}

export function bindComponentTheme(
  target: Component | ThemeBindable,
  provider: ThemeProvider,
  componentName: string,
  options: ComponentThemeBindingOptions = {},
): () => void {
  const theme = new Computed(() =>
    provider.engine.value.component(
      componentName,
      options.variant instanceof Signal ? options.variant.value : options.variant ?? "default",
    )
  );

  const applyTheme = (value: Theme) => target.setTheme(value);
  applyTheme(theme.value);
  theme.subscribe(applyTheme, options.abortSignal);

  return () => {
    theme.unsubscribe(applyTheme);
    theme.dispose();
  };
}
