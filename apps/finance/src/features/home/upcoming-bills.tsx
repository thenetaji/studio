import { useRouter } from "expo-router";
import * as React from "react";
import { StyleSheet, View } from "react-native";

import {
  HIDDEN_LABEL,
  IconTile,
  Card,
  Pressable,
  Text,
  isMaskedText,
} from "@studio/ui";
import type { Occurrence } from "@/db/repos/recurring";
import type { CategoryRow } from "@/db/schema";
import { dayLabel, diffDays } from "@studio/dates";
import { formatMoney } from "@studio/money";
import { useTokens, type CategoryColorKey } from "@studio/theme";

import { dueIn, frequencyLabel } from "./curve";
import { HomeSectionHeader } from "./section-header";
import { nextPerRule } from "./upcoming-model";

const ROWS = 3;

type UpcomingBillsProps = {
  /** Upcoming occurrences, soonest first. */
  occurrences: readonly Occurrence[];
  categories: ReadonlyMap<string, CategoryRow>;
  todayKey: string;
  locale?: string;
  showDecimals: boolean;
};

/** The next recurring expenses, one row per rule. Hidden when nothing is due. */
function UpcomingBills({
  occurrences,
  categories,
  todayKey,
  locale,
  showDecimals,
}: UpcomingBillsProps) {
  const router = useRouter();
  const { colors } = useTokens();
  const rows = React.useMemo(
    () =>
      nextPerRule(
        occurrences.filter((o) => o.rule.kind === "expense"),
        ROWS,
      ),
    [occurrences],
  );
  if (rows.length === 0) return null;
  const decimals = showDecimals ? undefined : 0;

  return (
    <View>
      <HomeSectionHeader
        title="Upcoming bills"
        actionLabel="All"
        onAction={() => router.push("/recurring")}
      />
      <Card className="overflow-hidden rounded-[20px] p-0">
        {rows.map(({ rule, dueDate }, index) => {
          const cat = rule.categoryId
            ? categories.get(rule.categoryId)
            : undefined;
          const days = diffDays(todayKey, dueDate);
          const when =
            days <= 1
              ? dueIn(days)
              : `${dayLabel(dueDate, todayKey)} · ${dueIn(days)}`;
          const title = rule.title || cat?.name || "Recurring";
          const amount = formatMoney(rule.amount, rule.currency, {
            locale,
            sign: "none",
            decimals,
          });
          return (
            <Pressable
              key={rule.id}
              role="button"
              accessibilityLabel={`${title}, ${when}, ${isMaskedText(amount) ? HIDDEN_LABEL : amount}`}
              scale={0.98}
              onPress={() =>
                router.push({
                  pathname: "/recurring/[id]",
                  params: { id: rule.id },
                })
              }
              className="min-h-[62px] flex-row items-center gap-3 px-4 py-3"
              style={
                index > 0
                  ? {
                      borderTopWidth: StyleSheet.hairlineWidth * 2,
                      borderTopColor: colors.separator,
                    }
                  : null
              }
            >
              <IconTile
                icon={cat?.icon ?? "arrow.triangle.2.circlepath"}
                color={(cat?.color ?? "gray") as CategoryColorKey}
                size={36}
              />
              <View className="min-w-0 flex-1">
                <Text
                  variant="callout"
                  numberOfLines={1}
                  className="font-medium tracking-[-0.2px]"
                >
                  {title}
                </Text>
                <Text
                  variant="footnote"
                  tone={days <= 1 ? "default" : "secondary"}
                  numberOfLines={1}
                  className="mt-[3px]"
                >
                  {when}
                </Text>
              </View>
              <View className="items-end">
                <Text
                  variant="callout"
                  numeric
                  className="font-semibold tracking-[-0.2px]"
                >
                  {amount}
                </Text>
                <Text variant="caption" tone="tertiary" className="mt-[3px]">
                  {frequencyLabel(rule.frequency, rule.interval)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

export { UpcomingBills };
