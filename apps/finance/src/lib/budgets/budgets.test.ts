import {
  budgetPace,
  elapsedDays,
  paceLabel,
  projectedSpend,
  type PaceInput,
} from "./pace";
import { rolloverCarry } from "./rollover";

const base: PaceInput = {
  spent: 0,
  available: 30000,
  upcoming: 0,
  recurringSpent: 0,
  totalDays: 30,
  elapsedDays: 15,
};

describe("rolloverCarry", () => {
  it("is zero with no previous periods", () => {
    expect(rolloverCarry(5000, [])).toBe(0);
  });

  it("carries unspent and overspent amounts forward, chaining", () => {
    expect(rolloverCarry(5000, [3800])).toBe(1200);
    expect(rolloverCarry(5000, [6000])).toBe(-1000);
    // 1,200 left, then 5,000 + 1,200 - 7,000 = -800.
    expect(rolloverCarry(5000, [3800, 7000])).toBe(-800);
    expect(rolloverCarry(5000, [0, 0, 0])).toBe(15000);
  });
});

describe("elapsedDays", () => {
  const october = { from: "2026-10-01", to: "2026-10-31" };
  it("counts today and clamps to the period", () => {
    expect(elapsedDays(october, "2026-10-01")).toBe(1);
    expect(elapsedDays(october, "2026-10-16")).toBe(16);
    expect(elapsedDays(october, "2026-09-30")).toBe(0);
    expect(elapsedDays(october, "2026-11-02")).toBe(31);
  });
});

describe("projectedSpend", () => {
  it("extrapolates the day-to-day rate over the remaining days", () => {
    // 10,000 over 15 days, 15 days to go.
    expect(projectedSpend({ ...base, spent: 10000 })).toBe(20000);
  });

  it("does not extrapolate recurring spend, and adds what is still due", () => {
    expect(
      projectedSpend({
        ...base,
        spent: 20000,
        recurringSpent: 15000,
        upcoming: 2000,
      }),
    ).toBe(20000 + 2000 + 5000);
  });

  it("uses a minimum window early in the period", () => {
    // Day 1 of 30: the window is 3 days, not 1.
    expect(projectedSpend({ ...base, spent: 3000, elapsedDays: 1 })).toBe(
      3000 + 29000,
    );
  });

  it("is the spend itself once the period has ended, and only what is due before it starts", () => {
    expect(projectedSpend({ ...base, spent: 9000, elapsedDays: 30 })).toBe(
      9000,
    );
    expect(projectedSpend({ ...base, upcoming: 4000, elapsedDays: 0 })).toBe(
      4000,
    );
  });
});

describe("budgetPace", () => {
  it("is on track while the projection fits", () => {
    const pace = budgetPace({ ...base, spent: 12000, upcoming: 3000 });
    expect(pace.status).toBe("on_track");
    expect(pace.ratio).toBeCloseTo(0.4);
    expect(pace.upcomingRatio).toBeCloseTo(0.1);
  });

  it("is at risk once the projection passes the limit", () => {
    const pace = budgetPace({ ...base, spent: 16000 });
    expect(pace.projected).toBe(32000);
    expect(pace.status).toBe("at_risk");
  });

  it("counts expected bills toward the projection", () => {
    expect(budgetPace({ ...base, spent: 12000 }).status).toBe("on_track");
    expect(budgetPace({ ...base, spent: 12000, upcoming: 7000 }).status).toBe(
      "at_risk",
    );
  });

  it("is over once spending passes the available amount", () => {
    const pace = budgetPace({ ...base, spent: 31000, upcoming: 5000 });
    expect(pace.status).toBe("over");
    expect(pace.ratio).toBeGreaterThan(1);
    expect(pace.upcomingRatio).toBe(0);
  });

  it("is over when a rollover deficit leaves nothing available", () => {
    const pace = budgetPace({ ...base, available: -2000 });
    expect(pace.status).toBe("over");
    expect(pace.ratio).toBe(1);
  });

  it("trims the upcoming segment to the bar", () => {
    const pace = budgetPace({ ...base, spent: 24000, upcoming: 12000 });
    expect(pace.ratio + pace.upcomingRatio).toBeCloseTo(1);
  });
});

describe("paceLabel", () => {
  it("always names the status", () => {
    expect(paceLabel("on_track")).toBe("On track");
    expect(paceLabel("at_risk")).toBe("At risk");
    expect(paceLabel("over")).toBe("Over");
    expect(paceLabel("on_track", true)).toBe("Under budget");
    expect(paceLabel("over", true)).toBe("Over budget");
  });
});
