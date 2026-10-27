import { NativeTabs } from "expo-router/unstable-native-tabs";

import { tabIcons } from "@/generated/tab-icons";
import { useIconPrefs } from "@studio/icons";
import { useTokens } from "@studio/theme";

const SF = {
  home: "house.fill",
  activity: "list.bullet.rectangle.fill",
  insights: "chart.bar.fill",
  budgets: "gauge.with.dots.needle.33percent",
} as const;
const MD = {
  home: "home",
  activity: "receipt_long",
  insights: "bar_chart",
  budgets: "speed",
} as const;
type TabId = keyof typeof SF;

/**
 * SF Symbols for the "SF Symbols" style; otherwise the tab concept rasterised in the chosen style (a template
 * image the tab bar tints). Called as a function, not rendered as a component: NativeTabs finds `Icon` among its
 * direct children.
 */
function tabIcon(style: string, id: TabId) {
  const image = tabIcons[style]?.[id];
  if (style === "sf" || image === undefined)
    return <NativeTabs.Trigger.Icon sf={SF[id]} md={MD[id]} />;
  return <NativeTabs.Trigger.Icon src={image} renderingMode="template" />;
}

export default function TabsLayout() {
  const { colors } = useTokens();
  const style = useIconPrefs((s) => s.style);
  return (
    <NativeTabs tintColor={colors.accent}>
      <NativeTabs.Trigger
        name="(home)"
        contentStyle={{ backgroundColor: colors.bg }}
      >
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        {tabIcon(style, "home")}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="activity"
        contentStyle={{ backgroundColor: colors.bg }}
      >
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        {tabIcon(style, "activity")}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="insights"
        contentStyle={{ backgroundColor: colors.bg }}
      >
        <NativeTabs.Trigger.Label>Insights</NativeTabs.Trigger.Label>
        {tabIcon(style, "insights")}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="budgets"
        contentStyle={{ backgroundColor: colors.bg }}
      >
        <NativeTabs.Trigger.Label>Budgets</NativeTabs.Trigger.Label>
        {tabIcon(style, "budgets")}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
