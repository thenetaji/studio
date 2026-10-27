import { billsDue, leftThisMonth, safePerDay } from "./overview";

describe("leftThisMonth", () => {
  it("is income minus spending minus bills without a budget", () => {
    expect(
      leftThisMonth({ earned: 100000, spent: 40000, bills: 15000 }),
    ).toEqual({ basis: "income", left: 45000 });
  });

  it("goes negative once spending passes income", () => {
    expect(leftThisMonth({ earned: 0, spent: 4000, bills: 1000 }).left).toBe(
      -5000,
    );
  });

  it("uses the all-spending budget when there is one", () => {
    expect(
      leftThisMonth({
        earned: 100000,
        spent: 40000,
        bills: 15000,
        budget: { available: 75000, spent: 42000, bills: 15000 },
      }),
    ).toEqual({ basis: "budget", left: 18000 });
  });
});

describe("safePerDay", () => {
  it("spreads what is left over the remaining days, rounded down", () => {
    expect(safePerDay(18200, 15)).toBe(1213);
    expect(safePerDay(-500, 10)).toBe(0);
    expect(safePerDay(1000, 0)).toBe(0);
  });
});

describe("billsDue", () => {
  const occurrences = [
    { dueDate: "2026-10-20", kind: "expense", amount: 64900, currency: "INR" },
    { dueDate: "2026-10-25", kind: "income", amount: 100000, currency: "INR" },
    { dueDate: "2026-10-28", kind: "expense", amount: 1200, currency: "USD" },
    { dueDate: "2026-11-02", kind: "expense", amount: 5000, currency: "INR" },
    { dueDate: "2026-10-29", kind: "expense", amount: 500, currency: "EUR" },
  ];
  const convert = (minor: number, currency: string) =>
    currency === "INR" ? minor : currency === "USD" ? minor * 84 : null;

  it("sums expense occurrences in range, converted, skipping unpriced ones", () => {
    expect(
      billsDue(occurrences, { from: "2026-10-16", to: "2026-10-31" }, convert),
    ).toBe(64900 + 1200 * 84);
  });
});
