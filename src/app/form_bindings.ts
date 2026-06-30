// Copyright 2023 Im-Beast. MIT license.
import type { Signal } from "../signals/mod.ts";
import type { FieldName, FormController, FormValues } from "./forms.ts";

/** Options for configuring form Field Binding. */
export interface FormFieldBindingOptions<TField, TTarget = TField> {
  parse?: (value: TTarget) => TField;
  format?: (value: TField) => TTarget;
  initialSync?: "form" | "target";
  touchOnChange?: boolean;
  validateOnBind?: boolean;
}

/** Binds form Field behavior and returns a disposer when applicable. */
export function bindFormField<
  TValues extends FormValues,
  TName extends FieldName<TValues>,
  TTarget = TValues[TName],
>(
  form: FormController<TValues>,
  name: TName,
  target: Signal<TTarget>,
  options: FormFieldBindingOptions<TValues[TName], TTarget> = {},
): () => void {
  const parse = options.parse ?? ((value: TTarget) => value as unknown as TValues[TName]);
  const format = options.format ?? ((value: TValues[TName]) => value as unknown as TTarget);
  const touchOnChange = options.touchOnChange ?? true;
  let syncing = false;

  const syncFromForm = () => {
    if (syncing) return;
    const value = form.getValue<TValues[TName]>(name);
    if (value === undefined) return;
    const next = format(value);
    if (Object.is(target.peek(), next)) return;

    syncing = true;
    target.value = next;
    syncing = false;
  };

  const syncFromTarget = (value: TTarget) => {
    if (syncing) return;
    const next = parse(value);
    if (Object.is(form.getValue<TValues[TName]>(name), next)) return;

    syncing = true;
    form.setValue(name, next);
    if (touchOnChange) form.touch(name);
    syncing = false;
  };

  if (options.initialSync === "target") {
    syncFromTarget(target.peek());
  } else {
    syncFromForm();
  }
  if (options.validateOnBind) form.validateField(name);

  target.subscribe(syncFromTarget);
  form.values.subscribe(syncFromForm);

  return () => {
    target.unsubscribe(syncFromTarget);
    form.values.unsubscribe(syncFromForm);
  };
}
