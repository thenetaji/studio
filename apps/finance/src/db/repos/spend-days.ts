import { and, asc, between, eq, isNull, lte, min } from "drizzle-orm";
import type { DateKey } from "@studio/dates";
import { occurrencesBetween } from "@/lib/recurring";
import { recurringRules, transactions } from "../schema";
import type { Db } from "../types";

/** Days in [from, to] with at least one expense (a split expense counts once). Transfers and lending never count. */
export function expenseDays(db: Db, from: DateKey, to: DateKey): DateKey[] {
  return db
    .selectDistinct({ dateKey: transactions.dateKey })
    .from(transactions)
    .where(
      and(
        eq(transactions.kind, "expense"),
        between(transactions.dateKey, from, to),
      ),
    )
    .orderBy(asc(transactions.dateKey))
    .all()
    .map((r) => r.dateKey);
}

/** The earliest day with any entry, or null when there are none. */
export function firstEntryDay(db: Db): DateKey | null {
  const row = db
    .select({ first: min(transactions.dateKey) })
    .from(transactions)
    .get();
  return row?.first ?? null;
}

export interface BillDue {
  ruleId: string;
  title: string;
  dueDate: DateKey;
  amount: number;
  currency: string;
  categoryId: string | null;
}

const PER_RULE = 62;

/**
 * Expense occurrences of active recurring rules due in [from, to], soonest first. Only occurrences not yet
 * posted are returned (from each rule's next due date onwards); posted ones are already transactions.
 */
export function billsBetween(db: Db, from: DateKey, to: DateKey): BillDue[] {
  const rules = db
    .select()
    .from(recurringRules)
    .where(
      and(
        isNull(recurringRules.pausedAt),
        eq(recurringRules.kind, "expense"),
        lte(recurringRules.nextDue, to),
      ),
    )
    .all();
  const out: BillDue[] = [];
  for (const rule of rules) {
    for (const dueDate of occurrencesBetween(rule, rule.nextDue, to, {
      endDate: rule.endDate,
      limit: PER_RULE,
    })) {
      if (dueDate < from) continue;
      out.push({
        ruleId: rule.id,
        title: rule.title,
        dueDate,
        amount: rule.amount,
        currency: rule.currency,
        categoryId: rule.categoryId,
      });
    }
  }
  return out.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title),
  );
}
