import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Text } from "@studio/ui";
import { durations, haptic, useTokens, withAlpha } from "@studio/theme";
import { divergingDomain, divergingLength } from "../lib";
import { useChartWidth } from "./chart-kit";

export type DivergingRow = {
  key: string;
  label: string;
  /** Signed change in minor units; positive grows right of the midline. */
  value: number;
  /** Formatted signed value shown at the bar end, e.g. "+₹2,400". */
  valueLabel: string;
  accessibilityLabel: string;
};

export type DivergingBarsProps = {
  rows: readonly DivergingRow[];
  /** Colour for values above zero and below it (two hues that read as opposites). */
  positiveColor: string;
  negativeColor: string;
  onPress?: (key: string) => void;
  /** Width of the name column. */
  labelWidth?: number;
};

const ROW = 34;
const BAR = 12;
/** Right-hand column for the signed values, so they line up. */
const VALUE_COLUMN = 72;
const INSET = 6;

function Bar({
  value,
  length,
  color,
  index,
}: {
  value: number;
  length: number;
  color: string;
  index: number;
}) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  React.useEffect(() => {
    if (reduced) return;
    grow.value = withDelay(
      40 * Math.min(index, 8),
      withTiming(1, {
        duration: durations.countUp,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [grow, reduced, index]);
  const style = useAnimatedStyle(() => ({ width: length * grow.value }));
  const positive = value > 0;
  return (
    <Animated.View
      style={[
        {
          height: BAR,
          backgroundColor: color,
          position: "absolute",
          top: (ROW - BAR) / 2,
          // Rounded at the data end, square on the midline.
          borderTopRightRadius: positive ? 4 : 0,
          borderBottomRightRadius: positive ? 4 : 0,
          borderTopLeftRadius: positive ? 0 : 4,
          borderBottomLeftRadius: positive ? 0 : 4,
        },
        positive ? { left: 0 } : { right: 0 },
        style,
      ]}
    />
  );
}

/**
 * Horizontal diverging bars around a neutral midline: increases grow right, decreases grow left, with the signed value
 * in an aligned column on the right. One shared scale; the largest change fills its half. Rows are tappable when
 * `onPress` is given.
 */
function DivergingBars({
  rows,
  positiveColor,
  negativeColor,
  onPress,
  labelWidth = 104,
}: DivergingBarsProps) {
  const { colors } = useTokens();
  const [width, onLayout] = useChartWidth();
  const track = Math.max(0, width - labelWidth - VALUE_COLUMN);
  const half = Math.max(0, track / 2 - INSET);
  const domain = divergingDomain(rows.map((r) => r.value));
  const mid = labelWidth + track / 2;

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: mid,
            top: 0,
            bottom: 0,
            width: StyleSheet.hairlineWidth * 2,
            backgroundColor: withAlpha(colors.text, 0.25),
          }}
        />
      ) : null}
      {rows.map((row, index) => {
        const length = divergingLength(row.value, domain, half);
        const positive = row.value > 0;
        const color = positive ? positiveColor : negativeColor;
        const body = (
          <View style={{ height: ROW, flexDirection: "row", alignItems: "center" }}>
            <Text
              variant="subhead"
              numberOfLines={1}
              style={{ width: labelWidth - 8 }}
            >
              {row.label}
            </Text>
            <View style={{ position: "absolute", left: 0, top: 0, width, height: ROW }}>
              {positive ? (
                <View style={{ position: "absolute", left: mid, width: half, height: ROW }}>
                  <Bar value={row.value} length={length} color={color} index={index} />
                </View>
              ) : (
                <View style={{ position: "absolute", left: mid - half, width: half, height: ROW }}>
                  <Bar value={row.value} length={length} color={color} index={index} />
                </View>
              )}
              <Text
                variant="footnote"
                tone="secondary"
                numeric
                numberOfLines={1}
                style={{
                  position: "absolute",
                  top: (ROW - 18) / 2,
                  right: 0,
                  width: VALUE_COLUMN,
                  textAlign: "right",
                }}
              >
                {row.valueLabel}
              </Text>
            </View>
          </View>
        );
        return onPress ? (
          <Pressable
            key={row.key}
            role="button"
            accessibilityLabel={row.accessibilityLabel}
            onPress={() => {
              haptic("selection");
              onPress(row.key);
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            {body}
          </Pressable>
        ) : (
          <View key={row.key} accessible accessibilityLabel={row.accessibilityLabel}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** Geometry the caller needs to place headings over the two halves. */
export const DIVERGING_VALUE_COLUMN = VALUE_COLUMN;

export { DivergingBars };
