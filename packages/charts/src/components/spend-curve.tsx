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
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import {
  spendCurveDayAt,
  spendCurveGeometry,
  type Pt,
  type Segment,
} from "../lib";
import { withAlpha, useTokens } from "@studio/theme";
import {
  adjustableProps,
  FloatingLabel,
  useChartWidth,
  useScrubGesture,
  useSelectionTimeout,
} from "./chart-kit";
import { useChartFont } from "./use-chart-font";

export type SpendCurveProps = {
  /** Cumulative spend at the end of each elapsed day, minor units; today is the last entry. */
  actual: readonly number[];
  /** Cumulative reference for every day of the period (an even budget pace, or last period): the dotted line. */
  reference: readonly number[];
  /** Days in the period; the frame is the whole period. */
  days: number;
  /** Read-out for a day (0 = day 1) while scrubbing, e.g. "12 Oct · ₹21,300 · Budget ₹30,000". */
  formatLabel: (index: number) => string;
  /** Under the left and right ends of the baseline, e.g. "1 Oct" and "31 Oct". */
  startLabel?: string;
  endLabel?: string;
  /** Direct label at the end of the dotted line, e.g. "₹75K". Dropped when it would collide with the solid line. */
  referenceLabel?: string;
  /** Solid line colour; the accent by default. */
  color?: string;
  accessibilityLabel: string;
  /** Plot height, without the read-out lane and the date labels. */
  height?: number;
};

const LANE = 30;
const AXIS = 22;
const DRAW_MS = 700;
const easeOutQuint = Easing.bezier(0.22, 1, 0.36, 1);

function pathFrom(points: readonly Pt[], segments: readonly Segment[]) {
  const b = Skia.PathBuilder.Make();
  const first = points[0];
  if (!first) return b.build();
  b.moveTo(first[0], first[1]);
  for (const s of segments) b.cubicTo(s[0], s[1], s[2], s[3], s[4], s[5]);
  return b.build();
}

function areaFrom(
  points: readonly Pt[],
  segments: readonly Segment[],
  baseline: number,
) {
  const b = Skia.PathBuilder.Make();
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return b.build();
  b.moveTo(first[0], baseline);
  b.lineTo(first[0], first[1]);
  for (const s of segments) b.cubicTo(s[0], s[1], s[2], s[3], s[4], s[5]);
  b.lineTo(last[0], baseline);
  b.close();
  return b.build();
}

/**
 * Copilot-style spend curve: the period so far as a solid line with a soft wash, a dotted reference for the whole
 * period (an even budget pace or last period), today's end-dot and two date labels. No gridlines or y-axis: the
 * figure above the chart carries the value. Scrub with a finger for any day's read-out.
 */
