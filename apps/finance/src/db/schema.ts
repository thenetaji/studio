import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { RecurringKind, TransactionKind } from "../lib/ledger/kinds";

export type AccountType = "cash" | "bank" | "card" | "other";
export type CategoryKind = "expense" | "income";
export type {
  LendingKind,
  RecurringKind,
  TransactionKind,
} from "../lib/ledger/kinds";
export type Frequency = "daily" | "weekly" | "monthly" | "yearly";
export type BudgetPeriod = "weekly" | "monthly" | "yearly";
export type BudgetScope = "all" | "categories";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").$type<AccountType>().notNull(),
  currency: text("currency").notNull(),
  openingBalance: integer("opening_balance").notNull().default(0),
  color: text("color").notNull(),
  icon: text("icon").notNull(),
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  archivedAt: integer("archived_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").$type<CategoryKind>().notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    /** Optional group name ("Essentials") that Insights can roll categories up into; null stands alone. */
    groupName: text("group_name"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: integer("archived_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("categories_kind_sort_idx").on(t.kind, t.sortOrder)],
);

export const recurringRules = sqliteTable(
  "recurring_rules",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<RecurringKind>().notNull(),
    title: text("title").notNull(),
    memo: text("memo").notNull().default(""),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    categoryId: text("category_id").references(() => categories.id),
    transferAccountId: text("transfer_account_id").references(
      () => accounts.id,
    ),
    transferAmount: integer("transfer_amount"),
    frequency: text("frequency").$type<Frequency>().notNull(),
    interval: integer("interval").notNull().default(1),
    anchorDay: integer("anchor_day"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    nextDue: text("next_due").notNull(),
    autoPost: integer("auto_post", { mode: "boolean" }).notNull().default(true),
    pausedAt: integer("paused_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("recurring_rules_next_due_idx").on(t.nextDue)],
);

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("tags_name_unique").on(t.name)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<TransactionKind>().notNull(),
    title: text("title").notNull().default(""),
    memo: text("memo").notNull().default(""),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    categoryId: text("category_id").references(() => categories.id),
    transferAccountId: text("transfer_account_id").references(
      () => accounts.id,
    ),
    transferAmount: integer("transfer_amount"),
    transferCurrency: text("transfer_currency"),
    occurredAt: integer("occurred_at").notNull(),
    dateKey: text("date_key").notNull(),
    isSplit: integer("is_split", { mode: "boolean" }).notNull().default(false),
    recurringRuleId: text("recurring_rule_id").references(
      () => recurringRules.id,
    ),
    /** Counterparty of the lending kinds; null otherwise. */
    personId: text("person_id").references(() => people.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("transactions_person_idx").on(t.personId),
    index("transactions_date_idx").on(
      sql`${t.dateKey} desc`,
      sql`${t.occurredAt} desc`,
    ),
    index("transactions_account_date_idx").on(t.accountId, t.dateKey),
    index("transactions_category_date_idx").on(t.categoryId, t.dateKey),
    index("transactions_rule_idx").on(t.recurringRuleId),
    index("transactions_transfer_account_idx").on(t.transferAccountId),
  ],
);

export const transactionSplits = sqliteTable(
  "transaction_splits",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    amount: integer("amount").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    index("transaction_splits_tx_idx").on(t.transactionId),
    index("transaction_splits_category_idx").on(t.categoryId),
  ],
);

export const transactionTags = sqliteTable(
  "transaction_tags",
  {
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.transactionId, t.tagId] }),
    index("transaction_tags_tag_idx").on(t.tagId),
  ],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    uri: text("uri").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("attachments_tx_idx").on(t.transactionId)],
);

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  period: text("period").$type<BudgetPeriod>().notNull(),
  startAnchor: integer("start_anchor").notNull(),
  scope: text("scope").$type<BudgetScope>().notNull(),
  /** Envelope rollover: the previous period's leftover (or overspend) carries into this one. */
  rollover: integer("rollover", { mode: "boolean" }).notNull().default(false),
  archivedAt: integer("archived_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const budgetCategories = sqliteTable(
  "budget_categories",
  {
    budgetId: text("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.budgetId, t.categoryId] })],
);

export const titleMemory = sqliteTable(
  "title_memory",
  {
    titleNorm: text("title_norm").primaryKey(),
    title: text("title").notNull(),
    kind: text("kind").$type<CategoryKind>().notNull(),
    categoryId: text("category_id"),
    accountId: text("account_id"),
    lastAmount: integer("last_amount"),
    lastCurrency: text("last_currency"),
    useCount: integer("use_count").notNull().default(1),
    lastUsedAt: integer("last_used_at").notNull(),
  },
  (t) => [
    index("title_memory_kind_idx").on(
      t.kind,
      sql`${t.useCount} desc`,
      sql`${t.lastUsedAt} desc`,
    ),
  ],
);

export const fxRates = sqliteTable(
  "fx_rates",
  {
    base: text("base").notNull(),
    quote: text("quote").notNull(),
    rate: real("rate").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote] })],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const schema = {
  accounts,
  categories,
  recurringRules,
  transactions,
  transactionSplits,
  people,
  tags,
  transactionTags,
  attachments,
  budgets,
  budgetCategories,
  titleMemory,
  fxRates,
  settings,
};

export type Schema = typeof schema;

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type CategoryRow = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type TransactionRow = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type PersonRow = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type TagRow = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type TransactionTagRow = typeof transactionTags.$inferSelect;
export type AttachmentRow = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type SplitRow = typeof transactionSplits.$inferSelect;
export type NewSplit = typeof transactionSplits.$inferInsert;
export type RecurringRuleRow = typeof recurringRules.$inferSelect;
export type NewRecurringRule = typeof recurringRules.$inferInsert;
export type BudgetRow = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type BudgetCategoryRow = typeof budgetCategories.$inferSelect;
export type TitleMemoryRow = typeof titleMemory.$inferSelect;
export type FxRateRow = typeof fxRates.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
