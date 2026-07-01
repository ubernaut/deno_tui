import { assertEquals } from "./deps.ts";
import { validateThemeComponentsCore } from "../src/theme_validation_core.ts";

Deno.test("theme validation core reports unknown token references inside pipelines", () => {
  const issues = validateThemeComponentsCore({
    Button: {
      base: {
        active: ["accent", "missing-token"],
      },
    },
  }, { tokenNames: ["accent"] });

  assertEquals(issues, [{
    kind: "unknown-token",
    path: "components.Button.base.active[1]",
    component: "Button",
    variant: undefined,
    state: "active",
    reference: "missing-token",
    message: 'Theme state "Button.active" references unknown token "missing-token"',
  }]);
});

Deno.test("theme validation core reports unknown parents and inheritance cycles", () => {
  const issues = validateThemeComponentsCore({
    Panel: { extends: ["Missing", "Card"] },
    Card: { extends: "Panel" },
  }, { tokenNames: ["accent"] });

  assertEquals(issues.map((issue) => issue.kind), ["unknown-component", "inheritance-cycle"]);
  assertEquals(issues[0]?.path, "components.Panel.extends");
  assertEquals(issues[0]?.reference, "Missing");
  assertEquals(issues[1]?.message, "Theme component inheritance cycle detected: Card -> Panel -> Card");
});
