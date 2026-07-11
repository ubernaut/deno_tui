import { crayon } from "crayon";
import { assert, assertEquals, assertStrictEquals, assertStringIncludes } from "./deps.ts";
import {
  Computed,
  Markdown,
  MarkdownController,
  markdownRenderText,
  parseMarkdown,
  renderMarkdown,
} from "../mod.app.ts";
import { canvasRowText, createTestTerminalApp } from "../mod.testing.ts";
import { textWidth } from "../src/utils/strings.ts";

const richSource = [
  "# Title",
  "",
  "Paragraph with **bold**, *emphasis*, [link](https://example.com), ~~strike~~ and `code`.",
  "",
  "> quoted text that wraps across terminal rows",
  "",
  "1. one",
  "2. two",
  "",
  "- [x] shipped",
  "",
  "```ts",
  "const value = 1;",
  "console.log(value);",
  "```",
  "",
  "| Name | Value |",
  "| :--- | ----: |",
  "| alpha | 123 |",
].join("\n");

Deno.test("parseMarkdown preserves semantic blocks marks links tasks code and tables", () => {
  const document = parseMarkdown(richSource);

  assertEquals(document.blocks.map((block) => block.kind), [
    "heading",
    "paragraph",
    "paragraph",
    "list-item",
    "list-item",
    "list-item",
    "code",
    "table-row",
    "table-row",
  ]);
  assert(document.blocks[1]?.inlines?.some((span) => span.marks.includes("strong")));
  assert(document.blocks[1]?.inlines?.some((span) => span.marks.includes("emphasis")));
  assert(document.blocks[1]?.inlines?.some((span) => span.marks.includes("strikethrough")));
  assert(document.blocks[1]?.inlines?.some((span) => span.marks.includes("code")));
  assertEquals(document.links, [{ text: "link", href: "https://example.com", title: undefined }]);
  assertEquals(document.blocks[5]?.checked, true);
  assertEquals(document.blocks[6]?.language, "ts");
  assertEquals(document.blocks[7]?.cells?.map((cell) => cell.align), ["left", "right"]);
});

Deno.test("renderMarkdown wraps cell-width content and renders list groups code and tables", () => {
  const lines = renderMarkdown(parseMarkdown(richSource), { width: 32, codeLineNumbers: true });
  const text = markdownRenderText(lines);

  assertStringIncludes(text, "# Title");
  assertStringIncludes(text, "> quoted text that wraps across");
  assertStringIncludes(text, "> terminal rows");
  assertStringIncludes(text, "1. one\n2. two\n\n[x] shipped");
  assertStringIncludes(text, "```ts\n│ 1 const value = 1;\n│ 2 console.log(value);\n```");
  assertStringIncludes(text, "| Name  | Value |\n|-------|-------|\n| alpha |   123 |");
  assert(lines.every((line) => textWidth(line.text) <= 32));
});

Deno.test("renderMarkdown falls back to readable stacked table cells when narrow", () => {
  const lines = renderMarkdown(parseMarkdown("| A | B |\n| - | - |\n| 1 | 2 |"), { width: 7 });
  assertEquals(markdownRenderText(lines), "[1] A\n[2] B\n[1] 1\n[2] 2");
});

Deno.test("renderMarkdown keeps nested list items in one compact list group", () => {
  const source = ["- parent", "  1. child one", "  2. child two", "- next", "", "> quoted", "> continuation"]
    .join("\n");
  const text = markdownRenderText(renderMarkdown(parseMarkdown(source), { width: 24 }));
  assertEquals(text, "• parent\n  1. child one\n  2. child two\n• next\n\n> quoted continuation");
});

Deno.test("MarkdownController scrolls a reflowed document deterministically", () => {
  const controller = new MarkdownController({
    source: Array.from({ length: 12 }, (_, index) => `Paragraph ${index}.`).join("\n\n"),
  });
  try {
    const inspection = controller.inspect(14, 4);
    assert(inspection.lines > inspection.height);
    assertStrictEquals(controller.render(14), controller.render(14));
    assertEquals(controller.scrollTo(Number.MAX_SAFE_INTEGER, 14, 4), inspection.maxOffset);
    assertStringIncludes(markdownRenderText(controller.visible(14, 4)), "Paragraph 11.");
    controller.setSource("# Reset");
    assertEquals(controller.offset.peek(), 0);
  } finally {
    controller.dispose();
  }
});

Deno.test("Markdown component renders reflows and scrolls through TerminalAppPilot", async () => {
  let markdown: Markdown | undefined;
  const harness = await createTestTerminalApp({
    size: { columns: 36, rows: 5 },
    setup(app) {
      markdown = new Markdown({
        parent: app.tui,
        rectangle: new Computed(() => ({
          column: 0,
          row: 0,
          width: app.tui.rectangle.value.width,
          height: app.tui.rectangle.value.height,
        })),
        zIndex: 1,
        theme: { base: crayon.white, focused: crayon.white },
        source: Array.from({ length: 14 }, (_, index) => `## Section ${index}\n\nBody row ${index}.`).join("\n\n"),
      });
      app.registerComponent(markdown, { id: "document" });
      app.focus.focus(markdown);
    },
  });

  try {
    assertStringIncludes(harness.pilot.snapshot(), "## Section 0");
    await harness.pilot.press("end");
    assert((markdown?.controller.offset.peek() ?? 0) > 0);
    assertStringIncludes(harness.pilot.snapshot(), "Body row 13.");
    await harness.pilot.resize(24, 9);
    assertEquals(markdown?.controller.inspect(24, 9).width, 24);
    assertStringIncludes(canvasRowText(harness.canvas, 8, 24), "Body row 13.");
  } finally {
    harness.destroy();
  }
});
