/** Pure geometry for the spend curve: cumulative spend so far (solid) against a reference for the whole period (dotted). */

import { monotoneSegments, type Pt, type Segment } from "./smooth";

export interface SpendCurveGeometry {
  /** (0, baseline) then the end of each elapsed day. */
  actual: Pt[];
  actualSegments: Segment[];
  /** (0, baseline) then the end of every day in the period. */
  reference: Pt[];
  referenceSegments: Segment[];
  /** Today's point on the solid line; null before anything has elapsed. */
  end: Pt | null;
  yMax: number;
}

/** Headroom above the highest value so the end-dot and its ring never touch the top. */
export const SPEND_CURVE_HEADROOM = 1.08;

/**
 * Frame is the whole period: x = 0 at the start of day 1, x = width at the end of the last day, so day i ends at
 * (i + 1) / days * width. y runs from `baseline` (zero) up to `top` (the highest value x headroom).
 */
export function spendCurveGeometry(
  actual: readonly number[],
  reference: readonly number[],
  days: number,
  width: number,
  top: number,
  baseline: number,
): SpendCurveGeometry {
  const peak = Math.max(1, ...actual, ...reference);
  const yMax = peak * SPEND_CURVE_HEADROOM;
  const span = baseline - top;
  const x = (i: number) => (days <= 0 ? 0 : ((i + 1) / days) * width);
  const y = (v: number) => baseline - (Math.max(0, v) / yMax) * span;
  const origin: Pt = [0, baseline];
  const solid: Pt[] = [
    origin,
    ...actual.slice(0, days).map((v, i) => [x(i), y(v)] as const),
  ];
  const dotted: Pt[] = [
    origin,
    ...reference.slice(0, days).map((v, i) => [x(i), y(v)] as const),
  ];
  return {
    actual: solid,
    actualSegments: monotoneSegments(solid),
    reference: dotted,
    referenceSegments: reference.length > 0 ? monotoneSegments(dotted) : [],
    end: actual.length > 0 ? solid[solid.length - 1]! : null,
    yMax,
  };
}

/** The day under an x position (0-based), clamped to the period; -1 when there is no frame. */
export function spendCurveDayAt(
  x: number,
  width: number,
  days: number,
): number {
  if (width <= 0 || days <= 0) return -1;
  return Math.min(days - 1, Math.max(0, Math.floor((x / width) * days)));
}

/** A straight even pace to `total` over `days`: the cumulative target at the end of each day, in whole minor units. */
export function evenPace(total: number, days: number): number[] {
  if (days <= 0) return [];
  return Array.from({ length: days }, (_, i) =>
    Math.round((total * (i + 1)) / days),
  );
}
