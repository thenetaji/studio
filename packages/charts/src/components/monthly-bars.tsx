import { textWidth } from "../lib/text-width";
import {
  Canvas,
  Group,
  Line,
  RoundedRect,
  Text as SkText,
  vec,
} from "@shopify/react-native-skia";
import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  barDomain,
  barSlots,
  slotIndex,
  valueToY,
  type AxisLabel,
  type FlowDatum,
} from "../lib";
import { motion } from "@studio/motion";
import { haptic, withAlpha, useTokens } from "@studio/theme";
import { FloatingLabel, useChartWidth } from "./chart-kit";
import { useHeld } from "./use-held";
import { useChartFont } from "./use-chart-font";

export type MonthlyBarsProps = {
  /** Oldest first; `spent` is the bar, `income` the mint tick. Minor units. */
  data: readonly FlowDatum[];
  currency: string;
  labels: readonly AxisLabel[];
  /** The month being viewed: drawn at full strength, the others dimmed. */
  selectedIndex: number | null;
  /** Tap on a bar. */
  onPick: (index: number) => void;
  /** Floating read-out, e.g. "Aug · Spent ₹52.3K · Earned ₹1.45L". */
  formatLabel: (index: number) => string;
  accessibilityLabel: string;
  /** Plot height; the chart adds a label lane above and month labels below. */
  height?: number;
  locale?: string;
};

const LANE = 28;
const AXIS = 22;
const RADIUS = 5;
const MIN_NUB = 3;
const DIM = 0.45;

type BarProps = {
  x: number;
  width: number;
  baseline: number;
  target: number;
  tickY: number | null;
  index: number;
  lit: boolean;
  barColor: string;
  tickColor: string;
};

/** One month: grows once (staggered), springs to a new height, and brightens when it becomes the viewed month. */
function MonthBar({
  x,
  width,
  baseline,
  target,
  tickY,
  index,
  lit,
  barColor,
  tickColor,
}: BarProps) {
  const reduced = useReducedMotion();
  const h = useSharedValue(reduced ? target : 0);
  const op = useSharedValue(lit ? 1 : DIM);
  React.useEffect(() => {
    h.value = reduced
      ? target
      : withDelay(
          Math.min(index, 14) * 24,
          withSpring(target, motion.springs.chart),
        );
  }, [target, index, reduced, h]);
  React.useEffect(() => {
    op.value = reduced
      ? lit
        ? 1
        : DIM
      : withTiming(lit ? 1 : DIM, { duration: 200 });
  }, [lit, reduced, op]);
  const y = useDerivedValue(() => baseline - h.value);
  const height = useDerivedValue(() => Math.max(0, h.value) + RADIUS);
  return (
    <Group opacity={op}>
      <Group clip={{ x: x - 4, y: 0, width: width + 8, height: baseline }}>
        <RoundedRect
          x={x}
          y={y}
          width={width}
          height={height}
          r={RADIUS}
          color={barColor}
        />
      </Group>
      {tickY !== null ? (
        <RoundedRect
          x={x - 2}
          y={tickY - 1.25}
          width={width + 4}
          height={2.5}
          r={1.25}
          color={tickColor}
        />
      ) : null}
    </Group>
  );
}

/**
 * Twelve months of spending as rounded brass bars with a mint tick at each month's income, on one axis. The viewed
 * month is lit; tap a bar to view it, drag to read any month.
 */
