import { and, asc, eq, inArray, or } from "drizzle-orm";

import { transactions } from "../schema";
import type { Db } from "../types";

/** An account refilled by transfers, e.g. Cash topped up from Salary. Amounts in the pocket account's minor units. */
export interface Pocket {
  accountId: string;
  amount: number;
  fromAccountId: string | null;
}

export interface PocketStatus {
  /** Last transfer into the pocket; null before the first refill. */
  refill: number | null;
  refilledAt: number | null;
  /** What the pocket held right after that refill: the refill plus any leftover. */
  total: number;
  /** Money that left the pocket since that refill. */
  spent: number;
  left: number;
}

const OUTFLOW = ["expense", "lent", "repaid_by_me", "transfer"] as const;

/** Walks refills and spends in time order; leftover carries into the next refill, overspending floors at zero. */
export function pocketStatus(db: Db, accountId: string): PocketStatus {
  const rows = db
    .select({
      kind: transactions.kind,
      accountId: transactions.accountId,
      amount: transactions.amount,
      transferAmount: transactions.transferAmount,
      at: transactions.occurredAt,
    })
    .from(transactions)
    .where(
      or(
        and(
          eq(transactions.kind, "transfer"),
          eq(transactions.transferAccountId, accountId),
        ),
        and(
          eq(transactions.accountId, accountId),
          inArray(transactions.kind, [...OUTFLOW]),
        ),
      ),
    )
    .orderBy(asc(transactions.occurredAt), asc(transactions.createdAt))
    .all();
  const status: PocketStatus = {
    refill: null,
    refilledAt: null,
    total: 0,
    spent: 0,
    left: 0,
  };
  for (const row of rows) {
    if (row.kind === "transfer" && row.accountId !== accountId) {
      const amount = row.transferAmount ?? row.amount;
      status.left += amount;
      status.total = status.left;
      status.refill = amount;
      status.refilledAt = row.at;
      status.spent = 0;
    } else if (status.refill !== null) {
      status.left = Math.max(0, status.left - row.amount);
      status.spent += row.amount;
    }
  }
  return status;
}

/** Keeps well-formed entries, one per account. */
export function normalizePockets(value: unknown): Pocket[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: Pocket[] = [];
  for (const entry of value) {
    const p = entry as Partial<Pocket> | null;
    if (
      !p ||
      typeof p.accountId !== "string" ||
      seen.has(p.accountId) ||
      !Number.isInteger(p.amount) ||
      (p.amount ?? 0) <= 0
    )
      continue;
    seen.add(p.accountId);
    out.push({
      accountId: p.accountId,
      amount: p.amount as number,
      fromAccountId:
        typeof p.fromAccountId === "string" ? p.fromAccountId : null,
    });
  }
  return out;
}
