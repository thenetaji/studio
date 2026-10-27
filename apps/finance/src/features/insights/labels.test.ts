import { periodFor } from "@studio/dates";
import {
  deltaLine,
  flowAmount,
  flowScrub,
  monthlyScrub,
  peakCaption,
  percentText,
  previousLabel,
  previousName,
  scrubLabel,
  trendBadge,
  trendLabel,
  weekdayShort,
} from "./labels";

const october = periodFor("month", "2026-10-05");

describe("deltaLine", () => {
  it("marks a fall in spending as good, with a real minus", () => {
    expect(deltaLine({ amount: -1, percent: -12 }, october, "expense")).toEqual(
      { text: "−12% vs September", good: true },
    );
  });
  it("keeps a rise in spending plain", () => {
    expect(deltaLine({ amount: 1, percent: 8 }, october, "expense")).toEqual({
      text: "+8% vs September",
      good: false,
    });
  });
  it("inverts for income", () => {
    expect(deltaLine({ amount: 1, percent: 8 }, october, "income")?.good).toBe(
      true,
    );
  });
  it("offers the same change in money for the tap-to-toggle", () => {
    expect(
      deltaLine({ amount: -12196, percent: -20 }, october, "expense", {
        currency: "INR",
        locale: "en-IN",
      })?.alt,
    ).toBe("−₹122 vs September");
  });
  it("is null without a baseline and says no change at zero", () => {
    expect(
      deltaLine({ amount: 5, percent: null }, october, "expense"),
    ).toBeNull();
    expect(deltaLine({ amount: 0, percent: 0 }, october, "expense")?.text).toBe(
      "No change vs September",
    );
  });
});

describe("labels", () => {
  it("names the comparison period", () => {
    expect(previousLabel(periodFor("week", "2026-10-05"))).toBe("vs last week");
    expect(previousLabel(periodFor("year", "2026-10-05"))).toBe("vs 2025");
  });
  it("formats scrub labels", () => {
    expect(
      scrubLabel({ key: "2026-10-07", amount: 124000 }, "day", "INR", "en-IN"),
    ).toBe("Wed 7 · ₹1,240");
    expect(
      scrubLabel(
        { key: "2026-10-01", amount: 1240000 },
        "month",
        "INR",
        "en-IN",
      ),
    ).toBe("Oct · ₹12,400");
  });
  it("labels trend bars", () => {
    expect(trendLabel(october)).toBe("Oct");
    expect(trendLabel(periodFor("week", "2026-10-05"))).toBe(
      "5 Oct".replace("5", "5"),
    );
    expect(trendLabel(periodFor("year", "2026-10-05"))).toBe("2026");
  });
});

describe("extras labels", () => {
  it("names the peak weekday", () => {
    expect(peakCaption(6)).toBe("Most on Saturdays");
    expect(weekdayShort(1)).toBe("Mon");
  });
  it("formats rates", () => {
    expect(percentText(null)).toBe("—");
    expect(percentText(61)).toBe("61%");
    expect(percentText(-12)).toBe("−12%");
  });
  it("writes the monthly scrub label", () => {
    expect(
      monthlyScrub(
        { key: "2026-09-01", income: 14500000, spent: 5760000 },
        "INR",
        "en-IN",
      ),
    ).toBe("Sep · In ₹1.5L · Out ₹57.6K · Net ₹87.4K");
  });
});

describe("flowScrub", () => {
  it("reads a spending-only day with a real minus on the net", () => {
    expect(
      flowScrub(
        { key: "2026-10-06", income: 0, spent: 124000 },
        "day",
        "INR",
        "en-IN",
      ),
    ).toBe("Tue 6 · In ₹0 · Out ₹1,240 · Net −₹1,240");
  });
  it("goes compact for big amounts and names months for yearly series", () => {
    expect(
      flowScrub(
        { key: "2026-09-01", income: 14500000, spent: 5760000 },
        "month",
        "INR",
        "en-IN",
      ),
    ).toBe("Sep · In ₹1.5L · Out ₹57.6K · Net ₹87.4K");
    expect(flowAmount(999900, "INR", "en-IN")).toBe("₹9,999");
  });
});

describe("trendBadge and previousName", () => {
  const money = { currency: "INR", locale: "en-IN" };
  const base = { average: 410000, spark: [1, 2, 3] };
  it("marks a fall in spending as good", () => {
    const badge = trendBadge(
      { ...base, direction: "down", percent: -12 },
      "expense",
      "September",
      money,
    );
    expect(badge).toMatchObject({ text: "12%", arrow: "down", good: true });
    expect(badge.speech).toBe(
      "down 12 percent on September, 3 period average ₹4,100",
    );
  });
  it("marks a rise in income as good and handles new and flat", () => {
    expect(
      trendBadge({ ...base, direction: "up", percent: 5 }, "income", "x", money)
        .good,
    ).toBe(true);
    expect(
      trendBadge({ ...base, direction: "new", percent: null }, "expense", "x", money),
    ).toMatchObject({ text: "New", arrow: null });
    expect(
      trendBadge({ ...base, direction: "flat", percent: 0 }, "expense", "x", money)
        .text,
    ).toBe("Same");
  });
  it("names the previous period", () => {
    expect(
      previousName({ type: "month", from: "2026-10-01", to: "2026-10-31" }),
    ).toBe("September");
    expect(
      previousName({ type: "week", from: "2026-10-19", to: "2026-10-25" }),
    ).toBe("last week");
    expect(
      previousName({ type: "year", from: "2026-01-01", to: "2026-12-31" }),
    ).toBe("2025");
    expect(
      previousName({ type: "custom", from: "2026-10-01", to: "2026-10-10" }),
    ).toBe("the previous 10 days");
  });
});
