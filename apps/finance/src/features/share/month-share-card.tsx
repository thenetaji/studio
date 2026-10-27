import * as React from "react";
import { StyleSheet, View } from "react-native";

import { Text, type TextTone } from "@studio/ui";
import type { MonthReport } from "@/data/hooks";
import type { DateKey } from "@studio/dates";
import { useTokens } from "@studio/theme";
import { dayStatus } from "@/lib/reports";
import { daysText } from "@/features/calendar/no-spend-labels";
import {
  monthOfPeriod,
  percentChange,
  rateText,
  shortMonthOfPeriod,
} from "@/features/report/labels";
import { ShareStack } from "@/features/report/marks";
import type { ReportMoney } from "@/features/report/money";
import { asColor, MonthDots } from "@/features/report/sections";

const LEGEND = 4;

function Stat({
  label,
  value,
  tone,
  divider,
}: {
  label: string;
  value: string;
  tone?: TextTone;
  divider?: boolean;
}) {
  const { colors } = useTokens();
  return (
    <View
      className="flex-1 px-2.5"
      style={
        divider
          ? {
              borderLeftWidth: StyleSheet.hairlineWidth * 2,
              borderLeftColor: colors.separator,
            }
          : null
      }
    >
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <Text
        variant="callout"
        tone={tone}
        numeric
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        className="mt-0.5 font-semibold tracking-[-0.3px]"
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * The monthly report as one image: spending, the three headline figures, where it went and the no-spend days.
 * With amounts hidden the hero becomes the change against last month and money figures give way to shares
 * and counts.
 */
export function MonthShareCard({
  report,
  money,
  today,
  weekStart,
}: {
  report: MonthReport;
  money: ReportMoney;
  today: DateKey;
  weekStart: 1 | 7;
}) {
  const { colors, category: palette } = useTokens();
  const month = monthOfPeriod(report.period);
  const prev = shortMonthOfPeriod(report.previous);
  const change =
    report.prior.spent > 0 ? percentChange(report.deltas.spent.percent) : null;
  const fell = report.deltas.spent.amount < 0;
  const head = report.categories.filter((c) => c.current > 0).slice(0, LEGEND);
  const rest = report.categories.filter((c) => c.current > 0).slice(LEGEND);
  const restShare = Math.max(0, 100 - head.reduce((s, c) => s + c.share, 0));
  const segments = [
    ...head.map((c) => ({
      key: c.categoryId ?? "none",
      value: c.current,
      color: palette[asColor(c.category?.color)],
      name: c.category?.name ?? "Uncategorised",
      share: c.share,
    })),
    ...(rest.length > 0
      ? [
          {
            key: "other",
            value: rest.reduce((s, c) => s + c.current, 0),
            color: colors.textTertiary,
            name: "Other",
            share: restShare,
          },
        ]
      : []),
  ];
  const input = {
    spendDays: new Set(report.noSpend.spendDays),
    since: report.noSpend.since,
    today,
  };
  const hidden = money.hidden;
  const heroLabel = hidden
    ? change
      ? `Spending vs ${prev}`
      : "Saved"
    : report.compared.partial
      ? `Spent in ${month} so far`
      : `Spent in ${month}`;
  const heroValue = hidden
    ? (change ?? rateText(report.current.savingsRate))
    : money.full(report.current.spent);

  return (
    <View className="flex-1 px-6 pb-4 pt-6">
      <Text variant="subhead" tone="secondary" className="font-medium">
        {heroLabel}
      </Text>
      <Text
        variant="hero"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        tone={hidden && change && fell ? "income" : undefined}
      >
        {heroValue}
      </Text>
      {!hidden && change ? (
        <Text variant="footnote" numeric tone={fell ? "income" : "secondary"}>
          {change === "No change"
            ? `No change vs ${prev}`
            : `${change} vs ${prev}${report.compared.partial ? ", same days" : ""}`}
        </Text>
      ) : (
        <Text variant="footnote"> </Text>
      )}

      <View className="mt-5 flex-row" style={{ marginHorizontal: -10 }}>
        {hidden ? (
          <>
            <Stat label="Saved" value={rateText(report.current.savingsRate)} />
            <Stat
              label="No-spend"
              value={daysText(report.noSpend.days.length)}
              divider
            />
            <Stat
              label="Entries"
              value={String(report.transactionCount)}
              divider
            />
          </>
        ) : (
          <>
            <Stat
              label="Earned"
              value={money.whole(report.current.earned)}
              tone={report.current.earned > 0 ? "income" : undefined}
            />
            <Stat
              label="Net"
              value={money.signed(report.current.net)}
              divider
            />
            <Stat
              label="Saved"
              value={rateText(report.current.savingsRate)}
              divider
            />
          </>
        )}
      </View>

      {segments.length > 0 ? (
        <View className="mt-6">
          <Text variant="footnote" tone="secondary" className="mb-2.5">
            Where it went
          </Text>
          <ShareStack segments={segments} height={12} gapColor={colors.bg} />
          <View className="mt-3 flex-row flex-wrap" style={{ rowGap: 8 }}>
            {segments.map((s) => (
              <View
                key={s.key}
                className="flex-row items-center gap-2"
                style={{ width: "50%", paddingRight: 8 }}
              >
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 3,
                    backgroundColor: s.color,
                  }}
                />
                <Text
                  variant="footnote"
                  numberOfLines={1}
                  className="min-w-0 flex-shrink"
                >
                  {s.name}
                </Text>
                <Text variant="footnote" tone="secondary" numeric>
                  {`${s.share}%`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {report.noSpend.tracked > 0 ? (
        <View className="mt-auto flex-row items-center gap-4 pt-5">
          <View className="min-w-0 flex-1">
            <Text variant="footnote" tone="secondary">
              No-spend days
            </Text>
            <Text variant="title1">{daysText(report.noSpend.days.length)}</Text>
            {report.noSpend.longest.length > 1 ? (
              <Text variant="footnote" tone="secondary">
                {`Longest run ${daysText(report.noSpend.longest.length)}`}
              </Text>
            ) : null}
          </View>
          <MonthDots
            from={report.period.from}
            to={report.period.to}
            statusOf={(key) => dayStatus(key, input)}
            weekStart={weekStart}
            streak={
              report.noSpend.longest.length > 1
                ? report.noSpend.longest
                : { from: null, to: null }
            }
            size={14}
          />
        </View>
      ) : null}
    </View>
  );
}
