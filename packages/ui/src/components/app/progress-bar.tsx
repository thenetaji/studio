import * as React from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

import { motion } from "@studio/motion";
import { useTokens, withAlpha } from "@studio/theme";

type ProgressBarProps = {
  value: number;
  color?: string;
  /** Pace tick, 0-1: today's position in the period. A 1 pt `text-tertiary` line across the track. */
  marker?: number;
  /**
   * Expected spend still to come, 0-1 of the track: an outlined segment after the fill (a 2 pt gap between), so
   * committed but unposted amounts read as pending rather than spent.
   */
  upcoming?: number;
  /**
   * Use `color` at every ratio. By default the fill turns warning from 90% and expense once over; callers that
   * encode status themselves (budget pace) pass the colour and set this.
   */
  fixedColor?: boolean;
  /** Track height in points; 6 by default. */
  height?: number;
  accessibilityLabel?: string;
};

function ProgressBar({
  value,
  color,
  marker,
  upcoming = 0,
  fixedColor = false,
  height = 6,
  accessibilityLabel,
}: ProgressBarProps) {
  const { colors } = useTokens();
  const ratio = Math.max(0, value);
  const fill = fixedColor
    ? (color ?? colors.accent)
    : ratio > 1
      ? colors.expense
      : ratio >= 0.9
        ? colors.warning
        : (color ?? colors.accent);
  const reduced = useReducedMotion();
  const width = useSharedValue(reduced ? Math.min(ratio, 1) : 0);
  const pace = useSharedValue(reduced ? (marker ?? 0) : 0);
  const pending = Math.max(0, Math.min(upcoming, 1 - Math.min(ratio, 1)));
  const due = useSharedValue(reduced ? pending : 0);
  React.useEffect(() => {
    due.value = reduced
      ? pending
      : withDelay(120, withSpring(pending, motion.springs.fill));
  }, [pending, due, reduced]);
  React.useEffect(() => {
    const next = Math.min(ratio, 1);
    width.value = reduced ? next : withSpring(next, motion.springs.fill);
  }, [ratio, width, reduced]);
  React.useEffect(() => {
    const next = marker ?? 0;
    pace.value = reduced
      ? next
      : withDelay(180, withSpring(next, motion.springs.fill));
  }, [marker, pace, reduced]);
  const style = useAnimatedStyle(() => ({
    width: `${Math.max(0, width.value) * 100}%`,
  }));
  const dueStyle = useAnimatedStyle(() => ({
    left: `${Math.max(0, width.value) * 100}%`,
    width: `${Math.max(0, due.value) * 100}%`,
    opacity: due.value > 0.002 ? 1 : 0,
  }));
  const markerStyle = useAnimatedStyle(() => ({
    left: `${pace.value * 100}%`,
  }));
  return (
    <View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(Math.min(ratio, 1) * 100),
        }}
        className="overflow-hidden rounded-full bg-fill"
        style={{ height }}
      >
        <Animated.View
          className="h-full rounded-full"
          style={[{ backgroundColor: fill }, style]}
        />
        {pending > 0 ? (
          <Animated.View
            pointerEvents="none"
            className="absolute bottom-0 top-0 rounded-full"
            style={[dueStyle]}
          >
            <View
              className="flex-1 rounded-full"
              style={{
                marginLeft: 2,
                borderWidth: 1,
                borderColor: withAlpha(fill, 0.75),
                backgroundColor: withAlpha(fill, 0.14),
              }}
            />
          </Animated.View>
        ) : null}
      </View>
      {marker !== undefined && marker > 0 && marker < 1 ? (
        <Animated.View
          pointerEvents="none"
          className="absolute"
          style={[
            {
              top: -2,
              height: height + 4,
              width: 1,
              marginLeft: -0.5,
              backgroundColor: colors.textTertiary,
            },
            markerStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

export { ProgressBar };
export type { ProgressBarProps };
