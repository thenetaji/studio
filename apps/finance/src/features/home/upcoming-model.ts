import type { Occurrence } from "@/db/repos/recurring";
import type { AccountRow, CategoryRow } from "@/db/schema";
import { dayLabel, addDays } from "@studio/dates";
import {
  formatMoney,
  formatMoneyForSpeech,
  type SignMode,
} from "@studio/money";
import type { CategoryColorKey } from "@studio/theme";

export const UPCOMING_DAYS = 7;
export const UPCOMING_ROWS = 3;

export interface UpcomingRowModel {
  ruleId: string;
  kind: "expense" | "income" | "transfer";
  title: string;
  subtitle: string;
  amount: string;
  trailing: string;
  icon: string;
  color: CategoryColorKey;
  accessibilityLabel: string;
}

const SIGN: Record<UpcomingRowModel["kind"], SignMode> = {
  expense: "minus",
  income: "plus",
  transfer: "none",
};

/** First occurrence per rule, soonest first, at most three. */
export function nextPerRule(
  occurrences: readonly Occurrence[],
  limit = UPCOMING_ROWS,
): Occurrence[] {
  const seen = new Set<string>();
  const out: Occurrence[] = [];
  for (const occurrence of occurrences) {
    if (seen.has(occurrence.rule.id)) continue;
    seen.add(occurrence.rule.id);
    out.push(occurrence);
    if (out.length === limit) break;
  }
  return out;
}

export function dueLabel(dueDate: string, todayKey: string): string {
  return dueDate === addDays(todayKey, 1)
    ? "Tomorrow"
    : dayLabel(dueDate, todayKey);
}

export function toUpcomingRow(
  occurrence: Occurrence,
  ctx: {
    todayKey: string;
    locale?: string;
    showDecimals: boolean;
    categories: ReadonlyMap<string, CategoryRow>;
    accounts: ReadonlyMap<string, AccountRow>;
  },
): UpcomingRowModel {
  const { rule, dueDate } = occurrence;
  const sign = SIGN[rule.kind];
  const category = rule.categoryId
    ? ctx.categories.get(rule.categoryId)
    : undefined;
  const account = ctx.accounts.get(rule.accountId);
  const to = rule.transferAccountId
    ? ctx.accounts.get(rule.transferAccountId)
    : undefined;
  const isTransfer = rule.kind === "transfer";
  const title = isTransfer
    ? `${account?.name ?? ""} → ${to?.name ?? ""}`
    : rule.title || category?.name || "Recurring";
  const subtitle = isTransfer
    ? "Transfer"
    : [category?.name, account?.name].filter(Boolean).join(" · ");
  const amount = formatMoney(rule.amount, rule.currency, {
    locale: ctx.locale,
    sign,
    decimals: ctx.showDecimals ? undefined : 0,
  });
  const trailing = dueLabel(dueDate, ctx.todayKey);
  const spokenTitle = isTransfer
    ? `${account?.name ?? ""} to ${to?.name ?? ""}`
    : title;
  return {
    ruleId: rule.id,
    kind: rule.kind,
    title,
    subtitle,
    amount,
    trailing,
    icon: isTransfer
      ? "arrow.left.arrow.right"
      : (category?.icon ?? "arrow.triangle.2.circlepath"),
    color: (isTransfer
      ? "gray"
      : (category?.color ?? "gray")) as CategoryColorKey,
    accessibilityLabel: [
      spokenTitle,
      isTransfer ? "Transfer" : subtitle.replace(" · ", ", "),
      formatMoneyForSpeech(rule.amount, rule.currency, {
        sign,
        locale: ctx.locale,
      }),
      `due ${trailing}`,
    ]
      .filter(Boolean)
      .join(", "),
  };
}
