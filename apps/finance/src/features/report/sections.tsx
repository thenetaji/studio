import { useRouter } from "expo-router";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import { AppIcon } from "@studio/icons";
import {
  AnimatedNumber,
  Card,
  IconTile,
  Pressable,
  ProgressBar,
  SectionHeader,
  Text,
  type TextTone,
} from "@studio/ui";
import type { MonthReport, ReportBudget, ReportCategory } from "@/data/hooks";
import { addDays, dayLabel, weekday, type DateKey } from "@studio/dates";
import { formatMoney } from "@studio/money";
import {
  categoryKeys,
  useTokens,
  withAlpha,
  type CategoryColorKey,
} from "@studio/theme";
import { foldCategories, dayStatus, type DayStatus } from "@/lib/reports";
import { peakCaption, weekdayShort } from "@/features/insights/labels";
import { weekdayLetters, leadingBlanks } from "@/features/calendar/grid";
import { daysText, rangeText } from "@/features/calendar/no-spend-labels";

import {
  percentChange,
  pointsChange,
  rateText,
  shortMonthOfPeriod,
} from "./labels";
import { ColumnBars, DayDot, Dumbbell } from "./marks";
import type { ReportMoney } from "./money";

export const asColor = (value: string | undefined | null): CategoryColorKey =>
  (categoryKeys as readonly string[]).includes(value ?? "")
    ? (value as CategoryColorKey)
    : "gray";

const hairline = StyleSheet.hairlineWidth * 2;

/** A card row; the separator above it is a hairline inset past the leading icon (`inset`). */
function Row({
  children,
  separator,
  inset = 16,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  separator: boolean;
  inset?: number;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTokens();
  const line = separator ? (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: inset,
        right: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.separator,
      }}
    />
  ) : null;
  if (!onPress)
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        className="px-4 py-3"
      >
        {line}
        {children}
      </View>
    );
  return (
    <Pressable
      role="button"
      accessibilityLabel={accessibilityLabel}
      scale={0.98}
      onPress={onPress}
      className="px-4 py-3"
    >
      {line}
      {children}
    </Pressable>
  );
}

// -- Headline -------------------------------------------------------------------------------------

function Tile({
  label,
  value,
  caption,
  captionTone = "tertiary",
  tone,
}: {
  label: string;
  value: string;
  caption: string | null;
  captionTone?: TextTone;
  tone?: TextTone;
}) {
  return (
    <Card
      className="rounded-[16px] px-3.5 py-3"
      style={{ flex: 1, flexBasis: 0, minWidth: 0 }}
      accessible
      accessibilityLabel={`${label}, ${value}${caption ? `, ${caption}` : ""}`}
    >
      <Text variant="footnote" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <AnimatedNumber
        value={value}
        variant="headline"
        tone={tone}
        fit
        intro
        className="mt-1"
      />
      <Text
        variant="caption"
        tone={captionTone}
        numberOfLines={1}
        className="mt-0.5"
      >
        {caption ?? " "}
      </Text>
    </Card>
  );
}

/** Earned, net and savings rate with their change against the comparison month. */
export function HeadlineTiles({
  report,
  money,
}: {
  report: MonthReport;
  money: ReportMoney;
}) {
  // The footnote under the tiles names the comparison month, so captions carry only the change.
  const earnedCaption = percentChange(report.deltas.earned.percent);
  const netCaption =
    report.deltas.net.amount === 0
      ? "No change"
      : money.change(report.deltas.net.amount);
  const rateCaption = pointsChange(report.deltas.savingsRatePoints);
  return (
    <View className="flex-row gap-2.5 px-4">
      <Tile
        label="Earned"
        value={money.full(report.current.earned)}
        tone={report.current.earned > 0 ? "income" : undefined}
        caption={earnedCaption}
      />
      <Tile
        label="Net"
        value={money.signed(report.current.net)}
        caption={netCaption}
      />
      <Tile
        label="Saved"
        value={rateText(report.current.savingsRate)}
        caption={rateCaption}
      />
    </View>
  );
}

// -- Categories -----------------------------------------------------------------------------------

const CATEGORY_ROWS = 6;

function LegendKey({ filled, label }: { filled: boolean; label: string }) {
  const { colors } = useTokens();
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: 4.5,
          backgroundColor: filled ? colors.textSecondary : colors.surface,
          borderWidth: filled ? 0 : 1.5,
          borderColor: colors.textTertiary,
        }}
      />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

