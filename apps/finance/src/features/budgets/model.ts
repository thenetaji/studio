import type { BudgetSpent } from "@/db/repos/budgets";
import type { BudgetPeriod, CategoryRow } from "@/db/schema";
import type { DateKey } from "@studio/dates";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import type { CategoryColorKey } from "@studio/theme";

import {
  budgetPace,
  elapsedDays,
  paceLabel,
  type PaceStatus,
} from "@/lib/budgets/pace";

import { displayName, paceMarker, periodCaption, perDayLeft } from "./logic";

export interface BudgetFormat {
  locale?: string;
  showDecimals: boolean;
  todayKey: DateKey;
  categories: ReadonlyMap<string, CategoryRow>;
}

export interface BudgetView {
  id: string;
  name: string;
  scope: "all" | "categories";
  period: BudgetPeriod;
  icon: string;
  color: CategoryColorKey;
  /** Spent as a share of what the period may spend; over 1 once over. */
  ratio: number;
  /** Recurring spend still due, as a share of the bar (the outlined segment). */
  upcomingRatio: number;
  /** Today's position in the period (0-1) for the pace tick; undefined for past or future periods. */
  marker?: number;
  /** Footnote title: "This month", or the month's name when not current. */
  caption: string;
  /** Pace: on track, at risk (projected over) or over. */
  status: PaceStatus;
  /** Text that always travels with the status colour: "On track", "At risk", "Over". */
  statusLabel: string;
  /** "₹17,600 left", or "₹2,400 over". */
  headline: string;
  /** "₹2,100 of ₹5,000". */
  progressText: string;
  /** "of ₹5,000": what the period may spend, rollover included. */
  limitText: string;
  /** "₹12,400 spent · ₹590/day left". */
  detail: string;
  /** "₹649 due" when recurring bills are still expected in the period; empty otherwise. */
  upcomingText: string;
  /** "₹1,200 rolled over" (or "₹800 overspend rolled over"); empty without a carry. */
  carriedText: string;
  accessibilityLabel: string;
}

const asColor = (value: string | undefined): CategoryColorKey =>
  (value ?? "gray") as CategoryColorKey;

/** Display strings for one budget over its current period. */
export function toBudgetView(
  progress: BudgetSpent,
  fmt: BudgetFormat,
  current = true,
): BudgetView {
  const { budget, period, spent, remaining, available, carried, upcoming } =
    progress;
  // Budgets are round targets; whole units keep them calm whatever the list setting.
  const decimals = 0;
  const money = (minor: number) =>
    formatMoney(minor, budget.currency, { locale: fmt.locale, decimals });
  const spoken = (minor: number) =>
    formatMoneyForSpeech(minor, budget.currency, {
      sign: "none",
      locale: fmt.locale,
    });
  const linked = budget.categoryIds
    .map((id) => fmt.categories.get(id))
    .filter((c): c is CategoryRow => !!c);
  const name = displayName(
    budget,
    linked.map((c) => c.name),
  );
  const pace = budgetPace({
    spent,
    available,
    upcoming,
    recurringSpent: progress.recurringSpent,
    totalDays: elapsedDays(period, period.to),
    elapsedDays: current
      ? elapsedDays(period, fmt.todayKey)
      : elapsedDays(period, period.to),
  });
  const finished = !current || fmt.todayKey > period.to;
  const over = remaining < 0;
  const perDay = perDayLeft(remaining, period, fmt.todayKey);
  const headline = over
    ? `${money(-remaining)} over`
    : `${money(remaining)} left`;
  const detail = over
    ? `${money(spent)} spent of ${money(available)}`
    : current
      ? `${money(spent)} spent · ${money(perDay)}/day left`
      : `${money(spent)} spent of ${money(available)}`;
  const carriedText =
    carried > 0
      ? `${money(carried)} rolled over`
      : carried < 0
        ? `${money(-carried)} overspend rolled over`
        : "";
  const upcomingText =
    current && upcoming > 0 && !over ? `${money(upcoming)} due` : "";
  const statusLabel = paceLabel(pace.status, finished);
  return {
    id: budget.id,
    name,
    scope: budget.scope,
    period: budget.period,
    icon:
      budget.scope === "all"
        ? "chart.pie.fill"
        : linked.length === 1
          ? (linked[0]?.icon ?? "tag.fill")
          : "square.grid.2x2",
    color: budget.scope === "all" ? "blue" : asColor(linked[0]?.color),
    ratio: pace.ratio,
    upcomingRatio: current && !over ? pace.upcomingRatio : 0,
    marker: current ? paceMarker(period, fmt.todayKey) : undefined,
    caption: periodCaption(budget.period, period, current),
    status: pace.status,
    statusLabel,
    headline,
    progressText: `${money(spent)} of ${money(available)}`,
    limitText: `of ${money(available)}`,
    detail,
    upcomingText,
    carriedText,
    accessibilityLabel: [
      name,
      statusLabel,
      `${spoken(spent)} of ${spoken(available)}`,
      over ? `${spoken(-remaining)} over` : `${spoken(remaining)} left`,
      upcoming > 0 && current && !over ? `${spoken(upcoming)} due` : "",
      carried !== 0
        ? `${spoken(Math.abs(carried))} ${carried > 0 ? "rolled over" : "overspend rolled over"}`
        : "",
    ]
      .filter(Boolean)
      .join(", "),
  };
}
