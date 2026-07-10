// Copyright 2023 Im-Beast. MIT license.
import type { MetricSeriesController, MetricSeriesInspection } from "../components/metric_series.ts";
import type { Action } from "./actions.ts";
import type { IdentifiedLabeledCommandGroupOptions } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for metric Series Command variants. */
export type MetricSeriesCommandKind = "clear" | "limit";

/** Action union emitted by metric Series Command command helpers. */
export type MetricSeriesCommandAction =
  | Action<"metricSeries.cleared", MetricSeriesCommandPayload>
  | Action<"metricSeries.limitChanged", MetricSeriesCommandPayload & { limit: number }>;

/** Payload carried by metric Series Command actions. */
export interface MetricSeriesCommandPayload {
  id: string;
  inspection: MetricSeriesInspection;
}

/** Options for configuring metric Series Command. */
export interface MetricSeriesCommandOptions extends IdentifiedLabeledCommandGroupOptions<MetricSeriesCommandKind> {
  includeClear?: boolean;
  includeLimitCommands?: boolean;
  disabledWhenEmpty?: boolean;
  limits?: readonly number[];
  limitLabel?: (limit: number) => string;
}

/** Builds command definitions for metric Series. */
export function metricSeriesCommands<TAction extends Action = MetricSeriesCommandAction>(
  series: MetricSeriesController,
  options: MetricSeriesCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "metric";
  const idPrefix = options.idPrefix ?? "metric";
  const group = options.group ?? "metrics";
  const disabledWhenEmpty = options.disabledWhenEmpty ?? true;
  const label = (kind: MetricSeriesCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const limitLabel = options.limitLabel ?? ((limit: number) => `${limit} samples`);
  const empty = () => disabledWhenEmpty && series.values.peek().length === 0;
  const payload = (): MetricSeriesCommandPayload => ({ id, inspection: series.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeClear ?? true) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear Metric Series"),
      group,
      keywords: ["metric", "series", "clear"],
      disabled: empty,
      action: () => {
        series.reset();
        return { type: "metricSeries.cleared", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeLimitCommands ?? false) {
    for (const limit of options.limits ?? [30, 60, 120]) {
      const normalizedLimit = Math.max(0, Math.floor(limit));
      commands.push({
        id: `${idPrefix}.limit.${normalizedLimit}`,
        label: `${label("limit", "Set Metric Window")}: ${limitLabel(normalizedLimit)}`,
        group,
        keywords: ["metric", "series", "limit", String(normalizedLimit), limitLabel(normalizedLimit)],
        disabled: () => series.limit.peek() === normalizedLimit,
        action: () => {
          series.setLimit(normalizedLimit);
          return {
            type: "metricSeries.limitChanged",
            payload: { ...payload(), limit: normalizedLimit },
          } as TAction;
        },
      });
    }
  }

  return commands;
}

/** Binds metric Series Commands behavior and returns a disposer when applicable. */
export function bindMetricSeriesCommands<TAction extends Action = MetricSeriesCommandAction>(
  registry: CommandRegistry<TAction>,
  series: MetricSeriesController,
  options: MetricSeriesCommandOptions = {},
): () => void {
  return registry.registerAll(metricSeriesCommands<TAction>(series, options));
}
