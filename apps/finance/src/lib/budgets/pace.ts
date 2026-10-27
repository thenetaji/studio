/**
 * Budget pace (Copilot style): a budget is on track while its projected end-of-period spend fits, at risk once the
 * projection passes the limit, and over once the spend itself has. Pure and unit-tested; money is minor units.
 */
import { diffDays, type DateKey, type Period } from "@studio/dates";

export type PaceStatus = "on_track" | "at_risk" | "over";

export interface PaceInput {
  /** Spent so far in the period. */
  spent: number;
  /** What the period may spend: the amount plus any rollover carry (negative after a large overspend). */
  available: number;
  /** Recurring spend still expected in the period (rules not yet posted). */
  upcoming: number;
  /** Part of `spent` posted by recurring rules; left out of the daily rate so rent on the 1st is not extrapolated. */
  recurringSpent: number;
  /** Days in the period. */
  totalDays: number;
  /** Days elapsed, today included: 0 before the period starts, `totalDays` once it has ended. */
  elapsedDays: number;
}

export interface PaceResult {
  status: PaceStatus;
  /** Spend expected by the end of the period. */
  projected: number;
  /** Spent as a share of available, >= 0; 1 or more once over. */
  ratio: number;
  /** Upcoming recurring spend as a share of available, trimmed so that `ratio + upcomingRatio <= 1`. */
  upcomingRatio: number;
}

/**
 * Share of the period that counts as a minimum window for the daily rate: one big day early in a month is not
 * extrapolated over the whole month.
 */
export const MIN_RATE_WINDOW = 0.1;

/** Days elapsed in `period` on `todayKey`, today included; clamped to the period. */
export function elapsedDays(
  period: Pick<Period, "from" | "to">,
  todayKey: DateKey,
): number {
  const total = diffDays(period.from, period.to) + 1;
  if (todayKey < period.from) return 0;
  if (todayKey > period.to) return total;
  return diffDays(period.from, todayKey) + 1;
}

/** Spend expected at the period end: what is spent, what recurring rules will still post, and the day-to-day rate. */
export function projectedSpend(input: PaceInput): number {
  const { spent, upcoming, recurringSpent, totalDays, elapsedDays } = input;
  if (elapsedDays >= totalDays) return spent;
  if (elapsedDays <= 0) return spent + upcoming;
  const variable = Math.max(0, spent - recurringSpent);
  const window = Math.max(elapsedDays, Math.ceil(totalDays * MIN_RATE_WINDOW));
  const rest = totalDays - elapsedDays;
  return spent + upcoming + Math.round((variable / window) * rest);
}

export function budgetPace(input: PaceInput): PaceResult {
  const { spent, available, upcoming } = input;
  const projected = projectedSpend(input);
  const over = available < 0 || spent > available;
  const status: PaceStatus = over
    ? "over"
    : projected > available
      ? "at_risk"
      : "on_track";
  const ratio =
    available > 0 ? Math.max(0, spent) / available : spent > 0 || over ? 1 : 0;
  const upcomingRatio =
    available > 0
      ? Math.min(Math.max(0, upcoming) / available, Math.max(0, 1 - ratio))
      : 0;
  return { status, projected, ratio, upcomingRatio };
}

/** Text that always travels with the status colour. A finished period that fit reads "Under budget". */
export function paceLabel(status: PaceStatus, finished = false): string {
  if (status === "over") return finished ? "Over budget" : "Over";
  if (status === "at_risk") return "At risk";
  return finished ? "Under budget" : "On track";
}
