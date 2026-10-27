import {
  evenPace,
  spendCurveDayAt,
  spendCurveGeometry,
  SPEND_CURVE_HEADROOM,
} from "./spend-curve";

describe("spendCurveGeometry", () => {
  it("frames the whole period and starts both lines at the baseline", () => {
    const geo = spendCurveGeometry(
      [100, 300],
      [100, 200, 300, 400],
      4,
      400,
      0,
      100,
    );
    expect(geo.actual[0]).toEqual([0, 100]);
    expect(geo.reference[0]).toEqual([0, 100]);
    expect(geo.actual).toHaveLength(3);
    expect(geo.reference).toHaveLength(5);
    // Day 2 of 4 ends halfway across.
    expect(geo.end?.[0]).toBe(200);
    // The last reference point reaches the right edge at the top less headroom.
    const last = geo.reference[4]!;
    expect(last[0]).toBe(400);
    expect(last[1]).toBeCloseTo(100 - 100 / SPEND_CURVE_HEADROOM);
    expect(geo.actualSegments).toHaveLength(2);
  });

  it("has no end before anything has elapsed, and no reference segments without a reference", () => {
    const geo = spendCurveGeometry([], [], 30, 300, 0, 100);
    expect(geo.end).toBeNull();
    expect(geo.referenceSegments).toEqual([]);
    expect(geo.yMax).toBeGreaterThan(0);
  });
});

describe("spendCurveDayAt", () => {
  it("maps x to the day under it, clamped", () => {
    expect(spendCurveDayAt(0, 310, 31)).toBe(0);
    expect(spendCurveDayAt(155, 310, 31)).toBe(15);
    expect(spendCurveDayAt(400, 310, 31)).toBe(30);
    expect(spendCurveDayAt(-5, 310, 31)).toBe(0);
    expect(spendCurveDayAt(10, 0, 31)).toBe(-1);
  });
});

describe("evenPace", () => {
  it("climbs evenly to the total", () => {
    expect(evenPace(3000, 3)).toEqual([1000, 2000, 3000]);
    expect(evenPace(1000, 3)).toEqual([333, 667, 1000]);
    expect(evenPace(1000, 0)).toEqual([]);
  });
});
