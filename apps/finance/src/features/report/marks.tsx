import * as React from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { AppIcon } from "@studio/icons";
import { Pressable, Text } from "@studio/ui";
import { motion } from "@studio/motion";
import { haptic, useTokens, withAlpha } from "@studio/theme";
import type { DayStatus } from "@/lib/reports";

/**
 * Small data marks shared by the monthly report, the year in review and their share images. Plain Views (and one
 * SVG ring) rather than Skia, so the same marks render in a share capture and on web. `still` skips every
 * entrance so a captured image always shows the final state.
 */

const easeOutQuint = Easing.bezier(0.22, 1, 0.36, 1);

/** Neutral mark colour for "the rest" in emphasis charts (ART-DIRECTION 6.4: 22 % ink). */
export function useNeutralMark(): string {
  const { colors } = useTokens();
  return withAlpha(colors.text, 0.2);
}

function useGrowTo(target: number, delay: number, still: boolean) {
  const reduced = useReducedMotion();
  const instant = still || reduced;
  const value = useSharedValue(instant ? target : 0);
  React.useEffect(() => {
    value.value = instant
      ? target
      : withDelay(delay, withSpring(target, motion.springs.chart));
  }, [target, delay, instant, value]);
  return value;
}

// -- Column bars ---------------------------------------------------------------------------------

export type ColumnDatum = { key: string; label: string; value: number };

function Column({
  height,
  ratio,
  color,
  index,
  still,
  width,
}: {
  height: number;
  ratio: number;
  color: string;
  index: number;
  still: boolean;
  width: number;
}) {
  const grow = useGrowTo(ratio, 80 + Math.min(index, 14) * 35, still);
  const style = useAnimatedStyle(() => ({
    height: Math.max(ratio > 0 ? 3 : 0, grow.value * height),
  }));
  return (
    <View style={{ height, justifyContent: "flex-end", alignItems: "center" }}>
      <Animated.View
        style={[
          {
            width,
            backgroundColor: color,
            borderTopLeftRadius: Math.min(4, width / 2),
            borderTopRightRadius: Math.min(4, width / 2),
          },
          style,
        ]}
      />
    </View>
  );
}

type ColumnBarsProps = {
  data: readonly ColumnDatum[];
  /** Index drawn in the accent; the rest are neutral. */
  highlight: number | null;
  height?: number;
  /** Value label above a column, e.g. a compact amount; null hides it. */
  valueLabel?: (index: number) => string | null;
  /** Tap a column to move the label to it (touch stands in for hover). */
  selectable?: boolean;
  still?: boolean;
  maxBarWidth?: number;
  accessibilityLabel: string;
  /** Overrides the highlight colour. */
  color?: string;
  /** Labels under the columns, e.g. month initials; default on. */
  showLabels?: boolean;
};