/** Spending per category: this month (dot) against the comparison month (ring) on one scale. */
export function CategoryCard({
  report,
  money,
}: {
  report: MonthReport;
  money: ReportMoney;
}) {
  const router = useRouter();
  const { category: palette } = useTokens();
  const rows = React.useMemo(() => {
    const byId = new Map(report.categories.map((c) => [c.categoryId, c]));
    return foldCategories(report.categories, CATEGORY_ROWS).map((row) => ({
      ...row,
      category: row.isOther
        ? null
        : (byId.get(row.categoryId)?.category ?? null),
    }));
  }, [report.categories]);
  const max = Math.max(0, ...rows.map((r) => Math.max(r.current, r.previous)));
  const current = shortMonthOfPeriod(report.period);
  const previous = shortMonthOfPeriod(report.previous);
  return (
    <View>
      <SectionHeader title="Spending by category" />
      <Card className="mx-4 p-0">
        <View className="flex-row gap-4 px-4 pb-1 pt-3">
          <LegendKey
            filled
            label={report.compared.partial ? `${current} so far` : current}
          />
          <LegendKey
            filled={false}
            label={
              report.compared.partial ? `${previous}, same days` : previous
            }
          />
        </View>
        {rows.map((row, index) => {
          const name = row.isOther
            ? "Other"
            : (row.category?.name ?? "Uncategorised");
          const color = asColor(row.isOther ? "gray" : row.category?.color);
          const change = percentChange(row.percent);
          const changeText =
            row.previous === 0
              ? "New"
              : row.current === 0
                ? `None in ${current}`
                : (change ?? "");
          const fell = row.change < 0;
          const id = row.categoryId;
          return (
            <Row
              key={`${id ?? "none"}${row.isOther ? ":other" : ""}`}
              separator={index > 0}
              inset={58}
              accessibilityLabel={`${name}, ${money.full(row.current)}, ${previous} ${money.full(row.previous)}, ${changeText}`}
              onPress={
                row.isOther || id === null
                  ? undefined
                  : () =>
                      router.push({
                        pathname: "/category/[id]",
                        params: {
                          id,
                          from: report.period.from,
                          to: report.period.to,
                          type: "month",
                          kind: "expense",
                        },
                      })
              }
            >
              <View className="flex-row items-center gap-3">
                <IconTile
                  icon={
                    row.isOther
                      ? "ellipsis.circle.fill"
                      : (row.category?.icon ?? "tag.fill")
                  }
                  color={color}
                  size={30}
                />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-baseline justify-between gap-2">
                    <Text
                      variant="callout"
                      numberOfLines={1}
                      className="min-w-0 flex-1 font-medium"
                    >
                      {name}
                    </Text>
                    <Text variant="callout" numeric className="font-semibold">
                      {money.full(row.current)}
                    </Text>
                  </View>
                  <View className="mt-2 flex-row items-center gap-3">
                    <View className="flex-1">
                      <Dumbbell
                        current={row.current}
                        previous={row.previous}
                        max={max}
                        color={palette[color]}
                        index={index}
                      />
                    </View>
                    <Text
                      variant="caption"
                      numeric
                      tone={fell ? "income" : "tertiary"}
                      numberOfLines={1}
                      style={{ minWidth: 44, textAlign: "right" }}
                    >
                      {changeText}
                    </Text>
                  </View>
                </View>
              </View>
            </Row>
          );
        })}
      </Card>
    </View>
  );
}

// -- What changed ---------------------------------------------------------------------------------

