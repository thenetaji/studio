import { eq } from "drizzle-orm";
import { settings } from "../schema";
import type { Db } from "../types";

import {
  ICON_BACKGROUNDS,
  ICON_STYLES,
  type IconBackground,
  type IconStyle,
} from "@studio/icons";
import {
  accentPresets,
  palettes,
  type AccentPresetKey,
  type CategoryMode,
  type PaletteKey,
} from "@studio/theme";
import { normalizePockets, type Pocket } from "./pockets";
import {
  DEFAULT_HOME_LAYOUT,
  normalizeHomeLayout,
  type HomeSectionPref,
} from "@/lib/home/layout";

export { ICON_BACKGROUNDS, ICON_STYLES };
export type { IconBackground, IconStyle };
export type SyncProviderId = "none" | "icloud" | "gdrive";

export const SYNC_PROVIDER_IDS: readonly SyncProviderId[] = [
  "none",
  "icloud",
  "gdrive",
];

export interface SettingsMap {
  display_currency: string;
  theme: "system" | "light" | "dark";
  /** Accent colour preset. */
  accent: AccentPresetKey;
  /** Surface palette: System (Apple neutral), Titanium or Paper. */
  palette: PaletteKey;
  /** Categories in mono greys (default) or in colour. */
  category_colors: CategoryMode;
  haptics: boolean;
  show_decimals: boolean;
  week_start: 1 | 7;
  month_start: number;
  default_account_id: string | null;
  lock_enabled: boolean;
  lock_timeout_s: 0 | 60 | 300;
  last_kind: "expense" | "income" | "transfer";
  last_account_id: string | null;
  onboarding_done: boolean;
  schema_seeded: boolean;
  recent_searches: string[];
  icon_style: IconStyle;
  icon_background: IconBackground;
  /** Order and visibility of the Home sections below the hero. */
  home_layout: HomeSectionPref[];
  /** Accounts refilled by transfers (pocket money). */
  pockets: Pocket[];
  /** Mask amounts on screen (Home, lists) until revealed. */
  hide_amounts: boolean;
  reminder_daily_enabled: boolean;
  /** Local time, 'HH:mm'. */
  reminder_daily_time: string;
  reminder_bills: boolean;
  reminder_budgets: boolean;
  /** Budget alerts already raised, as `budgetId:periodStart:threshold`; managed by the reminder scheduler. */
  reminder_budget_fired: string[];
  sync_provider: SyncProviderId;
  /** Epoch ms of the last backup export or sync; null when never. */
  last_backup_at: number | null;
}

export type SettingKey = keyof SettingsMap;

export const DEFAULT_SETTINGS: Readonly<SettingsMap> = {
  display_currency: "USD",
  theme: "system",
  accent: "titanium",
  palette: "titanium",
  haptics: true,
  show_decimals: false,
  week_start: 1,
  month_start: 1,
  default_account_id: null,
  lock_enabled: false,
  lock_timeout_s: 0,
  last_kind: "expense",
  last_account_id: null,
  onboarding_done: false,
  schema_seeded: false,
  recent_searches: [],
  icon_style: "sf",
  icon_background: "mono",
  category_colors: "mono",
  home_layout: DEFAULT_HOME_LAYOUT.map((s) => ({ ...s })),
  pockets: [],
  hide_amounts: false,
  reminder_daily_enabled: false,
  reminder_daily_time: "21:00",
  reminder_bills: true,
  reminder_budgets: true,
  reminder_budget_fired: [],
  sync_provider: "none",
  last_backup_at: null,
};

const ENUMS: Partial<Record<SettingKey, readonly unknown[]>> = {
  accent: Object.keys(accentPresets),
  palette: Object.keys(palettes),
  category_colors: ["mono", "colour"],
  icon_style: ICON_STYLES,
  icon_background: ICON_BACKGROUNDS,
  sync_provider: SYNC_PROVIDER_IDS,
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

function decode<K extends SettingKey>(
  key: K,
  raw: string | undefined,
): SettingsMap[K] {
  if (raw === undefined) return DEFAULT_SETTINGS[key];
  try {
    const value = JSON.parse(raw) as SettingsMap[K];
    const allowed = ENUMS[key];
    // A stored value from an older or newer build that is no longer valid falls back to the default.
    if (allowed && !allowed.includes(value)) return DEFAULT_SETTINGS[key];
    if (key === "home_layout")
      return normalizeHomeLayout(value) as SettingsMap[K];
    if (key === "pockets") return normalizePockets(value) as SettingsMap[K];
    if (
      key === "reminder_daily_time" &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))
    )
      return DEFAULT_SETTINGS[key];
    return value;
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}

export function getSetting<K extends SettingKey>(
  db: Db,
  key: K,
): SettingsMap[K] {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return decode(key, row?.value);
}

export function setSetting<K extends SettingKey>(
  db: Db,
  key: K,
  value: SettingsMap[K],
): void {
  const encoded = JSON.stringify(value);
  db.insert(settings)
    .values({ key, value: encoded })
    .onConflictDoUpdate({ target: settings.key, set: { value: encoded } })
    .run();
}

export function getAllSettings(db: Db): SettingsMap {
  const rows = db.select().from(settings).all();
  const raw = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) result[key] = decode(key, raw.get(key));
  return result as unknown as SettingsMap;
}

export function insertMissingDefaults(db: Db): void {
  for (const key of SETTING_KEYS) {
    db.insert(settings)
      .values({ key, value: JSON.stringify(DEFAULT_SETTINGS[key]) })
      .onConflictDoNothing()
      .run();
  }
}
