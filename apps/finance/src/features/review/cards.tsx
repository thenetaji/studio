import * as React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { AppIcon } from "@studio/icons";
import {
  AnimatedNumber,
  Card,
  IconTile,
  Text,
  type TextTone,
} from "@studio/ui";
import type { YearReview } from "@/data/hooks";
import {
  addDays,
  diffDays,
  monthName,
  monthShort,
  parseKey,
  weekday,
  type DateKey,
} from "@studio/dates";
import { motion } from "@studio/motion";
import { useTokens, withAlpha } from "@studio/theme";
import { dayStatus, type NoSpendInput } from "@/lib/reports";
import { daysText, rangeText } from "@/features/calendar/no-spend-labels";
import { leadingBlanks } from "@/features/calendar/grid";
import { rateText } from "@/features/report/labels";
import {
  ColumnBars,
  Ring,
  ShareStack,
  YearCell,
  useNeutralMark,
} from "@/features/report/marks";
import type { ReportMoney } from "@/features/report/money";
import { asColor } from "@/features/report/sections";

export type ReviewCardKind =
  | "intro"
  | "flow"
  | "savings"
  | "months"
  | "category"
  | "payee"
  | "frequent"
  | "streak"
  | "summary";

/** Cards that have something to say for this year, in story order. */
export function reviewCards(review: YearReview): ReviewCardKind[] {
  if (review.entries === 0) return ["intro"];
  const out: ReviewCardKind[] = ["intro", "flow"];
  if (review.earned > 0) out.push("savings");
  if (review.biggestMonth !== null) out.push("months");
  if (review.categories.length > 0) out.push("category");
  if (review.topPayee) out.push("payee");
  if (review.mostFrequent && review.mostFrequent.count > 1)
    out.push("frequent");
  if (review.noSpend.longest.length > 0) out.push("streak");
  out.push("summary");
  return out;
}

const EYEBROW: Record<ReviewCardKind, string> = {
  intro: "Year in review",
  flow: "In and out",
  savings: "Savings rate",
  months: "Biggest month",
  category: "Top category",
  payee: "Top payee",
  frequent: "Most frequent",
  streak: "Longest no-spend streak",
  summary: "In summary",
};

type CardProps = {
  review: YearReview;
  money: ReportMoney;
  today: DateKey;
  weekStart: 1 | 7;
  /** No entrance motion (share capture, Reduce Motion). */
  still: boolean;
  /** Narrower layout for the share image. */
  compact?: boolean;
};

