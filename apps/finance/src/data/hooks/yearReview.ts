import { listCategories } from "@/db/repos/categories";
import { detailedLines } from "@/db/repos/insight-lines";
import { expenseDays, firstEntryDay } from "@/db/repos/spend-days";
import type { CategoryRow } from "@/db/schema";
import type { Db } from "@/db/types";
import type { DateKey } from "@studio/dates";
import {
  biggest,
  categoryTotals,
  savingsRate,
  sumLines,
  topTitles,
  type CategoryTotal,
  type TitleTotal,
  type TransactionTotal,
} from "@/lib/insights";
import {
  biggestMonth,
  elapsedYear,
  entryCount,
  longestStreak,
  monthlyTotals,
  mostFrequentTitle,
  noSpendDays,
  trackedDays,
  yearPeriod,
  type MonthTotal,
  type Streak,
} from "@/lib/reports";
import { conversionContext } from "./summary";

type WithCategory<T> = T & { category: CategoryRow | null };

export interface YearReview {
  year: number;
  currency: string;
  /** The part of the year that has happened, or null for a future year. */
  range: { from: DateKey; to: DateKey } | null;
  /** True while the year is still running. */
  partial: boolean;
  spent: number;
  earned: number;
  savingsRate: number | null;
  /** Expense and income entries. */
  entries: number;
  months: MonthTotal[];
  biggestMonth: number | null;
  /** Spending by category, biggest first. */
  categories: WithCategory<CategoryTotal>[];
  topPayee: WithCategory<TitleTotal> | null;
  mostFrequent: WithCategory<TitleTotal> | null;
  biggestPurchase: WithCategory<TransactionTotal> | null;
  noSpend: {
    days: number;
    tracked: number;
    longest: Streak;
    /** Days of the year with spending. */
    spendDays: DateKey[];
    since: DateKey | null;
  };
}

export function readYearReview(
  db: Db,
  year: number,
  today: DateKey,
): YearReview {
  const ctx = conversionContext(db);
  const whole = yearPeriod(year);
  const range = elapsedYear(year, today);
  const lines = detailedLines(db, whole);
  const categories = new Map(
    listCategories(db, undefined, { includeArchived: true }).map((c) => [
      c.id,
      c,
    ]),
  );
  const withCategory = <T extends { categoryId: string | null }>(
    row: T,
  ): WithCategory<T> => ({
    ...row,
    category: row.categoryId ? (categories.get(row.categoryId) ?? null) : null,
  });
  const spent = sumLines(lines, "expense", whole, ctx);
  const earned = sumLines(lines, "income", whole, ctx);
  const months = monthlyTotals(lines, year, ctx);
  const top = topTitles(lines, "expense", whole, ctx, 1)[0];
  const frequent = mostFrequentTitle(lines, "expense", whole, ctx);
  const big = biggest(lines, "expense", whole, ctx);

  const since = firstEntryDay(db);
  const spendDays = expenseDays(db, whole.from, whole.to);
  const input = { spendDays: new Set(spendDays), since, today };
  return {
    year,
    currency: ctx.displayCurrency,
    range,
    partial: range !== null && range.to < whole.to,
    spent,
    earned,
    savingsRate: savingsRate(earned, spent),
    entries: entryCount(lines, whole),
    months,
    biggestMonth: biggestMonth(months),
    categories: categoryTotals(lines, "expense", whole, ctx).map(withCategory),
    topPayee: top ? withCategory(top) : null,
    mostFrequent: frequent ? withCategory(frequent) : null,
    biggestPurchase: big ? withCategory(big) : null,
    noSpend: {
      days: noSpendDays(whole, input).length,
      tracked: trackedDays(whole, input),
      longest: longestStreak(input, whole),
      spendDays,
      since,
    },
  };
}
