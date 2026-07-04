import type { ThreeAsciiComputeDispatchPlan, ThreeAsciiComputePassPlan } from "./compute_plan.ts";

export interface ThreeAsciiComputeDispatchResources {
  pipelineForPass(kind: ThreeAsciiComputePassPlan["kind"]): GPUComputePipeline;
  bindGroupForPass(kind: ThreeAsciiComputePassPlan["kind"]): GPUBindGroup;
}

export interface ThreeAsciiComputeCommandEncoderLike {
  beginComputePass(descriptor: GPUComputePassDescriptor): GPUComputePassEncoder;
}

/** Encodes the fill/edge/color compute passes for one Three ASCII frame. */
export function encodeThreeAsciiComputeDispatchCommands(
  commandEncoder: ThreeAsciiComputeCommandEncoderLike,
  dispatchPlan: ThreeAsciiComputeDispatchPlan,
  resources: ThreeAsciiComputeDispatchResources,
): void {
  for (const pass of dispatchPlan.passes) {
    encodeThreeAsciiComputePass(commandEncoder, pass, dispatchPlan, resources);
  }
}

function encodeThreeAsciiComputePass(
  commandEncoder: ThreeAsciiComputeCommandEncoderLike,
  pass: ThreeAsciiComputePassPlan,
  dispatchPlan: Pick<ThreeAsciiComputeDispatchPlan, "workgroupsX" | "workgroupsY">,
  resources: ThreeAsciiComputeDispatchResources,
): void {
  const passEncoder = commandEncoder.beginComputePass({ label: pass.label });
  passEncoder.setPipeline(resources.pipelineForPass(pass.kind));
  passEncoder.setBindGroup(0, resources.bindGroupForPass(pass.kind));
  passEncoder.dispatchWorkgroups(dispatchPlan.workgroupsX, dispatchPlan.workgroupsY, 1);
  passEncoder.end();
}
