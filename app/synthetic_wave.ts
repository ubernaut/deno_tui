export function waveSeries(length: number, phase: number, frequency: number, offset: number, scale = 1): number[] {
  const series = new Array<number>(length);
  for (let index = 0; index < length; index++) {
    series[index] = unitWave(phase + index, frequency, offset) * scale;
  }
  return series;
}

export function unitWave(value: number, frequency: number, offset: number): number {
  return Math.max(
    0,
    Math.min(
      1,
      0.5 +
        Math.sin(value * frequency + offset) * 0.34 +
        Math.cos(value * (frequency * 0.37) + offset * 2.1) * 0.16,
    ),
  );
}

export function stringSeed(value: string): number {
  let seed = 0;
  for (let index = 0; index < value.length; index += 1) {
    seed += value.charCodeAt(index);
  }
  return seed;
}