/** Fade + rise for the n-th element of a card; nothing on web or when still. */
function Rise({
  index,
  still,
  children,
  style,
}: {
  index: number;
  still: boolean;
  children: React.ReactNode;
  style?: object;
}) {
  const [entering] = React.useState(() =>
    still || Platform.OS === "web"
      ? undefined
      : FadeInDown.delay(120 + index * 90)
          .springify()
          .damping(motion.springs.enter.damping)
          .stiffness(motion.springs.enter.stiffness)
          .mass(motion.springs.enter.mass)
          .withInitialValues({ opacity: 0, transform: [{ translateY: 16 }] })
          .reduceMotion(ReduceMotion.System),
  );
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

function Big({
  value,
  still,
  tone,
  size = "display",
}: {
  value: string;
  still: boolean;
  tone?: TextTone;
  size?: "display" | "hero";
}) {
  if (still)
    return (
      <Text
        variant={size}
        tone={tone}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {value}
      </Text>
    );
  return (
    <AnimatedNumber
      value={value}
      variant={size}
      tone={tone}
      fit
      intro
      align="left"
    />
  );
}

function Title({ children }: { children: string }) {
  return (
    <Text
      variant="title1"
      numberOfLines={2}
      className="tracking-[-0.6px]"
      style={{ fontSize: 34, lineHeight: 40 }}
    >
      {children}
    </Text>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: TextTone;
}) {
  return (
    <View className="flex-row items-baseline justify-between">
      <Text variant="callout" tone="secondary">
        {label}
      </Text>
      <Text variant="callout" numeric tone={tone} className="font-semibold">
        {value}
      </Text>
    </View>
  );
}

// -- Individual cards ------------------------------------------------------------------------------

function Intro({ review, still }: CardProps) {
  const span = review.range
    ? rangeText(review.range.from, review.range.to)
    : null;
  return (
    <>
      <Rise index={1} still={still}>
        <Text
          variant="display"
          style={{ fontSize: 96, lineHeight: 100, letterSpacing: -4 }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {String(review.year)}
        </Text>
      </Rise>
      <Rise index={2} still={still}>
        <Text variant="title2" tone="secondary" className="mt-2">
          {review.entries === 0
            ? `Nothing in ${review.year}`
            : `${review.entries.toLocaleString("en-US")} ${review.entries === 1 ? "entry" : "entries"}`}
        </Text>
        {span && review.partial && review.entries > 0 ? (
          <Text variant="subhead" tone="tertiary" className="mt-1">
            {`${span}, so far`}
          </Text>
        ) : null}
      </Rise>
    </>
  );
}

function Flow({ review, money, still }: CardProps) {
  const { colors } = useTokens();
  const neutral = useNeutralMark();
  const max = Math.max(review.spent, review.earned, 1);
  const block = (
    index: number,
    label: string,
    value: number,
    color: string,
    tone?: TextTone,
  ) => (
    <Rise index={index} still={still} style={{ gap: 10 }}>
      <View>
        <Text variant="subhead" tone="secondary">
          {label}
        </Text>
        <Big value={money.whole(value)} still={still} tone={tone} size="hero" />
      </View>
      <View
        style={{
          height: 12,
          borderRadius: 6,
          backgroundColor: withAlpha(colors.text, 0.05),
        }}
      >
        <View
          style={{
            height: 12,
            borderRadius: 6,
            width: `${value > 0 ? Math.max(2, (value / max) * 100) : 0}%`,
            backgroundColor: color,
          }}
        />
      </View>
    </Rise>
  );
  return (
    <View style={{ gap: 28 }}>
      {block(
        1,
        "Earned",
        review.earned,
        neutral,
        review.earned > 0 ? "income" : undefined,
      )}
      {block(2, "Spent", review.spent, colors.accent)}
      <Rise index={3} still={still}>
        <Line label="Net" value={money.signed(review.earned - review.spent)} />
      </Rise>
    </View>
  );
}

function Savings({ review, money, still, compact }: CardProps) {
  const { colors } = useTokens();
  const rate = review.savingsRate ?? 0;
  const size = compact ? 200 : 236;
  return (
    <>
      <Rise
        index={1}
        still={still}
        style={{ alignItems: "center", marginTop: 8 }}
      >
        <Ring
          value={rate / 100}
          size={size}
          stroke={14}
          color={colors.accent}
          track={withAlpha(colors.accent, 0.14)}
          still={still}
          delay={260}
        >
          <Text variant="display" numeric={false}>
            {rateText(review.savingsRate)}
          </Text>
          <Text variant="footnote" tone="secondary">
            of income kept
          </Text>
        </Ring>
      </Rise>
      <Rise index={2} still={still} style={{ marginTop: 32, gap: 10 }}>
        <Line label="Earned" value={money.whole(review.earned)} tone="income" />
        <Line label="Spent" value={money.whole(review.spent)} />
        <Line label="Kept" value={money.signed(review.earned - review.spent)} />
      </Rise>
    </>
  );
}

const INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function Months({ review, money, still }: CardProps) {
  const index = review.biggestMonth ?? 0;
  const top = review.months[index];
  const active = review.months.filter((m) => m.spent > 0);
  const average =
    active.length > 0
      ? Math.round(active.reduce((s, m) => s + m.spent, 0) / active.length)
      : 0;
  return (
    <>
      <Rise index={1} still={still}>
        <Title>{monthName(top?.month ?? 1)}</Title>
        <Text variant="title2" numeric tone="secondary" className="mt-1">
          {money.whole(top?.spent ?? 0)}
        </Text>
      </Rise>
      <Rise index={2} still={still} style={{ marginTop: 36 }}>
        <ColumnBars
          data={review.months.map((m, i) => ({
            key: m.key,
            label: INITIALS[i] ?? "",
            value: m.spent,
          }))}
          highlight={review.biggestMonth}
          height={150}
          still={still}
          maxBarWidth={18}
          valueLabel={(i) =>
            i === review.biggestMonth
              ? money.compact(review.months[i]?.spent ?? 0)
              : null
          }
          accessibilityLabel={`Spending by month in ${review.year}; most in ${monthName(top?.month ?? 1)}`}
        />
      </Rise>
      <Rise index={3} still={still} style={{ marginTop: 20 }}>
        <Line label="Monthly average" value={money.whole(average)} />
      </Rise>
    </>
  );
}

const STACK = 5;

function Category({ review, money, still }: CardProps) {
  const { category: palette, colors } = useTokens();
  const top = review.categories[0];
  if (!top) return null;
  const color = asColor(top.category?.color);
  const head = review.categories.slice(0, STACK);
  const rest = review.categories.slice(STACK).reduce((s, c) => s + c.amount, 0);
  const restPercent = Math.max(
    0,
    100 - head.reduce((s, c) => s + c.percent, 0),
  );
  const segments = [
    ...head.map((c) => ({
      key: c.categoryId ?? "none",
      value: c.amount,
      color: palette[asColor(c.category?.color)],
      name: c.category?.name ?? "Uncategorised",
      percent: c.percent,
    })),
    ...(rest > 0
      ? [
          {
            key: "other",
            value: rest,
            color: withAlpha(colors.text, 0.2),
            name: "Other",
            percent: restPercent,
          },
        ]
      : []),
  ];
  return (
    <>
      <Rise index={1} still={still}>
        <IconTile
          icon={top.category?.icon ?? "tag.fill"}
          color={color}
          size={56}
        />
        <View className="mt-4">
          <Title>{top.category?.name ?? "Uncategorised"}</Title>
        </View>
        <Text variant="title2" numeric tone="secondary" className="mt-1">
          {money.hidden
            ? `${top.percent}% of spending`
            : `${money.whole(top.amount)} · ${top.percent}%`}
        </Text>
      </Rise>
      <Rise index={2} still={still} style={{ marginTop: 36 }}>
        <ShareStack segments={segments} height={14} gapColor={colors.bg} />
        <View className="mt-4 gap-2.5">
          {segments.map((s) => (
            <View key={s.key} className="flex-row items-center gap-2.5">
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  backgroundColor: s.color,
                }}
              />
              <Text
                variant="subhead"
                numberOfLines={1}
                className="min-w-0 flex-1"
              >
                {s.name}
              </Text>
              <Text variant="subhead" numeric tone="secondary">
                {`${s.percent}%`}
              </Text>
            </View>
          ))}
        </View>
      </Rise>
    </>
  );
}

