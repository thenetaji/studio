import { View } from "react-native";

import { SymbolIcon, Text, type TextTone } from "@studio/ui";
import { useTokens } from "@studio/theme";
import type { PaceStatus } from "@/lib/budgets/pace";

type Colors = ReturnType<typeof useTokens>["colors"];

/** Bar colour for a pace status: the calm accent while on track, warning when projected over, expense once over. */
export function paceColor(status: PaceStatus, colors: Colors): string {
  if (status === "over") return colors.expense;
  if (status === "at_risk") return colors.warning;
  return colors.accent;
}

const ICON: Record<PaceStatus, string> = {
  on_track: "check-circle",
  at_risk: "arrow-up-right",
  over: "info",
};

const TONE: Record<PaceStatus, TextTone> = {
  on_track: "secondary",
  at_risk: "warning",
  over: "expense",
};

/** Icon plus label, so the status never rests on colour alone. */
export function PaceStatusLabel({
  status,
  label,
}: {
  status: PaceStatus;
  label: string;
}) {
  const { colors } = useTokens();
  const color =
    status === "over"
      ? colors.expense
      : status === "at_risk"
        ? colors.warning
        : colors.textTertiary;
  return (
    <View
      className="flex-row items-center gap-1"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SymbolIcon name={ICON[status]} size={13} color={color} />
      <Text
        variant="footnote"
        tone={TONE[status]}
        className={status === "on_track" ? "" : "font-semibold"}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** Key for the outlined segment: a small outlined capsule and "₹649 due". */
export function DueKey({ text, color }: { text: string; color: string }) {
  const { colors } = useTokens();
  return (
    <View
      className="flex-row items-center gap-1.5"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width: 12,
          height: 6,
          borderRadius: 3,
          borderWidth: 1,
          borderColor: color,
          backgroundColor: colors.fill,
        }}
      />
      <Text variant="footnote" tone="secondary" numeric numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
