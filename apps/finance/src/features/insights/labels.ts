import {
  monthName,
  monthShort,
  parseKey,
  periodLength,
  previousPeriod,
  type Period,
} from "@studio/dates";
import { MINUS, formatMoney, minorDigits } from "@studio/money";
import { shortDay } from "@studio/charts/lib";
import type { Delta, Granularity, SeriesPoint } from "@/lib/insights";

import type { InsightsKind } from "./params";

/** "vs September", "vs last week", "vs 2025". */
export function previousLabel(period: Period): string {
  const previous = previousPeriod(period);
  switch (period.type) {
    case "week":
      return "vs last week";
    case "month":
      return `vs ${monthName(parseKey(previous.from).month)}`;
    case "year":
      return `vs ${parseKey(previous.from).year}`;
    case "custom":
      return "vs previous period";
  }
}

export interface DeltaLine {
  text: string;
  /** The same change in money ("−₹12,196 vs September"); present when `deltaLine` was given a currency. */
  alt?: string;
  /** True when the change is the good direction: spending fell or income rose. */
  good: boolean;
}

/** "−12% vs September". Null when there is nothing to compare with. */
export function deltaLine(
  delta: Delta,
  period: Period,
  kind: InsightsKind,
  money?: { currency: string; locale?: string },
): DeltaLine | null {
  if (delta.percent === null) return null;
  const suffix = previousLabel(period);
  if (delta.percent === 0) return { text: `No change ${suffix}`, good: false };
  const sign = delta.percent < 0 ? MINUS : "+";
  const good = kind === "income" ? delta.percent > 0 : delta.percent < 0;
  const alt = money
    ? `${sign}${formatMoney(Math.abs(delta.amount), money.currency, { locale: money.locale, decimals: 0 })} ${suffix}`
    : undefined;
  return { text: `${sign}${Math.abs(delta.percent)}% ${suffix}`, alt, good };
}

/** "Tue 7 · ₹1,240" for days, "Oct · ₹12,400" for months. */
export function scrubLabel(
  point: SeriesPoint,
  granularity: Granularity,
  currency: string,
  locale?: string,
): string {
  const amount = formatMoney(point.amount, currency, { locale, decimals: 0 });
  const when =
    granularity === "day"
      ? shortDay(point.key)
      : monthShort(parseKey(point.key).month);
  return `${when} · ${amount}`;
}

/** Heading for the bar card. */
export function barsTitle(
  granularity: Granularity,
  kind: InsightsKind,
): string {
  const noun = kind === "income" ? "income" : "spending";
  return granularity === "day" ? `Daily ${noun}` : `Monthly ${noun}`;
}

/** Label under a mini bar: "5 Oct" for weeks and custom, "Oct" for months, "2026" for years. */
export function trendLabel(period: Period): string {
  const { day, month, year } = parseKey(period.from);
  if (period.type === "year") return String(year);
  if (period.type === "month") return monthShort(month);
  return `${day} ${monthShort(month)}`;
}

/** "month", "week", "year" for "Average per …". */
export function periodNoun(period: Period): string {
  if (period.type === "custom") return `${periodLength(period)} days`;
  return period.type;
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_PLURAL = [
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
  "Sundays",
];

/** "Sat" for weekday 6 (1 = Monday). */
export const weekdayShort = (day: number): string =>
  WEEKDAY_SHORT[day - 1] ?? "";

/** "Most on Saturdays". */
export function peakCaption(day: number): string {
  return `Most on ${WEEKDAY_PLURAL[day - 1] ?? ""}`;
}

/** "61%", "−12%", or an em dash when there is no rate. */
export function percentText(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate < 0 ? MINUS : ""}${Math.abs(rate)}%`;
}

/** "Sep · In ₹1.45L · Out ₹57.6K · Net ₹87.4K". */
export function monthlyScrub(
  pair: { key: string; income: number; spent: number },
  currency: string,
  locale?: string,
): string {
  const compact = (value: number) =>
    formatMoney(value, currency, { compact: true, locale });
  return `${monthShort(parseKey(pair.key).month)} · In ${compact(pair.income)} · Out ${compact(pair.spent)} · Net ${compact(pair.income - pair.spent)}`;
}

/** Full amount below 10,000 major units, compact above, so scrub labels stay short. */
export function flowAmount(
  minor: number,
  currency: string,
  locale?: string,
  sign: "none" | "auto" = "none",
): string {
  const big = Math.abs(minor) >= 10_000 * 10 ** minorDigits(currency);
  return formatMoney(minor, currency, {
    locale,
    sign,
    compact: big,
    decimals: big ? undefined : 0,
  });
}

/** "Tue 7 · In ₹0 · Out ₹1,240 · Net −₹1,240". */
export function flowScrub(
  point: { key: string; income: number; spent: number },
  granularity: Granularity,
  currency: string,
  locale?: string,
): string {
  const when =
    granularity === "day"
      ? shortDay(point.key)
      : monthShort(parseKey(point.key).month);
  return `${when} · In ${flowAmount(point.income, currency, locale)} · Out ${flowAmount(point.spent, currency, locale)} · Net ${flowAmount(point.income - point.spent, currency, locale, "auto")}`;
}

/** Row badge for a category's trend: arrow, short text, whether it is welcome, and a spoken summary. */
export function trendBadge(
  trend: {
    direction: "up" | "down" | "flat" | "new";
    percent: number | null;
    average: number | null;
    spark: readonly number[];
  },
  kind: "expense" | "income",
  previousName: string,
  money: { currency: string; locale?: string },
): {
  spark: readonly number[];
  text: string;
  arrow: "up" | "down" | null;
  good: boolean;
  speech: string;
} {
  const average =
    trend.average === null
      ? ""
      : `, 3 period average ${formatMoney(trend.average, money.currency, { locale: money.locale, decimals: 0 })}`;
  const { direction, percent } = trend;
  if (direction === "new")
    return {
      spark: trend.spark,
      text: "New",
      arrow: null,
      good: false,
      speech: `new since ${previousName}${average}`,
    };
  if (direction === "flat" || percent === null)
    return {
      spark: trend.spark,
      text: "Same",
      arrow: null,
      good: false,
      speech: `same as ${previousName}${average}`,
    };
  const size = Math.abs(percent);
  const text = size > 999 ? ">999%" : `${size}%`;
  return {
    spark: trend.spark,
    text,
    arrow: direction,
    good: kind === "expense" ? direction === "down" : direction === "up",
    speech: `${direction} ${size} percent on ${previousName}${average}`,
  };
}

/** What the previous period is called in running text: "September", "last week", "2025", "the previous 30 days". */
export function previousName(period: Period): string {
  const previous = previousPeriod(period);
  switch (period.type) {
    case "week":
      return "last week";
    case "month":
      return parseKey(previous.from).day === 1
        ? monthName(parseKey(previous.from).month)
        : "last month";
    case "year":
      return String(parseKey(previous.from).year);
    case "custom":
      return `the previous ${periodLength(period)} days`;
  }
}
