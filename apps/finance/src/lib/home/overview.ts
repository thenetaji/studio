/** Pure maths for the Home hero: what is left this month and what that allows per day. Minor units throughout. */

export type LeftBasis = "budget" | "income";

export interface LeftInput {
  /** Income this month, display currency. */
  earned: number;
  /** Spending this month, display currency. */
  spent: number;
  /** Recurring bills still due this month (not yet posted), display currency. */
  bills: number;
  /**
   * The all-spending monthly budget, when there is one in the display currency: what it allows (amount plus
   * rollover), what it has spent in its own period and the bills still due in that period.
   */
  budget?: { available: number; spent: number; bills: number };
}

export interface LeftResult {
  basis: LeftBasis;
  /** Negative once committed spending passes what came in (or the budget). */
  left: number;
}

/**
 * With an all-spending budget: the budget minus what it has spent minus the bills still due in it. Without one:
 * this month's income minus this month's spending minus the bills still due. Expected income is never counted
 * before it arrives.
 */
export function leftThisMonth(input: LeftInput): LeftResult {
  if (input.budget) {
    const { available, spent, bills } = input.budget;
    return { basis: "budget", left: available - spent - bills };
  }
  return { basis: "income", left: input.earned - input.spent - input.bills };
}

/** What is left spread over the days remaining (today included), rounded down; 0 when nothing is left. */
export function safePerDay(left: number, daysRemaining: number): number {
  if (left <= 0 || daysRemaining <= 0) return 0;
  return Math.floor(left / daysRemaining);
}

export interface DueOccurrence {
  dueDate: string;
  kind: string;
  amount: number;
  currency: string;
}

/** Expense occurrences due between `from` and `to` (inclusive), converted; rules with no rate are left out. */
export function billsDue(
  occurrences: readonly DueOccurrence[],
  range: { from: string; to: string },
  convert: (minor: number, currency: string) => number | null,
): number {
  let total = 0;
  for (const o of occurrences) {
    if (o.kind !== "expense") continue;
    if (o.dueDate < range.from || o.dueDate > range.to) continue;
    total += convert(o.amount, o.currency) ?? 0;
  }
  return total;
}
