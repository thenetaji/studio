import { textWidth } from "../lib/text-width";
import {
  Canvas,
  Group,
  Line,
  Rect,
  RoundedRect,
  Text as SkText,
  vec,
} from "@shopify/react-native-skia";
import * as React from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue } from "react-native-reanimated";

import {
  barSlots,
  niceTicks,
  slotIndex,
  valueToY,
  type AxisLabel,
} from "../lib";
import { formatMoney } from "@studio/money";
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

export type StackedDatum = {
  key: string;
  /** One value per series, bottom first, in minor units. */
  values: readonly number[];
};

export type StackedBarsProps = {
  /** One entry per bucket, oldest first. */
  data: readonly StackedDatum[];
  /** Colour per series, bottom first; same length as each datum's values. */
  colors: readonly string[];
  currency: string;
  labels: readonly AxisLabel[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  formatLabel: (index: number) => string;
  accessibilityLabel: string;
  /** Series to emphasise (the others fade), e.g. from a legend tap. */
  highlight?: number | null;
  height?: number;
  locale?: string;
};

const LANE = 30;
const AXIS = 24;
const GUTTER = 44;
const RADIUS = 4;
/** Hairline between stacked segments. */
const SEAM = 1;

/** One bar per bucket split into coloured series, scrubbable like BarChart. */
function StackedBars({
  data,
  colors: seriesColors,
  currency,
  labels,
  selectedIndex,
  onSelect,
  formatLabel,
  accessibilityLabel,
  highlight = null,
  height = 150,
  locale,
}: StackedBarsProps) {
  const { colors } = useTokens();
  const [width, onLayout] = useChartWidth();
  const font = useChartFont(11, "medium");
  const labelFont = useChartFont(12, "semibold");
  const grow = useGrow();

  const plotWidth = Math.max(0, width - GUTTER);
  const baseline = LANE + height;
  const count = data.length;
  const totals = React.useMemo(
    () => data.map((d) => d.values.reduce((s, v) => s + Math.max(0, v), 0)),
    [data],
  );
  const max = totals.reduce((m, v) => Math.max(m, v), 0);
  const { top, ticks } = niceTicks(max, 3);
  const slots = barSlots(0, plotWidth, count, 10, 26);
  const growTransform = useDerivedValue(() => [
    { translateY: baseline },
    { scaleY: grow.value },
    { translateY: -baseline },
  ]);

  const gesture = useScrubGesture({
    indexAt: (x) => (x > plotWidth ? -1 : slotIndex(x, 0, plotWidth, count)),
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
  const spoken =
    selected === null
      ? accessibilityLabel
      : `${accessibilityLabel}. ${formatLabel(selected)}`;

  return (
    <View
      onLayout={onLayout}
      style={{ height: LANE + height + AXIS }}
      accessibilityLabel={accessibilityLabel}
      {...adjustableProps(count, selectedIndex, onSelect, spoken)}
    >
      {width > 0 ? (
        <GestureDetector gesture={gesture}>
          <View collapsable={false}>
            <Canvas style={{ width, height: LANE + height + AXIS }}>
              {ticks.map((t) => {
                const y = valueToY(t, top, baseline, height);
                return (
                  <Group key={t}>
                    <Line
                      p1={vec(0, y)}
                      p2={vec(plotWidth, y)}
                      color={colors.separator}
                      strokeWidth={StyleSheet.hairlineWidth}
                    />
                    {font ? (
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
              })}
              <Line
                p1={vec(0, baseline)}
                p2={vec(plotWidth, baseline)}
                color={colors.separator}
                strokeWidth={StyleSheet.hairlineWidth}
              />
              {max > 0 ? (
                <Group transform={growTransform}>
                  {data.map((d, i) => {
                    const slot = slots[i];
                    if (!slot) return null;
                    const total = totals[i] ?? 0;
                    if (total <= 0) return null;
                    const barTop = valueToY(total, top, baseline, height);
                    const faded = selected !== null && selected !== i;
                    let y = baseline;
                    return (
                      <Group
                        key={d.key}
                        clip={{
                          rect: {
                            x: slot.x,
                            y: barTop,
                            width: slot.width,
                            height: baseline - barTop + RADIUS,
                          },
                          rx: RADIUS,
                          ry: RADIUS,
                        }}
                      >
                        {d.values.map((value, j) => {
                          if (value <= 0) return null;
                          const h =
                            baseline - valueToY(value, top, baseline, height);
                          y -= h;
                          const dim =
                            faded || (highlight !== null && highlight !== j);
                          return (
                            <Rect
                              key={j}
                              x={slot.x}
                              y={y + (j === 0 ? 0 : SEAM / 2)}
                              width={slot.width}
                              height={Math.max(0, h - (j === 0 ? 0 : SEAM / 2))}
                              color={withAlpha(
                                seriesColors[j] ?? colors.textTertiary,
                                dim ? 0.3 : 1,
                              )}
                            />
                          );
                        })}
                      </Group>
                    );
                  })}
                </Group>
              ) : null}
              {selected !== null && slots[selected] ? (
                <RoundedRect
                  x={slots[selected]!.x - 3}
                  y={LANE}
                  width={slots[selected]!.width + 6}
                  height={height}
                  r={RADIUS + 2}
                  color={withAlpha(colors.text, 0.04)}
                />
              ) : null}
              {font
                ? labels.map((label) => {
                    const slot = slots[label.index];
                    if (!slot) return null;
                    const w = textWidth(font, label.text);
                    return (
                      <SkText
                        key={label.index}
                        x={Math.min(
                          Math.max(slot.center - w / 2, 0),
                          plotWidth - w,
                        )}
                        y={baseline + 17}
                        text={label.text}
                        font={font}
                        color={
                          selected === label.index
                            ? colors.text
                            : colors.textTertiary
                        }
                      />
                    );
                  })
                : null}
              {labelFont ? (
                <FloatingLabel
                  text={selected !== null ? formatLabel(selected) : ""}
                  font={labelFont}
                  centerX={slots[heldIndex]?.center ?? 0}
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

export { StackedBars };
