// Copyright 2023 Im-Beast. MIT license.
import type { RuntimeWorkloadRegistry, RuntimeWorkloadReport } from "../runtime/telemetry.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type RuntimeWorkloadCommandAction = Action<"runtime.workloads.reported", RuntimeWorkloadReportedPayload>;

export interface RuntimeWorkloadReportedPayload {
  report: RuntimeWorkloadReport;
  markdown?: string;
}

export interface RuntimeWorkloadCommandOptions {
  group?: string;
  prefix?: string;
  title?: string;
  includeMarkdown?: boolean;
  disableEmpty?: boolean;
}

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

export function bindRuntimeWorkloadCommands<TAction extends Action = RuntimeWorkloadCommandAction>(
  registry: CommandRegistry<TAction>,
  workloads: RuntimeWorkloadRegistry,
  options: RuntimeWorkloadCommandOptions = {},
): () => void {
  return registry.registerAll(runtimeWorkloadCommands(workloads, options) as unknown as Command<TAction>[]);
}
