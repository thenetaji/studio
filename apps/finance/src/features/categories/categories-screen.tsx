import { Stack, useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, View } from "react-native";

import {
  HeaderButton,
  barRight,
  OptionPicker,
  showToast,
  Button,
  Card,
  Text,
} from "@studio/ui";
import { useActions } from "@/data/actions";
import { useCategories, useCategoryTransactionCounts } from "@/data/hooks";
import { ValidationError } from "@/db/errors";
import type { CategoryRow as CategoryData } from "@/db/schema";
import { ReorderList } from "@/features/accounts/reorder-list";
import {
  SwipeDelete,
  SwipeGroup,
  useSwipeGuard,
} from "@/features/entry/swipe-delete";

import { CATEGORY_ROW_HEIGHT, CategoryRow } from "./category-row";

type SectionProps = {
  title: string;
  categories: CategoryData[];
  counts: Record<string, number>;
  editing: boolean;
  onOpen: (id: string) => void;
  onDelete: (category: CategoryData) => void;
  onReorder: (ids: string[]) => void;
  onDragChange: (dragging: boolean) => void;
};

function Section({
  title,
  categories,
  counts,
  editing,
  onOpen,
  onDelete,
  onReorder,
  onDragChange,
}: SectionProps) {
  const guard = useSwipeGuard();
  const byId = new Map(categories.map((c) => [c.id, c]));
  const deletable = categories.length > 1;
  return (
    <View className="px-4">
      <Text
        variant="footnote"
        tone="secondary"
        className="px-4 pb-2"
        accessibilityRole="header"
      >
        {title}
      </Text>
      <Card className="overflow-hidden p-0">
        {editing ? (
          <ReorderList
            ids={categories.map((c) => c.id)}
            rowHeight={CATEGORY_ROW_HEIGHT}
            labelOf={(id) => byId.get(id)?.name ?? ""}
            onReorder={onReorder}
            onDragChange={onDragChange}
            renderRow={(id, handle, last) => {
              const category = byId.get(id);
              return category ? (
                <CategoryRow
                  category={category}
                  count={counts[id] ?? 0}
                  separator={!last}
                  onPress={() => onOpen(id)}
                  trailing={handle}
                />
              ) : null;
            }}
          />
        ) : (
          categories.map((category, index) => {
            const row = (
              <CategoryRow
                category={category}
                count={counts[category.id] ?? 0}
                separator={index < categories.length - 1}
                onPress={() => {
                  if (!guard()) onOpen(category.id);
                }}
              />
            );
            return deletable ? (
              <SwipeDelete
                key={category.id}
                onDelete={() => onDelete(category)}
              >
                {row}
              </SwipeDelete>
            ) : (
              <React.Fragment key={category.id}>{row}</React.Fragment>
            );
          })
        )}
      </Card>
    </View>
  );
}

const movePrompt = (count: number) =>
  count === 0
    ? "Move its rules and budgets to…"
    : `Move ${count} ${count === 1 ? "transaction" : "transactions"} to…`;

/**
 * Expense and Income sections. Edit reorders by dragging the handles; swiping a row deletes it. A category
 * nothing uses goes at once (with Undo); otherwise its transactions, rules and budgets move to a category
 * you choose first.
 */
export function CategoriesScreen() {
  const router = useRouter();
  const actions = useActions();
  const expense = useCategories("expense");
  const income = useCategories("income");
  const counts = useCategoryTransactionCounts();
  const [editing, setEditing] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CategoryData | null>(null);

  const open = (id: string) =>
    router.push({ pathname: "/categories/[id]", params: { id } });
  const add = () =>
    router.push({ pathname: "/categories/[id]", params: { id: "new" } });

  const remove = (category: CategoryData) => {
    try {
      const removed = actions.categories.deleteUnused(category.id);
      showToast({
        message: "Deleted",
        actionLabel: "Undo",
        onAction: () => actions.categories.restore(removed),
      });
    } catch (error) {
      if (!(error instanceof ValidationError) || error.code !== "in_use")
        throw error;
      setDeleting(category);
    }
  };

  const targets = deleting
    ? (deleting.kind === "income" ? income : expense).filter(
        (c) => c.id !== deleting.id,
      )
    : [];
  const move = (targetId: string | null) => {
    if (!deleting || !targetId) return;
    const target = targets.find((c) => c.id === targetId);
    actions.categories.delete(deleting.id, targetId);
    showToast({
      message: target ? `Deleted, moved to ${target.name}` : "Deleted",
    });
  };

  const section = (title: string, list: CategoryData[]) => (
    <Section
      title={title}
      categories={list}
      counts={counts}
      editing={editing}
      onOpen={open}
      onDelete={remove}
      onReorder={(ids) => actions.categories.reorder(ids)}
      onDragChange={setDragging}
    />
  );

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 pb-12 pt-4"
      scrollEnabled={!dragging}
    >
      <Stack.Screen
        options={{
          title: "Categories",
          ...barRight(
            <View className="flex-row items-center">
              {/* Fixed width: Edit and Done differ in width, and the header must not shift when toggling. */}
              <View className="w-16 items-end">
                <Button
                  variant="barPrimary"
                  size="sm"
                  onPress={() => setEditing((v) => !v)}
                  accessibilityLabel={editing ? "Done" : "Edit"}
                >
                  <Text variant="headline">{editing ? "Done" : "Edit"}</Text>
                </Button>
              </View>
              <HeaderButton symbol="plus" label="Add category" onPress={add} />
            </View>,
          ),
        }}
      />
      <SwipeGroup>
        <View className="gap-6">
          {section("Expense", expense)}
          {section("Income", income)}
        </View>
      </SwipeGroup>
      <OptionPicker
        visible={deleting !== null}
        title={movePrompt(deleting ? (counts[deleting.id] ?? 0) : 0)}
        options={targets.map((c) => ({ value: c.id, label: c.name }))}
        selected={null}
        onSelect={move}
        onClose={() => setDeleting(null)}
      />
    </ScrollView>
  );
}
