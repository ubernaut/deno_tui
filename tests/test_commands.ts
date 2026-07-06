export interface TestCommandDisabled {
  disabled?: boolean | (() => boolean);
}

export function commandDisabled(command: TestCommandDisabled): boolean | undefined {
  return typeof command.disabled === "function" ? command.disabled() : command.disabled;
}

export function commandDisabledBoolean(command: TestCommandDisabled): boolean {
  return commandDisabled(command) ?? false;
}
