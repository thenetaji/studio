import { addDays, diffDays, type DateKey } from "@studio/dates";

import {
  convertLine,
  deltaVsPrevious,
  savingsRate,
  sumLines,
  type ConversionContext,
  type Delta,
  type FlatLine,
} from "@/lib/insights";

type Range = { from: DateKey; to: DateKey };

/**
 * The stretch of the previous month to compare against. A finished month is compared with the whole previous
 * month; a month still running is compared with the same number of days at the start of the previous one
 * (1-26 October against 1-26 September), so a half-finished month never looks like a big drop.
 */
export function comparableRange(
  period: Range,
  previous: Range,
  today: DateKey,
): { current: Range; previous: Range; partial: boolean } {
  if (today >= period.to || today < period.from)
    return { current: period, previous, partial: false };
  const elapsed = diffDays(period.from, today);
  const end = addDays(previous.from, elapsed);
  return {
    current: { from: period.from, to: today },
    previous: {
      from: previous.from,
      to: end < previous.to ? end : previous.to,
    },
    partial: true,
  };
}

export interface Headline {
  spent: number;
  earned: number;
  /** earned - spent. */
  net: number;
  /** Whole percent, null when nothing was earned. */
  savingsRate: number | null;
}

export function headline(
  lines: readonly FlatLine[],
  range: Range,
  ctx: ConversionContext,
): Headline {
  const spent = sumLines(lines, "expense", range, ctx);
  const earned = sumLines(lines, "income", range, ctx);
  return {
    spent,
    earned,
    net: earned - spent,
    savingsRate: savingsRate(earned, spent),
  };
}

export interface HeadlineDeltas {
  spent: Delta;
  earned: Delta;
  net: Delta;
  /** Change in percentage points, null when either month earned nothing. */
  savingsRatePoints: number | null;
}

export function headlineDeltas(
  current: Headline,
  previous: Headline,
): HeadlineDeltas {
  return {
    spent: deltaVsPrevious(current.spent, previous.spent),
    earned: deltaVsPrevious(current.earned, previous.earned),
    // A percent change of a value that can cross zero is meaningless; only the amount is used.
    net: { amount: current.net - previous.net, percent: null },
    savingsRatePoints:
      current.savingsRate === null || previous.savingsRate === null
        ? null
        : current.savingsRate - previous.savingsRate,
  };
}

export interface CategoryChange {
  categoryId: string | null;
  current: number;
  previous: number;
  /** current - previous. */
  change: number;
  /** Whole percent change, null when the previous amount is zero. */
  percent: number | null;
  /** Whole-number share of this month's total, 0-100. */
  share: number;
}

/** Spending per category in both ranges, largest this month first (then largest last month). */
export function categoryChanges(
  lines: readonly FlatLine[],
  current: Range,
  previous: Range,
  ctx: ConversionContext,
  kind: FlatLine["kind"] = "expense",
): CategoryChange[] {
  const now = new Map<string | null, number>();
  const before = new Map<string | null, number>();
  let total = 0;
  for (const line of lines) {
    if (line.kind !== kind) continue;
    if (line.dateKey >= current.from && line.dateKey <= current.to) {
      const amount = convertLine(line, ctx);
      now.set(line.categoryId, (now.get(line.categoryId) ?? 0) + amount);
      total += amount;
    } else if (line.dateKey >= previous.from && line.dateKey <= previous.to) {
      before.set(
        line.categoryId,
        (before.get(line.categoryId) ?? 0) + convertLine(line, ctx),
      );
    }
  }
  const ids = new Set<string | null>([...now.keys(), ...before.keys()]);
  return [...ids]
    .map((categoryId) => {
      const cur = now.get(categoryId) ?? 0;
      const prev = before.get(categoryId) ?? 0;
      const delta = deltaVsPrevious(cur, prev);
      return {
        categoryId,
        current: cur,
        previous: prev,
        change: delta.amount,
        percent: delta.percent,
        share: total <= 0 ? 0 : Math.round((cur * 100) / total),
      };
    })
    .filter((c) => c.current > 0 || c.previous > 0)
    .sort(
      (a, b) =>
        b.current - a.current ||
        b.previous - a.previous ||
        String(a.categoryId).localeCompare(String(b.categoryId)),
    );
}

/**
 * Keeps the first `limit` categories and folds the rest into one row with `categoryId` "other".
 * The folded row's share is the remainder, so the shares still add up.
 */
export function foldCategories(
  changes: readonly CategoryChange[],
  limit: number,
): (CategoryChange & { isOther: boolean })[] {
  const head = changes.slice(0, limit).map((c) => ({ ...c, isOther: false }));
  const rest = changes.slice(limit);
  if (rest.length === 0) return head;
  const current = rest.reduce((s, c) => s + c.current, 0);
  const previous = rest.reduce((s, c) => s + c.previous, 0);
  const delta = deltaVsPrevious(current, previous);
  const share = Math.max(0, 100 - head.reduce((s, c) => s + c.share, 0));
  return [
    ...head,
    {
      categoryId: "other",
      current,
      previous,
      change: delta.amount,
      percent: delta.percent,
      share: current > 0 ? share : 0,
      isOther: true,
    },
  ];
}

export interface WhatChanged<T extends CategoryChange = CategoryChange> {
  /** Largest increases first. */
  up: T[];
  /** Largest decreases first. */
  down: T[];
}

/** Top `limit` category increases and decreases by amount. Changes under `minimum` minor units are left out. */
export function whatChanged<T extends CategoryChange>(
  changes: readonly T[],
  limit = 3,
  minimum = 1,
): WhatChanged<T> {
  const up = changes
    .filter((c) => c.change >= minimum)
    .sort((a, b) => b.change - a.change)
    .slice(0, limit);
  const down = changes
    .filter((c) => -c.change >= minimum)
    .sort((a, b) => a.change - b.change)
    .slice(0, limit);
  return { up, down };
}

export interface DayTotal {
  dateKey: DateKey;
  amount: number;
}

/** The day with the most spending in the range (earliest on ties), or null when nothing was spent. */
export function busiestDay(
  lines: readonly FlatLine[],
  range: Range,
  ctx: ConversionContext,
  kind: FlatLine["kind"] = "expense",
): DayTotal | null {
  const days = new Map<DateKey, number>();
  for (const line of lines) {
    if (
      line.kind !== kind ||
      line.dateKey < range.from ||
      line.dateKey > range.to
    )
      continue;
    days.set(
      line.dateKey,
      (days.get(line.dateKey) ?? 0) + convertLine(line, ctx),
    );
  }
  let best: DayTotal | null = null;
  for (const [dateKey, amount] of days) {
    if (
      amount > 0 &&
      (best === null ||
        amount > best.amount ||
        (amount === best.amount && dateKey < best.dateKey))
    )
      best = { dateKey, amount };
  }
  return best;
}

export type BudgetOutcome = "within" | "over";

export interface BudgetResult {
  outcome: BudgetOutcome;
  /** spent / amount, 0 when the amount is 0. */
  ratio: number;
  /** amount - spent; negative when over. */
  remaining: number;
}

/** Within means at or under the amount. */
export function budgetResult(spent: number, amount: number): BudgetResult {
  return {
    outcome: spent > amount ? "over" : "within",
    ratio: amount > 0 ? spent / amount : 0,
    remaining: amount - spent,
  };
}
