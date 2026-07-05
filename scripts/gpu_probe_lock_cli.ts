import { withGpuProbeLock } from "./gpu_probe_lock.ts";

if (Deno.args.length === 0) {
  console.error("usage: deno run -A scripts/gpu_probe_lock_cli.ts -- <command> [args...]");
  Deno.exit(2);
}

const cliArgs = Deno.args[0] === "--" ? Deno.args.slice(1) : Deno.args;
if (cliArgs.length === 0) {
  console.error("usage: deno run -A scripts/gpu_probe_lock_cli.ts -- <command> [args...]");
  Deno.exit(2);
}

const [command, ...args] = cliArgs;
const code = await withGpuProbeLock(async () => {
  const child = new Deno.Command(command!, {
    args,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await child.output();
  return status.code;
});

Deno.exit(code);
