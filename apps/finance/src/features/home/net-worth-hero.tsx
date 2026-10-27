import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  AnimatedNumber,
  Card,
  Pressable,
  SymbolIcon,
  Text,
  type TextTone,
} from "@studio/ui";
import { useSetting } from "@/data/hooks";
import { haptic, useTokens } from "@studio/theme";

type NetWorthHeroProps = {
  /** Formatted net worth ("₹8,07,855", "−€10"); masked when amounts are hidden. */
  netWorth: string;
  /** When false the strip under the number is left out (empty install). */
  showStrip: boolean;
  /** Formatted spending this month. */
  spent: string;
  /** Formatted income this month. */
  earned: string;
  earnedZero: boolean;
  /** "in October". */
  caption: string;
};

/** Splits "₹8,07,855" into the symbol (drawn smaller) and the rolling digits. Suffix symbols stay with the digits. */
function splitSymbol(formatted: string): { symbol: string; digits: string } {
  const match = /^([−+-]?[^\d•]*)(.*)$/.exec(formatted);
  const symbol = match?.[1] ?? "";
  return symbol && match?.[2]
    ? { symbol, digits: match[2] }
    : { symbol: "", digits: formatted };
}

function Stat({
  label,
  value,
  caption,
  tone,
  divider,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: TextTone;
  divider?: boolean;
}) {
  const { colors } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}, ${caption}`}
      className="flex-1 px-4"
      style={
        divider
          ? {
              borderLeftWidth: StyleSheet.hairlineWidth * 2,
              borderLeftColor: colors.separator,
            }
          : null
      }
    >
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <AnimatedNumber
        value={value}
        variant="title2"
        tone={tone}
        fit
        align="left"
        intro
        className="mt-1 font-bold tracking-[-0.5px]"
      />
      <Text
        variant="caption"
        tone="tertiary"
        numeric
        numberOfLines={1}
        className="mt-0.5"
      >
        {caption}
      </Text>
    </View>
  );
}

/**
 * Net worth as the one big number (tap for Accounts, long-press to hide or show amounts), then a two-column strip:
 * what is left this month and what that allows per day.
 */
function NetWorthHero({
  netWorth,
  showStrip,
  spent,
  earned,
  earnedZero,
  caption,
}: NetWorthHeroProps) {
  const router = useRouter();
  const { colors } = useTokens();
  const [hidden, setHidden] = useSetting("hide_amounts");
  const { symbol, digits } = splitSymbol(netWorth);
  const toggle = () => {
    haptic("medium");
    setHidden(!hidden);
  };

  return (
    <View className="mt-2">
      <Pressable
        role="button"
        accessibilityLabel={`Net worth, ${netWorth}`}
        accessibilityHint="Opens accounts"
        accessibilityActions={[
          { name: "activate" },
          {
            name: "longpress",
            label: hidden ? "Show amounts" : "Hide amounts",
          },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "longpress") toggle();
          else router.push("/accounts");
        }}
        scale={0.99}
        onPress={() => router.push("/accounts")}
        onLongPress={toggle}
        delayLongPress={450}
      >
        <View className="min-h-[36px] flex-row items-center gap-1 self-start pr-2">
          <Text variant="subhead" tone="secondary" className="font-medium">
            Net worth
          </Text>
          <SymbolIcon
            name="chevron.right"
            size={11}
            color={colors.textTertiary}
            weight="bold"
          />
        </View>
        <View className="flex-row items-start" style={{ flexShrink: 1 }}>
          {symbol ? (
            <Text
              variant="display"
              className="mr-px text-[44px] font-semibold tracking-[-0.9px]"
              style={{ marginTop: 3 }}
            >
              {symbol}
            </Text>
          ) : null}
          <AnimatedNumber
            value={digits}
            variant="display"
            intro
            fit
            accessibilityLabel={netWorth}
          />
        </View>
      </Pressable>
      {showStrip ? (
        <Card className="mt-5 flex-row rounded-[20px] px-0 py-3.5">
          <Stat label="Spent" value={spent} caption={caption} />
          <Stat
            label="Earned"
            value={earned}
            caption={caption}
            tone={earnedZero ? "tertiary" : "income"}
            divider
          />
        </Card>
      ) : null}
    </View>
  );
}

export { NetWorthHero, splitSymbol };
