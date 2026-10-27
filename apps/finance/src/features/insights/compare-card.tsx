import * as React from "react";
import { View } from "react-native";

import { Card, Pressable, SectionHeader, Text } from "@studio/ui";
import {
  DIVERGING_VALUE_COLUMN,
  DivergingBars,
  type DivergingRow,
} from "@studio/charts/components";
import type { CategoryRow } from "@/db/schema";
import { MINUS, formatMoney, formatMoneyForSpeech } from "@studio/money";
import { haptic, useTokens } from "@studio/theme";
import { parseKey, monthShort, type DateKey } from "@studio/dates";

import { topMoves, type Comparison } from "./trends-model";

type CompareCardProps = {
  comparison: Comparison;
  kind: "expense" | "income";
  categories: ReadonlyMap<string, CategoryRow>;
  currency: string;
  locale?: string;
  /** "September", "last week": what the previous period is called. */
  previousName: string;
  onOpenCategory: (id: string) => void;
};

const LIMIT = 6;

/** "1–26 Oct" for a range inside one month, "28 Sep – 4 Oct" across two. */
export function rangeText(from: DateKey, to: DateKey): string {
  const a = parseKey(from);
  const b = parseKey(to);
  if (from === to) return `${a.day} ${monthShort(a.month)}`;
  if (a.month === b.month && a.year === b.year)
    return `${a.day}–${b.day} ${monthShort(a.month)}`;
  return `${a.day} ${monthShort(a.month)} – ${b.day} ${monthShort(b.month)}`;
}

/**
 * "Compared with September": both totals and their difference, then the categories that moved most as diverging bars
 * around a neutral midline. For spending a fall is mint (good) and a rise is orange; for income the other way round.
 */
const CompareCard = React.memo(function CompareCard({
  comparison,
  kind,
  categories,
  currency,
  locale,
  previousName,
  onOpenCategory,
}: CompareCardProps) {
  const { colors, category } = useTokens();
  const [all, setAll] = React.useState(false);
  const money = (v: number) =>
    formatMoney(v, currency, { locale, decimals: 0 });
  const signed = (v: number) =>
    `${v > 0 ? "+" : v < 0 ? MINUS : ""}${money(Math.abs(v))}`;
  const speech = (v: number) =>
    formatMoneyForSpeech(Math.abs(v), currency, { sign: "none", locale });
  const shown = all ? comparison.rows : topMoves(comparison.rows, LIMIT);
  const rows = shown.map<DivergingRow>((r) => {
    const name =
      r.categoryId === null
        ? "Uncategorised"
        : (categories.get(r.categoryId)?.name ?? "Category");
    return {
      key: r.categoryId ?? "none",
      label: name,
      value: r.delta,
      valueLabel: signed(r.delta),
      accessibilityLabel: `${name}, ${r.delta > 0 ? "up" : "down"} ${speech(r.delta)}, from ${speech(r.previous)} to ${speech(r.current)}`,
    };
  });
  const rise = kind === "expense" ? category.orange : colors.income;
  const fall = kind === "expense" ? colors.income : category.orange;
  const { ranges } = comparison;
  const noun = kind === "expense" ? "Spent" : "Earned";
  const good =
    comparison.delta === 0
      ? null
      : kind === "expense"
        ? comparison.delta < 0
        : comparison.delta > 0;
  if (comparison.current === 0 && comparison.previous === 0) return null;
  return (
    <>
      <SectionHeader title={`Compared with ${previousName}`} />
      <Card className="mx-4 px-4 pb-3 pt-3">
        <View className="flex-row gap-3">
          <View
            className="min-w-0 flex-1"
            accessible
            accessibilityLabel={`${noun} ${rangeText(ranges.current.from, ranges.current.to)}, ${speech(comparison.current)}`}
          >
            <Text variant="footnote" tone="secondary" numberOfLines={1}>
              {rangeText(ranges.current.from, ranges.current.to)}
            </Text>
            <Text variant="headline" numeric numberOfLines={1}>
              {money(comparison.current)}
            </Text>
          </View>
          <View
            className="min-w-0 flex-1"
            accessible
            accessibilityLabel={`${noun} ${rangeText(ranges.previous.from, ranges.previous.to)}, ${speech(comparison.previous)}`}
          >
            <Text variant="footnote" tone="secondary" numberOfLines={1}>
              {rangeText(ranges.previous.from, ranges.previous.to)}
            </Text>
            <Text variant="headline" tone="secondary" numeric numberOfLines={1}>
              {money(comparison.previous)}
            </Text>
          </View>
          <View
            className="min-w-0 flex-1 items-end"
            accessible
            accessibilityLabel={`Difference, ${comparison.delta < 0 ? "down" : "up"} ${speech(comparison.delta)}`}
          >
            <Text variant="footnote" tone="secondary">
              Difference
            </Text>
            <Text
              variant="headline"
              numeric
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              tone={good === true ? "income" : "default"}
            >
              {signed(comparison.delta)}
            </Text>
          </View>
        </View>
        {comparison.percent !== null ? (
          <Text
            variant="footnote"
            tone={good === true ? "income" : "secondary"}
            numeric
            className="pt-1"
          >
            {comparison.percent === 0
              ? `Same as ${previousName}`
              : `${Math.abs(comparison.percent)}% ${comparison.percent < 0 ? "less" : "more"} than ${previousName}${ranges.partial ? ", same days" : ""}`}
          </Text>
        ) : null}
        {rows.length > 0 ? (
          <View className="pt-3">
            <View
              className="flex-row pb-1"
              style={{ paddingLeft: 104, paddingRight: DIVERGING_VALUE_COLUMN }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text variant="caption" tone="tertiary" className="flex-1 pr-2 text-right">
                Less
              </Text>
              <Text variant="caption" tone="tertiary" className="flex-1 pl-2">
                More
              </Text>
            </View>
            <DivergingBars
              rows={rows}
              positiveColor={rise}
              negativeColor={fall}
              onPress={(key) => key !== "none" && onOpenCategory(key)}
            />
          </View>
        ) : null}
        {comparison.rows.length > LIMIT ? (
          <Pressable
            role="button"
            scale={1}
            dimTo={0.6}
            onPress={() => {
              haptic("selection");
              setAll((v) => !v);
            }}
            accessibilityLabel={all ? "Show fewer" : `Show all ${comparison.rows.length}`}
            className="mt-1 h-10 justify-center"
          >
            <Text variant="callout" tone="accent">
              {all ? "Show fewer" : `Show all ${comparison.rows.length}`}
            </Text>
          </Pressable>
        ) : null}
      </Card>
    </>
  );
});

export { CompareCard };
