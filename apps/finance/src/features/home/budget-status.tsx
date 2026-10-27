import { useRouter } from "expo-router";
import * as React from "react";
import { View } from "react-native";

import { Card } from "@studio/ui";
import type { BudgetSpent } from "@/data/hooks";
import type { CategoryRow } from "@/db/schema";
import { BudgetRow } from "@/features/budgets/budget-row";
import { toBudgetView, type BudgetView } from "@/features/budgets/model";

import { HomeSectionHeader } from "./section-header";

const ROWS = 4;
const SEVERITY: Record<BudgetView["status"], number> = {
  over: 0,
  at_risk: 1,
  on_track: 2,
};

type BudgetStatusProps = {
  budgets: readonly BudgetSpent[];
  categories: ReadonlyMap<string, CategoryRow>;
  todayKey: string;
  locale?: string;
  showDecimals: boolean;
};

/**
 * Budget status on Home: the all-spending budget first, then category budgets that need attention (over, then at
 * risk, then the most used). Hidden when there are no budgets.
 */
function BudgetStatus({
  budgets,
  categories,
  todayKey,
  locale,
  showDecimals,
}: BudgetStatusProps) {
  const router = useRouter();
  const views = React.useMemo(() => {
    const all = budgets.map((p) =>
      toBudgetView(p, { locale, showDecimals, todayKey, categories }),
    );
    return all
      .sort(
        (a, b) =>
          (a.scope === "all" ? -1 : 0) - (b.scope === "all" ? -1 : 0) ||
          SEVERITY[a.status] - SEVERITY[b.status] ||
          b.ratio - a.ratio,
      )
      .slice(0, ROWS);
  }, [budgets, locale, showDecimals, todayKey, categories]);
  if (views.length === 0) return null;

  return (
    <View>
      <HomeSectionHeader
        title="Budgets"
        actionLabel="All"
        onAction={() => router.navigate("/budgets")}
      />
      <Card className="overflow-hidden rounded-[20px] p-0">
        {views.map((view, index) => (
          <BudgetRow
            key={view.id}
            view={view}
            separator={index < views.length - 1}
            onPress={() =>
              router.push({ pathname: "/budget/[id]", params: { id: view.id } })
            }
          />
        ))}
      </Card>
    </View>
  );
}

export { BudgetStatus };
