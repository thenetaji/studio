import {
  and,
  asc,
  between,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
} from "drizzle-orm";
import {
  addDays,
  periodFor,
  weekRange,
  yearRange,
  toDateKey,
  type Period,
} from "@studio/dates";
import { sumLines, type ConversionContext } from "@/lib/insights";
import { rolloverCarry } from "@/lib/budgets/rollover";
import { occurrencesBetween } from "@/lib/recurring";
import { convertWithRates, type RateLookup } from "@studio/money";
import { ValidationError } from "../errors";
import { newId } from "@studio/data";
import {
  budgetCategories,
  budgets,
  recurringRules,
  transactions,
  type BudgetPeriod,
  type BudgetRow,
  type BudgetScope,
} from "../schema";
import type { Db } from "../types";
import { getRateLookup } from "./fx";
import { spendLines } from "./reports";

export interface BudgetInput {
  name?: string;
  amount: number;
  currency: string;
  period: BudgetPeriod;
  /** Weekday 1-7 (weekly), day of month 1-28 (monthly) or month 1-12 (yearly). */
  startAnchor: number;
  scope: BudgetScope;
  categoryIds?: readonly string[];
  /** Carry the previous period's leftover (or overspend) into the next. Off by default. */
  rollover?: boolean;
}

export interface Budget extends BudgetRow {
  categoryIds: string[];
}

function validate(input: BudgetInput): void {
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    throw new ValidationError("amount_not_positive");
  const bounds: Record<BudgetPeriod, [number, number]> = {
    weekly: [1, 7],
    monthly: [1, 28],
    yearly: [1, 12],
  };
  const [min, max] = bounds[input.period];
  if (
    !Number.isInteger(input.startAnchor) ||
    input.startAnchor < min ||
    input.startAnchor > max
  ) {
    throw new ValidationError("invalid_input", "start anchor out of range");
  }
  if (input.scope === "categories" && (input.categoryIds?.length ?? 0) === 0)
    throw new ValidationError("category_required");
}

function withCategories(db: Db, rows: readonly BudgetRow[]): Budget[] {
  if (rows.length === 0) return [];
  const links = db
    .select()
    .from(budgetCategories)
    .where(
      inArray(
        budgetCategories.budgetId,
        rows.map((r) => r.id),
      ),
    )
    .all();
  return rows.map((row) => ({
    ...row,
    categoryIds: links
      .filter((l) => l.budgetId === row.id)
      .map((l) => l.categoryId),
  }));
}

function defaultName(input: BudgetInput): string {
  if (input.name?.trim()) return input.name.trim();
  return {
    weekly: "Weekly budget",
    monthly: "Monthly budget",
    yearly: "Yearly budget",
  }[input.period];
}

function replaceScope(db: Db, budgetId: string, input: BudgetInput): void {
  db.delete(budgetCategories)
    .where(eq(budgetCategories.budgetId, budgetId))
    .run();
  if (input.scope === "categories" && input.categoryIds) {
    db.insert(budgetCategories)
      .values(
        [...new Set(input.categoryIds)].map((categoryId) => ({
          budgetId,
          categoryId,
        })),
      )
      .run();
  }
}

function assertSingleOverall(
  db: Db,
  input: BudgetInput,
  excludingId?: string,
): void {
  if (input.scope !== "all") return;
  const clash = listBudgets(db).some(
    (b) =>
      b.scope === "all" && b.period === input.period && b.id !== excludingId,
  );
  if (clash)
    throw new ValidationError(
      "invalid_input",
      "only one all-spending budget per period type",
    );
}

