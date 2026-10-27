import {
  Canvas,
  Circle,
  LinearGradient,
  Path,
  Skia,
  vec,
  type SkPath,
} from "@shopify/react-native-skia";
import * as React from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Pressable, Text } from "@studio/ui";
import { donutSegments, hitTestDonut } from "../lib";
import { motion } from "@studio/motion";
import { haptic, useTokens } from "@studio/theme";
import { useGrow } from "./chart-kit";

export type DonutDatum = {
  key: string;
  /** Used for the centre label, the legend and the accessibility label. */
  name: string;
  /** Minor units, drives the segment size. */
  value: number;
  /** Pre-formatted amount for the centre label. */
  amountLabel: string;
  /** Share, e.g. "34%". */
  percentLabel: string;
  color: string;
};

export type DonutProps = {
  data: readonly DonutDatum[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  accessibilityLabel: string;
  /** Empty ring text, when there is no data. */
  emptyLabel?: string;
  size?: number;
};

const STROKE = 30;
/** How far the selected segment grows outward and inward. */
const POP = 5;
/** Visible gap between neighbouring segments, in points at the ring's mid radius. */
const GAP_PT = 2;
const SWEEP_MS = 700;

/** Mixes `#RRGGBB` toward white (`amount` > 0) or black (< 0). */
function shade(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const ch = (i: number) =>
    Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - t) + target * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}
const DIM = 0.3;

type SegmentProps = {
  path: SkPath;
  color: string;
  startDeg: number;
  sweepDeg: number;
  selected: boolean;
  dimmed: boolean;
  grow: ReturnType<typeof useGrow>;
  /** Canvas size; set with `metallic` so the sheen spans the whole ring. */
  size: number;
  /** Polished-metal sheen: light falls from the top left across every segment. */
  metallic: boolean;
};

function Segment({
  path,
  color,
  startDeg,
  sweepDeg,
  selected,
  dimmed,
  grow,
  size,
  metallic,
}: SegmentProps) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(0);
  const dim = useSharedValue(0);
  React.useEffect(() => {
    pop.value = reduced
      ? selected
        ? 1
        : 0
      : withSpring(selected ? 1 : 0, motion.springs.pop);
    dim.value = reduced
      ? dimmed
        ? 1
        : 0
      : withTiming(dimmed ? 1 : 0, { duration: 200 });
  }, [selected, dimmed, reduced, pop, dim]);
  // Reveal clockwise: each segment's trim end follows the global sweep angle.
  const end = useDerivedValue(() => {
    if (sweepDeg <= 0) return 0;
    const visibleDeg = grow.value * 360 - (startDeg + 90);
    return Math.min(1, Math.max(0, visibleDeg / sweepDeg));
  });
  const strokeWidth = useDerivedValue(() => STROKE + POP * 2 * pop.value);
  const opacity = useDerivedValue(() => 1 - (1 - DIM) * dim.value);
  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={strokeWidth}
      color={color}
      opacity={opacity}
      start={0}
      end={end}
    >
      {metallic ? (
        <LinearGradient
          start={vec(0, 0)}
          end={vec(size, size)}
          colors={[shade(color, 0.28), color, shade(color, -0.32)]}
          positions={[0, 0.5, 1]}
        />
      ) : null}
    </Path>
  );
}

