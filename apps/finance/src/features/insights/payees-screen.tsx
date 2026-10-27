import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { EmptyState, SegmentedControl, Text } from "@studio/ui";
import { useInsightLines, useSettings, useTodayKey } from "@/data/hooks";
import { periodLabel } from "@studio/dates";
import { formatMoney } from "@studio/money";
import { useMoneyContext } from "@/features/transactions/use-money-context";

import { PayeeRow } from "./payee-row";
import { payeeTotals, type Payee, type PayeeSort } from "./payees-model";
import { contextParams, parseContext } from "./params";

const SORTS: readonly PayeeSort[] = ["amount", "count"];

/** Every payee in the period, by total or by how often, each opening its transactions. */
export default function PayeesScreen() {
  const router = useRouter();
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
  const [sort, setSort] = React.useState<PayeeSort>("amount");
  const data = useInsightLines(context.period, context.scope);
  const currency = data.ctx.displayCurrency;
  const payees = React.useMemo(
    () =>
      payeeTotals(data.lines, context.kind, context.period, data.ctx, sort),
    [data, context, sort],
  );
  const max = payees.reduce((m, p) => Math.max(m, p.amount), 0);
  const total = payees.reduce((s, p) => s + p.amount, 0);
  const title = context.kind === "income" ? "Sources" : "Payees";

  const header = (
    <View className="px-4 pb-3 pt-2">
      <Text variant="footnote" tone="secondary">
        {periodLabel(context.period)}
      </Text>
      <Text variant="title2" numeric className="pb-3">
        {`${payees.length} ${payees.length === 1 ? title.slice(0, -1).toLowerCase() : title.toLowerCase()} · ${formatMoney(total, currency, { locale: money.locale, decimals: 0 })}`}
      </Text>
      <SegmentedControl
        values={["Total", "Count"]}
        selectedIndex={SORTS.indexOf(sort)}
        onChange={(i) => setSort(SORTS[i] ?? "amount")}
        accessibilityLabel="Sort by"
      />
    </View>
  );

  const renderItem = React.useCallback(
    ({ item, index }: { item: Payee; index: number }) => (
      <View
        className="mx-4 overflow-hidden"
        style={{
          borderTopLeftRadius: index === 0 ? 18 : 0,
          borderTopRightRadius: index === 0 ? 18 : 0,
          borderBottomLeftRadius: index === payees.length - 1 ? 18 : 0,
          borderBottomRightRadius: index === payees.length - 1 ? 18 : 0,
        }}
      >
        <PayeeRow
          payee={item}
          category={
            item.categoryId ? (data.categories.get(item.categoryId) ?? null) : null
          }
          currency={currency}
          locale={money.locale}
          showDecimals={money.showDecimals}
          max={max}
          separator={index < payees.length - 1}
          onPress={() =>
            router.push({
              pathname: "/payee",
              params: { ...contextParams(context), key: item.key, title: item.title },
            })
          }
        />
      </View>
    ),
    [payees.length, data.categories, currency, money, max, router, context],
  );

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title }} />
      <FlashList
        data={payees}
        renderItem={renderItem}
        keyExtractor={(p) => p.key}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View className="pt-16">
            <EmptyState message="No titled transactions" />
          </View>
        }
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
