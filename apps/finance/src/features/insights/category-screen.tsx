import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { DaySectionHeader, barRight, Button, Card, Text } from "@studio/ui";
import { TransactionRow } from "@/components/app/transaction-row";
import { MiniBars } from "@studio/charts/components";
import {
  useCategoryTrend,
  usePeriodTransactions,
  useSettings,
  useTodayKey,
  useTopCategoryId,
  type TransactionListItem,
} from "@/data/hooks";
import {
  periodFor,
  periodLabel,
  previousPeriod,
  type Period,
  type PeriodType,
} from "@studio/dates";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { formatTime, toRowModel } from "@/features/transactions/row-model";
import {
  useMoneyContext,
  type MoneyContext,
} from "@/features/transactions/use-money-context";
import { useTransactionActions } from "@/features/transactions/use-transaction-actions";
import { categoryKeys, type CategoryColorKey } from "@studio/theme";
import { useTokens } from "@studio/theme";

import { buildCategoryEntries, type CategoryEntry } from "./category-entries";
import { periodNoun, trendLabel } from "./labels";
import { firstParam } from "./params";

const TYPES: readonly PeriodType[] = ["week", "month", "year", "custom"];
const KEY = /^\d{4}-\d{2}-\d{2}$/;
const asColor = (value: string | undefined): CategoryColorKey =>
  (categoryKeys as readonly string[]).includes(value ?? "")
    ? (value as CategoryColorKey)
    : "gray";

function SplitLineRow({
  entry,
  context,
}: {
  entry: Extract<CategoryEntry, { type: "split" }>;
  context: MoneyContext;
}) {
  const actions = useTransactionActions();
  const { item, line } = entry;
  const sign = item.kind === "income" ? "plus" : "minus";
  const amount = formatMoney(line.amount, item.currency, {
    locale: context.locale,
    sign,
    decimals: context.showDecimals ? undefined : 0,
  });
  const title = item.title || line.category.name;
  const subtitle = `Split · ${item.account.name}`;
  const open = React.useCallback(
    () => actions.open(item.id),
    [actions, item.id],
  );
  return (
    <TransactionRow
      kind={item.kind}
      title={title}
      subtitle={subtitle}
      amount={amount}
      trailing={formatTime(item.occurredAt)}
      icon={line.category.icon}
      color={asColor(line.category.color)}
      split
      accessibilityLabel={[
        title,
        subtitle,
        formatMoneyForSpeech(line.amount, item.currency, {
          sign,
          locale: context.locale,
        }),
        formatTime(item.occurredAt),
      ].join(", ")}
      separator={!entry.last}
      onPress={open}
    />
  );
}

/** Ledger row for this screen: the subtitle is the account only, the title already says the category. */
const CategoryTransactionRow = React.memo(function CategoryTransactionRow({
  item,
  context,
  separator,
}: {
  item: TransactionListItem;
  context: MoneyContext;
  separator: boolean;
}) {
  const actions = useTransactionActions();
  const model = React.useMemo(() => toRowModel(item, context), [item, context]);
  const id = item.id;
  return (
    <TransactionRow
      kind={model.kind}
      title={model.title}
      subtitle={item.account.name}
      amount={model.amount}
      trailing={model.trailing}
      icon={model.icon}
      color={model.color}
      split={model.split}
      accessibilityLabel={model.accessibilityLabel}
      separator={separator}
      onPress={() => actions.open(id)}
      onLongPress={() => actions.menu(id)}
      onDelete={() => actions.remove(id)}
      onDuplicate={() => actions.duplicate(id)}
    />
  );
});

