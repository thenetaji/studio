import { StyleSheet, View } from "react-native";

import { IconTile, ProgressBar, Pressable, Text } from "@studio/ui";
import { SwipeDelete } from "@/features/entry/swipe-delete";
import { pressScale, useTokens, withAlpha } from "@studio/theme";

import type { BudgetView } from "./model";
import { DueKey, PaceStatusLabel, paceColor } from "./pace-status";

type BudgetRowProps = {
  view: BudgetView;
  separator?: boolean;
  onPress: () => void;
  onDelete?: () => void;
};

const PERIOD_TAG = { weekly: "Weekly", monthly: "", yearly: "Yearly" } as const;

/** Budget row: tile, name and what is left, a pace-coloured bar, then the status, what is still due and the limit. */
function BudgetRow({
  view,
  separator = true,
  onPress,
  onDelete,
}: BudgetRowProps) {
  const { colors } = useTokens();
  const color = paceColor(view.status, colors);
  const tag = PERIOD_TAG[view.period];
  const row = (
    <Pressable
      role="button"
      accessibilityLabel={view.accessibilityLabel}
      accessibilityActions={
        onDelete ? [{ name: "delete", label: "Delete" }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "delete") onDelete?.();
      }}
      scale={pressScale.row}
      onPress={onPress}
      className="min-h-[64px] flex-row items-center bg-surface px-4 py-3"
    >
      <IconTile icon={view.icon} color={view.color} />
      <View className="ml-3 flex-1 gap-2">
        <View className="flex-row items-baseline justify-between gap-3">
          <View className="shrink flex-row items-baseline gap-1.5">
            <Text variant="body" numberOfLines={1} className="shrink">
              {view.name}
            </Text>
            {tag ? (
              <Text variant="footnote" tone="tertiary">
                {tag}
              </Text>
            ) : null}
          </View>
          <Text
            variant="subhead"
            tone={view.status === "over" ? "expense" : "default"}
            numeric
            numberOfLines={1}
            className="font-medium"
          >
            {view.headline}
          </Text>
        </View>
        <ProgressBar
          value={view.ratio}
          upcoming={view.upcomingRatio}
          color={color}
          fixedColor
          marker={view.marker}
        />
        <View className="flex-row items-center justify-between gap-3">
          <View className="shrink flex-row items-center gap-3">
            <PaceStatusLabel status={view.status} label={view.statusLabel} />
            {view.upcomingText ? (
              <DueKey text={view.upcomingText} color={withAlpha(color, 0.75)} />
            ) : null}
          </View>
          <Text variant="footnote" tone="tertiary" numeric numberOfLines={1}>
            {view.limitText}
          </Text>
        </View>
      </View>
      {separator ? (
        <View
          pointerEvents="none"
          style={{
            left: 64,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
          }}
          className="absolute bottom-0 right-0"
        />
      ) : null}
    </Pressable>
  );
  if (!onDelete) return row;
  return <SwipeDelete onDelete={onDelete}>{row}</SwipeDelete>;
}

export { BudgetRow };
