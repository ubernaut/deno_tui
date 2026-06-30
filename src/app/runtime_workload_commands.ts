// Copyright 2023 Im-Beast. MIT license.
import type { RuntimeWorkloadRegistry, RuntimeWorkloadReport } from "../runtime/telemetry.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Action union emitted by runtime Workload Command command helpers. */
export type RuntimeWorkloadCommandAction = Action<"runtime.workloads.reported", RuntimeWorkloadReportedPayload>;

/** Payload carried by runtime Workload Reported actions. */
export interface RuntimeWorkloadReportedPayload {
  report: RuntimeWorkloadReport;
  markdown?: string;
}

/** Options for configuring runtime Workload Command. */
export interface RuntimeWorkloadCommandOptions {
  group?: string;
  prefix?: string;
  title?: string;
  includeMarkdown?: boolean;
  disableEmpty?: boolean;
}

/** Builds command definitions for runtime Workload. */
export function runtimeWorkloadCommands(
  workloads: RuntimeWorkloadRegistry,
  options: RuntimeWorkloadCommandOptions = {},
): Command<RuntimeWorkloadCommandAction>[] {
  const group = options.group ?? "runtime";
  const prefix = options.prefix ?? "runtime.workloads";
  return [
    {
      id: `${prefix}.report`,
      label: "Runtime Workload Report",
      description: "Capture scheduler and worker-pool pressure telemetry.",
      group,
      keywords: ["runtime", "workload", "pressure", "telemetry", "scheduler", "worker"],
      disabled: options.disableEmpty ?? true ? () => workloads.inspect().count === 0 : false,
      action: () => {
        const report = workloads.report();
        return {
          type: "runtime.workloads.reported",
          payload: {
            report,
            markdown: options.includeMarkdown ?? true
              ? workloads.markdown({ title: options.title ?? "Runtime Workloads" })
              : undefined,
          },
        };
      },
    },
  ];
}

/** Binds runtime Workload Commands behavior and returns a disposer when applicable. */
export function bindRuntimeWorkloadCommands<TAction extends Action = RuntimeWorkloadCommandAction>(
  registry: CommandRegistry<TAction>,
  workloads: RuntimeWorkloadRegistry,
  options: RuntimeWorkloadCommandOptions = {},
): () => void {
  return registry.registerAll(runtimeWorkloadCommands(workloads, options) as unknown as Command<TAction>[]);
}
