import * as React from "react";
import { View } from "react-native";

import { MASK } from "@studio/money";

import { withAlpha } from "@studio/theme";

import { useTweenedColor } from "../../lib/tint";
import { Pressable } from "../ui/pressable";
import { Text } from "../ui/text";
import { AnimatedNumber } from "./animated-number";
import { HIDDEN_LABEL, useAmountsHidden } from "./amount-privacy";

type AmountReadoutProps = {
  symbol: string;
  value: string;
  expression?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Hex colour of the entry's kind; the digits wear it, the symbol a muted version. Crossfades 200 ms on change. */
  color?: string;
};

function AmountReadout({
  symbol,
  value,
  expression,
  onPress,
  accessibilityLabel,
  color,
}: AmountReadoutProps) {
  const empty = value === "0" || value === "";
  // With Hide amounts on, a prefilled amount stays masked until the field is tapped or typed into.
  const hidden = useAmountsHidden();
  const [initial] = React.useState(value);
  const [tapped, setTapped] = React.useState(false);
  const masked = hidden && !empty && !tapped && value === initial;
  const tint = useTweenedColor(color ?? "#000000");
  return (
    <Pressable
      role="button"
      scale={0.98}
      disabled={!onPress}
      onPress={() => {
        setTapped(true);
        onPress?.();
      }}
      accessibilityLabel={
        masked ? HIDDEN_LABEL : (accessibilityLabel ?? `${symbol}${value}`)
      }
      className="h-[72px] items-center justify-end overflow-hidden px-4"
    >
      {expression && !masked ? (
        <Text
          variant="footnote"
          tone="secondary"
          numeric
          numberOfLines={1}
          className="absolute top-0"
        >
          {expression}
        </Text>
      ) : null}
      <View className="h-[52px] max-w-full flex-row items-center justify-center gap-1">
        <Text
          variant="title2"
          tone="secondary"
          style={color ? { color: withAlpha(tint, 0.6) } : undefined}
          numberOfLines={1}
        >
          {symbol}
        </Text>
        <AnimatedNumber
          value={masked ? MASK : value === "" ? "0" : value}
          variant="amountEntry"
          tone={empty ? "tertiary" : "default"}
          color={color ? (empty ? withAlpha(tint, 0.45) : tint) : undefined}
          align="left"
          dropNew
          fit
          className="min-w-0 shrink"
        />
      </View>
    </Pressable>
  );
}

export { AmountReadout };
export type { AmountReadoutProps };