function ChangeRow({
  row,
  money,
  previousName,
  separator,
}: {
  row: ReportCategory;
  money: ReportMoney;
  previousName: string;
  separator: boolean;
}) {
  const { colors } = useTokens();
  const up = row.change > 0;
  const name = row.category?.name ?? "Uncategorised";
  const from =
    row.previous === 0
      ? `None in ${previousName}`
      : `${money.full(row.previous)} in ${previousName}`;
  const pct = row.previous === 0 ? null : percentChange(row.percent);
  return (
    <Row
      separator={separator}
      inset={56}
      accessibilityLabel={`${name} ${up ? "up" : "down"} ${money.change(row.change)}, ${from}`}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{
            backgroundColor: up ? colors.fill : withAlpha(colors.income, 0.12),
          }}
        >
          <AppIcon
            name={up ? "arrow.up.right" : "arrow.down.right"}
            size={13}
            color={up ? colors.textSecondary : colors.income}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="callout" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {from}
          </Text>
        </View>
        <View className="items-end">
          <Text
            variant="callout"
            numeric
            tone={up ? "default" : "income"}
            className="font-semibold"
          >
            {money.change(row.change)}
          </Text>
          {pct ? (
            <Text variant="caption" numeric tone="tertiary">
              {pct}
            </Text>
          ) : null}
        </View>
      </View>
    </Row>
  );
}

