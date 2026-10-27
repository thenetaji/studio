import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { AppIcon } from "@studio/icons";
import { Card, Pressable, Text } from "@studio/ui";
import { useMonthReport, useSettings, useTodayKey } from "@/data/hooks";
import { periodFor, previousPeriod, type PeriodSettings } from "@studio/dates";
import { useTokens } from "@studio/theme";

import {
  monthOfPeriod,
  monthParam,
  percentChange,
  reportPeriod,
} from "./labels";

type ReportEntryRowProps = {
  /** `YYYY-MM`; defaults to the last finished month. */
  month?: string;
};

/**
 * Self-contained doorway to `/report/[month]`: "September in review" with the spending change. Suggested home:
 * Insights (below the period stepper or at the end of the month view) and the Home "This month" area.
 * Renders nothing when the month has no entries.
 */
export function ReportEntryRow({ month }: ReportEntryRowProps) {
  const router = useRouter();
  const { colors } = useTokens();
  const settings = useSettings();
  const today = useTodayKey();
  const periodSettings = React.useMemo<PeriodSettings>(
    () => ({
      weekStart: settings.week_start,
      monthStart: settings.month_start,
    }),
    [settings.week_start, settings.month_start],
  );
  const period = React.useMemo(
    () =>
      month
        ? reportPeriod(month, today, periodSettings)
        : previousPeriod(periodFor("month", today, periodSettings)),
    [month, today, periodSettings],
  );
  const report = useMonthReport(period, periodSettings, today);
  if (report.transactionCount === 0) return null;
  const title = `${monthOfPeriod(period)} in review`;
  const change =
    report.prior.spent > 0 ? percentChange(report.deltas.spent.percent) : null;
  const subtitle = change
    ? `Spending ${change} vs ${monthOfPeriod(report.previous)}`
    : "Monthly report";
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      scale={0.98}
      onPress={() =>
        router.push({
          pathname: "/report/[month]",
          params: { month: monthParam(period) },
        })
      }
    >
      <Card className="flex-row items-center gap-3 rounded-[20px] px-4 py-3.5">
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.accentSoft }}
        >
          <AppIcon name="chart.bar.fill" size={16} color={colors.accentText} />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="callout" numberOfLines={1} className="font-semibold">
            {title}
          </Text>
          <Text variant="footnote" tone="secondary" numeric numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <AppIcon name="chevron.right" size={13} color={colors.textTertiary} />
      </Card>
    </Pressable>
  );
}
