import * as React from "react";
import { StyleSheet, View } from "react-native";

import { AnimatedNumber, Card, SectionHeader, SegmentedControl, Text } from "@studio/ui";
import { AreaStackChart } from "@studio/charts/components";
import { useBalanceMovements } from "@/data/hooks";
import {
  monthShort,
  parseKey,
  type DateKey,
  type Period,
  type PeriodSettings,
} from "@studio/dates";
import { MINUS, formatMoney, formatMoneyForSpeech } from "@studio/money";
import { useTokens } from "@studio/theme";

import { netWorthPoints, netWorthSeries } from "./net-worth-model";

type NetWorthCardProps = {
  period: Period;
  today: DateKey;
  settings: PeriodSettings;
  locale?: string;
  /** Start stacked by account (`?worth=stacked`, screenshots). */
  initialStacked?: boolean;
};

const MODES = ["Total", "By account"] as const;

const pointName = (key: DateKey, today: DateKey) => {
  const { day, month, year } = parseKey(key);
  return key === today
    ? "Today"
    : `${day} ${monthShort(month)} ${year}`;
};

/**
 * "Net worth": every active account's balance at each month end, rebuilt from opening balances and transactions and
 * converted to the display currency. One line for the total, or stacked by account; scrub to read any month, and the
 * account list underneath follows.
 */
const NetWorthCard = React.memo(function NetWorthCard({
  period,
  today,
  settings,
  locale,
  initialStacked = false,
}: NetWorthCardProps) {
  const { colors, category } = useTokens();
  const source = useBalanceMovements();
  const [stacked, setStacked] = React.useState(initialStacked);
  const [scrub, setScrub] = React.useState<number | null>(null);
  const keys = React.useMemo(
    () => netWorthPoints(period, today, settings),
    [period, today, settings],
  );
  const series = React.useMemo(
    () =>
      netWorthSeries(
        source.accounts,
        source.movements,
        keys,
        source.ctx.displayCurrency,
        source.ctx.rates,
      ),
    [source, keys],
  );
  const currency = source.ctx.displayCurrency;
  const last = series.total.length - 1;
  const index = scrub ?? last;
  const value = series.total[index] ?? 0;
  const first = series.total[0] ?? 0;
  const change = (series.total[last] ?? 0) - first;
  const money = (v: number) =>
    formatMoney(v, currency, { locale, decimals: 0 });
  const signed = (v: number) =>
    `${v > 0 ? "+" : v < 0 ? MINUS : ""}${money(Math.abs(v))}`;
  const speech = (v: number) =>
    formatMoneyForSpeech(Math.abs(v), currency, { sign: "none", locale });
  const labels = React.useMemo(
    () =>
      keys.flatMap((key, i) =>
        i % 3 === (keys.length - 1) % 3
          ? [{ index: i, text: monthShort(parseKey(key).month) }]
          : [],
      ),
    [keys],
  );
  const chartSeries = React.useMemo(
    () =>
      series.accounts.map((a) => ({
        key: a.id,
        color: category[a.color],
        values: a.values,
      })),
    [series.accounts, category],
  );
  if (series.accounts.length === 0) return null;
  const firstKey = keys[0];
  return (
    <>
      <SectionHeader title="Net worth" />
      <Card className="mx-4 px-4 pb-2 pt-3">
        <Text variant="footnote" tone="secondary">
          {keys[index] ? pointName(keys[index]!, today) : ""}
        </Text>
        <AnimatedNumber
          value={formatMoney(value, currency, { locale, decimals: 0, sign: "auto" })}
          variant="title1"
          fit
          tone={value < 0 ? "expense" : "default"}
        />
        <Text
          variant="footnote"
          numeric
          tone={change > 0 ? "income" : "secondary"}
          accessibilityLabel={`${change >= 0 ? "Up" : "Down"} ${speech(change)} over ${keys.length} months`}
        >
          {`${signed(change)} since ${firstKey ? `${monthShort(parseKey(firstKey).month)} ${parseKey(firstKey).year}` : ""}`}
        </Text>
        <AreaStackChart
          total={series.total}
          series={chartSeries}
          stacked={stacked}
          currency={currency}
          locale={locale}
          labels={labels}
          selectedIndex={scrub}
          onSelect={setScrub}
          formatLabel={(i) =>
            keys[i]
              ? `${monthShort(parseKey(keys[i]!).month)} · ${formatMoney(series.total[i] ?? 0, currency, { locale, compact: true, sign: "auto" })}`
              : ""
          }
          accessibilityLabel={`Net worth over ${keys.length} months, now ${speech(series.total[last] ?? 0)}, ${change >= 0 ? "up" : "down"} ${speech(change)}`}
          height={150}
        />
        <View className="pb-2 pt-1">
          <SegmentedControl
            values={MODES}
            selectedIndex={stacked ? 1 : 0}
            onChange={(i) => setStacked(i === 1)}
            accessibilityLabel="Show"
          />
        </View>
        <View className="pt-1">
          {series.accounts.map((account, i) => {
            const v = account.values[index] ?? 0;
            return (
              <View
                key={account.id}
                className="min-h-[36px] flex-row items-center"
                style={
                  i < series.accounts.length - 1
                    ? {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.separator,
                      }
                    : undefined
                }
                accessible
                accessibilityLabel={`${account.name}, ${v < 0 ? "minus " : ""}${speech(v)}`}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: category[account.color],
                    opacity: stacked ? 1 : 0.9,
                  }}
                />
                <Text variant="subhead" numberOfLines={1} className="ml-2.5 flex-1">
                  {account.name}
                </Text>
                <Text
                  variant="subhead"
                  numeric
                  tone={v < 0 ? "expense" : "default"}
                  className="font-medium"
                >
                  {formatMoney(v, currency, { locale, decimals: 0, sign: "auto" })}
                </Text>
              </View>
            );
          })}
        </View>
        {series.unconverted.length > 0 ? (
          <Text variant="footnote" tone="tertiary" className="pb-1 pt-2">
            {`No rate for ${series.unconverted.join(", ")}`}
          </Text>
        ) : null}
      </Card>
    </>
  );
});

export { NetWorthCard };
