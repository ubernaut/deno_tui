import { assertEquals, assertThrows } from "./deps.ts";
import { createThreeAsciiComputeBindGroups } from "../src/three_ascii/compute_bind_groups.ts";

Deno.test("createThreeAsciiComputeBindGroups creates fill and color bindings without edges", () => {
  const device = new FakeBindGroupDevice();
  const groups = createThreeAsciiComputeBindGroups({
    device,
    paramsBuffer: fakeBuffer("params"),
    fillPipeline: fakePipeline("fill-layout"),
    colorPipeline: fakePipeline("color-layout"),
    fillOutput: fakeBuffer("fill"),
    colorOutput: fakeBuffer("color"),
    downscaleTexture: fakeTexture("downscale"),
    includeEdges: false,
    colorUsesDepthTexture: false,
  });

  assertEquals(groups.fillBindGroup, "deno_tui.three_ascii.fill.bindings" as unknown as GPUBindGroup);
  assertEquals(groups.edgeBindGroup, undefined);
  assertEquals(groups.colorBindGroup, "deno_tui.three_ascii.color.bindings" as unknown as GPUBindGroup);
  assertEquals(device.labels(), [
    "deno_tui.three_ascii.fill.bindings",
    "deno_tui.three_ascii.color.bindings",
  ]);
  assertEquals(device.created[0]?.entries.map((entry) => entry.binding), [0, 1, 2]);
  assertEquals(device.created[1]?.entries.map((entry) => entry.binding), [0, 1, 2]);
});

Deno.test("createThreeAsciiComputeBindGroups creates edge bindings when requested", () => {
  const device = new FakeBindGroupDevice();
  const groups = createThreeAsciiComputeBindGroups({
    device,
    paramsBuffer: fakeBuffer("params"),
    fillPipeline: fakePipeline("fill-layout"),
    edgePipeline: fakePipeline("edge-layout"),
    colorPipeline: fakePipeline("color-layout"),
    fillOutput: fakeBuffer("fill"),
    edgeOutput: fakeBuffer("edge"),
    colorOutput: fakeBuffer("color"),
    downscaleTexture: fakeTexture("downscale"),
    sobelTexture: fakeTexture("sobel"),
    includeEdges: true,
    colorUsesDepthTexture: false,
  });

  assertEquals(groups.edgeBindGroup, "deno_tui.three_ascii.edge.bindings" as unknown as GPUBindGroup);
  assertEquals(device.labels(), [
    "deno_tui.three_ascii.fill.bindings",
    "deno_tui.three_ascii.edge.bindings",
    "deno_tui.three_ascii.color.bindings",
  ]);
});

Deno.test("createThreeAsciiComputeBindGroups rejects incomplete edge resources", () => {
  assertThrows(
    () =>
      createThreeAsciiComputeBindGroups({
        device: new FakeBindGroupDevice(),
        paramsBuffer: fakeBuffer("params"),
        fillPipeline: fakePipeline("fill-layout"),
        colorPipeline: fakePipeline("color-layout"),
        fillOutput: fakeBuffer("fill"),
        colorOutput: fakeBuffer("color"),
        downscaleTexture: fakeTexture("downscale"),
        includeEdges: true,
        colorUsesDepthTexture: false,
      }),
    Error,
    "edge compute resources",
  );
});

Deno.test("createThreeAsciiComputeBindGroups binds normals only for depth color", () => {
  const device = new FakeBindGroupDevice();
  createThreeAsciiComputeBindGroups({
    device,
    paramsBuffer: fakeBuffer("params"),
    fillPipeline: fakePipeline("fill-layout"),
    colorPipeline: fakePipeline("color-layout"),
    fillOutput: fakeBuffer("fill"),
    colorOutput: fakeBuffer("color"),
    downscaleTexture: fakeTexture("downscale"),
    normalsTexture: fakeTexture("normals"),
    includeEdges: false,
    colorUsesDepthTexture: true,
  });

  assertEquals(device.created[1]?.entries.map((entry) => entry.binding), [0, 1, 2, 3]);
});

Deno.test("createThreeAsciiComputeBindGroups rejects missing depth color resources", () => {
  assertThrows(
    () =>
      createThreeAsciiComputeBindGroups({
        device: new FakeBindGroupDevice(),
        paramsBuffer: fakeBuffer("params"),
        fillPipeline: fakePipeline("fill-layout"),
        colorPipeline: fakePipeline("color-layout"),
        fillOutput: fakeBuffer("fill"),
        colorOutput: fakeBuffer("color"),
        downscaleTexture: fakeTexture("downscale"),
        includeEdges: false,
        colorUsesDepthTexture: true,
      }),
    Error,
    "depth color resources",
  );
});

class FakeBindGroupDevice {
  readonly created: GPUBindGroupDescriptor[] = [];

  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup {
    this.created.push(descriptor);
    return descriptor.label as unknown as GPUBindGroup;
  }

  labels(): string[] {
    return this.created.map((descriptor) => String(descriptor.label));
  }
}

function fakePipeline(layout: string): Pick<GPUComputePipeline, "getBindGroupLayout"> {
  return {
    getBindGroupLayout: () => layout as unknown as GPUBindGroupLayout,
  };
}

function fakeTexture(label: string): Pick<GPUTexture, "createView"> {
  return {
    createView: () => `${label}-view` as unknown as GPUTextureView,
  };
}

function fakeBuffer(label: string): GPUBuffer {
  return label as unknown as GPUBuffer;
}
