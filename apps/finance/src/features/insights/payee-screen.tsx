import { Stack, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Card, EmptyState, Text } from "@studio/ui";
import {
  useInsightLines,
  usePeriodTransactions,
  useSettings,
  useTodayKey,
} from "@/data/hooks";
import { periodLabel } from "@studio/dates";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { TransactionDayList } from "@/features/transactions/transaction-day-list";
import { useMoneyContext } from "@/features/transactions/use-money-context";

import { isPayee, payeeTotals } from "./payees-model";
import { firstParam, parseContext } from "./params";

function Stat({
  label,
  value,
  speech,
}: {
  label: string;
  value: string;
  speech: string;
}) {
  return (
    <View
      className="min-w-0 flex-1"
      accessible
      accessibilityLabel={`${label}, ${speech}`}
    >
      <Text variant="footnote" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="headline" numeric numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** One payee's transactions in the period, under its total, count and average. */
export default function PayeeScreen() {
  const raw = useLocalSearchParams();
  const settings = useSettings();
  const today = useTodayKey();
  const money = useMoneyContext();
  const context = React.useMemo(
    () =>
      parseContext(raw as Record<string, string>, today, {
        weekStart: settings.week_start,
        monthStart: settings.month_start,
      }),
    [raw, today, settings.week_start, settings.month_start],
  );
  const key = (firstParam(raw.key as string | undefined) ?? "").toLowerCase();
  const title = firstParam(raw.title as string | undefined) ?? "Payee";
  const { period, kind, scope } = context;

  const data = useInsightLines(period, scope);
  const payee = React.useMemo(
    () =>
      payeeTotals(data.lines, kind, period, data.ctx).find(
        (p) => p.key === key,
      ) ?? null,
    [data, kind, period, key],
  );
  const all = usePeriodTransactions({
    from: period.from,
    to: period.to,
    kinds: [kind],
    accountId: scope.accountId ?? undefined,
    tagId: scope.tagId ?? undefined,
  });
  const items = React.useMemo(
    () => all.filter((item) => isPayee(item.title, key)),
    [all, key],
  );

  const currency = data.ctx.displayCurrency;
  const amount = (v: number) =>
    formatMoney(v, currency, {
      locale: money.locale,
      decimals: money.showDecimals ? undefined : 0,
    });
  const speech = (v: number) =>
    formatMoneyForSpeech(v, currency, { sign: "none", locale: money.locale });

  const header = (
    <View className="px-4 pb-2 pt-2">
      <Card className="px-4 py-3">
        <Text variant="footnote" tone="secondary" numberOfLines={1}>
          {periodLabel(period)}
        </Text>
        <Text
          variant="title1"
          numeric
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          accessibilityLabel={`Total, ${speech(payee?.amount ?? 0)}`}
        >
          {amount(payee?.amount ?? 0)}
        </Text>
        <View className="flex-row gap-3 pt-3">
          <Stat
            label="Transactions"
            value={String(payee?.count ?? 0)}
            speech={String(payee?.count ?? 0)}
          />
          <Stat
            label="Average"
            value={formatMoney(payee?.average ?? 0, currency, {
              locale: money.locale,
              decimals: 0,
            })}
            speech={speech(payee?.average ?? 0)}
          />
          <Stat
            label={kind === "income" ? "Of income" : "Of spending"}
            value={`${payee?.percent ?? 0}%`}
            speech={`${payee?.percent ?? 0} percent`}
          />
        </View>
      </Card>
    </View>
  );

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: payee?.title ?? title }} />
      <TransactionDayList
        items={items}
        context={money}
        header={header}
        empty={<EmptyState message="Nothing in this period" />}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}
