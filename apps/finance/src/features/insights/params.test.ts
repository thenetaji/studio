import { DEFAULT_PERIOD_SETTINGS } from "@studio/dates";
import {
  canStepForward,
  contextParams,
  parseContext,
  parseBreakdownBy,
  parseInsightsParams,
  parseScope,
  periodOf,
  stepView,
} from "./params";

const today = "2026-10-05";
const settings = DEFAULT_PERIOD_SETTINGS;

describe("parseInsightsParams", () => {
  it("defaults to this month, both kinds", () => {
    const { view, select } = parseInsightsParams({}, today, settings);
    expect(view.type).toBe("month");
    expect(view.kind).toBe("both");
    expect(periodOf(view, settings)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(select).toBeNull();
  });
  it("reads period, kind and select", () => {
    const { view, select } = parseInsightsParams(
      { period: "year", kind: "income", select: "Groceries" },
      today,
      settings,
    );
    expect(view.type).toBe("year");
    expect(view.kind).toBe("income");
    expect(select).toBe("Groceries");
    expect(periodOf(view, settings)).toMatchObject({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });
  it("applies a non-positive offset in whole periods", () => {
    const { view } = parseInsightsParams({ offset: "-1" }, today, settings);
    expect(periodOf(view, settings)).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    const clamped = parseInsightsParams({ offset: "5" }, today, settings);
    expect(periodOf(clamped.view, settings).from).toBe("2026-10-01");
  });
  it("ignores garbage and requires both dates for custom", () => {
    expect(
      parseInsightsParams(
        { period: "decade", kind: "x", offset: "abc" },
        today,
        settings,
      ).view.type,
    ).toBe("month");
    expect(
      parseInsightsParams(
        { period: "custom", from: "2026-10-01" },
        today,
        settings,
      ).view.type,
    ).toBe("month");
    const { view } = parseInsightsParams(
      { period: "custom", from: "2026-10-01", to: "2026-10-10" },
      today,
      settings,
    );
    expect(periodOf(view, settings)).toMatchObject({
      type: "custom",
      from: "2026-10-01",
      to: "2026-10-10",
    });
  });
});

describe("stepView", () => {
  it("steps months and custom ranges", () => {
    const { view } = parseInsightsParams({}, today, settings);
    const back = stepView(view, -1, settings);
    expect(periodOf(back, settings).from).toBe("2026-09-01");
    expect(canStepForward(back, today, settings)).toBe(true);
    expect(canStepForward(view, today, settings)).toBe(false);
    const custom = parseInsightsParams(
      { period: "custom", from: "2026-09-01", to: "2026-09-10" },
      today,
      settings,
    ).view;
    expect(periodOf(stepView(custom, 1, settings), settings)).toMatchObject({
      from: "2026-09-11",
      to: "2026-09-20",
    });
  });
});

describe("parseBreakdownBy", () => {
  it("accepts known dimensions and falls back to category", () => {
    expect(parseBreakdownBy("group")).toBe("group");
    expect(parseBreakdownBy("tag")).toBe("tag");
    expect(parseBreakdownBy("nope")).toBe("category");
    expect(parseBreakdownBy(undefined)).toBe("category");
  });
});

describe("parseScope", () => {
  it("reads account and tag, treating blanks as everything", () => {
    expect(parseScope({ account: "a1", tag: "t1" })).toEqual({
      accountId: "a1",
      tagId: "t1",
    });
    expect(parseScope({ account: "" })).toEqual({
      accountId: null,
      tagId: null,
    });
  });
});

describe("contextParams and parseContext", () => {
  it("round-trips a period, kind and scope", () => {
    const context = {
      period: { type: "week" as const, from: "2026-10-19", to: "2026-10-25" },
      kind: "income" as const,
      scope: { accountId: "acc", tagId: null },
    };
    const params = contextParams(context);
    expect(params).toEqual({
      from: "2026-10-19",
      to: "2026-10-25",
      type: "week",
      kind: "income",
      account: "acc",
    });
    expect(parseContext(params, "2026-10-26", settings)).toEqual(context);
  });
  it("falls back to this month for junk", () => {
    expect(
      parseContext({ from: "x", to: "2026-10-01" }, "2026-10-26", settings),
    ).toEqual({
      period: { type: "month", from: "2026-10-01", to: "2026-10-31" },
      kind: "expense",
      scope: { accountId: null, tagId: null },
    });
  });
});
