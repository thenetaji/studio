import type { DonutDatum } from "@studio/charts/components";
import type { BreakdownSlice } from "@/data/hooks";
import type { BreakdownBy } from "@/lib/insights";
import { formatMoney } from "@studio/money";
import { categoryColors, categoryKeys } from "@studio/theme";
import type { CategoryColorKey } from "@studio/theme";

import { DONUT_LIMIT, OTHER_KEY, type Formatting } from "./model";

export const BREAKDOWN_LABELS: Record<BreakdownBy, string> = {
  category: "Category",
  group: "Group",
  tag: "Tag",
  account: "Account",
  merchant: "Merchant",
};

export const asColorKey = (value: string | undefined): CategoryColorKey =>
  (categoryKeys as readonly string[]).includes(value ?? "")
    ? (value as CategoryColorKey)
    : "gray";

/** "Spending by group", "Income by account". */
export function breakdownTitle(
  by: BreakdownBy,
  kind: "expense" | "income",
): string {
  if (by === "category")
    return kind === "income" ? "Income by source" : "Spending by category";
  return `${kind === "income" ? "Income" : "Spending"} by ${BREAKDOWN_LABELS[by].toLowerCase()}`;
}

/**
 * The top `DONUT_LIMIT` slices plus one Other. Labels give each slice's share of the period's total; tags
 * can overlap (a transaction with two tags counts in both), so tag shares may add up past 100.
 */
export function breakdownDonut(
  slices: readonly BreakdownSlice[],
  fmt: Formatting,
): DonutDatum[] {
  const amountLabel = (amount: number) =>
    formatMoney(amount, fmt.currency, {
      locale: fmt.locale,
      decimals: fmt.showDecimals ? undefined : 0,
    });
  const head = slices.slice(0, DONUT_LIMIT);
  const rest = slices.slice(DONUT_LIMIT);
  const data: DonutDatum[] = head.map((s) => ({
    key: s.key,
    name: s.name,
    value: s.amount,
    amountLabel: amountLabel(s.amount),
    percentLabel: `${s.percent}%`,
    color: (fmt.palette ?? categoryColors[fmt.scheme])[asColorKey(s.color)],
  }));
  if (rest.length > 0) {
    const amount = rest.reduce((sum, s) => sum + s.amount, 0);
    const percent = rest.reduce((sum, s) => sum + s.percent, 0);
    data.push({
      key: OTHER_KEY,
      name: "Other",
      value: amount,
      amountLabel: amountLabel(amount),
      percentLabel: `${percent}%`,
      color: (fmt.palette ?? categoryColors[fmt.scheme]).gray,
    });
  }
  return data;
}

/** Slices limited to the donut selection; Other means everything outside the donut's top slices. */
export function selectedSlices(
  slices: readonly BreakdownSlice[],
  selectedKey: string | null,
): BreakdownSlice[] {
  if (selectedKey === null) return [...slices];
  if (selectedKey === OTHER_KEY) return slices.slice(DONUT_LIMIT);
  return slices.filter((s) => s.key === selectedKey);
}

/** "Spending by tag: Trip 40%, Work 25%". */
export function breakdownSummary(
  slices: readonly BreakdownSlice[],
  by: BreakdownBy,
  kind: "expense" | "income",
): string {
  const head = breakdownTitle(by, kind);
  if (slices.length === 0) return `${head}: nothing in this period`;
  return `${head}: ${slices
    .slice(0, DONUT_LIMIT)
    .map((s) => `${s.name} ${s.percent}%`)
    .join(", ")}`;
}
