import { assertEquals } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import { bindFormField } from "../src/app/form_bindings.ts";
import { bindFormCommands, formCommands } from "../src/app/form_commands.ts";
import type { FormCommandAction } from "../src/app/form_commands.ts";
import { FormController, type FormSnapshot, minLength, required } from "../src/app/forms.ts";
import { CommandRegistry } from "../src/app/commands.ts";

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
      { name: "route", touched: true, dirty: true, disabled: false, readOnly: false, errors: [], valid: true },
      {
        name: "label",
        touched: true,
        dirty: true,
        disabled: false,
        readOnly: false,
        errors: ["Must be at least 3 characters"],
        valid: false,
      },
    ],
    groups: [{
      id: "default",
      label: "Default",
      fields: ["route", "label"],
      valid: false,
      dirty: true,
      touched: true,
      errorCount: 1,
    }],
    errorSummary: [{ name: "label", errors: ["Must be at least 3 characters"] }],
    fieldCount: 2,
    touchedFields: ["route", "label"],
    dirtyFields: ["route", "label"],
    errorFields: ["label"],
    disabledFields: [],
    readOnlyFields: [],
    dirtyForm: true,
    touchedForm: true,
    submittable: true,
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

Deno.test("FormController supports groups disabled readonly schema validation and submit", async () => {
  const submitted: Array<FormSnapshot<SettingsForm>> = [];
  const form = new FormController<SettingsForm>({
    schema: {
      fields: [
        { name: "route", label: "Route", group: "routing", initialValue: "overview" },
        { name: "label", label: "Label", group: "metadata", initialValue: "Panel", readOnly: true },
      ],
      validate: (values) => values.route === "forbidden" ? { route: "Route is not available" } : {},
    },
  });

  assertEquals(form.setValue("label", "Runtime"), false);
  assertEquals(form.getValue("label"), "Panel");
  assertEquals(form.setValue("route", "forbidden"), true);
  assertEquals(form.validate(), false);
  assertEquals(form.inspect().errorSummary, [{
    name: "route",
    label: "Route",
    group: "routing",
    errors: ["Route is not available"],
  }]);

  assertEquals(form.setFieldDisabled("route", true), true);
  assertEquals(form.validate(), true);
  assertEquals(form.inspect().disabledFields, ["route"]);
  assertEquals(form.setValue("route", "runtime"), false);
  assertEquals(form.setFieldDisabled("route", false), true);
  assertEquals(form.setValue("route", "runtime"), true);

  const result = await form.submit((snapshot) => void submitted.push(snapshot));
  assertEquals(result, {
    valid: true,
    submitted: true,
    snapshot: form.snapshot(),
  });
  assertEquals(submitted[0]!.values, { route: "runtime", label: "Panel" });
  assertEquals(form.inspect().groups.map((group) => [group.id, group.fields, group.valid]), [
    ["routing", ["route"], true],
    ["metadata", ["label"], true],
  ]);
  assertEquals(form.inspect().readOnlyFields, ["label"]);
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

Deno.test("formCommands validate reset touch and field actions", async () => {
  const form = new FormController<SettingsForm>([
    { name: "route", initialValue: "overview", validators: [required()] },
    { name: "label", initialValue: "", validators: [required("Label required"), minLength(3)] },
  ]);
  const registry = new CommandRegistry<FormCommandAction<SettingsForm>>();
  const dispose = bindFormCommands(registry, form, {
    id: "settings",
    idPrefix: "settingsForm",
    group: "settings",
    includeFieldCommands: true,
    labels: { validate: "Check", validateField: "Check Field" },
    fieldLabel: (field) => field.toUpperCase(),
  });
  const actions: Array<FormCommandAction<SettingsForm>> = [];

  assertEquals(registry.list("settings").map((command) => [command.id, command.label]), [
    ["settingsForm.validate", "Check"],
    ["settingsForm.field.label.validate", "Check Field: LABEL"],
    ["settingsForm.field.route.validate", "Check Field: ROUTE"],
    ["settingsForm.reset", "Reset Form"],
    ["settingsForm.submit", "Submit Form"],
    ["settingsForm.touchAll", "Touch All Fields"],
    ["settingsForm.field.label.touch", "Touch Field: LABEL"],
    ["settingsForm.field.route.touch", "Touch Field: ROUTE"],
  ]);

  assertEquals(await registry.execute("settingsForm.validate", (action) => void actions.push(action)), true);
  const validateAction = actions[0]!;
  if (validateAction.type !== "form.validated") throw new Error("expected form.validated");
  assertEquals(validateAction.payload!.id, "settings");
  assertEquals(validateAction.payload!.valid, false);
  assertEquals(validateAction.payload!.snapshot.errors.label, ["Label required", "Must be at least 3 characters"]);

  assertEquals(await registry.execute("settingsForm.field.label.touch", (action) => void actions.push(action)), true);
  assertEquals(form.touched.peek().label, true);
  const touchAction = actions[1]!;
  if (touchAction.type !== "form.field.touched") throw new Error("expected form.field.touched");
  assertEquals(touchAction.payload!.field, "label");

  form.setValue("label", "Runtime");
  assertEquals(commandDisabled(registry.get("settingsForm.reset")!), false);
  assertEquals(await registry.execute("settingsForm.reset", (action) => void actions.push(action)), true);
  assertEquals(form.snapshot().values, { route: "overview", label: "" });
  assertEquals(actions[2]!.type, "form.reset");
  assertEquals(await registry.execute("settingsForm.submit", (action) => void actions.push(action)), true);
  assertEquals(actions[3]!.type, "form.submitted");

  dispose();
  assertEquals(registry.list("settings"), []);
});

Deno.test("formCommands can omit field commands and disable empty forms", () => {
  const form = new FormController<SettingsForm>();
  const commands = formCommands(form, { includeFieldCommands: false });

  assertEquals(commands.map((command) => [command.id, commandDisabled(command)]), [
    ["form.submit", true],
    ["form.validate", true],
    ["form.reset", true],
    ["form.touchAll", true],
  ]);
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

function commandDisabled(command: { disabled?: boolean | (() => boolean) }): boolean | undefined {
  return typeof command.disabled === "function" ? command.disabled() : command.disabled;
}
