import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Card, Pressable, Text } from "@studio/ui";
import { useTodayKey, useYearReview } from "@/data/hooks";
import { parseKey } from "@studio/dates";
import { useTokens, withAlpha } from "@studio/theme";

type ReviewEntryCardProps = {
  /** Defaults to this year, or last year during January. */
  year?: number;
};

/**
 * Self-contained doorway to `/review/[year]`: the year's twelve months as a quiet bar strip with the title.
 * Suggested home: Insights (Year view) and the end of Home in December and January. Renders nothing for an empty year.
 */
export function ReviewEntryCard({ year }: ReviewEntryCardProps) {
  const router = useRouter();
  const { colors } = useTokens();
  const today = useTodayKey();
  const { year: thisYear, month } = parseKey(today);
  const value = year ?? (month === 1 ? thisYear - 1 : thisYear);
  const review = useYearReview(value, today);
  if (review.entries === 0) return null;
  const max = Math.max(1, ...review.months.map((m) => m.spent));
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${value} in review`}
      scale={0.98}
      onPress={() =>
        router.push({
          pathname: "/review/[year]",
          params: { year: String(value) },
        })
      }
    >
      <Card className="flex-row items-end justify-between gap-4 rounded-[20px] px-4 py-4">
        <View className="min-w-0 flex-1">
          <Text variant="footnote" tone="secondary">
            Year in review
          </Text>
          <Text variant="title2" className="mt-0.5">
            {review.partial ? `${value} so far` : String(value)}
          </Text>
        </View>
        <View className="flex-row items-end gap-[3px]" style={{ height: 36 }}>
          {review.months.map((m, i) => (
            <View
              key={m.key}
              style={{
                width: 5,
                height: Math.max(3, (m.spent / max) * 36),
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
                backgroundColor:
                  i === review.biggestMonth
                    ? colors.accent
                    : withAlpha(colors.text, 0.2),
              }}
            />
          ))}
        </View>
      </Card>
    </Pressable>
  );
}
