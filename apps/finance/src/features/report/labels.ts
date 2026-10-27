import {
  addMonths,
  makeKey,
  monthName,
  monthShort,
  parseKey,
  periodFor,
  type DateKey,
  type Period,
  type PeriodSettings,
} from "@studio/dates";
import { MINUS } from "@studio/money";

import { rangeText } from "@/features/calendar/no-spend-labels";

const MONTH_PARAM = /^(\d{4})-(\d{2})$/;

/**
 * The month period a `/report/[month]` param names. `YYYY-MM` is the period that starts in that month
 * (with a custom month start of the 25th, `2026-10` is 25 Oct – 24 Nov); `current` is the running month and
 * `last` the one before it. Anything else falls back to the current month. Never later than the current month.
 */
export function reportPeriod(
  param: string | undefined,
  today: DateKey,
  settings: PeriodSettings,
): Period {
  const current = periodFor("month", today, settings);
  if (param === "last")
    return periodFor("month", addMonths(current.from, -1), settings);
  const match = param ? MONTH_PARAM.exec(param) : null;
  if (!match) return current;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return current;
  const period = periodFor(
    "month",
    makeKey(Number(match[1]), month, settings.monthStart),
    settings,
  );
  return period.from > current.from ? current : period;
}

/** `YYYY-MM` for a month period, the inverse of `reportPeriod`. */
export function monthParam(period: Period): string {
  return period.from.slice(0, 7);
}

/** "September" for the month a period starts in. */
export function monthOfPeriod(period: Period): string {
  return monthName(parseKey(period.from).month);
}

/** "Sep". */
export function shortMonthOfPeriod(period: Period): string {
  return monthShort(parseKey(period.from).month);
}

/** "+12%", "−12%", "No change"; null when there is nothing to compare with. */
export function percentChange(percent: number | null): string | null {
  if (percent === null) return null;
  if (percent === 0) return "No change";
  return `${percent < 0 ? MINUS : "+"}${Math.abs(percent)}%`;
}

/** "+4 pts", "−4 pts", "No change"; null when either rate is missing. */
export function pointsChange(points: number | null): string | null {
  if (points === null) return null;
  if (points === 0) return "No change";
  return `${points < 0 ? MINUS : "+"}${Math.abs(points)} pts`;
}

/** "Compared with September", or "1–26 Oct compared with 1–26 Sep" while the month is running. */
export function comparedNote(compared: {
  current: { from: DateKey; to: DateKey };
  previous: { from: DateKey; to: DateKey };
  partial: boolean;
}): string {
  if (!compared.partial)
    return `Compared with ${monthName(parseKey(compared.previous.from).month)}`;
  return `${rangeText(compared.current.from, compared.current.to)} compared with ${rangeText(compared.previous.from, compared.previous.to)}`;
}

/** Savings rate as text: "34%", "−12%", or an em dash when nothing was earned. */
export function rateText(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate < 0 ? MINUS : ""}${Math.abs(rate)}%`;
}
