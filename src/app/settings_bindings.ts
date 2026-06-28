// Copyright 2023 Im-Beast. MIT license.
import type { Signal } from "../signals/mod.ts";
import type { ThemeLayerStack, ThemeProvider } from "../theme.ts";
import type { ThemeEnginePipeline } from "../theme_engine_pipeline.ts";
import type { PersistentSignal } from "../runtime/storage.ts";
import type { RuntimeProfileController } from "../runtime/profiles.ts";
import type { RuntimeRendererBackendController } from "../runtime/renderer_backends.ts";
import type { SplitPaneController, SplitPaneControllerOptions } from "../layout/mod.ts";
import { canSortColumn, type DataTableController, type DataTableState } from "../components/data_table.ts";
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

export interface ThemeLayerSettingBindingOptions<Stored = readonly string[]>
  extends SettingSignalBindingOptions<readonly string[]> {
  key?: string;
  initialValue?: readonly string[];
  setting?: PersistentSignal<readonly string[], Stored>;
  serialize?: (value: readonly string[]) => Stored;
  deserialize?: (value: Stored) => readonly string[];
}

export interface ThemePipelineSettingBindingOptions<Stored = readonly string[]>
  extends SettingSignalBindingOptions<readonly string[]> {
  key?: string;
  initialValue?: readonly string[];
  setting?: PersistentSignal<readonly string[], Stored>;
  serialize?: (value: readonly string[]) => Stored;
  deserialize?: (value: Stored) => readonly string[];
}

export interface RuntimeProfileSettingBindingOptions<Stored = string> extends SettingSignalBindingOptions<string> {
  key?: string;
  initialValue?: string;
  setting?: PersistentSignal<string, Stored>;
  serialize?: (value: string) => Stored;
  deserialize?: (value: Stored) => string;
}

export interface RuntimeRendererBackendSettingBindingOptions<Stored = string>
  extends SettingSignalBindingOptions<string> {
  key?: string;
  initialValue?: string;
  setting?: PersistentSignal<string, Stored>;
  serialize?: (value: string) => Stored;
  deserialize?: (value: Stored) => string;
}

export interface SplitPaneSettingBindingOptions<Stored = SplitPaneControllerOptions>
  extends SettingSignalBindingOptions<SplitPaneControllerOptions> {
  key?: string;
  initialValue?: SplitPaneControllerOptions;
  setting?: PersistentSignal<SplitPaneControllerOptions, Stored>;
  serialize?: (value: SplitPaneControllerOptions) => Stored;
  deserialize?: (value: Stored) => SplitPaneControllerOptions;
}

