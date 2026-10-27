import { weekday } from "@studio/dates";
import { makeRateLookup } from "@studio/money";
import type { DetailedLine } from "@/lib/insights";

import {
  biggestMonth,
  budgetResult,
  busiestDay,
  categoryChanges,
  comparableRange,
  elapsedYear,
  entryCount,
  foldCategories,
  headline,
  headlineDeltas,
  monthlyTotals,
  mostFrequentTitle,
  whatChanged,
  yearWeeks,
} from "./index";

const ctx = {
  displayCurrency: "INR",
  rates: makeRateLookup([{ base: "USD", quote: "INR", rate: 80 }]),
};
let n = 0;
const line = (
  dateKey: string,
  amount: number,
  over: Partial<DetailedLine> = {},
): DetailedLine => ({
  dateKey,
  amount,
  kind: "expense",
  categoryId: "food",
  currency: "INR",
  transactionId: `t${n++}`,
  title: "",
  accountId: "a1",
  ...over,
});
const OCT = { from: "2026-10-01", to: "2026-10-31" };
const SEP = { from: "2026-09-01", to: "2026-09-30" };

describe("comparableRange", () => {
  it("compares whole months once the month is over", () => {
    expect(comparableRange(OCT, SEP, "2026-11-02")).toEqual({
      current: OCT,
      previous: SEP,
      partial: false,
    });
  });
  it("compares the same number of days while the month runs", () => {
    expect(comparableRange(OCT, SEP, "2026-10-26")).toEqual({
      current: { from: "2026-10-01", to: "2026-10-26" },
      previous: { from: "2026-09-01", to: "2026-09-26" },
      partial: true,
    });
    // The 31st compares with the whole of a 30-day month.
    expect(comparableRange(OCT, SEP, "2026-10-31").previous).toEqual(SEP);
  });
});

describe("headline", () => {
  it("sums spending and income, converting currencies", () => {
    const lines = [
      line("2026-10-02", 1000),
      line("2026-10-03", 10, { currency: "USD" }),
      line("2026-10-04", 5000, { kind: "income", categoryId: "salary" }),
      line("2026-09-30", 999),
    ];
    expect(headline(lines, OCT, ctx)).toEqual({
      spent: 1800,
      earned: 5000,
      net: 3200,
      savingsRate: 64,
    });
  });
  it("compares two months", () => {
    const d = headlineDeltas(
      { spent: 1200, earned: 5000, net: 3800, savingsRate: 76 },
      { spent: 1000, earned: 0, net: -1000, savingsRate: null },
    );
    expect(d.spent).toEqual({ amount: 200, percent: 20 });
    expect(d.earned.percent).toBeNull();
    expect(d.net).toEqual({ amount: 4800, percent: null });
    expect(d.savingsRatePoints).toBeNull();
  });
});

describe("categoryChanges and whatChanged", () => {
  const lines = [
    line("2026-10-02", 3000, { categoryId: "food" }),
    line("2026-09-02", 2000, { categoryId: "food" }),
    line("2026-10-03", 500, { categoryId: "fun" }),
    line("2026-09-05", 1500, { categoryId: "travel" }),
    line("2026-10-06", 1500, { categoryId: null }),
    line("2026-09-06", 1500, { categoryId: null }),
    line("2026-10-07", 9000, { kind: "income", categoryId: "salary" }),
  ];
  const changes = categoryChanges(lines, OCT, SEP, ctx);
  it("lists both months per category, this month's biggest first", () => {
    expect(changes).toEqual([
      {
        categoryId: "food",
        current: 3000,
        previous: 2000,
        change: 1000,
        percent: 50,
        share: 60,
      },
      {
        categoryId: null,
        current: 1500,
        previous: 1500,
        change: 0,
        percent: 0,
        share: 30,
      },
      {
        categoryId: "fun",
        current: 500,
        previous: 0,
        change: 500,
        percent: null,
        share: 10,
      },
      {
        categoryId: "travel",
        current: 0,
        previous: 1500,
        change: -1500,
        percent: -100,
        share: 0,
      },
    ]);
  });
  it("picks the biggest increases and decreases", () => {
    const w = whatChanged(changes, 3);
    expect(w.up.map((c) => c.categoryId)).toEqual(["food", "fun"]);
    expect(w.down.map((c) => c.categoryId)).toEqual(["travel"]);
    expect(whatChanged(changes, 3, 600).up.map((c) => c.categoryId)).toEqual([
      "food",
    ]);
  });
  it("folds the tail into Other with the remaining share", () => {
    const folded = foldCategories(changes, 2);
    expect(folded).toHaveLength(3);
    expect(folded[2]).toMatchObject({
      categoryId: "other",
      current: 500,
      previous: 1500,
      share: 10,
      isOther: true,
    });
    expect(foldCategories(changes, 10)).toHaveLength(4);
  });
});

