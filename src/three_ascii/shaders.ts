export const THREE_ASCII_TILE_SIZE = 8;
export const THREE_ASCII_WORKGROUP_SIZE = 8;
export const THREE_ASCII_TERMINAL_EDGE_THRESHOLD_SCALE = 2;

const FOG_SCALE = 0.005 / Math.sqrt(Math.log(2));
const MIN_VISIBLE_LUMINANCE = 0.015;

export const THREE_ASCII_FILL_SHADER = /* wgsl */ `
struct Params {
  dims: vec4<f32>,
  flags: vec4<f32>,
  effect0: vec4<f32>,
  effect1: vec4<f32>,
  asciiColor: vec4<f32>,
  backgroundColor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var downscaleTex: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> glyphs: array<f32>;

@compute @workgroup_size(${THREE_ASCII_WORKGROUP_SIZE}, ${THREE_ASCII_WORKGROUP_SIZE}, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let columns = u32(params.dims.x);
  let rows = u32(params.dims.y);

  if (id.x >= columns || id.y >= rows) {
    return;
  }

  let index = id.y * columns + id.x;

  if (params.flags.y < 0.5) {
    glyphs[index] = 0.0;
    return;
  }

  let sample = textureLoad(downscaleTex, vec2<i32>(i32(id.x), i32(id.y)), 0);
  let exposure = params.effect0.x;
  let attenuation = params.effect0.y;

  var luminanceValue = clamp(pow(max(sample.a, 0.0) * exposure, attenuation), 0.0, 1.0);
  var fillBucket = i32(0);

  if (luminanceValue > ${MIN_VISIBLE_LUMINANCE}) {
    fillBucket = clamp(i32(floor(luminanceValue * 9.0)) + 1, i32(1), i32(9));
  }

  if (params.flags.z > 0.5) {
    fillBucket = select(i32(0), 10 - fillBucket, fillBucket > 0);
  }

  glyphs[index] = f32(fillBucket + 5);
}
`;

export const THREE_ASCII_EDGE_SHADER = /* wgsl */ `
struct Params {
  dims: vec4<f32>,
  flags: vec4<f32>,
  effect0: vec4<f32>,
  effect1: vec4<f32>,
  asciiColor: vec4<f32>,
  backgroundColor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var sobelTex: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> glyphs: array<vec4<f32>>;

fn classifyDirection(theta: f32, valid: f32) -> i32 {
  if (valid <= 0.5) {
    return -1;
  }

  let absTheta = abs(theta) / ${Math.PI};

  if (absTheta < 0.05 || (absTheta > 0.9 && absTheta <= 1.0)) {
    return 0;
  }

  if (absTheta > 0.45 && absTheta < 0.55) {
    return 1;
  }

  if (absTheta > 0.05 && absTheta < 0.45) {
    return select(2, 3, theta > 0.0);
  }

  if (absTheta > 0.55 && absTheta < 0.9) {
    return select(3, 2, theta > 0.0);
  }

  return -1;
}

@compute @workgroup_size(${THREE_ASCII_WORKGROUP_SIZE}, ${THREE_ASCII_WORKGROUP_SIZE}, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let columns = u32(params.dims.x);
  let rows = u32(params.dims.y);

  if (id.x >= columns || id.y >= rows) {
    return;
  }

  let index = id.y * columns + id.x;

  if (params.flags.x < 0.5) {
    glyphs[index] = vec4<f32>(0.0);
    return;
  }

  let tileBase = vec2<i32>(i32(id.x) * ${THREE_ASCII_TILE_SIZE}, i32(id.y) * ${THREE_ASCII_TILE_SIZE});

  var bucket0 = 0.0;
  var bucket1 = 0.0;
  var bucket2 = 0.0;
  var bucket3 = 0.0;

  for (var row = 0; row < ${THREE_ASCII_TILE_SIZE}; row += 1) {
    for (var column = 0; column < ${THREE_ASCII_TILE_SIZE}; column += 1) {
      let sample = textureLoad(sobelTex, tileBase + vec2<i32>(column, row), 0);
      let direction = classifyDirection(sample.x, sample.y);

      if (direction == 0) {
        bucket0 += 1.0;
      } else if (direction == 1) {
        bucket1 += 1.0;
      } else if (direction == 2) {
        bucket2 += 1.0;
      } else if (direction == 3) {
        bucket3 += 1.0;
      }
    }
  }

  var dominantDirection = -1;
  var maxCount = 0.0;

  if (bucket0 > maxCount) {
    dominantDirection = 0;
    maxCount = bucket0;
  }

  if (bucket1 > maxCount) {
    dominantDirection = 1;
    maxCount = bucket1;
  }

  if (bucket2 > maxCount) {
    dominantDirection = 2;
    maxCount = bucket2;
  }

  if (bucket3 > maxCount) {
    dominantDirection = 3;
    maxCount = bucket3;
  }

  let totalCount = bucket0 + bucket1 + bucket2 + bucket3;
  var secondCount = 0.0;

  if (dominantDirection != 0 && bucket0 > secondCount) {
    secondCount = bucket0;
  }

  if (dominantDirection != 1 && bucket1 > secondCount) {
    secondCount = bucket1;
  }

  if (dominantDirection != 2 && bucket2 > secondCount) {
    secondCount = bucket2;
  }

  if (dominantDirection != 3 && bucket3 > secondCount) {
    secondCount = bucket3;
  }

  if (maxCount < params.flags.w || dominantDirection < 0) {
    glyphs[index] = vec4<f32>(0.0);
    return;
  }

  glyphs[index] = vec4<f32>(f32(dominantDirection + 1), maxCount, totalCount, secondCount);
}
`;

