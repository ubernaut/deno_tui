// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { KeyPressEvent } from "../input_reader/types.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { createAnsiStyle, type Style } from "../theme.ts";
import { signalify } from "../utils/signals.ts";
import {
  type MarkdownDocument,
  type MarkdownInlineMark,
  type MarkdownParseOptions,
  type MarkdownRenderLine,
  type MarkdownRenderOptions,
  type MarkdownRenderRole,
  markdownRenderText,
  parseMarkdown,
  renderMarkdown,
} from "../content/markdown.ts";
import { drawTextRows } from "./text_children.ts";

/** Semantic Markdown style keys accepted by the terminal component. */
export type MarkdownStyleKey = MarkdownRenderRole | MarkdownInlineMark;

/** Partial semantic style map for terminal Markdown rows. */
export type MarkdownStyles = Partial<Record<MarkdownStyleKey, Style>>;

/** Options for the renderer-neutral Markdown controller. */
export interface MarkdownControllerOptions {
  source?: string | Signal<string>;
  offset?: number | Signal<number>;
  parse?: MarkdownParseOptions;
  render?: Omit<MarkdownRenderOptions, "width">;
}

/** Serializable Markdown controller and viewport inspection. */
export interface MarkdownInspection {
  sourceLength: number;
  blocks: number;
  links: number;
  lines: number;
  offset: number;
  maxOffset: number;
  width: number;
  height: number;
}

/** Options for the interactive terminal Markdown component. */
export interface MarkdownOptions extends ComponentOptions {
  source?: string | Signal<string>;
  controller?: MarkdownController;
  parse?: MarkdownParseOptions;
  render?: Omit<MarkdownRenderOptions, "width">;
  styles?: MarkdownStyles;
}

/** Default trait-only styles that preserve the surrounding component palette. */
export const defaultMarkdownStyles: Readonly<MarkdownStyles> = Object.freeze({
  heading: createAnsiStyle({ bold: true }),
  strong: createAnsiStyle({ bold: true }),
  emphasis: createAnsiStyle({ italic: true }),
  code: createAnsiStyle({ inverse: true }),
  strikethrough: createAnsiStyle({ strikethrough: true }),
  link: createAnsiStyle({ underline: true }),
  image: createAnsiStyle({ underline: true }),
  quote: createAnsiStyle({ dim: true }),
  marker: createAnsiStyle({ dim: true }),
  "code-fence": createAnsiStyle({ dim: true }),
  "link-destination": createAnsiStyle({ dim: true, underline: true }),
  rule: createAnsiStyle({ dim: true }),
  "table-border": createAnsiStyle({ dim: true }),
  "table-header": createAnsiStyle({ bold: true }),
});

/** Applies semantic ANSI styles to one rendered Markdown row. */
export function formatMarkdownRenderLine(
  line: MarkdownRenderLine,
  styles: MarkdownStyles = defaultMarkdownStyles,
): string {
  return line.segments.map((segment) => {
    let value = segment.text;
    for (const mark of segment.marks) {
      value = (styles[mark] ?? defaultMarkdownStyles[mark] ?? identityStyle)(value);
    }
    return (styles[segment.role] ?? defaultMarkdownStyles[segment.role] ?? identityStyle)(value);
  }).join("");
}

/** Reactive Markdown parser, terminal renderer, and vertical viewport owner. */
export class MarkdownController {
  readonly source: Signal<string>;
  readonly offset: Signal<number>;
  readonly document: Computed<MarkdownDocument>;
  readonly #parse: MarkdownParseOptions;
  readonly #render: Omit<MarkdownRenderOptions, "width">;
  readonly #ownsSource: boolean;
  readonly #ownsOffset: boolean;
  #renderedDocument?: MarkdownDocument;
  #renderedWidth = -1;
  #renderedLines: MarkdownRenderLine[] = [];

