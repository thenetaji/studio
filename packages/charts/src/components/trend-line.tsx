import { textWidth } from "../lib/text-width";
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  LinearGradient,
  Path,
  Skia,
  Text as SkText,
  vec,
} from "@shopify/react-native-skia";
import * as React from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue } from "react-native-reanimated";

import { nearestPoint, niceRange, pointX, rangeToY, type Pt } from "../lib";
import { monotoneSegments } from "../lib/smooth";
import { formatMoney } from "@studio/money";
import { motion } from "@studio/motion";
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

export type TrendLineProps = {
  /** One value per point in minor units; null leaves a point out (days still to come). */
  values: readonly (number | null)[];
  /** Optional comparison drawn as a dashed line on the same scale (last period, a target). */
  compare?: readonly (number | null)[];
  currency: string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Floating read-out for a point, e.g. "12 Oct · ₹1.2L". */
  formatLabel: (index: number) => string;
  /** Axis labels along the bottom: index and text. */
  labels?: readonly { index: number; text: string }[];
  /** Line colour; defaults to the accent. */
  color?: string;
  accessibilityLabel: string;
  height?: number;
  locale?: string;
};

const LANE = 30;
const AXIS = 24;
const GUTTER = 48;

function points(
  values: readonly (number | null)[],
  count: number,
  plotWidth: number,
  yAt: (v: number) => number,
): Pt[] {
  const out: Pt[] = [];
  values.forEach((v, i) => {
    if (v !== null) out.push([pointX(i, 0, plotWidth, count), yAt(v)]);
  });
  return out;
}

function smooth(pts: readonly Pt[], closeTo?: number) {
  const b = Skia.PathBuilder.Make();
  if (pts.length === 0) return b.build();
  b.moveTo(pts[0]![0], pts[0]![1]);
  if (pts.length === 1) b.lineTo(pts[0]![0] + 0.01, pts[0]![1]);
  for (const [c1x, c1y, c2x, c2y, x, y] of monotoneSegments(pts))
    b.cubicTo(c1x, c1y, c2x, c2y, x, y);
  if (closeTo !== undefined && pts.length > 1) {
    b.lineTo(pts[pts.length - 1]![0], closeTo);
    b.lineTo(pts[0]![0], closeTo);
    b.close();
  }
  return b.build();
}

/** Positions axis labels inside the plot, dropping any that would touch the one before. */
function placeLabels(
  labels: readonly { index: number; text: string }[],
  font: { getTextWidth: (text: string) => number },
  plotWidth: number,
  count: number,
): { index: number; text: string; x: number }[] {
  const out: { index: number; text: string; x: number }[] = [];
  let right = -Infinity;
  for (const label of labels) {
    const w = textWidth(font, label.text);
    const x = Math.min(
      Math.max(pointX(label.index, 0, plotWidth, count) - w / 2, 0),
      plotWidth - w,
    );
    if (x < right + 8) continue;
    out.push({ ...label, x });
    right = x + w;
  }
  return out;
}

/**
 * A smooth line with a soft fill and an optional dashed comparison, on a domain that may cross zero
 * (balances). Scrub to read a point; the zero line is drawn when the domain spans it.
 */
