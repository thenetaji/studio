import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { AddFab } from "@/components/app/add-fab";
import { Button, EmptyState, Card } from "@studio/ui";
import {
  useAccounts,
  useAllTimeSpend,
  useBudgets,
  useHomeSpend,
  useInsights,
  usePockets,
  useRecentTransactions,
  useSetting,
  useTodayKey,
} from "@/data/hooks";
import { SpendHeatmap } from "@/features/heatmap/spend-heatmap";
import { ComingUp } from "@/features/home/coming-up";
import { useHeroPeriod } from "@/features/home/period-store";
import { QuickAdd } from "@/features/home/quick-add";
import { Pockets } from "@/features/home/pockets";
import { HomeSectionHeader } from "@/features/home/section-header";
import { SpendHero } from "@/features/home/spend-hero";
import { StatRow } from "@/features/home/stat-row";
import { HomeTopBar } from "@/features/home/top-bar";
import { TopCategories } from "@/features/home/top-categories";
import { TransactionListRow } from "@/features/transactions/transaction-list-row";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import { monthName, parseKey, periodFor } from "@studio/dates";
import { formatMoney, sumConverted } from "@studio/money";
import { Stagger } from "@studio/motion";
import type { HomeSectionId } from "@/lib/home/layout";

const RECENT_COUNT = 5;
const STAGGER = { base: 200, step: 55 } as const;
/** Gap above each section; quick add and the stats strip sit closer to the hero. */
const SPACING: Record<HomeSectionId, string> = {
  quick_add: "mt-[22px]",
  stats: "mt-5",
  pockets: "mt-[26px]",
  coming_up: "mt-[26px]",
  heatmap: "mt-[26px]",
  top_categories: "mt-[26px]",
  recent: "mt-[26px]",
};

export default function Home() {
  const router = useRouter();
  const money = useMoneyContext({ relativeDays: true });
  const today = useTodayKey();
  const [weekStart] = useSetting("week_start");
  const [monthStart] = useSetting("month_start");
  const accounts = useAccounts();
  const month = React.useMemo(
    () => periodFor("month", today, { weekStart, monthStart }),
    [today, weekStart, monthStart],
  );
  const spend = useHomeSpend(month, today);
  const allTime = useAllTimeSpend(today);
  const all = useHeroPeriod((s) => s.period) === "all";
  const budgets = useBudgets();
  const budget = React.useMemo(
    () =>
      budgets.find(
        (b) =>
          b.budget.scope === "all" &&
          b.budget.period === "monthly" &&
          b.budget.currency === spend.currency,
      )?.budget.amount ?? 0,
    [budgets, spend.currency],
  );
  const insights = useInsights(month, "expense");
  const recent = useRecentTransactions(RECENT_COUNT);
  const [layout] = useSetting("home_layout");
  const pockets = usePockets();

  const decimals = money.showDecimals ? undefined : 0;
  const balance = React.useMemo(
    () =>
      sumConverted(
        accounts.map((a) => ({ minor: a.balance, currency: a.currency })),
        money.displayCurrency,
        money.rates,
      ).total,
    [accounts, money.displayCurrency, money.rates],
  );
  const fmt = (minor: number, sign: "none" | "auto" | "plus" = "none") =>
    formatMoney(minor, money.displayCurrency, {
      locale: money.locale,
      sign,
      decimals,
    });

  const end = parseKey(month.to);
  const earned = all ? allTime.earned : spend.earned;
  const empty = recent.length === 0;

  const renderSection = (id: HomeSectionId): React.ReactNode => {
    switch (id) {
      case "quick_add":
        return <QuickAdd />;
      case "stats":
        return (
          <StatRow
            earned={fmt(earned, earned > 0 ? "plus" : "none")}
            earnedZero={earned <= 0}
            perDay={fmt(all ? allTime.perDay : spend.perDay)}
            balance={fmt(balance, "auto")}
            balanceNegative={balance < 0}
          />
        );
      case "pockets":
        return pockets.length > 0 ? (
          <Pockets
            pockets={pockets}
            locale={money.locale}
            showDecimals={money.showDecimals}
          />
        ) : null;
      case "coming_up":
        return (
          <ComingUp
            todayKey={today}
            locale={money.locale}
            showDecimals={money.showDecimals}
          />
        );
      case "heatmap":
        return (
          <SpendHeatmap
            todayKey={today}
            locale={money.locale}
            showDecimals={money.showDecimals}
            currency={money.displayCurrency}
          />
        );
      case "top_categories":
        return (
          <TopCategories
            insights={insights}
            locale={money.locale}
            showDecimals={money.showDecimals}
          />
        );
      case "recent":
        return (
          <>
            <HomeSectionHeader
              title="Recent"
              actionLabel="All"
              onAction={() => router.navigate("/activity")}
            />
            <Card className="rounded-[20px] p-0">
              {recent.map((item, i) => (
                <TransactionListRow
                  key={item.id}
                  item={item}
                  context={money}
                  separator={i < recent.length - 1}
                />
              ))}
            </Card>
          </>
        );
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <HomeTopBar />
      <ScrollView
        contentContainerClassName="px-4 pb-28"
        contentContainerStyle={empty ? { flexGrow: 1 } : undefined}
        showsVerticalScrollIndicator={false}
      >
        <SpendHero
          spend={spend}
          allTime={allTime}
          monthLabel={monthName(end.month)}
          budget={budget}
          locale={money.locale}
          showDecimals={money.showDecimals}
        />
        {empty ? (
          <EmptyState
            message="No transactions yet"
            actionLabel="Add transaction"
            onAction={() => router.push("/transaction/new")}
          />
        ) : (
          <>
            {layout
              .filter((section) => section.visible)
              .map((section, index) => {
                const content = renderSection(section.id);
                if (!content) return null;
                return (
                  <Stagger
                    key={section.id}
                    index={index}
                    {...STAGGER}
                    className={SPACING[section.id]}
                  >
                    {content}
                  </Stagger>
                );
              })}
            <View className="mt-6 items-center">
              <Button
                variant="barSecondary"
                size="sm"
                onPress={() => router.push("/settings/home")}
              >
                Customize Home
              </Button>
            </View>
          </>
        )}
      </ScrollView>
      <AddFab />
    </View>
  );
}
