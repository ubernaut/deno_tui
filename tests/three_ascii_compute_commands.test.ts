import { assertEquals } from "./deps.ts";
import { encodeThreeAsciiComputeDispatchCommands } from "../src/three_ascii/compute_commands.ts";
import { createThreeAsciiComputeDispatchPlan } from "../src/three_ascii/compute_plan.ts";

Deno.test("encodeThreeAsciiComputeDispatchCommands encodes fill and color passes", () => {
  const encoder = new FakeCommandEncoder();
  const resources = new FakeDispatchResources();
  encodeThreeAsciiComputeDispatchCommands(
    encoder,
    createThreeAsciiComputeDispatchPlan({ columns: 17, rows: 9, workgroupSize: 8, includeEdges: false }),
    resources,
  );

  assertEquals(encoder.records, [
    {
      label: "deno_tui.three_ascii.fill",
      pipeline: "pipeline:fill",
      bindGroup: "bind-group:fill",
      workgroups: [3, 2, 1],
      ended: true,
    },
    {
      label: "deno_tui.three_ascii.color",
      pipeline: "pipeline:color",
      bindGroup: "bind-group:color",
      workgroups: [3, 2, 1],
      ended: true,
    },
  ]);
  assertEquals(resources.pipelineLookups, ["fill", "color"]);
  assertEquals(resources.bindGroupLookups, ["fill", "color"]);
});

Deno.test("encodeThreeAsciiComputeDispatchCommands includes edge pass when planned", () => {
  const encoder = new FakeCommandEncoder();
  const resources = new FakeDispatchResources();
  encodeThreeAsciiComputeDispatchCommands(
    encoder,
    createThreeAsciiComputeDispatchPlan({ columns: 8, rows: 8, workgroupSize: 8, includeEdges: true }),
    resources,
  );

  assertEquals(encoder.records.map((record) => record.label), [
    "deno_tui.three_ascii.fill",
    "deno_tui.three_ascii.edge",
    "deno_tui.three_ascii.color",
  ]);
  assertEquals(encoder.records.map((record) => record.workgroups), [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
  ]);
});

interface ComputePassRecord {
  label: string;
  pipeline?: string;
  bindGroup?: string;
  workgroups?: [number, number, number];
  ended: boolean;
}

class FakeCommandEncoder {
  readonly records: ComputePassRecord[] = [];

  beginComputePass(descriptor: GPUComputePassDescriptor): GPUComputePassEncoder {
    const record: ComputePassRecord = { label: String(descriptor.label), ended: false };
    this.records.push(record);
    return {
      setPipeline: (pipeline: GPUComputePipeline) => {
        record.pipeline = String(pipeline);
      },
      setBindGroup: (_index: number, bindGroup: GPUBindGroup) => {
        record.bindGroup = String(bindGroup);
      },
      dispatchWorkgroups: (x: number, y: number, z: number) => {
        record.workgroups = [x, y, z];
      },
      end: () => {
        record.ended = true;
      },
    } as unknown as GPUComputePassEncoder;
  }
}

class FakeDispatchResources {
  readonly pipelineLookups: string[] = [];
  readonly bindGroupLookups: string[] = [];

  pipelineForPass(kind: "fill" | "edge" | "color"): GPUComputePipeline {
    this.pipelineLookups.push(kind);
    return `pipeline:${kind}` as unknown as GPUComputePipeline;
  }

  bindGroupForPass(kind: "fill" | "edge" | "color"): GPUBindGroup {
    this.bindGroupLookups.push(kind);
    return `bind-group:${kind}` as unknown as GPUBindGroup;
  }
}
