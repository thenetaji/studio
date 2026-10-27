import {
  budgetPeriodFor,
  budgetProgress,
  getBudget,
  type BudgetSpent,
} from "@/db/repos/budgets";
import { getRateLookup } from "@/db/repos/fx";
import { spendLines } from "@/db/repos/reports";
import { paceSeries, type PacePoint } from "@/lib/insights";
import { useLiveData } from "@/data/use-live-data";
import { useTodayKey } from "./useTodayKey";

export interface BudgetDetail extends BudgetSpent {
  /** Cumulative spend per day against an even pace to the available amount, in the budget's currency. */
  pace: PacePoint[];
}

/** One budget measured over the period containing `ref` (a date key; defaults to today). Undefined when it no longer exists. */
export function useBudgetDetail(
  id: string | undefined,
  ref?: string,
): BudgetDetail | undefined {
  const today = useTodayKey();
  const key = ref ?? today;
  return useLiveData(
    [
      "budgets",
      "budget_categories",
      "transactions",
      "transaction_splits",
      "fx_rates",
      "recurring_rules",
    ],
    `${id ?? ""}:${key}:${today}`,
    (db) => {
      const budget = id ? getBudget(db, id) : undefined;
      if (!budget) return undefined;
      const period = budgetPeriodFor(budget, key);
      const progress = budgetProgress(db, budget, period, today);
      const lines = spendLines(db, period);
      const ctx = {
        displayCurrency: budget.currency,
        rates: getRateLookup(db),
      };
      const inScope = (line: { categoryId: string | null }) =>
        budget.scope === "all" ||
        (line.categoryId !== null &&
          budget.categoryIds.includes(line.categoryId));
      return {
        ...progress,
        pace: paceSeries(
          lines,
          period,
          Math.max(0, progress.available),
          today,
          ctx,
          inScope,
        ),
      };
    },
  );
}
