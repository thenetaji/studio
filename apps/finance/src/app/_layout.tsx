import "../global.css";

import { PortalHost } from "@rn-primitives/portal";
import { Stack, type NativeStackNavigationOptions } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import { openDatabaseAsync } from "expo-sqlite";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { headerChrome, ToastHost, Text } from "@studio/ui";
import { LockGate } from "@/features/lock/lock-gate";
import { useSetting, usePostDueRecurring, useReminderSync } from "@/data/hooks";
import { useIconPrefsSync } from "@/lib/icon-prefs-sync";
import { DemoSeedGate } from "@/lib/demo-seed-gate";
import { AmountsPrivacy } from "@/features/privacy/amounts-privacy";
import {
  setHapticsEnabled,
  applyThemePreference,
  followWebColorScheme,
  setAccent,
  useTokens,
} from "@studio/theme";

// expo-sqlite on web opens synchronously with a short busy-wait, so the worker must be live first.
const warmWorker =
  Platform.OS === "web" && typeof window !== "undefined"
    ? openDatabaseAsync(":memory:").then(() => undefined)
    : Promise.resolve();

type ProviderModule = typeof import("@/db/provider");
let loadedProvider: ProviderModule | null = null;
const providerListeners = new Set<() => void>();
void warmWorker
  .then(() => import("@/db/provider"))
  .then((module) => {
    loadedProvider = module;
    providerListeners.forEach((listener) => listener());
  });
const subscribeProvider = (listener: () => void) => {
  providerListeners.add(listener);
  return () => providerListeners.delete(listener);
};

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 200, fade: true });
followWebColorScheme();

export const unstable_settings = { anchor: "(tabs)" };

const subscribeNothing = () => () => undefined;

const sheet = (title: string): NativeStackNavigationOptions => ({
  title,
  presentation: "formSheet",
  headerShown: true,
  sheetAllowedDetents: [1],
  sheetGrabberVisible: true,
  sheetCornerRadius: 24,
});

/** Detent sheets stacked over the add/edit sheet; they draw their own header. */
const subSheet = (
  title: string,
  detents: number[],
): NativeStackNavigationOptions => ({
  title,
  presentation: "formSheet",
  headerShown: false,
  sheetAllowedDetents: detents,
  sheetGrabberVisible: true,
  sheetCornerRadius: 24,
});

const push = (title: string): NativeStackNavigationOptions => ({
  title,
  headerShown: true,
  headerBackButtonDisplayMode: "minimal",
});

function StartupError({ error }: { error: Error }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <View className="flex-1 items-center justify-center bg-bg px-6">
      <Text variant="callout" tone="secondary" className="text-center">
        {error.message}
      </Text>
    </View>
  );
}

function Database({ children }: { children: ReactNode }) {
  const module = useSyncExternalStore(
    subscribeProvider,
    () => loadedProvider,
    () => null,
  );
  if (!module) return null;
  const { DatabaseProvider } = module;
  return (
    <DatabaseProvider errorFallback={(error) => <StartupError error={error} />}>
      {children}
    </DatabaseProvider>
  );
}

function Navigator() {
  usePostDueRecurring();
  useReminderSync();
  useIconPrefsSync();
  const { colors } = useTokens();
  const [theme] = useSetting("theme");
  const [accent] = useSetting("accent");
  const [haptics] = useSetting("haptics");
  const [onboardingDone] = useSetting("onboarding_done");

  useEffect(() => {
    applyThemePreference(theme);
  }, [theme]);
  useEffect(() => {
    setAccent(accent);
  }, [accent]);
  useEffect(() => {
    setHapticsEnabled(haptics);
  }, [haptics]);
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        ...headerChrome(colors),
      }}
    >
      <Stack.Protected guard={!onboardingDone}>
        <Stack.Screen
          name="onboarding"
          options={{
            presentation: "fullScreenModal",
            gestureEnabled: false,
            animation: "fade",
          }}
        />
      </Stack.Protected>
      <Stack.Protected guard={onboardingDone}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="transaction/new"
          options={{ ...sheet("New transaction"), headerShown: false }}
        />
        <Stack.Screen
          name="transaction/category"
          options={subSheet("Category", [0.6, 1])}
        />
        <Stack.Screen
          name="transaction/date"
          options={subSheet("Date", [0.6])}
        />
        <Stack.Screen
          name="transaction/repeat"
          options={subSheet("Repeat", [0.45])}
        />
        <Stack.Screen
          name="transaction/person"
          options={subSheet("Person", [0.6, 1])}
        />
        <Stack.Screen
          name="transaction/tags"
          options={subSheet("Tags", [0.6, 1])}
        />
        <Stack.Screen
          name="transaction/receipt"
          options={{
            presentation: "fullScreenModal",
            animation: "fade",
            headerShown: false,
            contentStyle: { backgroundColor: "#000000" },
          }}
        />
        <Stack.Screen name="people/index" options={push("People")} />
        <Stack.Screen name="people/[id]/index" options={push("Person")} />
        <Stack.Screen
          name="people/[id]/settle"
          options={{ ...sheet("Settle up"), headerShown: false }}
        />
        <Stack.Screen name="tags/index" options={push("Tags")} />
        <Stack.Screen name="tags/[id]" options={push("Tag")} />
        <Stack.Screen
          name="transaction/[id]/index"
          options={push("Transaction")}
        />
        <Stack.Screen
          name="transaction/[id]/edit"
          options={{ ...sheet("Edit transaction"), headerShown: false }}
        />
        <Stack.Screen name="category/[id]" options={push("Category")} />
        <Stack.Screen name="categories/[id]" options={sheet("Category")} />
        <Stack.Screen name="payees" options={push("Payees")} />
        <Stack.Screen name="payee" options={push("Payee")} />
        <Stack.Screen name="insights-more" options={push("More insights")} />
        <Stack.Screen name="budget/new" options={sheet("New budget")} />
        <Stack.Screen
          name="budget/categories"
          options={subSheet("Categories", [0.6, 1])}
        />
        <Stack.Screen name="budget/[id]/index" options={push("Budget")} />
        <Stack.Screen name="budget/[id]/edit" options={sheet("Edit budget")} />
        <Stack.Screen name="subscriptions" options={push("Subscriptions")} />
        <Stack.Screen name="recurring/index" options={push("Recurring")} />
        <Stack.Screen name="recurring/[id]" options={sheet("Edit rule")} />
        <Stack.Screen name="accounts/index" options={push("Accounts")} />
        <Stack.Screen name="accounts/new" options={sheet("New account")} />
        <Stack.Screen name="accounts/[id]/index" options={push("Account")} />
        <Stack.Screen
          name="accounts/[id]/edit"
          options={sheet("Edit account")}
        />
        <Stack.Screen name="search" options={sheet("Search")} />
        <Stack.Screen name="insights-range" options={sheet("Custom range")} />
        <Stack.Screen
          name="activity-filters"
          options={{
            ...sheet("Filters"),
            sheetAllowedDetents: [0.6, 1],
            sheetInitialDetentIndex: 0,
            sheetExpandsWhenScrolledToEdge: true,
          }}
        />
        <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Screen name="dev/gallery" />
    </Stack>
  );
}

export default function RootLayout() {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => Platform.OS !== "web",
  );
  if (!mounted) return null;
  return (
    <GestureHandlerRootView className="flex-1 bg-bg">
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Database>
          <DemoSeedGate>
            <AmountsPrivacy>
              <Navigator />
            </AmountsPrivacy>
            <LockGate />
          </DemoSeedGate>
        </Database>
        <PortalHost />
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
