import { useRouter, type Href } from "expo-router";
import * as React from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";

import {
  AmountReadout,
  showToast,
  Button,
  Input,
  Pressable,
  SegmentedControl,
  Text,
  EdgeFade,
} from "@studio/ui";
import { Keypad, type KeypadKey } from "@studio/ui";
import { AppIcon } from "@studio/icons";
import { useActions } from "@/data/actions";
import {
  useAccounts,
  useCategories,
  usePeople,
  useRateLookup,
  useRecentCategories,
  useRecurringRule,
  useSettings,
  useTags,
  useTitleSuggestions,
  useTodayKey,
  useTransaction,
} from "@/data/hooks";
import { ValidationError } from "@/db/errors";
import { normalizeTitle } from "@/db/repos/titleMemory";
import type { TitleMemoryRow } from "@/db/schema";
import { CategoryRowView } from "@/features/transaction-form/category-row";
import { FormChip, Hairline } from "@/features/transaction-form/chips";
import { ShakeView } from "@/features/transaction-form/shake-view";
import { useKeyboardInset } from "@/features/entry/use-keyboard-inset";
import {
  pickReceipt,
  RECEIPT_OPTIONS,
  type ReceiptSource,
} from "@/features/receipts/pick";
import { ReceiptThumb } from "@/features/receipts/receipt-thumb";
import { TagPills } from "@/features/tags/tag-pill";
import { isLendingKind, type TransactionKind } from "@/lib/ledger";
import { applyDevPreset } from "@/features/transaction-form/dev-preset";
import {
  addSplitLine,
  autoReceives,
  buildRuleInput,
  buildTransactionInput,
  collapsedCategory,
  dateChipLabel,
  minuteOfDay,
  draftFromTransaction,
  emptyDraft,
  isSaveDisabled,
  KIND_SEGMENTS,
  kindChangePatch,
  lendTitle,
  lendToggle,
  newReceiptKey,
  receiptChanges,
  segmentOf,
  moneyShort,
  pickOtherAccount,
  removeSplitLine,
  repeatLabel,
  resolveDefaults,
  saveBlock,
  startSplit,
  updateSplitLine,
  type Draft,
  type SaveContext,
} from "@/features/transaction-form/logic";
import {
  MenuChip,
  type MenuOption,
} from "@/features/transaction-form/menu-chip";
import { SplitList } from "@/features/transaction-form/split-list";
import { selectDraft, useDraftStore } from "@/features/transaction-form/store";
import {
  createKeypadState,
  deriveKeypad,
  keypadReducer,
  type KeypadState,
} from "@studio/money";
import {
  currencySymbol,
  formatMoney,
  formatMoneyForSpeech,
  minorDigits,
} from "@studio/money";
import { haptic, useTokens } from "@studio/theme";

export type FormParams = {
  kind?: string;
  accountId?: string;
  /** Transfer destination, e.g. a pocket being refilled. */
  toAccountId?: string;
  categoryId?: string;
  duplicateOf?: string;
  /** Quick-add prefill: title, amount in minor units and the currency that amount is in. */
  title?: string;
  amount?: string;
  currency?: string;
  ruleId?: string;
  dev?: string;
};

type TransactionFormProps = {
  mode: "new" | "edit";
  transactionId?: string;
  params?: FormParams;
};

const KIND_LABELS = ["Expense", "Income", "Transfer", "Lend"] as const;
const ACCESSORY_ID = "transaction-form-done";
const devEnabled = __DEV__ || Platform.OS === "web";

