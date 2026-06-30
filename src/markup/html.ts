// Copyright 2023 Im-Beast. MIT license.
import { createLayoutNode, type LayoutNode } from "../layout/solver.ts";

/** Options for parsing TUI markup into a layout tree. */
export interface TuiMarkupParseOptions {
  rootTag?: string;
  rootId?: string;
  preserveWhitespace?: boolean;
}

/** Parsed TUI markup document. */
export interface TuiMarkupDocument {
  root: LayoutNode;
  nodeCount: number;
}

interface MutableMarkupNode {
  tag: string;
  attributes: Record<string, string>;
  children: MutableMarkupNode[];
  text?: string;
}

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Parses an HTML-like TUI markup string into a renderer-neutral layout tree. */
export function parseTuiMarkup(markup: string, options: TuiMarkupParseOptions = {}): TuiMarkupDocument {
  const root: MutableMarkupNode = {
    tag: options.rootTag ?? "document",
    attributes: { id: options.rootId ?? "document" },
    children: [],
  };
  const stack = [root];
  let index = 0;

  while (index < markup.length) {
    if (markup.startsWith("<!--", index)) {
      const end = markup.indexOf("-->", index + 4);
      index = end < 0 ? markup.length : end + 3;
      continue;
    }

    const nextTag = markup.indexOf("<", index);
    if (nextTag < 0) {
      appendText(stack[stack.length - 1]!, markup.slice(index), options);
      break;
    }
    if (nextTag > index) {
      appendText(stack[stack.length - 1]!, markup.slice(index, nextTag), options);
      index = nextTag;
      continue;
    }

    const endTag = markup.indexOf(">", index + 1);
    if (endTag < 0) {
      appendText(stack[stack.length - 1]!, markup.slice(index), options);
      break;
    }

    const raw = markup.slice(index + 1, endTag).trim();
    index = endTag + 1;
    if (!raw || raw.startsWith("!")) continue;
    if (raw.startsWith("/")) {
      closeTag(stack, normalizeTagName(raw.slice(1)));
      continue;
    }

    const selfClosing = raw.endsWith("/");
    const node = parseOpeningTag(selfClosing ? raw.slice(0, -1).trim() : raw);
    stack[stack.length - 1]!.children.push(node);
    if (!selfClosing && !VOID_TAGS.has(node.tag)) {
      stack.push(node);
    }
  }

  const children = root.children.filter((child) => child.tag !== "#text" || Boolean(child.text?.trim()));
  const selected = children.length === 1 && !options.rootTag && !options.rootId ? children[0]! : { ...root, children };
  let generated = 0;
  const layoutRoot = toLayoutNode(selected, () => `markup-${++generated}`);
  return {
    root: layoutRoot,
    nodeCount: countLayoutNodes(layoutRoot),
  };
}

function parseOpeningTag(raw: string): MutableMarkupNode {
  const match = /^([^\s/>]+)([\s\S]*)$/.exec(raw);
  const tag = normalizeTagName(match?.[1] ?? "div");
  const attributes = parseAttributes(match?.[2] ?? "");
  return { tag, attributes, children: [] };
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    attributes[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "true");
  }
  return attributes;
}

function appendText(parent: MutableMarkupNode, text: string, options: TuiMarkupParseOptions): void {
  const decoded = decodeEntities(options.preserveWhitespace ? text : text.replace(/\s+/g, " "));
  if (!options.preserveWhitespace && decoded.trim().length === 0) return;
  const previous = parent.children[parent.children.length - 1];
  if (previous?.tag === "#text") {
    previous.text = `${previous.text ?? ""}${decoded}`;
  } else {
    parent.children.push({ tag: "#text", attributes: {}, children: [], text: decoded });
  }
}

function closeTag(stack: MutableMarkupNode[], tag: string): void {
  for (let index = stack.length - 1; index > 0; index -= 1) {
    if (stack[index]!.tag === tag) {
      stack.splice(index);
      return;
    }
  }
}

function normalizeTagName(value: string): string {
  return value.trim().toLowerCase();
}

function toLayoutNode(node: MutableMarkupNode, nextId: () => string): LayoutNode {
  const elementChildren = node.children.filter((child) => child.tag !== "#text");
  const textChildren = node.children.filter((child) => child.tag === "#text").map((child) => child.text ?? "");
  const text = node.text ?? (elementChildren.length === 0 ? textChildren.join("").trim() || undefined : undefined);
  const children = elementChildren.length === 0
    ? []
    : node.children.map((child) => toLayoutNode(child, nextId)).filter((child) => child.tag !== "#text" || child.text);
  return createLayoutNode({
    id: node.attributes.id ?? nextId(),
    tag: node.tag,
    attributes: { ...node.attributes },
    classes: node.attributes.class?.split(/\s+/).filter(Boolean) ?? [],
    text,
    children,
  });
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function countLayoutNodes(node: LayoutNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countLayoutNodes(child), 0);
}