function MonthlyBars({
  data,
  labels,
  selectedIndex,
  onPick,
  formatLabel,
  accessibilityLabel,
  height = 100,
}: MonthlyBarsProps) {
  const { colors } = useTokens();
  const [width, onLayout] = useChartWidth();
  const font = useChartFont(11, "medium");
  const labelFont = useChartFont(12, "semibold");
  const [scrub, setScrub] = React.useState<number | null>(null);
  const count = data.length;
  const baseline = LANE + height;
  const slots = React.useMemo(
    () => barSlots(0, width, count, 8, 22),
    [width, count],
  );

  // The axis follows spending so the bars stay readable; income ticks above it pin to the top edge.
  const values = React.useMemo(() => data.map((d) => d.spent), [data]);
  const positive = values.filter((v) => v > 0);
  const average =
    positive.length === 0
      ? 0
      : positive.reduce((s, v) => s + v, 0) / positive.length;
  const domain = barDomain(values, average, 2);
  const top = domain.top;
  const hasData = top > 0;

  const viewed =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < count
      ? selectedIndex
      : null;
  const shown = scrub ?? viewed;
  const heldIndex = useHeld(scrub);

  const indexAt = (x: number) =>
    width <= 0 ? -1 : slotIndex(x, 0, width, count);
  const gesture = Gesture.Race(
    Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-8, 8])
      .failOffsetY([-16, 16])
      .onStart((e) => {
        const i = indexAt(e.x);
        if (i >= 0) {
          haptic("selection");
          setScrub(i);
        }
      })
      .onUpdate((e) => {
        const i = indexAt(e.x);
        if (i >= 0 && i !== scrub) {
          haptic("selection");
          setScrub(i);
        }
      })
      .onFinalize(() => setScrub(null)),
    Gesture.Tap()
      .runOnJS(true)
      .maxDuration(400)
      .onEnd((e, ok) => {
        const i = e.y < LANE - 6 ? -1 : indexAt(e.x);
        if (!ok || i < 0 || i === viewed) return;
        haptic("selection");
        onPick(i);
      }),
  );

  return (
    <View
      onLayout={onLayout}
      style={{ height: LANE + height + AXIS }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {width > 0 ? (
        <GestureDetector gesture={gesture}>
          <View collapsable={false}>
            <Canvas style={{ width, height: LANE + height + AXIS }}>
              <Line
                p1={vec(0, baseline)}
                p2={vec(width, baseline)}
                color={colors.separator}
                strokeWidth={StyleSheet.hairlineWidth}
              />
              {hasData
                ? data.map((d, i) => {
                    const slot = slots[i];
                    if (!slot) return null;
                    const bar =
                      d.spent > 0
                        ? Math.max(
                            MIN_NUB + RADIUS,
                            baseline - valueToY(d.spent, top, baseline, height),
                          )
                        : 0;
                    const tick =
                      d.income > 0
                        ? valueToY(d.income, top, baseline, height)
                        : null;
                    const pinned = d.income > top;
                    return (
                      <MonthBar
                        key={d.key}
                        x={slot.x}
                        width={slot.width}
                        baseline={baseline}
                        target={bar}
                        tickY={tick}
                        index={i}
                        lit={viewed === null || viewed === i}
                        barColor={colors.accent}
                        tickColor={
                          pinned
                            ? withAlpha(colors.income, 0.75)
                            : colors.income
                        }
                      />
                    );
                  })
                : null}
              {hasData && domain.clipped && font
                ? data.flatMap((d, i) => {
                    const slot = slots[i];
                    const over = d.spent;
                    if (!slot || over <= top) return [];
                    return [0, 6].map((dy) => (
                      <Line
                        key={`${d.key}-${dy}`}
                        p1={vec(slot.x - 3, LANE + 8 + dy + 4)}
                        p2={vec(slot.x + slot.width + 3, LANE + 8 + dy - 4)}
                        color={colors.surface}
                        strokeWidth={2.2}
                      />
                    ));
                  })
                : null}
              {font
                ? labels.map((label) => {
                    const slot = slots[label.index];
                    if (!slot) return null;
                    const w = textWidth(font, label.text);
                    const lit = shown === label.index;
                    return (
                      <SkText
                        key={label.index}
                        x={Math.min(
                          Math.max(slot.center - w / 2, 0),
                          width - w,
                        )}
                        y={baseline + 16}
                        text={label.text}
                        font={font}
                        color={lit ? colors.text : colors.textTertiary}
                      />
                    );
                  })
                : null}
              {labelFont ? (
                <FloatingLabel
                  text={
                    scrub !== null && slots[scrub] ? formatLabel(scrub) : ""
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

export { MonthlyBars };
