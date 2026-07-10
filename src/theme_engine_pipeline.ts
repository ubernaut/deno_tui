// Copyright 2023 Im-Beast. MIT license.
import { AsyncScheduler, runTaskBatch, type ScheduledTaskOptions } from "./runtime/scheduler.ts";
import { orderedSubset } from "./utils/collections.ts";
import {
  composeThemeOptions,
  ThemeEngine,
  type ThemeEngineOptions,
  type ThemeTokenName,
  themeTokenNames,
} from "./theme.ts";

/** Context object passed to theme Engine Pipeline callbacks. */
export interface ThemeEnginePipelineContext {
  pipelineId: string;
  stepId: string;
  index: number;
}

/** Public type alias for a theme Engine Pipeline Transform. */
export type ThemeEnginePipelineTransform = (
  engine: ThemeEngine,
  context: ThemeEnginePipelineContext,
) => ThemeEngine | ThemeEngineOptions;

/** Public interface describing a theme Engine Pipeline Step Definition. */
export interface ThemeEnginePipelineStepDefinition {
  id: string;
  label?: string;
  description?: string;
  enabled?: boolean;
  options?: ThemeEngineOptions;
  transform?: ThemeEnginePipelineTransform;
}

/** Public interface describing a theme Engine Pipeline Definition. */
export interface ThemeEnginePipelineDefinition {
  id: string;
  label?: string;
  description?: string;
  steps?: Iterable<ThemeEnginePipelineStepDefinition>;
}

/** Serializable inspection snapshot for theme Engine Pipeline Step. */
export interface ThemeEnginePipelineStepInspection {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  hasTransform: boolean;
  tokenOverrides: ThemeTokenName[];
  components: string[];
  variants: Record<string, string[]>;
}

/** Serializable inspection snapshot for theme Engine Pipeline. */
export interface ThemeEnginePipelineInspection {
  id: string;
  label: string;
  description?: string;
  stepCount: number;
  activeStepCount: number;
  steps: ThemeEnginePipelineStepInspection[];
}

/** Public interface describing a theme Engine Pipeline Build Result. */
export interface ThemeEnginePipelineBuildResult {
  id: string;
  engine: ThemeEngine;
  inspection: ThemeEnginePipelineInspection;
}

/** Public type alias for a theme Engine Pipeline Listener. */
export type ThemeEnginePipelineListener = () => void;

/** Options for configuring theme Engine Pipeline Prewarm. */
export interface ThemeEnginePipelinePrewarmOptions extends ScheduledTaskOptions {
  scheduler?: AsyncScheduler;
  ids?: Iterable<string>;
  base?: ThemeEngine | (() => ThemeEngine);
}

/** Ordered, inspectable transform pipeline for deriving theme engines at runtime. */
export class ThemeEnginePipeline {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly #steps = new Map<string, ThemeEnginePipelineStepDefinition>();
  readonly #enabled = new Set<string>();
  readonly #listeners = new Set<ThemeEnginePipelineListener>();
  #ids?: string[];
  #activeIds?: string[];
  #activeSteps?: Array<readonly [string, ThemeEnginePipelineStepDefinition]>;

  constructor(definition: ThemeEnginePipelineDefinition) {
    this.id = definition.id;
    this.label = definition.label ?? definition.id;
    this.description = definition.description;
    for (const step of definition.steps ?? []) {
      this.register(step);
    }
  }

