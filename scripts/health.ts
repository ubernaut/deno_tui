export interface HealthStep {
  name: string;
  command: string[];
  optional?: boolean;
}

export interface HealthResult extends HealthStep {
  code: number;
  success: boolean;
  durationMs: number;
}

export const defaultHealthSteps: readonly HealthStep[] = [
  { name: "format", command: ["deno", "fmt", "--check"] },
  { name: "public-api", command: ["deno", "check", "mod.ts"] },
  {
    name: "api-inventory",
    command: ["deno", "task", "api-inventory", "--", "--check", "--quiet", "--fail-duplicates"],
  },
  { name: "app-shell", command: ["deno", "check", "examples/app_shell.ts"] },
  { name: "visualization-app", command: ["deno", "task", "viz:check"] },
  { name: "showcase", command: ["deno", "task", "showcase:check"] },
  { name: "grwizard", command: ["deno", "task", "grwizard:check"] },
  { name: "tests", command: ["deno", "test"] },
  { name: "worker-tests", command: ["deno", "task", "test:workers"] },
];

export async function runHealth(
  steps: readonly HealthStep[] = defaultHealthSteps,
  options: { cwd?: string; stdout?: "inherit" | "null"; stderr?: "inherit" | "null" } = {},
): Promise<HealthResult[]> {
  const results: HealthResult[] = [];
  for (const step of steps) {
    const started = performance.now();
    const command = new Deno.Command(step.command[0], {
      args: step.command.slice(1),
      cwd: options.cwd,
      stdout: options.stdout ?? "inherit",
      stderr: options.stderr ?? "inherit",
    });
    const status = await command.output();
    results.push({
      ...step,
      code: status.code,
      success: status.success || !!step.optional,
      durationMs: performance.now() - started,
    });
  }
  return results;
}

export function formatHealthResult(result: HealthResult): string {
  const icon = result.success ? "ok" : "fail";
  const suffix = result.optional && result.code !== 0 ? " optional" : "";
  return `${icon} ${result.name}${suffix} ${Math.round(result.durationMs)}ms`;
}

export function healthSucceeded(results: readonly HealthResult[]): boolean {
  return results.every((result) => result.success);
}

if (import.meta.main) {
  const results = await runHealth();
  for (const result of results) {
    console.log(formatHealthResult(result));
  }
  if (!healthSucceeded(results)) {
    Deno.exit(1);
  }
}
