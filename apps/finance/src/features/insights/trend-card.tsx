import * as React from "react";
import { View } from "react-native";

import {
  Card,
  Pressable,
  SectionHeader,
  SegmentedControl,
  Text,
} from "@studio/ui";
import { StackedBars } from "@studio/charts/components";
import { useMonthlyTrend } from "@/data/hooks";
import type { BreakdownBy, InsightsScope } from "@/lib/insights";
import {
  monthShort,
  parseKey,
  type DateKey,
  type PeriodSettings,
} from "@studio/dates";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { haptic, useTokens } from "@studio/theme";

import { asColorKey, BREAKDOWN_LABELS } from "./breakdown-model";

const COUNTS = [6, 12] as const;

type TrendCardProps = {
  endRef: DateKey;
  kind: "expense" | "income";
  by: BreakdownBy;
  settings: PeriodSettings;
  scope: InsightsScope;
  locale?: string;
};

/** Six or twelve months stacked by the breakdown's largest buckets; tap a legend entry to pick one out. */
function TrendCard({
  endRef,
  kind,
  by,
  settings,
  scope,
  locale,
}: TrendCardProps) {
  const { category } = useTokens();
  const [count, setCount] = React.useState<(typeof COUNTS)[number]>(6);
  const [scrub, setScrub] = React.useState<number | null>(null);
  const [highlight, setHighlight] = React.useState<number | null>(null);
  const trend = useMonthlyTrend(endRef, count, kind, by, settings, scope);
  const { currency, series, months } = trend;

  const colors = React.useMemo(
    () => series.map((s) => category[asColorKey(s.color)]),
    [series, category],
  );
  const data = React.useMemo(
    () => months.map((m) => ({ key: m.key, values: m.values })),
    [months],
  );
  const labels = React.useMemo(
    () =>
      months.flatMap((m, index) =>
        count === 12 && index % 2 === 1
          ? []
          : [{ index, text: monthShort(parseKey(m.key).month) }],
      ),
    [months, count],
  );
  const money = (value: number) =>
    formatMoney(value, currency, { locale, decimals: 0 });
  const totals = months.map((m) => m.total);
  const average =
    totals.length === 0
      ? 0
      : Math.round(totals.reduce((s, v) => s + v, 0) / totals.length);
  const first = totals.find((t) => t > 0);
  const last = totals[totals.length - 1] ?? 0;

  const label = (index: number) => {
    const month = months[index];
    if (!month) return "";
    const name = monthShort(parseKey(month.key).month);
    if (highlight !== null) {
      const value = month.values[highlight] ?? 0;
      return `${name} · ${series[highlight]?.name ?? ""} ${money(value)}`;
    }
    let top = -1;
    month.values.forEach((v, i) => {
      if (v > (month.values[top] ?? 0)) top = i;
    });
    const lead = top >= 0 ? series[top] : undefined;
    return lead
      ? `${name} · ${money(month.total)} · ${lead.name} ${money(month.values[top] ?? 0)}`
      : `${name} · ${money(month.total)}`;
  };

  if (series.length === 0) return null;
  const noun = kind === "income" ? "income" : "spending";

  return (
    <>
      <SectionHeader title="Monthly trend" />
      <Card className="mx-4 px-4 pb-3 pt-3">
        <View className="flex-row items-baseline justify-between">
          <Text variant="footnote" tone="secondary">
            {`By ${BREAKDOWN_LABELS[by].toLowerCase()}`}
          </Text>
          <Text variant="footnote" tone="tertiary" numeric>
            {`Avg ${money(average)}/month`}
          </Text>
        </View>
        <StackedBars
          data={data}
          colors={colors}
          currency={currency}
          locale={locale}
          labels={labels}
          selectedIndex={scrub}
          onSelect={setScrub}
          highlight={highlight}
          formatLabel={label}
          accessibilityLabel={`Monthly ${noun} by ${BREAKDOWN_LABELS[by].toLowerCase()}, last ${count} months, average ${formatMoneyForSpeech(average, currency, { sign: "none", locale })}${first !== undefined && first > 0 ? `, ${last >= first ? "up" : "down"} ${Math.abs(Math.round(((last - first) * 100) / first))} percent since the first month` : ""}`}
        />
        <View className="flex-row flex-wrap gap-x-4 gap-y-2 pb-3 pt-1">
          {series.map((s, i) => {
            const on = highlight === null || highlight === i;
            return (
              <Pressable
                key={s.key}
                role="button"
                accessibilityState={{ selected: highlight === i }}
                accessibilityLabel={`${s.name}, ${formatMoneyForSpeech(s.amount, currency, { sign: "none", locale })}`}
                scale={1}
                dimTo={0.6}
                hitSlop={6}
                onPress={() => {
                  haptic("selection");
                  setHighlight((h) => (h === i ? null : i));
                }}
                className="flex-row items-center"
                style={{ opacity: on ? 1 : 0.45 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors[i],
                  }}
                />
                <Text
                  variant="footnote"
                  tone="secondary"
                  className="ml-1.5"
                  numberOfLines={1}
                >
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <SegmentedControl
          values={COUNTS.map((c) => (c === 6 ? "6M" : "1Y"))}
          selectedIndex={COUNTS.indexOf(count)}
          onChange={(index) => {
            setScrub(null);
            setCount(COUNTS[index] ?? 6);
          }}
          accessibilityLabel="Months"
        />
      </Card>
    </>
  );
}

export { TrendCard };
