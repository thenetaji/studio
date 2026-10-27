import * as React from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn } from "react-native-reanimated";

import { AppIcon } from "@studio/icons";
import { SectionHeader, Card, Pressable, Text } from "@studio/ui";
import {
  useBillsDue,
  useDailyTotals,
  useNoSpendInput,
  usePeriodTransactions,
  useSetting,
  useTodayKey,
  type BillDue,
} from "@/data/hooks";
import { TransactionListRow } from "@/features/transactions/transaction-list-row";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import { dayLabel, endOfMonthKey, monthName, parseKey } from "@studio/dates";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { haptic, withAlpha, useTokens } from "@studio/theme";
import { dayStatus, noSpendSummary, type DayStatus } from "@/lib/reports";

import {
  buildMonthGrid,
  heatOpacity,
  monthOf,
  weekdayLetters,
  type CalendarCell,
} from "./grid";
import { StreakSummary } from "./streak-summary";

const GAP = 6;

function Cell({
  cell,
  size,
  today,
  selected,
  status,
  bills,
  onPress,
}: {
  cell: CalendarCell;
  size: number;
  today: boolean;
  selected: boolean;
  status: DayStatus;
  bills: number;
  onPress: () => void;
}) {
  const { colors, isDark } = useTokens();
  const money = useMoneyContext();
  const spent = cell.level > 0;
  const future = status === "future";
  const quiet = status === "no-spend";
  const fill = spent
    ? withAlpha(colors.accent, heatOpacity(cell.level))
    : future
      ? "transparent"
      : isDark
        ? "#000000"
        : colors.fill;
  const ring = selected
    ? colors.accent
    : today
      ? colors.text
      : spent
        ? "transparent"
        : future
          ? withAlpha(colors.text, 0.06)
          : colors.border;
  const label = spent
    ? formatMoney(cell.amount, money.displayCurrency, {
        compact: true,
        locale: money.locale,
        sign: "none",
      })
    : "";
  // Strong tints take the accent's own foreground so the day stays legible in every accent and scheme.
  const ink = cell.level >= 5 ? colors.onAccent : undefined;
  const a11y = [
    dayLabel(cell.dateKey, ""),
    spent ? label : quiet ? "No spending" : null,
    bills > 0 ? (bills === 1 ? "1 bill due" : `${bills} bills due`) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <Pressable
      role="button"
      scale={0.94}
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: 11,
        backgroundColor: fill,
        borderWidth: selected || today ? 2 : 1,
        borderColor: ring,
      }}
      className="items-center justify-center"
    >
      <Text
        variant="footnote"
        numeric
        tone={future && !today ? "tertiary" : "default"}
        className={today || selected ? "font-semibold" : undefined}
        style={ink ? { color: ink } : undefined}
      >
        {cell.day}
      </Text>
      {spent ? (
        <Text
          numeric
          numberOfLines={1}
          className="text-[9px] leading-[11px]"
          style={{
            color: ink ?? colors.textSecondary,
            maxWidth: size - 4,
          }}
        >
          {label}
        </Text>
      ) : quiet ? (
        <View style={{ height: 11 }} className="items-center justify-center">
          <AppIcon name="leaf" size={10} color={colors.accentText} />
        </View>
      ) : (
        <View style={{ height: 11 }} />
      )}
      {bills > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: ink ?? colors.textSecondary,
          }}
        />
      ) : null}
    </Pressable>
  );
}

function Legend() {
  const { colors } = useTokens();
  return (
    <View className="flex-row items-center justify-center gap-5 pt-3">
      <View className="flex-row items-center gap-1.5">
        <AppIcon name="leaf" size={11} color={colors.accentText} />
        <Text variant="caption" tone="secondary">
          No spend
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: colors.textSecondary,
          }}
        />
        <Text variant="caption" tone="secondary">
          Bill due
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <View
          style={{
            width: 11,
            height: 11,
            borderRadius: 3,
            backgroundColor: withAlpha(colors.accent, heatOpacity(4)),
          }}
        />
        <Text variant="caption" tone="secondary">
          Spent
        </Text>
      </View>
    </View>
  );
}

function BillRow({ bill, separator }: { bill: BillDue; separator: boolean }) {
  const { colors } = useTokens();
  const money = useMoneyContext();
  const amount = formatMoney(bill.amount, bill.currency, {
    locale: money.locale,
    sign: "none",
    decimals: money.showDecimals ? undefined : 0,
  });
  return (
    <View
      accessible
      accessibilityLabel={`${bill.title}, due, ${formatMoneyForSpeech(bill.amount, bill.currency, { sign: "none", locale: money.locale })}`}
      className="min-h-[52px] flex-row items-center gap-3 px-4 py-3"
      style={
        separator
          ? {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.separator,
            }
          : null
      }
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.fill }}
      >
        <AppIcon name="repeat" size={16} color={colors.textSecondary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text variant="body" numberOfLines={1}>
          {bill.title || "Recurring"}
        </Text>
        <Text variant="subhead" tone="secondary" numberOfLines={1}>
          Due
        </Text>
      </View>
      <Text variant="body" numeric tone="secondary" className="font-medium">
        {amount}
      </Text>
    </View>
  );
}

type CalendarViewProps = {
  /** `YYYY-MM`. */
  month: string;
  selected: string | null;
  onSelect: (dateKey: string) => void;
  /** Swipe left = +1, right = -1. */
  onStep: (delta: 1 | -1) => void;
  bottomInset?: number;
  /** Current streak, best streak and the month's no-spend days above the grid (default on). */
  showStreaks?: boolean;
  /** Rendered above everything else in the scroll view (e.g. a month stepper). */
  header?: React.ReactNode;
  /** The month name above the grid; off when `header` already names the month. */
  showMonthTitle?: boolean;
};

