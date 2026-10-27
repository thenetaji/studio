import { listBudgetProgress } from "@/db/repos/budgets";
import { listRules } from "@/db/repos/recurring";
import { getAllSettings, setSetting } from "@/db/repos/settings";
import type { Db } from "@/db/types";
import { toDateKey } from "@studio/dates";
import { planReminders, type PlannedNotification } from "./schedule";

/** The slice of `expo-notifications` the scheduler uses; injectable for tests. */
export interface NotificationsApi {
  getPermission(): Promise<"granted" | "denied" | "undetermined">;
  requestPermission(): Promise<"granted" | "denied" | "undetermined">;
  pendingIds(): Promise<string[]>;
  cancel(id: string): Promise<void>;
  schedule(notification: PlannedNotification): Promise<void>;
}

let cached: NotificationsApi | null | undefined;

/** The real adapter; null on web or when the native module is missing. */
function nativeApi(): NotificationsApi | null {
  if (cached !== undefined) return cached;
  try {
    // Required lazily so web builds and tests never touch the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } =
      require("react-native") as typeof import("react-native");
    if (Platform.OS === "web") return (cached = null);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const N =
      require("expo-notifications") as typeof import("expo-notifications");
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const status = (s: { granted: boolean; canAskAgain: boolean }) =>
      s.granted ? "granted" : s.canAskAgain ? "undetermined" : "denied";
    cached = {
      getPermission: async () => status(await N.getPermissionsAsync()),
      requestPermission: async () => status(await N.requestPermissionsAsync()),
      pendingIds: async () =>
        (await N.getAllScheduledNotificationsAsync()).map((r) => r.identifier),
      cancel: (id) => N.cancelScheduledNotificationAsync(id),
      schedule: async (n) => {
        await N.scheduleNotificationAsync({
          identifier: n.id,
          content: { title: n.title, body: n.body, data: { kind: n.kind } },
          trigger:
            n.trigger.type === "daily"
              ? {
                  type: N.SchedulableTriggerInputTypes.DAILY,
                  hour: n.trigger.hour,
                  minute: n.trigger.minute,
                }
              : {
                  type: N.SchedulableTriggerInputTypes.DATE,
                  date: n.trigger.at,
                },
        });
      },
    };
  } catch {
    cached = null;
  }
  return cached;
}

export interface RescheduleOptions {
  api?: NotificationsApi | null;
  now?: number;
  locale?: string;
  /** Ask the user for permission when it has not been decided. Pass true only from a user action. */
  askPermission?: boolean;
}

export interface RescheduleResult {
  scheduled: number;
  permission: "granted" | "denied" | "undetermined" | "unsupported";
}

/** Asks for notification permission; call when the user turns a reminder on. */
export async function requestReminderPermission(
  api: NotificationsApi | null = nativeApi(),
): Promise<RescheduleResult["permission"]> {
  if (!api) return "unsupported";
  return api.requestPermission();
}

/**
 * Cancels every pending notification (except budget alerts about to fire) and schedules the current plan from scratch, so running it
 * any number of times leaves the same set pending. Does nothing when permission is not granted.
 * Raised budget alerts are remembered in `reminder_budget_fired` so they do not repeat.
 */
export async function rescheduleAll(
  db: Db,
  options: RescheduleOptions = {},
): Promise<RescheduleResult> {
  const api = options.api === undefined ? nativeApi() : options.api;
  if (!api) return { scheduled: 0, permission: "unsupported" };
  const now = options.now ?? Date.now();
  let permission = await api.getPermission();
  if (permission === "undetermined" && options.askPermission)
    permission = await api.requestPermission();
  // Budget alerts are one-shot and may still be pending (they fire seconds after being scheduled); keep those.
  const cancelStale = async () => {
    for (const id of await api.pendingIds())
      if (!id.startsWith("budget:")) await api.cancel(id);
  };
  await cancelStale();
  if (permission !== "granted") return { scheduled: 0, permission };

  const settings = getAllSettings(db);
  const plan = planReminders({
    settings: {
      dailyEnabled: settings.reminder_daily_enabled,
      dailyTime: settings.reminder_daily_time,
      bills: settings.reminder_bills,
      budgets: settings.reminder_budgets,
    },
    rules: listRules(db),
    budgets: listBudgetProgress(db, toDateKey(now)).map((p) => ({
      budgetId: p.budget.id,
      name: p.budget.name,
      amount: p.available,
      spent: p.spent,
      currency: p.budget.currency,
      periodFrom: p.period.from,
    })),
    fired: settings.reminder_budget_fired,
    now,
    locale: options.locale,
  });
  for (const notification of plan.notifications)
    await api.schedule(notification);
  if (
    JSON.stringify(plan.fired) !==
    JSON.stringify(settings.reminder_budget_fired)
  )
    setSetting(db, "reminder_budget_fired", plan.fired);
  return { scheduled: plan.notifications.length, permission };
}

let active = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<unknown> = Promise.resolve();

/** Turns automatic rescheduling after writes on or off. `useReminderSync` switches it on while the app runs. */
export function setRemindersActive(value: boolean): void {
  active = value;
  if (!value && timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Debounced `rescheduleAll`, called by actions after writes that can change reminders. Never throws. */
export function scheduleRemindersSoon(db: Db, delayMs = 400): void {
  if (!active) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    running = running.then(() => rescheduleAll(db)).catch(() => undefined);
  }, delayMs);
}
