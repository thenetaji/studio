import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { ReportEntryRow } from "@/features/report/entry";
import { ReviewEntryCard } from "@/features/review/entry";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  Amount,
  Card,
  Chip,
  ListGroup,
  ListRow,
  Pressable,
  SectionHeader,
  SegmentedControl,
  Text,
} from "@studio/ui";
import { Donut, DonutLegend } from "@studio/charts/components";
import {
  useBreakdown,
  useInsightLines,
  useInsights,
  useSettings,
  useTodayKey,
} from "@/data/hooks";
import {
  addDays,
  periodLabel,
  type PeriodSettings,
  type PeriodType,
} from "@studio/dates";
import { Stagger } from "@studio/motion";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import { haptic, useTokens } from "@studio/theme";
import {
  BREAKDOWN_BYS,
  type BreakdownBy,
  type InsightsScope,
} from "@/lib/insights";
import type { BreakdownSlice } from "@/data/hooks";

import { BothHero } from "./both-hero";
import { BreakdownList } from "./breakdown-list";
import {
  BREAKDOWN_LABELS,
  breakdownDonut,
  breakdownSummary,
  breakdownTitle,
  selectedSlices,
} from "./breakdown-model";
import { CashFlowCard } from "./cash-flow-card";
import {
  cashFlowMonths,
  cashFlowRange,
  monthlyCashFlow,
} from "./cashflow-model";
import { CategoryList, type CategoryListItem } from "./category-list";
import { CompareCard } from "./compare-card";
import { FlowCard } from "./flow-card";
import { deltaLine, previousName, trendBadge } from "./labels";
import { KindMenu } from "./kind-menu";
import { donutData, keyForName, listItems, summaryLabel } from "./model";
import { NetWorthCard } from "./net-worth-card";
import {
  canStepForward,
  contextParams,
  firstParam,
  parseBreakdownBy,
  parseInsightsParams,
  parseScope,
  periodOf,
  singleKind,
  stepView,
  type InsightsContext,
  type InsightsKind,
  type InsightsParams,
  type InsightsView,
} from "./params";
import { PayeesCard } from "./payees-card";
import { PeriodControls } from "./period-controls";
import { useRangeStore } from "./range-store";
import { ScopeBar } from "./scope-bar";
import {
  categoryKeyOf,
  categoryTrends,
  comparePeriods,
  trendsRange,
} from "./trends-model";

const LIST_TITLES: Record<BreakdownBy, string> = {
  category: "Categories",
  group: "Groups",
  tag: "Tags",
  account: "Accounts",
  merchant: "Merchants",
};

/** The deeper half of the screen shows one of these at a time. */
const SECTIONS = ["flow", "compare", "payees", "worth"] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABELS = ["Flow", "Compare", "Payees", "Net worth"] as const;

/** Category rows shown before "Show all". */
const LIST_LIMIT = 6;

type Selection = { key: string } | { name: string } | null;

