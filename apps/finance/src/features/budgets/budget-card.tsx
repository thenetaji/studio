import { View } from "react-native";

import { Amount, ProgressBar, Card, Pressable, Text } from "@studio/ui";
import { pressScale, useTokens, withAlpha } from "@studio/theme";

import type { BudgetView } from "./model";
import { DueKey, PaceStatusLabel, paceColor } from "./pace-status";

type BudgetCardProps = {
  view: BudgetView;
  /** Title above the amount; defaults to "This month", or the month's name when not current. */
  title?: string;
  onPress?: () => void;
};

/** Progress card: period label and pace status, big amount left, bar with what is still due, spent and per-day line. */
function BudgetCard({ view, title, onPress }: BudgetCardProps) {
  const { colors } = useTokens();
  const color = paceColor(view.status, colors);
  const body = (
    <Card className="gap-3">
      <View className="gap-0.5">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="footnote" tone="secondary">
            {title ?? view.caption}
          </Text>
          <PaceStatusLabel status={view.status} label={view.statusLabel} />
        </View>
        <Amount
          value={view.headline}
          variant="hero"
          animate
          tone={view.status === "over" ? "expense" : "default"}
        />
      </View>
      <ProgressBar
        value={view.ratio}
        upcoming={view.upcomingRatio}
        color={color}
        fixedColor
        height={8}
        marker={view.marker}
        accessibilityLabel={view.accessibilityLabel}
      />
      <View className="gap-1">
        <View className="flex-row items-center justify-between gap-3">
          <Text
            variant="footnote"
            tone="secondary"
            numeric
            numberOfLines={1}
            className="shrink"
          >
            {view.detail}
          </Text>
          {view.upcomingText ? (
            <DueKey text={view.upcomingText} color={withAlpha(color, 0.75)} />
          ) : null}
        </View>
        {view.carriedText ? (
          <Text variant="footnote" tone="tertiary" numeric numberOfLines={1}>
            {view.carriedText}
          </Text>
        ) : null}
      </View>
    </Card>
  );
  if (!onPress) return body;
  return (
    <Pressable
      role="button"
      accessibilityLabel={view.accessibilityLabel}
      scale={pressScale.card}
      onPress={onPress}
    >
      {body}
    </Pressable>
  );
}

export { BudgetCard };
