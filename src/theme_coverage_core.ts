// Copyright 2023 Im-Beast. MIT license.

/** Internal component definition shape used by theme coverage inspection. */
export interface ThemeCoverageComponentDefinitionCore<State extends string = string> {
  extends?: string | readonly string[];
  base?: Partial<Record<State, unknown>>;
  variants?: Record<string, Partial<Record<State, unknown>>>;
}

/** Internal variant coverage snapshot. */
export interface ThemeVariantCoverageInspectionCore<State extends string = string> {
  name: string;
  states: State[];
  missingStates: State[];
  complete: boolean;
}

/** Internal component coverage snapshot. */
export interface ThemeComponentCoverageInspectionCore<State extends string = string> {
  name: string;
  extends: string[];
  variants: ThemeVariantCoverageInspectionCore<State>[];
  stateCount: number;
  coveredStateCount: number;
  missingStateCount: number;
  complete: boolean;
}

/** Internal theme coverage snapshot. */
export interface ThemeCoverageInspectionCore<State extends string = string> {
  componentCount: number;
  variantCount: number;
  stateCount: number;
  coveredStateCount: number;
  missingStateCount: number;
  complete: boolean;
  components: ThemeComponentCoverageInspectionCore<State>[];
}

/** Options for inspecting component coverage. */
export interface InspectThemeCoverageCoreOptions<State extends string = string> {
  states: readonly State[];
  components?: Iterable<string>;
  variants?: (component: string, definition: ThemeCoverageComponentDefinitionCore<State>) => Iterable<string>;
  normalizeExtends?: (value: string | readonly string[] | undefined) => string[];
  createInheritanceError?: (cycle: readonly string[]) => Error;
}

/** Inspects component/variant state coverage for theme-like component definitions. */
export function inspectThemeCoverageCore<State extends string = string>(
  components: Record<string, ThemeCoverageComponentDefinitionCore<State>>,
  options: InspectThemeCoverageCoreOptions<State>,
): ThemeCoverageInspectionCore<State> {
  const componentNames = options.components ? sortedUniqueStrings(options.components) : sortedObjectKeys(components);
  const componentCoverage = new Array<ThemeComponentCoverageInspectionCore<State>>(componentNames.length);
  let variantCount = 0;
  let coveredStateCount = 0;
  let missingStateCount = 0;
  let complete = true;
  for (let index = 0; index < componentNames.length; index += 1) {
    const coverage = inspectThemeComponentCoverageCore(componentNames[index]!, components, options);
    componentCoverage[index] = coverage;
    variantCount += coverage.variants.length;
    coveredStateCount += coverage.coveredStateCount;
    missingStateCount += coverage.missingStateCount;
    complete &&= coverage.complete;
  }

  return {
    componentCount: componentCoverage.length,
    variantCount,
    stateCount: variantCount * options.states.length,
    coveredStateCount,
    missingStateCount,
    complete,
    components: componentCoverage,
  };
}

function inspectThemeComponentCoverageCore<State extends string>(
  name: string,
  components: Record<string, ThemeCoverageComponentDefinitionCore<State>>,
  options: InspectThemeCoverageCoreOptions<State>,
): ThemeComponentCoverageInspectionCore<State> {
  const normalizeExtends = options.normalizeExtends ?? defaultNormalizeExtends;
  const resolved = resolveThemeCoverageDefinitionCore(name, components, options);
  const variantNames = coverageVariantNamesCore(name, resolved, options);
  const variants = new Array<ThemeVariantCoverageInspectionCore<State>>(variantNames.length);
  let coveredStateCount = 0;
  let missingStateCount = 0;
  let complete = true;
  for (let index = 0; index < variantNames.length; index += 1) {
    const variant = variantNames[index]!;
    const states = coveredThemeStatesCore(resolved, variant, options.states);
    const missingStates = missingThemeStatesCore(options.states, states);
    const variantCoverage = {
      name: variant,
      states,
      missingStates,
      complete: missingStates.length === 0,
    };
    variants[index] = variantCoverage;
    coveredStateCount += states.length;
    missingStateCount += missingStates.length;
    complete &&= variantCoverage.complete;
  }

  return {
    name,
    extends: normalizeExtends(components[name]?.extends),
    variants,
    stateCount: variants.length * options.states.length,
    coveredStateCount,
    missingStateCount,
    complete,
  };
}

