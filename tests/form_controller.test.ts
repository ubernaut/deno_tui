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

Deno.test("FormController registers fields with disposers and inspects aggregate state", () => {
  const form = new FormController<SettingsForm>();
  const disposeFields = form.registerAll([
    { name: "route", initialValue: "overview", validators: [required()] },
    { name: "label", initialValue: "", validators: [required("Label required"), minLength(3)] },
  ]);

  form.touchAll();
  form.setValues({ route: "runtime", label: "UI" });
  assertEquals(form.validate(), false);

  assertEquals(form.fieldNames(), ["route", "label"]);
  assertEquals(form.isDirty(), true);
  assertEquals(form.isTouched(), true);
  assertEquals(form.isValid(), false);
  assertEquals(form.inspect(), {
    values: { route: "runtime", label: "UI" },
    errors: { route: [], label: ["Must be at least 3 characters"] },
    touched: { route: true, label: true },
    dirty: { route: true, label: true },
    valid: false,
    fields: [
      { name: "route", touched: true, dirty: true, errors: [], valid: true },
      { name: "label", touched: true, dirty: true, errors: ["Must be at least 3 characters"], valid: false },
    ],
    fieldCount: 2,
    touchedFields: ["route", "label"],
    dirtyFields: ["route", "label"],
    errorFields: ["label"],
    dirtyForm: true,
    touchedForm: true,
  });

  disposeFields();
  assertEquals(form.fieldNames(), []);
  const empty = form.snapshot();
  assertEquals(empty.values as Record<string, unknown>, {});
  assertEquals(empty.errors, {});
  assertEquals(empty.touched, {});
  assertEquals(empty.dirty, {});
  assertEquals(empty.valid, true);
  form.dispose();
});

Deno.test("FormController registration disposers ignore replacement fields", () => {
  const form = new FormController<SettingsForm>();
  const disposeFirst = form.register({ name: "label", initialValue: "First" });
  const disposeSecond = form.register({ name: "label", initialValue: "Second" });

  disposeFirst();
  assertEquals(form.getValue("label"), "Second");

  disposeSecond();
  assertEquals(form.getValue("label"), undefined);
  form.dispose();
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