function SpendCurve({
  actual,
  reference,
  days,
  formatLabel,
  startLabel,
  endLabel,
  referenceLabel,
  color,
  accessibilityLabel,
  height = 112,
}: SpendCurveProps) {
  const { colors } = useTokens();
  const reduced = useReducedMotion();
  const [width, onLayout] = useChartWidth();
  const font = useChartFont(11, "medium");
  const labelFont = useChartFont(12, "semibold");
  const [selected, setSelected] = React.useState<number | null>(null);
  useSelectionTimeout(selected, setSelected);
  const tint = color ?? colors.accent;
  const total = LANE + height + AXIS;
  const top = LANE + 4;
  const baseline = LANE + height;

  const geo = React.useMemo(
    () => spendCurveGeometry(actual, reference, days, width, top, baseline),
    [actual, reference, days, width, top, baseline],
  );
  const line = React.useMemo(
    () => pathFrom(geo.actual, geo.actualSegments),
    [geo],
  );
  const area = React.useMemo(
    () => areaFrom(geo.actual, geo.actualSegments, baseline),
    [geo, baseline],
  );
  const dotted = React.useMemo(
    () => pathFrom(geo.reference, geo.referenceSegments),
    [geo],
  );

  // Draw-in once: the line trims 0 -> 1, the wash and the dotted line fade in, the end-dot lands last.
  const grow = useSharedValue(reduced ? 1 : 0);
  const fade = useSharedValue(reduced ? 1 : 0);
  React.useEffect(() => {
    if (reduced) return;
    grow.value = withDelay(
      120,
      withTiming(1, { duration: DRAW_MS, easing: easeOutQuint }),
    );
    fade.value = withDelay(80, withTiming(1, { duration: 400 }));
  }, [reduced, grow, fade]);
  const areaOpacity = useDerivedValue(() =>
    Math.min(1, Math.max(0, (grow.value - 0.35) / 0.65)),
  );
  const dotScale = useDerivedValue(() => (grow.value >= 0.98 ? 1 : 0));

  const gesture = useScrubGesture({
    indexAt: (x) => spendCurveDayAt(x, width, days),
    selected,
    onSelect: setSelected,
  });
  const shown = selected !== null && selected < days ? selected : null;
  const shownPoint =
    shown === null
      ? undefined
      : shown < actual.length
        ? geo.actual[shown + 1]
        : geo.reference[shown + 1];
  // Keeps the read-out anchored while it fades after the selection clears.
  const [anchorX, setAnchorX] = React.useState(0);
  if (shownPoint && shownPoint[0] !== anchorX) setAnchorX(shownPoint[0]);

  const refEnd = geo.reference[geo.reference.length - 1];
  const refText = referenceLabel && font && refEnd ? referenceLabel : "";
  const refTextWidth = refText && font ? textWidth(font, refText) : 0;
  const refTextY = refEnd ? Math.max(refEnd[1] - 9, LANE + 10) : 0;
  const collides =
    !refText ||
    !refEnd ||
    (geo.end !== null &&
      geo.end[0] > width - refTextWidth - 14 &&
      Math.abs(geo.end[1] - refTextY) < 18);

  return (
    <View
      onLayout={onLayout}
      style={{ height: total }}
      accessibilityLabel={accessibilityLabel}
      {...adjustableProps(
        days,
        shown,
        setSelected,
        shown !== null ? formatLabel(shown) : accessibilityLabel,
      )}
    >
      {width > 0 ? (
        <GestureDetector gesture={gesture}>
          <View collapsable={false}>
            <Canvas style={{ width, height: total }}>
              <Line
                p1={vec(0, baseline)}
                p2={vec(width, baseline)}
                color={colors.separator}
                strokeWidth={StyleSheet.hairlineWidth * 2}
              />
              {geo.referenceSegments.length > 0 ? (
                <Group opacity={fade}>
                  <Path
                    path={dotted}
                    style="stroke"
                    strokeWidth={2}
                    strokeCap="round"
                    color={withAlpha(colors.text, 0.3)}
                  >
                    <DashPathEffect intervals={[0.01, 5]} />
                  </Path>
                </Group>
              ) : null}
              {geo.end ? (
                <>
                  <Group opacity={areaOpacity}>
                    <Path path={area} style="fill">
                      <LinearGradient
                        start={vec(0, top)}
                        end={vec(0, baseline)}
                        colors={[withAlpha(tint, 0.2), withAlpha(tint, 0)]}
                      />
                    </Path>
                  </Group>
                  <Path
                    path={line}
                    style="stroke"
                    strokeWidth={2.25}
                    strokeCap="round"
                    strokeJoin="round"
                    color={tint}
                    start={0}
                    end={grow}
                  />
                  <Group opacity={dotScale}>
                    <Circle
                      cx={geo.end[0]}
                      cy={geo.end[1]}
                      r={6.5}
                      color={colors.bg}
                    />
                    <Circle
                      cx={geo.end[0]}
                      cy={geo.end[1]}
                      r={4.25}
                      color={tint}
                    />
                  </Group>
                </>
              ) : null}
              {font && refText && !collides && refEnd ? (
                <SkText
                  x={width - refTextWidth}
                  y={refTextY}
                  text={refText}
                  font={font}
                  color={colors.textTertiary}
                />
              ) : null}
              {font && startLabel ? (
                <SkText
                  x={0}
                  y={baseline + 16}
                  text={startLabel}
                  font={font}
                  color={colors.textTertiary}
                />
              ) : null}
              {font && endLabel ? (
                <SkText
                  x={width - textWidth(font, endLabel)}
                  y={baseline + 16}
                  text={endLabel}
                  font={font}
                  color={colors.textTertiary}
                />
              ) : null}
              {shownPoint ? (
                <>
                  <Line
                    p1={vec(shownPoint[0], LANE)}
                    p2={vec(shownPoint[0], baseline)}
                    color={withAlpha(colors.text, 0.22)}
                    strokeWidth={1}
                  />
                  <Circle
                    cx={shownPoint[0]}
                    cy={shownPoint[1]}
                    r={6.5}
                    color={colors.bg}
                  />
                  <Circle
                    cx={shownPoint[0]}
                    cy={shownPoint[1]}
                    r={4.25}
                    color={
                      shown !== null && shown < actual.length
                        ? tint
                        : withAlpha(colors.text, 0.45)
                    }
                  />
                </>
              ) : null}
              {labelFont ? (
                <FloatingLabel
                  text={shown !== null ? formatLabel(shown) : ""}
                  font={labelFont}
                  centerX={anchorX}
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

export { SpendCurve };
