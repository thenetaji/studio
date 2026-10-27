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
import { GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue } from "react-native-reanimated";

import { barDomain, barSlots, slotIndex, valueToY } from "../lib";
import { withAlpha, useTokens } from "@studio/theme";
import {
  adjustableProps,
  useChartWidth,
  useGrow,
  useScrubGesture,
} from "./chart-kit";
import { useChartFont } from "./use-chart-font";

export type MiniBarDatum = { key: string; label: string; value: number };

export type MiniBarsProps = {
  /** Oldest first; typically 6 entries. */
  data: readonly MiniBarDatum[];
  /** The period that is "now" (highlighted when nothing else is selected). */
  currentIndex: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Amount for a bar, e.g. "₹12,400"; used for VoiceOver and the label on broken bars. */
  formatValue: (index: number) => string;
  /** Mean per bucket, minor units; feeds the shared axis rule. */
  average?: number;
  color?: string;
  accessibilityLabel: string;
  height?: number;
};

const LANE = 30;
const AXIS = 24;
const RADIUS = 6;

/** Six-period bars for the category drill-down. Scrubbing and tapping both select a period. */
function MiniBars({
  data,
  currentIndex,
  selectedIndex,
  onSelect,
  formatValue,
  average = 0,
  color,
  accessibilityLabel,
  height = 110,
}: MiniBarsProps) {
  const { colors } = useTokens();
  const [width, onLayout] = useChartWidth();
  const font = useChartFont(11, "medium");
  const labelFont = useChartFont(12, "semibold");
  const grow = useGrow();
  const count = data.length;
  const baseline = LANE + height;
  const { top, clipped } = barDomain(
    data.map((d) => d.value),
    average,
  );
  const slots = React.useMemo(
    () => barSlots(0, width, count, 14, 44),
    [width, count],
  );
  const tint = color ?? colors.accent;
  const growTransform = useDerivedValue(() => [
    { translateY: baseline },
    { scaleY: grow.value },
    { translateY: -baseline },
  ]);

  const gesture = useScrubGesture({
    indexAt: (x) => slotIndex(x, 0, width, count),
    selected: selectedIndex,
    // Tapping the selected bar again keeps it: a period is always selected.
    onSelect: (index) => {
      if (index !== null) onSelect(index);
    },
  });

  return (
    <View
      onLayout={onLayout}
      style={{ height: LANE + height + AXIS }}
      accessibilityLabel={accessibilityLabel}
      {...adjustableProps(
        count,
        selectedIndex,
        (i) => i !== null && onSelect(i),
        `${data[selectedIndex]?.label ?? ""}, ${formatValue(selectedIndex)}`,
      )}
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
              <Group clip={{ x: 0, y: 0, width, height: baseline }}>
                <Group transform={growTransform}>
                  {data.map((d, i) => {
                    const slot = slots[i];
                    if (!slot) return null;
                    const h =
                      d.value > 0 && top > 0
                        ? Math.max(
                            6,
                            baseline - valueToY(d.value, top, baseline, height),
                          )
                        : 3;
                    const active = i === selectedIndex;
                    return (
                      <RoundedRect
                        key={d.key}
                        x={slot.x}
                        y={baseline - h}
                        width={slot.width}
                        height={h + RADIUS}
                        r={RADIUS}
                        color={
                          d.value === 0
                            ? colors.fill
                            : active
                              ? tint
                              : withAlpha(tint, i === currentIndex ? 0.7 : 0.4)
                        }
                      />
                    );
                  })}
                </Group>
              </Group>
              {font
                ? data.map((d, i) => {
                    const slot = slots[i];
                    if (!slot) return null;
                    const f = font;
                    return (
                      <SkText
                        key={d.key}
                        x={slot.center - textWidth(f, d.label) / 2}
                        y={baseline + 17}
                        text={d.label}
                        font={f}
                        color={
                          i === selectedIndex
                            ? colors.text
                            : colors.textTertiary
                        }
                      />
                    );
                  })
                : null}
              {clipped && labelFont
                ? data.map((d, i) => {
                    const slot = slots[i];
                    if (!slot || d.value <= top) return null;
                    const text = formatValue(i);
                    const w = textWidth(labelFont, text);
                    const x = Math.min(
                      Math.max(slot.center - w / 2, 0),
                      width - w,
                    );
                    return (
                      <Group key={`break-${d.key}`}>
                        {[10, 17].map((dy) => (
                          <Line
                            key={dy}
                            p1={vec(slot.x - 3, LANE + dy + 5)}
                            p2={vec(slot.x + slot.width + 3, LANE + dy - 5)}
                            color={colors.surface}
                            strokeWidth={2.5}
                          />
                        ))}
                        <SkText
                          x={x}
                          y={LANE - 5}
                          text={text}
                          font={labelFont}
                          color={colors.textSecondary}
                        />
                      </Group>
                    );
                  })
                : null}
            </Canvas>
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

export { MiniBars };