/** Thin columns on one baseline: emphasis form (one in the accent, the rest neutral). */
export function ColumnBars({
  data,
  highlight,
  height = 96,
  valueLabel,
  selectable = false,
  still = false,
  maxBarWidth = 24,
  accessibilityLabel,
  color,
  showLabels = true,
}: ColumnBarsProps) {
  const { colors } = useTokens();
  const neutral = useNeutralMark();
  const [width, setWidth] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(Math.round(e.nativeEvent.layout.width));
  const max = Math.max(0, ...data.map((d) => d.value));
  const slot = data.length > 0 ? width / data.length : 0;
  const bar = Math.max(3, Math.min(maxBarWidth, slot * 0.62));
  const labelled = picked ?? highlight;
  const text = labelled !== null && valueLabel ? valueLabel(labelled) : null;
  const LANE = valueLabel ? 20 : 0;
  return (
    <View
      onLayout={onLayout}
      accessibilityLabel={accessibilityLabel}
      accessible={!selectable}
    >
      <View style={{ height: LANE }}>
        {text !== null && labelled !== null && width > 0 ? (
          <Text
            variant="caption"
            numeric
            numberOfLines={1}
            style={{
              position: "absolute",
              width: 120,
              textAlign: "center",
              left: Math.min(
                Math.max(slot * (labelled + 0.5) - 60, -20),
                width - 100,
              ),
            }}
          >
            {text}
          </Text>
        ) : null}
      </View>
      {width > 0 ? (
        <View className="flex-row">
          {data.map((d, i) => {
            const lit = i === highlight;
            const fill = lit
              ? (color ?? colors.accent)
              : i === picked
                ? withAlpha(colors.text, 0.38)
                : neutral;
            const body = (
              <View style={{ width: slot }}>
                <Column
                  height={height}
                  ratio={max > 0 ? d.value / max : 0}
                  color={fill}
                  index={i}
                  still={still}
                  width={bar}
                />
                {showLabels ? (
                  <Text
                    variant="caption"
                    tone={lit || i === picked ? "secondary" : "tertiary"}
                    numberOfLines={1}
                    className="mt-1.5 text-center"
                    style={{ fontSize: slot < 22 ? 10 : 12 }}
                  >
                    {d.label}
                  </Text>
                ) : null}
              </View>
            );
            if (!selectable)
              return <React.Fragment key={d.key}>{body}</React.Fragment>;
            return (
              <Pressable
                key={d.key}
                role="button"
                scale={1}
                accessibilityLabel={`${d.label}${valueLabel ? `, ${valueLabel(i) ?? ""}` : ""}`}
                onPress={() => {
                  haptic("selection");
                  setPicked((p) => (p === i ? null : i));
                }}
              >
                {body}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ height: height + (showLabels ? 22 : 0) }} />
      )}
    </View>
  );
}

// -- Dumbbell -------------------------------------------------------------------------------------

type DumbbellProps = {
  current: number;
  previous: number;
  max: number;
  color: string;
  index?: number;
  still?: boolean;
};

const DOT = 10;
const RING = 9;

/** Last month (hollow ring) to this month (filled dot) on a shared scale, joined by a thin bar. */
export function Dumbbell({
  current,
  previous,
  max,
  color,
  index = 0,
  still = false,
}: DumbbellProps) {
  const { colors } = useTokens();
  const [width, setWidth] = React.useState(0);
  const span = Math.max(0, width - DOT);
  const x = (v: number) => (max > 0 ? (Math.min(v, max) / max) * span : 0);
  const reduced = useReducedMotion();
  const instant = still || reduced;
  const t = useSharedValue(instant ? 1 : 0);
  React.useEffect(() => {
    if (!instant)
      t.value = withDelay(
        120 + index * 45,
        withTiming(1, { duration: 520, easing: easeOutQuint }),
      );
  }, [instant, index, t]);
  const prevX = x(previous);
  const curX = x(current);
  const lo = Math.min(prevX, curX);
  const hi = Math.max(prevX, curX);
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: prevX + (curX - prevX) * t.value }],
  }));
  const barStyle = useAnimatedStyle(() => {
    const now = prevX + (curX - prevX) * t.value;
    const a = Math.min(prevX, now);
    const b = Math.max(prevX, now);
    return { left: a + DOT / 2, width: Math.max(0, b - a) };
  });
  return (
    <View
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ height: DOT + 2, justifyContent: "center" }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 2,
          borderRadius: 1,
          backgroundColor: withAlpha(colors.text, 0.06),
        }}
      />
      {width > 0 ? (
        <>
          <Animated.View
            style={[
              {
                position: "absolute",
                height: 2,
                borderRadius: 1,
                backgroundColor: withAlpha(color, 0.45),
              },
              instant ? { left: lo + DOT / 2, width: hi - lo } : barStyle,
            ]}
          />
          {previous > 0 ? (
            <View
              style={{
                position: "absolute",
                left: prevX + (DOT - RING) / 2,
                width: RING,
                height: RING,
                borderRadius: RING / 2,
                borderWidth: 1.5,
                borderColor: colors.textTertiary,
                backgroundColor: colors.surface,
              }}
            />
          ) : null}
          {current > 0 ? (
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: 0,
                  width: DOT,
                  height: DOT,
                  borderRadius: DOT / 2,
                  backgroundColor: color,
                },
                instant ? { transform: [{ translateX: curX }] } : dotStyle,
              ]}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// -- Stacked share bar ----------------------------------------------------------------------------

export type ShareSegment = { key: string; value: number; color: string };

/** Part-to-whole as one horizontal bar; segments separated by a 2 pt surface gap. */
export function ShareStack({
  segments,
  height = 10,
  gapColor,
}: {
  segments: readonly ShareSegment[];
  height?: number;
  /** Colour of the 2 pt gap (the surface behind the bar). */
  gapColor: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const { colors } = useTokens();
  if (total <= 0)
    return (
      <View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: colors.fill,
        }}
      />
    );
  const visible = segments.filter((s) => s.value > 0);
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        overflow: "hidden",
        flexDirection: "row",
        backgroundColor: gapColor,
      }}
    >
      {visible.map((s, i) => (
        <View
          key={s.key}
          style={{
            flexGrow: s.value,
            flexBasis: 0,
            marginLeft: i === 0 ? 0 : 2,
            backgroundColor: s.color,
            minWidth: 2,
          }}
        />
      ))}
    </View>
  );
}

