import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { EmptyState, showToast, Card } from "@studio/ui";
import { useActions } from "@/data/actions";
import { useBudgets, useCategories, useTodayKey } from "@/data/hooks";
import type { BudgetInput } from "@/db/repos/budgets";
import { Stagger } from "@studio/motion";
import { useMoneyContext } from "@/features/transactions/use-money-context";

import { BudgetCard } from "./budget-card";
import { BudgetRow } from "./budget-row";
import { toBudgetView } from "./model";

/** Budgets tab: overall cards first, then one row per category budget. */
export function BudgetsScreen() {
  const router = useRouter();
  const actions = useActions();
  const money = useMoneyContext();
  const todayKey = useTodayKey();
  const progress = useBudgets();
  const categories = useCategories();
  const categoryMap = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const views = React.useMemo(
    () =>
      progress.map((p) =>
        toBudgetView(p, {
          locale: money.locale,
          showDecimals: money.showDecimals,
          todayKey,
          categories: categoryMap,
        }),
      ),
    [progress, money.locale, money.showDecimals, todayKey, categoryMap],
  );
  const overall = views.filter((v) => v.scope === "all");
  const rows = views.filter((v) => v.scope === "categories");

  const open = (id: string) =>
    router.push({ pathname: "/budget/[id]", params: { id } });
  const remove = (id: string) => {
    const found = progress.find((p) => p.budget.id === id)?.budget;
    if (!found) return;
    const input: BudgetInput = {
      name: found.name,
      amount: found.amount,
      currency: found.currency,
      period: found.period,
      startAnchor: found.startAnchor,
      scope: found.scope,
      categoryIds: found.categoryIds,
      rollover: found.rollover,
    };
    actions.budgets.delete(id);
    showToast({
      message: "Deleted",
      actionLabel: "Undo",
      onAction: () => actions.budgets.create(input),
    });
  };

  if (views.length === 0) {
    return (
      <View className="flex-1 bg-bg">
        <EmptyState
          message="No budgets"
          actionLabel="Add budget"
          onAction={() => router.push("/budget/new")}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 px-4 pb-10 pt-2"
      >
        {overall.map((view, i) => (
          <Stagger key={view.id} index={i}>
            <BudgetCard view={view} onPress={() => open(view.id)} />
          </Stagger>
        ))}
        {rows.length > 0 ? (
          <Stagger index={overall.length}>
            <Card className="p-0">
              {rows.map((view, index) => (
                <BudgetRow
                  key={view.id}
                  view={view}
                  separator={index < rows.length - 1}
                  onPress={() => open(view.id)}
                  onDelete={() => remove(view.id)}
                />
              ))}
            </Card>
          </Stagger>
        ) : null}
      </ScrollView>
    </View>
  );
}
