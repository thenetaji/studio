import { makeRateLookup } from "@studio/money";
import type { Period } from "@studio/dates";
import type { DetailedLine } from "@/lib/insights";

import {
  categoryTrends,
  comparableRanges,
  comparePeriods,
  directionOf,
  topMoves,
  trailingPeriods,
  trendsRange,
} from "./trends-model";
import { isPayee, payeeTotals } from "./payees-model";
import { cashFlowMonths, monthlyCashFlow } from "./cashflow-model";
import {
  netWorthPoints,
  netWorthSeries,
  stackColors,
  STACK_ORDER,
} from "./net-worth-model";
import {
  DEFICIT_KEY,
  HUB_KEY,
  OTHER_SPEND_KEY,
  SAVED_KEY,
  flowShare,
  moneyFlow,
} from "./flow-model";

const ctx = {
  displayCurrency: "INR",
  rates: makeRateLookup([{ base: "USD", quote: "INR", rate: 80 }]),
};
const settings = { weekStart: 1, monthStart: 1 };
const october: Period = { type: "month", from: "2026-10-01", to: "2026-10-31" };

let n = 0;
const line = (
  dateKey: string,
  amount: number,
  categoryId: string | null,
  extra: Partial<DetailedLine> = {},
): DetailedLine => ({
  dateKey,
  amount,
  categoryId,
  kind: "expense",
  currency: "INR",
  transactionId: `t${n++}`,
  title: "",
  accountId: "a",
  ...extra,
});

