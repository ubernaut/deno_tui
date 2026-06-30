import {
  bindFormCommands,
  bindFormField,
  CommandRegistry,
  commandSurfaceItems,
  executeCommandSurfaceItem,
  type FormCommandAction,
  FormController,
  searchCommandSurfaceItems,
  Signal,
} from "../mod.ts";

interface SettingsForm {
  project: string;
  refreshRate: number;
  renderer: string;
}

const form = new FormController<SettingsForm>({
  schema: {
    fields: [
      {
        name: "project",
        label: "Project",
        group: "identity",
        initialValue: "deno-tui",
        validators: [
          (value) =>
            typeof value === "string" && value.trim().length >= 3
              ? undefined
              : "Project name must be at least 3 characters.",
        ],
      },
      {
        name: "refreshRate",
        label: "Refresh rate",
        group: "runtime",
        initialValue: 30,
        validators: [
          (value) =>
            typeof value === "number" && value >= 1 && value <= 120 ? undefined : "Refresh rate must be 1-120 FPS.",
        ],
      },
      {
        name: "renderer",
        label: "Renderer",
        group: "runtime",
        initialValue: "mixed",
        readOnly: true,
        validators: [
          (value) =>
            typeof value === "string" && ["blocks", "glyphs", "mixed"].includes(value)
              ? undefined
              : "Unknown renderer mode.",
        ],
      },
    ],
    validate: (values) => values.project === "root" ? { project: "Project name is reserved." } : {},
  },
});

const projectInput = new Signal("ui");
const refreshInput = new Signal("144");
const rendererInput = new Signal("mixed");

const disposeProject = bindFormField(form, "project", projectInput, { initialSync: "target", validateOnBind: true });
const disposeRefresh = bindFormField(form, "refreshRate", refreshInput, {
  initialSync: "target",
  parse: (value) => Number(value),
  format: (value) => String(value),
  validateOnBind: true,
});
const disposeRenderer = bindFormField(form, "renderer", rendererInput, {
  initialSync: "target",
  validateOnBind: true,
});

const registry = new CommandRegistry<FormCommandAction<SettingsForm>>();
const submitted: string[] = [];
const disposeCommands = bindFormCommands(registry, form, {
  id: "settings",
  idPrefix: "settings",
  group: "settings-form",
  includeFieldCommands: true,
  onSubmit: (snapshot) => {
    submitted.push(JSON.stringify(snapshot.values));
  },
  fieldLabel: (field) => field.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`),
});

const events: string[] = [];
await executeCommandSurfaceItem(
  registry,
  searchCommandSurfaceItems(registry, { query: "validate form", limit: 1 })[0]!,
  (action) => {
    events.push(`${action.type}:${action.payload && "valid" in action.payload ? action.payload.valid : "snapshot"}`);
  },
);

refreshInput.value = "60";
projectInput.value = "deno-tui";
await registry.execute("settings.validate", (action) => {
  events.push(`${action.type}:${action.payload && "valid" in action.payload ? action.payload.valid : "snapshot"}`);
});
await registry.execute("settings.submit", (action) => {
  events.push(`${action.type}:${action.payload && "submitted" in action.payload ? action.payload.submitted : false}`);
});

const snapshot = form.inspect();

console.log("# Form Workflow Demo");
console.log("");
console.log(`Fields: ${snapshot.fieldCount}`);
console.log(`Valid: ${snapshot.valid}`);
console.log(`Dirty fields: ${snapshot.dirtyFields.join(", ") || "none"}`);
console.log(`Touched fields: ${snapshot.touchedFields.join(", ") || "none"}`);
console.log(`Error fields: ${snapshot.errorFields.join(", ") || "none"}`);
console.log(`Read-only fields: ${snapshot.readOnlyFields.join(", ") || "none"}`);
console.log(`Groups: ${snapshot.groups.map((group) => `${group.id}:${group.fields.length}`).join(", ")}`);
console.log(
  `Error summary: ${snapshot.errorSummary.map((item) => `${item.name}:${item.errors.join("/")}`).join(", ") || "none"}`,
);
console.log(`Values: ${JSON.stringify(snapshot.values)}`);
console.log(`Submitted: ${submitted.join(" | ") || "none"}`);
console.log(`Commands: ${registry.inspect().count} (${registry.inspect().groups.join(", ")})`);
console.log(
  `Search hits: ${
    searchCommandSurfaceItems(registry, { query: "renderer", limit: 3 }).map((item) => item.id).join(", ")
  }`,
);
console.log(`Events: ${events.join(", ")}`);
console.log(
  `Surface: ${commandSurfaceItems(registry, { includeDisabled: false }).map((item) => item.label).join(" | ")}`,
);

disposeCommands();
disposeProject();
disposeRefresh();
disposeRenderer();
projectInput.dispose();
refreshInput.dispose();
rendererInput.dispose();
form.dispose();
