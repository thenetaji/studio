/** @jest-environment node */
import { createTestDb } from "../test-helpers";
import { deleteRate, convert, getRate, listRates, setRate } from "./fx";
import {
  DEFAULT_SETTINGS,
  getAllSettings,
  getSetting,
  ICON_BACKGROUNDS,
  ICON_STYLES,
  SETTING_KEYS,
  setSetting,
  SYNC_PROVIDER_IDS,
} from "./settings";
import { categories, settings } from "../schema";
import { seedDefaults } from "../seed";

describe("settings", () => {
  it("defines a default for every spec key", () => {
    expect(SETTING_KEYS.sort()).toEqual(
      [
        "display_currency",
        "theme",
        "accent",
        "haptics",
        "show_decimals",
        "week_start",
        "month_start",
        "default_account_id",
        "lock_enabled",
        "lock_timeout_s",
        "last_kind",
        "last_account_id",
        "onboarding_done",
        "schema_seeded",
        "recent_searches",
        "icon_style",
        "icon_background",
        "home_layout",
        "pockets",
        "hide_amounts",
        "reminder_daily_enabled",
        "reminder_daily_time",
        "reminder_bills",
        "reminder_budgets",
        "reminder_budget_fired",
        "sync_provider",
        "last_backup_at",
      ].sort(),
    );
  });

  it("round-trips typed values and falls back to defaults", () => {
    const db = createTestDb({ seed: false });
    expect(getSetting(db, "week_start")).toBe(1);
    expect(getSetting(db, "recent_searches")).toEqual([]);
    setSetting(db, "week_start", 7);
    setSetting(db, "recent_searches", ["swiggy", "340"]);
    setSetting(db, "default_account_id", "abc");
    setSetting(db, "week_start", 1);
    expect(getSetting(db, "week_start")).toBe(1);
    expect(getSetting(db, "recent_searches")).toEqual(["swiggy", "340"]);
    expect(getAllSettings(db)).toEqual({
      ...DEFAULT_SETTINGS,
      recent_searches: ["swiggy", "340"],
      default_account_id: "abc",
    });
  });

  it("survives corrupt stored JSON", () => {
    const db = createTestDb({ seed: false });
    db.insert(settings).values({ key: "theme", value: "{oops" }).run();
    expect(getSetting(db, "theme")).toBe("system");
  });

  it("repairs a stored Home layout from an older or newer build", () => {
    const db = createTestDb({ seed: false });
    db.insert(settings)
      .values({
        key: "home_layout",
        value: JSON.stringify([
          { id: "recent", visible: false },
          { id: "widgets", visible: true },
        ]),
      })
      .run();
    const layout = getSetting(db, "home_layout");
    expect(layout[0]).toEqual({ id: "recent", visible: false });
    expect(layout.map((s) => s.id).sort()).toEqual(
      DEFAULT_SETTINGS.home_layout.map((s) => s.id).sort(),
    );
  });

  it("seeds idempotently without clobbering user changes", () => {
    const db = createTestDb();
    setSetting(db, "theme", "dark");
    seedDefaults(db);
    seedDefaults(db);
    expect(getSetting(db, "theme")).toBe("dark");
    expect(getSetting(db, "schema_seeded")).toBe(true);
    expect(db.select().from(categories).all()).toHaveLength(19);
    expect(db.select().from(settings).all()).toHaveLength(SETTING_KEYS.length);
  });
});

describe("fx", () => {
  it("stores rates, upserts, converts for display and handles the inverse", () => {
    const db = createTestDb();
    expect(getRate(db, "USD", "INR")).toBeNull();
    setRate(db, "USD", "INR", 83.2, 1);
    setRate(db, "USD", "INR", 84, 2);
    expect(listRates(db)).toEqual([
      { base: "USD", quote: "INR", rate: 84, updatedAt: 2 },
    ]);
    expect(convert(db, 1000, "USD", "INR")).toBe(84000);
    expect(getRate(db, "INR", "USD")).toBeCloseTo(1 / 84, 10);
    expect(convert(db, 8400, "INR", "USD")).toBe(100);
    expect(convert(db, 500, "EUR", "INR")).toBe(500);
    expect(convert(db, 500, "INR", "INR")).toBe(500);
    deleteRate(db, "USD", "INR");
    expect(getRate(db, "USD", "INR")).toBeNull();
  });

  it("rejects non-positive rates", () => {
    const db = createTestDb();
    expect(() => setRate(db, "USD", "INR", 0)).toThrow(RangeError);
    expect(() => setRate(db, "USD", "INR", Number.NaN)).toThrow(RangeError);
  });
});

describe("feature settings", () => {
  it("have typed defaults", () => {
    const db = createTestDb();
    expect(getAllSettings(db)).toMatchObject({
      icon_style: "phosphor-duotone",
      icon_background: "graphite-glyph",
      hide_amounts: false,
      reminder_daily_enabled: false,
      reminder_daily_time: "21:00",
      reminder_bills: true,
      reminder_budgets: true,
      sync_provider: "none",
      last_backup_at: null,
    });
  });

  it("round-trips each enum value and null timestamps", () => {
    const db = createTestDb();
    for (const style of ICON_STYLES) {
      setSetting(db, "icon_style", style);
      expect(getSetting(db, "icon_style")).toBe(style);
    }
    for (const background of ICON_BACKGROUNDS) {
      setSetting(db, "icon_background", background);
      expect(getSetting(db, "icon_background")).toBe(background);
    }
    for (const provider of SYNC_PROVIDER_IDS) {
      setSetting(db, "sync_provider", provider);
      expect(getSetting(db, "sync_provider")).toBe(provider);
    }
    setSetting(db, "last_backup_at", 1_700_000_000_000);
    expect(getSetting(db, "last_backup_at")).toBe(1_700_000_000_000);
    setSetting(db, "last_backup_at", null);
    expect(getSetting(db, "last_backup_at")).toBeNull();
    setSetting(db, "reminder_daily_time", "07:30");
    expect(getSetting(db, "reminder_daily_time")).toBe("07:30");
  });

  it("falls back to the default for stored values that are no longer valid", () => {
    const db = createTestDb({ seed: false });
    db.insert(settings)
      .values([
        { key: "icon_style", value: '"retro"' },
        { key: "icon_background", value: "42" },
        { key: "sync_provider", value: '"dropbox"' },
        { key: "reminder_daily_time", value: '"25:99"' },
      ])
      .run();
    expect(getSetting(db, "icon_style")).toBe("phosphor-duotone");
    expect(getSetting(db, "icon_background")).toBe("graphite-glyph");
    expect(getSetting(db, "sync_provider")).toBe("none");
    expect(getSetting(db, "reminder_daily_time")).toBe("21:00");
  });
});