  register(step: ThemeEnginePipelineStepDefinition): this {
    const enabled = step.enabled ?? (this.#enabled.has(step.id) || !this.#steps.has(step.id));
    this.#steps.set(step.id, {
      ...step,
      options: step.options ? composeThemeOptions(step.options) : undefined,
    });
    if (enabled) {
      this.#enabled.add(step.id);
    } else {
      this.#enabled.delete(step.id);
    }
    this.#notify();
    return this;
  }

  unregister(id: string): boolean {
    const removed = this.#steps.delete(id);
    this.#enabled.delete(id);
    if (removed) this.#notify();
    return removed;
  }

  has(id: string): boolean {
    return this.#steps.has(id);
  }

  get(id: string): ThemeEnginePipelineStepDefinition | undefined {
    const step = this.#steps.get(id);
    return step
      ? {
        ...step,
        enabled: this.#enabled.has(id),
        options: step.options ? composeThemeOptions(step.options) : undefined,
      }
      : undefined;
  }

  ids(): string[] {
    if (!this.#ids) {
      const ids: string[] = [];
      for (const id of this.#steps.keys()) ids.push(id);
      this.#ids = ids;
    }
    return this.#ids.slice();
  }

  activeIds(): string[] {
    if (!this.#activeIds) {
      const ids: string[] = [];
      for (const id of this.#steps.keys()) {
        if (this.#enabled.has(id)) ids.push(id);
      }
      this.#activeIds = ids;
    }
    return this.#activeIds.slice();
  }

  setEnabled(id: string, enabled: boolean): boolean {
    if (!this.#steps.has(id)) return false;
    const wasEnabled = this.#enabled.has(id);
    if (enabled) {
      this.#enabled.add(id);
    } else {
      this.#enabled.delete(id);
    }
    if (wasEnabled !== enabled) this.#notify();
    return true;
  }

  setActiveIds(ids: Iterable<string>): this {
    const requested = new Set(ids);
    let changed = false;
    for (const id of this.#steps.keys()) {
      const enabled = requested.has(id);
      const wasEnabled = this.#enabled.has(id);
      if (enabled) {
        this.#enabled.add(id);
      } else {
        this.#enabled.delete(id);
      }
      changed ||= wasEnabled !== enabled;
    }
    if (changed) this.#notify();
    return this;
  }

  enable(id: string): boolean {
    return this.setEnabled(id, true);
  }

  disable(id: string): boolean {
    return this.setEnabled(id, false);
  }

  toggle(id: string): boolean {
    if (!this.#steps.has(id)) return false;
    return this.setEnabled(id, !this.#enabled.has(id));
  }

  apply(base: ThemeEngine): ThemeEngine {
    let engine = base;
    let index = 0;
    const steps = this.activeStepEntries();
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
      const [id, step] = steps[stepIndex]!;
      if (step.options) {
        engine = engine.extend(step.options);
      }
      if (step.transform) {
        const result = step.transform(engine, { pipelineId: this.id, stepId: id, index });
        engine = isThemeEngine(result) ? result : engine.extend(result);
      }
      index += 1;
    }
    return engine;
  }

  inspect(): ThemeEnginePipelineInspection {
    const steps = new Array<ThemeEnginePipelineStepInspection>(this.#steps.size);
    let index = 0;
    let activeStepCount = 0;
    for (const [id, step] of this.#steps) {
      const enabled = this.#enabled.has(id);
      if (enabled) activeStepCount += 1;
      steps[index] = inspectPipelineStep(step, enabled);
      index += 1;
    }
    return {
      id: this.id,
      label: this.label,
      description: this.description,
      stepCount: steps.length,
      activeStepCount,
      steps,
    };
  }

  subscribe(listener: ThemeEnginePipelineListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify(): void {
    this.#ids = undefined;
    this.#activeIds = undefined;
    this.#activeSteps = undefined;
    for (const listener of this.#listeners) {
      listener();
    }
  }

  private activeStepEntries(): readonly (readonly [string, ThemeEnginePipelineStepDefinition])[] {
    if (!this.#activeSteps) {
      const steps: Array<readonly [string, ThemeEnginePipelineStepDefinition]> = [];
      for (const [id, step] of this.#steps) {
        if (this.#enabled.has(id)) steps.push([id, step]);
      }
      this.#activeSteps = steps;
    }
    return this.#activeSteps;
  }
}

/** Creates an theme Engine Pipeline. */
export function createThemeEnginePipeline(definition: ThemeEnginePipelineDefinition): ThemeEnginePipeline {
  return new ThemeEnginePipeline(definition);
}

/** Public helper for prewarm Theme Engine Pipelines. */
export async function prewarmThemeEnginePipelines(
  pipelines: readonly ThemeEnginePipeline[],
  options: ThemeEnginePipelinePrewarmOptions = {},
): Promise<ThemeEnginePipelineBuildResult[]> {
  const scheduler = options.scheduler ?? new AsyncScheduler();
  const requested = options.ids ? new Set(options.ids) : undefined;
  const selected: ThemeEnginePipeline[] = [];
  for (const pipeline of pipelines) {
    if (!requested || requested.has(pipeline.id)) selected.push(pipeline);
  }
  const base = options.base ?? (() => new ThemeEngine());
  const results = await runTaskBatch(selected, {
    scheduler,
    priority: options.priority,
    signal: options.signal,
    task: (pipeline) => {
      const baseEngine = typeof base === "function" ? base() : base;
      return {
        id: pipeline.id,
        engine: pipeline.apply(baseEngine),
        inspection: pipeline.inspect(),
      };
    },
  });
  const values = new Array<ThemeEnginePipelineBuildResult>(results.length);
  for (let index = 0; index < results.length; index += 1) {
    values[index] = results[index]!.value;
  }
  return values;
}

function inspectPipelineStep(
  step: ThemeEnginePipelineStepDefinition,
  enabled: boolean,
): ThemeEnginePipelineStepInspection {
  const options = step.options ?? {};
  const components = options.components ?? {};
  const variants: Record<string, string[]> = {};
  const componentNames = sortedObjectKeys(components);
  for (const component of componentNames) {
    const definition = components[component]!;
    variants[component] = sortedObjectKeys(definition.variants ?? {});
  }
  return {
    id: step.id,
    label: step.label ?? step.id,
    description: step.description,
    enabled,
    hasTransform: step.transform !== undefined,
    tokenOverrides: orderedSubset(Object.keys(options.tokens ?? {}), themeTokenNames),
    components: componentNames,
    variants,
  };
}

function sortedObjectKeys(value: object): string[] {
  const keys: string[] = [];
  for (const key in value) {
    keys.push(key);
  }
  return keys.sort();
}

function isThemeEngine(value: ThemeEngine | ThemeEngineOptions): value is ThemeEngine {
  return typeof (value as ThemeEngine).component === "function" &&
    typeof (value as ThemeEngine).extend === "function";
}