function Donut({
  data,
  selectedKey,
  onSelect,
  accessibilityLabel,
  emptyLabel,
  size = 216,
}: DonutProps) {
  const { colors, isDark, categoryMode } = useTokens();
  const metallic = isDark && categoryMode === "mono";
  const grow = useGrow(SWEEP_MS);
  const reduced = useReducedMotion();
  // Period change: same ring sweeps in again. Selection changes do not touch `signature`.
  const signature = data.map((d) => `${d.key}:${d.value}`).join("|");
  const seen = React.useRef(signature);
  React.useEffect(() => {
    if (seen.current === signature) return;
    seen.current = signature;
    if (reduced) return;
    grow.set(0.02);
    grow.set(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [signature, reduced, grow]);
  const half = size / 2;
  const outer = half - POP;
  const radius = outer - STROKE / 2;
  const inner = radius - STROKE / 2;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const gapDeg = ((GAP_PT / radius) * 180) / Math.PI;
  const segments = React.useMemo(
    () =>
      donutSegments(
        data.map((d) => d.value),
        gapDeg,
      ),
    [data, gapDeg],
  );
  const selectedIndex =
    selectedKey === null ? -1 : data.findIndex((d) => d.key === selectedKey);
  const selected = selectedIndex >= 0 ? data[selectedIndex] : undefined;
  // Nothing selected: the centre names the biggest category.
  const leader = React.useMemo(
    () =>
      data.reduce<DonutDatum | undefined>(
        (best, d) => (!best || d.value > best.value ? d : best),
        undefined,
      ),
    [data],
  );
  const shown = selected ?? (total > 0 ? leader : undefined);

  const paths = React.useMemo(
    () =>
      segments.map((segment) => {
        const builder = Skia.PathBuilder.Make();
        if (segment.sweep > 0)
          builder.addArc(
            {
              x: half - radius,
              y: half - radius,
              width: radius * 2,
              height: radius * 2,
            },
            segment.start,
            segment.sweep,
          );
        return builder.build();
      }),
    [segments, radius, half],
  );

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event, success) => {
      if (!success) return;
      const hit = hitTestDonut(
        event.x,
        event.y,
        half,
        half,
        inner,
        outer,
        segments,
      );
      const next = hit >= 0 ? data[hit]?.key : undefined;
      if (next === undefined || next === selectedKey) {
        if (selectedKey !== null) onSelect(null);
        return;
      }
      haptic("selection");
      onSelect(next);
    });

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={accessibilityLabel}
      accessible={data.length === 0}
    >
      <GestureDetector gesture={tap}>
        <View collapsable={false}>
          <Canvas style={{ width: size, height: size }}>
            {total === 0 ? (
              <Circle
                cx={half}
                cy={half}
                r={radius}
                style="stroke"
                strokeWidth={StyleSheet.hairlineWidth * 2}
                color={colors.separator}
              />
            ) : (
              data.map((d, i) => (
                <Segment
                  key={d.key}
                  path={paths[i]!}
                  color={d.color}
                  startDeg={segments[i]!.start}
                  sweepDeg={segments[i]!.sweep}
                  selected={i === selectedIndex}
                  dimmed={selectedIndex >= 0 && i !== selectedIndex}
                  grow={grow}
                  size={size}
                  metallic={metallic}
                />
              ))
            )}
          </Canvas>
        </View>
      </GestureDetector>
      <View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center"
        style={{ paddingHorizontal: STROKE + POP + 8 }}
      >
        {shown ? (
          <Animated.View
            key={shown.key}
            entering={reduced ? undefined : FadeIn.duration(180)}
            className="items-center"
          >
            <Text
              variant="footnote"
              tone="secondary"
              numberOfLines={1}
              className="text-center"
            >
              {shown.name}
            </Text>
            <Text
              variant="title1"
              numeric
              numberOfLines={1}
              style={{
                color: categoryMode === "mono" ? colors.text : shown.color,
              }}
            >
              {shown.percentLabel}
            </Text>
            <Text
              variant="subhead"
              numeric
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              className="text-center"
            >
              {shown.amountLabel}
            </Text>
          </Animated.View>
        ) : emptyLabel ? (
          <Text variant="footnote" tone="tertiary">
            {emptyLabel}
          </Text>
        ) : null}
      </View>
      {data.map((d, i) => {
        const segment = segments[i];
        if (!segment || segment.sweep <= 0) return null;
        const rad = (segment.mid * Math.PI) / 180;
        const cx = half + Math.cos(rad) * radius;
        const cy = half + Math.sin(rad) * radius;
        return (
          <View
            key={d.key}
            pointerEvents="none"
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${d.name}, ${d.amountLabel}, ${d.percentLabel}`}
            accessibilityState={{ selected: d.key === selectedKey }}
            accessibilityActions={[{ name: "activate" }]}
            onAccessibilityAction={() =>
              onSelect(d.key === selectedKey ? null : d.key)
            }
            style={{
              position: "absolute",
              left: cx - 22,
              top: cy - 22,
              width: 44,
              height: 44,
            }}
          />
        );
      })}
    </View>
  );
}

type DonutLegendProps = {
  data: readonly DonutDatum[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
};

/** Two-column legend under the ring: colour dot, name, then share and amount. Tapping selects like the ring does. */
function DonutLegend({ data, selectedKey, onSelect }: DonutLegendProps) {
  const rows: DonutDatum[][] = [];
  for (let i = 0; i < data.length; i += 2) rows.push(data.slice(i, i + 2));
  return (
    <View className="w-full gap-1 pt-3">
      {rows.map((pair) => (
        <View key={pair[0]!.key} className="flex-row gap-2">
          {[0, 1].map((slot) => {
            const d = pair[slot];
            if (!d) return <View key={slot} className="flex-1" />;
            const selected = d.key === selectedKey;
            return (
              <Pressable
                key={d.key}
                role="button"
                accessibilityLabel={`${d.name}, ${d.amountLabel}, ${d.percentLabel}`}
                accessibilityState={{ selected }}
                scale={0.97}
                popWhen={selected}
                onPress={() => {
                  haptic("selection");
                  onSelect(selected ? null : d.key);
                }}
                className="min-w-0 flex-1 rounded-[10px] px-2 py-1.5"
                style={{
                  opacity: selectedKey !== null && !selected ? 0.45 : 1,
                }}
              >
                <View className="flex-row items-center">
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: d.color,
                    }}
                  />
                  <Text
                    variant="subhead"
                    numberOfLines={1}
                    className="ml-2 min-w-0 flex-1 font-medium"
                  >
                    {d.name}
                  </Text>
                </View>
                <Text
                  variant="footnote"
                  tone="secondary"
                  numeric
                  numberOfLines={1}
                  className="ml-[18px]"
                >
                  {`${d.percentLabel} · ${d.amountLabel}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export { Donut, DonutLegend };
