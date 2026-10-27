/** Pure geometry and formatting for the Home spend curve and header. */

import { monotoneSegments, type Pt, type Segment } from "@studio/charts/lib";

export { monotoneSegments };
export type { Pt, Segment };

export interface CurveInput {
  actual: number | null;
  pace: number;
}

export interface CurveGeometry {
  line: Pt[];
  ghost: Pt[];
  /** Last point of the current line (the end-dot). */
  end: Pt | null;
  peak: number;
}

/**
 * Points for both lines. Each line starts at (0, baseline) so day 1's jump reads as a climb; day i of N sits at
 * x = i / N * width, so the last day reaches the right edge.
 */
export function curveGeometry(
  series: readonly CurveInput[],
  width: number,
  height: number,
  pad = 6,
): CurveGeometry {
  const days = series.length;
  const peak = series.reduce((m, d) => Math.max(m, d.pace, d.actual ?? 0), 0);
  if (days === 0 || peak <= 0 || width <= 0)
    return { line: [], ghost: [], end: null, peak };
  const max = peak * 1.08;
  const x = (i: number) => (i / days) * width;
  const y = (v: number) => pad + (height - pad) * (1 - v / max);
  const ghost: Pt[] = [
    [0, y(0)],
    ...series.map((d, i) => [x(i + 1), y(d.pace)] as const),
  ];
  const line: Pt[] = [[0, y(0)]];
  series.forEach((d, i) => {
    if (d.actual !== null) line.push([x(i + 1), y(d.actual)]);
  });
  return {
    line,
    ghost,
    end: line.length > 1 ? line[line.length - 1]! : null,
    peak,
  };
}

/** "Good morning" 05:00-11:59, "Good afternoon" 12:00-16:59, otherwise "Good evening" (no "Good night"). */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Whole percent of a budget used, clamped at 0. */
export function percentUsed(spent: number, amount: number): number {
  return amount > 0 ? Math.max(0, Math.round((spent / amount) * 100)) : 0;
}

/** Bar width as a share of the largest value (0-1), so the top row fills the bar. Falls back to percent when needed. */
export function shareWidth(percent: number): number {
  return Math.min(Math.max(percent, 0), 100) / 100;
}

/** "Monthly", "Every 2 weeks". */
export function frequencyLabel(frequency: string, interval: number): string {
  const adverb: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };
  const unit: Record<string, string> = {
    daily: "days",
    weekly: "weeks",
    monthly: "months",
    yearly: "years",
  };
  if (interval <= 1) return adverb[frequency] ?? frequency;
  return `Every ${interval} ${unit[frequency] ?? frequency}`;
}

/** "in 4 days", "Tomorrow", "Today". */
export function dueIn(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

/**
 * Spent so far minus the reference at the same day (today is the last `actual` entry): negative when under the
 * budget pace or last month. Null when either line is missing.
 */
export function paceDelta(
  actual: readonly number[],
  reference: readonly number[],
): number | null {
  if (actual.length === 0 || reference.length === 0) return null;
  const today = actual.length - 1;
  const ref = reference[Math.min(today, reference.length - 1)] ?? 0;
  return (actual[today] ?? 0) - ref;
}
