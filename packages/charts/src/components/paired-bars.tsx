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

import { barDomain, slotIndex, valueToY, type AxisLabel } from "../lib";
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

export type PairedDatum = { key: string; a: number; b: number };

export type PairedBarsProps = {
  /** One entry per bucket (oldest first); `a` and `b` in minor units. */
  data: readonly PairedDatum[];
  currency: string;
  /** Labels under each pair. */
  labels: readonly AxisLabel[];
  /** Colour of the `a` bar (e.g. income); defaults to the income token. */
  colorA?: string;
  /** Colour of the `b` bar (e.g. spending); defaults to the accent. */
  colorB?: string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Floating read-out for a bucket. */
  formatLabel: (index: number) => string;
  accessibilityLabel: string;
  height?: number;
  locale?: string;
};

const LANE = 30;
const AXIS = 24;
const GUTTER = 44;
const RADIUS = 4;
const MIN_NUB = 2;
const PAIR_GAP = 2;

/** Two bars per bucket on one shared axis, scrubbable like BarChart and with the same outlier rule. */
function PairedBars({
  data,
  currency,
  labels,
  colorA,
  colorB,
  selectedIndex,
  onSelect,
  formatLabel,
  accessibilityLabel,
  height = 130,
  locale,
}: PairedBarsProps) {
  const { colors } = useTokens();
  const [width, onLayout] = useChartWidth();
  const font = useChartFont(11, "medium");
  const labelFont = useChartFont(12, "semibold");
  const grow = useGrow();

  const plotWidth = Math.max(0, width - GUTTER);
  const baseline = LANE + height;
  const count = data.length;
  const values = React.useMemo(() => data.flatMap((d) => [d.a, d.b]), [data]);
  const positive = values.filter((v) => v > 0);
  const average =
    positive.length === 0
      ? 0
      : positive.reduce((s, v) => s + v, 0) / positive.length;
  const hasData = positive.length > 0;
  const domain = barDomain(values, average, 3);
  const top = domain.top;
  const tintA = colorA ?? colors.income;
  const tintB = colorB ?? colors.accent;
  const slot = count > 0 ? plotWidth / count : 0;
  const barWidth = Math.max(2, Math.min(22, (slot - 14 - PAIR_GAP) / 2));
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
  const guides = hasData
    ? domain.ticks.map((t) => ({
        value: t,
        y: valueToY(t, top, baseline, height),
      }))
    : [];
  const selected =
    selectedIndex !== null && selectedIndex < count ? selectedIndex : null;
  useSelectionTimeout(selected, onSelect);
  const heldIndex = useHeld(selected);
  const spoken =
    selected === null
      ? accessibilityLabel
      : `${accessibilityLabel}. ${formatLabel(selected)}`;
  const center = (i: number) => slot * i + slot / 2;

  const bar = (
    value: number,
    x: number,
    tint: string,
    faded: boolean,
    key: string,
  ) => {
    if (value <= 0) return null;
    const h = Math.max(
      MIN_NUB + RADIUS,
      baseline - valueToY(value, top, baseline, height),
    );
    return (
      <RoundedRect
        key={key}
        x={x}
        y={baseline - h}
        width={barWidth}
        height={h + RADIUS}
        r={RADIUS}
        color={withAlpha(tint, faded ? 0.4 : 1)}
      />
    );
  };

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
              {guides.map((g) => (
                <Group key={g.y}>
                  <Line
                    p1={vec(0, g.y)}
                    p2={vec(plotWidth, g.y)}
                    color={colors.separator}
                    strokeWidth={StyleSheet.hairlineWidth}
                  />
                  {font && g.value > 0 ? (
                    <SkText
                      x={width - textWidth(font, compact(g.value))}
                      y={g.y + 4}
                      text={compact(g.value)}
                      font={font}
                      color={colors.textTertiary}
                    />
                  ) : null}
                </Group>
              ))}
              <Line
                p1={vec(0, baseline)}
                p2={vec(plotWidth, baseline)}
                color={colors.separator}
                strokeWidth={StyleSheet.hairlineWidth}
              />
              {hasData ? (
                <Group
                  clip={{ x: 0, y: 0, width: plotWidth, height: baseline }}
                >
                  <Group transform={growTransform}>
                    {data.map((d, i) => {
                      const faded = selected !== null && selected !== i;
                      const left = center(i) - barWidth - PAIR_GAP / 2;
                      return (
                        <Group key={d.key}>
                          {bar(d.a, left, tintA, faded, "a")}
                          {bar(
                            d.b,
                            left + barWidth + PAIR_GAP,
                            tintB,
                            faded,
                            "b",
                          )}
                        </Group>
                      );
                    })}
                  </Group>
                </Group>
              ) : null}
              {hasData && domain.clipped && font
                ? data.flatMap((d, i) =>
                    [d.a, d.b].map((value, j) => {
                      if (value <= top) return null;
                      const left =
                        center(i) -
                        barWidth -
                        PAIR_GAP / 2 +
                        j * (barWidth + PAIR_GAP);
                      const text = compact(value);
                      const w = textWidth(font, text);
                      const x = Math.min(
                        Math.max(left + barWidth / 2 - w / 2, 0),
                        width - w,
                      );
                      return (
                        <Group key={`break-${d.key}-${j}`}>
                          {[10, 17].map((dy) => (
                            <Line
                              key={dy}
                              p1={vec(left - 3, LANE + dy + 5)}
                              p2={vec(left + barWidth + 3, LANE + dy - 5)}
                              color={colors.surface}
                              strokeWidth={2.5}
                            />
                          ))}
                          {selected === i ? null : (
                            <SkText
                              x={x}
                              y={LANE - 5}
                              text={text}
                              font={font}
                              color={colors.textSecondary}
                            />
                          )}
                        </Group>
                      );
                    }),
                  )
                : null}
              {font
                ? labels.map((label) => {
                    const w = textWidth(font, label.text);
                    return (
                      <SkText
                        key={label.index}
                        x={center(label.index) - w / 2}
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
                  centerX={center(heldIndex)}
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

export { PairedBars };