// -- Ring -----------------------------------------------------------------------------------------

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A meter ring: 0-1 sweep on a same-hue track. */
export function Ring({
  value,
  size,
  stroke,
  color,
  track,
  still = false,
  delay = 200,
  children,
}: {
  value: number;
  size: number;
  stroke: number;
  color: string;
  track: string;
  still?: boolean;
  delay?: number;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const instant = still || reduced;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const target = Math.min(Math.max(value, 0), 1);
  const progress = useSharedValue(instant ? target : 0);
  React.useEffect(() => {
    progress.value = instant
      ? target
      : withDelay(
          delay,
          withTiming(target, { duration: 900, easing: easeOutQuint }),
        );
  }, [progress, target, instant, delay]);
  const props = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        {target > 0 ? (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={props}
            strokeDashoffset={
              instant ? circumference * (1 - target) : undefined
            }
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

// -- Day dots (no-spend) --------------------------------------------------------------------------

/** One day in a no-spend grid: a leaf for no-spend, a small dot for spend, a faint ring for days to come. */
export function DayDot({
  status,
  size,
  highlight = false,
}: {
  status: DayStatus | null;
  size: number;
  /** Part of the longest streak: the leaf sits on an accent disc. */
  highlight?: boolean;
}) {
  const { colors } = useTokens();
  if (status === null) return <View style={{ width: size, height: size }} />;
  const center = {
    width: size,
    height: size,
    alignItems: "center",
    justifyContent: "center",
  } as const;
  if (status === "no-spend")
    return (
      <View style={center}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: highlight ? colors.accent : colors.accentSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppIcon
            name="leaf"
            size={Math.round(size * 0.58)}
            color={highlight ? colors.onAccent : colors.accentText}
          />
        </View>
      </View>
    );
  if (status === "spend")
    return (
      <View style={center}>
        <View
          style={{
            width: Math.max(4, size * 0.28),
            height: Math.max(4, size * 0.28),
            borderRadius: size,
            backgroundColor: withAlpha(colors.text, 0.28),
          }}
        />
      </View>
    );
  if (status === "future")
    return (
      <View style={center}>
        <View
          style={{
            width: Math.max(4, size * 0.28),
            height: Math.max(4, size * 0.28),
            borderRadius: size,
            borderWidth: 1,
            borderColor: withAlpha(colors.text, 0.18),
          }}
        />
      </View>
    );
  return (
    <View style={center}>
      <View
        style={{
          width: 3,
          height: 3,
          borderRadius: 1.5,
          backgroundColor: withAlpha(colors.text, 0.1),
        }}
      />
    </View>
  );
}

/** Tiny square cell for year grids: accent for no-spend, faint ink for spend, near-invisible for the rest. */
export function YearCell({
  status,
  size,
  strong,
}: {
  status: DayStatus | null;
  size: number;
  strong?: boolean;
}) {
  const { colors } = useTokens();
  const fill =
    status === "no-spend"
      ? strong
        ? colors.accent
        : withAlpha(colors.accent, 0.55)
      : status === "spend"
        ? withAlpha(colors.text, 0.12)
        : status === null
          ? "transparent"
          : withAlpha(colors.text, 0.04);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(1.5, size * 0.28),
        backgroundColor: fill,
      }}
    />
  );
}
