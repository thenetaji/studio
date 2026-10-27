import {
  monthPeriodsEnding,
} from "@/lib/insights";
import {
  balanceHistory,
  type HistoryAccount,
  type Movement,
} from "@/lib/balance/history";
import type { DateKey, Period, PeriodSettings } from "@studio/dates";
import {
  categoryKeys,
  type CategoryColorKey,
} from "@studio/theme";
import { convertWithRates, type RateLookup } from "@studio/money";

export interface NetWorthAccount extends HistoryAccount {
  name: string;
  color: string;
}

export interface NetWorthSeries {
  /** One point per month end, oldest first; the last is today when the window reaches it. */
  keys: DateKey[];
  total: number[];
  accounts: {
    id: string;
    name: string;
    color: CategoryColorKey;
    values: number[];
  }[];
  /** Accounts left out because their currency has no exchange rate. */
  unconverted: string[];
}

/**
 * Month-end points for the net worth chart: twelve months ending with the month the period ends in (or today, for a
 * period still running). The last point is never after today.
 */
export function netWorthPoints(
  period: Period,
  today: DateKey,
  settings: PeriodSettings,
  count = 12,
): DateKey[] {
  const end = period.to < today ? period.to : today;
  return monthPeriodsEnding(end, count, settings).map((m) =>
    m.to > today ? today : m.to,
  );
}

/**
 * Validated fallback order for stacking: used when an account's own colour is missing or already taken by an
 * account above it, so neighbouring bands never share a colour. Checked with the dataviz palette validator
 * (adjacent CVD separation >= 22 in both schemes).
 */
export const STACK_ORDER: readonly CategoryColorKey[] = [
  "blue",
  "amber",
  "purple",
  "lime",
  "indigo",
  "orange",
];

/** Each account's own colour, unless an earlier account already has it; then the next free stack colour. */
export function stackColors(colors: readonly string[]): CategoryColorKey[] {
  const used = new Set<CategoryColorKey>();
  return colors.map((raw) => {
    const own = (categoryKeys as readonly string[]).includes(raw)
      ? (raw as CategoryColorKey)
      : null;
    const pick =
      own && own !== "gray" && !used.has(own)
        ? own
        : (STACK_ORDER.find((k) => !used.has(k)) ??
          categoryKeys.find((k) => k !== "gray" && !used.has(k)) ??
          "gray");
    used.add(pick);
    return pick;
  });
}

/**
 * Balance of every account at each point, rebuilt from opening balances plus every movement on or before the point,
 * converted to the display currency. `total` sums the accounts that could be converted.
 */
export function netWorthSeries(
  accounts: readonly NetWorthAccount[],
  movements: readonly Movement[],
  keys: readonly DateKey[],
  displayCurrency: string,
  rates: RateLookup,
): NetWorthSeries {
  const convertible = (currency: string) =>
    currency === displayCurrency || rates(currency, displayCurrency) !== null;
  const convert = (amount: number, currency: string) =>
    currency === displayCurrency
      ? amount
      : rates(currency, displayCurrency) === null
        ? null
        : convertWithRates(amount, currency, displayCurrency, rates);
  const kept = accounts.filter((a) => convertible(a.currency));
  const colors = stackColors(kept.map((a) => a.color));
  const series = kept.map((account, i) => ({
    id: account.id,
    name: account.name,
    color: colors[i]!,
    values: balanceHistory(
      [account],
      movements.filter((m) => m.accountId === account.id),
      keys,
      convert,
    ),
  }));
  return {
    keys: [...keys],
    total: keys.map((_, i) =>
      series.reduce((s, a) => s + (a.values[i] ?? 0), 0),
    ),
    accounts: series,
    unconverted: accounts
      .filter((a) => !convertible(a.currency))
      .map((a) => a.name),
  };
}
