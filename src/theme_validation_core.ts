// Copyright 2023 Im-Beast. MIT license.

/** Internal style reference shape used by theme validation. */
export type ThemeValidationStyleReferenceCore =
  | string
  | ((value: string) => string)
  | readonly ThemeValidationStyleReferenceCore[];

/** Internal component theme definition shape used by theme validation. */
export interface ThemeValidationComponentDefinitionCore<State extends string = string> {
  extends?: string | readonly string[];
  base?: Partial<Record<State, ThemeValidationStyleReferenceCore>>;
  variants?: Record<string, Partial<Record<State, ThemeValidationStyleReferenceCore>>>;
}

/** Internal validation issue emitted by theme validation. */
export interface ThemeValidationIssueCore<State extends string = string> {
  kind: "unknown-token" | "unknown-component" | "inheritance-cycle";
  path: string;
  message: string;
  component?: string;
  variant?: string;
  state?: State;
  reference?: string;
}

/** Options for validating normalized component theme definitions. */
export interface ValidateThemeComponentsCoreOptions<Token extends string = string> {
  tokenNames: readonly Token[];
  normalizeExtends?: (value: string | readonly string[] | undefined) => string[];
}

/** Validates normalized component theme definitions for unknown references and inheritance cycles. */
export function validateThemeComponentsCore<State extends string = string, Token extends string = string>(
  components: Record<string, ThemeValidationComponentDefinitionCore<State>>,
  options: ValidateThemeComponentsCoreOptions<Token>,
): ThemeValidationIssueCore<State>[] {
  const issues: ThemeValidationIssueCore<State>[] = [];
  const normalizeExtends = options.normalizeExtends ?? defaultNormalizeExtends;

  for (const [component, definition] of Object.entries(components)) {
    for (const parent of normalizeExtends(definition.extends)) {
      if (!components[parent]) {
        issues.push({
          kind: "unknown-component",
          path: `components.${component}.extends`,
          component,
          reference: parent,
          message: `Theme component "${component}" extends unknown component "${parent}"`,
        });
      }
    }

    validateThemeStateDefinitionReferencesCore(issues, definition.base, {
      component,
      path: `components.${component}.base`,
      tokenNames: options.tokenNames,
    });

    for (const [variant, states] of Object.entries(definition.variants ?? {})) {
      validateThemeStateDefinitionReferencesCore(issues, states, {
        component,
        variant,
        path: `components.${component}.variants.${variant}`,
        tokenNames: options.tokenNames,
      });
    }
  }

  for (const cycle of findThemeInheritanceCyclesCore(components, normalizeExtends)) {
    issues.push({
      kind: "inheritance-cycle",
      path: `components.${cycle[0]}.extends`,
      component: cycle[0],
      message: `Theme component inheritance cycle detected: ${cycle.join(" -> ")}`,
    });
  }

  return issues;
}

function validateThemeStateDefinitionReferencesCore<State extends string, Token extends string>(
  issues: ThemeValidationIssueCore<State>[],
  definition: Partial<Record<State, ThemeValidationStyleReferenceCore>> | undefined,
  context: { component: string; variant?: string; path: string; tokenNames: readonly Token[] },
): void {
  for (const [state, reference] of Object.entries(definition ?? {}) as [State, ThemeValidationStyleReferenceCore][]) {
    validateThemeStyleReferenceCore(issues, reference, {
      ...context,
      state,
      path: `${context.path}.${state}`,
    });
  }
}

function validateThemeStyleReferenceCore<State extends string, Token extends string>(
  issues: ThemeValidationIssueCore<State>[],
  reference: ThemeValidationStyleReferenceCore,
  context: { component: string; variant?: string; state: State; path: string; tokenNames: readonly Token[] },
): void {
  if (Array.isArray(reference)) {
    reference.forEach((part, index) =>
      validateThemeStyleReferenceCore(issues, part, {
        ...context,
        path: `${context.path}[${index}]`,
      })
    );
    return;
  }

  if (typeof reference !== "string" || context.tokenNames.includes(reference as Token)) return;

  issues.push({
    kind: "unknown-token",
    path: context.path,
    component: context.component,
    variant: context.variant,
    state: context.state,
    reference,
    message: `Theme state "${context.component}.${
      context.variant ? `${context.variant}.` : ""
    }${context.state}" references unknown token "${reference}"`,
  });
}

function findThemeInheritanceCyclesCore<State extends string>(
  components: Record<string, ThemeValidationComponentDefinitionCore<State>>,
  normalizeExtends: (value: string | readonly string[] | undefined) => string[],
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (component: string, path: string[]): void => {
    if (visiting.has(component)) {
      cycles.push(path.slice(path.indexOf(component)));
      return;
    }
    if (visited.has(component)) return;

    visiting.add(component);
    for (const parent of normalizeExtends(components[component]?.extends)) {
      if (components[parent]) visit(parent, [...path, parent]);
    }
    visiting.delete(component);
    visited.add(component);
  };

  for (const component of Object.keys(components).sort()) {
    visit(component, [component]);
  }

  return cycles;
}

function defaultNormalizeExtends(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : [...value];
}
