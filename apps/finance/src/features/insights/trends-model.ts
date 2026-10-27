import {
  addDays,
  diffDays,
  previousPeriod,
  type DateKey,
  type Period,
} from "@studio/dates";
import {
  convertLine,
  type ConversionContext,
  type FlatLine,
} from "@/lib/insights";

type Range = { from: DateKey; to: DateKey };
type Kind = FlatLine["kind"];

/** Key for a category id in maps and lists; uncategorised lines share one key. */
export const categoryKeyOf = (id: string | null): string => id ?? "none";

/** The `count` periods ending with `period`, oldest first, all of the same type and length. */
export function trailingPeriods(period: Period, count: number): Period[] {
  const out: Period[] = [period];
  while (out.length < count) out.unshift(previousPeriod(out[0]!));
  return out;
}

export interface ComparableRanges {
  current: Range;
  previous: Range;
  /** True when the period is still running and both ranges were cut at today's offset. */
  partial: boolean;
}

/**
 * Like-for-like ranges for "this period vs the previous one of the same length". While the period is still running,
 * both are cut at the same day offset (1-26 Oct against 1-26 Sep), so a half-finished month is not compared with a
 * whole one.
 */
export function comparableRanges(
  period: Period,
  today: DateKey,
): ComparableRanges {
  const previous = previousPeriod(period);
  if (today < period.from || today >= period.to)
    return {
      current: { from: period.from, to: period.to },
      previous: { from: previous.from, to: previous.to },
      partial: false,
    };
  const offset = diffDays(period.from, today);
  const cut = addDays(previous.from, offset);
  return {
    current: { from: period.from, to: today },
    previous: { from: previous.from, to: cut < previous.to ? cut : previous.to },
    partial: true,
  };
}

/** Sum per category of `kind` lines inside `range`, converted to the display currency. */
export function totalsByCategory(
  lines: readonly FlatLine[],
  kind: Kind,
  range: Range,
  ctx: ConversionContext,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of lines) {
    if (line.kind !== kind || line.dateKey < range.from || line.dateKey > range.to)
      continue;
    const key = categoryKeyOf(line.categoryId);
    out.set(key, (out.get(key) ?? 0) + convertLine(line, ctx));
  }
  return out;
}

export type TrendDirection = "up" | "down" | "flat" | "new";

/** Whole-percent change, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) * 100) / previous);
}

export function directionOf(current: number, previous: number): TrendDirection {
  if (previous <= 0) return current > 0 ? "new" : "flat";
  const percent = percentChange(current, previous) ?? 0;
  if (percent === 0) return "flat";
  return percent > 0 ? "up" : "down";
}

export interface CategoryTrend {
  categoryId: string | null;
  /** This period so far (or whole, when it has ended). */
  current: number;
  /** The previous period over the same stretch of days. */
  previous: number;
  delta: number;
  percent: number | null;
  direction: TrendDirection;
  /** Mean of the three whole periods before this one; null when all three are empty. */
  average: number | null;
  /** One total per period, oldest first, ending with this one (sparkline). */
  spark: number[];
}

/** Lines needed by `categoryTrends`: from the start of the oldest spark period to the end of this one. */
export function trendsRange(period: Period, sparkCount = 6): Range {
  const periods = trailingPeriods(period, Math.max(sparkCount, 4));
  return { from: periods[0]!.from, to: period.to };
}

/** Mean in integer minor units, rounded half up. */
const mean = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : Math.floor(
        (values.reduce((s, v) => s + v, 0) * 2 + values.length) /
          (values.length * 2),
      );

/**
 * Each category against the previous period (like for like) and its three-period average, with a sparkline of the
 * last `sparkCount` periods. Keyed by `categoryKeyOf(id)`.
 */
export function categoryTrends(
  lines: readonly FlatLine[],
  kind: Kind,
  period: Period,
  today: DateKey,
  ctx: ConversionContext,
  sparkCount = 6,
): Map<string, CategoryTrend> {
  const periods = trailingPeriods(period, Math.max(sparkCount, 4));
  const perPeriod = periods.map((p) => totalsByCategory(lines, kind, p, ctx));
  const ranges = comparableRanges(period, today);
  const current = totalsByCategory(lines, kind, ranges.current, ctx);
  const previous = totalsByCategory(lines, kind, ranges.previous, ctx);
  const keys = new Set<string>();
  for (const m of perPeriod) for (const k of m.keys()) keys.add(k);
  const out = new Map<string, CategoryTrend>();
  const last = periods.length - 1;
  for (const key of keys) {
    const c = current.get(key) ?? 0;
    const p = previous.get(key) ?? 0;
    const before = [last - 3, last - 2, last - 1].map(
      (i) => perPeriod[i]?.get(key) ?? 0,
    );
    out.set(key, {
      categoryId: key === "none" ? null : key,
      current: c,
      previous: p,
      delta: c - p,
      percent: percentChange(c, p),
      direction: directionOf(c, p),
      average: before.some((v) => v > 0) ? mean(before) : null,
      spark: perPeriod
        .slice(-sparkCount)
        .map((m) => m.get(key) ?? 0),
    });
  }
  return out;
}

export interface ComparisonRow {
  categoryId: string | null;
  current: number;
  previous: number;
  /** current minus previous. */
  delta: number;
}

export interface Comparison {
  ranges: ComparableRanges;
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
  /** Every category that moved, largest increase first and largest decrease last. */
  rows: ComparisonRow[];
}

/** Totals and per-category differences between this period and the previous one of the same length. */
export function comparePeriods(
  lines: readonly FlatLine[],
  kind: Kind,
  period: Period,
  today: DateKey,
  ctx: ConversionContext,
): Comparison {
  const ranges = comparableRanges(period, today);
  const now = totalsByCategory(lines, kind, ranges.current, ctx);
  const before = totalsByCategory(lines, kind, ranges.previous, ctx);
  const keys = new Set([...now.keys(), ...before.keys()]);
  const rows: ComparisonRow[] = [];
  let current = 0;
  let previous = 0;
  for (const key of keys) {
    const c = now.get(key) ?? 0;
    const p = before.get(key) ?? 0;
    current += c;
    previous += p;
    if (c !== p)
      rows.push({
        categoryId: key === "none" ? null : key,
        current: c,
        previous: p,
        delta: c - p,
      });
  }
  rows.sort(
    (a, b) =>
      b.delta - a.delta ||
      b.current - a.current ||
      categoryKeyOf(a.categoryId).localeCompare(categoryKeyOf(b.categoryId)),
  );
  return {
    ranges,
    current,
    previous,
    delta: current - previous,
    percent: percentChange(current, previous),
    rows,
  };
}

/**
 * The rows worth drawing: the `limit` largest moves by size, kept in increase-to-decrease order so the chart reads
 * from the biggest rise at the top to the biggest fall at the bottom.
 */
export function topMoves(
  rows: readonly ComparisonRow[],
  limit: number,
): ComparisonRow[] {
  if (rows.length <= limit) return [...rows];
  const keep = new Set(
    [...rows]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, limit),
  );
  return rows.filter((r) => keep.has(r));
}
