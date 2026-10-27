import Constants from "expo-constants";
import { useMemo } from "react";
import * as accounts from "@/db/repos/accounts";
import * as attachments from "@/db/repos/attachments";
import * as backup from "@/db/repos/backup";
import * as budgets from "@/db/repos/budgets";
import * as categories from "@/db/repos/categories";
import * as fx from "@/db/repos/fx";
import * as importer from "@/db/repos/importer";
import * as maintenance from "@/db/repos/maintenance";
import * as people from "@/db/repos/people";
import * as recurring from "@/db/repos/recurring";
import * as settings from "@/db/repos/settings";
import * as tags from "@/db/repos/tags";
import * as transactions from "@/db/repos/transactions";
import { useDb } from "@/db/context";
import { seedDemoData } from "@/db/dev-seed";
import type { Db } from "@/db/types";
import {
  copyIntoAttachments,
  deleteAttachmentFile,
  pickBackupFile,
  shareBackupFile,
  type PickedImage,
} from "@/lib/files";
import {
  requestReminderPermission,
  rescheduleAll,
  scheduleRemindersSoon,
} from "@/lib/reminders";
import {
  getSyncProvider,
  syncNow,
  type SyncOutcome,
  type SyncProvider,
} from "@/lib/sync";
import { notifyChange } from "./changes";

type Write<A extends unknown[], R> = (...args: A) => R;

/** Binds a repository write to `db` and refreshes live hooks once it returns. */
function bind(db: Db) {
  return <A extends unknown[], R>(fn: (db: Db, ...args: A) => R): Write<A, R> =>
    (...args) => {
      const result = fn(db, ...args);
      notifyChange();
      return result;
    };
}

const appVersion = (): string => Constants.expoConfig?.version ?? "0.0.0";

export function createActions(db: Db) {
  const plain = bind(db);
  /** Like `plain`, and re-plans local notifications afterwards (debounced; no-op until `useReminderSync` runs). */
  const write = <A extends unknown[], R>(
    fn: (db: Db, ...args: A) => R,
  ): Write<A, R> => {
    const bound = plain(fn);
    return (...args) => {
      const result = bound(...args);
      scheduleRemindersSoon(db);
      return result;
    };
  };
  const refresh = () => {
    notifyChange();
    scheduleRemindersSoon(db);
  };
  return {
    accounts: {
      create: write(accounts.createAccount),
      update: write(accounts.updateAccount),
      archive: write(accounts.archiveAccount),
      unarchive: write(accounts.unarchiveAccount),
      setDefault: write(accounts.setDefaultAccount),
      reorder: write(accounts.reorderAccounts),
      delete: write(accounts.deleteAccount),
    },
    categories: {
      create: write(categories.createCategory),
      update: write(categories.updateCategory),
      archive: write(categories.archiveCategory),
      reorder: write(categories.reorderCategories),
      delete: write(categories.deleteCategory),
      deleteUnused: write(categories.deleteUnusedCategory),
      restore: write(categories.restoreCategory),
    },
    transactions: {
      create: write(transactions.createTransaction),
      update: write(transactions.updateTransaction),
      delete: write(transactions.deleteTransaction),
      restore: write(transactions.restoreTransaction),
    },
    budgets: {
      create: write(budgets.createBudget),
      update: write(budgets.updateBudget),
      archive: write(budgets.archiveBudget),
      delete: write(budgets.deleteBudget),
    },
    recurring: {
      create: write(recurring.createRule),
      update: write(recurring.updateRule),
      setPaused: write(recurring.setRulePaused),
      delete: write(recurring.deleteRule),
      postDue: write(recurring.postDue),
      postNow: write(recurring.postNow),
      skip: write(recurring.skip),
    },
    settings: {
      set: <K extends settings.SettingKey>(
        key: K,
        value: settings.SettingsMap[K],
      ): void => {
        settings.setSetting(db, key, value);
        notifyChange();
        if (key.startsWith("reminder_")) scheduleRemindersSoon(db);
      },
    },
    tags: {
      create: plain(tags.createTag),
      update: plain(tags.updateTag),
      delete: plain(tags.deleteTag),
      /** Replaces a transaction's tags. */
      setForTransaction: plain(tags.setTransactionTags),
    },
    people: {
      create: plain(people.createPerson),
      update: plain(people.updatePerson),
      delete: plain(people.deletePerson),
      /** Records a repayment moving the person's balance towards zero; returns the new transaction. */
      settle: write(people.settle),
    },
    attachments: {
      /** Copies a picked image into app storage, then stores its metadata. */
      add: async (transactionId: string, image: PickedImage) => {
        const uri = await copyIntoAttachments(image.uri);
        try {
          const row = attachments.addAttachment(db, {
            transactionId,
            uri,
            width: image.width,
            height: image.height,
          });
          notifyChange();
          return row;
        } catch (error) {
          await deleteAttachmentFile(uri);
          throw error;
        }
      },
      /** Removes the metadata and deletes the copied file. */
      remove: async (id: string) => {
        const row = attachments.removeAttachment(db, id);
        notifyChange();
        if (row) await deleteAttachmentFile(row.uri);
      },
    },
    backup: {
      /** Builds the backup document and records `last_backup_at`. Returns the JSON text. */
      create: (): string => {
        const now = Date.now();
        const json = backup.serializeBackup(
          backup.exportBackup(db, { now, appVersion: appVersion() }),
        );
        settings.setSetting(db, "last_backup_at", now);
        notifyChange(["settings"]);
        return json;
      },
      /** Writes `<App>-backup-YYYY-MM-DD.json` and opens the share sheet (a download on web). */
      share: async (): Promise<string> => {
        const now = Date.now();
        const json = backup.serializeBackup(
          backup.exportBackup(db, { now, appVersion: appVersion() }),
        );
        const name = await shareBackupFile(json, now);
        settings.setSetting(db, "last_backup_at", now);
        notifyChange(["settings"]);
        return name;
      },
      /** Opens the file picker; returns the raw text (validate with `validate`) or null when cancelled. */
      pick: pickBackupFile,
      validate: (json: unknown) => backup.validateBackup(json),
      /** Replaces all data atomically. Throws `BackupError` for an invalid document. */
      restore: write(backup.restoreBackup),
    },
    sync: {
      /** Syncs with the provider (default: the `sync_provider` setting). Resolves with what happened. */
      now: async (
        provider?: SyncProvider | null,
      ): Promise<SyncOutcome | { action: "none" }> => {
        const target =
          provider ?? getSyncProvider(settings.getSetting(db, "sync_provider"));
        if (!target) return { action: "none" };
        const outcome = await syncNow(db, target, { appVersion: appVersion() });
        refresh();
        return outcome;
      },
    },
    reminders: {
      /** Ask for notification permission (call from a user action), then plan everything. */
      enable: async () => {
        const permission = await requestReminderPermission();
        await rescheduleAll(db);
        return permission;
      },
      reschedule: () => rescheduleAll(db),
    },
    dev: {
      seedDemo: write(seedDemoData),
    },
    import: {
      run: write(importer.importTransactions),
    },
    data: {
      eraseAll: write(maintenance.eraseAllData),
    },
    fx: {
      setRate: write(fx.setRate),
      deleteRate: write(fx.deleteRate),
    },
  };
}

export type Actions = ReturnType<typeof createActions>;

/** Write functions bound to the app database; each one refreshes the live hooks. */
export function useActions(): Actions {
  const db = useDb();
  return useMemo(() => createActions(db), [db]);
}
