import { Image } from "expo-image";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { IconTile, ListGroup, ListRow, Pressable, Text } from "@studio/ui";
import { useSetting } from "@/data/hooks";
import {
  appIconSupported,
  currentAppIcon,
  setAppIcon,
  type AppIconName,
} from "@/lib/app-icon";
import { AppIcon, useIconPrefs } from "@studio/icons";
import {
  ICON_BACKGROUND_LABELS,
  ICON_BACKGROUNDS,
  ICON_STYLE_LABELS,
  ICON_STYLES,
  type IconBackground,
  type IconStyle,
} from "@studio/icons";
import { accentPresets, haptic, useTokens } from "@studio/theme";
import type { AccentPresetKey, CategoryColorKey } from "@studio/theme";

const options = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const ACCENTS: readonly { key: AccentPresetKey; label: string }[] = [
  { key: "brass", label: "Gold" },
  { key: "ivory", label: "Silver" },
  { key: "slate", label: "Slate" },
  { key: "sage", label: "Sage" },
  { key: "copper", label: "Copper" },
];

const APP_ICONS: readonly { name: AppIconName; label: string; source: number }[] =
  [
    {
      name: "default",
      label: "Bars",
      source: require("../../../assets/images/icon.png"),
    },
    {
      name: "Rupee",
      label: "Rupee",
      source: require("../../../assets/images/icon-rupee.png"),
    },
  ];

/** Sample concepts and colours shown in every preview. */
const SAMPLES: readonly { icon: string; color: CategoryColorKey }[] = [
  { icon: "food", color: "red" },
  { icon: "groceries", color: "green" },
  { icon: "car", color: "blue" },
  { icon: "shopping", color: "pink" },
  { icon: "health", color: "teal" },
  { icon: "entertainment", color: "purple" },
];

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      variant="footnote"
      tone="secondary"
      className="px-8 pb-2"
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

type OptionCardProps = {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
};

function OptionCard({
  label,
  detail,
  selected,
  onPress,
  children,
}: OptionCardProps) {
  const { colors } = useTokens();
  return (
    <Pressable
      role="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${detail}`}
      popWhen={selected}
      onPress={onPress}
      className="gap-3 rounded-[18px] bg-surface px-4 py-3.5"
      style={{
        borderWidth: 1.5,
        borderColor: selected ? colors.accent : colors.border,
      }}
    >
      <View className="flex-row items-center">
        <View className="flex-1">
          <Text variant="body">{label}</Text>
          <Text variant="subhead" tone="secondary">
            {detail}
          </Text>
        </View>
        {selected ? (
          <View className="h-6 w-6 items-center justify-center rounded-full bg-accent">
            <AppIcon name="check" size={13} color={colors.onAccent} />
          </View>
        ) : (
          <View
            className="h-6 w-6 rounded-full"
            style={{ borderWidth: 1.5, borderColor: colors.separator }}
          />
        )}
      </View>
      {children}
    </Pressable>
  );
}

