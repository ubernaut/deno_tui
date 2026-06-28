import { assertEquals } from "./deps.ts";
import { FormController, minLength, required } from "../src/app/forms.ts";

interface SettingsForm extends Record<string, unknown> {
  route: string;
  label: string;
}

Deno.test("FormController tracks values dirty touched and validation state", () => {
  const form = new FormController<SettingsForm>([
    { name: "route", initialValue: "overview", validators: [required()] },
    { name: "label", initialValue: "", validators: [required("Label required"), minLength(3)] },
  ]);

  assertEquals(form.validate(), false);
  assertEquals(form.errors.peek().label, ["Label required", "Must be at least 3 characters"]);

  form.touch("label");
  form.setValue("label", "CPU");

  assertEquals(form.getValue("label"), "CPU");
  assertEquals(form.touched.peek().label, true);
  assertEquals(form.dirty.peek().label, true);
  assertEquals(form.errors.peek().label, []);
  assertEquals(form.validate(), true);
});

Deno.test("FormController can reset and unregister fields", () => {
  const form = new FormController<SettingsForm>([
    { name: "route", initialValue: "overview" },
    { name: "label", initialValue: "Panel" },
  ]);

  form.setValue("route", "runtime");
  form.touch("route");
  form.reset({ label: "Metrics" });

  assertEquals(form.snapshot(), {
    values: { route: "overview", label: "Metrics" },
    errors: { route: [], label: [] },
    touched: { route: false, label: false },
    dirty: { route: false, label: false },
    valid: true,
  });

  form.unregister("label");
  assertEquals(form.snapshot().values as Record<string, unknown>, { route: "overview" });
});
