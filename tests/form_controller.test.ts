import { assertEquals } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import { bindFormField } from "../src/app/form_bindings.ts";
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

Deno.test("bindFormField synchronizes controller values with signal-backed widgets", () => {
  const form = new FormController<SettingsForm>([
    { name: "route", initialValue: "overview" },
    { name: "label", initialValue: "Panel", validators: [required()] },
  ]);
  const text = new Signal("");
  const dispose = bindFormField(form, "label", text);

  assertEquals(text.peek(), "Panel");

  text.value = "Metrics";
  assertEquals(form.getValue("label"), "Metrics");
  assertEquals(form.touched.peek().label, true);
  assertEquals(form.dirty.peek().label, true);

  form.setValue("label", "Runtime");
  assertEquals(text.peek(), "Runtime");

  dispose();
  form.setValue("label", "Detached");
  assertEquals(text.peek(), "Runtime");
});

Deno.test("bindFormField supports target-first sync and parse format transforms", () => {
  const form = new FormController<SettingsForm>([
    { name: "route", initialValue: "overview" },
    { name: "label", initialValue: "Panel", validators: [minLength(3)] },
  ]);
  const length = new Signal(4);
  const dispose = bindFormField(form, "label", length, {
    initialSync: "target",
    touchOnChange: false,
    validateOnBind: true,
    parse: (value) => "#".repeat(value),
    format: (value) => value.length,
  });

  assertEquals(form.getValue("label"), "####");
  assertEquals(form.touched.peek().label, false);
  assertEquals(form.errors.peek().label, []);

  length.value = 2;
  assertEquals(form.getValue("label"), "##");
  assertEquals(form.touched.peek().label, false);
  assertEquals(form.errors.peek().label, ["Must be at least 3 characters"]);

  form.setValue("label", "abcdef");
  assertEquals(length.peek(), 6);

  dispose();
});