/** Options for persisting data-table query, sort, pagination, and selected row state. */
export interface DataTableSettingBindingOptions<Stored = DataTableState>
  extends SettingSignalBindingOptions<DataTableState> {
  key?: string;
  initialValue?: DataTableState;
  setting?: PersistentSignal<DataTableState, Stored>;
  serialize?: (value: DataTableState) => Stored;
  deserialize?: (value: Stored) => DataTableState;
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

export function bindThemeLayerSetting<Stored = readonly string[]>(
  target: ThemeProvider | ThemeLayerStack,
  settings: SettingsController,
  options: ThemeLayerSettingBindingOptions<Stored> = {},
): SettingBinding<readonly string[], Stored> {
  const layers = "layers" in target ? target.layers : target;
  const setting = options.setting ??
    settings.signal(settingDefinition({
      key: options.key ?? "theme-layers",
      initialValue: options.initialValue ?? layers.activeIds(),
      serialize: options.serialize,
      deserialize: options.deserialize,
    }));

  let disposed = false;
  let syncing = false;
  const equals = options.equals ?? stringArrayEqual;

  const applyLayers = (value: readonly string[]) => {
    if (equals(layers.activeIds(), value)) return;
    syncing = true;
    layers.setActiveIds(value);
    syncing = false;
  };
  const applySetting = () => {
    if (disposed || syncing) return;
    const activeIds = layers.activeIds();
    if (!equals(setting.value.peek(), activeIds)) {
      syncing = true;
      setting.set(activeIds);
      syncing = false;
    }
  };
  const applyLoadedSetting = (value: readonly string[]) => {
    if (disposed || syncing) return;
    applyLayers(value);
  };

  if (options.initialSync === "signal") {
    setting.set(layers.activeIds());
  } else {
    applyLayers(setting.value.peek());
    setting.ready.then((value) => {
      if (!disposed) applyLayers(value);
    });
  }

  setting.value.subscribe(applyLoadedSetting);
  layers.options.subscribe(applySetting);

  return {
    setting,
    dispose: () => {
      disposed = true;
      setting.value.unsubscribe(applyLoadedSetting);
      layers.options.unsubscribe(applySetting);
    },
  };
}

export function bindThemePipelineSetting<Stored = readonly string[]>(
  pipeline: ThemeEnginePipeline,
  settings: SettingsController,
  options: ThemePipelineSettingBindingOptions<Stored> = {},
): SettingBinding<readonly string[], Stored> {
  const setting = options.setting ??
    settings.signal(settingDefinition({
      key: options.key ?? `theme-pipeline-${pipeline.id}`,
      initialValue: options.initialValue ?? pipeline.activeIds(),
      serialize: options.serialize,
      deserialize: options.deserialize,
    }));

  let disposed = false;
  let syncing = false;
  const equals = options.equals ?? stringArrayEqual;

  const applyPipeline = (value: readonly string[]) => {
    const next = sanitizePipelineStepIds(pipeline, value);
    if (equals(pipeline.activeIds(), next)) return;
    syncing = true;
    pipeline.setActiveIds(next);
    syncing = false;
  };
  const applySetting = () => {
    if (disposed || syncing) return;
    const activeIds = pipeline.activeIds();
    if (!equals(setting.value.peek(), activeIds)) {
      syncing = true;
      setting.set(activeIds);
      syncing = false;
    }
  };
  const applyLoadedSetting = (value: readonly string[]) => {
    if (disposed || syncing) return;
    const next = sanitizePipelineStepIds(pipeline, value);
    applyPipeline(next);
    if (!equals(setting.value.peek(), next)) {
      syncing = true;
      setting.set(next);
      syncing = false;
    }
  };

  const unsubscribePipeline = pipeline.subscribe(applySetting);

  if (options.initialSync === "signal") {
    setting.set(pipeline.activeIds());
  } else {
    applyLoadedSetting(setting.value.peek());
    setting.ready.then((value) => {
      if (!disposed) applyLoadedSetting(value);
    });
  }

  setting.value.subscribe(applyLoadedSetting);

  return {
    setting,
    dispose: () => {
      disposed = true;
      setting.value.unsubscribe(applyLoadedSetting);
      unsubscribePipeline();
    },
  };
}

export function bindRuntimeProfileSetting<Stored = string>(
  controller: RuntimeProfileController,
  settings: SettingsController,
  options: RuntimeProfileSettingBindingOptions<Stored> = {},
): SettingBinding<string, Stored> {
  const setting = options.setting ??
    settings.signal(settingDefinition({
      key: options.key ?? "runtime-profile",
      initialValue: options.initialValue ?? controller.activeId.peek(),
      serialize: options.serialize,
      deserialize: options.deserialize,
    }));

  let disposed = false;
  let syncing = false;
  const equals = options.equals ?? Object.is;

  const fallbackId = () => controller.ids()[0] ?? "";
  const sanitize = (id: string) => controller.registry.has(id) ? id : fallbackId();
  const applyController = (id: string) => {
    const next = sanitize(id);
    if (equals(controller.activeId.peek(), next)) return;
    syncing = true;
    controller.setProfile(next);
    syncing = false;
  };
  const applySetting = (id: string) => {
    if (disposed || syncing) return;
    const next = sanitize(id);
    if (!equals(setting.value.peek(), next)) {
      syncing = true;
      setting.set(next);
      syncing = false;
    }
  };
  const applyLoadedSetting = (id: string) => {
    if (disposed || syncing) return;
    const next = sanitize(id);
    applyController(next);
    if (!equals(setting.value.peek(), next)) {
      syncing = true;
      setting.set(next);
      syncing = false;
    }
  };

  if (options.initialSync === "signal") {
    setting.set(controller.activeId.peek());
  } else {
    applyLoadedSetting(setting.value.peek());
    setting.ready.then((value) => {
      if (!disposed) applyLoadedSetting(value);
    });
  }

  setting.value.subscribe(applyLoadedSetting);
  controller.activeId.subscribe(applySetting);

  return {
    setting,
    dispose: () => {
      disposed = true;
      setting.value.unsubscribe(applyLoadedSetting);
      controller.activeId.unsubscribe(applySetting);
    },
  };
}

export function bindRuntimeRendererBackendSetting<Stored = string>(
  controller: RuntimeRendererBackendController,
  settings: SettingsController,
  options: RuntimeRendererBackendSettingBindingOptions<Stored> = {},
): SettingBinding<string, Stored> {
  const setting = options.setting ??
    settings.signal(settingDefinition({
      key: options.key ?? "runtime-renderer",
      initialValue: options.initialValue ?? controller.activeId.peek(),
      serialize: options.serialize,
      deserialize: options.deserialize,
    }));

  let disposed = false;
  let syncing = false;
  const equals = options.equals ?? Object.is;

  const fallbackId = () => controller.selected()?.id ?? controller.ids()[0] ?? "";
  const sanitize = (id: string) => controller.registry.has(id) ? id : fallbackId();
  const applyController = (id: string) => {
    const next = sanitize(id);
    if (equals(controller.activeId.peek(), next)) return;
    syncing = true;
    controller.setBackend(next);
    syncing = false;
  };
  const applySetting = (id: string) => {
    if (disposed || syncing) return;
    const next = sanitize(id);
    if (!equals(setting.value.peek(), next)) {
      syncing = true;
      setting.set(next);
      syncing = false;
    }
  };
  const applyLoadedSetting = (id: string) => {
    if (disposed || syncing) return;
    const next = sanitize(id);
    applyController(next);
    if (!equals(setting.value.peek(), next)) {
      syncing = true;
      setting.set(next);
      syncing = false;
    }
  };

  if (options.initialSync === "signal") {
    setting.set(controller.activeId.peek());
  } else {
    applyLoadedSetting(setting.value.peek());
    setting.ready.then((value) => {
      if (!disposed) applyLoadedSetting(value);
    });
  }

  setting.value.subscribe(applyLoadedSetting);
  controller.activeId.subscribe(applySetting);

  return {
    setting,
    dispose: () => {
      disposed = true;
      setting.value.unsubscribe(applyLoadedSetting);
      controller.activeId.unsubscribe(applySetting);
    },
  };
}

export function bindSplitPaneSetting<Stored = SplitPaneControllerOptions>(
  controller: SplitPaneController,
  settings: SettingsController,
  options: SplitPaneSettingBindingOptions<Stored> = {},
): SettingBinding<SplitPaneControllerOptions, Stored> {
  const setting = options.setting ??
    settings.signal(settingDefinition({
      key: options.key ?? "split-pane",
      initialValue: options.initialValue ?? controller.snapshot(),
      serialize: options.serialize,
      deserialize: options.deserialize,
    }));

  let disposed = false;
  let syncing = false;
  const equals = options.equals ?? splitPaneOptionsEqual;

  const applyController = (value: SplitPaneControllerOptions) => {
    if (equals(controller.snapshot(), value)) return;
    syncing = true;
    controller.update(value);
    syncing = false;
  };
  const applySetting = () => {
    if (disposed || syncing) return;
    const snapshot = controller.snapshot();
    if (!equals(setting.value.peek(), snapshot)) {
      syncing = true;
      setting.set(snapshot);
      syncing = false;
    }
  };
  const applyLoadedSetting = (value: SplitPaneControllerOptions) => {
    if (disposed || syncing) return;
    applyController(value);
  };

  if (options.initialSync === "signal") {
    setting.set(controller.snapshot());
  } else {
    applyController(setting.value.peek());
    setting.ready.then((value) => {
      if (!disposed) applyController(value);
    });
  }

  setting.value.subscribe(applyLoadedSetting);
  controller.options.subscribe(applySetting);
  controller.resizeMode.subscribe(applySetting);

  return {
    setting,
    dispose: () => {
      disposed = true;
      setting.value.unsubscribe(applyLoadedSetting);
      controller.options.unsubscribe(applySetting);
      controller.resizeMode.unsubscribe(applySetting);
    },
  };
}

/** Restores and persists a `DataTableController` state through app settings. */
export function bindDataTableSetting<
  TRow extends Record<string, unknown> = Record<string, unknown>,
  Stored = DataTableState,
>(
  controller: DataTableController<TRow>,
  settings: SettingsController,
  options: DataTableSettingBindingOptions<Stored> = {},
): SettingBinding<DataTableState, Stored> {
  const setting = options.setting ??
    settings.signal(settingDefinition({
      key: options.key ?? "data-table",
      initialValue: options.initialValue ?? snapshotDataTableState(controller),
      serialize: options.serialize,
      deserialize: options.deserialize,
      signalOptions: { deepObserve: true },
    }));

  let disposed = false;
  let syncing = false;
  const equals = options.equals ?? dataTableStateEqual;

  const applyController = (value: DataTableState) => {
    const next = sanitizeDataTableState(controller, value);
    if (equals(sanitizeDataTableState(controller, controller.state.peek()), next)) return;
    syncing = true;
    controller.state.value = next;
    syncing = false;
  };
  const applySetting = () => {
    if (disposed || syncing) return;
    const next = snapshotDataTableState(controller);
    if (!equals(setting.value.peek(), next)) {
      syncing = true;
      setting.set(next);
      syncing = false;
    }
  };
  const applyLoadedSetting = (value: DataTableState) => {
    if (disposed || syncing) return;
    const next = sanitizeDataTableState(controller, value);
    applyController(value);
    if (!equals(setting.value.peek(), next)) {
      syncing = true;
      setting.set(next);
      syncing = false;
    }
  };

  if (options.initialSync === "signal") {
    setting.set(snapshotDataTableState(controller));
  } else {
    applyLoadedSetting(setting.value.peek());
    setting.ready.then((value) => {
      if (!disposed) applyLoadedSetting(value);
    });
  }

  setting.value.subscribe(applyLoadedSetting);
  controller.state.subscribe(applySetting);
  controller.columns.subscribe(applySetting);

  return {
    setting,
    dispose: () => {
      disposed = true;
      setting.value.unsubscribe(applyLoadedSetting);
      controller.state.unsubscribe(applySetting);
      controller.columns.unsubscribe(applySetting);
    },
  };
}

function settingDefinition<T, Stored>(
  definition: AppSettingDefinition<T, Stored>,
): AppSettingDefinition<T, Stored> {
  return definition;
}

function sanitizeDataTableState<TRow extends Record<string, unknown>>(
  controller: DataTableController<TRow>,
  state: DataTableState,
): DataTableState {
  const pageSize = state.pageSize === undefined ? undefined : Math.max(1, Math.floor(state.pageSize));
  const page = state.page === undefined ? undefined : Math.max(0, Math.floor(state.page));
  const selectedIndex = state.selectedIndex === undefined ? undefined : Math.max(0, Math.floor(state.selectedIndex));
  const sort = state.sort && canSortColumn(controller.columns.peek(), state.sort.columnId) ? state.sort : undefined;
  return {
    ...(state.query ? { query: state.query } : {}),
    ...(sort ? { sort } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
    ...(selectedIndex !== undefined ? { selectedIndex } : {}),
    ...(state.selectedKey !== undefined ? { selectedKey: state.selectedKey } : {}),
  };
}

function snapshotDataTableState<TRow extends Record<string, unknown>>(
  controller: DataTableController<TRow>,
): DataTableState {
  const state = sanitizeDataTableState(controller, controller.state.peek());
  const view = controller.view.peek();
  return {
    ...(state.query ? { query: state.query } : {}),
    ...(state.sort ? { sort: state.sort } : {}),
    page: view.page,
    pageSize: view.pageSize,
    selectedIndex: view.selectedIndex,
    ...(view.selectedKey !== undefined ? { selectedKey: view.selectedKey } : {}),
  };
}

function dataTableStateEqual(left: DataTableState, right: DataTableState): boolean {
  return (left.query ?? "") === (right.query ?? "") &&
    left.sort?.columnId === right.sort?.columnId &&
    left.sort?.direction === right.sort?.direction &&
    left.page === right.page &&
    left.pageSize === right.pageSize &&
    left.selectedIndex === right.selectedIndex &&
    left.selectedKey === right.selectedKey;
}

function sanitizePipelineStepIds(pipeline: ThemeEnginePipeline, ids: readonly string[]): string[] {
  const requested = new Set(ids);
  return pipeline.ids().filter((id) => requested.has(id));
}

function splitPaneOptionsEqual(left: SplitPaneControllerOptions, right: SplitPaneControllerOptions): boolean {
  return left.direction === right.direction &&
    left.ratio === right.ratio &&
    left.firstSize === right.firstSize &&
    left.minFirst === right.minFirst &&
    left.minSecond === right.minSecond &&
    left.maxFirst === right.maxFirst &&
    left.gap === right.gap &&
    (left.resizeMode ?? "size") === (right.resizeMode ?? "size");
}

function stringArrayEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
