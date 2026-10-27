import {
  diffDays,
  type DateKey,
  type Period,
  type PeriodSettings,
} from "@studio/dates";
import {
  monthPeriodsEnding,
  monthlyTotals,
  savingsRate,
  type ConversionContext,
  type FlatLine,
} from "@/lib/insights";

export interface CashFlowMonth {
  /** First day of the month period. */
  key: DateKey;
  from: DateKey;
  to: DateKey;
  income: number;
  spent: number;
  /** income minus spent. */
  net: number;
  /** Whole percent of income kept; null when nothing was earned. */
  rate: number | null;
}

export interface MonthlyCashFlow {
  months: CashFlowMonth[];
  /** The month the selected period ends in (highlighted); -1 when none of the months is it. */
  focusIndex: number;
  income: number;
  spent: number;
  net: number;
  /** Savings rate over all the months together. */
  rate: number | null;
}

const MAX_MONTHS = 24;

/**
 * Which months the cash-flow chart shows for a period: a year shows its twelve months; a long custom range shows the
 * months it spans (up to two years); anything shorter shows six months ending where the period ends (or today, for
 * one still running), so there is a trend to read.
 */
export function cashFlowMonths(
  period: Period,
  today: DateKey,
  settings: PeriodSettings,
): Period[] {
  const end = period.to < today ? period.to : today < period.from ? period.to : today;
  if (period.type === "year") return monthPeriodsEnding(period.to, 12, settings);
  if (period.type === "custom" && diffDays(period.from, period.to) + 1 > 92) {
    const months = monthPeriodsEnding(period.to, MAX_MONTHS, settings);
    return months.filter((m) => m.to >= period.from);
  }
  return monthPeriodsEnding(end, 6, settings);
}

/** Income, spending, net and savings rate for each month, plus the totals across them. */
export function monthlyCashFlow(
  lines: readonly FlatLine[],
  months: readonly Period[],
  period: Period,
  today: DateKey,
  ctx: ConversionContext,
): MonthlyCashFlow {
  const pairs = monthlyTotals(lines, months, ctx);
  const rows = pairs.map((p) => ({
    key: p.key,
    from: p.from,
    to: p.to,
    income: p.income,
    spent: p.spent,
    net: p.income - p.spent,
    rate: savingsRate(p.income, p.spent),
  }));
  const ref = period.to < today ? period.to : today < period.from ? period.to : today;
  const focusIndex =
    period.type === "year" || period.type === "custom"
      ? -1
      : rows.findIndex((m) => ref >= m.from && ref <= m.to);
  const income = rows.reduce((s, m) => s + m.income, 0);
  const spent = rows.reduce((s, m) => s + m.spent, 0);
  return {
    months: rows,
    focusIndex,
    income,
    spent,
    net: income - spent,
    rate: savingsRate(income, spent),
  };
}

/** Lines `monthlyCashFlow` needs for these months. */
export function cashFlowRange(months: readonly Period[]): {
  from: DateKey;
  to: DateKey;
} {
  return {
    from: months[0]?.from ?? "0000-01-01",
    to: months[months.length - 1]?.to ?? "0000-01-01",
  };
}
