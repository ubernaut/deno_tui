// Copyright 2023 Im-Beast. MIT license.

/** CSS-like declaration for the TUI layout subset. */
export interface TuiCssDeclaration {
  property: string;
  value: string;
}

/** CSS-like rule for the TUI layout subset. */
export interface TuiCssRule {
  selector: string;
  declarations: TuiCssDeclaration[];
  specificity: number;
  order: number;
}

/** Parsed CSS-like stylesheet for TUI layout. */
export interface TuiCssStylesheet {
  rules: TuiCssRule[];
}

/** Parses a CSS-like stylesheet into ordered TUI layout rules. */
export function parseCssStylesheet(source: string): TuiCssStylesheet {
  const rules: TuiCssRule[] = [];
  const cleaned = stripCssComments(source);
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let order = 0;
  for (const match of cleaned.matchAll(pattern)) {
    const selectors = splitSelectorList(match[1] ?? "");
    const declarations = parseCssDeclarations(match[2] ?? "");
    for (const selector of selectors) {
      rules.push({
        selector,
        declarations,
        specificity: cssSelectorSpecificity(selector),
        order: order++,
      });
    }
  }
  return { rules };
}

/** Parses CSS-like declarations from a rule body or inline style attribute. */
export function parseCssDeclarations(source: string): TuiCssDeclaration[] {
  return splitDeclarations(source).map((part) => {
    const colon = part.indexOf(":");
    if (colon < 0) return undefined;
    const property = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    return property && value ? { property, value } : undefined;
  }).filter((entry): entry is TuiCssDeclaration => entry !== undefined);
}

/** Returns a compact CSS specificity score for a selector. */
export function cssSelectorSpecificity(selector: string): number {
  const idCount = (selector.match(/#[A-Za-z_][\w-]*/g) ?? []).length;
  const classCount = (selector.match(/\.[A-Za-z_][\w-]*/g) ?? []).length;
  const pseudoCount = (selector.match(/:[A-Za-z_][\w-]*/g) ?? []).length;
  const tagCount = selectorParts(selector)
    .map((part) => /^(#text|[A-Za-z][\w-]*|\*)/.exec(part.simple)?.[1])
    .filter((tag) => tag !== undefined && tag !== "*")
    .length;
  return idCount * 100 + (classCount + pseudoCount) * 10 + tagCount;
}

/** Public helper for parsing selector parts from left to right. */
export function selectorParts(selector: string): Array<{ simple: string; combinator?: "child" | "descendant" }> {
  const tokens = selector.replace(/\s*>\s*/g, " > ").trim().split(/\s+/).filter(Boolean);
  const parts: Array<{ simple: string; combinator?: "child" | "descendant" }> = [];
  let combinator: "child" | "descendant" = "descendant";
  for (const token of tokens) {
    if (token === ">") {
      combinator = "child";
      continue;
    }
    parts.push({ simple: token, combinator: parts.length === 0 ? undefined : combinator });
    combinator = "descendant";
  }
  return parts;
}

function splitSelectorList(source: string): string[] {
  return source.split(",").map((selector) => selector.trim()).filter(Boolean);
}

function splitDeclarations(source: string): string[] {
  const declarations: string[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === ";" && depth === 0) {
      declarations.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const last = source.slice(start).trim();
  if (last) declarations.push(last);
  return declarations.filter(Boolean);
}

function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}
