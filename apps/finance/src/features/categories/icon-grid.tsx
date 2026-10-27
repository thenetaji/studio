import * as React from "react";
import { View } from "react-native";

import { IconTile, Input, Pressable, Text } from "@studio/ui";
import { conceptFor, conceptLabel, tileRadius } from "@studio/icons";
import type { CategoryColorKey } from "@studio/theme";
import { useTokens } from "@studio/theme";

import { iconSections } from "./icons";

const SIZE = 46;
const RING = 3;

type IconCellProps = {
  id: string;
  selected: boolean;
  /** The category colour when selected, gray otherwise. */
  color: CategoryColorKey;
  ring: string;
  onChange: (icon: string) => void;
};

/**
 * One grid cell. Only the selected icon wears the category colour; the rest are neutral, which reads calmer
 * and means a colour change redraws one tile instead of the whole grid (cells are memoised).
 */
const IconCell = React.memo(function IconCell({
  id,
  selected,
  color,
  ring,
  onChange,
}: IconCellProps) {
  return (
    <View className="w-1/5 items-center pb-2">
      <Pressable
        role="button"
        accessibilityLabel={conceptLabel(id)}
        accessibilityState={{ selected }}
        haptic="selection"
        onPress={() => onChange(id)}
        className="items-center justify-center"
        style={{
          padding: RING,
          borderRadius: tileRadius(SIZE) + RING,
          borderWidth: 2,
          borderColor: selected ? ring : "transparent",
        }}
      >
        <IconTile icon={id} color={color} size={SIZE} />
      </Pressable>
    </View>
  );
});

type IconGridProps = {
  value: string;
  color: CategoryColorKey;
  onChange: (icon: string) => void;
};

/** Searchable, themed grid of every curated icon, drawn in the user's icon style and tile treatment. */
function IconGrid({ value, color, onChange }: IconGridProps) {
  const { colors } = useTokens();
  const [query, setQuery] = React.useState("");
  const [initial] = React.useState(value);
  const sections = React.useMemo(
    () => iconSections(query, initial),
    [query, initial],
  );
  const selected = conceptFor(value);
  return (
    <View className="gap-3">
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search icons"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel="Search icons"
      />
      {sections.length === 0 ? (
        <Text variant="callout" tone="secondary" className="py-6 text-center">
          No matches
        </Text>
      ) : (
        sections.map((section) => (
          <View key={section.title}>
            <Text
              variant="footnote"
              tone="secondary"
              className="pb-2 pt-1"
              accessibilityRole="header"
            >
              {section.title}
            </Text>
            <View className="-mx-1 flex-row flex-wrap">
              {section.ids.map((id) => (
                <IconCell
                  key={id}
                  id={id}
                  selected={id === selected}
                  color={id === selected ? color : "gray"}
                  ring={colors.accent}
                  onChange={onChange}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export { IconGrid };
