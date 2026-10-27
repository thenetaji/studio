import { addDays, diffDays, type DateKey } from "@studio/dates";

/**
 * No-spend days and streaks.
 *
 * A no-spend day is a tracked day with no expense entries. Only plain expenses count as spending: transfers
 * and the lending kinds never do, and a split expense counts once for its day. Callers pass the set of days
 * that have at least one expense (`spendDays`).
 *
 * - Tracked days run from `since` (the first day with any entry at all) to `today`. Days before the first
 *   entry are untracked, so a new install does not start with a years-long streak; with no entries nothing
 *   is tracked.
 * - Today counts as a no-spend day while nothing has been spent today ("so far"). The first expense of the
 *   day turns it into a spend day and ends the current streak. This keeps "no-spend days this month", the
 *   calendar and the current streak in agreement at every moment.
 * - Days after today are future: never no-spend, never part of a streak.
 */
export interface NoSpendInput {
  /** Days with at least one expense. */
  spendDays: ReadonlySet<DateKey>;
  /** First day with any entry, or null when there are none. */
  since: DateKey | null;
  today: DateKey;
}

export type DayStatus = "future" | "untracked" | "spend" | "no-spend";

export interface Streak {
  /** Days in the run; 0 when there is none. */
  length: number;
  from: DateKey | null;
  to: DateKey | null;
}

const NONE: Streak = { length: 0, from: null, to: null };

export function dayStatus(key: DateKey, input: NoSpendInput): DayStatus {
  if (key > input.today) return "future";
  if (input.since === null || key < input.since) return "untracked";
  return input.spendDays.has(key) ? "spend" : "no-spend";
}

/** The part of `range` that is tracked (between `since` and `today`), or null when none of it is. */
export function trackedRange(
  range: { from: DateKey; to: DateKey },
  input: NoSpendInput,
): { from: DateKey; to: DateKey } | null {
  if (input.since === null) return null;
  const from = range.from > input.since ? range.from : input.since;
  const to = range.to < input.today ? range.to : input.today;
  return from <= to ? { from, to } : null;
}

/** No-spend days in `range`, oldest first. */
export function noSpendDays(
  range: { from: DateKey; to: DateKey },
  input: NoSpendInput,
): DateKey[] {
  const tracked = trackedRange(range, input);
  if (!tracked) return [];
  const out: DateKey[] = [];
  for (let key = tracked.from; key <= tracked.to; key = addDays(key, 1)) {
    if (!input.spendDays.has(key)) out.push(key);
  }
  return out;
}

/** Number of tracked days in `range` (the denominator for "12 of 26 days"). */
export function trackedDays(
  range: { from: DateKey; to: DateKey },
  input: NoSpendInput,
): number {
  const tracked = trackedRange(range, input);
  return tracked ? diffDays(tracked.from, tracked.to) + 1 : 0;
}

/** The run of no-spend days that ends today; length 0 when today already has spending. */
export function currentStreak(input: NoSpendInput): Streak {
  if (dayStatus(input.today, input) !== "no-spend") return NONE;
  let from = input.today;
  for (;;) {
    const prev = addDays(from, -1);
    if (dayStatus(prev, input) !== "no-spend") break;
    from = prev;
  }
  return { length: diffDays(from, input.today) + 1, from, to: input.today };
}

/**
 * Longest run of no-spend days inside `range` (all tracked days when omitted). Runs are clipped to the range.
 * Ties go to the most recent run.
 */
export function longestStreak(
  input: NoSpendInput,
  range?: { from: DateKey; to: DateKey },
): Streak {
  const tracked = trackedRange(
    range ?? { from: "0000-01-01", to: "9999-12-31" },
    input,
  );
  if (!tracked) return NONE;
  let best = NONE;
  let start: DateKey | null = null;
  const close = (end: DateKey) => {
    if (start === null) return;
    const length = diffDays(start, end) + 1;
    if (length >= best.length) best = { length, from: start, to: end };
    start = null;
  };
  for (let key = tracked.from; key <= tracked.to; key = addDays(key, 1)) {
    if (input.spendDays.has(key)) close(addDays(key, -1));
    else if (start === null) start = key;
  }
  close(tracked.to);
  return best;
}

export interface NoSpendSummary {
  current: Streak;
  best: Streak;
  /** No-spend days in the given month range so far. */
  monthDays: number;
  /** Tracked days in the month range so far. */
  monthTracked: number;
}

export function noSpendSummary(
  month: { from: DateKey; to: DateKey },
  input: NoSpendInput,
): NoSpendSummary {
  return {
    current: currentStreak(input),
    best: longestStreak(input),
    monthDays: noSpendDays(month, input).length,
    monthTracked: trackedDays(month, input),
  };
}
