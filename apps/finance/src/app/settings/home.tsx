import { ScrollView, View } from "react-native";

import { Button, ListGroup, ListRow, Pressable } from "@studio/ui";
import { useSetting } from "@/data/hooks";
import {
  DEFAULT_HOME_LAYOUT,
  HOME_SECTION_LABELS,
  isDefaultHomeLayout,
  moveHomeSection,
  setHomeSectionVisible,
  type HomeSectionId,
} from "@/lib/home/layout";
import { AppIcon } from "@studio/icons";
import { haptic, useTokens, type CategoryColorKey } from "@studio/theme";

const SECTION_ICONS: Record<
  HomeSectionId,
  { name: string; color: CategoryColorKey }
> = {
  quick_add: { name: "add", color: "purple" },
  stats: { name: "wallet", color: "purple" },
  pockets: { name: "savings", color: "purple" },
  coming_up: { name: "calendar", color: "purple" },
  heatmap: { name: "grid", color: "purple" },
  top_categories: { name: "tag", color: "purple" },
  recent: { name: "activity", color: "purple" },
};

function MoveButton({
  direction,
  disabled,
  label,
  onPress,
}: {
  direction: "up" | "down";
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTokens();
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      disabled={disabled}
      scale={0.88}
      hitSlop={4}
      onPress={onPress}
      className="h-8 w-8 items-center justify-center rounded-full bg-fill"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <AppIcon
        name={direction === "up" ? "chevron-up" : "chevron-down"}
        size={14}
        color={colors.textSecondary}
      />
    </Pressable>
  );
}

/** Reorder and hide the sections under the Home hero. */
export default function HomeLayoutSettings() {
  const [layout, setLayout] = useSetting("home_layout");
  const update = (next: typeof layout) => {
    haptic("selection");
    setLayout(next);
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 py-4 pb-12"
    >
      <ListGroup header="Sections">
        {layout.map((section, index) => {
          const label = HOME_SECTION_LABELS[section.id];
          return (
            <ListRow
              key={section.id}
              label={label}
              icon={SECTION_ICONS[section.id]}
              trailing={
                <View className="mr-3 flex-row gap-1.5">
                  <MoveButton
                    direction="up"
                    label={`Move ${label} up`}
                    disabled={index === 0}
                    onPress={() => update(moveHomeSection(layout, index, -1))}
                  />
                  <MoveButton
                    direction="down"
                    label={`Move ${label} down`}
                    disabled={index === layout.length - 1}
                    onPress={() => update(moveHomeSection(layout, index, 1))}
                  />
                </View>
              }
              switchValue={section.visible}
              onSwitchChange={(visible) =>
                update(setHomeSectionVisible(layout, section.id, visible))
              }
            />
          );
        })}
      </ListGroup>
      {isDefaultHomeLayout(layout) ? null : (
        <View className="items-center">
          <Button
            variant="plainText"
            size="sm"
            onPress={() => update(DEFAULT_HOME_LAYOUT.map((s) => ({ ...s })))}
          >
            Reset to default
          </Button>
        </View>
      )}
    </ScrollView>
  );
}
