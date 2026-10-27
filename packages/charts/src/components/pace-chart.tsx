import { textWidth } from "../lib/text-width";
import {
  BlurMask,
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
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { nearestPoint, niceTicks, pointX, valueToY } from "../lib";
import { formatMoney } from "@studio/money";
import { buildPolyPath, pointAt, motion } from "@studio/motion";
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

export type PaceDatum = {
  /** Cumulative spend in minor units; null after today. */
  actual: number | null;
  /** Even-pace target in minor units. */
  pace: number;
};

export type PaceChartProps = {
  data: readonly PaceDatum[];
  currency: string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Axis labels along the bottom: index and text. */
  labels?: readonly { index: number; text: string }[];
  /** Line colour; defaults to the accent. */
  color?: string;
  accessibilityLabel: string;
  height?: number;
  locale?: string;
  /** 'none' hides the y-axis amount labels and gridlines (and their gutter). Default 'full'. */
  axis?: "full" | "none";
};

const LANE = 30;
const AXIS = 24;
const GUTTER = 44;

/** "Day 12 · ₹8,400 of ₹12,000 pace". */
export function paceLabel(
  index: number,
  point: PaceDatum,
  currency: string,
  locale?: string,
): string {
  const pace = formatMoney(point.pace, currency, { locale, decimals: 0 });
  if (point.actual === null) return `Day ${index + 1} · ${pace} pace`;
  return `Day ${index + 1} · ${formatMoney(point.actual, currency, { locale, decimals: 0 })} of ${pace} pace`;
}

function buildPaths(
  data: readonly PaceDatum[],
  plotWidth: number,
  baseline: number,
  height: number,
) {
  const count = data.length;
  const peak = data.reduce((m, d) => Math.max(m, d.pace, d.actual ?? 0), 0);
  const { top: yMax, ticks } = niceTicks(peak, 3);
  const line = Skia.PathBuilder.Make();
  const area = Skia.PathBuilder.Make();
  const even = Skia.PathBuilder.Make();
  let started = false;
  let last = -1;
  data.forEach((d, i) => {
    const x = pointX(i, 0, plotWidth, count);
    const paceY = valueToY(d.pace, yMax, baseline, height);
    if (i === 0) even.moveTo(x, paceY);
    else even.lineTo(x, paceY);
    if (d.actual === null) return;
    const y = valueToY(d.actual, yMax, baseline, height);
    if (!started) {
      line.moveTo(x, y);
      area.moveTo(x, baseline);
      area.lineTo(x, y);
      started = true;
    } else {
      line.lineTo(x, y);
      area.lineTo(x, y);
    }
    last = i;
  });
  if (started) {
    area.lineTo(pointX(last, 0, plotWidth, count), baseline);
    area.close();
  }
  return {
    actualPath: line.build(),
    areaPath: area.build(),
    pacePath: even.build(),
    lastActual: last,
    yMax,
    ticks,
    peak,
  };
}

function PaceChart({
  data,
  currency,
  selectedIndex,
  onSelect,
  labels = [],
  color,
  accessibilityLabel,
  height = 160,
  locale,
  axis = "full",
}: PaceChartProps) {
  const { colors } = useTokens();
  const [width, onLayout] = useChartWidth();
  const font = useChartFont(11, "medium");
  const labelFont = useChartFont(12, "semibold");
  const grow = useGrow(motion.durations.draw);
  const showAxis = axis === "full";
  const plotWidth = Math.max(0, width - (showAxis ? GUTTER : 0));
  const baseline = LANE + height;
  const count = data.length;
  const tint = color ?? colors.text;
  const glow = colors.accent;
  const reduced = useReducedMotion();

  const { actualPath, areaPath, pacePath, lastActual, yMax, ticks, peak } =
    React.useMemo(
      () => buildPaths(data, plotWidth, baseline, height),
      [data, plotWidth, baseline, height],
    );

  const end = useDerivedValue(() => grow.value);

  // Comet: rides the line as it draws, then the end-dot pulses once.
  const poly = React.useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    data.forEach((d, i) => {
      if (d.actual !== null)
        pts.push({
          x: pointX(i, 0, plotWidth, count),
          y: valueToY(d.actual, yMax, baseline, height),
        });
    });
    return buildPolyPath(pts);
  }, [data, plotWidth, count, yMax, baseline, height]);
  const cometX = useDerivedValue(() => pointAt(poly, grow.value).x);
  const cometY = useDerivedValue(() => pointAt(poly, grow.value).y);
  const tailX = useDerivedValue(() => pointAt(poly, grow.value - 0.04).x);
  const tailY = useDerivedValue(() => pointAt(poly, grow.value - 0.04).y);
  const cometOpacity = useDerivedValue(() =>
    grow.value >= 1 ? 0 : Math.min(1, (1 - grow.value) * 10),
  );
  const pulse = useSharedValue(0);
  React.useEffect(() => {
    if (!reduced)
      pulse.value = withDelay(
        motion.durations.draw,
        withTiming(1, { duration: motion.durations.pulse * 1.4 }),
      );
  }, [reduced, pulse]);
  const ringR = useDerivedValue(() => 6 + pulse.value * 9);
  const ringOpacity = useDerivedValue(() =>
    pulse.value <= 0 || pulse.value >= 1 ? 0 : (1 - pulse.value) * 0.55,
  );
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
  const point = selected !== null ? data[selected] : undefined;
  const text =
    selected !== null && point
      ? paceLabel(selected, point, currency, locale)
      : "";
  const marker = point ? (point.actual ?? point.pace) : 0;

  return (
    <View
      onLayout={onLayout}
      style={{ height: LANE + height + AXIS }}
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
            <Canvas style={{ width, height: LANE + height + AXIS }}>
              {(showAxis ? (ticks.length > 0 ? ticks : [0, 0, 0]) : []).map(
                (t, i) => {
                  const y =
                    ticks.length > 0
                      ? valueToY(t, yMax, baseline, height)
                      : baseline - (height * (i + 1)) / 3;
                  return (
                    <Group key={i}>
                      <Line
                        p1={vec(0, y)}
                        p2={vec(plotWidth, y)}
                        color={colors.separator}
                        strokeWidth={StyleSheet.hairlineWidth}
                      />
                      {font && t > 0 ? (
                        <SkText
                          x={width - textWidth(font, compact(t))}
                          y={y + 4}
                          text={compact(t)}
                          font={font}
                          color={colors.textTertiary}
                        />
                      ) : null}
                    </Group>
                  );
                },
              )}
              {showAxis ? (
                <Line
                  p1={vec(0, baseline)}
                  p2={vec(plotWidth, baseline)}
                  color={colors.separator}
                  strokeWidth={StyleSheet.hairlineWidth}
                />
              ) : null}
              {count > 0 && peak > 0 ? (
                <>
                  <Path
                    path={pacePath}
                    style="stroke"
                    strokeWidth={1.5}
                    color={withAlpha(colors.text, 0.28)}
                    strokeCap="round"
                  >
                    <DashPathEffect intervals={[3, 4]} />
                  </Path>
                  {lastActual >= 0 ? (
                    <>
                      <Path path={areaPath} style="fill">
                        <LinearGradient
                          start={vec(0, LANE)}
                          end={vec(0, baseline)}
                          colors={[withAlpha(tint, 0.14), withAlpha(tint, 0)]}
                        />
                      </Path>
                      {reduced ? null : (
                        <Path
                          path={actualPath}
                          style="stroke"
                          strokeWidth={6}
                          color={withAlpha(glow, 0.4)}
                          strokeCap="round"
                          strokeJoin="round"
                          start={0}
                          end={end}
                        >
                          <BlurMask blur={7} style="normal" />
                        </Path>
                      )}
                      <Path
                        path={actualPath}
                        style="stroke"
                        strokeWidth={2.5}
                        color={tint}
                        strokeCap="round"
                        strokeJoin="round"
                        start={0}
                        end={end}
                      />
                      {reduced ? null : (
                        <>
                          <Circle
                            cx={tailX}
                            cy={tailY}
                            r={4}
                            color={glow}
                            opacity={cometOpacity}
                          >
                            <BlurMask blur={5} style="normal" />
                          </Circle>
                          <Circle
                            cx={cometX}
                            cy={cometY}
                            r={7}
                            color={glow}
                            opacity={cometOpacity}
                          >
                            <BlurMask blur={7} style="normal" />
                          </Circle>
                          <Circle
                            cx={cometX}
                            cy={cometY}
                            r={2.5}
                            color="#FFFFFF"
                            opacity={cometOpacity}
                          />
                          <Circle
                            cx={pointX(lastActual, 0, plotWidth, count)}
                            cy={valueToY(
                              data[lastActual]?.actual ?? 0,
                              yMax,
                              baseline,
                              height,
                            )}
                            r={ringR}
                            color={glow}
                            opacity={ringOpacity}
                          />
                        </>
                      )}
                      <Circle
                        cx={pointX(lastActual, 0, plotWidth, count)}
                        cy={valueToY(
                          data[lastActual]?.actual ?? 0,
                          yMax,
                          baseline,
                          height,
                        )}
                        r={6}
                        color={withAlpha(glow, 0.3)}
                      />
                      <Circle
                        cx={pointX(lastActual, 0, plotWidth, count)}
                        cy={valueToY(
                          data[lastActual]?.actual ?? 0,
                          yMax,
                          baseline,
                          height,
                        )}
                        r={3.5}
                        color={glow}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              {font
                ? labels.map((label) => {
                    const w = textWidth(font, label.text);
                    const x = Math.min(
                      Math.max(
                        pointX(label.index, 0, plotWidth, count) - w / 2,
                        0,
                      ),
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
              {selected !== null && point ? (
                <Group>
                  <Line
                    p1={vec(pointX(selected, 0, plotWidth, count), LANE)}
                    p2={vec(pointX(selected, 0, plotWidth, count), baseline)}
                    color={colors.separator}
                    strokeWidth={1}
                  />
                  <Circle
                    cx={pointX(selected, 0, plotWidth, count)}
                    cy={valueToY(marker, yMax, baseline, height)}
                    r={5}
                    color={colors.surface}
                  />
                  <Circle
                    cx={pointX(selected, 0, plotWidth, count)}
                    cy={valueToY(marker, yMax, baseline, height)}
                    r={3.5}
                    color={glow}
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

export { PaceChart };
