import { useRouter } from "expo-router";
import * as React from "react";
import { Alert, View } from "react-native";

import {
  AmountReadout,
  ListGroup,
  ListRow,
  Input,
  SegmentedControl,
} from "@studio/ui";
import { useActions } from "@/data/actions";
import {
  useAccounts,
  useCategories,
  useFuturePostedCount,
  useRecurringRule,
  useTodayKey,
} from "@/data/hooks";
import { ValidationError } from "@/db/errors";
import type { RecurringPatch } from "@/db/repos/recurring";
import { AmountKeypad } from "@/features/entry/amount-keypad";
import { CategoryPicker } from "@/features/entry/category-picker";
import { EntryLayout } from "@/features/entry/entry-layout";
import { FormRow, PickRow } from "@/features/entry/form-row";
import { useSheetHeader } from "@/features/entry/sheet-header";
import { Stepper } from "@/features/entry/stepper";
import { useAmountEntry } from "@/features/entry/use-amount-entry";
import { DatePicker } from "@/features/transaction-form/date-picker";
import { addDays, keyToLocalMs, toDateKey, type DateKey } from "@studio/dates";
import type { Frequency } from "@/lib/recurring";
import {
  currencySymbol,
  formatMoneyForSpeech,
  minorDigits,
} from "@studio/money";
import { haptic } from "@studio/theme";

const FREQUENCIES: readonly Frequency[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];
const FREQUENCY_LABELS = ["Daily", "Weekly", "Monthly", "Yearly"] as const;
const UNITS: Record<Frequency, [string, string]> = {
  daily: ["day", "days"],
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
  yearly: ["year", "years"],
};

const noon = (key: DateKey) => keyToLocalMs(key, 12);

