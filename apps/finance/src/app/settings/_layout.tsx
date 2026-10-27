import { Stack, useRouter } from "expo-router";

import { headerChrome, barRight, Button } from "@studio/ui";
import { useTokens } from "@studio/theme";

/** Deep links into Settings (e.g. Manage from the category picker) keep the Settings list beneath, so Back and Done work. */
export const unstable_settings = { initialRouteName: "index" };

export default function SettingsLayout() {
  const router = useRouter();
  const { colors } = useTokens();
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        ...headerChrome(colors),
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Settings",
          headerBackVisible: false,
          ...barRight(
            <Button
              variant="barPrimary"
              size="sm"
              onPress={() => router.dismiss()}
            >
              Done
            </Button>,
          ),
        }}
      />
      <Stack.Screen name="appearance" options={{ title: "Appearance" }} />
      <Stack.Screen name="home" options={{ title: "Home" }} />
      <Stack.Screen name="currency" options={{ title: "Display currency" }} />
      <Stack.Screen name="lock" options={{ title: "Face ID" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
      <Stack.Screen name="reminders" options={{ title: "Reminders" }} />
      <Stack.Screen name="backup" options={{ title: "Backup & sync" }} />
      <Stack.Screen name="categories/index" options={{ title: "Categories" }} />
      <Stack.Screen name="transfer" options={{ title: "Import & export" }} />
      <Stack.Screen name="import-preview" options={{ title: "Preview" }} />
      <Stack.Screen name="about" options={{ title: "About" }} />
    </Stack>
  );
}