const REPEAT_OPTIONS: readonly MenuOption[] = [
  { value: "never", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom…" },
];

const get = () => useDraftStore.getState();

function TransactionForm({
  mode,
  transactionId,
  params = {},
}: TransactionFormProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset();
  const { colors, category } = useTokens();
  const actions = useActions();
  const settings = useSettings();
  const accountsAll = useAccounts({ includeArchived: true });
  const categoriesAll = useCategories();
  const rates = useRateLookup();
  const todayKey = useTodayKey();
  const source = useTransaction(
    mode === "edit" ? transactionId : params.duplicateOf,
  );
  const rule = useRecurringRule(params.ruleId);
  const linkedRule = useRecurringRule(
    mode === "edit" ? source?.recurringRuleId : undefined,
  );
  const people = usePeople();
  const allTags = useTags();

  const [booted] = React.useState(() => {
    if (mode === "edit" && !source) return false;
    const activeAccounts = accountsAll.filter((a) => !a.archivedAt);
    const defaults = resolveDefaults({
      params,
      lastKind: settings.last_kind,
      lastAccountId: settings.last_account_id,
      defaultAccountId: settings.default_account_id,
      accounts: activeAccounts,
      categories: categoriesAll,
    });
    const now = Date.now();
    let draft: Draft = emptyDraft(defaults, now);
    if (source) {
      draft = draftFromTransaction(
        source,
        mode === "edit" ? source.occurredAt : now,
      );
      draft.appliedTitleNorm = normalizeTitle(draft.title);
      // A duplicate is a new transaction: it keeps the person and tags but not the photos.
      if (mode !== "edit") draft.receipts = [];
    } else if (rule) {
      draft = draftFromTransaction(
        { ...rule, transferCurrency: null, occurredAt: now, splits: [] },
        now,
      );
      if (rule.kind === "transfer") draft.receives = rule.transferAmount;
      draft.appliedTitleNorm = normalizeTitle(draft.title);
    }
    if (!source && !rule && params.title) {
      draft.title = params.title;
      draft.appliedTitleNorm = normalizeTitle(params.title);
      const minor = Number(params.amount);
      const account = activeAccounts.find((a) => a.id === draft.accountId);
      const sameCurrency =
        !params.currency || account?.currency === params.currency;
      if (
        draft.kind !== "transfer" &&
        Number.isInteger(minor) &&
        minor > 0 &&
        sameCurrency
      )
        draft.amount = minor;
    }
    // A pocket refill arrives with its amount but no title.
    if (!source && !rule && !params.title && params.toAccountId) {
      const minor = Number(params.amount);
      const account = activeAccounts.find((a) => a.id === draft.accountId);
      if (
        Number.isInteger(minor) &&
        minor > 0 &&
        (!params.currency || account?.currency === params.currency)
      )
        draft.amount = minor;
    }
    if (devEnabled)
      draft = applyDevPreset(draft, params.dev, accountsAll, categoriesAll, {
        personId:
          (people.find((p) => p.name === "Rahul") ?? people[0])?.id ?? null,
        tagIds: allTags.slice(0, 2).map((t) => t.id),
      });
    useDraftStore.getState().init(draft);
    return true;
  });

  const draft = useDraftStore(useShallow(selectDraft));
  const focus = useDraftStore((s) => s.focus);

  const accountOf = (id: string | null) => accountsAll.find((a) => a.id === id);
  const activeAccounts = accountsAll.filter(
    (a) =>
      !a.archivedAt ||
      a.id === draft.accountId ||
      a.id === draft.transferAccountId,
  );
  const fromCurrency =
    accountOf(draft.accountId)?.currency ?? settings.display_currency;
  const toCurrency =
    accountOf(draft.transferAccountId)?.currency ?? fromCurrency;
  const fromDigits = minorDigits(fromCurrency);
  const toDigits = minorDigits(toCurrency);
  const isTransfer = draft.kind === "transfer";
  const isLend = isLendingKind(draft.kind);
  // The entry wears its kind: coral, mint, blue, brass.
  const kindColor =
    draft.kind === "expense"
      ? colors.expense
      : draft.kind === "income"
        ? colors.income
        : isTransfer
          ? category.blue
          : colors.accent;
  const person = people.find((p) => p.id === draft.personId);
  const draftTags = allTags.filter((t) => draft.tagIds.includes(t.id));
  const crossCurrency = isTransfer && fromCurrency !== toCurrency;

  const contextFor = (d: Draft): SaveContext => {
    const from = accountOf(d.accountId)?.currency ?? fromCurrency;
    const to = accountOf(d.transferAccountId)?.currency ?? from;
    return {
      sameCurrency: d.kind !== "transfer" || from === to,
      receivesAmount:
        d.receives ?? autoReceives(d.amount, from, to, rates(from, to)),
    };
  };
  const ctx = contextFor(draft);
  const block = saveBlock(draft, ctx);

  // -- keypad entry ---------------------------------------------------------------------------
  const digitsOf = (target: string) =>
    target === "receives" ? toDigits : fromDigits;
  const valueOf = (target: string): number => {
    const s = get();
    if (target === "amount") return s.amount;
    if (target === "receives") return contextFor(s).receivesAmount;
    return s.splits?.find((line) => `line:${line.key}` === target)?.amount ?? 0;
  };
  const [entry, setEntry] = React.useState<KeypadState>(() =>
    createKeypadState(fromDigits, get().amount),
  );
  const view = deriveKeypad(entry);
  const [keypadOpen, setKeypadOpen] = React.useState(mode === "new");
  const [inputFocus, setInputFocus] = React.useState<"title" | "memo" | null>(
    null,
  );
  const [areaHeight, setAreaHeight] = React.useState(0);
  const [cardHeight, setCardHeight] = React.useState(0);
  const [initialMinute] = React.useState(() => minuteOfDay(get().occurredAt));
  const [catShake, setCatShake] = React.useState(0);
  const [splitShake, setSplitShake] = React.useState(0);
  const [personShake, setPersonShake] = React.useState(0);

  const focusTarget = (target: string, digits = digitsOf(target)) => {
    Keyboard.dismiss();
    get().setFocus(target);
    setEntry(createKeypadState(digits, valueOf(target)));
    setKeypadOpen(true);
  };

  const commit = (target: string, total: number) => {
    const s = get();
    if (target === "amount") s.patch({ amount: total });
    else if (target === "receives") s.patch({ receives: total });
    else if (s.splits)
      s.patch({
        splits: updateSplitLine(s.splits, target.slice(5), { amount: total }),
      });
  };

  const submit = () => {
    const d = get();
    const c = contextFor(d);
    const why = saveBlock(d, c);
    if (why === "category") {
      setCatShake((n) => n + 1);
      haptic("error");
      return;
    }
    if (why === "person") {
      setPersonShake((n) => n + 1);
      haptic("error");
      return;
    }
    if (why === "split_category") {
      setSplitShake((n) => n + 1);
      haptic("error");
      return;
    }
    if (why) {
      haptic("error");
      return;
    }
    let createdRuleId: string | null = null;
    try {
      let ruleId =
        mode === "edit"
          ? (source?.recurringRuleId ?? null)
          : (params.ruleId ?? null);
      if (d.repeat && !linkedRule) {
        const fallback =
          categoriesAll.find(
            (cat) => cat.id === (d.splits?.[0]?.categoryId ?? d.categoryId),
          )?.name ?? "";
        const input = buildRuleInput(d, c, fallback);
        if (input) {
          createdRuleId = actions.recurring.create(input).id;
          ruleId = createdRuleId;
        }
      }
      const input = buildTransactionInput(
        {
          ...d,
          title: lendTitle(d, people.find((p) => p.id === d.personId)?.name),
        },
        c,
        ruleId,
      );
      if (mode === "edit" && transactionId) {
        actions.transactions.update(transactionId, input);
        const { add, remove } = receiptChanges(
          d.receipts,
          source?.attachments.map((a) => a.id) ?? [],
        );
        saveReceipts(transactionId, add, remove);
      } else {
        const created = actions.transactions.create(input);
        saveReceipts(created.id, d.receipts, []);
        const intoPocket =
          d.kind === "transfer" &&
          settings.pockets.some((p) => p.accountId === d.transferAccountId);
        if (intoPocket && d.transferAccountId) {
          // After a refill, the next entry is most likely a spend from the pocket.
          actions.settings.set("last_kind", "expense");
          actions.settings.set("last_account_id", d.transferAccountId);
        } else {
          if (
            d.kind === "expense" ||
            d.kind === "income" ||
            d.kind === "transfer"
          )
            actions.settings.set("last_kind", d.kind);
          if (d.accountId)
            actions.settings.set("last_account_id", d.accountId);
        }
        if (params.ruleId) actions.recurring.skip(params.ruleId);
      }
    } catch (error) {
      if (createdRuleId) actions.recurring.delete(createdRuleId);
      haptic("error");
      if (error instanceof ValidationError) return;
      throw error;
    }
    haptic("success");
    close();
  };

  /** Photos are copied after the transaction is saved; a failure only costs the photo. */
  const saveReceipts = (
    id: string,
    add: readonly {
      uri: string;
      width: number | null;
      height: number | null;
    }[],
    remove: readonly string[],
  ) => {
    for (const attachmentId of remove)
      void actions.attachments.remove(attachmentId);
    if (add.length === 0) return;
    void Promise.all(
      add.map((r) =>
        actions.attachments.add(id, {
          uri: r.uri,
          width: r.width,
          height: r.height,
        }),
      ),
    ).catch(() =>
      showToast({ message: "Receipt not saved", haptic: "warning" }),
    );
  };

  const addReceipt = async (source: string) => {
    const image = await pickReceipt(source as ReceiptSource);
    if (image)
      get().patch({
        receipts: [...get().receipts, { key: newReceiptKey(), ...image }],
      });
  };

  const removeReceipt = (key: string) =>
    get().patch({ receipts: get().receipts.filter((r) => r.key !== key) });

  const openReceipt = (
    uri: string,
    width: number | null,
    height: number | null,
  ) =>
    router.push({
      pathname: "/transaction/receipt",
      params: { uri, w: String(width ?? 0), h: String(height ?? 0) },
    });

  const close = () => {
    if (router.canDismiss()) router.dismiss();
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const onKey = (key: KeypadKey) => {
    if (key === "=" && view.equalsIsSave) {
      submit();
      return;
    }
    const next = keypadReducer(entry, key === "backspace" ? "back" : key);
    setEntry(next);
    commit(focus, deriveKeypad(next).total);
  };

  const onDelete = () => {
    if (!transactionId) return;
    const snapshot = actions.transactions.delete(transactionId);
    if (router.canDismiss()) router.dismissAll();
    else close();
    if (snapshot)
      showToast({
        message: "Deleted",
        actionLabel: "Undo",
        onAction: () => actions.transactions.restore(snapshot),
      });
  };

  // -- draft changes --------------------------------------------------------------------------
  const changeKind = (index: number) => {
    const segment = KIND_SEGMENTS[index];
    if (!segment) return;
    const s = get();
    const kind: TransactionKind =
      segment === "lend" ? (isLendingKind(s.kind) ? s.kind : "lent") : segment;
    if (kind === s.kind) return;
    s.patch(kindChangePatch(s, kind, activeAccounts, categoriesAll));
    s.setFocus("amount");
    setEntry(createKeypadState(fromDigits, s.amount));
  };

  const changeAccount = (id: string) => {
    const s = get();
    const next = accountOf(id);
    if (!next) return;
    const patch: Partial<Draft> = { accountId: id, receives: null };
    if (s.kind === "transfer")
      patch.transferAccountId = pickOtherAccount(
        activeAccounts,
        id,
        s.transferAccountId,
      );
    const digitsChanged = minorDigits(next.currency) !== fromDigits;
    if (digitsChanged) {
      patch.amount = 0;
      if (s.splits)
        patch.splits = s.splits.map((line) => ({ ...line, amount: 0 }));
    }
    s.patch(patch);
    s.setFocus("amount");
    setEntry(
      createKeypadState(
        minorDigits(next.currency),
        digitsChanged ? 0 : s.amount,
      ),
    );
  };

  const changeToAccount = (id: string) => {
    get().patch({ transferAccountId: id, receives: null });
    if (focus === "receives") focusTarget("amount", fromDigits);
  };

  const startSplitting = () => {
    const s = get();
    s.patch({ splits: startSplit(s.amount, s.categoryId), categoryId: null });
  };

  const removeSplit = () => {
    const s = get();
    if (!s.splits) return;
    s.patch({ splits: null, categoryId: collapsedCategory(s.splits) });
    if (focus.startsWith("line:")) focusTarget("amount", fromDigits);
  };

  const removeLine = (key: string) => {
    const s = get();
    if (!s.splits) return;
    const next = removeSplitLine(s.splits, key);
    if (next === null) {
      s.patch({
        splits: null,
        categoryId: collapsedCategory(
          s.splits.filter((line) => line.key !== key),
        ),
      });
    } else {
      s.patch({ splits: next });
    }
    if (focus === `line:${key}`) focusTarget("amount", fromDigits);
  };

  const pickCategoryFor = (lineKey: string | null) => {
    get().setPickingLine(lineKey);
    router.push("/transaction/category");
  };

  const applySuggestion = (row: TitleMemoryRow) => {
    const s = get();
    const patch: Partial<Draft> = {
      title: row.title,
      appliedTitleNorm: row.titleNorm,
    };
    const fits =
      row.categoryId &&
      categoriesAll.some((c) => c.id === row.categoryId && c.kind === s.kind);
    if (!s.splits && fits) patch.categoryId = row.categoryId;
    s.patch(patch);
    if (
      row.accountId &&
      row.accountId !== s.accountId &&
      accountsAll.some((a) => a.id === row.accountId && !a.archivedAt)
    )
      changeAccount(row.accountId);
  };

  // -- derived view data ----------------------------------------------------------------------
  const recentKind = draft.kind === "income" ? "income" : "expense";
  const recents = useRecentCategories(recentKind);
  const kindCategories = categoriesAll.filter((c) => c.kind === recentKind);
  const titleNorm = normalizeTitle(draft.title);
  const suggestions = useTitleSuggestions(draft.title, recentKind).filter(
    (row) => row.titleNorm !== titleNorm,
  );
  const showSuggestions =
    !isTransfer &&
    !isLend &&
    suggestions.length > 0 &&
    titleNorm !== draft.appliedTitleNorm;
  const selectedCategory = kindCategories.find(
    (c) => c.id === draft.categoryId,
  );
  const showKeypad = keypadOpen && inputFocus === null;
  const timeChanged = minuteOfDay(draft.occurredAt) !== initialMinute;
  const readoutMin = crossCurrency ? 152 : 80;
  // Keys take the free height (52-60): area minus readout, card, keypad padding/gaps and some breathing room.
  // The readout zone is capped at 160 pt so tall phones get bigger keys instead of a floating amount.
  const keyHeight =
    areaHeight === 0
      ? 56
      : Math.min(
          60,
          Math.floor(
            (areaHeight -
              readoutMin -
              cardHeight -
              insets.bottom -
              16 -
              24 -
              24) /
              4,
          ),
        );
  const staticDisplay = (minor: number, digits: number) =>
    deriveKeypad(createKeypadState(digits, minor)).display;
  const mainFocused = focus === "amount";
  const receivesFocused = focus === "receives";
  const symbol = currencySymbol(fromCurrency);
  const fmt = (minor: number) =>
    moneyShort(minor, fromCurrency, formatMoney, fromDigits);
  const accountOptions: MenuOption[] = activeAccounts.map((a) => ({
    value: a.id,
    label: a.name,
  }));
  const toOptions = accountOptions.filter((o) => o.value !== draft.accountId);
  const repeatSelected = !draft.repeat
    ? "never"
    : draft.repeat.interval === 1
      ? draft.repeat.frequency
      : "custom";

  const onRepeat = (value: string) => {
    const s = get();
    if (value === "custom") {
      router.push("/transaction/repeat");
      return;
    }
    if (value === "never") s.patch({ repeat: null });
    else
      s.patch({
        repeat: {
          frequency: value as "daily",
          interval: 1,
          endDate: s.repeat?.endDate ?? null,
        },
      });
  };

  const showDone = () => {
    Keyboard.dismiss();
    setKeypadOpen(true);
  };
  const cardBorder = { borderWidth: 1, borderColor: colors.border };

  if (!booted) return null;

  return (
    <View
      className="flex-1 bg-bg"
      style={{ paddingTop: Platform.OS === "ios" ? 8 : 0 }}
    >
      <View className="h-12 flex-row items-center px-2">
        <Button
          variant="barSecondary"
          size="sm"
          onPress={close}
          accessibilityLabel="Cancel"
        >
          <Text variant="body">Cancel</Text>
        </Button>
        <Text
          variant="headline"
          accessibilityRole="header"
          numberOfLines={1}
          className="mx-2 min-w-0 flex-1 text-center"
        >
          {mode === "edit" ? "Edit" : "New"}
        </Text>
        {mode === "edit" ? (
          <Pressable
            role="button"
            accessibilityLabel="Delete transaction"
            haptic="light"
            hitSlop={4}
            onPress={onDelete}
            className="h-9 w-9 items-center justify-center"
          >
            <AppIcon name="trash" size={19} color={colors.accent} />
          </Pressable>
        ) : null}
        {/* Opacity goes on the label: Button's text-variant press animation pins the button's own opacity to 1, overriding `opacity-40`. */}
        <Button
          variant="barPrimary"
          size="sm"
          disabled={isSaveDisabled(block)}
          onPress={submit}
          accessibilityLabel="Save"
        >
          <Text
            variant="headline"
            style={isSaveDisabled(block) ? { opacity: 0.4 } : undefined}
          >
            Save
          </Text>
        </Button>
      </View>
      <View className="px-4 pb-1 pt-1">
        <SegmentedControl
          values={KIND_LABELS}
          selectedIndex={KIND_SEGMENTS.indexOf(segmentOf(draft.kind))}
          onChange={changeKind}
          accessibilityLabel="Transaction type"
          tintColor={kindColor}
          className="w-full"
        />
      </View>

      <View
        className="flex-1"
        style={{ paddingBottom: inputFocus ? keyboardInset : 0 }}
        onLayout={(event) => setAreaHeight(event.nativeEvent.layout.height)}
      >
        {/* No ScrollView: everything fits by design, and a capped, centred readout zone overflowed upward into the
            kind selector on device. The readout zone takes the free height and centres the amount instead. */}
        <View className="flex-1 pb-3">
          <View
            className="flex-1 justify-center py-2"
            style={{ minHeight: inputFocus ? 56 : crossCurrency ? 152 : 96 }}
          >
            <View style={{ opacity: receivesFocused ? 0.45 : 1 }}>
              <AmountReadout
                symbol={symbol}
                value={
                  mainFocused
                    ? view.display
                    : staticDisplay(draft.amount, fromDigits)
                }
                expression={mainFocused ? view.expression : ""}
                color={kindColor}
                onPress={() => focusTarget("amount")}
                accessibilityLabel={`Amount, ${formatMoneyForSpeech(draft.amount, fromCurrency, { sign: "none" })}`}
              />
            </View>
            {crossCurrency ? (
              <View style={{ opacity: receivesFocused ? 1 : 0.7 }}>
                <AmountReadout
                  symbol={currencySymbol(toCurrency)}
                  value={
                    receivesFocused
                      ? view.display
                      : staticDisplay(ctx.receivesAmount, toDigits)
                  }
                  expression={
                    receivesFocused && view.expression
                      ? `Receives  ${view.expression}`
                      : "Receives"
                  }
                  color={kindColor}
                  onPress={() => focusTarget("receives")}
                  accessibilityLabel={`Receives, ${formatMoneyForSpeech(ctx.receivesAmount, toCurrency, { sign: "none" })}`}
                />
              </View>
            ) : null}
          </View>

          <View
            className="mx-4 overflow-hidden rounded-2xl bg-surface"
            style={cardBorder}
            onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
          >
            <Input
              variant="inline"
              value={draft.title}
              onChangeText={(title) => get().patch({ title })}
              placeholder="Title"
              accessibilityLabel="Title"
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={showDone}
              onFocus={() => setInputFocus("title")}
              onBlur={() =>
                setInputFocus((cur) => (cur === "title" ? null : cur))
              }
              inputAccessoryViewID={ACCESSORY_ID}
              className="h-12 px-4 py-0"
            />
            {showSuggestions ? (
              <View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerClassName="items-center gap-2 px-4 pb-3"
                >
                  {suggestions.map((row) => (
                    <FormChip
                      key={row.titleNorm}
                      label={row.title}
                      hint={
                        row.lastAmount != null && row.lastCurrency
                          ? moneyShort(
                              row.lastAmount,
                              row.lastCurrency,
                              formatMoney,
                              minorDigits(row.lastCurrency),
                            )
                          : undefined
                      }
                      onPress={() => applySuggestion(row)}
                      accessibilityLabel={`Use ${row.title}`}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <Hairline />

            <View>
              {isTransfer ? (
                <View className="h-14 flex-row items-center gap-2 px-4">
                  <View className="min-w-0 shrink">
                    <MenuChip
                      label={accountOf(draft.accountId)?.name ?? "From"}
                      icon="creditcard"
                      title="From"
                      options={accountOptions}
                      selected={draft.accountId}
                      onSelect={changeAccount}
                      accessibilityLabel={`From account, ${accountOf(draft.accountId)?.name ?? "none"}`}
                      shrink
                    />
                  </View>
                  <AppIcon
                    name="arrow.right"
                    size={13}
                    color={colors.textTertiary}
                  />
                  <View className="min-w-0 shrink">
                    <MenuChip
                      label={accountOf(draft.transferAccountId)?.name ?? "To"}
                      icon="creditcard"
                      title="To"
                      options={toOptions}
                      selected={draft.transferAccountId}
                      onSelect={changeToAccount}
                      accessibilityLabel={`To account, ${accountOf(draft.transferAccountId)?.name ?? "none"}`}
                      shrink
                    />
                  </View>
                </View>
              ) : isLend ? (
                <ShakeView trigger={personShake}>
                  <View className="h-14 flex-row items-center gap-3 px-4">
                    <SegmentedControl
                      values={lendToggle(draft.kind as never).labels}
                      selectedIndex={lendToggle(
                        draft.kind as never,
                      ).kinds.indexOf(draft.kind as never)}
                      onChange={(i) => {
                        const next = lendToggle(draft.kind as never).kinds[i];
                        if (next) get().patch({ kind: next });
                      }}
                      accessibilityLabel="Lending direction"
                      className="w-[168px]"
                    />
                    <View className="min-w-0 flex-1 items-end">
                      <FormChip
                        label={person?.name ?? "Person"}
                        icon="person"
                        selected={!!person}
                        shrink
                        onPress={() => router.push("/transaction/person")}
                        accessibilityLabel={`Person, ${person?.name ?? "none"}`}
                      />
                    </View>
                  </View>
                </ShakeView>
              ) : draft.splits ? (
                <SplitList
                  lines={draft.splits}
                  total={draft.amount}
                  categories={kindCategories}
                  focusKey={focus.startsWith("line:") ? focus.slice(5) : null}
                  liveDisplay={view.display}
                  symbol={symbol}
                  formatAmount={fmt}
                  shakeTrigger={splitShake}
                  onFocusLine={(key) => focusTarget(`line:${key}`)}
                  onPickCategory={pickCategoryFor}
                  onRemoveLine={removeLine}
                  onAddLine={() => {
                    const s = get();
                    if (s.splits) s.patch({ splits: addSplitLine(s.splits) });
                  }}
                  onRemoveSplit={removeSplit}
                />
              ) : (
                <CategoryRowView
                  recents={recents}
                  selected={selectedCategory}
                  shakeTrigger={catShake}
                  onSelect={(id) => get().patch({ categoryId: id })}
                  onAll={() => pickCategoryFor(null)}
                />
              )}
            </View>
            <Hairline />

            <View className="h-14 flex-row items-center">
              <View className="h-14 min-w-0 flex-1">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  className="flex-1"
                  contentContainerClassName="items-center gap-2 pl-4 pr-6"
                >
                  {isTransfer ? null : (
                    <View>
                      <MenuChip
                        label={accountOf(draft.accountId)?.name ?? "Account"}
                        icon="creditcard"
                        title="Account"
                        options={accountOptions}
                        selected={draft.accountId}
                        onSelect={changeAccount}
                        accessibilityLabel={`Account, ${accountOf(draft.accountId)?.name ?? "none"}`}
                      />
                    </View>
                  )}
                  <View>
                    <FormChip
                      label={dateChipLabel(
                        draft.occurredAt,
                        todayKey,
                        timeChanged,
                      )}
                      icon="calendar"
                      onPress={() => router.push("/transaction/date")}
                      accessibilityLabel={`Date, ${dateChipLabel(draft.occurredAt, todayKey, timeChanged)}`}
                    />
                  </View>
                  <View>
                    <FormChip
                      label={
                        draftTags.length === 0
                          ? "Tags"
                          : draftTags.length === 1
                            ? (draftTags[0]?.name ?? "Tags")
                            : `${draftTags.length} tags`
                      }
                      icon="tag"
                      selected={draftTags.length > 0}
                      onPress={() => router.push("/transaction/tags")}
                      accessibilityLabel={`Tags, ${draftTags.length === 0 ? "none" : draftTags.map((t) => t.name).join(", ")}`}
                    />
                  </View>
                  <View>
                    <MenuChip
                      label="Receipt"
                      icon="camera"
                      title="Receipt"
                      options={RECEIPT_OPTIONS}
                      selected={null}
                      onSelect={(value) => void addReceipt(value)}
                      highlight={draft.receipts.length > 0}
                      accessibilityLabel={`Receipt, ${draft.receipts.length === 0 ? "none" : `${draft.receipts.length} attached`}`}
                    />
                  </View>
                  {isLend ? null : (
                    <View>
                      {linkedRule ? (
                        <FormChip
                          label={repeatLabel(linkedRule)}
                          icon="repeat"
                          selected
                          onPress={() =>
                            router.push(`/recurring/${linkedRule.id}` as Href)
                          }
                          accessibilityLabel={`Repeats, ${repeatLabel(linkedRule)}`}
                        />
                      ) : (
                        <MenuChip
                          label={repeatLabel(draft.repeat)}
                          icon="repeat"
                          title="Repeat"
                          options={REPEAT_OPTIONS}
                          selected={repeatSelected}
                          onSelect={onRepeat}
                          highlight={draft.repeat !== null}
                          accessibilityLabel={`Repeat, ${repeatLabel(draft.repeat)}`}
                        />
                      )}
                    </View>
                  )}
                </ScrollView>
                <EdgeFade color={colors.surface} />
              </View>
              {isTransfer || isLend || draft.splits ? null : (
                <Button
                  variant="plainText"
                  size="sm"
                  onPress={startSplitting}
                  accessibilityLabel="Split"
                  className="mr-2 px-2"
                >
                  <Text variant="callout" tone="accent">
                    Split
                  </Text>
                </Button>
              )}
            </View>
            <Hairline />

            <Input
              variant="inline"
              value={draft.memo}
              onChangeText={(memo) => get().patch({ memo })}
              placeholder="Memo"
              accessibilityLabel="Memo"
              multiline
              numberOfLines={1}
              autoCapitalize="sentences"
              onFocus={() => setInputFocus("memo")}
              onBlur={() =>
                setInputFocus((cur) => (cur === "memo" ? null : cur))
              }
              inputAccessoryViewID={ACCESSORY_ID}
              className="max-h-[84px] min-h-12 px-4 py-3"
            />
            {draftTags.length > 0 || draft.receipts.length > 0 ? (
              <>
                <Hairline />
                <View className="gap-3 px-4 py-3">
                  {draftTags.length > 0 ? (
                    <TagPills
                      tags={draftTags}
                      onPressTag={() => router.push("/transaction/tags")}
                    />
                  ) : null}
                  {draft.receipts.length > 0 ? (
                    <View className="flex-row flex-wrap gap-3 pt-1.5">
                      {draft.receipts.map((r) => (
                        <ReceiptThumb
                          key={r.key}
                          uri={r.uri}
                          size={48}
                          onPress={() => openReceipt(r.uri, r.width, r.height)}
                          onRemove={() => removeReceipt(r.key)}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </View>

        {showKeypad ? (
          <View className="bg-bg" style={{ paddingBottom: insets.bottom }}>
            <Keypad
              keyHeight={keyHeight}
              onKey={onKey}
              onLongBackspace={() => {
                const next = keypadReducer(entry, "clear");
                setEntry(next);
                commit(focus, 0);
              }}
              showDecimal={digitsOf(focus) > 0}
              saveMode={view.equalsIsSave}
              saveDisabled={isSaveDisabled(block)}
              saveColor={kindColor}
            />
          </View>
        ) : null}
      </View>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View className="h-11 flex-row items-center justify-end border-t border-border bg-surface px-2">
            <Button
              variant="barPrimary"
              size="sm"
              onPress={showDone}
              accessibilityLabel="Done"
            >
              <Text variant="headline">Done</Text>
            </Button>
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
}

export { TransactionForm };
