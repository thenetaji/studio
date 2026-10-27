/** @jest-environment node */
import { periodFor } from "@studio/dates";
import { ValidationError } from "../errors";
import { at, categoryId, createTestDb, makeAccounts } from "../test-helpers";
import {
  budgetPeriodFor,
  budgetProgress,
  budgetSpent,
  createBudget,
  deleteBudget,
  getBudget,
  listBudgetProgress,
  listBudgets,
  updateBudget,
} from "./budgets";
import { setRate } from "./fx";
import { createRule } from "./recurring";
import { createTransaction } from "./transactions";

const setup = () => {
  const db = createTestDb();
  const accts = makeAccounts(db);
  return {
    db,
    ...accts,
    food: categoryId(db, "Food & Drink"),
    groceries: categoryId(db, "Groceries"),
    transport: categoryId(db, "Transport"),
  };
};
const october = periodFor("month", "2026-10-05");

describe("budgets", () => {
  it("creates with scope and a default name, and updates scope", () => {
    const { db, food, groceries } = setup();
    const b = createBudget(db, {
      amount: 500000,
      currency: "inr",
      period: "monthly",
      startAnchor: 1,
      scope: "categories",
      categoryIds: [food, food, groceries],
    });
    expect(b).toMatchObject({ name: "Monthly budget", currency: "INR" });
    expect(b.categoryIds.sort()).toEqual([food, groceries].sort());
    updateBudget(db, b.id, {
      name: "Eating",
      amount: 1,
      currency: "INR",
      period: "weekly",
      startAnchor: 7,
      scope: "categories",
      categoryIds: [food],
    });
    expect(getBudget(db, b.id)).toMatchObject({
      name: "Eating",
      period: "weekly",
      categoryIds: [food],
    });
    deleteBudget(db, b.id);
    expect(listBudgets(db)).toEqual([]);
  });

  it("validates input and allows one all-spending budget per period type", () => {
    const { db } = setup();
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return e instanceof ValidationError ? e.code : "other";
      }
    };
    const base = {
      amount: 100,
      currency: "INR",
      period: "monthly",
      startAnchor: 1,
      scope: "all",
    } as const;
    expect(code(() => createBudget(db, { ...base, amount: 0 }))).toBe(
      "amount_not_positive",
    );
    expect(code(() => createBudget(db, { ...base, startAnchor: 29 }))).toBe(
      "invalid_input",
    );
    expect(code(() => createBudget(db, { ...base, scope: "categories" }))).toBe(
      "category_required",
    );
    const first = createBudget(db, base);
    expect(code(() => createBudget(db, base))).toBe("invalid_input");
    expect(
      code(() => createBudget(db, { ...base, period: "weekly" })),
    ).toBeUndefined();
    expect(
      code(() => updateBudget(db, first.id, { ...base, amount: 200 })),
    ).toBeUndefined();
  });

  it("counts plain expenses and split lines by category, and ignores transfers and income", () => {
    const { db, cash, bank, food, groceries, transport } = setup();
    const salary = categoryId(db, "Salary");
    const add = (amount: number, categoryIdValue: string, day: string) =>
      createTransaction(db, {
        kind: "expense",
        amount,
        accountId: cash.id,
        categoryId: categoryIdValue,
        occurredAt: at(day),
      });
    add(1000, food, "2026-10-02");
    add(500, transport, "2026-10-03");
    add(9999, food, "2026-09-30");
    createTransaction(db, {
      kind: "expense",
      amount: 3000,
      accountId: cash.id,
      occurredAt: at("2026-10-04"),
      splits: [
        { categoryId: food, amount: 700 },
        { categoryId: groceries, amount: 2300 },
      ],
    });
    createTransaction(db, {
      kind: "transfer",
      amount: 77777,
      accountId: cash.id,
      transferAccountId: bank.id,
      occurredAt: at("2026-10-05"),
    });
    createTransaction(db, {
      kind: "income",
      amount: 88888,
      accountId: cash.id,
      categoryId: salary,
      occurredAt: at("2026-10-05"),
    });

    const foodBudget = createBudget(db, {
      amount: 5000,
      currency: "INR",
      period: "monthly",
      startAnchor: 1,
      scope: "categories",
      categoryIds: [food],
    });
    const groceryBudget = createBudget(db, {
      amount: 5000,
      currency: "INR",
      period: "monthly",
      startAnchor: 1,
      scope: "categories",
      categoryIds: [groceries, transport],
    });
    const overall = createBudget(db, {
      amount: 10000,
      currency: "INR",
      period: "monthly",
      startAnchor: 1,
      scope: "all",
    });

    expect(budgetSpent(db, foodBudget, october)).toBe(1700);
    expect(budgetSpent(db, groceryBudget, october)).toBe(2800);
    expect(budgetSpent(db, overall, october)).toBe(4500);

    const progress = listBudgetProgress(db, "2026-10-10");
    expect(progress.find((p) => p.budget.id === overall.id)).toMatchObject({
      spent: 4500,
      remaining: 5500,
    });
    expect(progress[0]?.period).toEqual(october);
  });

  it("converts foreign-currency spend using stored rates", () => {
    const { db, usd, food } = setup();
    createTransaction(db, {
      kind: "expense",
      amount: 1000,
      accountId: usd.id,
      categoryId: food,
      occurredAt: at("2026-10-02"),
    });
    const budget = createBudget(db, {
      amount: 500000,
      currency: "INR",
      period: "monthly",
      startAnchor: 1,
      scope: "all",
    });
    expect(budgetSpent(db, budget, october)).toBe(1000);
    setRate(db, "USD", "INR", 83.2);
    expect(budgetSpent(db, budget, october)).toBe(83200);
  });

  it("resolves weekly, monthly and yearly periods from the anchor", () => {
    expect(
      budgetPeriodFor({ period: "weekly", startAnchor: 7 }, "2026-10-08"),
    ).toEqual({ type: "week", from: "2026-10-04", to: "2026-10-10" });
    expect(
      budgetPeriodFor({ period: "monthly", startAnchor: 15 }, "2026-10-05"),
    ).toEqual({ type: "month", from: "2026-09-15", to: "2026-10-14" });
    expect(
      budgetPeriodFor({ period: "yearly", startAnchor: 4 }, "2026-10-05"),
    ).toEqual({ type: "year", from: "2026-04-01", to: "2027-03-31" });
    expect(
      budgetPeriodFor({ period: "yearly", startAnchor: 4 }, "2026-02-05"),
    ).toEqual({ type: "year", from: "2025-04-01", to: "2026-03-31" });
  });

  describe("rollover", () => {
    const spend = (
      db: ReturnType<typeof setup>["db"],
      accountId: string,
      categoryIdValue: string,
      amount: number,
      day: string,
    ) =>
      createTransaction(db, {
        kind: "expense",
        amount,
        accountId,
        categoryId: categoryIdValue,
        occurredAt: at(day),
      });

    it("carries each earlier period's leftover forward from the period the budget was created in", () => {
      const { db, cash, food } = setup();
      const budget = createBudget(
        db,
        {
          amount: 5000,
          currency: "INR",
          period: "monthly",
          startAnchor: 1,
          scope: "categories",
          categoryIds: [food],
          rollover: true,
        },
        at("2026-08-20"),
      );
      expect(getBudget(db, budget.id)?.rollover).toBe(true);
      spend(db, cash.id, food, 9999, "2026-07-15"); // before the budget: ignored
      spend(db, cash.id, food, 3800, "2026-08-10"); // August: 1,200 left
      spend(db, cash.id, food, 7000, "2026-09-12"); // September: 6,200 - 7,000 = -800
      spend(db, cash.id, food, 1000, "2026-10-02");
      const progress = budgetProgress(db, budget, october, "2026-10-10");
      expect(progress).toMatchObject({
        spent: 1000,
        carried: -800,
        available: 4200,
        remaining: 3200,
      });
    });

    it("carries nothing when rollover is off, and can be switched on by an update", () => {
      const { db, cash, food } = setup();
      const input = {
        amount: 5000,
        currency: "INR",
        period: "monthly",
        startAnchor: 1,
        scope: "categories",
        categoryIds: [food],
      } as const;
      const budget = createBudget(db, input, at("2026-09-01"));
      spend(db, cash.id, food, 2000, "2026-09-05");
      expect(budgetProgress(db, budget, october, "2026-10-10").carried).toBe(0);
      updateBudget(db, budget.id, { ...input, rollover: true });
      const updated = getBudget(db, budget.id)!;
      expect(budgetProgress(db, updated, october, "2026-10-10")).toMatchObject({
        carried: 3000,
        available: 8000,
      });
      // Leaving `rollover` out of an update keeps it.
      updateBudget(db, budget.id, { ...input, amount: 6000 });
      expect(getBudget(db, budget.id)?.rollover).toBe(true);
    });
  });

  it("counts recurring spend still due in the period, in scope, and what rules already posted", () => {
    const { db, cash, food, groceries } = setup();
    const rule = createRule(db, {
      kind: "expense",
      title: "Meal plan",
      amount: 1500,
      accountId: cash.id,
      categoryId: food,
      frequency: "weekly",
      startDate: "2026-10-03",
    });
    createRule(db, {
      kind: "expense",
      title: "Veg box",
      amount: 900,
      accountId: cash.id,
      categoryId: groceries,
      frequency: "monthly",
      startDate: "2026-10-20",
    });
    // A posted occurrence on the 3rd counts as recurring spend.
    createTransaction(db, {
      kind: "expense",
      amount: 1500,
      accountId: cash.id,
      categoryId: food,
      occurredAt: at("2026-10-03"),
      recurringRuleId: rule.id,
    });
    const foodBudget = createBudget(db, {
      amount: 10000,
      currency: "INR",
      period: "monthly",
      startAnchor: 1,
      scope: "categories",
      categoryIds: [food],
    });
    const overall = createBudget(db, {
      amount: 50000,
      currency: "INR",
      period: "monthly",
      startAnchor: 1,
      scope: "all",
    });
    const p = budgetProgress(db, foodBudget, october, "2026-10-05");
    // Rule's next due is its start (3rd); occurrences 3, 10, 17, 24, 31 are unposted per the rule row.
    expect(p.recurringSpent).toBe(1500);
    expect(p.upcoming).toBe(5 * 1500);
    const all = budgetProgress(db, overall, october, "2026-10-05");
    expect(all.upcoming).toBe(5 * 1500 + 900);
    // A past period expects nothing more.
    const september = budgetPeriodFor(foodBudget, "2026-09-10");
    expect(
      budgetProgress(db, foodBudget, september, "2026-10-05").upcoming,
    ).toBe(0);
  });
});
