export function requireInteractiveTerminal(command: string): void {
  const input = Deno.stdin.isTerminal();
  const output = Deno.stdout.isTerminal();
  if (input && output) return;

  const missing = [
    input ? undefined : "stdin",
    output ? undefined : "stdout",
  ].filter((value): value is string => value !== undefined).join(" and ");

  const verb = missing.includes(" and ") ? "are" : "is";
  console.error(`${command} requires an interactive terminal (${missing} ${verb} not a TTY).`);
  console.error("Run it directly in a terminal, or use a report/web task for non-interactive output.");
  Deno.exit(64);
}