function Payee({ review, money, still }: CardProps) {
  const top = review.topPayee;
  if (!top) return null;
  const color = asColor(top.category?.color);
  return (
    <>
      <Rise index={1} still={still}>
        <IconTile
          icon={top.category?.icon ?? "tag.fill"}
          color={color}
          size={56}
        />
        <View className="mt-4">
          <Title>{top.title}</Title>
        </View>
      </Rise>
      <Rise index={2} still={still} style={{ marginTop: 12 }}>
        <Big value={money.whole(top.amount)} still={still} size="hero" />
      </Rise>
      <Rise index={3} still={still} style={{ marginTop: 24, gap: 10 }}>
        <Line label="Entries" value={String(top.count)} />
        <Line label="Share of spending" value={`${top.percent}%`} />
        {top.category ? (
          <Line label="Category" value={top.category.name} />
        ) : null}
      </Rise>
    </>
  );
}

function Frequent({ review, money, still }: CardProps) {
  const top = review.mostFrequent;
  if (!top) return null;
  const color = asColor(top.category?.color);
  const days = review.range
    ? diffDays(review.range.from, review.range.to) + 1
    : 365;
  const every = Math.max(1, Math.round(days / top.count));
  return (
    <>
      <Rise index={1} still={still}>
        <IconTile
          icon={top.category?.icon ?? "tag.fill"}
          color={color}
          size={56}
        />
        <View className="mt-4">
          <Title>{top.title}</Title>
        </View>
      </Rise>
      <Rise index={2} still={still} style={{ marginTop: 12 }}>
        <View className="flex-row items-baseline gap-2">
          <Big value={String(top.count)} still={still} size="hero" />
          <Text variant="title2" tone="secondary">
            times
          </Text>
        </View>
      </Rise>
      <Rise index={3} still={still} style={{ marginTop: 24, gap: 10 }}>
        <Line label="About every" value={daysText(every)} />
        <Line
          label="Average each"
          value={money.whole(Math.round(top.amount / top.count))}
        />
        <Line label="In total" value={money.whole(top.amount)} />
      </Rise>
    </>
  );
}