export default function InsightsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as InsightsParams & {
    section?: string;
    worth?: string;
  };
  const settings = useSettings();
  const money = useMoneyContext();
  const today = useTodayKey();
  const openRange = useRangeStore((s) => s.open);

  const periodSettings = React.useMemo<PeriodSettings>(
    () => ({
      weekStart: settings.week_start,
      monthStart: settings.month_start,
    }),
    [settings.week_start, settings.month_start],
  );
  const [initial] = React.useState(() =>
    parseInsightsParams(params, today, periodSettings),
  );
  const [view, setView] = React.useState<InsightsView>(initial.view);
  const [selection, setSelection] = React.useState<Selection>(
    initial.select ? { name: initial.select } : null,
  );
  const [by, setBy] = React.useState<BreakdownBy>(() =>
    parseBreakdownBy(params.by),
  );
  const [scope, setScope] = React.useState<InsightsScope>(() =>
    parseScope(params),
  );
  const [section, setSection] = React.useState<Section>(
    () => SECTIONS.find((s) => s === firstParam(params.section)) ?? "flow",
  );
  const [showAll, setShowAll] = React.useState(false);

  const period = periodOf(view, periodSettings);
  const both = view.kind === "both";
  const kind = singleKind(view.kind);
  const spending = useInsights(period, "expense", today, scope);
  const income = useInsights(period, "income", today, scope);
  const insights = kind === "income" ? income : spending;
  const breakdown = useBreakdown(period, kind, by, scope);
  const byCategory = by === "category";
  const { currency } = insights;
  const { scheme } = useTokens();
  const fmt = React.useMemo(
    () => ({
      currency,
      locale: money.locale,
      showDecimals: money.showDecimals,
      scheme,
    }),
    [currency, money.locale, money.showDecimals, scheme],
  );

  // One read of raw lines feeds the category trends, the comparison, payees and the monthly cash flow.
  const months = React.useMemo(
    () => cashFlowMonths(period, today, periodSettings),
    [period, today, periodSettings],
  );
  const linesRange = React.useMemo(() => {
    const trend = trendsRange(period);
    const cash = cashFlowRange(months);
    return {
      from: trend.from < cash.from ? trend.from : cash.from,
      to: period.to > cash.to ? period.to : cash.to,
    };
  }, [period, months]);
  const lines = useInsightLines(linesRange, scope);
  const trends = React.useMemo(
    () => categoryTrends(lines.lines, kind, period, today, lines.ctx),
    [lines, kind, period, today],
  );
  const comparison = React.useMemo(
    () => comparePeriods(lines.lines, kind, period, today, lines.ctx),
    [lines, kind, period, today],
  );
  const cashFlow = React.useMemo(
    () => monthlyCashFlow(lines.lines, months, period, today, lines.ctx),
    [lines, months, period, today],
  );
  const context = React.useMemo<InsightsContext>(
    () => ({ period, kind, scope }),
    [period, kind, scope],
  );
  const before = previousName(period);

  const donut = React.useMemo(
    () =>
      byCategory
        ? donutData(insights, fmt)
        : breakdownDonut(breakdown.slices, fmt),
    [byCategory, insights, breakdown.slices, fmt],
  );
  const rawKey =
    selection === null
      ? null
      : "key" in selection
        ? selection.key
        : byCategory
          ? keyForName(insights, selection.name)
          : null;
  const selectedKey =
    rawKey !== null && donut.some((d) => d.key === rawKey) ? rawKey : null;
  const rows = React.useMemo<CategoryListItem[]>(
    () =>
      listItems(insights, selectedKey).map((item) => {
        const trend = trends.get(categoryKeyOf(item.id));
        return trend && trend.spark.some((v) => v > 0)
          ? {
              ...item,
              trend: trendBadge(trend, kind, before, {
                currency,
                locale: money.locale,
              }),
            }
          : item;
      }),
    [insights, selectedKey, trends, kind, before, currency, money.locale],
  );
  const visibleRows =
    showAll || selectedKey !== null ? rows : rows.slice(0, LIST_LIMIT);
  const slices = React.useMemo(
    () => selectedSlices(breakdown.slices, selectedKey),
    [breakdown.slices, selectedKey],
  );

  const delta =
    insights.previousTotal > 0
      ? deltaLine(insights.delta, period, kind, {
          currency,
          locale: money.locale,
        })
      : null;
  const [deltaAsAmount, setDeltaAsAmount] = React.useState(false);
  const forward = canStepForward(view, today, periodSettings);

  // Period change crossfades 200 ms; the charts themselves do not replay their intro.
  const reduced = useReducedMotion();
  const fade = useSharedValue(1);
  const dataKey = `${period.from}:${period.to}:${kind}:${scope.accountId ?? ""}:${scope.tagId ?? ""}`;
  React.useEffect(() => {
    if (reduced) return;
    fade.value = 0.3;
    fade.value = withTiming(1, { duration: 200 });
  }, [dataKey, fade, reduced]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const reset = () => {
    setSelection(null);
    setShowAll(false);
  };
  const step = (direction: 1 | -1) => {
    if (direction === 1 && !forward) return;
    setView((current) => stepView(current, direction, periodSettings));
    reset();
  };
  const editCustom = () => {
    openRange({
      initial: { from: period.from, to: period.to },
      onApply: (range) => {
        setView((current) => ({ ...current, type: "custom", custom: range }));
        reset();
      },
    });
    router.push("/insights-range" as Href);
  };
  const changeType = (type: PeriodType) => {
    if (type === view.type) return;
    if (type === "custom") {
      const from = view.custom?.from ?? addDays(today, -29);
      const to = view.custom?.to ?? today;
      setView((current) => ({
        ...current,
        type: "custom",
        custom: { from, to },
      }));
      reset();
      openRange({
        initial: { from, to },
        onApply: (range) =>
          setView((current) => ({ ...current, type: "custom", custom: range })),
      });
      router.push("/insights-range" as Href);
      return;
    }
    setView((current) => ({
      ...current,
      type,
      anchor: current.type === "custom" ? today : current.anchor,
    }));
    reset();
  };
  const changeKind = (next: InsightsKind) => {
    if (next === view.kind) return;
    setView((current) => ({ ...current, kind: next }));
    reset();
  };
  const changeBy = (next: BreakdownBy) => {
    if (next === by) return;
    haptic("selection");
    setBy(next);
    setSelection(null);
  };
  const changeScope = (next: InsightsScope) => {
    setScope(next);
    reset();
  };
  const changeSection = (index: number) => {
    const next = SECTIONS[index] ?? "flow";
    if (next !== section) setSection(next);
  };
  const openCategoryId = (id: string, categoryKind: "expense" | "income") =>
    router.push({
      pathname: "/category/[id]",
      params: {
        id,
        from: period.from,
        to: period.to,
        type: period.type,
        kind: categoryKind,
      },
    });
  const openSlice = (slice: BreakdownSlice) => {
    const target = slice.target;
    if (target === null) return;
    if (target.type === "category") openCategoryId(target.id, kind);
    else if (target.type === "tag")
      router.push({ pathname: "/tags/[id]", params: { id: target.id } });
    else router.push({ pathname: "/accounts/[id]", params: { id: target.id } });
  };
  const openCategory = (item: CategoryListItem) => {
    if (item.id !== null) openCategoryId(item.id, kind);
  };
  const jumpToCurrent = () => {
    haptic("selection");
    setView((current) => ({ ...current, anchor: today }));
    reset();
  };

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-16, 16])
    .onEnd((event) => {
      if (event.translationX < -60) step(1);
      else if (event.translationX > 60) step(-1);
    });

  const decimals = money.showDecimals ? undefined : 0;
  const total = formatMoney(insights.total, currency, {
    locale: money.locale,
    decimals,
  });

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <PeriodControls
          type={view.type}
          label={periodLabel(period)}
          canForward={forward}
          onType={changeType}
          onStep={step}
          onEditCustom={editCustom}
          onJumpToCurrent={jumpToCurrent}
        />
        <ScopeBar scope={scope} onChange={changeScope} />
        <Animated.View style={fadeStyle}>
          <GestureDetector gesture={swipe}>
            <View collapsable={false}>
              <View className="px-4 pb-1 pt-3">
                <KindMenu kind={view.kind} onChange={changeKind} />
                {both ? (
                  <BothHero
                    spent={spending.total}
                    earned={income.total}
                    currency={currency}
                    locale={money.locale}
                    decimals={decimals}
                  />
                ) : (
                  <View className="pt-1">
                    <Amount
                      value={total}
                      variant="hero"
                      animate="intro"
                      accessibilityLabel={formatMoneyForSpeech(
                        insights.total,
                        currency,
                        { sign: "none", locale: money.locale },
                      )}
                    />
                  </View>
                )}
                <View className="h-5">
                  {delta && !both ? (
                    <Pressable
                      role="button"
                      accessibilityLabel={`${delta.text}, tap to show ${deltaAsAmount ? "percent" : "amount"}`}
                      scale={1}
                      dimTo={0.6}
                      hitSlop={{ top: 8, bottom: 8, right: 16 }}
                      onPress={() => {
                        haptic("selection");
                        setDeltaAsAmount((v) => !v);
                      }}
                      className="self-start"
                    >
                      <Animated.View
                        key={deltaAsAmount ? "amount" : "percent"}
                        entering={FadeIn.duration(200)}
                      >
                        <Text
                          variant="footnote"
                          tone={delta.good ? "income" : "secondary"}
                          numeric
                        >
                          {deltaAsAmount && delta.alt ? delta.alt : delta.text}
                        </Text>
                      </Animated.View>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <Stagger index={1}>
                <SectionHeader title={breakdownTitle(by, kind)} />
                <Card className="mx-4 items-center px-0 pb-2 pt-3">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="self-stretch"
                    contentContainerClassName="gap-2 px-3 pb-4"
                    accessibilityLabel="Break down by"
                  >
                    {BREAKDOWN_BYS.map((option) => (
                      <Chip
                        key={option}
                        label={BREAKDOWN_LABELS[option]}
                        selected={option === by}
                        onPress={() => changeBy(option)}
                      />
                    ))}
                  </ScrollView>
                  <Donut
                    data={donut}
                    selectedKey={selectedKey}
                    onSelect={(key) =>
                      setSelection(key === null ? null : { key })
                    }
                    accessibilityLabel={
                      byCategory
                        ? summaryLabel(insights, kind)
                        : breakdownSummary(breakdown.slices, by, kind)
                    }
                    emptyLabel="Nothing yet"
                  />
                  <DonutLegend
                    data={donut}
                    selectedKey={selectedKey}
                    onSelect={(key) =>
                      setSelection(key === null ? null : { key })
                    }
                  />
                </Card>
              </Stagger>
            </View>
          </GestureDetector>

          <SectionHeader
            title={LIST_TITLES[by]}
            actionLabel={selectedKey !== null ? "Show all" : undefined}
            onAction={() => setSelection(null)}
          />
          <Card className="mx-4 p-0">
            {!byCategory && slices.length > 0 ? (
              <BreakdownList
                key={by}
                slices={slices}
                currency={currency}
                locale={money.locale}
                showDecimals={money.showDecimals}
                onOpen={openSlice}
              />
            ) : rows.length === 0 || !byCategory ? (
              <Text
                variant="callout"
                tone="secondary"
                className="py-8 text-center"
              >
                Nothing in this period
              </Text>
            ) : (
              <>
                <CategoryList
                  items={visibleRows}
                  currency={currency}
                  locale={money.locale}
                  showDecimals={money.showDecimals}
                  onPress={openCategory}
                />
                {visibleRows.length < rows.length ? (
                  <Pressable
                    role="button"
                    scale={1}
                    accessibilityLabel={`Show all ${rows.length} categories`}
                    onPress={() => {
                      haptic("selection");
                      setShowAll(true);
                    }}
                    className="h-11 justify-center border-t border-separator px-4 active:bg-fill"
                  >
                    <Text variant="callout" tone="accent">
                      {`Show all ${rows.length}`}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </Card>

          <View className="px-4 pt-8">
            <SegmentedControl
              values={SECTION_LABELS}
              selectedIndex={SECTIONS.indexOf(section)}
              onChange={changeSection}
              accessibilityLabel="Section"
            />
          </View>
          {section === "flow" ? (
            <>
              <FlowCard
                income={income}
                spending={spending}
                currency={currency}
                locale={money.locale}
                onOpenCategory={openCategoryId}
              />
              {cashFlow.income > 0 || cashFlow.spent > 0 ? (
                <CashFlowCard
                  flow={cashFlow}
                  currency={currency}
                  locale={money.locale}
                />
              ) : null}
              {spending.total === 0 && income.total === 0 ? (
                <Text
                  variant="callout"
                  tone="secondary"
                  className="py-10 text-center"
                >
                  Nothing in this period
                </Text>
              ) : null}
            </>
          ) : null}
          {section === "compare" ? (
            comparison.current > 0 || comparison.previous > 0 ? (
              <CompareCard
                comparison={comparison}
                kind={kind}
                categories={lines.categories}
                currency={currency}
                locale={money.locale}
                previousName={before}
                onOpenCategory={(id) => openCategoryId(id, kind)}
              />
            ) : (
              <Text
                variant="callout"
                tone="secondary"
                className="py-10 text-center"
              >
                Nothing to compare
              </Text>
            )
          ) : null}
          {section === "payees" ? (
            <PayeesCard
              data={lines}
              context={context}
              locale={money.locale}
              showDecimals={money.showDecimals}
            />
          ) : null}
          {section === "worth" ? (
            <NetWorthCard
              period={period}
              today={today}
              settings={periodSettings}
              locale={money.locale}
              initialStacked={firstParam(params.worth) === "stacked"}
            />
          ) : null}

          <View className="gap-3 px-4 pt-8">
            <ReportEntryRow />
            <ReviewEntryCard />
          </View>
          <View className="pt-6">
            <ListGroup>
              <ListRow
                label="More insights"
                subtitle="Daily, running total, weekdays, accounts"
                chevron
                onPress={() =>
                  router.push({
                    pathname: "/insights-more",
                    params: { ...contextParams(context), by },
                  })
                }
              />
            </ListGroup>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
