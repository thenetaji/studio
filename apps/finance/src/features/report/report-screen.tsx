import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Amount, EmptyState, HeaderButton, Text, barRight } from "@studio/ui";
import { useMonthReport, useSettings, useTodayKey } from "@/data/hooks";
import {
  nextPeriod,
  periodFor,
  periodLabel,
  previousPeriod,
  type Period,
  type PeriodSettings,
} from "@studio/dates";
import { Stagger } from "@studio/motion";
import { haptic } from "@studio/theme";

import {
  comparedNote,
  monthOfPeriod,
  monthParam,
  percentChange,
  reportPeriod,
  shortMonthOfPeriod,
} from "./labels";
import { useReportMoney } from "./money";
import {
  BiggestCard,
  BudgetsCard,
  CategoryCard,
  HeadlineTiles,
  NoSpendCard,
  RhythmCard,
  WhatChangedCard,
} from "./sections";
import { MonthStepper } from "./month-stepper";

/** `/report/[month]`: a month in review, stepping (chevrons or swipe) between months. */
export default function ReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string }>();
  const settings = useSettings();
  const today = useTodayKey();
  const periodSettings = React.useMemo<PeriodSettings>(
    () => ({
      weekStart: settings.week_start,
      monthStart: settings.month_start,
    }),
    [settings.week_start, settings.month_start],
  );
  const current = periodFor("month", today, periodSettings);
  const [period, setPeriod] = React.useState<Period>(() =>
    reportPeriod(params.month, today, periodSettings),
  );
  const report = useMonthReport(period, periodSettings, today);
  const money = useReportMoney(report.currency);

  const earliest = report.firstEntry
    ? periodFor("month", report.firstEntry, periodSettings).from
    : current.from;
  const canBack = period.from > earliest;
  const canForward = period.from < current.from;
  const step = (direction: 1 | -1) => {
    if (direction === 1 ? !canForward : !canBack) return;
    setPeriod((p) => (direction === 1 ? nextPeriod(p) : previousPeriod(p)));
  };

  const reduced = useReducedMotion();
  const fade = useSharedValue(1);
  React.useEffect(() => {
    if (reduced) return;
    fade.value = 0.3;
    fade.value = withTiming(1, { duration: 200 });
  }, [period.from, fade, reduced]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onEnd((event) => {
      if (event.translationX < -60 && canForward) {
        haptic("selection");
        step(1);
      } else if (event.translationX > 60 && canBack) {
        haptic("selection");
        step(-1);
      }
    });

  const empty = report.transactionCount === 0;
  const spentDelta = percentChange(report.deltas.spent.percent);
  const vs = report.compared.partial
    ? `same days in ${shortMonthOfPeriod(report.previous)}`
    : monthOfPeriod(report.previous);
  const deltaText =
    report.prior.spent === 0 || spentDelta === null
      ? null
      : spentDelta === "No change"
        ? `No change vs ${vs}`
        : `${spentDelta} vs ${vs}`;
  const fell = report.deltas.spent.amount < 0;
  const monthWord = monthOfPeriod(period);

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen
        options={{
          title: "Monthly report",
          ...barRight(
            empty ? null : (
              <HeaderButton
                symbol="square.and.arrow.up"
                label="Share"
                onPress={() =>
                  router.push({
                    pathname: "/share-image",
                    params: { kind: "month", ref: monthParam(period) },
                  })
                }
              />
            ),
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 48, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-1">
          <MonthStepper
            label={periodLabel(period)}
            canBack={canBack}
            canForward={canForward}
            onStep={step}
            onJumpToCurrent={canForward ? () => setPeriod(current) : undefined}
          />
        </View>
        <GestureDetector gesture={swipe}>
          <Animated.View
            style={[{ flexGrow: 1 }, fadeStyle]}
            collapsable={false}
          >
            {empty ? (
              <View className="flex-1" style={{ minHeight: 420 }}>
                <EmptyState message={`Nothing in ${monthWord}`} />
              </View>
            ) : (
              <>
                <Stagger index={0} className="px-4 pb-4 pt-3">
                  <Text variant="footnote" tone="secondary">
                    {report.compared.partial
                      ? `Spent in ${monthWord} so far`
                      : `Spent in ${monthWord}`}
                  </Text>
                  <Amount
                    key={period.from}
                    value={money.full(report.current.spent)}
                    variant="hero"
                    animate="intro"
                    accessibilityLabel={money.speech(report.current.spent)}
                  />
                  <View className="min-h-5 flex-row items-center gap-2">
                    {deltaText ? (
                      <Text
                        variant="footnote"
                        numeric
                        tone={fell ? "income" : "secondary"}
                      >
                        {deltaText}
                      </Text>
                    ) : null}
                  </View>
                </Stagger>
                <Stagger index={1}>
                  <HeadlineTiles report={report} money={money} />
                  <Text variant="caption" tone="tertiary" className="px-5 pt-2">
                    {comparedNote(report.compared)}
                  </Text>
                </Stagger>
                <Stagger index={2}>
                  <CategoryCard report={report} money={money} />
                </Stagger>
                <Stagger index={3}>
                  <WhatChangedCard report={report} money={money} />
                </Stagger>
                <Stagger index={4}>
                  <BiggestCard report={report} money={money} today={today} />
                </Stagger>
                <Stagger index={5}>
                  <RhythmCard report={report} money={money} today={today} />
                </Stagger>
                <Stagger index={6}>
                  <NoSpendCard
                    report={report}
                    today={today}
                    weekStart={settings.week_start}
                  />
                </Stagger>
                <Stagger index={7}>
                  <BudgetsCard report={report} money={money} />
                </Stagger>
              </>
            )}
          </Animated.View>
        </GestureDetector>
      </ScrollView>
    </View>
  );
}
