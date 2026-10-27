/** @jest-environment node */
import { eq } from "drizzle-orm";
import { ValidationError } from "../errors";
import {
  budgetCategories,
  titleMemory,
  transactionSplits,
  transactions,
  recurringRules,
} from "../schema";
import { at, categoryId, createTestDb, makeAccounts } from "../test-helpers";
import { createBudget } from "./budgets";
import {
  archiveCategory,
  countCategoryUsage,
  createCategory,
  deleteCategory,
  deleteUnusedCategory,
  getCategory,
  listCategories,
  reorderCategories,
  restoreCategory,
  transactionCountsByCategory,
  updateCategory,
} from "./categories";
import { createRule } from "./recurring";
import { createTransaction } from "./transactions";

describe("categories", () => {
  it("seeds the spec categories with exact icons and colours, in order", () => {
    const db = createTestDb();
    const expense = listCategories(db, "expense");
    expect(expense).toHaveLength(13);
    expect(expense[0]).toMatchObject({
      name: "Food & Drink",
      icon: "fork.knife",
      color: "red",
      sortOrder: 0,
    });
    expect(expense[6]).toMatchObject({
      name: "Subscriptions",
      icon: "arrow.triangle.2.circlepath",
      color: "indigo",
    });
    expect(expense[12]).toMatchObject({
      name: "Other",
      icon: "ellipsis.circle.fill",
      color: "gray",
    });
    const income = listCategories(db, "income");
    expect(income.map((c) => c.name)).toEqual([
      "Salary",
      "Freelance",
      "Investments",
      "Refunds",
      "Gifts",
      "Other income",
    ]);
    expect(income[2]).toMatchObject({
      icon: "chart.line.uptrend.xyaxis",
      color: "teal",
    });
  });

  it("creates, updates, archives and reorders", () => {
    const db = createTestDb();
    const pets = createCategory(db, {
      name: " Pets ",
      kind: "expense",
      icon: "pawprint.fill",
      color: "orange",
    });
    expect(pets).toMatchObject({ name: "Pets", sortOrder: 13 });
    updateCategory(db, pets.id, { name: "Pet care", color: "lime" });
    expect(getCategory(db, pets.id)).toMatchObject({
      name: "Pet care",
      color: "lime",
      kind: "expense",
    });
    const [first, second] = listCategories(db, "expense");
    if (!first || !second) throw new Error("seed");
    reorderCategories(db, [second.id, first.id]);
    expect(
      listCategories(db, "expense")
        .slice(0, 2)
        .map((c) => c.id),
    ).toEqual([second.id, first.id]);
    archiveCategory(db, pets.id);
    expect(listCategories(db, "expense").some((c) => c.id === pets.id)).toBe(
      false,
    );
    expect(
      listCategories(db, "expense", { includeArchived: true }).some(
        (c) => c.id === pets.id,
      ),
    ).toBe(true);
  });

  it("delete reassigns transactions, splits, rules, title memory and budgets", () => {
    const db = createTestDb();
    const { cash } = makeAccounts(db);
    const food = categoryId(db, "Food & Drink");
    const groceries = categoryId(db, "Groceries");
    const other = categoryId(db, "Other");

    createTransaction(db, {
      kind: "expense",
      title: "Lunch",
      amount: 100,
      accountId: cash.id,
      categoryId: food,
      occurredAt: at("2026-10-01"),
    });
    createTransaction(db, {
      kind: "expense",
      title: "Mixed",
      amount: 300,
      accountId: cash.id,
      occurredAt: at("2026-10-02"),
      splits: [
        { categoryId: food, amount: 100 },
        { categoryId: groceries, amount: 200 },
      ],
    });
    createRule(db, {
      kind: "expense",
      title: "Tiffin",
      amount: 500,
      accountId: cash.id,
      categoryId: food,
      frequency: "monthly",
      startDate: "2026-10-01",
    });
    createBudget(db, {
      amount: 1000,
      currency: "INR",
      period: "monthly",
      startAnchor: 1,
      scope: "categories",
      categoryIds: [food, other],
    });

    deleteCategory(db, food, other);

    expect(getCategory(db, food)).toBeUndefined();
    expect(
      db
        .select()
        .from(transactions)
        .where(eq(transactions.categoryId, other))
        .all(),
    ).toHaveLength(1);
    expect(
      db
        .select()
        .from(transactionSplits)
        .all()
        .map((s) => s.categoryId)
        .sort(),
    ).toEqual([groceries, other].sort());
    expect(db.select().from(recurringRules).all()[0]?.categoryId).toBe(other);
    expect(
      db.select().from(titleMemory).where(eq(titleMemory.title, "Lunch")).get()
        ?.categoryId,
    ).toBe(other);
    expect(
      db
        .select()
        .from(budgetCategories)
        .all()
        .map((b) => b.categoryId),
    ).toEqual([other]);
  });

  it("requires a same-kind target", () => {
    const db = createTestDb();
    const food = categoryId(db, "Food & Drink");
    const code = (fn: () => void) => {
      try {
        fn();
      } catch (e) {
        return e instanceof ValidationError ? e.code : "other";
      }
    };
    expect(code(() => deleteCategory(db, food, categoryId(db, "Salary")))).toBe(
      "target_kind_mismatch",
    );
    expect(code(() => deleteCategory(db, food, food))).toBe("target_required");
    expect(code(() => deleteCategory(db, food, "missing"))).toBe(
      "category_not_found",
    );
    expect(getCategory(db, food)).toBeDefined();
  });

  describe("usage and unused delete", () => {
    it("counts transactions, split lines, rules and budget scopes", () => {
      const db = createTestDb();
      const { cash } = makeAccounts(db);
      const food = categoryId(db, "Food & Drink");
      const groceries = categoryId(db, "Groceries");
      expect(countCategoryUsage(db, food)).toBe(0);

      createTransaction(db, {
        kind: "expense",
        title: "Lunch",
        amount: 100,
        accountId: cash.id,
        categoryId: food,
        occurredAt: at("2026-10-01"),
      });
      createTransaction(db, {
        kind: "expense",
        title: "Mixed",
        amount: 300,
        accountId: cash.id,
        occurredAt: at("2026-10-02"),
        splits: [
          { categoryId: food, amount: 100 },
          { categoryId: groceries, amount: 200 },
        ],
      });
      expect(transactionCountsByCategory(db)).toMatchObject({
        [food]: 2,
        [groceries]: 1,
      });

      createRule(db, {
        kind: "expense",
        title: "Tiffin",
        amount: 500,
        accountId: cash.id,
        categoryId: groceries,
        frequency: "monthly",
        startDate: "2026-10-01",
      });
      createBudget(db, {
        amount: 1000,
        currency: "INR",
        period: "monthly",
        startAnchor: 1,
        scope: "categories",
        categoryIds: [groceries],
      });
      expect(countCategoryUsage(db, groceries)).toBe(3);
    });

    it("deletes an unused category and restores it unchanged", () => {
      const db = createTestDb();
      const created = createCategory(db, {
        name: "Pets",
        kind: "expense",
        icon: "pawprint.fill",
        color: "brown",
        groupName: "Lifestyle",
      });

      const removed = deleteUnusedCategory(db, created.id);
      expect(removed).toEqual(created);
      expect(getCategory(db, created.id)).toBeUndefined();

      restoreCategory(db, removed);
      expect(getCategory(db, created.id)).toEqual(created);
    });

    it("refuses to delete a category in use", () => {
      const db = createTestDb();
      const { cash } = makeAccounts(db);
      const food = categoryId(db, "Food & Drink");
      createTransaction(db, {
        kind: "expense",
        title: "Lunch",
        amount: 100,
        accountId: cash.id,
        categoryId: food,
        occurredAt: at("2026-10-01"),
      });
      expect(() => deleteUnusedCategory(db, food)).toThrow(ValidationError);
      expect(getCategory(db, food)).toBeDefined();
    });
  });
});