/**
 * Month heatmap (7 columns, honours week_start): each day's spend as a brass tint plus a compact amount,
 * no-spend days with a leaf, unposted bills as a dot. The selected day's entries and bills are listed underneath.
 */
export function CalendarView({
  month,
  selected,
  onSelect,
  onStep,
  bottomInset = 96,
  showStreaks = true,
  header,
  showMonthTitle = true,
}: CalendarViewProps) {
  const money = useMoneyContext();
  const todayKey = useTodayKey();
  const [weekStart] = useSetting("week_start");
  const totals = useDailyTotals(month, "expense");
  const noSpend = useNoSpendInput(todayKey);
  const monthFrom = `${month}-01`;
  const monthTo = endOfMonthKey(monthFrom);
  const bills = useBillsDue(monthFrom, monthTo);
  const [width, setWidth] = React.useState(0);
  const onLayout = React.useCallback(
    (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width),
    [],
  );
  const size = width > 0 ? Math.floor((width - GAP * 6) / 7) : 0;
  const rows = React.useMemo(
    () =>
      buildMonthGrid(totals.days, totals.max, totals.firstWeekday, weekStart),
    [totals, weekStart],
  );
  const letters = React.useMemo(() => weekdayLetters(weekStart), [weekStart]);
  const billsByDay = React.useMemo(() => {
    const map = new Map<string, BillDue[]>();
    for (const bill of bills) {
      const list = map.get(bill.dueDate);
      if (list) list.push(bill);
      else map.set(bill.dueDate, [bill]);
    }
    return map;
  }, [bills]);
  const summary = React.useMemo(
    () => noSpendSummary({ from: monthFrom, to: monthTo }, noSpend),
    [monthFrom, monthTo, noSpend],
  );

  const day = selected && monthOf(selected) === month ? selected : null;
  const items = usePeriodTransactions({
    from: day ?? "0000-01-01",
    to: day ?? "0000-01-01",
    kinds: ["expense", "income", "transfer"],
  });
  const dayBills = day ? (billsByDay.get(day) ?? []) : [];
  const dayState = day ? dayStatus(day, noSpend) : null;

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onEnd((event) => {
      if (event.translationX < -60) onStep(1);
      else if (event.translationX > 60) onStep(-1);
    });

  const { year, month: m } = parseKey(monthFrom);
  const monthTotal = formatMoney(totals.total, totals.currency, {
    locale: money.locale,
    sign: "none",
    decimals: money.showDecimals ? undefined : 0,
  });
  const isCurrentMonth = monthOf(todayKey) === month;

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: bottomInset }}
    >
      {header}
      {showStreaks && noSpend.since !== null ? (
        <View className="px-4 pt-3">
          <StreakSummary
            summary={summary}
            monthLabel={isCurrentMonth ? "This month" : monthName(m)}
          />
        </View>
      ) : null}
      <GestureDetector gesture={swipe}>
        <Animated.View
          key={month}
          entering={FadeIn.duration(180)}
          className="px-4 pt-3"
        >
          <View className="flex-row items-baseline justify-between px-1 pb-3">
            <Text variant="footnote" tone="secondary">
              {showMonthTitle ? `${monthName(m)} ${year}` : "Spending by day"}
            </Text>
            <Text variant="footnote" tone="secondary" numeric>
              {`${monthTotal} spent`}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: GAP, paddingBottom: GAP }}>
            {letters.map((letter, i) => (
              <View
                key={i}
                style={{ width: size || undefined, flex: size ? undefined : 1 }}
                className="items-center"
              >
                <Text variant="caption" tone="tertiary">
                  {letter}
                </Text>
              </View>
            ))}
          </View>
          <View onLayout={onLayout} style={{ gap: GAP }}>
            {size > 0
              ? rows.map((row, r) => (
                  <View key={r} style={{ flexDirection: "row", gap: GAP }}>
                    {row.map((cell, c) =>
                      cell ? (
                        <Cell
                          key={cell.dateKey}
                          cell={cell}
                          size={size}
                          today={cell.dateKey === todayKey}
                          selected={cell.dateKey === day}
                          status={dayStatus(cell.dateKey, noSpend)}
                          bills={billsByDay.get(cell.dateKey)?.length ?? 0}
                          onPress={() => {
                            haptic("selection");
                            onSelect(cell.dateKey);
                          }}
                        />
                      ) : (
                        <View
                          key={`b${c}`}
                          style={{ width: size, height: size }}
                        />
                      ),
                    )}
                  </View>
                ))
              : null}
          </View>
          <Legend />
        </Animated.View>
      </GestureDetector>
      {day ? (
        <View>
          <SectionHeader title={dayLabel(day, todayKey)} />
          {items.length > 0 || dayBills.length > 0 ? (
            <Card className="mx-4 p-0">
              {items.map((item, index) => (
                <TransactionListRow
                  key={item.id}
                  item={item}
                  context={money}
                  separator={index < items.length - 1 || dayBills.length > 0}
                />
              ))}
              {dayBills.map((bill, index) => (
                <BillRow
                  key={`${bill.ruleId}:${bill.dueDate}`}
                  bill={bill}
                  separator={index < dayBills.length - 1}
                />
              ))}
            </Card>
          ) : (
            <Text variant="subhead" tone="tertiary" className="px-4">
              {dayState === "no-spend"
                ? "No spending"
                : dayState === "future"
                  ? "Nothing due"
                  : "No transactions"}
            </Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}
