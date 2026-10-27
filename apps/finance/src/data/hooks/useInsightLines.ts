import { listAccounts } from "@/db/repos/accounts";
import { listCategories } from "@/db/repos/categories";
import { detailedLines } from "@/db/repos/insight-lines";
import type { AccountRow, CategoryRow } from "@/db/schema";
import { useLiveData } from "@/data/use-live-data";
import {
  scopeKey,
  type ConversionContext,
  type DetailedLine,
  type InsightsScope,
} from "@/lib/insights";
import { conversionContext } from "./summary";

export interface InsightLines {
  /** Display currency and rates; convert each line with `convertLine`. */
  ctx: ConversionContext;
  /** Every expense and income line (split lines on their own) in the range, unconverted. */
  lines: DetailedLine[];
  /** Every category and account, archived included, by id. */
  categories: ReadonlyMap<string, CategoryRow>;
  accounts: ReadonlyMap<string, AccountRow>;
}

/**
 * Raw spend lines for a date range, for the Insights models (category trends, period comparison, payees, monthly
 * cash flow) that do their own maths in `features/insights`.
 */
export function useInsightLines(
  range: { from: string; to: string },
  scope?: InsightsScope,
): InsightLines {
  return useLiveData(
    [
      "transactions",
      "transaction_splits",
      "transaction_tags",
      "categories",
      "accounts",
      "fx_rates",
      "settings",
    ],
    `${range.from}:${range.to}:${scopeKey(scope)}`,
    (db) => ({
      ctx: conversionContext(db),
      lines: detailedLines(db, range, scope),
      categories: new Map(
        listCategories(db, undefined, { includeArchived: true }).map((c) => [
          c.id,
          c,
        ]),
      ),
      accounts: new Map(
        listAccounts(db, { includeArchived: true }).map((a) => [a.id, a]),
      ),
    }),
  );
}
