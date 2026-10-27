import * as React from "react";

import { AppIcon } from "@studio/icons";
import { Card, Pressable, SectionHeader, Text } from "@studio/ui";
import { SankeyChart, type SankeyChartNode } from "@studio/charts/components";
import type { Insights } from "@/data/hooks";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { useTokens, withAlpha } from "@studio/theme";

import {
  flowShare,
  moneyFlow,
  type FlowCategory,
  type FlowNode,
  type MoneyFlow,
} from "./flow-model";

type FlowCardProps = {
  income: Insights;
  spending: Insights;
  currency: string;
  locale?: string;
  /** Opens a category's drill-down. */
  onOpenCategory: (id: string, kind: "income" | "expense") => void;
};

const rows = (insights: Insights): FlowCategory[] =>
  insights.categories.map((c) => ({
    categoryId: c.categoryId,
    name: c.category?.name ?? "Uncategorised",
    color: c.category?.color,
    amount: c.amount,
  }));

/** "Saved ₹1,02,196 · 70% of income" for the line under the chart. */
function summary(
  node: FlowNode | null,
  flow: MoneyFlow,
  money: (v: number) => string,
): string {
  if (node === null) {
    if (flow.income <= 0) return `Spent ${money(flow.spent)} with nothing earned`;
    if (flow.deficit > 0)
      return `Spent ${money(flow.deficit)} more than earned`;
    return `Kept ${money(flow.saved)} · ${Math.round((flow.saved * 100) / flow.income)}% of income`;
  }
  const share = flowShare(node, flow);
  if (node.column === 0) return `${node.name} · ${money(node.amount)} · ${share}% of income`;
  if (node.key === "saved")
    return `Saved ${money(node.amount)} · ${share}% of income`;
  return `${node.name} · ${money(node.amount)} · ${share}% of ${flow.income > 0 ? "income" : "spending"}`;
}

/**
 * "Money flow": where this period's income came from and where it went, as a three-column Sankey. Tapping a node picks
 * out its bands and names it below; a category node then opens its drill-down from that line.
 */
const FlowCard = React.memo(function FlowCard({
  income,
  spending,
  currency,
  locale,
  onOpenCategory,
}: FlowCardProps) {
  const { colors, category } = useTokens();
  const [selected, setSelected] = React.useState<string | null>(null);
  const flow = React.useMemo(
    () => moneyFlow(rows(income), rows(spending), { sources: 3, targets: 5 }),
    [income, spending],
  );
  const money = React.useCallback(
    (v: number) => formatMoney(v, currency, { locale, decimals: 0 }),
    [currency, locale],
  );
  const speech = React.useCallback(
    (v: number) => formatMoneyForSpeech(v, currency, { sign: "none", locale }),
    [currency, locale],
  );
  const colorOf = React.useCallback(
    (node: FlowNode): string => {
      switch (node.tone.type) {
        case "category":
          return category[node.tone.color];
        case "hub":
          return colors.textSecondary;
        case "saved":
          return colors.income;
        case "deficit":
          return withAlpha(colors.expense, 0.85);
        case "other":
          return category.gray;
      }
    },
    [category, colors],
  );
  const nodes = React.useMemo<SankeyChartNode[]>(
    () =>
      flow.nodes.map((node) => {
        const share = flowShare(node, flow);
        return {
          key: node.key,
          column: node.column,
          label: node.name,
          detail:
            node.column === 1
              ? money(node.amount)
              : `${money(node.amount)} · ${share}%`,
          detailShort: money(node.amount),
          color: colorOf(node),
          accessibilityLabel: `${node.name}, ${speech(node.amount)}, ${share} percent`,
        };
      }),
    [flow, money, speech, colorOf],
  );
  if (flow.nodes.length === 0) return null;
  const picked = flow.nodes.find((n) => n.key === selected) ?? null;
  const drill =
    picked && picked.categoryId !== null && picked.kind !== null
      ? { id: picked.categoryId, kind: picked.kind }
      : null;
  const line = summary(picked && picked.column !== 1 ? picked : null, flow, money);
  return (
    <>
      <SectionHeader title="Money flow" />
      <Card className="mx-4 px-4 pb-3 pt-3">
        <SankeyChart
          nodes={nodes}
          links={flow.links}
          selectedKey={selected}
          onSelect={setSelected}
          accessibilityLabel={`Money flow. Earned ${speech(flow.income)}, spent ${speech(flow.spent)}${flow.saved > 0 ? `, kept ${speech(flow.saved)}` : ""}`}
        />
        <Pressable
          role={drill ? "button" : undefined}
          disabled={!drill}
          scale={1}
          dimTo={0.6}
          accessibilityLabel={drill ? `${line}, open category` : line}
          onPress={() => drill && onOpenCategory(drill.id, drill.kind)}
          className="min-h-[36px] flex-row items-center border-t pt-2.5"
          style={{ borderTopColor: colors.separator, borderTopWidth: 0.5 }}
        >
          <Text
            variant="footnote"
            tone={picked ? "default" : "secondary"}
            numeric
            numberOfLines={1}
            className="flex-1"
          >
            {line}
          </Text>
          {drill ? (
            <AppIcon name="chevron.right" size={12} color={colors.textTertiary} />
          ) : null}
        </Pressable>
      </Card>
    </>
  );
});

export { FlowCard };
