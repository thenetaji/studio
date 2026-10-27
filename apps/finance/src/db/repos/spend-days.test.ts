/** @jest-environment node */
import { at, categoryId, createTestDb, makeAccounts } from "../test-helpers";
import { createRule, setRulePaused } from "./recurring";
import { billsBetween, expenseDays, firstEntryDay } from "./spend-days";
import { createTransaction } from "./transactions";

describe("expenseDays and firstEntryDay", () => {
  it("lists days with an expense; transfers, income and lending do not count", () => {
    const db = createTestDb();
    const { cash, bank } = makeAccounts(db);
    expect(firstEntryDay(db)).toBeNull();
    const food = categoryId(db, "Food & Drink");
    createTransaction(db, {
      kind: "income",
      amount: 5000,
      accountId: bank.id,
      categoryId: categoryId(db, "Salary"),
      occurredAt: at("2026-10-01"),
    });
    createTransaction(db, {
      kind: "expense",
      amount: 300,
      accountId: cash.id,
      categoryId: food,
      occurredAt: at("2026-10-03"),
    });
    createTransaction(db, {
      kind: "expense",
      amount: 200,
      accountId: cash.id,
      categoryId: food,
      occurredAt: at("2026-10-03", 18),
    });
    createTransaction(db, {
      kind: "transfer",
      amount: 1000,
      accountId: bank.id,
      transferAccountId: cash.id,
      occurredAt: at("2026-10-04"),
    });
    expect(expenseDays(db, "2026-10-01", "2026-10-31")).toEqual(["2026-10-03"]);
    expect(expenseDays(db, "2026-10-04", "2026-10-31")).toEqual([]);
    expect(firstEntryDay(db)).toBe("2026-10-01");
  });
});

describe("billsBetween", () => {
  it("returns unposted expense occurrences of active rules in the range", () => {
    const db = createTestDb();
    const { bank } = makeAccounts(db);
    const bills = categoryId(db, "Bills");
    const rent = createRule(db, {
      kind: "expense",
      title: "Rent",
      amount: 3000000,
      accountId: bank.id,
      categoryId: bills,
      frequency: "monthly",
      startDate: "2026-11-01",
      autoPost: false,
    });
    createRule(db, {
      kind: "expense",
      title: "Gym",
      amount: 150000,
      accountId: bank.id,
      categoryId: bills,
      frequency: "weekly",
      startDate: "2026-10-28",
      autoPost: false,
    });
    createRule(db, {
      kind: "income",
      title: "Salary",
      amount: 9000000,
      accountId: bank.id,
      frequency: "monthly",
      startDate: "2026-10-30",
      autoPost: false,
    });
    expect(
      billsBetween(db, "2026-10-26", "2026-11-04").map((b) => [
        b.dueDate,
        b.title,
      ]),
    ).toEqual([
      ["2026-10-28", "Gym"],
      ["2026-11-01", "Rent"],
      ["2026-11-04", "Gym"],
    ]);
    setRulePaused(db, rent.id, true);
    expect(billsBetween(db, "2026-11-01", "2026-11-01")).toEqual([]);
  });
});