export function createBudget(
  db: Db,
  input: BudgetInput,
  now = Date.now(),
): Budget {
  validate(input);
  return db.transaction((tx) => {
    assertSingleOverall(tx, input);
    const row: BudgetRow = {
      id: newId(),
      name: defaultName(input),
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      period: input.period,
      startAnchor: input.startAnchor,
      scope: input.scope,
      rollover: input.rollover ?? false,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.insert(budgets).values(row).run();
    replaceScope(tx, row.id, input);
    return getBudget(tx, row.id) ?? { ...row, categoryIds: [] };
  });
}

export function updateBudget(
  db: Db,
  id: string,
  input: BudgetInput,
  now = Date.now(),
): void {
  validate(input);
  db.transaction((tx) => {
    if (!getBudget(tx, id)) throw new ValidationError("not_found");
    assertSingleOverall(tx, input, id);
    tx.update(budgets)
      .set({
        name: defaultName(input),
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        period: input.period,
        startAnchor: input.startAnchor,
        scope: input.scope,
        ...(input.rollover === undefined ? {} : { rollover: input.rollover }),
        updatedAt: now,
      })
      .where(eq(budgets.id, id))
      .run();
    replaceScope(tx, id, input);
  });
}

export function deleteBudget(db: Db, id: string): void {
  db.delete(budgets).where(eq(budgets.id, id)).run();
}

export function archiveBudget(db: Db, id: string, now = Date.now()): void {
  db.update(budgets)
    .set({ archivedAt: now, updatedAt: now })
    .where(eq(budgets.id, id))
    .run();
}

export function getBudget(db: Db, id: string): Budget | undefined {
  const row = db.select().from(budgets).where(eq(budgets.id, id)).get();
  return row ? withCategories(db, [row])[0] : undefined;
}

export function listBudgets(db: Db): Budget[] {
  const rows = db
    .select()
    .from(budgets)
    .where(isNull(budgets.archivedAt))
    .orderBy(asc(budgets.createdAt))
    .all();
  return withCategories(db, rows);
}

/** The budget's own period containing `ref` (a date key). */
export function budgetPeriodFor(
  budget: Pick<BudgetRow, "period" | "startAnchor">,
  ref: string,
): Period {
  if (budget.period === "weekly")
    return { type: "week", ...weekRange(ref, budget.startAnchor) };
  if (budget.period === "monthly")
    return periodFor("month", ref, {
      weekStart: 1,
      monthStart: budget.startAnchor,
    });
  return { type: "year", ...yearRange(ref, budget.startAnchor) };
}

export interface BudgetSpent {
  budget: Budget;
  period: Period;
  /** In the budget's currency. */
  spent: number;
  /** Rollover from earlier periods (negative after an overspend); 0 when rollover is off. */
  carried: number;
  /** The amount plus the carry: what this period may spend. */
  available: number;
  /** Recurring expenses in scope still due in this period (not yet posted); 0 for a past period. */
  upcoming: number;
  /** Part of `spent` posted by recurring rules. */
  recurringSpent: number;
  /** `available - spent`; negative when over. */
  remaining: number;
}

function inScope(budget: Budget, categoryId: string | null): boolean {
  return (
    budget.scope === "all" ||
    (categoryId !== null && budget.categoryIds.includes(categoryId))
  );
}

/** Expense lines in the period within scope, split lines counted by their own category; transfers never count. */
export function budgetSpent(db: Db, budget: Budget, period: Period): number {
  const lines = spendLines(db, period);
  const ctx: ConversionContext = {
    displayCurrency: budget.currency,
    rates: getRateLookup(db),
  };
  const scoped = lines.filter((l) => inScope(budget, l.categoryId));
  return sumLines(scoped, "expense", period, ctx);
}

/** The budget's periods from the one it was created in up to (not including) `period`, oldest first. */
export function periodsBefore(
  budget: Pick<BudgetRow, "period" | "startAnchor" | "createdAt">,
  period: Pick<Period, "from">,
  limit = 520,
): Period[] {
  const out: Period[] = [];
  let current = budgetPeriodFor(budget, toDateKey(budget.createdAt));
  while (current.from < period.from && out.length < limit) {
    out.push(current);
    current = budgetPeriodFor(budget, addDays(current.to, 1));
  }
  return out;
}

/** Rollover carried into `period`: each earlier period's leftover, chained from the period the budget was created in. */
export function budgetCarry(db: Db, budget: Budget, period: Period): number {
  if (!budget.rollover) return 0;
  const earlier = periodsBefore(budget, period);
  const first = earlier[0];
  const last = earlier[earlier.length - 1];
  if (!first || !last) return 0;
  const lines = spendLines(db, { from: first.from, to: last.to }).filter((l) =>
    inScope(budget, l.categoryId),
  );
  const ctx: ConversionContext = {
    displayCurrency: budget.currency,
    rates: getRateLookup(db),
  };
  return rolloverCarry(
    budget.amount,
    earlier.map((p) => sumLines(lines, "expense", p, ctx)),
  );
}

/** Expense rules in scope still due in the period, from `today` on (overdue unposted ones included); in the budget's currency. */
export function budgetUpcoming(
  db: Db,
  budget: Budget,
  period: Period,
  today: string,
  rates: RateLookup = getRateLookup(db),
): number {
  if (period.to < today) return 0;
  const rules = db
    .select()
    .from(recurringRules)
    .where(
      and(
        isNull(recurringRules.pausedAt),
        eq(recurringRules.kind, "expense"),
        lte(recurringRules.nextDue, period.to),
      ),
    )
    .all();
  let total = 0;
  for (const rule of rules) {
    if (!inScope(budget, rule.categoryId)) continue;
    if (
      rule.currency !== budget.currency &&
      rates(rule.currency, budget.currency) === null
    )
      continue;
    const dates = occurrencesBetween(rule, rule.nextDue, period.to, {
      endDate: rule.endDate,
      limit: 400,
    }).filter((d) => d >= period.from);
    total +=
      dates.length *
      convertWithRates(rule.amount, rule.currency, budget.currency, rates);
  }
  return total;
}

/** Expenses in the period that recurring rules posted, in scope and in the budget's currency. */
export function budgetRecurringSpent(
  db: Db,
  budget: Budget,
  period: Period,
  rates: RateLookup = getRateLookup(db),
): number {
  const rows = db
    .select({
      amount: transactions.amount,
      currency: transactions.currency,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.kind, "expense"),
        isNotNull(transactions.recurringRuleId),
        eq(transactions.isSplit, false),
        between(transactions.dateKey, period.from, period.to),
      ),
    )
    .all();
  let total = 0;
  for (const row of rows) {
    if (!inScope(budget, row.categoryId)) continue;
    if (
      row.currency !== budget.currency &&
      rates(row.currency, budget.currency) === null
    )
      continue;
    total += convertWithRates(row.amount, row.currency, budget.currency, rates);
  }
  return total;
}

/** Everything a budget needs for one period: spend, carry, what is still due and what remains. */
export function budgetProgress(
  db: Db,
  budget: Budget,
  period: Period,
  today: string,
): BudgetSpent {
  const rates = getRateLookup(db);
  const spent = budgetSpent(db, budget, period);
  const carried = budgetCarry(db, budget, period);
  const available = budget.amount + carried;
  return {
    budget,
    period,
    spent,
    carried,
    available,
    upcoming: budgetUpcoming(db, budget, period, today, rates),
    recurringSpent: budgetRecurringSpent(db, budget, period, rates),
    remaining: available - spent,
  };
}

export function listBudgetProgress(
  db: Db,
  ref: string = toDateKey(Date.now()),
  today: string = ref,
): BudgetSpent[] {
  return listBudgets(db).map((budget) =>
    budgetProgress(db, budget, budgetPeriodFor(budget, ref), today),
  );
}