function resolveThemeCoverageDefinitionCore<State extends string>(
  componentName: string,
  components: Record<string, ThemeCoverageComponentDefinitionCore<State>>,
  options: InspectThemeCoverageCoreOptions<State>,
  seen = new Set<string>(),
): ThemeCoverageComponentDefinitionCore<State> {
  const definition = components[componentName];
  if (!definition) return {};
  if (seen.has(componentName)) {
    const cycle = [...seen, componentName];
    throw options.createInheritanceError?.(cycle) ?? new Error(`Theme inheritance cycle: ${cycle.join(" -> ")}`);
  }
  seen.add(componentName);

  let resolved: ThemeCoverageComponentDefinitionCore<State> = {};
  for (const parent of (options.normalizeExtends ?? defaultNormalizeExtends)(definition.extends)) {
    resolved = mergeThemeCoverageComponentDefinitionCore(
      resolved,
      resolveThemeCoverageDefinitionCore(parent, components, options, new Set(seen)),
    );
  }

  return mergeThemeCoverageComponentDefinitionCore(resolved, {
    base: definition.base,
    variants: definition.variants,
  });
}

function mergeThemeCoverageComponentDefinitionCore<State extends string>(
  base: ThemeCoverageComponentDefinitionCore<State>,
  override: ThemeCoverageComponentDefinitionCore<State>,
): ThemeCoverageComponentDefinitionCore<State> {
  const variants = { ...(base.variants ?? {}) };
  for (
    const [variant, states] of Object.entries(override.variants ?? {}) as [
      string,
      Partial<Record<State, unknown>>,
    ][]
  ) {
    variants[variant] = { ...(variants[variant] ?? {}), ...states };
  }

  return {
    extends: override.extends ?? base.extends,
    base: { ...(base.base ?? {}), ...(override.base ?? {}) },
    variants,
  };
}

function coverageVariantNamesCore<State extends string>(
  component: string,
  definition: ThemeCoverageComponentDefinitionCore<State>,
  options: InspectThemeCoverageCoreOptions<State>,
): string[] {
  const variants = options.variants
    ? [...options.variants(component, definition)]
    : Object.keys(definition.variants ?? {});
  return [...new Set(["default", ...variants])].sort((a, b) => {
    if (a === "default") return -1;
    if (b === "default") return 1;
    return a.localeCompare(b);
  });
}

function coveredThemeStatesCore<State extends string>(
  definition: ThemeCoverageComponentDefinitionCore<State>,
  variant: string,
  states: readonly State[],
): State[] {
  const covered = new Set<string>(Object.keys(definition.base ?? {}));
  if (variant !== "default") {
    for (const state of Object.keys(definition.variants?.[variant] ?? {})) {
      covered.add(state);
    }
  }
  const selected: State[] = [];
  for (const state of states) {
    if (covered.has(state)) selected.push(state);
  }
  return selected;
}

function defaultNormalizeExtends(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : [...value];
}

function missingThemeStatesCore<State extends string>(states: readonly State[], covered: readonly State[]): State[] {
  const coveredSet = new Set(covered);
  const missing: State[] = [];
  for (const state of states) {
    if (!coveredSet.has(state)) missing.push(state);
  }
  return missing;
}

function sortedUniqueStrings(values: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const value of values) set.add(value);
  return [...set].sort();
}

function sortedObjectKeys(value: object): string[] {
  const keys: string[] = [];
  for (const key in value) keys.push(key);
  return keys.sort();
}
