import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { EmptyState, barRight, Button, Card, Text } from "@studio/ui";
import { PaceChart, paceLabel } from "@studio/charts/components";
import {
  useBudgetDetail,
  useCategories,
  usePeriodTransactions,
  useTodayKey,
} from "@/data/hooks";
import { TransactionDayList } from "@/features/transactions/transaction-day-list";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import {
  nextPeriod,
  periodLabel,
  previousPeriod,
  type Period,
} from "@studio/dates";
import { formatMoneyForSpeech } from "@studio/money";
import { Stagger } from "@studio/motion";
import { haptic, useTokens } from "@studio/theme";

import { BudgetCard } from "./budget-card";
import { toBudgetView } from "./model";
import { paceColor } from "./pace-status";
import { PeriodStepper } from "./period-stepper";

function stepFrom(base: Period, offset: number): Period {
  let period = base;
  for (let i = 0; i < Math.abs(offset); i++)
    period = offset < 0 ? previousPeriod(period) : nextPeriod(period);
  return period;
}

/** Budget detail: period stepper, progress card, pace chart and the period's spending. */
export default function BudgetDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTokens();
  const money = useMoneyContext();
  const today = useTodayKey();
  const categories = useCategories();
  const [offset, setOffset] = React.useState(0);
  const [selected, setSelected] = React.useState<number | null>(null);

  const current = useBudgetDetail(id);
  const base = current?.period;
  const wanted = base ? stepFrom(base, offset) : undefined;
  const detail = useBudgetDetail(id, wanted?.from);
  const period = detail?.period ?? wanted;

  const items = usePeriodTransactions({
    from: period?.from ?? today,
    to: period?.to ?? today,
    kinds: ["expense"],
  });
  const scoped = React.useMemo(() => {
    const budget = detail?.budget;
    if (!budget) return [];
    if (budget.scope === "all") return items;
    const ids = new Set(budget.categoryIds);
    return items.filter((item) =>
      item.splits.length > 0
        ? item.splits.some((s) => ids.has(s.categoryId))
        : item.categoryId !== null && ids.has(item.categoryId),
    );
  }, [items, detail?.budget]);

  const categoryMap = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  if (!detail || !period) {
    return (
      <View className="flex-1 justify-center bg-bg">
        <Stack.Screen options={{ title: "Budget" }} />
        <EmptyState
          message="Budget not found"
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const { budget } = detail;
  const isCurrent = offset === 0;
  const view = toBudgetView(
    detail,
    {
      locale: money.locale,
      showDecimals: money.showDecimals,
      todayKey: today,
      categories: categoryMap,
    },
    isCurrent,
  );
  const last = detail.pace.length - 1;
  const labels =
    detail.pace.length > 2
      ? [0, Math.floor(last / 2), last].map((index) => ({
          index,
          text: String(Number(detail.pace[index]?.key.slice(8))),
        }))
      : [];
  const tint =
    view.status === "on_track" ? undefined : paceColor(view.status, colors);
  const point = selected !== null ? detail.pace[selected] : undefined;
  const chartLabel = point
    ? paceLabel(selected ?? 0, point, budget.currency, money.locale)
    : `Spending pace, ${formatMoneyForSpeech(detail.spent, budget.currency, { sign: "none", locale: money.locale })} of ${formatMoneyForSpeech(detail.available, budget.currency, { sign: "none", locale: money.locale })}`;

  const header = (
    <View className="gap-4 pt-2">
      <PeriodStepper
        label={periodLabel(period)}
        canForward={!isCurrent}
        onTitlePress={
          isCurrent
            ? undefined
            : () => {
                haptic("selection");
                setSelected(null);
                setOffset(0);
              }
        }
        onStep={(direction) => {
          setSelected(null);
          setOffset((n) => Math.min(n + direction, 0));
        }}
      />
      <Stagger index={0} className="px-4">
        <BudgetCard view={view} />
      </Stagger>
      <Stagger index={1}>
        <Card className="mx-4 px-4 pb-1 pt-3">
          <PaceChart
            data={detail.pace}
            currency={budget.currency}
            locale={money.locale}
            selectedIndex={selected}
            onSelect={setSelected}
            labels={labels}
            color={tint}
            accessibilityLabel={chartLabel}
          />
        </Card>
      </Stagger>
      <Text
        variant="headline"
        accessibilityRole="header"
        className="px-4 pb-1 pt-2"
      >
        {scoped.length > 0
          ? `${scoped.length} ${scoped.length === 1 ? "transaction" : "transactions"}`
          : "Transactions"}
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen
        options={{
          title: view.name,
          ...barRight(
            <Button
              variant="barPrimary"
              size="sm"
              onPress={() =>
                router.push({
                  pathname: "/budget/[id]/edit",
                  params: { id: budget.id },
                })
              }
              accessibilityLabel="Edit"
            >
              <Text variant="body">Edit</Text>
            </Button>,
          ),
        }}
      />
      <TransactionDayList
        items={scoped}
        context={money}
        header={header}
        empty={
          <Text
            variant="callout"
            tone="secondary"
            className="px-4 py-8 text-center"
          >
            Nothing spent
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}
