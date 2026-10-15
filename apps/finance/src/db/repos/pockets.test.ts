/** @jest-environment node */
import { at, categoryId, createTestDb, makeAccounts } from "../test-helpers";
import { normalizePockets, pocketStatus } from "./pockets";
import { createTransaction } from "./transactions";

describe("pockets", () => {
  it("carries leftover into the next refill and ignores other accounts", () => {
    const db = createTestDb();
    const { cash, bank } = makeAccounts(db);
    const groceries = categoryId(db, "Groceries");
    expect(pocketStatus(db, cash.id).refill).toBeNull();
    createTransaction(db, {
      kind: "transfer",
      amount: 5000,
      accountId: bank.id,
      transferAccountId: cash.id,
      occurredAt: at("2026-10-01"),
    });
    createTransaction(db, {
      kind: "expense",
      amount: 900,
      accountId: cash.id,
      categoryId: groceries,
      occurredAt: at("2026-10-03"),
    });
    createTransaction(db, {
      kind: "transfer",
      amount: 6000,
      accountId: bank.id,
      transferAccountId: cash.id,
      occurredAt: at("2026-10-10"),
    });
    createTransaction(db, {
      kind: "expense",
      amount: 1500,
      accountId: cash.id,
      categoryId: groceries,
      occurredAt: at("2026-10-11"),
    });
    // Spending from another account does not touch the pocket.
    createTransaction(db, {
      kind: "expense",
      amount: 700,
      accountId: bank.id,
      categoryId: groceries,
      occurredAt: at("2026-10-12"),
    });
    // 5000 - 900 = 4100 left, + 6000 refill = 10100, - 1500 = 8600.
    expect(pocketStatus(db, cash.id)).toEqual({
      refill: 6000,
      refilledAt: at("2026-10-10"),
      total: 10100,
      spent: 1500,
      left: 8600,
    });
  });

  it("drops malformed and duplicate entries", () => {
    expect(
      normalizePockets([
        { accountId: "a", amount: 100, fromAccountId: "b" },
        { accountId: "a", amount: 200 },
        { accountId: "c", amount: 0 },
        { accountId: "d", amount: 1.5 },
        null,
      ]),
    ).toEqual([{ accountId: "a", amount: 100, fromAccountId: "b" }]);
    expect(normalizePockets("nope")).toEqual([]);
  });
});
