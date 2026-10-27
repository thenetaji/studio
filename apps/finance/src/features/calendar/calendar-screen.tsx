import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { useTodayKey } from "@/data/hooks";
import { MonthStepper } from "@/features/report/month-stepper";
import { monthName, parseKey } from "@studio/dates";
import { haptic } from "@studio/theme";

import { CalendarView } from "./calendar-view";
import { monthOf, shiftMonth } from "./grid";

const MONTH = /^\d{4}-\d{2}$/;
/** How far back the stepper goes. */
const HISTORY = 120;

/** `/calendar?month=YYYY-MM`: spending calendar with no-spend streaks, stepping by month. */
export default function CalendarScreen() {
  const params = useLocalSearchParams<{ month?: string; day?: string }>();
  const today = useTodayKey();
  const current = monthOf(today);
  const [month, setMonth] = React.useState(() =>
    params.month && MONTH.test(params.month) && params.month <= current
      ? params.month
      : current,
  );
  const [day, setDay] = React.useState<string | null>(() =>
    params.day && monthOf(params.day) === month ? params.day : null,
  );
  const earliest = shiftMonth(current, -HISTORY);
  const step = React.useCallback(
    (delta: 1 | -1) => {
      const next = shiftMonth(month, delta);
      if (next > current || next < earliest) return;
      haptic("selection");
      setMonth(next);
      setDay(null);
    },
    [month, current, earliest],
  );
  const { year, month: m } = parseKey(`${month}-01`);
  const selected = day ?? (month === current ? today : null);

  return (
    <View className="flex-1 bg-bg">
      <CalendarView
        month={month}
        selected={selected}
        onSelect={setDay}
        onStep={step}
        bottomInset={48}
        showMonthTitle={false}
        header={
          <View className="pt-1">
            <MonthStepper
              label={`${monthName(m)} ${year}`}
              canBack={month > earliest}
              canForward={month < current}
              onStep={step}
              onJumpToCurrent={
                month === current
                  ? undefined
                  : () => {
                      setMonth(current);
                      setDay(null);
                    }
              }
            />
          </View>
        }
      />
    </View>
  );
}
