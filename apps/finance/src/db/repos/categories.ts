import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { ValidationError } from "../errors";
import { newId } from "@studio/data";
import {
  budgetCategories,
  categories,
  recurringRules,
  titleMemory,
  transactionSplits,
  transactions,
  type CategoryKind,
  type CategoryRow,
} from "../schema";
import type { Db } from "../types";

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  /** Blank or null leaves the category ungrouped. */
  groupName?: string | null;
}

export type CategoryPatch = Partial<Omit<CategoryInput, "kind">>;

/** Trims and collapses whitespace; blank means no group. */
export function normalizeGroupName(
  value: string | null | undefined,
): string | null {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  return trimmed.length === 0 ? null : trimmed;
}

/** Distinct group names in use for `kind`, in category order (archived categories excluded). */
export function listCategoryGroups(db: Db, kind: CategoryKind): string[] {
  const seen = new Set<string>();
  for (const row of listCategories(db, kind)) {
    if (row.groupName) seen.add(row.groupName);
  }
  return [...seen];
}

export function getCategory(db: Db, id: string): CategoryRow | undefined {
  return db.select().from(categories).where(eq(categories.id, id)).get();
}

export function listCategories(
  db: Db,
  kind?: CategoryKind,
  options: { includeArchived?: boolean } = {},
): CategoryRow[] {
  const conditions = [
    kind ? eq(categories.kind, kind) : undefined,
    options.includeArchived ? undefined : isNull(categories.archivedAt),
  ];
  return db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(
      asc(categories.kind),
      asc(categories.sortOrder),
      asc(categories.createdAt),
    )
    .all();
}

export function createCategory(
  db: Db,
  input: CategoryInput,
  now = Date.now(),
): CategoryRow {
  const max = db
    .select({ max: sql<number | null>`max(${categories.sortOrder})` })
    .from(categories)
    .where(eq(categories.kind, input.kind))
    .get();
  const row: CategoryRow = {
    id: newId(),
    name: input.name.trim(),
    kind: input.kind,
    icon: input.icon,
    color: input.color,
    groupName: normalizeGroupName(input.groupName),
    sortOrder: (max?.max ?? -1) + 1,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(categories).values(row).run();
  return row;
}

export function updateCategory(
  db: Db,
  id: string,
  patch: CategoryPatch,
  now = Date.now(),
): void {
  if (!getCategory(db, id)) throw new ValidationError("category_not_found");
  db.update(categories)
    .set({
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      ...(patch.icon !== undefined && { icon: patch.icon }),
      ...(patch.color !== undefined && { color: patch.color }),
      ...(patch.groupName !== undefined && {
        groupName: normalizeGroupName(patch.groupName),
      }),
      updatedAt: now,
    })
    .where(eq(categories.id, id))
    .run();
}

export function reorderCategories(db: Db, orderedIds: readonly string[]): void {
  db.transaction((tx) => {
    orderedIds.forEach((id, index) => {
      tx.update(categories)
        .set({ sortOrder: index })
        .where(eq(categories.id, id))
        .run();
    });
  });
}

export function archiveCategory(db: Db, id: string, now = Date.now()): void {
  db.update(categories)
    .set({ archivedAt: now, updatedAt: now })
    .where(eq(categories.id, id))
    .run();
}

/** Rows that point at a category: transactions, split lines, recurring rules and budget scopes. */
export function countCategoryUsage(db: Db, id: string): number {
  const n = sql<number>`count(*)`;
  return (
    (db
      .select({ n })
      .from(transactions)
      .where(eq(transactions.categoryId, id))
      .get()?.n ?? 0) +
    (db
      .select({ n })
      .from(transactionSplits)
      .where(eq(transactionSplits.categoryId, id))
      .get()?.n ?? 0) +
    (db
      .select({ n })
      .from(recurringRules)
      .where(eq(recurringRules.categoryId, id))
      .get()?.n ?? 0) +
    (db
      .select({ n })
      .from(budgetCategories)
      .where(eq(budgetCategories.categoryId, id))
      .get()?.n ?? 0)
  );
}

/** Transactions (and split lines) per category id, for every category that has any. */
export function transactionCountsByCategory(db: Db): Record<string, number> {
  const counts: Record<string, number> = {};
  const n = sql<number>`count(*)`;
  const rows = [
    ...db
      .select({ id: transactions.categoryId, n })
      .from(transactions)
      .groupBy(transactions.categoryId)
      .all(),
    ...db
      .select({ id: transactionSplits.categoryId, n })
      .from(transactionSplits)
      .groupBy(transactionSplits.categoryId)
      .all(),
  ];
  for (const row of rows)
    if (row.id) counts[row.id] = (counts[row.id] ?? 0) + row.n;
  return counts;
}

/**
 * Deletes a category nothing refers to (see `countCategoryUsage`) and returns it for `restoreCategory`.
 * Remembered titles that pointed at it are forgotten.
 */
export function deleteUnusedCategory(db: Db, id: string): CategoryRow {
  return db.transaction((tx) => {
    const category = getCategory(tx, id);
    if (!category) throw new ValidationError("category_not_found");
    if (countCategoryUsage(tx, id) > 0) throw new ValidationError("in_use");
    tx.delete(titleMemory).where(eq(titleMemory.categoryId, id)).run();
    tx.delete(categories).where(eq(categories.id, id)).run();
    return category;
  });
}

/** Puts back a category removed by `deleteUnusedCategory` (the Undo of that delete). */
export function restoreCategory(db: Db, row: CategoryRow): void {
  db.insert(categories).values(row).onConflictDoNothing().run();
}

/** Reassigns every reference (transactions, splits, rules, title memory, budgets) to `targetId`, then deletes. */
export function deleteCategory(db: Db, id: string, targetId: string): void {
  db.transaction((tx) => {
    const category = getCategory(tx, id);
    if (!category) throw new ValidationError("category_not_found");
    if (!targetId || targetId === id)
      throw new ValidationError("target_required");
    const target = getCategory(tx, targetId);
    if (!target) throw new ValidationError("category_not_found");
    if (target.kind !== category.kind)
      throw new ValidationError("target_kind_mismatch");

    tx.update(transactions)
      .set({ categoryId: targetId })
      .where(eq(transactions.categoryId, id))
      .run();
    tx.update(transactionSplits)
      .set({ categoryId: targetId })
      .where(eq(transactionSplits.categoryId, id))
      .run();
    tx.update(recurringRules)
      .set({ categoryId: targetId })
      .where(eq(recurringRules.categoryId, id))
      .run();
    tx.update(titleMemory)
      .set({ categoryId: targetId })
      .where(eq(titleMemory.categoryId, id))
      .run();

    const scoped = tx
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.categoryId, id))
      .all();
    for (const link of scoped) {
      tx.insert(budgetCategories)
        .values({ budgetId: link.budgetId, categoryId: targetId })
        .onConflictDoNothing()
        .run();
    }
    tx.delete(budgetCategories)
      .where(eq(budgetCategories.categoryId, id))
      .run();
    tx.delete(categories).where(eq(categories.id, id)).run();
  });
}
