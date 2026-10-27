import type { DateKey } from "@studio/dates";
import {
  convertLine,
  normaliseTitle,
  type ConversionContext,
  type DetailedLine,
} from "@/lib/insights";

type Range = { from: DateKey; to: DateKey };

export interface Payee {
  /** Normalised title: trimmed, single-spaced, lower case. */
  key: string;
  /** The most recent spelling, tidied. */
  title: string;
  amount: number;
  /** Distinct transactions (a split counts once). */
  count: number;
  /** Mean per transaction, minor units, rounded half up. */
  average: number;
  /** Whole-number share of the kind's total in the range, 0-100. */
  percent: number;
  /** The category that took most of this payee's money. */
  categoryId: string | null;
  /** Latest day seen. */
  lastDate: DateKey;
}

export type PayeeSort = "amount" | "count";

/** Tidied display form of a title: trimmed and single-spaced, case kept. */
export const tidyTitle = (title: string): string =>
  title.trim().replace(/\s+/g, " ");

/**
 * Every payee (transaction title) of `kind` in `range`, grouped case-insensitively. Untitled transactions have no
 * payee and are left out, but still count toward the total that `percent` is a share of.
 */
export function payeeTotals(
  lines: readonly DetailedLine[],
  kind: DetailedLine["kind"],
  range: Range,
  ctx: ConversionContext,
  sort: PayeeSort = "amount",
): Payee[] {
  type Acc = {
    title: string;
    titleDate: DateKey;
    amount: number;
    ids: Set<string>;
    byCategory: Map<string | null, number>;
    lastDate: DateKey;
  };
  const groups = new Map<string, Acc>();
  let total = 0;
  for (const line of lines) {
    if (line.kind !== kind || line.dateKey < range.from || line.dateKey > range.to)
      continue;
    const amount = convertLine(line, ctx);
    total += amount;
    const key = normaliseTitle(line.title);
    if (key === "") continue;
    const group = groups.get(key) ?? {
      title: tidyTitle(line.title),
      titleDate: line.dateKey,
      amount: 0,
      ids: new Set<string>(),
      byCategory: new Map(),
      lastDate: line.dateKey,
    };
    group.amount += amount;
    group.ids.add(line.transactionId);
    group.byCategory.set(
      line.categoryId,
      (group.byCategory.get(line.categoryId) ?? 0) + amount,
    );
    if (line.dateKey > group.lastDate) group.lastDate = line.dateKey;
    if (line.dateKey > group.titleDate) {
      group.title = tidyTitle(line.title);
      group.titleDate = line.dateKey;
    }
    groups.set(key, group);
  }
  const payees = [...groups.entries()].map(([key, g]) => {
    let categoryId: string | null = null;
    let best = -1;
    for (const [id, amount] of g.byCategory)
      if (amount > best) {
        best = amount;
        categoryId = id;
      }
    const count = g.ids.size;
    return {
      key,
      title: g.title,
      amount: g.amount,
      count,
      average: Math.floor((g.amount * 2 + count) / (count * 2)),
      percent: total <= 0 ? 0 : Math.round((g.amount * 100) / total),
      categoryId,
      lastDate: g.lastDate,
    };
  });
  return payees.sort((a, b) =>
    sort === "count"
      ? b.count - a.count || b.amount - a.amount || a.key.localeCompare(b.key)
      : b.amount - a.amount || b.count - a.count || a.key.localeCompare(b.key),
  );
}

/** True when a transaction title belongs to the payee `key`. */
export const isPayee = (title: string, key: string): boolean =>
  normaliseTitle(title) === key;
