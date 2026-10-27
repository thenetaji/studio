import {
  currentStreak,
  dayStatus,
  longestStreak,
  noSpendDays,
  noSpendSummary,
  trackedDays,
  type NoSpendInput,
} from "./no-spend";

const input = (
  spend: string[],
  since: string | null = "2026-10-01",
  today = "2026-10-10",
): NoSpendInput => ({ spendDays: new Set(spend), since, today });

describe("dayStatus", () => {
  const i = input(["2026-10-03", "2026-10-10"]);
  it("separates future, untracked, spend and no-spend days", () => {
    expect(dayStatus("2026-10-11", i)).toBe("future");
    expect(dayStatus("2026-09-30", i)).toBe("untracked");
    expect(dayStatus("2026-10-03", i)).toBe("spend");
    expect(dayStatus("2026-10-04", i)).toBe("no-spend");
  });
  it("treats today with nothing spent as no-spend so far", () => {
    expect(dayStatus("2026-10-09", input([], "2026-10-01", "2026-10-09"))).toBe(
      "no-spend",
    );
    expect(dayStatus("2026-10-10", i)).toBe("spend");
  });
  it("tracks nothing without any entries", () => {
    expect(dayStatus("2026-10-05", input([], null))).toBe("untracked");
    expect(
      noSpendDays({ from: "2026-10-01", to: "2026-10-31" }, input([], null)),
    ).toEqual([]);
  });
});

describe("noSpendDays", () => {
  it("lists quiet days between the first entry and today only", () => {
    const i = input(
      ["2026-10-02", "2026-10-03", "2026-10-08"],
      "2026-10-02",
      "2026-10-09",
    );
    expect(noSpendDays({ from: "2026-10-01", to: "2026-10-31" }, i)).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-09",
    ]);
    expect(trackedDays({ from: "2026-10-01", to: "2026-10-31" }, i)).toBe(8);
  });
  it("returns nothing for a month entirely in the future", () => {
    expect(
      noSpendDays({ from: "2026-11-01", to: "2026-11-30" }, input([])),
    ).toEqual([]);
    expect(
      trackedDays({ from: "2026-11-01", to: "2026-11-30" }, input([])),
    ).toBe(0);
  });
});

describe("currentStreak", () => {
  it("counts back from today through quiet days", () => {
    const s = currentStreak(input(["2026-10-06"]));
    expect(s).toEqual({ length: 4, from: "2026-10-07", to: "2026-10-10" });
  });
  it("is zero once something is spent today", () => {
    expect(currentStreak(input(["2026-10-10"])).length).toBe(0);
  });
  it("stops at the first tracked day", () => {
    expect(currentStreak(input([], "2026-10-08")).length).toBe(3);
  });
});

describe("longestStreak", () => {
  it("finds the longest run and prefers the most recent on ties", () => {
    // Quiet: 1-2, 4-5, 7-10 (today).
    const i = input(["2026-10-03", "2026-10-06"]);
    expect(longestStreak(i)).toEqual({
      length: 4,
      from: "2026-10-07",
      to: "2026-10-10",
    });
    const tie = input(["2026-10-03", "2026-10-06", "2026-10-09", "2026-10-10"]);
    expect(longestStreak(tie)).toEqual({
      length: 2,
      from: "2026-10-07",
      to: "2026-10-08",
    });
  });
  it("clips runs to the range", () => {
    const i = input(["2026-10-09"], "2026-09-20", "2026-10-10");
    expect(longestStreak(i, { from: "2026-10-01", to: "2026-10-31" })).toEqual({
      length: 8,
      from: "2026-10-01",
      to: "2026-10-08",
    });
    expect(longestStreak(i).length).toBe(19);
  });
  it("is empty when every day has spending", () => {
    const days = Array.from(
      { length: 10 },
      (_, d) => `2026-10-${String(d + 1).padStart(2, "0")}`,
    );
    expect(longestStreak(input(days))).toEqual({
      length: 0,
      from: null,
      to: null,
    });
  });
});

describe("noSpendSummary", () => {
  it("combines current, best and the month count", () => {
    const s = noSpendSummary(
      { from: "2026-10-01", to: "2026-10-31" },
      input(["2026-10-01", "2026-10-05"], "2026-09-28"),
    );
    expect(s.current.length).toBe(5);
    expect(s.best.length).toBe(5);
    expect(s.monthDays).toBe(8);
    expect(s.monthTracked).toBe(10);
  });
});
