import * as React from "react";
import { StyleSheet, View } from "react-native";

import { AppIcon } from "@studio/icons";
import { IconTile, Pressable, Text } from "@studio/ui";
import type { CategoryRow as CategoryData } from "@/db/schema";
import { pressScale, type CategoryColorKey } from "@studio/theme";
import { useTokens } from "@studio/theme";

export const CATEGORY_ROW_HEIGHT = 60;

type CategoryRowProps = {
  category: CategoryData;
  /** Transactions in the category (split lines included). */
  count: number;
  separator?: boolean;
  onPress: () => void;
  /** The drag handle in edit mode; a chevron otherwise. */
  trailing?: React.ReactNode;
};

const countLabel = (count: number) =>
  count === 0
    ? "No transactions"
    : `${count} ${count === 1 ? "transaction" : "transactions"}`;

/** Icon tile, name, then group and transaction count; the separator is inset past the tile. */
function CategoryRow({
  category,
  count,
  separator = true,
  onPress,
  trailing,
}: CategoryRowProps) {
  const { colors } = useTokens();
  const detail = [category.groupName, countLabel(count)]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${category.name}, ${detail}`}
      scale={pressScale.row}
      onPress={onPress}
      className="flex-row items-center bg-surface pl-4"
      style={{ height: CATEGORY_ROW_HEIGHT }}
    >
      <IconTile
        icon={category.icon}
        color={category.color as CategoryColorKey}
      />
      <View className="ml-3 min-w-0 flex-1 justify-center">
        <Text variant="body" numberOfLines={1}>
          {category.name}
        </Text>
        <Text variant="footnote" tone="secondary" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {trailing ?? (
        <View className="h-11 w-10 items-center justify-center">
          <AppIcon name="chevron.right" size={13} color={colors.textTertiary} />
        </View>
      )}
      {separator ? (
        <View
          pointerEvents="none"
          style={{
            left: 66,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
          }}
          className="absolute bottom-0 right-0"
        />
      ) : null}
    </Pressable>
  );
}

export { CategoryRow };
