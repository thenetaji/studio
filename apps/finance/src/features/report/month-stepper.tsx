import { View } from "react-native";

import { AppIcon } from "@studio/icons";
import { Pressable, Text } from "@studio/ui";
import { haptic, useTokens } from "@studio/theme";

function StepButton({
  symbol,
  label,
  disabled,
  onPress,
}: {
  symbol: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTokens();
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      scale={1}
      dimTo={0.6}
      hitSlop={6}
      onPress={() => {
        haptic("selection");
        onPress();
      }}
      className="h-11 w-11 items-center justify-center"
    >
      <AppIcon
        name={symbol}
        size={18}
        color={disabled ? colors.textTertiary : colors.accent}
      />
    </Pressable>
  );
}

type MonthStepperProps = {
  /** "October 2026". */
  label: string;
  canBack: boolean;
  canForward: boolean;
  onStep: (direction: 1 | -1) => void;
  /** Tapping the label returns to the current month; omitted when already there. */
  onJumpToCurrent?: () => void;
};

/** Analytics stepper (DESIGN-REVIEW C11): chevrons around a centred `headline` label. */
function MonthStepper({
  label,
  canBack,
  canForward,
  onStep,
  onJumpToCurrent,
}: MonthStepperProps) {
  return (
    <View className="flex-row items-center justify-between px-2">
      <StepButton
        symbol="chevron.left"
        label="Previous month"
        disabled={!canBack}
        onPress={() => onStep(-1)}
      />
      <Pressable
        role={onJumpToCurrent ? "button" : undefined}
        disabled={!onJumpToCurrent}
        scale={1}
        dimTo={0.6}
        onPress={() => {
          haptic("selection");
          onJumpToCurrent?.();
        }}
        accessibilityLabel={
          onJumpToCurrent ? `${label}, go to current month` : label
        }
        className="h-11 justify-center"
      >
        <Text variant="headline" numberOfLines={1} className="text-center">
          {label}
        </Text>
      </Pressable>
      <StepButton
        symbol="chevron.right"
        label="Next month"
        disabled={!canForward}
        onPress={() => onStep(1)}
      />
    </View>
  );
}

export { MonthStepper };
