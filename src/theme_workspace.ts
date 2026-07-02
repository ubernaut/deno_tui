// Copyright 2023 Im-Beast. MIT license.
import {
  createThemeProvider,
  type ThemeEngine,
  type ThemeEngineOptions,
  type ThemeProvider,
  type ThemeProviderOptions,
} from "./theme.ts";
import {
  createThemeEngineFactoryRegistry,
  type ThemeEngineFactoryBuildResult,
  type ThemeEngineFactoryCatalogQuery,
  type ThemeEngineFactoryCatalogReport,
  type ThemeEngineFactoryDefinition,
  type ThemeEngineFactoryRegistry,
  type ThemeEnginePrewarmOptions,
} from "./theme_engine_factory.ts";
import {
  prewarmThemeEnginePipelines,
  ThemeEnginePipeline,
  type ThemeEnginePipelineBuildResult,
  type ThemeEnginePipelineInspection,
} from "./theme_engine_pipeline.ts";
import { AsyncScheduler, type AsyncSchedulerInspection, type ScheduledTaskOptions } from "./runtime/scheduler.ts";

/** Options for composing theme provider, factory, and pipeline primitives into one workspace. */
export interface ThemeWorkspaceOptions {
  provider?: ThemeProvider;
  providerOptions?: ThemeProviderOptions;
  factoryRegistry?: ThemeEngineFactoryRegistry;
  factories?: Iterable<ThemeEngineFactoryDefinition>;
  pipelines?: ThemeEnginePipeline | readonly ThemeEnginePipeline[];
}

/** Options for deriving an engine from the active provider or a factory preset. */
export interface ThemeWorkspaceEngineOptions {
  overrides?: ThemeEngineOptions;
  pipelines?: Iterable<string> | false;
}

/** Options for prewarming the workspace's theme engines and pipelines. */
export interface ThemeWorkspacePrewarmOptions extends ScheduledTaskOptions {
  scheduler?: AsyncScheduler;
  factories?: Iterable<string> | false;
  factoryOverrides?: ThemeEnginePrewarmOptions["overrides"];
  pipelines?: Iterable<string> | false;
  pipelineBase?: ThemeEngine | (() => ThemeEngine);
  includeActiveProvider?: boolean;
}

/** Scheduler-backed prewarm result for all selected theme workspace surfaces. */
export interface ThemeWorkspacePrewarmResult {
  factories: ThemeEngineFactoryBuildResult[];
  pipelines: ThemeEnginePipelineBuildResult[];
  activeProvider?: ThemeEngine;
  scheduler: AsyncSchedulerInspection;
}

/** Serializable snapshot for theme settings, diagnostics, and demos. */
export interface ThemeWorkspaceInspection {
  provider: ReturnType<ThemeProvider["inspect"]>;
  factories: ThemeEngineFactoryCatalogReport;
  pipelines: ThemeEnginePipelineInspection[];
  activeEngine: ReturnType<ThemeEngine["inspect"]>;
}

/** Composes a provider, engine factory registry, and runtime pipelines without hiding the underlying primitives. */
export class ThemeWorkspace {
  readonly provider: ThemeProvider;
  readonly factories: ThemeEngineFactoryRegistry;
  readonly pipelines: readonly ThemeEnginePipeline[];

  constructor(options: ThemeWorkspaceOptions = {}) {
    this.provider = options.provider ?? createThemeProvider(options.providerOptions);
    this.factories = options.factoryRegistry ?? createThemeEngineFactoryRegistry(options.factories);
    this.pipelines = normalizePipelines(options.pipelines);
  }

  /** Returns the active provider engine after applying selected runtime pipelines. */
  activeEngine(options: Omit<ThemeWorkspaceEngineOptions, "overrides"> = {}): ThemeEngine {
    return this.applyPipelines(this.provider.engine.peek(), options.pipelines);
  }

  /** Builds a factory preset and applies selected runtime pipelines to the result. */
  factoryEngine(id: string, options: ThemeWorkspaceEngineOptions = {}): ThemeEngine {
    return this.applyPipelines(this.factories.build(id, options.overrides), options.pipelines);
  }

  /** Returns the configured pipeline ids in application order. */
  pipelineIds(): string[] {
    const ids = new Array<string>(this.pipelines.length);
    for (let index = 0; index < this.pipelines.length; index += 1) {
      ids[index] = this.pipelines[index]!.id;
    }
    return ids;
  }

  /** Applies selected pipelines to a base engine in workspace order. */
  applyPipelines(base: ThemeEngine, ids: Iterable<string> | false | undefined = undefined): ThemeEngine {
    if (ids === false) return base;
    const requested = ids ? new Set(ids) : undefined;
    let engine = base;
    for (const pipeline of this.pipelines) {
      if (requested && !requested.has(pipeline.id)) continue;
      engine = pipeline.apply(engine);
    }
    return engine;
  }

  /** Prewarms factories, pipelines, and optionally the active provider through a shared scheduler. */
  async prewarm(options: ThemeWorkspacePrewarmOptions = {}): Promise<ThemeWorkspacePrewarmResult> {
    const scheduler = options.scheduler ?? new AsyncScheduler();
    const factories = options.factories === false
      ? Promise.resolve<ThemeEngineFactoryBuildResult[]>([])
      : this.factories.prewarm({
        ids: options.factories,
        scheduler,
        priority: options.priority,
        signal: options.signal,
        overrides: options.factoryOverrides,
      });
    const pipelines = options.pipelines === false
      ? Promise.resolve<ThemeEnginePipelineBuildResult[]>([])
      : prewarmThemeEnginePipelines(this.pipelines, {
        ids: options.pipelines,
        scheduler,
        priority: options.priority,
        signal: options.signal,
        base: options.pipelineBase ?? (() => this.provider.engine.peek()),
      });
    const activeProvider = options.includeActiveProvider
      ? scheduler.run(() => this.activeEngine(), { priority: options.priority, signal: options.signal })
      : Promise.resolve<ThemeEngine | undefined>(undefined);

    const [factoryResults, pipelineResults, activeProviderEngine] = await Promise.all([
      factories,
      pipelines,
      activeProvider,
    ]);

    return {
      factories: factoryResults,
      pipelines: pipelineResults,
      activeProvider: activeProviderEngine,
      scheduler: scheduler.inspect(),
    };
  }

  /** Returns provider, factory, pipeline, and active engine metadata in one serializable snapshot. */
  inspect(query: ThemeEngineFactoryCatalogQuery = {}): ThemeWorkspaceInspection {
    const pipelines = new Array<ThemeEnginePipelineInspection>(this.pipelines.length);
    for (let index = 0; index < this.pipelines.length; index += 1) {
      pipelines[index] = this.pipelines[index]!.inspect();
    }
    return {
      provider: this.provider.inspect(),
      factories: this.factories.catalog(query),
      pipelines,
      activeEngine: this.activeEngine().inspect(),
    };
  }
}

/** Creates a theme workspace from provider, factory, and pipeline primitives. */
export function createThemeWorkspace(options: ThemeWorkspaceOptions = {}): ThemeWorkspace {
  return new ThemeWorkspace(options);
}

function normalizePipelines(pipelines: ThemeWorkspaceOptions["pipelines"]): ThemeEnginePipeline[] {
  if (!pipelines) return [];
  return pipelines instanceof ThemeEnginePipeline ? [pipelines] : [...pipelines];
}
