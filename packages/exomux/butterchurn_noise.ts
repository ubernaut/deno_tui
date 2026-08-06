// Copyright 2023 Im-Beast. MIT license.

// The noise textures MilkDrop preset shaders sample.
//
// Ported from Butterchurn's `src/noise/noise.js`. 173 of the catalog's presets
// sample `sampler_noise_lq` and 43 sample a 3-D noise volume, and they expect
// MilkDrop's specific construction: uniform random bytes, then, for the
// higher-zoom variants, a Catmull-Rom pass along each axis that turns white
// noise into a smooth lattice. Substituting plain random values makes those
// presets render as static rather than as flowing texture.

/** One generated noise texture, as tightly packed RGBA bytes. */
export interface ExomuxNoiseTexture {
  readonly size: number;
  /** 1 for a 2-D texture, `size` for a volume. */
  readonly depth: number;
  readonly data: Uint8Array;
}

/** Catmull-Rom through four samples, matching MilkDrop's `DWORD` interpolate. */
function cubic(y0: number, y1: number, y2: number, y3: number, t: number): number {
  const a0 = y3 - y2 - y0 + y1;
  const a1 = y0 - y1 - a0;
  const a2 = y2 - y0;
  const value = a0 * t * t * t + a1 * t * t + a2 * t + y1;
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

/**
 * Fills gaps left by `zoom` along one axis.
 *
 * `stride` is the distance in texels between neighbours on that axis and
 * `count` how many of them there are, so the same routine serves x, y and z.
 */
function smoothAxis(
  data: Uint8Array,
  size: number,
  zoom: number,
  count: number,
  base: (index: number) => number,
  stride: number,
): void {
  for (let position = 0; position < count; position += 1) {
    if (position % zoom === 0) continue;
    const anchor = Math.floor(position / zoom) * zoom;
    const t = (position % zoom) / zoom;
    for (let channel = 0; channel < 4; channel += 1) {
      const at = (offset: number): number => {
        const wrapped = ((anchor + offset) % size + size) % size;
        return data[base(wrapped) * 4 + channel]!;
      };
      data[base(position) * 4 + channel] = cubic(at(-zoom), at(0), at(zoom), at(zoom * 2), t);
    }
    void stride;
  }
}

/** Builds one 2-D noise texture; `zoom` above 1 smooths it into a lattice. */
export function exomuxNoiseTexture(size: number, zoom: number, random: () => number): ExomuxNoiseTexture {
  const data = new Uint8Array(size * size * 4);
  // MilkDrop narrows the range for smoothed variants so interpolation overshoot
  // cannot clip, then re-centres it.
  const range = zoom > 1 ? 216 : 256;
  const half = range * 0.5;
  for (let index = 0; index < size * size; index += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      data[index * 4 + channel] = Math.floor(random() * range + half) & 0xff;
    }
  }
  if (zoom > 1) {
    for (let y = 0; y < size; y += zoom) {
      smoothAxis(data, size, zoom, size, (x) => y * size + x, 1);
    }
    for (let x = 0; x < size; x += 1) {
      smoothAxis(data, size, zoom, size, (y) => y * size + x, size);
    }
  }
  return { size, depth: 1, data };
}

/** Builds one 3-D noise volume; `zoom` above 1 smooths it along all three axes. */
export function exomuxNoiseVolume(size: number, zoom: number, random: () => number): ExomuxNoiseTexture {
  const data = new Uint8Array(size * size * size * 4);
  const range = zoom > 1 ? 216 : 256;
  const half = range * 0.5;
  for (let index = 0; index < size * size * size; index += 1) {
    for (let channel = 0; channel < 4; channel += 1) {
      data[index * 4 + channel] = Math.floor(random() * range + half) & 0xff;
    }
  }
  if (zoom > 1) {
    const slice = size * size;
    for (let z = 0; z < size; z += zoom) {
      for (let y = 0; y < size; y += zoom) {
        smoothAxis(data, size, zoom, size, (x) => z * slice + y * size + x, 1);
      }
    }
    for (let z = 0; z < size; z += zoom) {
      for (let x = 0; x < size; x += 1) {
        smoothAxis(data, size, zoom, size, (y) => z * slice + y * size + x, size);
      }
    }
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        smoothAxis(data, size, zoom, size, (z) => z * slice + y * size + x, slice);
      }
    }
  }
  return { size, depth: size, data };
}

/** The full set of noise textures, keyed by the sampler name that reads them. */
export interface ExomuxNoiseSet {
  readonly noise_lq: ExomuxNoiseTexture;
  readonly noise_lq_lite: ExomuxNoiseTexture;
  readonly noise_mq: ExomuxNoiseTexture;
  readonly noise_hq: ExomuxNoiseTexture;
  readonly noisevol_lq: ExomuxNoiseTexture;
  readonly noisevol_hq: ExomuxNoiseTexture;
}

/**
 * Builds every noise texture at the sizes and zooms Butterchurn uses.
 *
 * The volumes are 32³ rather than MilkDrop's larger tables: that is what
 * Butterchurn itself ships, and it keeps generation to a few milliseconds.
 */
export function exomuxNoiseSet(random: () => number): ExomuxNoiseSet {
  return {
    noise_lq: exomuxNoiseTexture(256, 1, random),
    noise_lq_lite: exomuxNoiseTexture(32, 1, random),
    noise_mq: exomuxNoiseTexture(256, 4, random),
    noise_hq: exomuxNoiseTexture(256, 8, random),
    noisevol_lq: exomuxNoiseVolume(32, 1, random),
    noisevol_hq: exomuxNoiseVolume(32, 4, random),
  };
}
