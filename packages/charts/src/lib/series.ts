/** Pure helpers for multi-series charts: stacking, sparklines and diverging domains. */
import type { Pt } from "./smooth";

export interface StackBand {
  /** Bottom edge per index (value units). */
  lower: number[];
  /** Top edge per index (value units). */
  upper: number[];
}

/**
 * Stacks series index by index: positive values build up from zero in series order, negative values build down from
 * zero (so a card debt sits under the axis instead of eating into the savings above it). `lower` <= `upper` always.
 */
export function stackSeries(series: readonly (readonly number[])[]): {
  bands: StackBand[];
  min: number;
  max: number;
} {
  const length = series.reduce((m, s) => Math.max(m, s.length), 0);
  const up = new Array<number>(length).fill(0);
  const down = new Array<number>(length).fill(0);
  let min = 0;
  let max = 0;
  const bands = series.map((values) => {
    const lower: number[] = [];
    const upper: number[] = [];
    for (let i = 0; i < length; i++) {
      const v = values[i] ?? 0;
      if (v >= 0) {
        lower.push(up[i]!);
        up[i] = up[i]! + v;
        upper.push(up[i]!);
        max = Math.max(max, up[i]!);
      } else {
        upper.push(down[i]!);
        down[i] = down[i]! + v;
        lower.push(down[i]!);
        min = Math.min(min, down[i]!);
      }
    }
    return { lower, upper };
  });
  return { bands, min, max };
}

/** Points for a sparkline of `values` filling width x height (inset by `pad`); a flat series sits mid-height. */
export function sparkPoints(
  values: readonly number[],
  width: number,
  height: number,
  pad = 2,
): Pt[] {
  const n = values.length;
  if (n === 0 || width <= 0 || height <= 0) return [];
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values);
  const span = hi - lo;
  const usable = Math.max(0, height - pad * 2);
  return values.map((v, i) => {
    const x = n === 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2);
    const y = span <= 0 ? height / 2 : pad + usable * (1 - (v - lo) / span);
    return [x, y] as const;
  });
}

/**
 * A symmetric domain around zero for diverging bars: the larger side sets both halves, so the biggest change fills
 * its half. There are no gridlines on these charts, so the extent is not rounded.
 */
export function divergingDomain(values: readonly number[]): number {
  return values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
}

/** Length in pt of a diverging bar for `value` in a half-width of `half` pt, with a visible floor for non-zero values. */
export function divergingLength(
  value: number,
  domain: number,
  half: number,
  floor = 2,
): number {
  if (domain <= 0 || value === 0) return 0;
  return Math.max(floor, (Math.min(Math.abs(value), domain) / domain) * half);
}
