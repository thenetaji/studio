import * as React from "react";
import { StyleSheet, View } from "react-native";

import { IconTile, Pressable, Text } from "@studio/ui";
import type { CategoryRow } from "@/db/schema";
import { formatMoney, formatMoneyForSpeech } from "@studio/money";
import { categoryKeys, useTokens, type CategoryColorKey } from "@studio/theme";

import type { Payee } from "./payees-model";

const asColor = (value: string | undefined): CategoryColorKey =>
  (categoryKeys as readonly string[]).includes(value ?? "")
    ? (value as CategoryColorKey)
    : "gray";

type PayeeRowProps = {
  payee: Payee;
  category: CategoryRow | null;
  currency: string;
  locale?: string;
  showDecimals: boolean;
  /** Largest amount in the list; the share bar is relative to it. */
  max: number;
  separator: boolean;
  onPress: () => void;
};

/** "Swiggy · 6 × avg ₹420" with a share bar under the name and the total trailing. */
const PayeeRow = React.memo(function PayeeRow({
  payee,
  category,
  currency,
  locale,
  showDecimals,
  max,
  separator,
  onPress,
}: PayeeRowProps) {
  const { colors, category: palette } = useTokens();
  const color = asColor(category?.color);
  const share = max > 0 ? payee.amount / max : 0;
  const average = formatMoney(payee.average, currency, {
    locale,
    decimals: 0,
  });
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${payee.title}, ${formatMoneyForSpeech(payee.amount, currency, { sign: "none", locale })}, ${payee.count} ${payee.count === 1 ? "time" : "times"}, average ${formatMoneyForSpeech(payee.average, currency, { sign: "none", locale })}`}
      onPress={onPress}
      scale={1}
      className="min-h-[62px] flex-row items-center bg-surface px-4 py-2.5 active:bg-fill"
    >
      <IconTile icon={category?.icon ?? "tag.fill"} color={color} />
      <View className="ml-3 min-w-0 flex-1">
        <Text variant="body" numberOfLines={1}>
          {payee.title}
        </Text>
        <View className="mt-1 flex-row items-center">
          <View
            className="h-1 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: colors.fill, maxWidth: 120 }}
          >
            <View
              style={{
                width: `${Math.max(share * 100, share > 0 ? 3 : 0)}%`,
                height: 4,
                borderRadius: 2,
                backgroundColor: palette[color],
              }}
            />
          </View>
        </View>
      </View>
      <View className="ml-4 items-end" style={{ minWidth: 84 }}>
        <Text variant="body" numeric numberOfLines={1} className="font-medium">
          {formatMoney(payee.amount, currency, {
            locale,
            decimals: showDecimals ? undefined : 0,
          })}
        </Text>
        <Text variant="footnote" tone="tertiary" numeric numberOfLines={1}>
          {payee.count === 1 ? "Once" : `${payee.count} × avg ${average}`}
        </Text>
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
});

export { PayeeRow };
