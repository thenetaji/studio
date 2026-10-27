import {
  Canvas,
  Group,
  Path,
  RoundedRect,
  Skia,
  Text as SkText,
  type SkFont,
} from "@shopify/react-native-skia";
import * as React from "react";
import { Pressable, View } from "react-native";
import { useDerivedValue } from "react-native-reanimated";

import {
  linkOutline,
  sankeyLayout,
  spreadLabels,
  type SankeyLink,
  type SankeyNode,
} from "../lib";
import { haptic, useTokens, withAlpha } from "@studio/theme";
import { motion } from "@studio/motion";
import { useChartWidth, useGrow } from "./chart-kit";
import { useChartFont } from "./use-chart-font";

export type SankeyChartNode = {
  key: string;
  /** 0 = leftmost. */
  column: number;
  /** First label line (the name). */
  label: string;
  /** Second label line, e.g. "₹33,200 · 23%". */
  detail: string;
  /** Shorter second line used when `detail` does not fit, e.g. "₹33,200". */
  detailShort?: string;
  /** Node and band colour. */
  color: string;
  accessibilityLabel: string;
};

export type SankeyChartProps = {
  nodes: readonly SankeyChartNode[];
  links: readonly { source: string; target: string; value: number }[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  accessibilityLabel: string;
  /** Plot height; defaults to enough room for the busiest column's labels. */
  height?: number;
  /** x of the middle column as a share of the width (three-column flows). */
  hubAt?: number;
};

const NODE_WIDTH = 7;
const NODE_GAP = 28;
const LABEL_GAP = 9;
const LABEL_BLOCK = 30;
/** Room above the middle node for its two-line label. */
const HUB_LABEL = 36;
const PAD = 6;

type Placed = {
  node: SankeyNode;
  datum: SankeyChartNode;
  /** Label block centre after collision spreading. */
  labelY: number;
  align: "left" | "right" | "center";
};

/** Truncates `text` with an ellipsis so it fits `max` pt in `font`. */
function fit(text: string, font: SkFont, max: number): string {
  if (font.getTextWidth(text) <= max) return text;
  let out = text;
  while (out.length > 1 && font.getTextWidth(`${out}…`) > max)
    out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

function bandPath(link: SankeyLink) {
  const o = linkOutline(link, 0.5);
  const b = Skia.PathBuilder.Make();
  b.moveTo(o.move[0], o.move[1]);
  b.cubicTo(...o.top);
  b.lineTo(o.down[0], o.down[1]);
  b.cubicTo(...o.bottom);
  b.close();
  return b.build();
}

/** Label text drawn with a surface-coloured halo so it stays legible over the translucent bands. */
function HaloText({
  x,
  y,
  text,
  font,
  color,
  halo,
}: {
  x: number;
  y: number;
  text: string;
  font: SkFont;
  color: string;
  halo: string;
}) {
  return (
    <Group>
      <SkText
        x={x}
        y={y}
        text={text}
        font={font}
        color={halo}
        style="stroke"
        strokeWidth={3}
        strokeJoin="round"
      />
      <SkText x={x} y={y} text={text} font={font} color={color} />
    </Group>
  );
}

/**
 * Layered money flow: thin rounded nodes, translucent bands in each node's colour, and direct two-line labels
 * (name, amount) beside every outer node and above the middle one. Tapping a node (or its label) picks out its bands;
 * tapping it again, or the middle node, clears.
 */
function SankeyChart({
  nodes,
  links,
  selectedKey,
  onSelect,
  accessibilityLabel,
  height: heightProp,
  hubAt = 0.36,
}: SankeyChartProps) {
  const { colors, isDark } = useTokens();
  const [width, onLayout] = useChartWidth();
  const nameFont = useChartFont(12, "semibold");
  const detailFont = useChartFont(12, "regular");
  const grow = useGrow(motion.durations.draw);

  const columns = nodes.reduce((m, n) => Math.max(m, n.column + 1), 0);
  const busiest = Math.max(
    1,
    ...Array.from(
      { length: columns },
      (_, c) => nodes.filter((n) => n.column === c).length,
    ),
  );
  const plotHeight = heightProp ?? Math.max(220, busiest * (LABEL_BLOCK + 12));

  const layout = React.useMemo(() => {
    if (width <= 0) return null;
    const columnX =
      columns === 3
        ? [0, Math.round((width - NODE_WIDTH) * hubAt), width - NODE_WIDTH]
        : undefined;
    return sankeyLayout(
      nodes.map((n) => ({ key: n.key, column: n.column })),
      links,
      {
        width,
        height: plotHeight,
        nodeWidth: NODE_WIDTH,
        nodeGap: NODE_GAP,
        minNodeHeight: 3,
        columnX,
      },
    );
  }, [nodes, links, width, plotHeight, columns, hubAt]);

  // Only as much top room as the middle node's label needs above it.
  const hubTop =
    layout?.nodes.find((n) => n.column > 0 && n.column < columns - 1)?.y0 ??
    HUB_LABEL;
  const TOP_LANE = Math.max(6, HUB_LABEL - hubTop);
  const total = TOP_LANE + plotHeight + PAD;

  const placed = React.useMemo<Placed[]>(() => {
    if (!layout) return [];
    const byKey = new Map(nodes.map((n) => [n.key, n]));
    const out: Placed[] = [];
    for (let c = 0; c < columns; c++) {
      const col = layout.nodes.filter((n) => n.column === c);
      const align: Placed["align"] =
        c === 0 ? "left" : c === columns - 1 ? "right" : "center";
      const ys =
        align === "center"
          ? col.map(() => 0)
          : spreadLabels(
              col.map((n) => (n.y0 + n.y1) / 2),
              LABEL_BLOCK,
              LABEL_BLOCK / 2,
              plotHeight - LABEL_BLOCK / 2,
            );
      col.forEach((node, i) => {
        const datum = byKey.get(node.key);
        if (datum) out.push({ node, datum, labelY: ys[i]!, align });
      });
    }
    return out;
  }, [layout, nodes, columns, plotHeight]);

  const paths = React.useMemo(
    () =>
      (layout?.links ?? []).map((link) => ({ link, path: bandPath(link) })),
    [layout],
  );

  const colorOf = React.useMemo(
    () => new Map(nodes.map((n) => [n.key, n.color])),
    [nodes],
  );
  const middle = (placed.find((p) => p.align === "center")?.node.key ??
    null) as string | null;
  const selected =
    selectedKey !== null &&
    selectedKey !== middle &&
    placed.some((p) => p.node.key === selectedKey)
      ? selectedKey
      : null;
  const connected = React.useMemo(() => {
    if (selected === null) return null;
    const set = new Set<string>([selected]);
    for (const l of layout?.links ?? []) {
      if (l.source === selected) set.add(l.target);
      if (l.target === selected) set.add(l.source);
    }
    return set;
  }, [selected, layout]);

  const reveal = useDerivedValue(() => ({
    x: 0,
    y: 0,
    width: Math.max(0, width * grow.value),
    height: total,
  }));
  const bandAlpha = isDark ? 0.3 : 0.24;
  // Left labels sit between the source nodes and the hub; right labels between the hub and the target nodes.
  const hub = layout?.nodes.find((n) => n.column === 1);
  const leftLabelWidth = Math.max(
    60,
    (hub?.x0 ?? width / 3) - NODE_WIDTH - LABEL_GAP * 2,
  );
  const rightLabelWidth = Math.max(
    60,
    width - NODE_WIDTH - LABEL_GAP * 2 - (hub?.x1 ?? width / 3) - 4,
  );

  const press = (key: string) => {
    haptic("selection");
    onSelect(key === selected || key === middle ? null : key);
  };

  return (
    <View
      onLayout={onLayout}
      style={{ height: total }}
      accessibilityLabel={accessibilityLabel}
      accessible={false}
    >
      {layout && layout.nodes.length > 0 ? (
        <>
          <Canvas style={{ width, height: total }}>
            <Group transform={[{ translateY: TOP_LANE }]}>
              <Group clip={reveal}>
                {paths.map(({ link, path }) => {
                  const own =
                    link.source === middle ? link.target : link.source;
                  const lit =
                    link.source === selected || link.target === selected;
                  return (
                    <Path
                      key={`${link.source}>${link.target}`}
                      path={path}
                      color={withAlpha(
                        colorOf.get(own) ?? colors.textTertiary,
                        connected === null
                          ? bandAlpha
                          : lit
                            ? Math.min(0.62, bandAlpha * 2.2)
                            : 0.07,
                      )}
                    />
                  );
                })}
              </Group>
              {placed.map(({ node, datum }) => {
                const dim = connected !== null && !connected.has(node.key);
                return (
                  <RoundedRect
                    key={node.key}
                    x={node.x0}
                    y={node.y0}
                    width={node.x1 - node.x0}
                    height={node.y1 - node.y0}
                    r={Math.min(3.5, (node.y1 - node.y0) / 2)}
                    color={withAlpha(datum.color, dim ? 0.3 : 1)}
                  />
                );
              })}
              {nameFont && detailFont
                ? placed.map(({ node, datum, labelY, align }) => {
                    const dim = connected !== null && !connected.has(node.key);
                    const nameColor = dim ? colors.textTertiary : colors.text;
                    const detailColor = dim
                      ? colors.textTertiary
                      : colors.textSecondary;
                    if (align === "center") {
                      const name = datum.label;
                      const detail = datum.detail;
                      const cx = (node.x0 + node.x1) / 2;
                      const nw = nameFont.getTextWidth(name);
                      const dw = detailFont.getTextWidth(detail);
                      const clampX = (w: number) =>
                        Math.min(Math.max(cx - w / 2, 0), width - w);
                      return (
                        <Group key={`l-${node.key}`}>
                          <SkText
                            x={clampX(nw)}
                            y={node.y0 - 22}
                            text={name}
                            font={nameFont}
                            color={nameColor}
                          />
                          <SkText
                            x={clampX(dw)}
                            y={node.y0 - 7}
                            text={detail}
                            font={detailFont}
                            color={detailColor}
                          />
                        </Group>
                      );
                    }
                    const room =
                      align === "left" ? leftLabelWidth : rightLabelWidth;
                    const name = fit(datum.label, nameFont, room);
                    const detail = fit(
                      datum.detailShort &&
                        detailFont.getTextWidth(datum.detail) > room
                        ? datum.detailShort
                        : datum.detail,
                      detailFont,
                      room,
                    );
                    const xOf = (w: number) =>
                      align === "left"
                        ? node.x1 + LABEL_GAP
                        : node.x0 - LABEL_GAP - w;
                    return (
                      <Group key={`l-${node.key}`}>
                        <HaloText
                          x={xOf(nameFont.getTextWidth(name))}
                          y={labelY - 2}
                          text={name}
                          font={nameFont}
                          color={nameColor}
                          halo={colors.surface}
                        />
                        <HaloText
                          x={xOf(detailFont.getTextWidth(detail))}
                          y={labelY + 13}
                          text={detail}
                          font={detailFont}
                          color={detailColor}
                          halo={colors.surface}
                        />
                      </Group>
                    );
                  })
                : null}
            </Group>
          </Canvas>
          {placed.map(({ node, datum, labelY, align }) => {
            // One generous hit box per node: the node plus its label block.
            const top =
              align === "center"
                ? 0
                : TOP_LANE + Math.min(node.y0, labelY - LABEL_BLOCK / 2) - 4;
            const bottom =
              align === "center"
                ? TOP_LANE + node.y1
                : TOP_LANE + Math.max(node.y1, labelY + LABEL_BLOCK / 2) + 4;
            const left =
              align === "left"
                ? 0
                : align === "right"
                  ? node.x0 - LABEL_GAP - rightLabelWidth
                  : node.x0 - 12;
            const right =
              align === "left"
                ? node.x1 + LABEL_GAP + leftLabelWidth
                : align === "right"
                  ? width
                  : node.x1 + 12;
            return (
              <Pressable
                key={`hit-${node.key}`}
                role="button"
                accessibilityLabel={datum.accessibilityLabel}
                accessibilityState={{ selected: node.key === selected }}
                onPress={() => press(node.key)}
                style={{
                  position: "absolute",
                  left,
                  top,
                  width: right - left,
                  height: Math.max(44, bottom - top),
                }}
              />
            );
          })}
        </>
      ) : null}
    </View>
  );
}

export { SankeyChart };
