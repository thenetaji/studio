import {
  countCategoryUsage,
  transactionCountsByCategory,
} from "@/db/repos/categories";
import { useLiveData } from "@/data/use-live-data";

const USAGE_TABLES = [
  "transactions",
  "transaction_splits",
  "recurring_rules",
  "budget_categories",
] as const;

/** Transactions, split lines, rules and budget scopes that reference the category; 0 means it can go without a move. */
export function useCategoryUsage(id: string | undefined): number {
  return useLiveData(USAGE_TABLES, id ?? "", (db) =>
    id ? countCategoryUsage(db, id) : 0,
  );
}

/** Transaction count per category id (split lines included); categories without any are absent. */
export function useCategoryTransactionCounts(): Record<string, number> {
  return useLiveData(USAGE_TABLES, "counts", transactionCountsByCategory);
}