/** Top three category increases and decreases against the comparison month, as plain facts. */
export function WhatChangedCard({
  report,
  money,
}: {
  report: MonthReport;
  money: ReportMoney;
}) {
  const { up, down } = report.changes;
  if (up.length === 0 && down.length === 0) return null;
  const previousName = shortMonthOfPeriod(report.previous);
  return (
    <View>
      <SectionHeader title="What changed" />
      <View className="gap-3">
        {up.length > 0 ? (
          <View>
            <Text variant="footnote" tone="secondary" className="px-8 pb-2">
              {`Spent more than ${report.compared.partial ? "the same days in " : ""}${previousName}`}
            </Text>
            <Card className="mx-4 p-0">
              {up.map((row, i) => (
                <ChangeRow
                  key={row.categoryId ?? "none"}
                  row={row}
                  money={money}
                  previousName={previousName}
                  separator={i > 0}
                />
              ))}
            </Card>
          </View>
        ) : null}
        {down.length > 0 ? (
          <View>
            <Text variant="footnote" tone="secondary" className="px-8 pb-2">
              {`Spent less than ${report.compared.partial ? "the same days in " : ""}${previousName}`}
            </Text>
            <Card className="mx-4 p-0">
              {down.map((row, i) => (
                <ChangeRow
                  key={row.categoryId ?? "none"}
                  row={row}
                  money={money}
                  previousName={previousName}
                  separator={i > 0}
                />
              ))}
            </Card>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// -- Biggest --------------------------------------------------------------------------------------

/** The five largest expenses of the month; each opens its transaction. */
export function BiggestCard({
  report,
  money,
  today,
}: {
  report: MonthReport;
  money: ReportMoney;
  today: DateKey;
}) {
  const router = useRouter();
  if (report.biggest.length === 0) return null;
  return (
    <View>
      <SectionHeader title="Biggest expenses" />
      <Card className="mx-4 p-0">
        {report.biggest.map((t, index) => {
          const title = t.title || t.category?.name || "Expense";
          const subtitle = [t.category?.name, dayLabel(t.dateKey, today)]
            .filter(Boolean)
            .join(" · ");
          return (
            <Row
              key={t.transactionId}
              separator={index > 0}
              inset={64}
              accessibilityLabel={`${title}, ${subtitle}, ${money.full(t.amount)}`}
              onPress={() =>
                router.push({
                  pathname: "/transaction/[id]",
                  params: { id: t.transactionId },
                })
              }
            >
              <View className="flex-row items-center gap-3">
                <IconTile
                  icon={t.category?.icon ?? "tag.fill"}
                  color={asColor(t.category?.color)}
                  size={36}
                />
                <View className="min-w-0 flex-1">
                  <Text variant="body" numberOfLines={1}>
                    {title}
                  </Text>
                  <Text variant="subhead" tone="secondary" numberOfLines={1}>
                    {subtitle}
                  </Text>
                </View>
                <Text variant="body" numeric className="font-medium">
                  {money.full(t.amount)}
                </Text>
              </View>
            </Row>
          );
        })}
      </Card>
    </View>
  );
}

// -- Rhythm ---------------------------------------------------------------------------------------

/** Average spend per weekday (busiest in the accent) and the single busiest day. */
export function RhythmCard({
  report,
  money,
  today,
}: {
  report: MonthReport;
  money: ReportMoney;
  today: DateKey;
}) {
  const { colors } = useTokens();
  if (report.peakWeekday === null) return null;
  const data = report.weekdays.map((d) => ({
    key: String(d.weekday),
    label: weekdayShort(d.weekday).slice(0, 1),
    value: d.average,
  }));
  const peak = report.weekdays[report.peakWeekday];
  const busiest = report.busiestDay;
  return (
    <View>
      <SectionHeader title="When it went out" />
      <Card className="mx-4 px-4 pb-3 pt-3">
        <View className="flex-row">
          <View className="flex-1">
            <Text variant="footnote" tone="secondary">
              Busiest weekday
            </Text>
            <Text variant="headline" className="mt-0.5">
              {peak ? peakCaption(peak.weekday).replace("Most on ", "") : "—"}
            </Text>
            <Text variant="caption" tone="tertiary" numeric>
              {peak ? `${money.whole(peak.average)} on average` : " "}
            </Text>
          </View>
          {busiest ? (
            <View
              className="flex-1 pl-4"
              style={{
                borderLeftWidth: hairline,
                borderLeftColor: colors.separator,
              }}
            >
              <Text variant="footnote" tone="secondary">
                Busiest day
              </Text>
              <Text variant="headline" className="mt-0.5">
                {dayLabel(busiest.dateKey, today)}
              </Text>
              <Text variant="caption" tone="tertiary" numeric>
                {money.whole(busiest.amount)}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="pt-3">
          <ColumnBars
            data={data}
            highlight={report.peakWeekday}
            height={64}
            selectable
            valueLabel={(i) => money.compact(report.weekdays[i]?.average ?? 0)}
            accessibilityLabel={`Average spending by weekday, most on ${peak ? weekdayShort(peak.weekday) : ""}`}
          />
        </View>
      </Card>
    </View>
  );
}

// -- No-spend days --------------------------------------------------------------------------------

const DOT_GAP = 6;

/** The month as a grid of dots: leaves for no-spend days, the longest run on an accent disc. */
export function MonthDots({
  from,
  to,
  statusOf,
  weekStart,
  streak,
  size = 22,
}: {
  from: DateKey;
  to: DateKey;
  statusOf: (key: DateKey) => DayStatus;
  weekStart: 1 | 7;
  streak: { from: DateKey | null; to: DateKey | null };
  size?: number;
}) {
  const cells = React.useMemo(() => {
    const out: (DateKey | null)[] = Array.from(
      { length: leadingBlanks(weekday(from), weekStart) },
      () => null,
    );
    for (let key = from; key <= to; key = addDays(key, 1)) out.push(key);
    while (out.length % 7 !== 0) out.push(null);
    const rows: (DateKey | null)[][] = [];
    for (let i = 0; i < out.length; i += 7) rows.push(out.slice(i, i + 7));
    return rows;
  }, [from, to, weekStart]);
  const letters = weekdayLetters(weekStart);
  const inStreak = (key: DateKey) =>
    streak.from !== null &&
    streak.to !== null &&
    key >= streak.from &&
    key <= streak.to;
  return (
    <View
      style={{ gap: DOT_GAP }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ flexDirection: "row", gap: DOT_GAP }}>
        {letters.map((l, i) => (
          <Text
            key={i}
            variant="caption"
            tone="tertiary"
            style={{ width: size, textAlign: "center", fontSize: 10 }}
          >
            {l}
          </Text>
        ))}
      </View>
      {cells.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap: DOT_GAP }}>
          {row.map((key, c) => (
            <DayDot
              key={key ?? `b${c}`}
              status={key ? statusOf(key) : null}
              size={size}
              highlight={key ? inStreak(key) : false}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** No-spend days this month, the longest run, and a dot calendar. Opens the full calendar. */
export function NoSpendCard({
  report,
  today,
  weekStart,
}: {
  report: MonthReport;
  today: DateKey;
  weekStart: 1 | 7;
}) {
  const router = useRouter();
  const { colors } = useTokens();
  const input = React.useMemo(
    () => ({
      spendDays: new Set(report.noSpend.spendDays),
      since: report.noSpend.since,
      today,
    }),
    [report.noSpend.spendDays, report.noSpend.since, today],
  );
  if (report.noSpend.tracked === 0) return null;
  const { days, tracked, longest } = report.noSpend;
  return (
    <View>
      <SectionHeader
        title="No-spend days"
        actionLabel="Calendar"
        onAction={() =>
          router.push({
            pathname: "/calendar",
            params: { month: report.period.from.slice(0, 7) },
          })
        }
      />
      <Card className="mx-4 flex-row items-center gap-4 px-4 py-4">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-baseline gap-1.5">
            <Text variant="title1">{String(days.length)}</Text>
            <Text variant="subhead" tone="secondary">
              {`of ${daysText(tracked)}`}
            </Text>
          </View>
          <Text variant="footnote" tone="secondary" className="mt-1">
            {longest.length > 1 && longest.from && longest.to
              ? `Longest run ${daysText(longest.length)}`
              : days.length === 0
                ? "Something spent every day"
                : "No runs longer than a day"}
          </Text>
          {longest.length > 1 && longest.from && longest.to ? (
            <Text variant="caption" tone="tertiary">
              {rangeText(longest.from, longest.to)}
            </Text>
          ) : null}
          <View className="mt-3 flex-row items-center gap-1.5">
            <AppIcon name="leaf" size={11} color={colors.accentText} />
            <Text variant="caption" tone="secondary">
              No spend
            </Text>
          </View>
        </View>
        <MonthDots
          from={report.period.from}
          to={report.period.to}
          statusOf={(key) => dayStatus(key, input)}
          weekStart={weekStart}
          streak={longest.length > 1 ? longest : { from: null, to: null }}
          size={20}
        />
      </Card>
    </View>
  );
}

// -- Budgets --------------------------------------------------------------------------------------

function budgetStatus(
  b: ReportBudget,
  whole: (minor: number) => string,
): { text: string; tone: TextTone; icon: string | null } {
  if (b.outcome === "over")
    return {
      text: `Over by ${whole(-b.remaining)}`,
      tone: "expense",
      icon: "xmark.circle.fill",
    };
  if (!b.finished)
    return {
      text: `${whole(b.remaining)} left`,
      tone: b.ratio >= 0.9 ? "warning" : "secondary",
      icon: null,
    };
  return {
    text: "Within budget",
    tone: "secondary",
    icon: "checkmark.circle.fill",
  };
}

/** Monthly budgets hit or missed. */
export function BudgetsCard({
  report,
  money,
}: {
  report: MonthReport;
  money: ReportMoney;
}) {
  const { colors } = useTokens();
  if (report.budgets.length === 0) return null;
  const missed = report.budgets.filter((b) => b.outcome === "over").length;
  const finished = report.budgets.every((b) => b.finished);
  const summary = finished
    ? `${report.budgets.length - missed} of ${report.budgets.length} kept`
    : missed > 0
      ? `${missed} over so far`
      : "On track so far";
  return (
    <View>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-6">
        <Text variant="headline" accessibilityRole="header">
          Budgets
        </Text>
        <Text variant="footnote" tone="secondary">
          {summary}
        </Text>
      </View>
      <Card className="mx-4 p-0">
        {report.budgets.map((b, index) => {
          const status = budgetStatus(b, (v) => formatIn(money, v, b.currency));
          const amounts = `${formatIn(money, b.spent, b.currency)} of ${formatIn(money, b.amount, b.currency)}`;
          return (
            <Row
              key={b.id}
              separator={index > 0}
              accessibilityLabel={`${b.name}, ${amounts}, ${status.text}`}
            >
              <View className="flex-row items-center justify-between gap-3">
                <Text
                  variant="callout"
                  numberOfLines={1}
                  className="min-w-0 flex-1 font-medium"
                >
                  {b.name}
                </Text>
                <View className="flex-row items-center gap-1">
                  {status.icon ? (
                    <AppIcon
                      name={status.icon}
                      size={14}
                      color={
                        status.tone === "expense"
                          ? colors.expense
                          : colors.textSecondary
                      }
                    />
                  ) : null}
                  <Text variant="footnote" tone={status.tone} numeric>
                    {status.text}
                  </Text>
                </View>
              </View>
              <View className="mt-2">
                <ProgressBar value={b.ratio} />
              </View>
              <Text
                variant="caption"
                tone="tertiary"
                numeric
                className="mt-1.5"
              >
                {amounts}
              </Text>
            </Row>
          );
        })}
      </Card>
    </View>
  );
}

/** Budgets carry their own currency. */
function formatIn(money: ReportMoney, minor: number, currency: string): string {
  return formatMoney(minor, currency, {
    locale: money.locale,
    sign: "none",
    decimals: 0,
  });
}