describe("trailingPeriods and comparableRanges", () => {
  it("lists periods oldest first ending with the given one", () => {
    const list = trailingPeriods(october, 3);
    expect(list.map((p) => p.from)).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
  });

  it("cuts both ranges at today's offset while the period runs", () => {
    expect(comparableRanges(october, "2026-10-26")).toEqual({
      current: { from: "2026-10-01", to: "2026-10-26" },
      previous: { from: "2026-09-01", to: "2026-09-26" },
      partial: true,
    });
  });

  it("never runs past the end of a shorter previous month", () => {
    const march: Period = { type: "month", from: "2026-03-01", to: "2026-03-31" };
    expect(comparableRanges(march, "2026-03-30").previous).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("compares whole periods once a period has ended", () => {
    expect(comparableRanges(october, "2026-11-02")).toEqual({
      current: { from: "2026-10-01", to: "2026-10-31" },
      previous: { from: "2026-09-01", to: "2026-09-30" },
      partial: false,
    });
  });

  it("covers the spark and average periods", () => {
    expect(trendsRange(october)).toEqual({
      from: "2026-05-01",
      to: "2026-10-31",
    });
  });
});

describe("categoryTrends", () => {
  const lines = [
    line("2026-07-05", 300, "food"),
    line("2026-08-05", 300, "food"),
    line("2026-09-05", 600, "food"),
    line("2026-09-28", 1000, "food"),
    line("2026-10-04", 900, "food"),
    line("2026-10-10", 50, "fun"),
    line("2026-10-10", 1, "fun", { kind: "income" }),
  ];
  const trends = categoryTrends(lines, "expense", october, "2026-10-26", ctx);

  it("compares like for like and averages the three whole periods before", () => {
    const food = trends.get("food")!;
    expect(food.current).toBe(900);
    // 28 Sep is past the 26-day cut, so only the 5 Sep line counts.
    expect(food.previous).toBe(600);
    expect(food.delta).toBe(300);
    expect(food.percent).toBe(50);
    expect(food.direction).toBe("up");
    expect(food.average).toBe(733);
    expect(food.spark).toEqual([0, 0, 300, 300, 1600, 900]);
  });

  it("marks a category with no history as new and leaves the average out", () => {
    const fun = trends.get("fun")!;
    expect(fun.direction).toBe("new");
    expect(fun.percent).toBeNull();
    expect(fun.average).toBeNull();
  });

  it("reads directions", () => {
    expect(directionOf(100, 100)).toBe("flat");
    expect(directionOf(99, 100)).toBe("down");
    expect(directionOf(0, 0)).toBe("flat");
  });
});

describe("comparePeriods", () => {
  const lines = [
    line("2026-09-03", 1000, "rent"),
    line("2026-10-03", 1200, "rent"),
    line("2026-09-10", 500, "food"),
    line("2026-10-10", 200, "food"),
    line("2026-10-11", 80, null),
    line("2026-10-12", 999, "same"),
    line("2026-09-12", 999, "same"),
  ];
  const result = comparePeriods(lines, "expense", october, "2026-11-01", ctx);

  it("totals both sides and orders rows from rise to fall", () => {
    expect(result.current).toBe(2479);
    expect(result.previous).toBe(2499);
    expect(result.delta).toBe(-20);
    expect(result.percent).toBe(-1);
    expect(result.rows.map((r) => [r.categoryId, r.delta])).toEqual([
      ["rent", 200],
      [null, 80],
      ["food", -300],
    ]);
  });

  it("keeps the biggest moves in rise-to-fall order", () => {
    expect(topMoves(result.rows, 2).map((r) => r.categoryId)).toEqual([
      "rent",
      "food",
    ]);
  });
});

describe("payeeTotals", () => {
  const lines = [
    line("2026-10-01", 300, "food", { title: "  Swiggy ", transactionId: "s1" }),
    line("2026-10-05", 500, "food", { title: "swiggy", transactionId: "s2" }),
    line("2026-10-06", 100, "fun", { title: "SWIGGY  instamart", transactionId: "s3" }),
    line("2026-10-07", 60, "food", { title: "Swiggy", transactionId: "s4" }),
    line("2026-10-07", 40, "fun", { title: "Swiggy", transactionId: "s4" }),
    line("2026-10-08", 1000, "rent", { title: "", transactionId: "u" }),
    line("2026-11-01", 999, "food", { title: "Swiggy", transactionId: "late" }),
  ];
  const payees = payeeTotals(lines, "expense", october, ctx);

  it("groups case- and space-insensitively and counts transactions once", () => {
    expect(payees.map((p) => p.key)).toEqual(["swiggy", "swiggy instamart"]);
    const swiggy = payees[0]!;
    expect(swiggy.amount).toBe(900);
    expect(swiggy.count).toBe(3);
    expect(swiggy.average).toBe(300);
    expect(swiggy.title).toBe("Swiggy");
    expect(swiggy.categoryId).toBe("food");
    expect(swiggy.lastDate).toBe("2026-10-07");
    // Shares are of everything spent, untitled included.
    expect(swiggy.percent).toBe(45);
  });

  it("sorts by count when asked and matches titles to payees", () => {
    expect(
      payeeTotals(lines, "expense", october, ctx, "count")[0]!.key,
    ).toBe("swiggy");
    expect(isPayee(" SWIGGY ", "swiggy")).toBe(true);
    expect(isPayee("Swiggy One", "swiggy")).toBe(false);
  });
});

describe("cash flow by month", () => {
  it("shows six months ending now for a running month and twelve for a year", () => {
    expect(
      cashFlowMonths(october, "2026-10-26", settings).map((m) => m.from),
    ).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
    const year: Period = { type: "year", from: "2026-01-01", to: "2026-12-31" };
    const months = cashFlowMonths(year, "2026-10-26", settings);
    expect(months).toHaveLength(12);
    expect(months[0]!.from).toBe("2026-01-01");
  });

  it("spans a long custom range", () => {
    const custom: Period = {
      type: "custom",
      from: "2026-02-15",
      to: "2026-07-10",
    };
    expect(
      cashFlowMonths(custom, "2026-10-26", settings).map((m) => m.from),
    ).toEqual([
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
    ]);
  });

  it("works out net and savings rate per month and overall", () => {
    const months = cashFlowMonths(october, "2026-10-26", settings).slice(-2);
    const lines = [
      line("2026-09-01", 10000, "pay", { kind: "income" }),
      line("2026-09-02", 7500, "rent"),
      line("2026-10-02", 3000, "rent"),
      line("2026-10-02", 100, "pay", { kind: "income", currency: "USD" }),
    ];
    const flow = monthlyCashFlow(lines, months, october, "2026-10-26", ctx);
    expect(flow.months.map((m) => [m.income, m.spent, m.net, m.rate])).toEqual([
      [10000, 7500, 2500, 25],
      [8000, 3000, 5000, 63],
    ]);
    expect(flow.focusIndex).toBe(1);
    expect(flow.rate).toBe(42);
  });
});

describe("net worth", () => {
  it("puts twelve month-end points ending today", () => {
    const points = netWorthPoints(october, "2026-10-26", settings);
    expect(points).toHaveLength(12);
    expect(points[0]).toBe("2025-11-30");
    expect(points[11]).toBe("2026-10-26");
  });

  it("rebuilds each account and the converted total", () => {
    const accounts = [
      { id: "cash", name: "Cash", currency: "INR", openingBalance: 1000, color: "green" },
      { id: "usd", name: "Wise", currency: "USD", openingBalance: 10, color: "green" },
      { id: "eur", name: "Euro", currency: "EUR", openingBalance: 5, color: "blue" },
    ];
    const movements = [
      { accountId: "cash", dateKey: "2026-09-15", delta: -400 },
      { accountId: "usd", dateKey: "2026-10-02", delta: 5 },
    ];
    const series = netWorthSeries(
      accounts,
      movements,
      ["2026-08-31", "2026-09-30", "2026-10-26"],
      "INR",
      ctx.rates,
    );
    expect(series.total).toEqual([1800, 1400, 1800]);
    expect(series.accounts.map((a) => a.values)).toEqual([
      [1000, 600, 600],
      [800, 800, 1200],
    ]);
    expect(series.unconverted).toEqual(["Euro"]);
    // Two green accounts: the second falls back to the first free stack colour.
    expect(series.accounts.map((a) => a.color)).toEqual(["green", "blue"]);
  });

  it("never repeats a stack colour", () => {
    const picked = stackColors(["blue", "blue", "gray", "nope", "amber"]);
    expect(picked).toEqual(["blue", "amber", "purple", "lime", "indigo"]);
    expect(new Set(picked).size).toBe(picked.length);
    expect(STACK_ORDER).toHaveLength(6);
  });
});

describe("moneyFlow", () => {
  const incomes = [
    { categoryId: "salary", name: "Salary", color: "green", amount: 9000 },
    { categoryId: "gifts", name: "Gifts", color: "pink", amount: 1000 },
  ];
  const spends = [
    { categoryId: "rent", name: "Rent", color: "blue", amount: 4000 },
    { categoryId: "food", name: "Food", color: "orange", amount: 2000 },
    { categoryId: "fun", name: "Fun", color: "purple", amount: 500 },
    { categoryId: "misc", name: "Misc", color: "gray", amount: 300 },
  ];

  it("flows sources into the hub and out to categories, Other and Saved", () => {
    const flow = moneyFlow(incomes, spends, { targets: 2 });
    expect(flow.saved).toBe(3200);
    expect(flow.nodes.map((n) => [n.key, n.column, n.amount])).toEqual([
      ["in:salary", 0, 9000],
      ["in:gifts", 0, 1000],
      [HUB_KEY, 1, 10000],
      ["out:rent", 2, 4000],
      ["out:food", 2, 2000],
      [OTHER_SPEND_KEY, 2, 800],
      [SAVED_KEY, 2, 3200],
    ]);
    const into = flow.links
      .filter((l) => l.target === HUB_KEY)
      .reduce((s, l) => s + l.value, 0);
    const out = flow.links
      .filter((l) => l.source === HUB_KEY)
      .reduce((s, l) => s + l.value, 0);
    expect(into).toBe(out);
    expect(flowShare(flow.nodes[3]!, flow)).toBe(40);
  });

  it("never folds a single row into Other", () => {
    const flow = moneyFlow(incomes, spends.slice(0, 3), { targets: 2 });
    expect(flow.nodes.some((n) => n.key === OTHER_SPEND_KEY)).toBe(false);
  });

  it("adds a From savings source when spending beats income", () => {
    const flow = moneyFlow(
      [{ categoryId: "salary", name: "Salary", color: "green", amount: 1000 }],
      [{ categoryId: "rent", name: "Rent", color: "blue", amount: 1500 }],
    );
    expect(flow.deficit).toBe(500);
    expect(flow.nodes.find((n) => n.key === DEFICIT_KEY)?.amount).toBe(500);
    expect(flow.nodes.some((n) => n.key === SAVED_KEY)).toBe(false);
  });

  it("is empty without money", () => {
    expect(moneyFlow([], []).nodes).toEqual([]);
  });
});
