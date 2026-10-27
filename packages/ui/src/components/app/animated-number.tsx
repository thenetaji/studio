import * as React from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  FadeInUp,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import { Text, type TextTone } from "../ui/text";
import { HIDDEN_LABEL, isMaskedText } from "./amount-privacy";
import { typeScale, type TypeVariant } from "@studio/theme";

import {
  introDelay,
  splitNumber,
  type Align,
  type NumberToken,
} from "@studio/motion";
import { motion } from "@studio/motion";

type AnimatedNumberProps = {
  /** The already-formatted amount ("−₹1,24,500.00"); only the digits roll. */
  value: string;
  variant?: TypeVariant;
  tone?: TextTone;
  /** Explicit colour; wins over `tone`. */
  color?: string;
  /** Roll up from zero on first appearance. */
  intro?: boolean;
  /** `left` for typing (appended digit adds a column), `right` for values that change period. */
  align?: Align;
  /** New columns drop in from above with a tiny spring (amount entry). */
  dropNew?: boolean;
  /** Shrink to fit the available width instead of overflowing (hero amounts). */
  fit?: boolean;
  accessibilityLabel?: string;
  className?: string;
  /** Right-aligns or centres the row inside its container. */
  justify?: "start" | "center" | "end";
};

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

type ColumnProps = {
  digit: number;
  variant: TypeVariant;
  tone?: TextTone;
  color?: string;
  intro: boolean;
  delay: number;
  reduced: boolean;
  drop: boolean;
};

const DigitColumn = React.memo(function DigitColumn({
  digit,
  variant,
  tone,
  color,
  intro,
  delay,
  reduced,
  drop,
}: ColumnProps) {
  const [line, setLine] = React.useState<number>(typeScale[variant].line);
  const lineSv = useSharedValue<number>(typeScale[variant].line);
  const position = useSharedValue(intro && !reduced ? 0 : digit);

  React.useEffect(() => {
    if (reduced) {
      position.value = digit;
      return;
    }
    position.value = withDelay(
      intro ? delay : 0,
      withSpring(digit, motion.springs.roll),
    );
    // `intro` and `delay` only matter for the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit, reduced, position]);

  const onLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const h = event.nativeEvent.layout.height;
      if (h > 0 && Math.abs(h - lineSv.get()) > 0.5) {
        lineSv.set(h);
        setLine(h);
      }
    },
    [lineSv],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -position.value * lineSv.value }],
  }));
  const entering = drop
    ? FadeInUp.springify()
        .damping(motion.springs.drop.damping)
        .stiffness(motion.springs.drop.stiffness)
        .withInitialValues({
          opacity: 0,
          transform: [{ translateY: -line * 0.6 }],
        })
        .reduceMotion(ReduceMotion.System)
    : undefined;

  return (
    <Animated.View
      entering={entering}
      style={{ height: line, overflow: "hidden" }}
    >
      <Animated.View style={style}>
        {DIGITS.map((d) => (
          <Text
            key={d}
            variant={variant}
            tone={tone}
            style={color ? { color } : undefined}
            numeric
            numberOfLines={1}
            onLayout={d === 0 ? onLayout : undefined}
          >
            {d}
          </Text>
        ))}
      </Animated.View>
    </Animated.View>
  );
});

function useFit(enabled: boolean): {
  scale: SharedValue<number>;
  shift: SharedValue<number>;
  onOuter: (e: LayoutChangeEvent) => void;
  onInner: (e: LayoutChangeEvent) => void;
} {
  const outer = React.useRef(0);
  const inner = React.useRef(0);
  const scale = useSharedValue(1);
  const shift = useSharedValue(0);
  const update = React.useCallback(() => {
    if (!enabled || outer.current <= 0 || inner.current <= 0) return;
    const s = Math.max(0.5, Math.min(1, outer.current / inner.current));
    scale.set(s);
    // Scale grows from the centre: slide back so the left edge stays put.
    shift.set(-(inner.current * (1 - s)) / 2);
  }, [enabled, scale, shift]);
  const onOuter = React.useCallback(
    (e: LayoutChangeEvent) => {
      outer.current = e.nativeEvent.layout.width;
      update();
    },
    [update],
  );
  const onInner = React.useCallback(
    (e: LayoutChangeEvent) => {
      inner.current = e.nativeEvent.layout.width;
      update();
    },
    [update],
  );
  return { scale, shift, onOuter, onInner };
}

/**
 * Odometer amount. Each digit column springs vertically to its new value on the UI thread; the
 * currency symbol, separators and sign are static glyphs that never move. Use for heroes and key
 * figures, not for every row of a long list.
 */
function AnimatedNumber({
  value,
  variant = "body",
  tone,
  color,
  intro = false,
  align = "right",
  dropNew = false,
  fit = false,
  accessibilityLabel,
  className,
  justify = "start",
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const tokens = React.useMemo(() => splitNumber(value, align), [value, align]);
  const { scale, shift, onOuter, onInner } = useFit(fit);
  const fitStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }, { scale: scale.value }],
  }));
  // Columns present on the first render never "drop"; only ones added later do.
  const [initialKeys] = React.useState(() => new Set(tokens.map((t) => t.key)));
  const digitOrder = new Map<string, number>();
  tokens
    .filter((t) => t.kind === "digit")
    .forEach((t, i) => digitOrder.set(t.key, i));
  const alignSelf =
    justify === "center"
      ? "center"
      : justify === "end"
        ? "flex-end"
        : "flex-start";

  return (
    <View
      onLayout={onOuter}
      accessible
      accessibilityLabel={
        isMaskedText(value) ? HIDDEN_LABEL : (accessibilityLabel ?? value)
      }
      importantForAccessibility="yes"
      className={className}
      style={{ overflow: fit ? "hidden" : "visible", flexShrink: 1 }}
    >
      <Animated.View
        onLayout={onInner}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          {
            flexDirection: "row",
            alignItems: "flex-start",
            alignSelf,
            flexShrink: 0,
          },
          fit ? fitStyle : null,
        ]}
      >
        {tokens.map((token: NumberToken) =>
          token.kind === "digit" ? (
            <DigitColumn
              key={token.key}
              digit={token.digit}
              variant={variant}
              tone={tone}
              color={color}
              intro={intro}
              delay={introDelay(digitOrder.get(token.key) ?? 0)}
              reduced={reduced}
              drop={dropNew && !initialKeys.has(token.key)}
            />
          ) : (
            <Text
              key={token.key}
              variant={variant}
              tone={tone}
              style={color ? { color } : undefined}
              numeric
              numberOfLines={1}
            >
              {token.char}
            </Text>
          ),
        )}
      </Animated.View>
    </View>
  );
}

export { AnimatedNumber };
export type { AnimatedNumberProps };