const MINI_GAP = 2;

/** Twelve small-multiple months; no-spend days in the accent, the longest streak at full strength. */
function YearMonths({
  review,
  today,
  weekStart,
  width,
}: {
  review: YearReview;
  today: DateKey;
  weekStart: 1 | 7;
  width: number;
}) {
  const input = React.useMemo<NoSpendInput>(
    () => ({
      spendDays: new Set(review.noSpend.spendDays),
      since: review.noSpend.since,
      today,
    }),
    [review.noSpend.spendDays, review.noSpend.since, today],
  );
  const { longest } = review.noSpend;
  const cols = 4;
  const gutter = 14;
  const monthWidth = (width - gutter * (cols - 1)) / cols;
  const cell = Math.floor((monthWidth - MINI_GAP * 6) / 7);
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: gutter,
        rowGap: 12,
      }}
    >
      {Array.from({ length: 12 }, (_, m) => {
        const first = `${review.year}-${String(m + 1).padStart(2, "0")}-01`;
        const cells: (DateKey | null)[] = Array.from(
          { length: leadingBlanks(weekday(first), weekStart) },
          () => null,
        );
        for (
          let key = first;
          parseKey(key).month === m + 1;
          key = addDays(key, 1)
        )
          cells.push(key);
        while (cells.length % 7 !== 0) cells.push(null);
        return (
          <View key={m} style={{ width: monthWidth }}>
            <Text
              variant="caption"
              tone="tertiary"
              style={{ fontSize: 10, lineHeight: 13, marginBottom: 3 }}
            >
              {monthShort(m + 1)}
            </Text>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: MINI_GAP }}
            >
              {cells.map((key, i) => (
                <YearCell
                  key={key ?? `b${i}`}
                  size={cell}
                  status={key ? dayStatus(key, input) : null}
                  strong={
                    !!key &&
                    !!longest.from &&
                    !!longest.to &&
                    key >= longest.from &&
                    key <= longest.to
                  }
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Streak({ review, still, today, weekStart }: CardProps) {
  const { longest, days } = review.noSpend;
  const [width, setWidth] = React.useState(0);
  return (
    <>
      <Rise index={1} still={still}>
        <View className="flex-row items-baseline gap-2">
          <Big value={String(longest.length)} still={still} />
          <Text variant="title2" tone="secondary">
            {longest.length === 1 ? "day" : "days"}
          </Text>
        </View>
        {longest.from && longest.to ? (
          <Text variant="subhead" tone="secondary" className="mt-1">
            {rangeText(longest.from, longest.to)}
          </Text>
        ) : null}
      </Rise>
      <Rise index={2} still={still} style={{ marginTop: 28 }}>
        <View
          onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
        >
          {width > 0 ? (
            <YearMonths
              review={review}
              today={today}
              weekStart={weekStart}
              width={width}
            />
          ) : null}
        </View>
      </Rise>
      <Rise index={3} still={still} style={{ marginTop: 20, gap: 10 }}>
        <Line
          label="No-spend days"
          value={`${days} of ${review.noSpend.tracked}`}
        />
      </Rise>
    </>
  );
}

function Summary({ review, money, still }: CardProps) {
  const { colors } = useTokens();
  const top = review.categories[0];
  const month =
    review.biggestMonth !== null ? review.months[review.biggestMonth] : null;
  const stats: { label: string; value: string; tone?: TextTone }[] = [
    { label: "Spent", value: money.whole(review.spent) },
    {
      label: "Earned",
      value: money.whole(review.earned),
      tone: review.earned > 0 ? "income" : undefined,
    },
    { label: "Saved", value: rateText(review.savingsRate) },
    { label: "Entries", value: review.entries.toLocaleString("en-US") },
    { label: "Top category", value: top?.category?.name ?? "—" },
    { label: "Biggest month", value: month ? monthName(month.month) : "—" },
    { label: "Top payee", value: review.topPayee?.title ?? "—" },
    { label: "Longest streak", value: daysText(review.noSpend.longest.length) },
  ];
  const hairline = StyleSheet.hairlineWidth * 2;
  return (
    <Rise index={1} still={still}>
      <Title>{`${review.year}${review.partial ? " so far" : ""}`}</Title>
      <Card className="mt-6 rounded-[20px] p-0">
        {Array.from({ length: stats.length / 2 }, (_, row) => (
          <View
            key={row}
            className="flex-row"
            style={
              row > 0
                ? { borderTopWidth: hairline, borderTopColor: colors.separator }
                : null
            }
          >
            {[0, 1].map((col) => {
              const s = stats[row * 2 + col];
              if (!s) return null;
              return (
                <View
                  key={col}
                  className="flex-1 px-4 py-3.5"
                  style={
                    col > 0
                      ? {
                          borderLeftWidth: hairline,
                          borderLeftColor: colors.separator,
                        }
                      : null
                  }
                  accessible
                  accessibilityLabel={`${s.label}, ${s.value}`}
                >
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text
                    variant="headline"
                    tone={s.tone}
                    numeric
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    className="mt-1 tracking-[-0.3px]"
                  >
                    {s.value}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </Card>
    </Rise>
  );
}

const BODIES: Record<ReviewCardKind, React.ComponentType<CardProps>> = {
  intro: Intro,
  flow: Flow,
  savings: Savings,
  months: Months,
  category: Category,
  payee: Payee,
  frequent: Frequent,
  streak: Streak,
  summary: Summary,
};

/** A soft glow in one corner: the only decoration on a card. */
function Glow({ color, id }: { color: string; id: string }) {
  const { isDark } = useTokens();
  // On paper a coloured haze reads as a smudge; keep it to a whisper there.
  const strength = isDark ? 1 : 0.4;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient
            id={id}
            cx="85%"
            cy="8%"
            rx="80%"
            ry="45%"
            fx="85%"
            fy="8%"
          >
            <Stop offset="0" stopColor={color} stopOpacity={0.22 * strength} />
            <Stop
              offset="0.55"
              stopColor={color}
              stopOpacity={0.06 * strength}
            />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function glowColor(
  kind: ReviewCardKind,
  review: YearReview,
  palette: Record<string, string>,
  accent: string,
): string {
  if (kind === "category")
    return palette[asColor(review.categories[0]?.category?.color)] ?? accent;
  if (kind === "payee")
    return palette[asColor(review.topPayee?.category?.color)] ?? accent;
  if (kind === "frequent")
    return palette[asColor(review.mostFrequent?.category?.color)] ?? accent;
  return accent;
}

type ReviewCardProps = CardProps & {
  kind: ReviewCardKind;
  /** Space reserved at the top (progress bar and buttons) and bottom. */
  insets?: { top: number; bottom: number };
};

/** One full-bleed story card. */
export function ReviewCard({
  kind,
  insets = { top: 0, bottom: 0 },
  ...props
}: ReviewCardProps) {
  const { colors, category } = useTokens();
  const Body = BODIES[kind];
  const glow = glowColor(kind, props.review, category, colors.accent);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Glow color={glow} id={`glow-${kind}`} />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: props.compact ? 24 : 28,
          justifyContent: kind === "intro" ? "flex-end" : "center",
        }}
      >
        <Rise index={0} still={props.still}>
          <View className="mb-3 flex-row items-center gap-2">
            {kind === "streak" ? (
              <AppIcon name="leaf" size={14} color={colors.accentText} />
            ) : null}
            <Text variant="subhead" tone="secondary" className="font-medium">
              {EYEBROW[kind]}
            </Text>
          </View>
        </Rise>
        <Body {...props} />
        {kind === "intro" ? (
          <View style={{ height: props.compact ? 40 : 120 }} />
        ) : null}
      </View>
    </View>
  );
}
