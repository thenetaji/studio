import {
  budgetPeriodFor,
  budgetSpent,
  listBudgets,
  type Budget,
} from "@/db/repos/budgets";
import { listCategories } from "@/db/repos/categories";
import { detailedLines } from "@/db/repos/insight-lines";
import { expenseDays, firstEntryDay } from "@/db/repos/spend-days";
import type { CategoryRow } from "@/db/schema";
import type { Db } from "@/db/types";
import {
  addDays,
  previousPeriod,
  type DateKey,
  type Period,
  type PeriodSettings,
} from "@studio/dates";
import {
  peakIndex,
  transactionTotals,
  weekdayAverages,
  type TransactionTotal,
  type WeekdayAverage,
} from "@/lib/insights";
import {
  budgetResult,
  busiestDay,
  categoryChanges,
  comparableRange,
  headline,
  headlineDeltas,
  longestStreak,
  noSpendDays,
  trackedDays,
  whatChanged,
  type BudgetResult,
  type CategoryChange,
  type DayTotal,
  type Headline,
  type HeadlineDeltas,
  type Streak,
} from "@/lib/reports";
import { conversionContext } from "./summary";

export interface ReportCategory extends CategoryChange {
  category: CategoryRow | null;
}

export interface ReportTransaction extends TransactionTotal {
  category: CategoryRow | null;
}

export interface ReportBudget extends BudgetResult {
  id: string;
  name: string;
  amount: number;
  spent: number;
  currency: string;
  period: Period;
  /** The budget's period has ended, so the outcome is final. */
  finished: boolean;
}

export interface MonthReport {
  currency: string;
  period: Period;
  previous: Period;
  /** What is compared with what (month to date against the same days last month while the month runs). */
  compared: ReturnType<typeof comparableRange>;
  current: Headline;
  prior: Headline;
  deltas: HeadlineDeltas;
  /** Spending per category, biggest first; includes categories only spent on last month. */
  categories: ReportCategory[];
  changes: { up: ReportCategory[]; down: ReportCategory[] };
  biggest: ReportTransaction[];
  busiestDay: DayTotal | null;
  /** Average spend per weekday, ordered from the week start. */
  weekdays: WeekdayAverage[];
  peakWeekday: number | null;
  noSpend: {
    days: DateKey[];
    /** Days of the month that have happened and are tracked. */
    tracked: number;
    longest: Streak;
    /** Days of the month with spending. */
    spendDays: DateKey[];
    since: DateKey | null;
  };
  budgets: ReportBudget[];
  /** Expense and income transactions this month. */
  transactionCount: number;
  firstEntry: DateKey | null;
}

const BIGGEST = 5;

function readBudgets(db: Db, period: Period, today: DateKey): ReportBudget[] {
  // Mid-month picks the budget period that covers most of this month when the anchors differ.
  const ref =
    addDays(period.from, 14) <= period.to
      ? addDays(period.from, 14)
      : period.from;
  return listBudgets(db)
    .filter((b: Budget) => b.period === "monthly")
    .map((budget) => {
      const p = budgetPeriodFor(budget, ref);
      const spent = budgetSpent(db, budget, p);
      return {
        id: budget.id,
        name: budget.name,
        amount: budget.amount,
        spent,
        currency: budget.currency,
        period: p,
        finished: p.to < today,
        ...budgetResult(spent, budget.amount),
      };
    });
}

/** Everything the monthly report shows for the month `period`. */
export function readMonthReport(
  db: Db,
  period: Period,
  settings: PeriodSettings,
  today: DateKey,
): MonthReport {
  const ctx = conversionContext(db);
  const previous = previousPeriod(period);
  const compared = comparableRange(period, previous, today);
  const lines = detailedLines(db, { from: previous.from, to: period.to });
  const categories = new Map(
    listCategories(db, undefined, { includeArchived: true }).map((c) => [
      c.id,
      c,
    ]),
  );
  const withCategory = <T extends { categoryId: string | null }>(row: T) => ({
    ...row,
    category: row.categoryId ? (categories.get(row.categoryId) ?? null) : null,
  });

  const current = headline(lines, compared.current, ctx);
  const prior = headline(lines, compared.previous, ctx);
  const changes = categoryChanges(
    lines,
    compared.current,
    compared.previous,
    ctx,
  ).map(withCategory);
  const what = whatChanged(changes, 3);
  const transactions = transactionTotals(lines, "expense", period, ctx);
  const weekdays = weekdayAverages(
    lines,
    "expense",
    period,
    settings.weekStart,
    ctx,
    today,
  );

  const since = firstEntryDay(db);
  const spendDays = expenseDays(db, period.from, period.to);
  const input = { spendDays: new Set(spendDays), since, today };
  const ids = new Set<string>();
  for (const line of lines)
    if (line.dateKey >= period.from && line.dateKey <= period.to)
      ids.add(line.transactionId);

  return {
    currency: ctx.displayCurrency,
    period,
    previous,
    compared,
    current,
    prior,
    deltas: headlineDeltas(current, prior),
    categories: changes,
    changes: what,
    biggest: transactions.slice(0, BIGGEST).map(withCategory),
    busiestDay: busiestDay(lines, period, ctx),
    weekdays,
    peakWeekday: peakIndex(weekdays.map((d) => d.average)),
    noSpend: {
      days: noSpendDays(period, input),
      tracked: trackedDays(period, input),
      longest: longestStreak(input, period),
      spendDays,
      since,
    },
    budgets: readBudgets(db, period, today),
    transactionCount: ids.size,
    firstEntry: since,
  };
}
