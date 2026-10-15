import { useRouter } from "expo-router";
import * as React from "react";
import { Keyboard, View } from "react-native";

import {
  AmountReadout,
  ListGroup,
  ListRow,
  showToast,
  Input,
  Text,
  Pressable,
  SegmentedControl,
} from "@studio/ui";
import { useActions } from "@/data/actions";
import { useBudgets, useCategories, useSettings } from "@/data/hooks";
import { ValidationError } from "@/db/errors";
import type { BudgetInput } from "@/db/repos/budgets";
import type { BudgetPeriod, BudgetScope } from "@/db/schema";
import { AmountKeypad } from "@/features/entry/amount-keypad";
import { EntryLayout } from "@/features/entry/entry-layout";
import { FormRow, PickRow } from "@/features/entry/form-row";
import { useSheetHeader } from "@/features/entry/sheet-header";
import { useAmountEntry } from "@/features/entry/use-amount-entry";
import {
  currencySymbol,
  formatMoneyForSpeech,
  minorDigits,
} from "@studio/money";
import { haptic } from "@studio/theme";

import { useCategoryRequest } from "./category-store";
import {
  anchorLabel,
  anchorOptions,
  defaultAnchor,
  editableName,
  PERIOD_LABELS,
  PERIOD_VALUES,
} from "./logic";

type BudgetFormProps = { mode: "new" | "edit"; budgetId?: string };

const PERIOD_ADJECTIVE: Record<BudgetPeriod, string> = {
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly",
};
const SCOPE_VALUES: readonly BudgetScope[] = ["all", "categories"];
const SCOPE_LABELS = ["All spending", "Categories"] as const;

/** Footnote under the Scope row; taps through to the budget that already covers all spending. */
function ScopeNote({
  period,
  onPress,
}: {
  period: BudgetPeriod;
  onPress: () => void;
  showSeparator?: boolean;
}) {
  return (
    <Pressable
      role="button"
      scale={1}
      dimTo={0.6}
      onPress={onPress}
      accessibilityLabel={`An all-spending ${PERIOD_ADJECTIVE[period]} budget already exists, open it`}
      className="bg-surface px-4 pb-3 pt-2"
    >
      <Text variant="footnote" tone="accent">
        {`An all-spending ${PERIOD_ADJECTIVE[period]} budget already exists`}
      </Text>
    </Pressable>
  );
}

const GENERIC: Record<BudgetPeriod, string> = {
  weekly: "Weekly budget",
  monthly: "Monthly budget",
  yearly: "Yearly budget",
};

