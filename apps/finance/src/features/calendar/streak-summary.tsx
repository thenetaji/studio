import { StyleSheet, View } from "react-native";

import { AppIcon } from "@studio/icons";
import { Card, Text } from "@studio/ui";
import { useTokens } from "@studio/theme";
import type { NoSpendSummary } from "@/lib/reports";

import { daysText } from "./no-spend-labels";

function Stat({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  const { colors } = useTokens();
  return (
    <View
      className="flex-1 px-3"
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={
        divider
          ? {
              borderLeftWidth: StyleSheet.hairlineWidth * 2,
              borderLeftColor: colors.separator,
            }
          : null
      }
    >
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <Text
        variant="headline"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        className="mt-1 font-bold tracking-[-0.4px]"
      >
        {value}
      </Text>
    </View>
  );
}

type StreakSummaryProps = {
  summary: NoSpendSummary;
  /** "This month" or the month's name. */
  monthLabel: string;
};

/** Current streak, best streak and this month's no-spend days in one strip. */
function StreakSummary({ summary, monthLabel }: StreakSummaryProps) {
  const { colors } = useTokens();
  return (
    <Card className="rounded-[20px] px-1 py-3">
      <View className="flex-row items-center gap-1.5 px-3 pb-2.5">
        <AppIcon name="leaf" size={13} color={colors.accentText} />
        <Text variant="footnote" tone="secondary">
          No-spend days
        </Text>
      </View>
      <View className="flex-row">
        <Stat label="Current streak" value={daysText(summary.current.length)} />
        <Stat
          label="Best streak"
          value={daysText(summary.best.length)}
          divider
        />
        <Stat label={monthLabel} value={daysText(summary.monthDays)} divider />
      </View>
    </Card>
  );
}

export { StreakSummary };
