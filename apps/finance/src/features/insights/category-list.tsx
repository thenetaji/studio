import * as React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import { IconTile, Pressable, Text } from "@studio/ui";
import { Sparkline } from "@studio/charts/components";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { durations, type CategoryColorKey } from "@studio/theme";
import { useTokens } from "@studio/theme";

export type CategoryListItem = {
  /** Category id; null for uncategorised lines (not drillable). */
  id: string | null;
  name: string;
  icon: string;
  color: CategoryColorKey;
  amount: number;
  percent: number;
  /** Against the previous period and its recent average; absent when there is no history to show. */
  trend?: CategoryListTrend;
};

export type CategoryListTrend = {
  /** One total per period, oldest first, ending with this one. */
  spark: readonly number[];
  /** Short change text: "12%", "New", "Same". */
  text: string;
  /** Arrow to draw before `text`. */
  arrow: "up" | "down" | null;
  /** True when the change is the welcome direction (spending fell, income rose). */
  good: boolean;
  /** Spoken form, e.g. "up 12 percent on September, 3-month average 4,100 rupees". */
  speech: string;
};

type CategoryListProps = {
  items: readonly CategoryListItem[];
  currency: string;
  locale?: string;
  showDecimals: boolean;
  onPress: (item: CategoryListItem) => void;
};

function CategoryRow({
  item,
  currency,
  locale,
  showDecimals,
  last,
  onPress,
}: Omit<CategoryListProps, "items" | "onPress"> & {
  item: CategoryListItem;
  last: boolean;
  onPress: () => void;
}) {
  const { colors, category } = useTokens();
  const amount = formatMoney(item.amount, currency, {
    locale,
    decimals: showDecimals ? undefined : 0,
  });
  const share = Math.max(0, Math.min(1, item.percent / 100));
  const trend = item.trend;
  return (
    <Pressable
      role="button"
      disabled={item.id === null}
      accessibilityLabel={`${item.name}, ${formatMoneyForSpeech(item.amount, currency, { sign: "none", locale })}, ${item.percent} percent`}
      accessibilityHint={trend?.speech}
      onPress={onPress}
      scale={1}
      className="min-h-[60px] flex-row items-center bg-surface px-4 py-2.5 active:bg-fill"
    >
      <IconTile icon={item.icon} color={item.color} />
      <View className="ml-3 flex-1">
        <Text variant="body" numberOfLines={1}>
          {item.name}
        </Text>
        <View
          className="mt-1.5 h-1 overflow-hidden rounded-full"
          style={{ backgroundColor: colors.fill }}
        >
          <View
            style={{
              width: `${Math.max(share * 100, share > 0 ? 2 : 0)}%`,
              backgroundColor: category[item.color],
              height: 4,
              borderRadius: 2,
            }}
          />
        </View>
      </View>
      {trend ? (
        <View className="ml-3 items-center" style={{ width: 52 }}>
          <Sparkline
            values={trend.spark}
            width={48}
            height={20}
            endColor={category[item.color]}
          />
          <View className="mt-0.5 flex-row items-center">
            {trend.arrow ? (
              <Text
                variant="caption"
                tone={trend.good ? "income" : "tertiary"}
                className="mr-0.5"
                style={{ fontSize: 8, lineHeight: 12 }}
              >
                {trend.arrow === "up" ? "▲" : "▼"}
              </Text>
            ) : null}
            <Text
              variant="caption"
              tone={trend.good ? "income" : "tertiary"}
              numeric
              numberOfLines={1}
            >
              {trend.text}
            </Text>
          </View>
        </View>
      ) : null}
      <View className="ml-4 items-end" style={{ minWidth: 72 }}>
        <Text variant="body" numeric numberOfLines={1} className="font-medium">
          {amount}
        </Text>
        <Text variant="footnote" tone="tertiary" numeric>
          {item.percent}%
        </Text>
      </View>
      {last ? null : (
        <View
          pointerEvents="none"
          style={{
            left: 64,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
          }}
          className="absolute bottom-0 right-0"
        />
      )}
    </Pressable>
  );
}

/** One row per category: icon, name, share bar, amount and percent. */
function CategoryList({
  items,
  currency,
  locale,
  showDecimals,
  onPress,
}: CategoryListProps) {
  return (
    <>
      {items.map((item, index) => (
        <Animated.View
          key={item.id ?? "none"}
          layout={LinearTransition.duration(durations.row)}
        >
          <CategoryRow
            item={item}
            currency={currency}
            locale={locale}
            showDecimals={showDecimals}
            last={index === items.length - 1}
            onPress={() => onPress(item)}
          />
        </Animated.View>
      ))}
    </>
  );
}

export { CategoryList };