describe("busiestDay", () => {
  it("returns the day with the most spending, earliest on ties", () => {
    const lines = [
      line("2026-10-02", 500),
      line("2026-10-02", 700),
      line("2026-10-09", 1200),
      line("2026-10-12", 900),
      line("2026-10-13", 5000, { kind: "income" }),
    ];
    expect(busiestDay(lines, OCT, ctx)).toEqual({
      dateKey: "2026-10-02",
      amount: 1200,
    });
    expect(busiestDay([], OCT, ctx)).toBeNull();
  });
});

describe("budgetResult", () => {
  it("is within at or under the amount", () => {
    expect(budgetResult(1000, 1000)).toEqual({
      outcome: "within",
      ratio: 1,
      remaining: 0,
    });
    expect(budgetResult(1500, 1000)).toEqual({
      outcome: "over",
      ratio: 1.5,
      remaining: -500,
    });
    expect(budgetResult(0, 0).ratio).toBe(0);
  });
});

describe("year", () => {
  const lines = [
    line("2026-01-05", 1000, { title: "Coffee", transactionId: "a" }),
    line("2026-01-06", 1000, { title: " coffee ", transactionId: "b" }),
    line("2026-03-01", 5000, { title: "Rent", transactionId: "c" }),
    line("2026-03-02", 20000, {
      kind: "income",
      title: "Salary",
      transactionId: "d",
    }),
    line("2026-12-31", 200, { title: "Tea", transactionId: "e" }),
    line("2025-12-31", 99999, { title: "Coffee", transactionId: "f" }),
  ];
  it("totals each calendar month", () => {
    const months = monthlyTotals(lines, 2026, ctx);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({
      key: "2026-01-01",
      month: 1,
      spent: 2000,
      earned: 0,
    });
    expect(months[2]).toMatchObject({ spent: 5000, earned: 20000 });
    expect(months[11]?.spent).toBe(200);
    expect(biggestMonth(months)).toBe(2);
    expect(biggestMonth(monthlyTotals([], 2026, ctx))).toBeNull();
  });
  it("finds the most frequent purchase by count", () => {
    const top = mostFrequentTitle(
      lines,
      "expense",
      { from: "2026-01-01", to: "2026-12-31" },
      ctx,
    );
    expect(top).toMatchObject({
      key: "coffee",
      title: "Coffee",
      count: 2,
      amount: 2000,
      percent: 50,
    });
  });
  it("counts entries and the elapsed part of the year", () => {
    expect(entryCount(lines, { from: "2026-01-01", to: "2026-12-31" })).toBe(5);
    expect(elapsedYear(2026, "2026-10-26")).toEqual({
      from: "2026-01-01",
      to: "2026-10-26",
    });
    expect(elapsedYear(2025, "2026-10-26")).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
    expect(elapsedYear(2027, "2026-10-26")).toBeNull();
  });
  it("lays the year out in week columns", () => {
    // 2026-01-01 is a Thursday.
    const weeks = yearWeeks(2026, 1, weekday);
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(365);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});
