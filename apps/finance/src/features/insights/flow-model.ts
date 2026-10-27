import type { CategoryColorKey } from "@studio/theme";
import { categoryKeys } from "@studio/theme";

/** What a node's colour means; the screen maps it to a token. */
export type FlowTone =
  | { type: "category"; color: CategoryColorKey }
  | { type: "hub" }
  | { type: "saved" }
  | { type: "other" }
  | { type: "deficit" };

export interface FlowNode {
  key: string;
  /** 0 = income sources, 1 = the hub, 2 = where it went. */
  column: 0 | 1 | 2;
  name: string;
  amount: number;
  tone: FlowTone;
  /** Category behind the node, for drill-down; null for Other, Saved, the hub and the deficit. */
  categoryId: string | null;
  kind: "income" | "expense" | null;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
}

export interface MoneyFlow {
  nodes: FlowNode[];
  links: FlowLink[];
  income: number;
  spent: number;
  /** income - spent when positive, else 0. */
  saved: number;
  /** spent - income when positive (paid from savings), else 0. */
  deficit: number;
}

export interface FlowCategory {
  categoryId: string | null;
  name: string;
  color: string | undefined;
  amount: number;
}

export const HUB_KEY = "hub";
export const SAVED_KEY = "saved";
export const DEFICIT_KEY = "deficit";
export const OTHER_INCOME_KEY = "in:other";
export const OTHER_SPEND_KEY = "out:other";

const asColor = (value: string | undefined): CategoryColorKey =>
  (categoryKeys as readonly string[]).includes(value ?? "")
    ? (value as CategoryColorKey)
    : "gray";

/** Top `limit` rows by amount with the rest folded into one Other row (never an Other of a single row). */
function fold(
  rows: readonly FlowCategory[],
  limit: number,
): { head: FlowCategory[]; rest: number } {
  const sorted = rows
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (sorted.length <= limit + 1) return { head: sorted, rest: 0 };
  return {
    head: sorted.slice(0, limit),
    rest: sorted.slice(limit).reduce((s, r) => s + r.amount, 0),
  };
}

/**
 * Monarch-style money flow for one period: income sources on the left flow into one hub, which flows out to the
 * largest spending categories, Other and Saved on the right. When spending beats income, a "From savings" source
 * makes up the difference so both sides balance.
 */
export function moneyFlow(
  incomes: readonly FlowCategory[],
  spends: readonly FlowCategory[],
  limits: { sources?: number; targets?: number } = {},
): MoneyFlow {
  const { sources = 3, targets = 5 } = limits;
  const income = incomes.reduce((s, r) => s + Math.max(0, r.amount), 0);
  const spent = spends.reduce((s, r) => s + Math.max(0, r.amount), 0);
  const saved = Math.max(0, income - spent);
  const deficit = Math.max(0, spent - income);
  const empty = { nodes: [], links: [], income, spent, saved, deficit };
  if (income <= 0 && spent <= 0) return empty;

  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  const left = fold(incomes, sources);
  for (const row of left.head) {
    const key = `in:${row.categoryId ?? "none"}`;
    nodes.push({
      key,
      column: 0,
      name: row.name,
      amount: row.amount,
      tone: { type: "category", color: asColor(row.color) },
      categoryId: row.categoryId,
      kind: "income",
    });
    links.push({ source: key, target: HUB_KEY, value: row.amount });
  }
  if (left.rest > 0) {
    nodes.push({
      key: OTHER_INCOME_KEY,
      column: 0,
      name: "Other",
      amount: left.rest,
      tone: { type: "other" },
      categoryId: null,
      kind: "income",
    });
    links.push({ source: OTHER_INCOME_KEY, target: HUB_KEY, value: left.rest });
  }
  if (deficit > 0) {
    nodes.push({
      key: DEFICIT_KEY,
      column: 0,
      name: "From savings",
      amount: deficit,
      tone: { type: "deficit" },
      categoryId: null,
      kind: null,
    });
    links.push({ source: DEFICIT_KEY, target: HUB_KEY, value: deficit });
  }
  nodes.push({
    key: HUB_KEY,
    column: 1,
    name: income > 0 ? "Income" : "Spent",
    amount: income > 0 ? income : spent,
    tone: { type: "hub" },
    categoryId: null,
    kind: null,
  });
  const right = fold(spends, targets);
  for (const row of right.head) {
    const key = `out:${row.categoryId ?? "none"}`;
    nodes.push({
      key,
      column: 2,
      name: row.name,
      amount: row.amount,
      tone: { type: "category", color: asColor(row.color) },
      categoryId: row.categoryId,
      kind: "expense",
    });
    links.push({ source: HUB_KEY, target: key, value: row.amount });
  }
  if (right.rest > 0) {
    nodes.push({
      key: OTHER_SPEND_KEY,
      column: 2,
      name: "Other",
      amount: right.rest,
      tone: { type: "other" },
      categoryId: null,
      kind: "expense",
    });
    links.push({ source: HUB_KEY, target: OTHER_SPEND_KEY, value: right.rest });
  }
  if (saved > 0) {
    nodes.push({
      key: SAVED_KEY,
      column: 2,
      name: "Saved",
      amount: saved,
      tone: { type: "saved" },
      categoryId: null,
      kind: null,
    });
    links.push({ source: HUB_KEY, target: SAVED_KEY, value: saved });
  }
  return { nodes, links, income, spent, saved, deficit };
}

/** Whole-percent share of income (or of spending, when nothing was earned) that a node stands for. */
export function flowShare(node: FlowNode, flow: MoneyFlow): number {
  const base =
    node.column === 0 || node.key === HUB_KEY
      ? flow.income + flow.deficit
      : Math.max(flow.income, flow.spent);
  return base <= 0 ? 0 : Math.round((node.amount * 100) / base);
}
