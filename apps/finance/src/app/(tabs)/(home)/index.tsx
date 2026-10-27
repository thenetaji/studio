import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { AddFab } from "@/components/app/add-fab";
import { Button, EmptyState, Card } from "@studio/ui";
import {
  useAccounts,
  useAllTimeSpend,
  useBudgets,
  useCategories,
  useHomeSpend,
  useInsights,
  usePockets,
  useRecentTransactions,
  useSetting,
  useTodayKey,
  useUpcoming,
} from "@/data/hooks";
import { totalInDisplay } from "@/features/accounts/model";
import { daysLeft } from "@/features/budgets/logic";
import { SpendHeatmap } from "@/features/heatmap/spend-heatmap";
import { BudgetStatus } from "@/features/home/budget-status";
import { NetWorthHero } from "@/features/home/net-worth-hero";
import { QuickAdd } from "@/features/home/quick-add";
import { Pockets } from "@/features/home/pockets";
import { HomeSectionHeader } from "@/features/home/section-header";
import { SpendHero } from "@/features/home/spend-hero";
import { HomeTopBar } from "@/features/home/top-bar";
import { TopCategories } from "@/features/home/top-categories";
import { UpcomingBills } from "@/features/home/upcoming-bills";
import { TransactionListRow } from "@/features/transactions/transaction-list-row";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import {
  diffDays,
  monthName,
  parseKey,
  periodFor,
  previousPeriod,
} from "@studio/dates";
import { convertWithRates, formatMoney } from "@studio/money";
import { Stagger } from "@studio/motion";
import type { HomeSectionId } from "@/lib/home/layout";
import { billsDue, leftThisMonth, safePerDay } from "@/lib/home/overview";
import { budgetPace, elapsedDays } from "@/lib/budgets/pace";

const RECENT_COUNT = 5;
/** Bills are looked up at least this far ahead, and always to the end of the month. */
const BILLS_WINDOW_DAYS = 30;
const STAGGER = { base: 200, step: 55 } as const;
/** Gap above each section; quick add sits closer to the hero. */
const SPACING: Record<HomeSectionId, string> = {
  quick_add: "mt-[22px]",
  pockets: "mt-[26px]",
  budgets: "mt-[26px]",
  bills: "mt-[26px]",
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
  const categories = useCategories();
  const month = React.useMemo(
    () => periodFor("month", today, { weekStart, monthStart }),
    [today, weekStart, monthStart],
  );
  const spend = useHomeSpend(month, today);
  const allTime = useAllTimeSpend(today);
  const budgets = useBudgets();
  const occurrences = useUpcoming(
    Math.max(diffDays(today, month.to), BILLS_WINDOW_DAYS),
  );
  const insights = useInsights(month, "expense");
  const recent = useRecentTransactions(RECENT_COUNT);
  const [layout] = useSetting("home_layout");
  const pockets = usePockets();

  const { displayCurrency, rates, locale } = money;
  const categoryMap = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const overall = budgets.find(
    (b) =>
      b.budget.scope === "all" &&
      b.budget.period === "monthly" &&
      b.budget.currency === displayCurrency,
  );
  const netWorth = React.useMemo(
    () => totalInDisplay(accounts, { displayCurrency, rates }).total,
    [accounts, displayCurrency, rates],
  );
  const bills = React.useMemo(
    () =>
      billsDue(
        occurrences.map((o) => ({
          dueDate: o.dueDate,
          kind: o.rule.kind,
          amount: o.rule.amount,
          currency: o.rule.currency,
        })),
        month,
        (minor, currency) =>
          currency === displayCurrency
            ? minor
            : rates(currency, displayCurrency) === null
              ? null
              : convertWithRates(minor, currency, displayCurrency, rates),
      ),
    [occurrences, month, displayCurrency, rates],
  );
  const left = leftThisMonth({
    earned: spend.earned,
    spent: spend.spent,
    bills,
    budget: overall
      ? {
          available: overall.available,
          spent: overall.spent,
          bills: overall.upcoming,
        }
      : undefined,
  });
  const remainingDays = daysLeft(overall?.period ?? month, today);
  const overallAtRisk = overall
    ? budgetPace({
        spent: overall.spent,
        available: overall.available,
        upcoming: overall.upcoming,
        recurringSpent: overall.recurringSpent,
        totalDays: elapsedDays(overall.period, overall.period.to),
        elapsedDays: elapsedDays(overall.period, today),
      }).status !== "on_track"
    : false;
  const perDay = safePerDay(left.left, remainingDays);

  const decimals = money.showDecimals ? undefined : 0;
  const fmt = (minor: number, sign: "none" | "auto" = "none") =>
    formatMoney(minor, displayCurrency, { locale, sign, decimals });
  const billsShown = overall ? overall.upcoming : bills;
  const leftCaption =
    billsShown > 0
      ? `after ${fmt(billsShown)} in bills`
      : overall
        ? `of ${fmt(overall.available)}`
        : "earned less spent";
  const daysCaption =
    remainingDays <= 1 ? "Last day" : `a day · ${remainingDays} days left`;

  const end = parseKey(month.to);
  const previous = parseKey(previousPeriod(month).from);
  const empty = recent.length === 0;
  const hasBills = occurrences.some((o) => o.rule.kind === "expense");

  const renderSection = (id: HomeSectionId): React.ReactNode => {
    switch (id) {
      case "quick_add":
        return <QuickAdd />;
      case "pockets":
        return pockets.length > 0 ? (
          <Pockets
            pockets={pockets}
            locale={locale}
            showDecimals={money.showDecimals}
          />
        ) : null;
      case "budgets":
        return budgets.length > 0 ? (
          <BudgetStatus
            budgets={budgets}
            categories={categoryMap}
            todayKey={today}
            locale={locale}
            showDecimals={money.showDecimals}
          />
        ) : null;
      case "bills":
        return hasBills ? (
          <UpcomingBills
            occurrences={occurrences}
            categories={categoryMap}
            todayKey={today}
            locale={locale}
            showDecimals={money.showDecimals}
          />
        ) : null;
      case "heatmap":
        return (
          <SpendHeatmap
            todayKey={today}
            locale={locale}
            showDecimals={money.showDecimals}
            currency={displayCurrency}
          />
        );
      case "top_categories":
        return insights.categories.length > 0 ? (
          <TopCategories
            insights={insights}
            locale={locale}
            showDecimals={money.showDecimals}
          />
        ) : null;
      case "recent":
        return (
          <>
            <HomeSectionHeader
              title="Recent"
              actionLabel="All"
              onAction={() => router.navigate("/activity")}
            />
            <Card className="overflow-hidden rounded-[20px] p-0">
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
        <NetWorthHero
          netWorth={fmt(netWorth, "auto")}
          showStrip={!empty}
          basis={left.basis}
          left={fmt(left.left, "auto")}
          leftNegative={left.left < 0}
          leftCaption={leftCaption}
          perDay={fmt(perDay)}
          perDayZero={perDay <= 0}
          perDayCaption={daysCaption}
        />
        {empty ? (
          <EmptyState
            message="No transactions yet"
            actionLabel="Add transaction"
            onAction={() => router.push("/transaction/new")}
          />
        ) : (
          <>
            <View className="mt-7">
              <SpendHero
                spend={spend}
                allTime={allTime}
                monthLabel={monthName(end.month)}
                previousLabel={monthName(previous.month)}
                monthEnd={month.to}
                budget={overall ? Math.max(0, overall.available) : 0}
                budgetAtRisk={overallAtRisk}
                locale={locale}
                showDecimals={money.showDecimals}
              />
            </View>
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
