import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { InteractionManager, Platform, View } from "react-native";

import {
  Card,
  Chip,
  IconTile,
  Input,
  ListGroup,
  SegmentedControl,
  SheetScroll,
  Text,
} from "@studio/ui";
import { useActions } from "@/data/actions";
import { useCategories } from "@/data/hooks";
import { ValidationError } from "@/db/errors";
import type { CategoryKind } from "@/db/schema";
import { FormRow } from "@/features/entry/form-row";
import { useSheetHeader } from "@/features/entry/sheet-header";
import { useKeyboardInset } from "@/features/entry/use-keyboard-inset";
import { haptic } from "@studio/theme";
import type { CategoryColorKey } from "@studio/theme";

import { IconGrid } from "./icon-grid";
import { CATEGORY_SWATCHES, Swatches } from "./swatches";

const KINDS: readonly CategoryKind[] = ["expense", "income"];
const KIND_LABELS: Record<CategoryKind, string> = {
  expense: "Expense",
  income: "Income",
};
/** Height the icon grid reserves before it mounts, so the sheet does not jump. */
const GRID_PLACEHOLDER = 420;

type CategoryFormProps = { id: string };

/** Create (`id` is "new") or edit a category: live preview, name, kind (locked after creation), group, colour and icon. */
export function CategoryForm({ id }: CategoryFormProps) {
  const router = useRouter();
  const actions = useActions();
  const params = useLocalSearchParams<{ kind?: string; name?: string }>();
  const all = useCategories();
  const creating = id === "new";
  // Dev only: `?name=Groceries` resolves a category by name, so screenshots need no generated id.
  const source = creating
    ? undefined
    : (all.find((c) => c.id === id) ??
      (Platform.OS === "web"
        ? all.find((c) => c.name === params.name)
        : undefined));

  const [name, setName] = React.useState(source?.name ?? "");
  const [kind, setKind] = React.useState<CategoryKind>(
    source?.kind ?? (params.kind === "income" ? "income" : "expense"),
  );
  const [group, setGroup] = React.useState(source?.groupName ?? "");
  const groups = React.useMemo(() => {
    const seen = new Set<string>();
    for (const c of all)
      if (c.kind === kind && c.groupName) seen.add(c.groupName);
    return [...seen];
  }, [all, kind]);
  const [icon, setIcon] = React.useState(source?.icon ?? "tag.fill");
  // A new category suggests the next unused swatch for its kind until a colour is picked.
  const [picked, setPicked] = React.useState<CategoryColorKey | null>(
    (source?.color as CategoryColorKey | undefined) ?? null,
  );
  const color: CategoryColorKey =
    picked ??
    CATEGORY_SWATCHES[
      all.filter((c) => c.kind === kind).length % CATEGORY_SWATCHES.length
    ] ??
    "blue";

  // The icon grid is a few hundred tiles; mounting it after the sheet's entrance keeps the slide smooth.
  const [gridReady, setGridReady] = React.useState(false);
  React.useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() =>
      setGridReady(true),
    );
    return () => task.cancel();
  }, []);

  const keyboardInset = useKeyboardInset();

  const close = () => {
    if (router.canDismiss()) router.dismiss();
    else if (router.canGoBack()) router.back();
    else router.replace("/settings/categories");
  };

  const disabled = name.trim().length === 0;
  const save = () => {
    if (disabled) {
      haptic("error");
      return;
    }
    try {
      if (source)
        actions.categories.update(source.id, {
          name,
          icon,
          color,
          groupName: group,
        });
      else
        actions.categories.create({
          name,
          kind,
          icon,
          color,
          groupName: group,
        });
    } catch (error) {
      haptic("error");
      if (error instanceof ValidationError) return;
      throw error;
    }
    haptic("success");
    close();
  };

  const header = useSheetHeader({
    title: creating ? "New category" : "Edit category",
    onCancel: close,
    onSave: save,
    saveDisabled: disabled,
  });
  if (!creating && !source) return null;

  return (
    // The scroll view is the sheet's only root (docs/CONVENTIONS.md, Sheets): a toolbar View above it
    // left the body offset under the toolbar on iOS.
    <SheetScroll
      header={header}
      bodyClassName="gap-4 pt-2"
      contentContainerStyle={{ paddingBottom: 32 + keyboardInset }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View
        className="items-center gap-3 pb-2 pt-2"
        accessibilityLabel={`Preview, ${name.trim() || "Name"}`}
      >
        <IconTile icon={icon} color={color} size={72} />
        <Text
          variant="title2"
          tone={name.trim() ? "default" : "tertiary"}
          numberOfLines={1}
          className="px-6"
        >
          {name.trim() || "Name"}
        </Text>
      </View>
      <View className="px-4">
        <SegmentedControl
          values={KINDS.map((k) => KIND_LABELS[k])}
          selectedIndex={KINDS.indexOf(kind)}
          onChange={(index) => setKind(KINDS[index] ?? "expense")}
          disabled={!creating}
          accessibilityLabel="Kind"
        />
      </View>
      <ListGroup>
        <FormRow label="Name">
          <Input
            variant="inline"
            value={name}
            onChangeText={setName}
            placeholder="Required"
            returnKeyType="done"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={32}
            accessibilityLabel="Name"
            className="h-6 min-h-0 flex-1 py-0 text-right"
          />
        </FormRow>
        <FormRow label="Group">
          <Input
            variant="inline"
            value={group}
            onChangeText={setGroup}
            placeholder="None"
            returnKeyType="done"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={24}
            accessibilityLabel="Group"
            className="h-6 min-h-0 flex-1 py-0 text-right"
          />
        </FormRow>
      </ListGroup>
      {groups.length > 0 ? (
        <View className="-mt-1 flex-row flex-wrap gap-2 px-8">
          {groups.map((g) => (
            <Chip
              key={g}
              label={g}
              selected={g === group.trim()}
              onPress={() => setGroup(g === group.trim() ? "" : g)}
            />
          ))}
        </View>
      ) : null}
      <View className="px-4">
        <Text
          variant="footnote"
          tone="secondary"
          className="px-4 pb-2"
          accessibilityRole="header"
        >
          Colour
        </Text>
        <Card className="px-3 pb-1 pt-4">
          <Swatches value={color} onChange={setPicked} />
        </Card>
      </View>
      <View className="px-4">
        <Text
          variant="footnote"
          tone="secondary"
          className="px-4 pb-2"
          accessibilityRole="header"
        >
          Icon
        </Text>
        <Card>
          {gridReady ? (
            <IconGrid value={icon} color={color} onChange={setIcon} />
          ) : (
            <View style={{ height: GRID_PLACEHOLDER }} />
          )}
        </Card>
      </View>
    </SheetScroll>
  );
}
