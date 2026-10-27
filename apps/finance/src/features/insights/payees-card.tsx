import { useRouter } from "expo-router";
import * as React from "react";

import { Card, SectionHeader, Text } from "@studio/ui";
import type { InsightLines } from "@/data/hooks";

import { PayeeRow } from "./payee-row";
import { payeeTotals } from "./payees-model";
import { contextParams, type InsightsContext } from "./params";

type PayeesCardProps = {
  data: InsightLines;
  context: InsightsContext;
  locale?: string;
  showDecimals: boolean;
};

const LIMIT = 6;

/** "Top payees": the titles that took the most this period; "All" opens the full list. */
const PayeesCard = React.memo(function PayeesCard({
  data,
  context,
  locale,
  showDecimals,
}: PayeesCardProps) {
  const router = useRouter();
  const payees = React.useMemo(
    () =>
      payeeTotals(data.lines, context.kind, context.period, data.ctx),
    [data, context],
  );
  const currency = data.ctx.displayCurrency;
  const top = payees.slice(0, LIMIT);
  const title = context.kind === "income" ? "Top sources" : "Top payees";
  const open = (key: string, name: string) =>
    router.push({
      pathname: "/payee",
      params: { ...contextParams(context), key, title: name },
    });
  return (
    <>
      <SectionHeader
        title={title}
        actionLabel={payees.length > LIMIT ? "All" : undefined}
        onAction={() =>
          router.push({ pathname: "/payees", params: contextParams(context) })
        }
      />
      <Card className="mx-4 p-0">
        {top.length === 0 ? (
          <Text variant="callout" tone="secondary" className="py-8 text-center">
            No titled transactions
          </Text>
        ) : (
          top.map((payee, index) => (
            <PayeeRow
              key={payee.key}
              payee={payee}
              category={
                payee.categoryId
                  ? (data.categories.get(payee.categoryId) ?? null)
                  : null
              }
              currency={currency}
              locale={locale}
              showDecimals={showDecimals}
              max={top[0]?.amount ?? 0}
              separator={index < top.length - 1}
              onPress={() => open(payee.key, payee.title)}
            />
          ))
        )}
      </Card>
    </>
  );
});

export { PayeesCard };
