import { textWidth } from "../lib/text-width";
import {
  Canvas,
  DashPathEffect,
  Group,
  Line,
  RoundedRect,
  Text as SkText,
  vec,
} from "@shopify/react-native-skia";
import * as React from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

import {
  barSlots,
  barDomain,
  slotIndex,
  valueToY,
  type AxisLabel,
} from "../lib";
import { formatMoney } from "@studio/money";
import { motion } from "@studio/motion";
import { withAlpha, useTokens } from "@studio/theme";
import {
  adjustableProps,
  FloatingLabel,
  useChartWidth,
  useScrubGesture,
  useSelectionTimeout,
} from "./chart-kit";
import { useHeld } from "./use-held";
import { useChartFont } from "./use-chart-font";

export type BarDatum = { key: string; value: number };

export type BarChartProps = {
  /** One entry per bucket, `value` in minor units. */
  data: readonly BarDatum[];
  currency: string;
  /** Labels under the plot; build with `axisLabels`. */
  labels: readonly AxisLabel[];
  /** Mean per bucket, minor units; draws the dotted line. */
  average?: number;
  /** Bar colour; defaults to the accent. */
  color?: string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Floating read-out for a bucket, e.g. "Tue 7 · ₹1,240". */
  formatLabel: (index: number) => string;
  accessibilityLabel: string;
  /** Plot height; the chart adds a label lane above and axis labels below. */
  height?: number;
  locale?: string;
  /** Bar drawn at full strength (others dimmed) while nothing is scrubbed; e.g. the peak weekday. */
  highlightIndex?: number | null;
};

const LANE = 30;
const AXIS = 24;
const GUTTER = 44;
const RADIUS = 4;
const MIN_NUB = 2;

type BarProps = {
  x: number;
  width: number;
  baseline: number;
  target: number;
  index: number;
  color: string;
};

/** One bar: grows from zero on mount (staggered) and springs to new heights when the data changes. */
function Bar({ x, width, baseline, target, index, color }: BarProps) {
  const reduced = useReducedMotion();
  const h = useSharedValue(reduced ? target : 0);
  React.useEffect(() => {
    h.value = reduced
      ? target
      : withDelay(
          Math.min(index, 14) * 22,
          withSpring(target, motion.springs.chart),
        );
  }, [target, index, reduced, h]);
  const y = useDerivedValue(() => baseline - h.value);
  const height = useDerivedValue(() => Math.max(0, h.value) + RADIUS);
  return (
    <RoundedRect
      x={x}
      y={y}
      width={width}
      height={height}
      r={RADIUS}
      color={color}
    />
  );
}

function BarChart({
  data,
  currency,
  labels,
  average = 0,
  color,
  selectedIndex,
  onSelect,
  formatLabel,
  accessibilityLabel,
  height = 160,
  locale,
  highlightIndex = null,
}: BarChartProps) {
  const { colors } = useTokens();
  const [width, onLayout] = useChartWidth();
  const font = useChartFont(11, "medium");
  const labelFont = useChartFont(12, "semibold");

  const plotWidth = Math.max(0, width - GUTTER);
  const baseline = LANE + height;
  const count = data.length;
  const peak = data.reduce((m, d) => Math.max(m, d.value), 0);
  const hasData = peak > 0;
  const domain = barDomain(
    data.map((d) => d.value),
    average,
    3,
  );
  const top = domain.top;
  const ticks = domain.ticks;
  const slots = React.useMemo(
    () => barSlots(0, plotWidth, count, count > 20 ? 3 : 6, 36),
    [plotWidth, count],
  );
  const tint = color ?? colors.accent;

  const gesture = useScrubGesture({
    indexAt: (x) => (x > plotWidth ? -1 : slotIndex(x, 0, plotWidth, count)),
    selected: selectedIndex,
    onSelect,
    minY: LANE - 6,
  });

  const compact = (value: number) =>
    formatMoney(value, currency, { compact: true, locale });
  const averageY =
    hasData && average > 0 ? valueToY(average, top, baseline, height) : null;
  const guides = hasData
    ? ticks.map((t) => ({ value: t, y: valueToY(t, top, baseline, height) }))
    : [];
  const selected =
    selectedIndex !== null && selectedIndex < count ? selectedIndex : null;
  useSelectionTimeout(selected, onSelect);
  const heldIndex = useHeld(selected);
  const spoken =
    selected === null
      ? accessibilityLabel
      : `${accessibilityLabel}. ${formatLabel(selected)}`;

  return (
    <View
      onLayout={onLayout}
      style={{ height: LANE + height + AXIS }}
      accessibilityLabel={accessibilityLabel}
      {...adjustableProps(count, selectedIndex, onSelect, spoken)}
    >
      {width > 0 ? (
        <GestureDetector gesture={gesture}>
          <View collapsable={false}>
            <Canvas style={{ width, height: LANE + height + AXIS }}>
              {guides.map((g) => (
                <Group key={g.y}>
                  <Line
                    p1={vec(0, g.y)}
                    p2={vec(plotWidth, g.y)}
                    color={colors.separator}
                    strokeWidth={StyleSheet.hairlineWidth}
                  />
                  {font && g.value > 0 ? (
                    <SkText
                      x={width - textWidth(font, compact(g.value))}
                      y={g.y + 4}
                      text={compact(g.value)}
                      font={font}
                      color={colors.textTertiary}
                    />
                  ) : null}
                </Group>
              ))}
              <Line
                p1={vec(0, baseline)}
                p2={vec(plotWidth, baseline)}
                color={colors.separator}
                strokeWidth={StyleSheet.hairlineWidth}
              />
              {hasData ? (
                <Group
                  clip={{ x: 0, y: 0, width: plotWidth, height: baseline }}
                >
                  <Group>
                    {data.map((d, i) => {
                      const slot = slots[i];
                      if (!slot) return null;
                      const h =
                        d.value > 0
                          ? Math.max(
                              MIN_NUB + RADIUS,
                              baseline -
                                valueToY(d.value, top, baseline, height),
                            )
                          : 0;
                      const faded =
                        selected !== null
                          ? selected !== i
                          : highlightIndex !== null && highlightIndex !== i;
                      return (
                        <Bar
                          key={d.key}
                          x={slot.x}
                          width={slot.width}
                          baseline={baseline}
                          target={h}
                          index={i}
                          color={
                            selected === i ||
                            (selected === null && highlightIndex === i)
                              ? tint
                              : withAlpha(tint, faded ? 0.45 : 0.7)
                          }
                        />
                      );
                    })}
                  </Group>
                </Group>
              ) : null}
              {hasData && domain.clipped
                ? data.map((d, i) => {
                    const slot = slots[i];
                    if (!slot || d.value <= top || !font) return null;
                    const text = compact(d.value);
                    const w = textWidth(font, text);
                    const x = Math.min(
                      Math.max(slot.center - w / 2, 0),
                      width - w,
                    );
                    return (
                      <Group key={`break-${d.key}`}>
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
                      </Group>
                    );
                  })
                : null}
              {averageY !== null ? (
                <Group>
                  <Line
                    p1={vec(0, averageY)}
                    p2={vec(plotWidth, averageY)}
                    color={colors.textSecondary}
                    strokeWidth={1.25}
                  >
                    <DashPathEffect intervals={[2, 4]} />
                  </Line>
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
                        y={baseline + 17}
                        text={label.text}
                        font={font}
                        color={colors.textTertiary}
                      />
                    );
                  })
                : null}
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

export { BarChart };
