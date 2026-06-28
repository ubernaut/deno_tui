/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// Copyright 2023 Im-Beast. MIT license.
import { type ThemeTokenName, themeTokenNames, type ThemeTokens } from "../theme.ts";
import { parseAnsiCell } from "./cell_canvas_sink.ts";

export type DomNodeStyle = Record<string, string | number | undefined>;

export interface DomRenderNode {
  tag?: keyof HTMLElementTagNameMap;
  text?: string;
  role?: string;
  ariaLabel?: string;
  className?: string;
  style?: DomNodeStyle;
  attributes?: Record<string, string | number | boolean | undefined>;
  on?: Partial<Record<"click" | "input" | "keydown" | "focus" | "blur", EventListener>>;
  children?: readonly DomRenderNode[];
}

export interface DomRenderTargetInspection {
  mounted: boolean;
  nodeCount: number;
}

export class DomRenderTarget {
  readonly #document: Document;
  #root?: HTMLElement;
  #current?: HTMLElement;
  #nodeCount = 0;

  constructor(documentRef: Document = document) {
    this.#document = documentRef;
  }

  mount(root: HTMLElement, node: DomRenderNode): void {
    this.unmount();
    this.#root = root;
    this.#current = this.#create(node);
    root.appendChild(this.#current);
  }

  update(node: DomRenderNode): void {
    if (!this.#root) {
      throw new Error("DomRenderTarget must be mounted before update().");
    }
    const next = this.#create(node);
    if (this.#current) this.#root.replaceChild(next, this.#current);
    else this.#root.appendChild(next);
    this.#current = next;
  }

  unmount(): void {
    if (this.#current?.parentNode) {
      this.#current.parentNode.removeChild(this.#current);
    }
    this.#root = undefined;
    this.#current = undefined;
    this.#nodeCount = 0;
  }

  inspectTarget(): DomRenderTargetInspection {
    return { mounted: Boolean(this.#root && this.#current), nodeCount: this.#nodeCount };
  }

  #create(node: DomRenderNode): HTMLElement {
    this.#nodeCount += 1;
    const element = this.#document.createElement(node.tag ?? "div");
    if (node.text !== undefined) element.textContent = node.text;
    if (node.role) element.setAttribute("role", node.role);
    if (node.ariaLabel) element.setAttribute("aria-label", node.ariaLabel);
    if (node.className) element.className = node.className;
    if (node.style) applyDomStyle(element, node.style);
    if (node.attributes) {
      for (const [name, value] of Object.entries(node.attributes)) {
        if (value === undefined || value === false) continue;
        element.setAttribute(name, value === true ? "" : String(value));
      }
    }
    if (node.on) {
      for (const [type, listener] of Object.entries(node.on)) {
        if (listener) element.addEventListener(type, listener);
      }
    }
    for (const child of node.children ?? []) {
      element.appendChild(this.#create(child));
    }
    return element;
  }
}

export function renderDomNodeToHtml(node: DomRenderNode): string {
  const tag = node.tag ?? "div";
  const attributes = domAttributes(node);
  const children = (node.children ?? []).map(renderDomNodeToHtml).join("");
  const text = node.text === undefined ? "" : escapeHtml(node.text);
  return `<${tag}${attributes}>${text}${children}</${tag}>`;
}

export function themeTokensToCssVariables(
  tokens: ThemeTokens | { tokens: ThemeTokens },
  sample = "M",
): Record<string, string> {
  const themeTokens = "tokens" in tokens ? tokens.tokens : tokens;
  const variables: Record<string, string> = {};
  for (const token of themeTokenNames) {
    const parsed = parseAnsiCell(themeTokens[token](sample));
    if (parsed.foreground) variables[`--deno-tui-${token}-fg`] = parsed.foreground;
    if (parsed.background) variables[`--deno-tui-${token}-bg`] = parsed.background;
  }
  return variables;
}

export function applyCssVariables(element: HTMLElement, variables: Record<string, string>): void {
  for (const [name, value] of Object.entries(variables)) {
    element.style.setProperty(name, value);
  }
}

function applyDomStyle(element: HTMLElement, style: DomNodeStyle): void {
  for (const [name, value] of Object.entries(style)) {
    if (value === undefined) continue;
    element.style.setProperty(kebabCase(name), String(value));
  }
}

function domAttributes(node: DomRenderNode): string {
  const attributes: Record<string, string | number | boolean | undefined> = {
    role: node.role,
    "aria-label": node.ariaLabel,
    class: node.className,
    style: node.style ? styleToString(node.style) : undefined,
    ...node.attributes,
  };
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([name, value]) => value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`)
    .join("");
}

function styleToString(style: DomNodeStyle): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${kebabCase(name)}:${String(value)}`)
    .join(";");
}

function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
