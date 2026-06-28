// Copyright 2023 Im-Beast. MIT license.
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";
import type { FieldName, FormController, FormSnapshot, FormValues } from "./forms.ts";

export type FormCommandKind =
  | "validate"
  | "reset"
  | "touchAll"
  | "validateField"
  | "touchField";

export type FormCommandAction<TValues extends FormValues = FormValues> =
  | Action<"form.validated", FormCommandSnapshotPayload<TValues> & { valid: boolean }>
  | Action<"form.reset", FormCommandSnapshotPayload<TValues>>
  | Action<"form.touched", FormCommandSnapshotPayload<TValues>>
  | Action<"form.field.validated", FormFieldCommandPayload<TValues> & { valid: boolean }>
  | Action<"form.field.touched", FormFieldCommandPayload<TValues>>;

export interface FormCommandSnapshotPayload<TValues extends FormValues = FormValues> {
  id: string;
  snapshot: FormSnapshot<TValues>;
}

export interface FormFieldCommandPayload<TValues extends FormValues = FormValues>
  extends FormCommandSnapshotPayload<TValues> {
  field: FieldName<TValues>;
}

export interface FormCommandOptions<TValues extends FormValues = FormValues> {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeFormCommands?: boolean;
  includeFieldCommands?: boolean;
  disabledWhenEmpty?: boolean;
  labels?: Partial<Record<FormCommandKind, string>>;
  fieldLabel?: (field: FieldName<TValues>) => string;
  fieldId?: (field: FieldName<TValues>) => string;
}

export function formCommands<
  TValues extends FormValues = FormValues,
  TAction extends Action = FormCommandAction<TValues>,
>(
  form: FormController<TValues>,
  options: FormCommandOptions<TValues> = {},
): Command<TAction>[] {
  const id = options.id ?? "form";
  const idPrefix = options.idPrefix ?? "form";
  const group = options.group ?? "form";
  const disabledWhenEmpty = options.disabledWhenEmpty ?? true;
  const label = (kind: FormCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const fieldLabel = options.fieldLabel ?? ((field: FieldName<TValues>) => field);
  const fieldId = options.fieldId ?? encodeURIComponent;
  const empty = () => disabledWhenEmpty && form.fieldNames().length === 0;
  const snapshot = (): FormCommandSnapshotPayload<TValues> => ({ id, snapshot: form.snapshot() });
  const fieldPayload = (field: FieldName<TValues>): FormFieldCommandPayload<TValues> => ({
    ...snapshot(),
    field,
  });
  const commands: Command<TAction>[] = [];

  if (options.includeFormCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.validate`,
        label: label("validate", "Validate Form"),
        group,
        keywords: ["form", "validate"],
        disabled: empty,
        action: () => {
          const valid = form.validate();
          return { type: "form.validated", payload: { ...snapshot(), valid } } as TAction;
        },
      },
      {
        id: `${idPrefix}.reset`,
        label: label("reset", "Reset Form"),
        group,
        keywords: ["form", "reset"],
        disabled: () => empty() || !form.isDirty(),
        action: () => {
          form.reset();
          return { type: "form.reset", payload: snapshot() } as TAction;
        },
      },
      {
        id: `${idPrefix}.touchAll`,
        label: label("touchAll", "Touch All Fields"),
        group,
        keywords: ["form", "touch", "fields"],
        disabled: empty,
        action: () => {
          form.touchAll();
          return { type: "form.touched", payload: snapshot() } as TAction;
        },
      },
    );
  }

  if (options.includeFieldCommands ?? false) {
    for (const field of form.fieldNames()) {
      const name = fieldLabel(field);
      commands.push(
        {
          id: `${idPrefix}.field.${fieldId(field)}.validate`,
          label: `${label("validateField", "Validate Field")}: ${name}`,
          group,
          keywords: ["form", "validate", field, name],
          disabled: () => !form.fieldNames().includes(field),
          action: () => {
            const valid = form.validateField(field);
            return { type: "form.field.validated", payload: { ...fieldPayload(field), valid } } as TAction;
          },
        },
        {
          id: `${idPrefix}.field.${fieldId(field)}.touch`,
          label: `${label("touchField", "Touch Field")}: ${name}`,
          group,
          keywords: ["form", "touch", field, name],
          disabled: () => !form.fieldNames().includes(field),
          action: () => {
            form.touch(field);
            return { type: "form.field.touched", payload: fieldPayload(field) } as TAction;
          },
        },
      );
    }
  }

  return commands;
}

export function bindFormCommands<
  TValues extends FormValues = FormValues,
  TAction extends Action = FormCommandAction<TValues>,
>(
  registry: CommandRegistry<TAction>,
  form: FormController<TValues>,
  options: FormCommandOptions<TValues> = {},
): () => void {
  return registry.registerAll(formCommands<TValues, TAction>(form, options));
}
