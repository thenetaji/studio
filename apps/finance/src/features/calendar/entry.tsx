import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { AppIcon } from "@studio/icons";
import { Card, Pressable, Text } from "@studio/ui";
import { useNoSpendInput, useTodayKey } from "@/data/hooks";
import { endOfMonthKey } from "@studio/dates";
import { useTokens } from "@studio/theme";
import { noSpendSummary } from "@/lib/reports";

import { daysText } from "./no-spend-labels";

/**
 * Self-contained doorway to `/calendar`: the current no-spend streak and this month's no-spend days.
 * Suggested home: Home (under the spending heatmap) or Activity. Renders nothing before the first entry.
 */
export function CalendarEntryCard() {
  const router = useRouter();
  const { colors } = useTokens();
  const today = useTodayKey();
  const input = useNoSpendInput(today);
  const summary = React.useMemo(() => {
    const from = `${today.slice(0, 7)}-01`;
    return noSpendSummary({ from, to: endOfMonthKey(from) }, input);
  }, [today, input]);
  if (input.since === null) return null;
  const streak = summary.current.length;
  const title =
    streak > 0 ? `${daysText(streak)} without spending` : "Spending calendar";
  const subtitle = `${daysText(summary.monthDays)} no-spend this month · Best ${daysText(summary.best.length)}`;
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      scale={0.98}
      onPress={() => router.push("/calendar")}
    >
      <Card className="flex-row items-center gap-3 rounded-[20px] px-4 py-3.5">
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.accentSoft }}
        >
          <AppIcon name="leaf" size={17} color={colors.accentText} />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="callout" numberOfLines={1} className="font-semibold">
            {title}
          </Text>
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <AppIcon name="chevron.right" size={13} color={colors.textTertiary} />
      </Card>
    </Pressable>
  );
}
