import {
  DEFAULT_HOME_LAYOUT,
  HOME_SECTION_IDS,
  isDefaultHomeLayout,
  moveHomeSection,
  normalizeHomeLayout,
  setHomeSectionVisible,
} from "./layout";

describe("normalizeHomeLayout", () => {
  it("returns the default for missing or malformed values", () => {
    expect(normalizeHomeLayout(undefined)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout("nope")).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeHomeLayout([null, 3, {}])).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it("keeps the stored order, drops unknown and duplicate ids, and appends missing sections", () => {
    const layout = normalizeHomeLayout([
      { id: "recent", visible: false },
      { id: "widgets", visible: true },
      { id: "quick_add", visible: true },
      { id: "recent", visible: true },
    ]);
    expect(layout.map((s) => s.id)).toEqual([
      "recent",
      "quick_add",
      "pockets",
      ...HOME_SECTION_IDS.filter(
        (id) => id !== "recent" && id !== "quick_add" && id !== "pockets",
      ),
    ]);
    expect(layout[0]).toEqual({ id: "recent", visible: false });
    expect(layout.slice(1).every((s) => s.visible)).toBe(true);
  });

  it("replaces Coming up with Budgets and Upcoming bills in place, and drops Summary", () => {
    const layout = normalizeHomeLayout([
      { id: "quick_add", visible: true },
      { id: "stats", visible: true },
      { id: "pockets", visible: true },
      { id: "coming_up", visible: false },
      { id: "heatmap", visible: true },
      { id: "top_categories", visible: true },
      { id: "recent", visible: true },
    ]);
    expect(layout).toEqual([
      { id: "quick_add", visible: true },
      { id: "pockets", visible: true },
      { id: "budgets", visible: false },
      { id: "bills", visible: false },
      { id: "heatmap", visible: true },
      { id: "top_categories", visible: true },
      { id: "recent", visible: true },
    ]);
  });

  it("treats anything but an explicit false as visible", () => {
    expect(normalizeHomeLayout([{ id: "heatmap" }])[0]).toEqual({
      id: "heatmap",
      visible: true,
    });
  });
});

describe("moveHomeSection", () => {
  it("swaps neighbours and ignores moves past either end", () => {
    const moved = moveHomeSection(DEFAULT_HOME_LAYOUT, 1, -1);
    expect(moved.slice(0, 2).map((s) => s.id)).toEqual([
      "pockets",
      "quick_add",
    ]);
    expect(moveHomeSection(DEFAULT_HOME_LAYOUT, 0, -1)).toEqual(
      DEFAULT_HOME_LAYOUT,
    );
    expect(
      moveHomeSection(DEFAULT_HOME_LAYOUT, DEFAULT_HOME_LAYOUT.length - 1, 1),
    ).toEqual(DEFAULT_HOME_LAYOUT);
  });
});

describe("isDefaultHomeLayout", () => {
  it("is false once a section is hidden or moved", () => {
    expect(isDefaultHomeLayout(DEFAULT_HOME_LAYOUT)).toBe(true);
    expect(
      isDefaultHomeLayout(
        setHomeSectionVisible(DEFAULT_HOME_LAYOUT, "recent", false),
      ),
    ).toBe(false);
    expect(
      isDefaultHomeLayout(moveHomeSection(DEFAULT_HOME_LAYOUT, 2, 1)),
    ).toBe(false);
  });
});
