import {
  Canvas,
  Circle,
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

import {
  nearestPoint,
  niceRange,
  pointX,
  rangeToY,
  stackSeries,
  type AxisLabel,
  type Pt,
} from "../lib";
import { monotoneSegments } from "../lib/smooth";
import { formatMoney } from "@studio/money";
import { motion } from "@studio/motion";
import { useTokens, withAlpha } from "@studio/theme";
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

export type AreaStackSeries = {
  key: string;
  color: string;
  /** One value per point, minor units; may be negative (a card balance). */
  values: readonly number[];
};

export type AreaStackChartProps = {
  /** The total per point (line mode). */
  total: readonly number[];
  /** Per-series values, stacked in order (stacked mode). */
  series: readonly AreaStackSeries[];
  stacked: boolean;
  currency: string;
  labels: readonly AxisLabel[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Floating read-out for a point. */
  formatLabel: (index: number) => string;
  accessibilityLabel: string;
  /** Line colour in total mode; defaults to the text colour. */
  color?: string;
  height?: number;
  locale?: string;
};

const LANE = 30;
const AXIS = 24;
const GUTTER = 48;

function smoothThrough(b: ReturnType<typeof Skia.PathBuilder.Make>, pts: readonly Pt[], move: boolean) {
  if (pts.length === 0) return;
  if (move) b.moveTo(pts[0]![0], pts[0]![1]);
  else b.lineTo(pts[0]![0], pts[0]![1]);
  for (const [c1x, c1y, c2x, c2y, x, y] of monotoneSegments(pts))
    b.cubicTo(c1x, c1y, c2x, c2y, x, y);
}

/**
 * Balance over time: one line with a soft wash (total), or the same span stacked by series, positives above zero and
 * negatives below it. Scrub for a crosshair, a dot on the total and a floating read-out.
 */
function AreaStackChart({
  total,
  series,
  stacked,
  currency,
  labels,
  selectedIndex,
  onSelect,
  formatLabel,
  accessibilityLabel,
  color,
  height = 170,
  locale,
}: AreaStackChartProps) {
  const { colors } = useTokens();
  const [width, onLayout] = useChartWidth();
  const font = useChartFont(11, "medium");
  const labelFont = useChartFont(12, "semibold");
  const grow = useGrow(motion.durations.draw);
  const plotWidth = Math.max(0, width - GUTTER);
  const top = LANE + 6;
  const baseline = LANE + height;
  const count = total.length;
  const tint = color ?? colors.text;

  const geometry = React.useMemo(() => {
    const stack = stackSeries(series.map((s) => s.values));
    const lo = stacked ? stack.min : Math.min(0, ...total);
    const hi = stacked ? stack.max : Math.max(0, ...total);
    const range =
      count === 0 ? { lo: 0, hi: 0, ticks: [] as number[] } : niceRange(lo, hi, 3);
    const yAt = (v: number) => rangeToY(v, range.lo, range.hi, top, baseline);
    const xAt = (i: number) => pointX(i, 0, plotWidth, count);
    const totalPts: Pt[] = total.map((v, i) => [xAt(i), yAt(v)] as const);
    const line = Skia.PathBuilder.Make();
    smoothThrough(line, totalPts, true);
    const area = Skia.PathBuilder.Make();
    if (totalPts.length > 1) {
      const zero = yAt(Math.max(range.lo, Math.min(0, range.hi)));
      smoothThrough(area, totalPts, true);
      area.lineTo(totalPts[totalPts.length - 1]![0], zero);
      area.lineTo(totalPts[0]![0], zero);
      area.close();
    }
    const bands = stack.bands.map((band, s) => {
      const upper: Pt[] = band.upper.map((v, i) => [xAt(i), yAt(v)] as const);
      const lower: Pt[] = band.lower
        .map((v, i) => [xAt(i), yAt(v)] as const)
        .reverse();
      const fill = Skia.PathBuilder.Make();
      smoothThrough(fill, upper, true);
      smoothThrough(fill, lower, false);
      fill.close();
      // The edge away from zero carries the stroke: the top for savings, the bottom for debt.
      const positive = (series[s]?.values ?? []).some((v) => v > 0);
      const edge = Skia.PathBuilder.Make();
      smoothThrough(edge, positive ? upper : [...lower].reverse(), true);
      return { fill: fill.build(), edge: edge.build() };
    });
    return {
      ...range,
      yAt,
      xAt,
      totalPts,
      line: line.build(),
      area: area.build(),
      bands,
      stackTop: stack.bands.length
        ? total.map((_, i) =>
            Math.max(
              ...stack.bands.map((b) => Math.max(b.upper[i] ?? 0, 0)),
            ),
          )
        : [],
    };
  }, [series, stacked, total, count, plotWidth, top, baseline]);

  const end = useDerivedValue(() => grow.value);
  const gesture = useScrubGesture({
    indexAt: (x) =>
      x > plotWidth + 8 ? -1 : nearestPoint(x, 0, plotWidth, count),
    selected: selectedIndex,
    onSelect,
    minY: LANE - 6,
  });
  const selected =
    selectedIndex !== null && selectedIndex < count ? selectedIndex : null;
  useSelectionTimeout(selected, onSelect);
  const heldIndex = useHeld(selected);
  const text = selected !== null ? formatLabel(selected) : "";
  const compact = (value: number) =>
    formatMoney(value, currency, { compact: true, locale });
  const last = geometry.totalPts[geometry.totalPts.length - 1];
  const totalHeight = LANE + height + AXIS;
  const drawn = count > 1 && geometry.hi > geometry.lo;

  const placedLabels = React.useMemo(() => {
    if (!font) return [];
    const out: { index: number; text: string; x: number }[] = [];
    let right = -Infinity;
    for (const label of labels) {
      const w = font.getTextWidth(label.text);
      const x = Math.min(
        Math.max(geometry.xAt(label.index) - w / 2, 0),
        plotWidth - w,
      );
      if (x < right + 8) continue;
      out.push({ ...label, x });
      right = x + w;
    }
    return out;
  }, [labels, font, geometry, plotWidth]);

  return (
    <View
      onLayout={onLayout}
      style={{ height: totalHeight }}
      accessibilityLabel={accessibilityLabel}
      {...adjustableProps(count, selectedIndex, onSelect, text || accessibilityLabel)}
    >
      {width > 0 ? (
        <GestureDetector gesture={gesture}>
          <View collapsable={false}>
            <Canvas style={{ width, height: totalHeight }}>
              {geometry.ticks.map((t) => {
                const y = geometry.yAt(t);
                const label = compact(t);
                return (
                  <Group key={t}>
                    <Line
                      p1={vec(0, y)}
                      p2={vec(plotWidth, y)}
                      color={
                        t === 0 && geometry.lo < 0
                          ? withAlpha(colors.text, 0.28)
                          : colors.separator
                      }
                      strokeWidth={StyleSheet.hairlineWidth}
                    />
                    {font ? (
                      <SkText
                        x={width - font.getTextWidth(label)}
                        y={y + 4}
                        text={label}
                        font={font}
                        color={colors.textTertiary}
                      />
                    ) : null}
                  </Group>
                );
              })}
              {drawn && stacked
                ? geometry.bands.map((band, i) => (
                    <Group key={series[i]?.key ?? i} opacity={end}>
                      <Path
                        path={band.fill}
                        color={withAlpha(series[i]?.color ?? tint, 0.3)}
                      />
                      <Path
                        path={band.edge}
                        style="stroke"
                        strokeWidth={1.5}
                        strokeJoin="round"
                        strokeCap="round"
                        color={series[i]?.color ?? tint}
                      />
                    </Group>
                  ))
                : null}
              {drawn && !stacked ? (
                <>
                  <Path path={geometry.area} opacity={end}>
                    <LinearGradient
                      start={vec(0, top)}
                      end={vec(0, baseline)}
                      colors={[withAlpha(tint, 0.14), withAlpha(tint, 0)]}
                    />
                  </Path>
                  <Path
                    path={geometry.line}
                    style="stroke"
                    strokeWidth={2}
                    color={tint}
                    strokeCap="round"
                    strokeJoin="round"
                    start={0}
                    end={end}
                  />
                  {last ? (
                    <>
                      <Circle cx={last[0]} cy={last[1]} r={5.5} color={colors.surface} />
                      <Circle cx={last[0]} cy={last[1]} r={3.5} color={colors.accent} />
                    </>
                  ) : null}
                </>
              ) : null}
              {font
                ? placedLabels.map((label) => (
                    <SkText
                      key={label.index}
                      x={label.x}
                      y={baseline + 17}
                      text={label.text}
                      font={font}
                      color={
                        selected === label.index
                          ? colors.text
                          : colors.textTertiary
                      }
                    />
                  ))
                : null}
              {selected !== null && drawn ? (
                <Group>
                  <Line
                    p1={vec(geometry.xAt(selected), LANE)}
                    p2={vec(geometry.xAt(selected), baseline)}
                    color={withAlpha(colors.text, 0.22)}
                    strokeWidth={1}
                  />
                  {(stacked
                    ? [
                        {
                          y: geometry.yAt(geometry.stackTop[selected] ?? 0),
                          c: colors.text,
                        },
                      ]
                    : [{ y: geometry.yAt(total[selected] ?? 0), c: tint }]
                  ).map((dot, i) => (
                    <Group key={i}>
                      <Circle
                        cx={geometry.xAt(selected)}
                        cy={dot.y}
                        r={5.5}
                        color={colors.surface}
                      />
                      <Circle
                        cx={geometry.xAt(selected)}
                        cy={dot.y}
                        r={3.5}
                        color={dot.c}
                      />
                    </Group>
                  ))}
                </Group>
              ) : null}
              {labelFont ? (
                <FloatingLabel
                  text={text}
                  font={labelFont}
                  centerX={geometry.xAt(heldIndex)}
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

export { AreaStackChart };