function TrendLine({
  values,
  compare,
  currency,
  selectedIndex,
  onSelect,
  formatLabel,
  labels = [],
  color,
  accessibilityLabel,
  height = 150,
  locale,
}: TrendLineProps) {
  const { colors } = useTokens();
  const [width, onLayout] = useChartWidth();
  const font = useChartFont(11, "medium");
  const labelFont = useChartFont(12, "semibold");
  const grow = useGrow(motion.durations.draw);
  const plotWidth = Math.max(0, width - GUTTER);
  const top = LANE;
  const baseline = LANE + height;
  const count = Math.max(values.length, compare?.length ?? 0);
  const tint = color ?? colors.accent;

  const geometry = React.useMemo(() => {
    const all = [...values, ...(compare ?? [])].filter(
      (v): v is number => v !== null,
    );
    const { lo, hi, ticks } =
      all.length === 0
        ? { lo: 0, hi: 0, ticks: [] as number[] }
        : niceRange(Math.min(...all), Math.max(...all), 3);
    const yAt = (v: number) => rangeToY(v, lo, hi, top + 6, baseline);
    const main = points(values, count, plotWidth, yAt);
    const other = compare ? points(compare, count, plotWidth, yAt) : [];
    return {
      lo,
      hi,
      ticks,
      yAt,
      main,
      linePath: smooth(main),
      areaPath: smooth(main, baseline),
      comparePath: other.length > 1 ? smooth(other) : null,
    };
  }, [values, compare, count, plotWidth, top, baseline]);
  const { lo, hi, ticks, yAt, main, linePath, areaPath, comparePath } =
    geometry;

  const end = useDerivedValue(() => grow.value);
  const gesture = useScrubGesture({
    indexAt: (x) =>
      x > plotWidth + 8 ? -1 : nearestPoint(x, 0, plotWidth, count),
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
  const text = selected !== null ? formatLabel(selected) : "";
  const marker =
    selected !== null
      ? (values[selected] ?? compare?.[selected] ?? null)
      : null;
  const last = main[main.length - 1];
  const totalHeight = LANE + height + AXIS;

  return (
    <View
      onLayout={onLayout}
      style={{ height: totalHeight }}
      accessibilityLabel={accessibilityLabel}
      {...adjustableProps(
        count,
        selectedIndex,
        onSelect,
        text || accessibilityLabel,
      )}
    >
      {width > 0 ? (
        <GestureDetector gesture={gesture}>
          <View collapsable={false}>
            <Canvas style={{ width, height: totalHeight }}>
              {ticks.map((t) => {
                const y = yAt(t);
                const label = compact(t);
                return (
                  <Group key={t}>
                    <Line
                      p1={vec(0, y)}
                      p2={vec(plotWidth, y)}
                      color={
                        t === 0 && lo < 0
                          ? colors.textTertiary
                          : colors.separator
                      }
                      strokeWidth={StyleSheet.hairlineWidth}
                    />
                    {font ? (
                      <SkText
                        x={width - textWidth(font, label)}
                        y={y + 4}
                        text={label}
                        font={font}
                        color={colors.textTertiary}
                      />
                    ) : null}
                  </Group>
                );
              })}
              {comparePath ? (
                <Path
                  path={comparePath}
                  style="stroke"
                  strokeWidth={1.5}
                  color={withAlpha(colors.text, 0.3)}
                  strokeCap="round"
                >
                  <DashPathEffect intervals={[3, 4]} />
                </Path>
              ) : null}
              {main.length > 1 && hi > lo ? (
                <>
                  <Path path={areaPath} style="fill" opacity={end}>
                    <LinearGradient
                      start={vec(0, top)}
                      end={vec(0, baseline)}
                      colors={[withAlpha(tint, 0.2), withAlpha(tint, 0)]}
                    />
                  </Path>
                  <Path
                    path={linePath}
                    style="stroke"
                    strokeWidth={2.5}
                    color={tint}
                    strokeCap="round"
                    strokeJoin="round"
                    start={0}
                    end={end}
                  />
                </>
              ) : null}
              {last ? (
                <>
                  <Circle
                    cx={last[0]}
                    cy={last[1]}
                    r={6}
                    color={withAlpha(tint, 0.3)}
                  />
                  <Circle cx={last[0]} cy={last[1]} r={3.5} color={tint} />
                </>
              ) : null}
              {font
                ? placeLabels(labels, font, plotWidth, count).map((label) => (
                    <SkText
                      key={label.index}
                      x={label.x}
                      y={baseline + 17}
                      text={label.text}
                      font={font}
                      color={colors.textTertiary}
                    />
                  ))
                : null}
              {selected !== null && marker !== null ? (
                <Group>
                  <Line
                    p1={vec(pointX(selected, 0, plotWidth, count), LANE)}
                    p2={vec(pointX(selected, 0, plotWidth, count), baseline)}
                    color={colors.separator}
                    strokeWidth={1}
                  />
                  <Circle
                    cx={pointX(selected, 0, plotWidth, count)}
                    cy={yAt(marker)}
                    r={5}
                    color={colors.surface}
                  />
                  <Circle
                    cx={pointX(selected, 0, plotWidth, count)}
                    cy={yAt(marker)}
                    r={3.5}
                    color={tint}
                  />
                </Group>
              ) : null}
              {labelFont ? (
                <FloatingLabel
                  text={text}
                  font={labelFont}
                  centerX={pointX(heldIndex, 0, plotWidth, count)}
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

export { TrendLine };
