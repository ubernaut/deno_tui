// Copyright 2023 Im-Beast. MIT license.
import type { Signal } from "../signals/mod.ts";
import type { ThemeProvider } from "../theme.ts";
import type { PersistentSignal } from "../runtime/storage.ts";
import { bindRouteSignal, type RouteSignalBindingOptions } from "./route_bindings.ts";
import type { Route, RouteManager } from "./router.ts";
import type { AppSettingDefinition, SettingsController } from "./settings.ts";

export interface SettingBinding<T, Stored = T> {
  setting: PersistentSignal<T, Stored>;
  dispose: () => void;
}

export interface SettingSignalBindingOptions<T> {
  initialSync?: "setting" | "signal";
  equals?: (left: T, right: T) => boolean;
}

export interface RouteSettingBindingOptions<Stored = string>
  extends Omit<SettingSignalBindingOptions<string>, "initialSync">, RouteSignalBindingOptions {
  key?: string;
  initialValue?: string;
  setting?: PersistentSignal<string, Stored>;
  serialize?: (value: string) => Stored;
  deserialize?: (value: Stored) => string;
}

export interface ThemeSettingBindingOptions<Stored = string> extends SettingSignalBindingOptions<string> {
  key?: string;
  initialValue?: string;
  setting?: PersistentSignal<string, Stored>;
  serialize?: (value: string) => Stored;
  deserialize?: (value: Stored) => string;
}

export function bindSettingSignal<T, Stored = T>(
  setting: PersistentSignal<T, Stored>,
  target: Signal<T>,
  options: SettingSignalBindingOptions<T> = {},
): () => void {
  const equals = options.equals ?? Object.is;
  let disposed = false;
  let syncing = false;

  const setTarget = (value: T) => {
    if (equals(target.peek(), value)) return;
    syncing = true;
    target.value = value;
    syncing = false;
  };
  const setSetting = (value: T) => {
    if (equals(setting.value.peek(), value)) return;
    syncing = true;
    setting.set(value);
    syncing = false;
  };

  const syncTargetFromSetting = (value: T) => {
    if (disposed || syncing) return;
    setTarget(value);
  };
  const syncSettingFromTarget = (value: T) => {
    if (disposed || syncing) return;
    setSetting(value);
  };

  if (options.initialSync === "signal") {
    setSetting(target.peek());
  } else {
    setTarget(setting.value.peek());
    setting.ready.then((value) => {
      if (!disposed) setTarget(value);
    });
  }

  setting.value.subscribe(syncTargetFromSetting);
  target.subscribe(syncSettingFromTarget);

  return () => {
    disposed = true;
    setting.value.unsubscribe(syncTargetFromSetting);
    target.unsubscribe(syncSettingFromTarget);
  };
}

export function bindRouteSetting<TRoute extends Route = Route, Stored = string>(
  routes: RouteManager<TRoute>,
  settings: SettingsController,
  options: RouteSettingBindingOptions<Stored> = {},
): SettingBinding<string, Stored> {
  const setting = options.setting ??
    settings.signal(settingDefinition({
      key: options.key ?? "route",
      initialValue: options.initialValue ?? routes.activeRouteId.peek(),
      serialize: options.serialize,
      deserialize: options.deserialize,
    }));
  const dispose = bindRouteSignal(routes, setting.value, {
    initialSync: options.initialSync ?? "signal",
    fallbackRouteId: options.fallbackRouteId,
    onInvalidRoute: options.onInvalidRoute,
  });
  return { setting, dispose };
}

export function bindThemeSetting<Stored = string>(
  provider: ThemeProvider,
  settings: SettingsController,
  options: ThemeSettingBindingOptions<Stored> = {},
): SettingBinding<string, Stored> {
  const setting = options.setting ??
    settings.signal(settingDefinition({
      key: options.key ?? "theme",
      initialValue: options.initialValue ?? provider.activeId.peek(),
      serialize: options.serialize,
      deserialize: options.deserialize,
    }));

  const dispose = bindSettingSignal(setting, provider.activeId, {
    initialSync: options.initialSync,
    equals: options.equals,
  });
  const repairInvalidTheme = (id: string) => {
    if (!provider.registry.has(id)) {
      provider.setTheme(provider.themeIds()[0] ?? id);
      setting.set(provider.activeId.peek());
    }
  };
  provider.activeId.subscribe(repairInvalidTheme);

  return {
    setting,
    dispose: () => {
      dispose();
      provider.activeId.unsubscribe(repairInvalidTheme);
    },
  };
}

function settingDefinition<T, Stored>(
  definition: AppSettingDefinition<T, Stored>,
): AppSettingDefinition<T, Stored> {
  return definition;
}
