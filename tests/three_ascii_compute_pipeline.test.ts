import { assertEquals } from "./deps.ts";
import { createThreeAsciiComputePipeline } from "../src/three_ascii/compute_pipeline.ts";

Deno.test("createThreeAsciiComputePipeline creates shader module and auto-layout pipeline", () => {
  const device = new FakeComputePipelineDevice();
  const pipeline = createThreeAsciiComputePipeline({
    device,
    label: "deno_tui.three_ascii.fill",
    code: "fn main() {}",
  });

  assertEquals(pipeline, "pipeline:deno_tui.three_ascii.fill" as unknown as GPUComputePipeline);
  assertEquals(device.shaderModules, [
    { label: "deno_tui.three_ascii.fill.wgsl", code: "fn main() {}" },
  ]);
  assertEquals(device.computePipelines, [
    {
      label: "deno_tui.three_ascii.fill",
      layout: "auto",
      module: "shader:deno_tui.three_ascii.fill.wgsl",
      entryPoint: "main",
    },
  ]);
});

Deno.test("createThreeAsciiComputePipeline accepts custom entrypoints", () => {
  const device = new FakeComputePipelineDevice();
  createThreeAsciiComputePipeline({
    device,
    label: "custom",
    code: "fn alternate() {}",
    entryPoint: "alternate",
  });

  assertEquals(device.computePipelines[0]?.entryPoint, "alternate");
});

Deno.test("createThreeAsciiComputePipeline reuses pipelines by device shader and entrypoint", () => {
  const device = new FakeComputePipelineDevice();
  const first = createThreeAsciiComputePipeline({
    device,
    label: "first",
    code: "fn main() {}",
  });
  const second = createThreeAsciiComputePipeline({
    device,
    label: "second",
    code: "fn main() {}",
  });
  const alternate = createThreeAsciiComputePipeline({
    device,
    label: "alternate",
    code: "fn alternate() {}",
    entryPoint: "alternate",
  });

  assertEquals(second, first);
  assertEquals(device.shaderModules.length, 2);
  assertEquals(device.computePipelines.length, 2);
  assertEquals(alternate, "pipeline:alternate" as unknown as GPUComputePipeline);
});

interface FakeShaderModuleDescriptor {
  label?: string;
  code: string;
}

interface FakeComputePipelineDescriptor {
  label?: string;
  layout: string;
  module: string;
  entryPoint?: string;
}

class FakeComputePipelineDevice {
  readonly shaderModules: FakeShaderModuleDescriptor[] = [];
  readonly computePipelines: FakeComputePipelineDescriptor[] = [];

  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule {
    this.shaderModules.push({ label: String(descriptor.label), code: descriptor.code });
    return `shader:${String(descriptor.label)}` as unknown as GPUShaderModule;
  }

  createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline {
    this.computePipelines.push({
      label: String(descriptor.label),
      layout: descriptor.layout as string,
      module: descriptor.compute.module as unknown as string,
      entryPoint: descriptor.compute.entryPoint,
    });
    return `pipeline:${String(descriptor.label)}` as unknown as GPUComputePipeline;
  }
}
