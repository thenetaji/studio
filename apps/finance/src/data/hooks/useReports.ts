import type { DateKey, Period, PeriodSettings } from "@studio/dates";
import {
  billsBetween,
  expenseDays,
  firstEntryDay,
  type BillDue,
} from "@/db/repos/spend-days";
import { useLiveData } from "@/data/use-live-data";
import type { NoSpendInput } from "@/lib/reports";
import { readMonthReport, type MonthReport } from "./monthReport";
import { readYearReview, type YearReview } from "./yearReview";

const REPORT_TABLES = [
  "transactions",
  "transaction_splits",
  "categories",
  "budgets",
  "budget_categories",
  "fx_rates",
  "settings",
] as const;

/** The monthly report for the month period `period`. */
export function useMonthReport(
  period: Period,
  settings: PeriodSettings,
  today: DateKey,
): MonthReport {
  return useLiveData(
    REPORT_TABLES,
    `${period.from}:${period.to}:${settings.weekStart}:${today}`,
    (db) => readMonthReport(db, period, settings, today),
  );
}

/** Year in review for a calendar year. */
export function useYearReview(year: number, today: DateKey): YearReview {
  return useLiveData(REPORT_TABLES, `${year}:${today}`, (db) =>
    readYearReview(db, year, today),
  );
}

/**
 * Inputs for no-spend days and streaks: every day with an expense from the first entry to today. See
 * `@/lib/reports/no-spend` for how today counts.
 */
export function useNoSpendInput(today: DateKey): NoSpendInput {
  return useLiveData(["transactions"], today, (db) => {
    const since = firstEntryDay(db);
    return {
      spendDays: new Set(since ? expenseDays(db, since, today) : []),
      since,
      today,
    };
  });
}

/** Unposted expense occurrences of active recurring rules due in [from, to]. */
export function useBillsDue(from: DateKey, to: DateKey): BillDue[] {
  return useLiveData(["recurring_rules"], `${from}:${to}`, (db) =>
    billsBetween(db, from, to),
  );
}

export type {
  MonthReport,
  ReportBudget,
  ReportCategory,
  ReportTransaction,
} from "./monthReport";
export type { YearReview } from "./yearReview";
export type { BillDue } from "@/db/repos/spend-days";
