import * as React from "react";
import { ActionSheetIOS, Platform, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import {
  SymbolIcon,
  Pressable,
  Text,
  AnimatedNumber,
  OptionPicker,
  type Option,
} from "@studio/ui";
import { evenPace, foldOlder, withSkia } from "@studio/charts";
import type { AllTimeSpend, HomeSpend } from "@/data/hooks";
import { addDays, monthShort, parseKey } from "@studio/dates";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { haptic, useTokens, withAlpha } from "@studio/theme";

import { flowAmount } from "@/features/insights/labels";

import type { SpendCurveProps, TideBarsProps } from "@studio/charts/components";

import { useHeroPeriod, type HeroPeriod } from "./period-store";
import { paceDelta } from "./curve";

/** Skia loads lazily (CanvasKit first on web), keeping chart code out of the initial graph. */
const SpendCurve = withSkia<SpendCurveProps>(() =>
  import("@studio/charts/components").then((m) => ({ default: m.SpendCurve })),
);
const TideBars = withSkia<TideBarsProps>(() =>
  import("@studio/charts/components").then((m) => ({ default: m.TideBars })),
);

const MAX_BARS = 12;
const PERIOD_OPTIONS: readonly Option<HeroPeriod>[] = [
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

type SpendHeroProps = {
  spend: HomeSpend;
  allTime: AllTimeSpend;
  /** "October". */
  monthLabel: string;
  /** "September". */
  previousLabel: string;
  /** Last day of the month, for the right-hand date label. */
  monthEnd: string;
  /** What the all-spending monthly budget allows in the display currency (amount plus rollover); 0 without one. */
  budget: number;
  /** The budget's pace status is at risk or over: only then is running ahead of the even pace a warning. */
  budgetAtRisk?: boolean;
  locale?: string;
  showDecimals: boolean;
};

/** Native action sheet on iOS; the app's own picker sheet elsewhere. */
function usePeriodMenu(
  period: HeroPeriod,
  onChange: (next: HeroPeriod) => void,
) {
  const [open, setOpen] = React.useState(false);
  const show = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            ...PERIOD_OPTIONS.map((o) =>
              o.value === period ? `${o.label}  ✓` : o.label,
            ),
            "Cancel",
          ],
          cancelButtonIndex: PERIOD_OPTIONS.length,
        },
        (index) => {
          const next = PERIOD_OPTIONS[index];
          if (next) onChange(next.value);
        },
      );
    } else setOpen(true);
  };
  const picker = (
    <OptionPicker
      visible={open}
      title="Spent"
      options={PERIOD_OPTIONS}
      selected={period}
      onSelect={onChange}
      onClose={() => setOpen(false)}
    />
  );
  return { show, picker };
}

