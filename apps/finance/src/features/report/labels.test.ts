import { daysText, rangeText } from "@/features/calendar/no-spend-labels";

import {
  comparedNote,
  monthParam,
  percentChange,
  pointsChange,
  rateText,
  reportPeriod,
} from "./labels";

const S1 = { weekStart: 1, monthStart: 1 };
const S25 = { weekStart: 1, monthStart: 25 };
const TODAY = "2026-10-26";

describe("reportPeriod", () => {
  it("reads YYYY-MM, current and last", () => {
    expect(reportPeriod("2026-08", TODAY, S1)).toEqual({
      type: "month",
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(reportPeriod("current", TODAY, S1).from).toBe("2026-10-01");
    expect(reportPeriod("last", TODAY, S1)).toEqual({
      type: "month",
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(reportPeriod(undefined, TODAY, S1).from).toBe("2026-10-01");
    expect(reportPeriod("2026-13", TODAY, S1).from).toBe("2026-10-01");
  });
  it("never goes past the current month", () => {
    expect(reportPeriod("2027-01", TODAY, S1).from).toBe("2026-10-01");
  });
  it("honours a custom month start", () => {
    expect(reportPeriod("2026-09", TODAY, S25)).toEqual({
      type: "month",
      from: "2026-09-25",
      to: "2026-10-24",
    });
    expect(reportPeriod("current", TODAY, S25).from).toBe("2026-10-25");
    expect(reportPeriod("last", TODAY, S25).from).toBe("2026-09-25");
    expect(monthParam(reportPeriod("2026-09", TODAY, S25))).toBe("2026-09");
  });
});

describe("change text", () => {
  it("signs percentages and points with a true minus", () => {
    expect(percentChange(12)).toBe("+12%");
    expect(percentChange(-12)).toBe("−12%");
    expect(percentChange(0)).toBe("No change");
    expect(percentChange(null)).toBeNull();
    expect(pointsChange(-4)).toBe("−4 pts");
    expect(pointsChange(null)).toBeNull();
    expect(rateText(null)).toBe("—");
    expect(rateText(-5)).toBe("−5%");
  });
  it("says what is compared", () => {
    expect(
      comparedNote({
        current: { from: "2026-10-01", to: "2026-10-31" },
        previous: { from: "2026-09-01", to: "2026-09-30" },
        partial: false,
      }),
    ).toBe("Compared with September");
    expect(
      comparedNote({
        current: { from: "2026-10-01", to: "2026-10-26" },
        previous: { from: "2026-09-01", to: "2026-09-26" },
        partial: true,
      }),
    ).toBe("1–26 Oct compared with 1–26 Sep");
  });
});

describe("no-spend labels", () => {
  it("formats day counts and ranges", () => {
    expect(daysText(1)).toBe("1 day");
    expect(daysText(0)).toBe("0 days");
    expect(rangeText("2026-10-12", "2026-10-12")).toBe("12 Oct");
    expect(rangeText("2026-09-28", "2026-10-03")).toBe("28 Sep – 3 Oct");
    expect(rangeText("2025-12-30", "2026-01-02")).toBe(
      "30 Dec 2025 – 2 Jan 2026",
    );
  });
});
