import { textWidth } from "../lib/text-width";
import {
  Group,
  RoundedRect,
  Text as SkText,
  type SkFont,
} from "@shopify/react-native-skia";
import * as React from "react";
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture } from "react-native-gesture-handler";
import { type LayoutChangeEvent } from "react-native";

import { clampLabelX, SELECTION_CLEAR_MS } from "../lib";
import { haptic, durations, useTokens } from "@studio/theme";
import { motion } from "@studio/motion";

/** Width of the container, measured once laid out. */
export function useChartWidth(): readonly [
  number,
  (event: LayoutChangeEvent) => void,
] {
  const [width, setWidth] = React.useState(0);
  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  }, []);
  return [width, onLayout] as const;
}

/** 0 -> 1 on first mount only (400 ms by default); already 1 under Reduce Motion. */
export function useGrow(
  duration: number = durations.countUp,
): SharedValue<number> {
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  React.useEffect(() => {
    if (!reduced)
      grow.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
  }, [grow, reduced, duration]);
  return grow;
}

type FloatingLabelProps = {
  text: string;
  font: SkFont;
  /** Anchor x the pill centres on. */
  centerX: number;
  /** Top of the pill. */
  y: number;
  totalWidth: number;
};

/** Keeps the pill this far inside the chart's left and right edges. */
const LABEL_MARGIN = 8;
/** How long the read-out stays after the last change before fading out. */
const LABEL_HOLD_MS = 1500;

/**
 * Inverted pill used for scrub read-outs. It shows only when the read-out changes (scrubbing or tapping a bar),
 * never for the initial selection, and fades out shortly after. Empty text hides it at once, so a caller that keeps
 * it mounted shows it again for the next selection. A label wider than the chart is scaled down to fit.
 */
export function FloatingLabel({
  text,
  font,
  centerX,
  y,
  totalWidth,
}: FloatingLabelProps) {
  const { colors } = useTokens();
  const reduced = useReducedMotion();
  const padX = 10;
  const height = 24;
  const width = textWidth(font, text) + padX * 2;
  const scale = Math.min(1, Math.max(0, totalWidth - LABEL_MARGIN * 2) / width);
  const target = clampLabelX(centerX, width * scale, totalWidth, LABEL_MARGIN);
  // The pill springs to each new bar instead of teleporting.
  const x = useSharedValue(target);
  React.useEffect(() => {
    x.value = reduced ? target : withSpring(target, motion.springs.toast);
  }, [target, reduced, x]);
  const opacity = useSharedValue(0);
  const shownText = React.useRef(text);
  React.useEffect(() => {
    if (shownText.current === text) return;
    shownText.current = text;
    if (text === "") {
      opacity.value = 0;
      return;
    }
    opacity.value = reduced
      ? withSequence(
          withTiming(1, { duration: 0 }),
          withDelay(LABEL_HOLD_MS, withTiming(0, { duration: 0 })),
        )
      : withSequence(
          withTiming(1, { duration: 120 }),
          withDelay(LABEL_HOLD_MS, withTiming(0, { duration: 250 })),
        );
  }, [text, reduced, opacity]);
  const transform = useDerivedValue(() => [
    { translateX: x.value },
    { translateY: y },
    { scale },
  ]);
  return (
    <Group opacity={opacity} transform={transform}>
      <RoundedRect
        x={0}
        y={0}
        width={width}
        height={height}
        r={8}
        color={colors.overlay}
      />
      <SkText
        x={padX}
        y={16.5}
        text={text}
        font={font}
        color={colors.overlayText}
      />
    </Group>
  );
}

type ScrubOptions = {
  /** Slot index (or nearest point) for an x position; -1 means outside the plot. */
  indexAt: (x: number) => number;
  selected: number | null;
  onSelect: (index: number | null) => void;
  /** y above which a tap counts as "elsewhere" (the label lane). Defaults to none. */
  minY?: number;
};

/** Pan scrubs and keeps the selection on release; tapping a bar selects it, tapping the selected bar or empty space clears. */
export function useScrubGesture({
  indexAt,
  selected,
  onSelect,
  minY = -Infinity,
}: ScrubOptions) {
  const pick = (x: number) => {
    const index = indexAt(x);
    if (index < 0 || index === selected) return;
    haptic("selection");
    onSelect(index);
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-8, 8])
    .failOffsetY([-16, 16])
    .onStart((event) => pick(event.x))
    .onUpdate((event) => pick(event.x));
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDuration(400)
    .onEnd((event, success) => {
      if (!success) return;
      const index = event.y < minY ? -1 : indexAt(event.x);
      if (index < 0 || index === selected) {
        if (selected !== null) onSelect(null);
        return;
      }
      haptic("selection");
      onSelect(index);
    });
  return Gesture.Race(pan, tap);
}

/** VoiceOver adjustable behaviour: swipe up/down steps through points. */
export function adjustableProps(
  count: number,
  selected: number | null,
  onSelect: (index: number | null) => void,
  valueText: string,
) {
  return {
    accessible: true,
    accessibilityRole: "adjustable" as const,
    accessibilityValue: { text: valueText },
    accessibilityActions: [
      { name: "increment" as const },
      { name: "decrement" as const },
    ],
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => {
      const step = event.nativeEvent.actionName === "increment" ? 1 : -1;
      const base = selected ?? (step === 1 ? -1 : count);
      onSelect(Math.min(count - 1, Math.max(0, base + step)));
    },
  };
}

/** Clears a selection once its floating label has faded; every new selection restarts the wait. */
export function useSelectionTimeout(
  selected: number | null,
  onSelect: (index: number | null) => void,
) {
  React.useEffect(() => {
    if (selected === null) return;
    const timer = setTimeout(() => onSelect(null), SELECTION_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [selected, onSelect]);
}