/** Rule sheet: the add-sheet fields without a date, plus next due, end, paused and delete. */
export function RuleForm({ ruleId }: { ruleId: string }) {
  const router = useRouter();
  const actions = useActions();
  const today = useTodayKey();
  const rule = useRecurringRule(ruleId);
  const accounts = useAccounts({ includeArchived: true });
  const categories = useCategories();
  const futurePosted = useFuturePostedCount(ruleId, today);

  const [title, setTitle] = React.useState(rule?.title ?? "");
  const [memo, setMemo] = React.useState(rule?.memo ?? "");
  const [amount, setAmount] = React.useState(rule?.amount ?? 0);
  const [categoryId, setCategoryId] = React.useState(rule?.categoryId ?? null);
  const [accountId, setAccountId] = React.useState(rule?.accountId ?? "");
  const [toAccountId, setToAccountId] = React.useState(
    rule?.transferAccountId ?? null,
  );
  const [frequency, setFrequency] = React.useState<Frequency>(
    rule?.frequency ?? "monthly",
  );
  const [interval, setInterval] = React.useState(rule?.interval ?? 1);
  const [nextDue, setNextDue] = React.useState<DateKey>(rule?.nextDue ?? today);
  const [endDate, setEndDate] = React.useState<DateKey | null>(
    rule?.endDate ?? null,
  );
  const [paused, setPaused] = React.useState(
    rule ? rule.pausedAt !== null : false,
  );
  const [keypadOpen, setKeypadOpen] = React.useState(false);
  const [textFocused, setTextFocused] = React.useState(false);
  const [categoryOpen, setCategoryOpen] = React.useState(false);

  const currency = rule?.currency ?? "USD";
  const digits = minorDigits(currency);
  const entry = useAmountEntry(digits, amount, setAmount);

  const close = () => {
    if (router.canDismiss()) router.dismiss();
    else if (router.canGoBack()) router.back();
    else router.replace("/recurring");
  };

  const isTransfer = rule?.kind === "transfer";
  const disabled =
    amount <= 0 || (isTransfer && (!toAccountId || toAccountId === accountId));
  const header = useSheetHeader({
    title: "Edit rule",
    onCancel: close,
    onSave: () => save(),
    saveDisabled: disabled,
  });

  if (!rule) return null;
  const kindCategories = categories.filter(
    (c) => c.kind === (rule.kind === "income" ? "income" : "expense"),
  );
  const sameCurrency = accounts.filter(
    (a) =>
      a.currency === currency &&
      (!a.archivedAt || a.id === accountId || a.id === toAccountId),
  );
  const accountOptions = sameCurrency.map((a) => ({
    value: a.id,
    label: a.name,
  }));
  const toOptions = accountOptions.filter((o) => o.value !== accountId);
  const category = categories.find((c) => c.id === categoryId);
  const nameOf = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name ?? "";
  const save = () => {
    if (disabled) {
      haptic("error");
      return;
    }
    const realign = frequency !== rule.frequency || nextDue !== rule.nextDue;
    const patch: RecurringPatch = {
      title,
      memo,
      amount,
      accountId,
      frequency,
      interval,
      nextDue,
      endDate,
      ...(realign && { startDate: nextDue }),
      ...(isTransfer ? { transferAccountId: toAccountId } : { categoryId }),
    };
    try {
      actions.recurring.update(ruleId, patch);
      if (paused !== (rule.pausedAt !== null))
        actions.recurring.setPaused(ruleId, paused);
    } catch (error) {
      haptic("error");
      if (error instanceof ValidationError) return;
      throw error;
    }
    haptic("success");
    close();
  };

  const remove = (deleteFuturePosted: boolean) => {
    actions.recurring.delete(ruleId, { deleteFuturePosted, todayKey: today });
    close();
  };

  const confirmDelete = () => {
    if (futurePosted > 0) {
      Alert.alert("Also delete future posted transactions?", undefined, [
        {
          text: "Delete all",
          style: "destructive",
          onPress: () => remove(true),
        },
        { text: "Keep them", onPress: () => remove(false) },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    Alert.alert("Delete rule", undefined, [
      {
        text: "Delete rule",
        style: "destructive",
        onPress: () => remove(false),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const endMs = endDate ? noon(endDate) : noon(addDays(nextDue, 30));
  const showKeypad = keypadOpen && !textFocused;
  const focusProps = {
    onFocus: () => setTextFocused(true),
    onBlur: () => setTextFocused(false),
  };

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
              setTextFocused(false);
              setKeypadOpen(true);
            }}
            accessibilityLabel={`Amount, ${formatMoneyForSpeech(amount, currency, { sign: "none" })}`}
          />
        </View>
        <ListGroup>
          {isTransfer ? null : (
            <FormRow label="Title">
              <Input
                variant="inline"
                value={title}
                onChangeText={setTitle}
                placeholder={category?.name ?? "Title"}
                autoCapitalize="sentences"
                returnKeyType="done"
                accessibilityLabel="Title"
                className="h-6 min-h-0 flex-1 py-0 text-right"
                {...focusProps}
              />
            </FormRow>
          )}
          {isTransfer ? null : (
            <ListRow
              label="Category"
              value={category?.name}
              chevron
              onPress={() => setCategoryOpen(true)}
            />
          )}
          <PickRow
            label={isTransfer ? "From" : "Account"}
            value={nameOf(accountId)}
            options={accountOptions}
            selected={accountId}
            onSelect={(id) => {
              setAccountId(id);
              if (id === toAccountId) setToAccountId(null);
            }}
          />
          {isTransfer ? (
            <PickRow
              label="To"
              value={nameOf(toAccountId)}
              options={toOptions}
              selected={toAccountId}
              onSelect={setToAccountId}
            />
          ) : null}
          <FormRow label="Memo">
            <Input
              variant="inline"
              value={memo}
              onChangeText={setMemo}
              placeholder="Memo"
              autoCapitalize="sentences"
              returnKeyType="done"
              accessibilityLabel="Memo"
              className="h-6 min-h-0 flex-1 py-0 text-right"
              {...focusProps}
            />
          </FormRow>
        </ListGroup>
        <ListGroup>
          <FormRow label="Repeat" stacked>
            <SegmentedControl
              values={FREQUENCY_LABELS}
              selectedIndex={FREQUENCIES.indexOf(frequency)}
              onChange={(index) =>
                setFrequency(FREQUENCIES[index] ?? "monthly")
              }
              accessibilityLabel="Repeat"
            />
          </FormRow>
          <FormRow label="Every">
            <Stepper
              value={interval}
              onChange={setInterval}
              label="Every"
              unit={UNITS[frequency][interval === 1 ? 0 : 1]}
            />
          </FormRow>
          <FormRow label="Next due">
            <DatePicker
              value={noon(nextDue)}
              mode="date"
              display="compact"
              onChange={(ms) => setNextDue(toDateKey(ms))}
            />
          </FormRow>
          <FormRow label="Ends">
            <View className="w-44">
              <SegmentedControl
                values={["Never", "On date"]}
                selectedIndex={endDate ? 1 : 0}
                onChange={(index) =>
                  setEndDate(index === 0 ? null : toDateKey(endMs))
                }
                accessibilityLabel="Ends"
              />
            </View>
          </FormRow>
          {endDate ? (
            <FormRow label="On date">
              <DatePicker
                value={endMs}
                mode="date"
                display="compact"
                minimumDate={noon(nextDue)}
                onChange={(ms) => setEndDate(toDateKey(ms))}
              />
            </FormRow>
          ) : null}
        </ListGroup>
        <ListGroup>
          <ListRow
            label="Paused"
            switchValue={paused}
            onSwitchChange={setPaused}
          />
        </ListGroup>
        <ListGroup>
          <ListRow
            label="Delete rule"
            destructive
            centered
            onPress={confirmDelete}
          />
        </ListGroup>
      </EntryLayout>
      <CategoryPicker
        visible={categoryOpen}
        categories={kindCategories}
        selected={categoryId}
        onSelect={setCategoryId}
        onClose={() => setCategoryOpen(false)}
      />
    </>
  );
}