/** Add/edit budget sheet: amount on the keypad, then name, scope, period and start. */
export function BudgetForm({ mode, budgetId }: BudgetFormProps) {
  const router = useRouter();
  const actions = useActions();
  const settings = useSettings();
  const progress = useBudgets();
  const categories = useCategories("expense");
  const source =
    mode === "edit"
      ? progress.find((p) => p.budget.id === budgetId)?.budget
      : undefined;

  const [currency] = React.useState(
    () => source?.currency ?? settings.display_currency,
  );
  const digits = minorDigits(currency);
  const [name, setName] = React.useState(() =>
    source ? editableName(source) : "",
  );
  const [amount, setAmount] = React.useState(source?.amount ?? 0);
  const [scope, setScope] = React.useState<BudgetScope>(
    source?.scope ?? "categories",
  );
  const [categoryIds, setCategoryIds] = React.useState<string[]>(
    source?.categoryIds ?? [],
  );
  const [period, setPeriod] = React.useState<BudgetPeriod>(
    source?.period ?? "monthly",
  );
  const [anchor, setAnchor] = React.useState(
    () =>
      source?.startAnchor ??
      defaultAnchor("monthly", {
        weekStart: settings.week_start,
        monthStart: settings.month_start,
      }),
  );
  const [keypadOpen, setKeypadOpen] = React.useState(mode === "new");
  const [nameFocused, setNameFocused] = React.useState(false);
  const entry = useAmountEntry(digits, amount, setAmount);

  const existingOverall = progress.find(
    (p) =>
      p.budget.scope === "all" &&
      p.budget.period === period &&
      p.budget.id !== budgetId,
  )?.budget;
  const taken = existingOverall !== undefined;
  const blocked = scope === "all" && taken;
  const missingCategory = scope === "categories" && categoryIds.length === 0;
  const disabled = amount <= 0 || blocked || missingCategory;

  const close = () => {
    if (router.canDismiss()) router.dismiss();
    else if (router.canGoBack()) router.back();
    else router.replace("/budgets");
  };

  const save = () => {
    if (missingCategory) {
      haptic("error");
      chooseCategories();
      return;
    }
    if (disabled) {
      haptic("error");
      return;
    }
    const input: BudgetInput = {
      name: name.trim() || undefined,
      amount,
      currency,
      period,
      startAnchor: anchor,
      scope,
      categoryIds: scope === "categories" ? categoryIds : [],
    };
    try {
      if (mode === "edit" && budgetId) actions.budgets.update(budgetId, input);
      else actions.budgets.create(input);
    } catch (error) {
      haptic("error");
      if (error instanceof ValidationError) return;
      throw error;
    }
    haptic("success");
    close();
  };

  const remove = () => {
    if (!source || !budgetId) return;
    const input: BudgetInput = {
      name: source.name,
      amount: source.amount,
      currency: source.currency,
      period: source.period,
      startAnchor: source.startAnchor,
      scope: source.scope,
      categoryIds: source.categoryIds,
    };
    actions.budgets.delete(budgetId);
    if (router.canDismiss()) router.dismissAll();
    else close();
    showToast({
      message: "Deleted",
      actionLabel: "Undo",
      onAction: () => actions.budgets.create(input),
    });
  };

  const changePeriod = (index: number) => {
    const next = PERIOD_VALUES[index];
    if (!next) return;
    setPeriod(next);
    // The all-spending option is taken for the new period: fall back to categories.
    if (
      scope === "all" &&
      progress.some(
        (p) =>
          p.budget.scope === "all" &&
          p.budget.period === next &&
          p.budget.id !== budgetId,
      )
    )
      setScope("categories");
    setAnchor(
      defaultAnchor(next, {
        weekStart: settings.week_start,
        monthStart: settings.month_start,
      }),
    );
  };

  const chooseCategories = () => {
    Keyboard.dismiss();
    useCategoryRequest
      .getState()
      .open({ selected: categoryIds, onChange: setCategoryIds });
    router.push("/budget/categories");
  };

  const openExisting = () => {
    if (!existingOverall) return;
    if (router.canDismiss()) router.dismiss();
    router.push({
      pathname: "/budget/[id]",
      params: { id: existingOverall.id },
    });
  };

  const picked = categories.filter((c) => categoryIds.includes(c.id));
  const placeholder =
    scope === "categories" && picked.length === 1
      ? (picked[0]?.name ?? GENERIC[period])
      : GENERIC[period];
  const showKeypad = keypadOpen && !nameFocused;

  const header = useSheetHeader({
    title: mode === "edit" ? "Edit budget" : "New budget",
    onCancel: close,
    onSave: () => save(),
    saveDisabled: disabled,
  });

  if (mode === "edit" && !source) return null;

  return (
    <>
      {header}
      <EntryLayout
        keypad={
          showKeypad ? (
            <AmountKeypad entry={entry} digits={digits} onSave={save} />
          ) : null
        }
      >
        <View className="h-[92px] justify-center">
          <AmountReadout
            symbol={currencySymbol(currency)}
            value={entry.view.display}
            expression={entry.view.expression}
            onPress={() => {
              setNameFocused(false);
              setKeypadOpen(true);
            }}
            accessibilityLabel={`Amount, ${formatMoneyForSpeech(amount, currency, { sign: "none" })}`}
          />
        </View>
        <ListGroup>
          <FormRow label="Name">
            <Input
              variant="inline"
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              placeholder={placeholder}
              returnKeyType="done"
              autoCapitalize="sentences"
              maxLength={40}
              accessibilityLabel="Name"
              className="h-6 min-h-0 flex-1 py-0 text-right"
            />
          </FormRow>
          <FormRow label="Scope">
            <View className="w-[230px]">
              <SegmentedControl
                values={SCOPE_LABELS}
                selectedIndex={SCOPE_VALUES.indexOf(scope)}
                onChange={(index) =>
                  setScope(SCOPE_VALUES[index] ?? "categories")
                }
                disabledIndexes={taken ? [0] : undefined}
                accessibilityLabel="Scope"
              />
            </View>
          </FormRow>
          {taken ? <ScopeNote period={period} onPress={openExisting} /> : null}
          {scope === "categories" ? (
            <ListRow
              label="Categories"
              value={
                picked.length === 0
                  ? "Choose"
                  : picked.map((c) => c.name).join(", ")
              }
              chevron
              onPress={chooseCategories}
            />
          ) : null}
          <FormRow label="Period">
            <View className="w-[210px]">
              <SegmentedControl
                values={PERIOD_LABELS}
                selectedIndex={PERIOD_VALUES.indexOf(period)}
                onChange={changePeriod}
                accessibilityLabel="Period"
              />
            </View>
          </FormRow>
          <PickRow
            label="Starts"
            value={anchorLabel(period, anchor)}
            title={
              period === "weekly"
                ? "Week starts on"
                : period === "monthly"
                  ? "Day of month"
                  : "Year starts in"
            }
            options={anchorOptions(period)}
            selected={anchor}
            onSelect={setAnchor}
          />
        </ListGroup>
        {mode === "edit" ? (
          <ListGroup>
            <ListRow
              label="Delete budget"
              destructive
              centered
              onPress={remove}
            />
          </ListGroup>
        ) : null}
      </EntryLayout>
    </>
  );
}
