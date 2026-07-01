import { assertEquals } from "./deps.ts";
import { mergeThemeCatalogComponents } from "../src/theme_catalog.ts";

Deno.test("theme catalog merge sorts components and variants with default first", () => {
  assertEquals(
    mergeThemeCatalogComponents(
      [
        { name: "modal", variants: ["danger", "default"] },
        { name: "button", variants: ["primary"] },
      ],
      [
        { name: "button", variants: ["secondary", "primary"] },
        { name: "table", variants: [] },
      ],
    ),
    [
      { name: "button", variants: ["default", "primary", "secondary"] },
      { name: "modal", variants: ["default", "danger"] },
      { name: "table", variants: ["default"] },
    ],
  );
});