export const THREE_ASCII_COLOR_SHADER = /* wgsl */ `
struct Params {
  dims: vec4<f32>,
  flags: vec4<f32>,
  effect0: vec4<f32>,
  effect1: vec4<f32>,
  asciiColor: vec4<f32>,
  backgroundColor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var downscaleTex: texture_2d<f32>;
@group(0) @binding(2) var normalsTex: texture_2d<f32>;
@group(0) @binding(3) var<storage, read_write> colors: array<vec4<f32>>;

@compute @workgroup_size(${THREE_ASCII_WORKGROUP_SIZE}, ${THREE_ASCII_WORKGROUP_SIZE}, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let columns = u32(params.dims.x);
  let rows = u32(params.dims.y);

  if (id.x >= columns || id.y >= rows) {
    return;
  }

  let index = id.y * columns + id.x;
  let downscale = textureLoad(downscaleTex, vec2<i32>(i32(id.x), i32(id.y)), 0);
  let exposure = params.effect0.x;
  let attenuation = params.effect0.y;
  let luminanceValue = clamp(pow(max(downscale.a, 0.0) * exposure, attenuation), 0.0, 1.0);
  let visibility = select(0.0, 1.0, params.flags.y > 0.5 && luminanceValue > ${MIN_VISIBLE_LUMINANCE});
  let center = vec2<i32>(i32(id.x) * ${THREE_ASCII_TILE_SIZE} + ${
  THREE_ASCII_TILE_SIZE / 2
}, i32(id.y) * ${THREE_ASCII_TILE_SIZE} + ${THREE_ASCII_TILE_SIZE / 2});
  let normals = textureLoad(normalsTex, center, 0);
  let z = normals.a * 1000.0;

  let baseAsciiColor = mix(params.asciiColor.rgb, downscale.rgb, params.effect0.z);
  let fogValue = params.effect0.w * ${FOG_SCALE} * max(0.0, z - params.effect1.x);
  let fogFactor = exp2(-(fogValue * fogValue));
  let finalColor = mix(params.backgroundColor.rgb, baseAsciiColor, fogFactor);

  colors[index] = vec4<f32>(clamp(finalColor, vec3<f32>(0.0), vec3<f32>(1.0)), visibility);
}
`;

export const THREE_ASCII_FLAT_COLOR_SHADER = /* wgsl */ `
struct Params {
  dims: vec4<f32>,
  flags: vec4<f32>,
  effect0: vec4<f32>,
  effect1: vec4<f32>,
  asciiColor: vec4<f32>,
  backgroundColor: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var downscaleTex: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> colors: array<vec4<f32>>;

@compute @workgroup_size(${THREE_ASCII_WORKGROUP_SIZE}, ${THREE_ASCII_WORKGROUP_SIZE}, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let columns = u32(params.dims.x);
  let rows = u32(params.dims.y);

  if (id.x >= columns || id.y >= rows) {
    return;
  }

  let index = id.y * columns + id.x;
  let downscale = textureLoad(downscaleTex, vec2<i32>(i32(id.x), i32(id.y)), 0);
  let exposure = params.effect0.x;
  let attenuation = params.effect0.y;
  let luminanceValue = clamp(pow(max(downscale.a, 0.0) * exposure, attenuation), 0.0, 1.0);
  let visibility = select(0.0, 1.0, params.flags.y > 0.5 && luminanceValue > ${MIN_VISIBLE_LUMINANCE});
  let baseAsciiColor = mix(params.asciiColor.rgb, downscale.rgb, params.effect0.z);

  colors[index] = vec4<f32>(clamp(baseAsciiColor, vec3<f32>(0.0), vec3<f32>(1.0)), visibility);
}
`;