export default function Appearance() {
  const { colors, category, scheme } = useTokens();
  const [theme, setTheme] = useSetting("theme");
  const [accent, setAccent] = useSetting("accent");
  const [appIcon, setAppIconState] = React.useState(currentAppIcon);
  const pickAppIcon = (next: AppIconName) => {
    if (next === appIcon || !appIconSupported) return;
    haptic("selection");
    setAppIconState(next);
    setAppIcon(next).catch(() => setAppIconState(currentAppIcon()));
  };
  const [style, setStyle] = useSetting("icon_style");
  const [background, setBackground] = useSetting("icon_background");
  const store = useIconPrefs();

  const pickStyle = (next: IconStyle) => {
    if (next === style) return;
    haptic("selection");
    store.setStyle(next);
    setStyle(next);
  };
  const pickBackground = (next: IconBackground) => {
    if (next === background) return;
    haptic("selection");
    store.setBackground(next);
    setBackground(next);
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 py-4 pb-12"
    >
      <View className="px-4">
        <View
          className="flex-row justify-between rounded-[22px] bg-surface px-5 py-6"
          style={{ borderWidth: 1, borderColor: colors.border }}
          accessibilityLabel="Icon preview"
        >
          {SAMPLES.map((sample) => (
            <IconTile
              key={sample.icon}
              icon={sample.icon}
              color={sample.color}
              size={42}
            />
          ))}
        </View>
      </View>

      <View>
        <SectionTitle>Theme</SectionTitle>
        <ListGroup>
          {options.map((option) => (
            <ListRow
              key={option.value}
              label={option.label}
              trailing={
                theme === option.value ? (
                  <AppIcon name="check" size={16} color={colors.accent} />
                ) : undefined
              }
              onPress={() => {
                haptic("selection");
                setTheme(option.value);
              }}
            />
          ))}
        </ListGroup>
      </View>

      <View>
        <SectionTitle>Accent</SectionTitle>
        <View
          className="mx-4 flex-row justify-around rounded-[18px] bg-surface px-3 py-4"
          style={{ borderWidth: 1, borderColor: colors.border }}
          accessibilityRole="radiogroup"
        >
          {ACCENTS.map(({ key, label }) => {
            const on = accent === key;
            const fill = accentPresets[key][scheme];
            return (
              <Pressable
                key={key}
                role="radio"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                popWhen={on}
                onPress={() => {
                  if (on) return;
                  haptic("selection");
                  setAccent(key);
                }}
                className="items-center gap-1.5"
              >
                <View
                  className="h-11 w-11 items-center justify-center rounded-full"
                  style={{
                    borderWidth: 2,
                    borderColor: on ? fill.accent : "transparent",
                  }}
                >
                  <View
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: fill.accent }}
                  >
                    {on ? (
                      <AppIcon name="check" size={14} color={fill.onAccent} />
                    ) : null}
                  </View>
                </View>
                <Text
                  variant="caption"
                  tone={on ? "default" : "secondary"}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <SectionTitle>App icon</SectionTitle>
        <View
          className="mx-4 flex-row gap-6 rounded-[18px] bg-surface px-5 py-4"
          style={{ borderWidth: 1, borderColor: colors.border }}
          accessibilityRole="radiogroup"
        >
          {APP_ICONS.map(({ name, label, source }) => {
            const on = appIcon === name;
            return (
              <Pressable
                key={name}
                role="radio"
                accessibilityLabel={`${label} app icon`}
                accessibilityState={{ selected: on }}
                popWhen={on}
                onPress={() => pickAppIcon(name)}
                className="items-center gap-2"
              >
                <View
                  className="rounded-[20px] p-[3px]"
                  style={{
                    borderWidth: 2,
                    borderColor: on ? colors.accent : "transparent",
                  }}
                >
                  <Image
                    source={source}
                    style={{ width: 64, height: 64, borderRadius: 15 }}
                  />
                </View>
                <Text variant="caption" tone={on ? "default" : "secondary"}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <SectionTitle>Icon style</SectionTitle>
        <View className="gap-2.5 px-4" accessibilityRole="radiogroup">
          {ICON_STYLES.map((value) => (
            <OptionCard
              key={value}
              label={ICON_STYLE_LABELS[value].label}
              detail={ICON_STYLE_LABELS[value].detail}
              selected={style === value}
              onPress={() => pickStyle(value)}
            >
              <View className="flex-row justify-between px-1">
                {SAMPLES.map((sample) => (
                  <AppIcon
                    key={sample.icon}
                    name={sample.icon}
                    size={26}
                    color={category[sample.color]}
                    iconStyle={value}
                  />
                ))}
              </View>
            </OptionCard>
          ))}
        </View>
      </View>

      <View>
        <SectionTitle>Icon background</SectionTitle>
        <View className="gap-2.5 px-4" accessibilityRole="radiogroup">
          {ICON_BACKGROUNDS.map((value) => (
            <OptionCard
              key={value}
              label={ICON_BACKGROUND_LABELS[value].label}
              detail={ICON_BACKGROUND_LABELS[value].detail}
              selected={background === value}
              onPress={() => pickBackground(value)}
            >
              <View className="flex-row justify-between px-1">
                {SAMPLES.slice(0, 4).map((sample) => (
                  <IconTile
                    key={sample.icon}
                    icon={sample.icon}
                    color={sample.color}
                    size={46}
                    background={value}
                  />
                ))}
              </View>
            </OptionCard>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