export default function CategoryScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams();
  const rawId = firstParam(raw.id as string | string[] | undefined) ?? "";
  const kind =
    firstParam(raw.kind as string | undefined) === "income"
      ? "income"
      : "expense";
  const settings = useSettings();
  const today = useTodayKey();
  const money = useMoneyContext();
  const { category: palette } = useTokens();

  const period = React.useMemo<Period>(() => {
    const type = TYPES.find(
      (t) => t === firstParam(raw.type as string | undefined),
    );
    const from = firstParam(raw.from as string | undefined);
    const to = firstParam(raw.to as string | undefined);
    if (type && from && to && KEY.test(from) && KEY.test(to))
      return { type, from, to };
    // `?offset=-1` steps back whole months; used by screenshots and harmless otherwise.
    let current = periodFor("month", today, {
      weekStart: settings.week_start,
      monthStart: settings.month_start,
    });
    const offset = Math.max(
      -120,
      Math.min(
        0,
        Number.parseInt(
          firstParam(raw.offset as string | undefined) ?? "0",
          10,
        ) || 0,
      ),
    );
    for (let i = 0; i > offset; i--) current = previousPeriod(current);
    return current;
  }, [
    raw.type,
    raw.from,
    raw.to,
    raw.offset,
    today,
    settings.week_start,
    settings.month_start,
  ]);

  // `/category/top` resolves to the biggest category of the period (dev and screenshots).
  const topId = useTopCategoryId(period, kind, rawId === "top");
  const id = rawId === "top" ? (topId ?? "") : rawId;

  const trend = useCategoryTrend(id, period, kind);
  const last = trend.points.length - 1;
  const [picked, setPicked] = React.useState<number | null>(null);
  const selected = picked ?? last;
  const point = trend.points[selected];
  const selectedPeriod = point?.period ?? period;
  const category = trend.category;
  const tint = palette[asColor(category?.color)];

  const items = usePeriodTransactions({
    from: selectedPeriod.from,
    to: selectedPeriod.to,
    categoryId: id,
    kinds: [kind],
  });
  const entries = React.useMemo(
    () => buildCategoryEntries(items, id, today),
    [items, id, today],
  );
  const sticky = React.useMemo(
    () => entries.flatMap((e, i) => (e.type === "header" ? [i] : [])),
    [entries],
  );

  const { currency } = trend;
  const decimals = money.showDecimals ? undefined : 0;
  const fmtShort = (value: number) =>
    formatMoney(value, currency, { locale: money.locale, decimals: 0 });
  const bars = React.useMemo(
    () =>
      trend.points.map((p) => ({
        key: p.period.from,
        label: trendLabel(p.period),
        value: p.amount,
      })),
    [trend.points],
  );
  const noun = periodNoun(period);

  const header = (
    <View className="px-4 pb-2 pt-2">
      <Card className="p-0 px-4 pb-1 pt-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text variant="footnote" tone="secondary" numberOfLines={1}>
              {periodLabel(selectedPeriod)}
            </Text>
            <Text
              variant="title1"
              numeric
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatMoney(point?.amount ?? 0, currency, {
                locale: money.locale,
                decimals,
              })}
            </Text>
          </View>
          <View className="items-end">
            <Text
              variant="footnote"
              tone="secondary"
            >{`Average per ${noun}`}</Text>
            <Text variant="title2" tone="secondary" numeric>
              {formatMoney(trend.average, currency, {
                locale: money.locale,
                decimals,
              })}
            </Text>
          </View>
        </View>
        <MiniBars
          data={bars}
          currentIndex={last}
          selectedIndex={selected}
          onSelect={setPicked}
          average={trend.average}
          formatValue={(index) => fmtShort(trend.points[index]?.amount ?? 0)}
          color={tint}
          accessibilityLabel={`${category?.name ?? "Category"} over the last ${bars.length} periods`}
        />
      </Card>
      {entries.length === 0 ? (
        <Text variant="callout" tone="secondary" className="pt-10 text-center">
          Nothing in this period
        </Text>
      ) : null}
    </View>
  );

  const renderItem = React.useCallback(
    ({ item }: { item: CategoryEntry }) => {
      if (item.type === "header")
        return <DaySectionHeader label={item.label} />;
      if (item.type === "split")
        return <SplitLineRow entry={item} context={money} />;
      return (
        <CategoryTransactionRow
          item={item.item}
          context={money}
          separator={!item.last}
        />
      );
    },
    [money],
  );

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen
        options={{
          title: category?.name ?? "Category",
          ...barRight(
            <Button
              variant="barPrimary"
              size="sm"
              onPress={() =>
                router.push({
                  pathname: "/categories/[id]",
                  params: { id },
                })
              }
              accessibilityLabel="Edit category"
            >
              <Text variant="body">Edit</Text>
            </Button>,
          ),
        }}
      />
      <FlashList
        data={entries}
        renderItem={renderItem}
        keyExtractor={(e) => e.key}
        getItemType={(e) => e.type}
        stickyHeaderIndices={sticky}
        ListHeaderComponent={header}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
