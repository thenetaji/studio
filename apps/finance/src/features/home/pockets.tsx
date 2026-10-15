import { useRouter } from "expo-router";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import { Card, Pressable, Text } from "@studio/ui";
import type { PocketView } from "@/data/hooks";
import { formatMoney } from "@studio/money";
import { useTokens } from "@studio/theme";

import { HomeSectionHeader } from "./section-header";

const LOW = 0.2;
const DAY_MS = 86_400_000;

type PocketsProps = {
  pockets: readonly PocketView[];
  locale?: string;
  showDecimals: boolean;
};

function refilledLabel(at: number | null): string {
  if (at === null) return "Not refilled yet";
  const days = Math.floor((Date.now() - at) / DAY_MS);
  if (days <= 0) return "Refilled today";
  if (days === 1) return "Refilled yesterday";
  return `Refilled ${days} days ago`;
}

function PocketRow({
  pocket,
  locale,
  showDecimals,
  separator,
}: {
  pocket: PocketView;
  locale?: string;
  showDecimals: boolean;
  separator: boolean;
}) {
  const router = useRouter();
  const { colors } = useTokens();
  const currency = pocket.account.currency;
  const fmt = (minor: number) =>
    formatMoney(minor, currency, {
      locale,
      decimals: showDecimals ? undefined : 0,
    });
  const base = pocket.refill === null ? pocket.amount : pocket.total;
  const share = pocket.refill === null ? 0 : Math.min(1, pocket.left / base);
  const low = pocket.refill !== null && share < LOW;
  const refill = () =>
    router.push({
      pathname: "/transaction/new",
      params: {
        kind: "transfer",
        toAccountId: pocket.accountId,
        amount: String(pocket.amount),
        currency,
        ...(pocket.fromAccountId && { accountId: pocket.fromAccountId }),
      },
    });

  return (
    <View
      className="gap-3 px-4 py-3.5"
      style={
        separator
          ? {
              borderTopWidth: StyleSheet.hairlineWidth * 2,
              borderTopColor: colors.separator,
            }
          : null
      }
    >
      <View className="flex-row items-start gap-3">
        <Pressable
          role="button"
          accessibilityLabel={`${pocket.account.name}, ${fmt(pocket.left)} left of ${fmt(base)}`}
          scale={0.98}
          onPress={() =>
            router.push({
              pathname: "/accounts/[id]",
              params: { id: pocket.accountId },
            })
          }
          className="min-w-0 flex-1 gap-0.5"
        >
          <Text variant="headline" numberOfLines={1}>
            {pocket.account.name}
          </Text>
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {refilledLabel(pocket.refilledAt)}
          </Text>
        </Pressable>
        <View className="items-end gap-0.5">
          <Text
            variant="headline"
            numeric
            tone={low ? "warning" : "default"}
          >
            {pocket.refill === null ? fmt(0) : fmt(pocket.left)} left
          </Text>
          <Text variant="footnote" tone="secondary" numeric>
            of {fmt(base)}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-3">
        <View
          className="h-1.5 flex-1 overflow-hidden rounded-full"
          style={{ backgroundColor: colors.fill }}
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.round(share * 100)}%`,
              backgroundColor: low ? colors.warning : colors.accent,
            }}
          />
        </View>
        <Pressable
          role="button"
          accessibilityLabel={`Refill ${pocket.account.name} with ${fmt(pocket.amount)}`}
          haptic="light"
          onPress={refill}
          className="h-8 justify-center rounded-full px-3.5"
          style={{
            borderWidth: 1,
            borderColor: low ? colors.warning : colors.accent,
          }}
        >
          <Text variant="footnote" tone={low ? "warning" : "accent"}>
            Refill {fmt(pocket.amount)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Pocket accounts: what is left since the last refill, and a one-tap refill transfer. */
function Pockets({ pockets, locale, showDecimals }: PocketsProps) {
  return (
    <>
      <HomeSectionHeader title="Pocket money" />
      <Card className="rounded-[20px] p-0">
        {pockets.map((pocket, i) => (
          <PocketRow
            key={pocket.accountId}
            pocket={pocket}
            locale={locale}
            showDecimals={showDecimals}
            separator={i > 0}
          />
        ))}
      </Card>
    </>
  );
}

export { Pockets };