  constructor(options: MarkdownControllerOptions = {}) {
    this.#ownsSource = !(options.source instanceof Signal);
    this.#ownsOffset = !(options.offset instanceof Signal);
    this.source = signalify(options.source ?? "");
    this.offset = signalify(options.offset ?? 0);
    this.#parse = { ...options.parse };
    this.#render = { ...options.render };
    this.document = new Computed(() => parseMarkdown(this.source.value, this.#parse));
  }

  setSource(source: string): MarkdownDocument {
    this.source.value = source;
    this.offset.value = 0;
    return this.document.peek();
  }

  render(width: number): readonly MarkdownRenderLine[] {
    const safeWidth = Math.max(1, Math.floor(width));
    const document = this.document.value;
    if (this.#renderedDocument !== document || this.#renderedWidth !== safeWidth) {
      this.#renderedDocument = document;
      this.#renderedWidth = safeWidth;
      this.#renderedLines = renderMarkdown(document, { ...this.#render, width: safeWidth });
    }
    return this.#renderedLines;
  }

  text(width: number): string {
    return markdownRenderText(this.render(width));
  }

  visible(width: number, height: number): MarkdownRenderLine[] {
    const lines = this.render(width);
    const safeHeight = Math.max(0, Math.floor(height));
    const offset = Math.min(normalizeOffset(this.offset.value), Math.max(0, lines.length - safeHeight));
    return lines.slice(offset, offset + safeHeight);
  }

  scrollTo(offset: number, width: number, height: number): number {
    const maxOffset = this.maxOffset(width, height);
    const next = Math.min(normalizeOffset(offset), maxOffset);
    this.offset.value = next;
    return next;
  }

  scrollBy(rows: number, width: number, height: number): number {
    return this.scrollTo(this.offset.peek() + Math.trunc(rows), width, height);
  }

  maxOffset(width: number, height: number): number {
    return Math.max(0, this.render(width).length - Math.max(0, Math.floor(height)));
  }

  handleKeyPress(
    event: Pick<KeyPressEvent, "key" | "ctrl" | "meta" | "shift">,
    width: number,
    height: number,
  ): number | undefined {
    if (event.ctrl || event.meta) return undefined;
    const page = Math.max(1, Math.floor(height) - 1);
    if (event.key === "up") return this.scrollBy(-1, width, height);
    if (event.key === "down") return this.scrollBy(1, width, height);
    if (event.key === "pageup") return this.scrollBy(-page, width, height);
    if (event.key === "pagedown") return this.scrollBy(page, width, height);
    if (event.key === "home") return this.scrollTo(0, width, height);
    if (event.key === "end") return this.scrollTo(Number.MAX_SAFE_INTEGER, width, height);
    return undefined;
  }

  inspect(width: number, height: number): MarkdownInspection {
    const lines = this.render(width);
    const maxOffset = Math.max(0, lines.length - Math.max(0, Math.floor(height)));
    return {
      sourceLength: this.source.peek().length,
      blocks: this.document.peek().blocks.length,
      links: this.document.peek().links.length,
      lines: lines.length,
      offset: Math.min(normalizeOffset(this.offset.peek()), maxOffset),
      maxOffset,
      width: Math.max(1, Math.floor(width)),
      height: Math.max(0, Math.floor(height)),
    };
  }

  dispose(): void {
    this.#renderedDocument = undefined;
    this.#renderedLines = [];
    this.document.dispose();
    if (this.#ownsSource) this.source.dispose();
    if (this.#ownsOffset) this.offset.dispose();
  }
}

/** Scrollable terminal component backed by the parser-neutral Markdown model. */
export class Markdown extends Component {
  readonly controller: MarkdownController;
  readonly #rows: Computed<string[]>;
  readonly #ownsController: boolean;

  constructor(options: MarkdownOptions) {
    super(options);
    this.#ownsController = options.controller === undefined;
    this.controller = options.controller ?? new MarkdownController({
      source: options.source,
      parse: options.parse,
      render: options.render,
    });
    const styles = { ...defaultMarkdownStyles, ...options.styles };
    this.#rows = new Computed(() => {
      const rectangle = this.rectangle.value;
      return this.controller.visible(rectangle.width, rectangle.height).map((line) =>
        formatMarkdownRenderLine(line, styles)
      );
    });
    this.on("keyPress", (event) => {
      const { width, height } = this.rectangle.peek();
      this.controller.handleKeyPress(event, width, height);
    });
    this.on("mouseScroll", (event) => {
      const { width, height } = this.rectangle.peek();
      this.controller.scrollBy(event.scroll * 3, width, height);
    });
    this.on("destroy", () => {
      this.#rows.dispose();
      if (this.#ownsController) this.controller.dispose();
    });
  }

  override draw(): void {
    super.draw();
    drawTextRows(this, this.#rows, { keyPrefix: "markdown", multiCodePointSupport: true });
  }

  override interact(method: "keyboard" | "mouse"): void {
    this.state.value = "focused";
    super.interact(method);
  }
}

function identityStyle(value: string): string {
  return value;
}

function normalizeOffset(value: number): number {
  return Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
}
