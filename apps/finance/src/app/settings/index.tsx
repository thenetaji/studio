import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import {
  Card,
  ListGroup,
  ListRow,
  OptionPicker,
  Pressable,
  Text,
  type Option,
} from "@studio/ui";
import { useAccounts, useEntryCount, useSetting } from "@/data/hooks";
import { AppIcon } from "@studio/icons";
import { pressScale, useTokens } from "@studio/theme";
import { ordinal } from "@/features/budgets/logic";
import { moneyLocale } from "@/features/transactions/use-money-context";
import { formatMoney } from "@studio/money";
import Constants from "expo-constants";
import { APP_NAME } from "@/constants/app";
import { isDefaultHomeLayout } from "@/lib/home/layout";

type Picker = "week" | "month" | "account" | null;

const weekOptions: readonly Option<1 | 7>[] = [
  { value: 1, label: "Monday" },
  { value: 7, label: "Sunday" },
];

const monthOptions: readonly Option<number>[] = Array.from(
  { length: 28 },
  (_, i) => ({ value: i + 1, label: ordinal(i + 1) }),
);

const THEME_LABELS = { system: "Auto", light: "Light", dark: "Dark" };
const PALETTE_LABELS = {
  system: "System",
  titanium: "Titanium",
  paper: "Paper",
};

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The card at the top, like the account card in iOS Settings: what the app holds, at a glance. */
function SummaryCard({ onPress }: { onPress: () => void }) {
  const { colors } = useTokens();
  const accounts = useAccounts();
  const entries = useEntryCount();
  const detail = [
    plural(entries, "entry", "entries"),
    plural(accounts.length, "account", "accounts"),
  ].join(" · ");
  return (
    <View className="px-4">
      <Pressable
        role="button"
        accessibilityLabel={`${APP_NAME}, ${detail}`}
        scale={pressScale.row}
        onPress={onPress}
      >
        <Card className="flex-row items-center gap-4 px-4 py-4">
          <Image
            source={require("../../../assets/images/icon.png")}
            style={{
              width: 60,
              height: 60,
              borderRadius: 14,
            }}
            accessibilityIgnoresInvertColors
          />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="headline">{APP_NAME}</Text>
            <Text variant="footnote" tone="secondary" numberOfLines={2}>
              {detail}
            </Text>
            <Text variant="footnote" tone="tertiary">
              On this iPhone only
            </Text>
          </View>
          <AppIcon name="chevron.right" size={13} color={colors.textTertiary} />
        </Card>
      </Pressable>
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const accounts = useAccounts();
  const [displayCurrency] = useSetting("display_currency");
  const [weekStart, setWeekStart] = useSetting("week_start");
  const [monthStart, setMonthStart] = useSetting("month_start");
  const [defaultAccountId, setDefaultAccountId] =
    useSetting("default_account_id");
  const [theme] = useSetting("theme");
  const [palette] = useSetting("palette");
  const [haptics, setHaptics] = useSetting("haptics");
  const [showDecimals, setShowDecimals] = useSetting("show_decimals");
  const [lockEnabled] = useSetting("lock_enabled");
  const [hideAmounts] = useSetting("hide_amounts");
  const [homeLayout] = useSetting("home_layout");
  const homeSummary = isDefaultHomeLayout(homeLayout) ? "Default" : "Custom";
  const [picker, setPicker] = React.useState<Picker>(null);
  const close = () => setPicker(null);
  const defaultAccount = accounts.find((a) => a.id === defaultAccountId);
  const accountOptions = React.useMemo<readonly Option<string | null>[]>(
    () => accounts.map((a) => ({ value: a.id, label: a.name })),
    [accounts],
  );
  const privacy = [lockEnabled && "Face ID", hideAmounts && "Hidden"]
    .filter(Boolean)
    .join(", ");

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-7 py-4 pb-12"
    >
      <SummaryCard onPress={() => router.push("/settings/about")} />

      <ListGroup header="Money">
        <ListRow
          label="Accounts"
          icon={{ name: "building.columns.fill", color: "blue" }}
          value={accounts.length > 0 ? String(accounts.length) : undefined}
          chevron
          onPress={() => router.push("/accounts")}
        />
        <ListRow
          label="Categories"
          icon={{ name: "tag.fill", color: "orange" }}
          chevron
          onPress={() => router.push("/settings/categories")}
        />
        <ListRow
          label="Recurring"
          icon={{ name: "repeat", color: "green" }}
          chevron
          onPress={() => router.push("/recurring")}
        />
        <ListRow
          label="Subscriptions"
          icon={{ name: "subscriptions", color: "pink" }}
          chevron
          onPress={() => router.push("/subscriptions")}
        />
        <ListRow
          label="Tags"
          icon={{ name: "tag", color: "indigo" }}
          chevron
          onPress={() => router.push("/tags")}
        />
        <ListRow
          label="People"
          icon={{ name: "loans", color: "teal" }}
          chevron
          onPress={() => router.push("/people")}
        />
      </ListGroup>

      <ListGroup header="Preferences">
        <ListRow
          label="Currency"
          icon={{ name: "dollarsign.circle.fill", color: "green" }}
          value={displayCurrency}
          chevron
          onPress={() => router.push("/settings/currency")}
        />
        <ListRow
          label="Default account"
          icon={{ name: "wallet.pass.fill", color: "blue" }}
          value={defaultAccount?.name}
          chevron
          onPress={() => setPicker("account")}
        />
        <ListRow
          label="Week starts on"
          icon={{ name: "calendar", color: "red" }}
          value={weekStart === 7 ? "Sunday" : "Monday"}
          chevron
          onPress={() => setPicker("week")}
        />
        <ListRow
          label="Month starts on"
          icon={{ name: "calendar", color: "red" }}
          value={ordinal(monthStart)}
          chevron
          onPress={() => setPicker("month")}
        />
        <ListRow
          label="Show decimals"
          icon={{ name: "percent", color: "gray" }}
          value={formatMoney(124000, displayCurrency, {
            locale: moneyLocale(displayCurrency),
            decimals: showDecimals ? undefined : 0,
          })}
          switchValue={showDecimals}
          onSwitchChange={setShowDecimals}
        />
      </ListGroup>

      <ListGroup header="Appearance">
        <ListRow
          label="Appearance"
          icon={{ name: "paintbrush.fill", color: "purple" }}
          value={`${PALETTE_LABELS[palette]} · ${THEME_LABELS[theme]}`}
          chevron
          onPress={() => router.push("/settings/appearance")}
        />
        <ListRow
          label="Home screen"
          icon={{ name: "home", color: "indigo" }}
          value={homeSummary}
          chevron
          onPress={() => router.push("/settings/home")}
        />
        <ListRow
          label="Haptics"
          icon={{ name: "iphone", color: "gray" }}
          switchValue={haptics}
          onSwitchChange={setHaptics}
        />
      </ListGroup>

      <ListGroup header="Privacy and alerts">
        <ListRow
          label="Privacy"
          icon={{ name: "lock", color: "teal" }}
          value={privacy || "Off"}
          chevron
          onPress={() => router.push("/settings/privacy")}
        />
        <ListRow
          label="Reminders"
          icon={{ name: "bell", color: "red" }}
          chevron
          onPress={() => router.push("/settings/reminders")}
        />
      </ListGroup>

      <ListGroup header="Data">
        <ListRow
          label="Backup and sync"
          icon={{ name: "cloud", color: "blue" }}
          chevron
          onPress={() => router.push("/settings/backup")}
        />
        <ListRow
          label="Import and export"
          icon={{ name: "square.and.arrow.up", color: "green" }}
          chevron
          onPress={() => router.push("/settings/transfer")}
        />
      </ListGroup>

      <ListGroup>
        <ListRow
          label="About"
          icon={{ name: "info.circle", color: "gray" }}
          chevron
          onPress={() => router.push("/settings/about")}
        />
      </ListGroup>
      <Text variant="footnote" tone="tertiary" className="text-center">
        {`${APP_NAME} ${Constants.expoConfig?.version ?? ""}`}
      </Text>

      <OptionPicker
        visible={picker === "week"}
        title="Week starts on"
        options={weekOptions}
        selected={weekStart}
        onSelect={setWeekStart}
        onClose={close}
      />
      <OptionPicker
        visible={picker === "month"}
        title="Month starts on"
        options={monthOptions}
        selected={monthStart}
        onSelect={setMonthStart}
        onClose={close}
      />
      <OptionPicker
        visible={picker === "account"}
        title="Default account"
        options={accountOptions}
        selected={defaultAccountId}
        onSelect={(id) => {
          if (id !== null) setDefaultAccountId(id);
        }}
        onClose={close}
      />
    </ScrollView>
  );
}
