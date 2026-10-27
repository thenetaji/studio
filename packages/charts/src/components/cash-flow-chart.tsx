import { textWidth } from "../lib/text-width";
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  RoundedRect,
  Skia,
  Text as SkText,
  vec,
} from "@shopify/react-native-skia";
import * as React from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue } from "react-native-reanimated";

import {
  barSlots,
  flowScale,
  netOffsets,
  runningNet,
  slotIndex,
  type AxisLabel,
  type FlowDatum,
} from "../lib";
import { monotoneSegments } from "../lib/smooth";
import { formatMoney, MINUS } from "@studio/money";
import { withAlpha, useTokens } from "@studio/theme";
import {
  adjustableProps,
  FloatingLabel,
  useChartWidth,
  useGrow,
  useScrubGesture,
  useSelectionTimeout,
} from "./chart-kit";
import { useHeld } from "./use-held";
import { useChartFont } from "./use-chart-font";

export type CashFlowChartProps = {
  /** One entry per bucket; `income` and `spent` in minor units. */
  data: readonly FlowDatum[];
  currency: string;
  labels: readonly AxisLabel[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Floating read-out, e.g. "Tue 7 · In ₹0 · Out ₹1,240 · Net −₹1,240". */
  formatLabel: (index: number) => string;
  accessibilityLabel: string;
  /** Plot height (both halves together). */
  height?: number;
  locale?: string;
  /**
   * How net shows: `running` draws the cumulative net as a smoothed line (daily flows); `markers` puts a tick at each
   * bucket's own net on the bars' scale (monthly flows), so no second scale is implied.
   */
  netMode?: "running" | "markers";
  /** A bucket to keep emphasised when nothing is selected (the current month). */
  focusIndex?: number;
  /** Optional savings rate per bucket (whole percent, null when nothing came in), drawn as a separate strip. */
  rates?: readonly (number | null)[];
  /** Strip title, e.g. "Savings rate". */
  ratesTitle?: string;
};

const LANE = 30;
const AXIS = 24;
const GUTTER = 44;
const RADIUS = 3;
const MIN_NUB = 2;
const RATE_STRIP = 58;
const RATE_TITLE = 16;

/**
 * Diverging bars: income rises above the zero line in mint, spending drops below it in brass, on one scale. Outliers
 * (a lump salary) are broken and labelled so normal days stay readable. A white running-net line rides on top.
 */
function CashFlowChart({
  data,
  currency,
  labels,
  selectedIndex,
  onSelect,
  formatLabel,
  accessibilityLabel,
  height = 170,
  locale,
  netMode = "running",
  focusIndex,
  rates,
  ratesTitle = "Savings rate",
}: CashFlowChartProps) {
  const { colors } = useTokens();
  const [width, onLayout] = useChartWidth();
  const font = useChartFont(11, "medium");
  const labelFont = useChartFont(12, "semibold");
  const grow = useGrow();

  const plotWidth = Math.max(0, width - GUTTER);
  const count = data.length;
  const scale = React.useMemo(() => flowScale(data, height), [data, height]);
  const zeroY = LANE + scale.zeroY;
  const strip = rates && rates.length > 0 ? RATE_STRIP : 0;
  const totalHeight = LANE + height + AXIS + strip;
  const slots = React.useMemo(
    () => barSlots(0, plotWidth, count, count > 20 ? 2 : 6, 28),
    [plotWidth, count],
  );
  const hasData = data.some((d) => d.income > 0 || d.spent > 0);
  const net = React.useMemo(() => runningNet(data), [data]);
  const netY = React.useMemo(
    () => netOffsets(net, scale, height).map((o) => zeroY + o),
    [net, scale, height, zeroY],
  );
  const netPath = React.useMemo(() => {
    const b = Skia.PathBuilder.Make();
    const pts = slots.map((s, i) => [s.center, netY[i] ?? zeroY] as const);
    if (pts.length < 2) return b.build();
    b.moveTo(pts[0]![0], pts[0]![1]);
    for (const [c1x, c1y, c2x, c2y, x, y] of monotoneSegments(pts))
      b.cubicTo(c1x, c1y, c2x, c2y, x, y);
    return b.build();
  }, [slots, netY, zeroY]);
  const growTransform = useDerivedValue(() => [
    { translateY: zeroY },
    { scaleY: grow.value },
    { translateY: -zeroY },
  ]);
  const netEnd = useDerivedValue(() => grow.value);

  const gesture = useScrubGesture({
    indexAt: (x) => (x > plotWidth ? -1 : slotIndex(x, 0, plotWidth, count)),
    selected: selectedIndex,
    onSelect,
    minY: LANE - 6,
  });

  const compact = (value: number) =>
    formatMoney(value, currency, { compact: true, locale });
  const selected =
    selectedIndex !== null && selectedIndex < count ? selectedIndex : null;
  useSelectionTimeout(selected, onSelect);
  const heldIndex = useHeld(selected);
  const spoken =
    selected === null
      ? accessibilityLabel
      : `${accessibilityLabel}. ${formatLabel(selected)}`;
  const px = scale.pxPerUnit;
  const mint = colors.income;
  const brass = colors.accent;
  const upClip = {
    x: 0,
    y: LANE - 2,
    width: plotWidth,
    height: scale.zeroY + 2,
  };
  const downClip = {
    x: 0,
    y: zeroY,
    width: plotWidth,
    height: height - scale.zeroY + 2,
  };

  const guides = [
    ...scale.upTicks.map((t) => ({
      text: compact(t),
      y: zeroY - Math.min(t, scale.upTop) * px,
    })),
    ...scale.downTicks.map((t) => ({
      text: `${MINUS}${compact(t)}`,
      y: zeroY + Math.min(t, scale.downTop) * px,
    })),
  ];

  return (
    <View
      onLayout={onLayout}
      style={{ height: totalHeight }}
      accessibilityLabel={accessibilityLabel}
      {...adjustableProps(count, selectedIndex, onSelect, spoken)}
    >
      {width > 0 ? (
        <GestureDetector gesture={gesture}>
          <View collapsable={false}>
            <Canvas style={{ width, height: totalHeight }}>
              {hasData
                ? guides.map((g, i) => (
                    <Group key={i}>
                      <Line
                        p1={vec(0, g.y)}
                        p2={vec(plotWidth, g.y)}
                        color={colors.separator}
                        strokeWidth={StyleSheet.hairlineWidth}
                      />
                      {font ? (
                        <SkText
                          x={width - textWidth(font, g.text)}
                          y={g.y + 4}
                          text={g.text}
                          font={font}
                          color={colors.textTertiary}
                        />
                      ) : null}
                    </Group>
                  ))
                : null}
              {hasData ? (
                <Group transform={growTransform}>
                  <Group clip={upClip}>
                    {data.map((d, i) => {
                      const slot = slots[i];
                      if (!slot || d.income <= 0) return null;
                      const h = Math.max(
                        MIN_NUB + RADIUS,
                        Math.min(d.income, scale.upTop) * px,
                      );
                      const faded =
                        selected !== null
                          ? selected !== i
                          : focusIndex !== undefined &&
                            focusIndex >= 0 &&
                            focusIndex !== i;
                      return (
                        <RoundedRect
                          key={d.key}
                          x={slot.x}
                          y={zeroY - h}
                          width={slot.width}
                          height={h + RADIUS}
                          r={RADIUS}
                          color={withAlpha(mint, faded ? 0.4 : 0.9)}
                        />
                      );
                    })}
                  </Group>
                  <Group clip={downClip}>
                    {data.map((d, i) => {
                      const slot = slots[i];
                      if (!slot || d.spent <= 0) return null;
                      const h = Math.max(
                        MIN_NUB + RADIUS,
                        Math.min(d.spent, scale.downTop) * px,
                      );
                      const faded =
                        selected !== null
                          ? selected !== i
                          : focusIndex !== undefined &&
                            focusIndex >= 0 &&
                            focusIndex !== i;
                      return (
                        <RoundedRect
                          key={d.key}
                          x={slot.x}
                          y={zeroY - RADIUS}
                          width={slot.width}
                          height={h + RADIUS}
                          r={RADIUS}
                          color={withAlpha(brass, faded ? 0.4 : 0.9)}
                        />
                      );
                    })}
                  </Group>
                </Group>
              ) : null}
              <Line
                p1={vec(0, zeroY)}
                p2={vec(plotWidth, zeroY)}
                color={withAlpha(colors.text, 0.28)}
                strokeWidth={1}
              />
              {hasData && font
                ? data.flatMap((d, i) => {
                    const slot = slots[i];
                    if (!slot) return [];
                    const marks: React.ReactNode[] = [];
                    if (d.income > scale.upTop) {
                      const text = compact(d.income);
                      const w = textWidth(font, text);
                      const x = Math.min(
                        Math.max(slot.center - w / 2, 0),
                        width - w,
                      );
                      marks.push(
                        <Group key={`bi-${d.key}`}>
                          {[10, 17].map((dy) => (
                            <Line
                              key={dy}
                              p1={vec(slot.x - 3, LANE + dy + 5)}
                              p2={vec(slot.x + slot.width + 3, LANE + dy - 5)}
                              color={colors.surface}
                              strokeWidth={2.5}
                            />
                          ))}
                          {selected === i ? null : (
                            <SkText
                              x={x}
                              y={LANE - 5}
                              text={text}
                              font={font}
                              color={colors.textSecondary}
                            />
                          )}
                        </Group>,
                      );
                    }
                    if (d.spent > scale.downTop) {
                      const bottom = LANE + height;
                      marks.push(
                        <Group key={`bo-${d.key}`}>
                          {[-17, -10].map((dy) => (
                            <Line
                              key={dy}
                              p1={vec(slot.x - 3, bottom + dy + 5)}
                              p2={vec(slot.x + slot.width + 3, bottom + dy - 5)}
                              color={colors.surface}
                              strokeWidth={2.5}
                            />
                          ))}
                        </Group>,
                      );
                    }
                    return marks;
                  })
                : null}
              {hasData && count > 1 && netMode === "running" ? (
                <Path
                  path={netPath}
                  style="stroke"
                  strokeWidth={1.75}
                  color={withAlpha(colors.text, 0.6)}
                  strokeCap="round"
                  strokeJoin="round"
                  start={0}
                  end={netEnd}
                />
              ) : null}
              {hasData && netMode === "markers"
                ? data.map((d, i) => {
                    const slot = slots[i];
                    if (!slot || (d.income <= 0 && d.spent <= 0)) return null;
                    const net = d.income - d.spent;
                    const y =
                      net >= 0
                        ? zeroY - Math.min(net, scale.upTop) * px
                        : zeroY + Math.min(-net, scale.downTop) * px;
                    const faded =
                      selected !== null
                        ? selected !== i
                        : focusIndex !== undefined &&
                          focusIndex >= 0 &&
                          focusIndex !== i;
                    const w = slot.width + 6;
                    return (
                      <Group key={`net-${d.key}`} opacity={faded ? 0.45 : 1}>
                        <RoundedRect
                          x={slot.center - w / 2 - 2}
                          y={y - 3.5}
                          width={w + 4}
                          height={7}
                          r={3.5}
                          color={colors.surface}
                        />
                        <RoundedRect
                          x={slot.center - w / 2}
                          y={y - 1.5}
                          width={w}
                          height={3}
                          r={1.5}
                          color={colors.text}
                        />
                      </Group>
                    );
                  })
                : null}
              {selected !== null && slots[selected] && netMode === "running" ? (
                <Group>
                  <Circle
                    cx={slots[selected]!.center}
                    cy={netY[selected] ?? zeroY}
                    r={4.5}
                    color={colors.surface}
                  />
                  <Circle
                    cx={slots[selected]!.center}
                    cy={netY[selected] ?? zeroY}
                    r={3}
                    color={colors.text}
                  />
                </Group>
              ) : null}
              {font
                ? labels.map((label) => {
                    const slot = slots[label.index];
                    if (!slot) return null;
                    const w = textWidth(font, label.text);
                    const x = Math.min(
                      Math.max(slot.center - w / 2, 0),
                      plotWidth - w,
                    );
                    return (
                      <SkText
                        key={label.index}
                        x={x}
                        y={LANE + height + 17}
                        text={label.text}
                        font={font}
                        color={
                          selected === label.index ||
                          (selected === null && focusIndex === label.index)
                            ? colors.text
                            : colors.textTertiary
                        }
                      />
                    );
                  })
                : null}
              {strip > 0 && rates ? (
                <RateStrip
                  rates={rates}
                  slots={slots}
                  plotWidth={plotWidth}
                  top={LANE + height + AXIS}
                  title={ratesTitle}
                  selected={
                    selected ??
                    (focusIndex !== undefined && focusIndex >= 0
                      ? focusIndex
                      : count - 1)
                  }
                  font={font}
                />
              ) : null}
              {labelFont ? (
                <FloatingLabel
                  text={
                    selected !== null && slots[selected]
                      ? formatLabel(selected)
                      : ""
                  }
                  font={labelFont}
                  centerX={slots[heldIndex]?.center ?? 0}
                  y={0}
                  totalWidth={width}
                />
              ) : null}
            </Canvas>
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

/**
 * Savings rate per bucket as lollipops on its own small zero-based panel (a separate chart, not a second axis on the
 * bars): kept money rises in mint, overspending drops in red. Only the emphasised bucket carries its value.
 */
function RateStrip({
  rates,
  slots,
  plotWidth,
  top,
  title,
  selected,
  font,
}: {
  rates: readonly (number | null)[];
  slots: readonly { center: number }[];
  plotWidth: number;
  top: number;
  title: string;
  selected: number;
  font: ReturnType<typeof useChartFont>;
}) {
  const { colors } = useTokens();
  const plotTop = top + RATE_TITLE + 4;
  const plotHeight = RATE_STRIP - RATE_TITLE - 10;
  const extent = Math.max(
    50,
    ...rates.map((r) => (r === null ? 0 : Math.min(100, Math.abs(r)))),
  );
  const hasNegative = rates.some((r) => r !== null && r < 0);
  const zero = hasNegative ? plotTop + plotHeight / 2 : plotTop + plotHeight;
  const span = hasNegative ? plotHeight / 2 : plotHeight;
  const yOf = (r: number) =>
    zero - (Math.max(-100, Math.min(100, r)) / extent) * span;
  // Nothing to say for an empty bucket: label the latest bucket that has a rate instead.
  let shown = selected;
  if (rates[shown] === null || rates[shown] === undefined)
    for (let i = rates.length - 1; i >= 0; i--)
      if (rates[i] !== null && rates[i] !== undefined) {
        shown = i;
        break;
      }
  const value = rates[shown];
  const valueText = value === null || value === undefined ? "" : `${value}%`;
  return (
    <Group>
      {font ? (
        <SkText
          x={0}
          y={top + 12}
          text={title}
          font={font}
          color={colors.textTertiary}
        />
      ) : null}
      <Line
        p1={vec(0, zero)}
        p2={vec(plotWidth, zero)}
        color={colors.separator}
        strokeWidth={StyleSheet.hairlineWidth}
      />
      {rates.map((rate, i) => {
        const slot = slots[i];
        if (!slot || rate === null) return null;
        const y = yOf(rate);
        const tone = rate >= 0 ? colors.income : colors.expense;
        const faded = i !== shown;
        return (
          <Group key={i} opacity={faded ? 0.45 : 1}>
            <Line
              p1={vec(slot.center, zero)}
              p2={vec(slot.center, y)}
              color={tone}
              strokeWidth={1.5}
            />
            <Circle cx={slot.center} cy={y} r={5} color={colors.surface} />
            <Circle cx={slot.center} cy={y} r={3.5} color={tone} />
          </Group>
        );
      })}
      {font && valueText && slots[shown] ? (
        <SkText
          x={Math.min(Math.max(slots[shown]!.center + 8, 0), plotWidth + 4)}
          y={Math.min(Math.max(yOf(value ?? 0) + 4, plotTop + 8), zero + span)}
          text={valueText}
          font={font}
          color={colors.text}
        />
      ) : null}
    </Group>
  );
}

export { CashFlowChart };