/** Three round dots: the key for the dotted reference line. */
function DottedKey({ color }: { color: string }) {
  return (
    <View className="flex-row items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Spending this month: a period label (menu: this month or all time), the total, how it compares with the budget
 * pace or last month at the same day, and the spend curve: solid so far, dotted reference for the whole month.
 */
function SpendHero({
  spend,
  allTime,
  monthLabel,
  previousLabel,
  monthEnd,
  budget,
  budgetAtRisk = false,
  locale,
  showDecimals,
}: SpendHeroProps) {
  const { colors } = useTokens();
  const period = useHeroPeriod((s) => s.period);
  const setPeriod = useHeroPeriod((s) => s.set);
  const all = period === "all";
  const menu = usePeriodMenu(period, (next) => {
    if (next === period) return;
    haptic("selection");
    setPeriod(next);
  });

  const decimals = showDecimals ? undefined : 0;
  const total = all ? allTime.spent : spend.spent;
  const currency = all ? allTime.currency : spend.currency;
  const formatted = formatMoney(total, currency, {
    locale,
    sign: "none",
    decimals,
  });
  const label = all ? "Spent all time" : `Spent in ${monthLabel}`;
  const days = spend.series.length;

  const actual = React.useMemo(
    () => spend.series.flatMap((d) => (d.actual === null ? [] : [d.actual])),
    [spend.series],
  );
  const hasBudget = budget > 0;
  const hasPrevious = spend.previousTotal > 0;
  const reference = React.useMemo(
    () =>
      hasBudget
        ? evenPace(budget, days)
        : hasPrevious
          ? spend.series.map((d) => d.pace)
          : [],
    [hasBudget, hasPrevious, budget, days, spend.series],
  );
  const referenceName = hasBudget ? "Budget" : hasPrevious ? previousLabel : "";
  const delta = paceDelta(actual, reference);
  const money = (minor: number) => flowAmount(minor, currency, locale);
  const against = hasBudget ? "budget pace" : previousLabel;
  const deltaText =
    delta === null || referenceName === ""
      ? ""
      : delta === 0
        ? `On ${against}`
        : `${money(Math.abs(delta))} ${delta < 0 ? "under" : "over"} ${against}`;
  const over = delta !== null && delta > 0;
  const deltaTone = over
    ? hasBudget && budgetAtRisk
      ? colors.warning
      : colors.textSecondary
    : colors.income;

  const bars = React.useMemo(
    () =>
      foldOlder(
        allTime.months.map((m, i) => ({
          label: m.label,
          amount: m.amount,
          current: i === allTime.months.length - 1,
        })),
        MAX_BARS,
      ),
    [allTime.months],
  );
  const dayLabel = (i: number) => {
    const { month, day } = parseKey(addDays(spend.from, i));
    const ref = reference[i];
    const value = actual[i];
    return [
      `${day} ${monthShort(month)}`,
      value !== undefined ? money(value) : "",
      ref !== undefined && referenceName
        ? `${referenceName} ${money(ref)}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const barLabel = (i: number) =>
    `${bars[i]?.label ?? ""} · ${flowAmount(bars[i]?.amount ?? 0, allTime.currency, locale)}`;
  const hasChart = all
    ? bars.length > 0
    : actual.some((v) => v > 0) || reference.length > 0;
  const speech = formatMoneyForSpeech(total, currency, {
    sign: "none",
    locale,
  });
  const start = parseKey(spend.from);
  const end = parseKey(monthEnd);

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Pressable
          role="button"
          accessibilityLabel={`${label}, ${speech}`}
          accessibilityHint="Change period"
          scale={0.99}
          onPress={menu.show}
          style={{
            minHeight: 40,
            justifyContent: "center",
            alignSelf: "flex-start",
            paddingRight: 8,
          }}
        >
          <Animated.View
            key={label}
            entering={FadeIn.duration(150)}
            className="flex-row items-center gap-1"
          >
            <Text variant="subhead" tone="secondary" className="font-medium">
              {label}
            </Text>
            <SymbolIcon
              name="chevron.down"
              size={11}
              color={colors.textTertiary}
              weight="bold"
            />
          </Animated.View>
        </Pressable>
        {!all && referenceName ? (
          <View
            accessible
            accessibilityLabel={`Dotted line, ${referenceName}`}
            className="flex-row items-center gap-1.5"
          >
            <DottedKey color={withAlpha(colors.text, 0.45)} />
            <Text variant="caption" tone="tertiary">
              {referenceName}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row items-center gap-2.5">
        <AnimatedNumber
          value={formatted}
          variant="title1"
          intro
          fit
          align="left"
          accessibilityLabel={formatted}
          className="shrink tracking-[-0.6px]"
        />
        {!all && deltaText ? (
          <Animated.View
            entering={FadeIn.delay(300).duration(220)}
            className="flex-row items-center gap-1 rounded-full px-2 py-[3px]"
            style={{ backgroundColor: withAlpha(deltaTone, 0.12) }}
          >
            <SymbolIcon
              name={over ? "arrow-up-right" : "arrow-down-right"}
              size={12}
              color={deltaTone}
            />
            <Text
              variant="caption"
              numeric
              numberOfLines={1}
              style={{ color: deltaTone }}
              className="font-semibold"
            >
              {deltaText}
            </Text>
          </Animated.View>
        ) : null}
      </View>
      {hasChart ? (
        <Animated.View
          key={period}
          entering={FadeIn.duration(200)}
          className="mt-1"
        >
          {all ? (
            <View className="mt-3">
              <TideBars
                bars={bars}
                formatLabel={barLabel}
                accessibilityLabel={`Spent per month, ${speech} in total`}
              />
            </View>
          ) : (
            <SpendCurve
              actual={actual}
              reference={reference}
              days={days}
              formatLabel={dayLabel}
              startLabel={`${start.day} ${monthShort(start.month)}`}
              endLabel={`${end.day} ${monthShort(end.month)}`}
              referenceLabel={
                reference.length > 0
                  ? money(reference[reference.length - 1] ?? 0)
                  : undefined
              }
              accessibilityLabel={`Spent in ${monthLabel}, ${speech} so far${deltaText ? `, ${deltaText}` : ""}`}
            />
          )}
        </Animated.View>
      ) : null}
      {menu.picker}
    </View>
  );
}

export { SpendHero };
