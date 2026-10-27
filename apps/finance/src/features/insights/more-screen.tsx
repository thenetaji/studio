import { Stack, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { Card, SectionHeader, Text } from "@studio/ui";
import { axisLabels } from "@studio/charts/lib";
import { BarChart } from "@studio/charts/components";
import {
  useInsights,
  useInsightsExtras,
  useSettings,
  useTodayKey,
} from "@/data/hooks";
import { diffDays, periodLabel, type PeriodSettings } from "@studio/dates";
import { formatMoney } from "@studio/money";
import { useTokens } from "@studio/theme";
import { useMoneyContext } from "@/features/transactions/use-money-context";

import { barsTitle, scrubLabel } from "./labels";
import { firstParam, parseBreakdownBy, parseContext } from "./params";
import { RunningCard } from "./running-card";
import { AccountsCard, StatsGrid, WeekdayCard } from "./sections";
import { TrendCard } from "./trend-card";

/**
 * The quieter Insights sections, one push away from the tab: summary figures, the day-by-day bars, the running
 * total against last period, the monthly trend by breakdown, weekdays and accounts. Same period and scope as the tab.
 */
export default function MoreScreen() {
  const raw = useLocalSearchParams();
  const settings = useSettings();
  const today = useTodayKey();
  const money = useMoneyContext();
  const { colors } = useTokens();
  const periodSettings = React.useMemo<PeriodSettings>(
    () => ({ weekStart: settings.week_start, monthStart: settings.month_start }),
    [settings.week_start, settings.month_start],
  );
  const context = React.useMemo(
    () => parseContext(raw as Record<string, string>, today, periodSettings),
    [raw, today, periodSettings],
  );
  const by = parseBreakdownBy(firstParam(raw.by as string | undefined));
  const { period, kind, scope } = context;
  const insights = useInsights(period, kind, today, scope);
  const extras = useInsightsExtras(period, kind, periodSettings, today, scope);
  const [scrub, setScrub] = React.useState<number | null>(null);
  const { currency } = insights;

  const bars = React.useMemo(
    () => insights.series.map((p) => ({ key: p.key, value: p.amount })),
    [insights.series],
  );
  const labels = React.useMemo(
    () =>
      axisLabels(
        insights.series.map((p) => p.key),
        insights.granularity,
      ),
    [insights.series, insights.granularity],
  );
  const average = formatMoney(insights.average, currency, {
    locale: money.locale,
    decimals: 0,
  });
  const noun = insights.granularity === "day" ? "day" : "month";
  const days = diffDays(period.from, period.to) + 1;
  const nothing = insights.total === 0 && extras.transactionCount === 0;

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: "More insights" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="footnote" tone="secondary" className="px-4 pt-2">
          {periodLabel(period)}
        </Text>
        {nothing ? (
          <Text variant="callout" tone="secondary" className="py-16 text-center">
            Nothing in this period
          </Text>
        ) : (
          <>
            <SectionHeader title="Summary" />
            <StatsGrid
              extras={extras}
              currency={currency}
              locale={money.locale}
            />
            <SectionHeader title={barsTitle(insights.granularity, kind)} />
            <Card className="mx-4 px-4 pb-1 pt-3">
              <View className="flex-row items-baseline justify-end">
                <Text variant="footnote" tone="tertiary" numeric>
                  {`Avg ${average}/${noun}`}
                </Text>
              </View>
              <BarChart
                data={bars}
                currency={currency}
                locale={money.locale}
                labels={labels}
                average={insights.average}
                color={kind === "income" ? colors.income : undefined}
                selectedIndex={scrub}
                onSelect={setScrub}
                formatLabel={(index) =>
                  scrubLabel(
                    insights.series[index] ?? { key: period.from, amount: 0 },
                    insights.granularity,
                    currency,
                    money.locale,
                  )
                }
                accessibilityLabel={`${barsTitle(insights.granularity, kind)}, ${days} days, average ${average} per ${noun}`}
              />
            </Card>
            {insights.total > 0 ||
            insights.previousSeries.some((p) => p.amount > 0) ? (
              <RunningCard
                insights={insights}
                period={period}
                today={today}
                locale={money.locale}
              />
            ) : null}
            {insights.total > 0 ? (
              <TrendCard
                endRef={
                  today >= period.from && today < period.to ? today : period.to
                }
                kind={kind}
                by={by}
                settings={periodSettings}
                scope={scope}
                locale={money.locale}
              />
            ) : null}
            {insights.total > 0 ? (
              <WeekdayCard
                extras={extras}
                currency={currency}
                locale={money.locale}
              />
            ) : null}
            {scope.accountId ? null : (
              <AccountsCard
                accounts={extras.accounts}
                currency={currency}
                locale={money.locale}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
