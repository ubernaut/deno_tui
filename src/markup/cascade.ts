// Copyright 2023 Im-Beast. MIT license.
import {
  applyLayoutDeclaration,
  cloneComputedLayoutStyle,
  type ComputedLayoutStyle,
  defaultComputedLayoutStyle,
} from "../layout/style.ts";
import { cloneLayoutNode, type LayoutNode } from "../layout/solver.ts";
import {
  parseCssDeclarations,
  selectorParts,
  type TuiCssDeclaration,
  type TuiCssMediaQuery,
  type TuiCssStylesheet,
} from "./css.ts";

/** Runtime state names supported by CSS-like pseudo selectors. */
export type TuiCssNodeState = "focus" | "active" | "disabled" | "hover";

/** Options for applying a CSS-like cascade to a layout tree. */
export interface ApplyCssCascadeOptions {
  variables?: Record<string, string>;
  states?: Record<string, readonly TuiCssNodeState[]>;
  baseStyle?: ComputedLayoutStyle;
  viewport?: TuiCssViewport;
}

/** Terminal-cell viewport dimensions used by CSS-like media rules. */
export interface TuiCssViewport {
  width: number;
  height: number;
}

interface MatchedRule {
  declarations: TuiCssDeclaration[];
  specificity: number;
  order: number;
}

/** Applies CSS-like rules and inline styles to a cloned layout tree. */
export function applyCssCascade(
  root: LayoutNode,
  stylesheet: TuiCssStylesheet,
  options: ApplyCssCascadeOptions = {},
): LayoutNode {
  const normalizedVariables = normalizeVariables(options.variables ?? {});
  const baseStyle = options.baseStyle ? cloneComputedLayoutStyle(options.baseStyle) : defaultComputedLayoutStyle();
  baseStyle.variables = { ...baseStyle.variables, ...normalizedVariables };
  return applyNode(root, [], baseStyle, stylesheet, options);
}

/** Returns true when a CSS-like selector matches a layout node path. */
export function matchesCssSelector(
  selector: string,
  node: LayoutNode,
  ancestors: readonly LayoutNode[] = [],
  states: Record<string, readonly TuiCssNodeState[]> = {},
): boolean {
  const parts = selectorParts(selector);
  if (parts.length === 0) return false;
  const chain = [...ancestors, node];
  return matchPart(parts.length - 1, chain.length - 1);

  function matchPart(partIndex: number, nodeIndex: number): boolean {
    if (nodeIndex < 0) return false;
    const part = parts[partIndex]!;
    if (!matchesSimpleSelector(part.simple, chain[nodeIndex]!, nodeIndex === 0, states)) return false;
    if (partIndex === 0) return true;

    const relation = part.combinator ?? "descendant";
    if (relation === "child") return matchPart(partIndex - 1, nodeIndex - 1);
    for (let ancestorIndex = nodeIndex - 1; ancestorIndex >= 0; ancestorIndex -= 1) {
      if (matchPart(partIndex - 1, ancestorIndex)) return true;
    }
    return false;
  }
}

/** Resolves CSS variable functions in a declaration value. */
export function resolveCssVariables(value: string, variables: Record<string, string>): string {
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_match, name: string, fallback: string) => {
    return variables[name] ?? fallback?.trim() ?? "";
  });
}

function applyNode(
  node: LayoutNode,
  ancestors: readonly LayoutNode[],
  inherited: ComputedLayoutStyle,
  stylesheet: TuiCssStylesheet,
  options: ApplyCssCascadeOptions,
): LayoutNode {
  const next = cloneLayoutNode(node);
  const style = defaultComputedLayoutStyle();
  style.color = inherited.color;
  style.visibility = inherited.visibility;
  style.variables = { ...inherited.variables };

  const matches: MatchedRule[] = [];
  for (const rule of stylesheet.rules) {
    if (
      matchesCssMedia(rule.media, options.viewport) &&
      matchesCssSelector(rule.selector, node, ancestors, options.states ?? {})
    ) {
      matches.push({
        declarations: rule.declarations,
        specificity: rule.specificity,
        order: rule.order,
      });
    }
  }
  matches.sort((left, right) => left.specificity - right.specificity || left.order - right.order);

  next.style = applyMatchedRules(style, matches);
  const inline = node.attributes.style ? parseCssDeclarations(node.attributes.style) : [];
  if (inline.length > 0) {
    next.style = applyMatchedRules(next.style, [{ declarations: inline, specificity: 1_000, order: 1_000_000 }]);
  }

  const childAncestors = appendAncestor(ancestors, next);
  next.children = new Array<LayoutNode>(node.children.length);
  for (let index = 0; index < node.children.length; index += 1) {
    next.children[index] = applyNode(node.children[index]!, childAncestors, next.style, stylesheet, options);
  }
  return next;
}

/** Returns true when a CSS-like media query applies to a terminal-cell viewport. */
export function matchesCssMedia(
  media: TuiCssMediaQuery | undefined,
  viewport: TuiCssViewport | undefined,
): boolean {
  if (!media) return true;
  if (!viewport) return false;
  return media.conditions.every((condition) => {
    if (condition.feature === "min-width") return viewport.width >= condition.value;
    if (condition.feature === "max-width") return viewport.width <= condition.value;
    if (condition.feature === "min-height") return viewport.height >= condition.value;
    return viewport.height <= condition.value;
  });
}

function applyMatchedRules(style: ComputedLayoutStyle, matches: readonly MatchedRule[]): ComputedLayoutStyle {
  let next = style;
  for (const match of matches) {
    for (const declaration of match.declarations) {
      const value = resolveCssVariables(declaration.value, next.variables);
      next = applyLayoutDeclaration(next, declaration.property, value);
    }
  }
  return next;
}

function matchesSimpleSelector(
  selector: string,
  node: LayoutNode,
  isRoot: boolean,
  states: Record<string, readonly TuiCssNodeState[]>,
): boolean {
  if (selector === "*") return true;
  const tag = /^(#text|[A-Za-z][\w-]*|\*)/.exec(selector)?.[1];
  if (tag && tag !== "*" && tag.toLowerCase() !== node.tag) return false;

  for (const id of selector.matchAll(/#([A-Za-z_][\w-]*)/g)) {
    if (node.id !== id[1]) return false;
  }
  for (const className of selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
    if (!node.classes.includes(className[1]!)) return false;
  }
  for (const pseudo of selector.matchAll(/:([A-Za-z_][\w-]*)/g)) {
    const state = pseudo[1];
    if (state === "root") {
      if (!isRoot) return false;
    } else if (!states[node.id]?.includes(state as TuiCssNodeState)) {
      return false;
    }
  }
  return true;
}

function normalizeVariables(variables: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const name in variables) {
    const value = variables[name]!;
    normalized[name.startsWith("--") ? name : `--${name}`] = value;
  }
  return normalized;
}

function appendAncestor(ancestors: readonly LayoutNode[], node: LayoutNode): LayoutNode[] {
  const next = new Array<LayoutNode>(ancestors.length + 1);
  for (let index = 0; index < ancestors.length; index += 1) {
    next[index] = ancestors[index]!;
  }
  next[ancestors.length] = node;
  return next;
}
