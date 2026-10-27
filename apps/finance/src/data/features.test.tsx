/** @jest-environment node */
import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { DatabaseContext } from "@/db/context";
import { getSetting } from "@/db/repos/settings";
import { at, categoryId, createTestDb, makeAccounts } from "@/db/test-helpers";
import type { Db } from "@/db/types";
import * as files from "@/lib/files";
import { useActions } from "./actions";
import {
  useAttachments,
  useDailyTotals,
  useOutstanding,
  useOutstandingTotals,
  usePeople,
  usePersonHistory,
  useSetting,
  useSubscriptions,
  useSyncStatus,
  useTagTotals,
  useTagTransactions,
  useTags,
  useAccounts,
  useRecentTransactions,
} from "./hooks";

jest.mock("@/lib/files", () => ({
  copyIntoAttachments: jest.fn(
    async (uri: string) => `file:///docs/attachments/${uri.split("/").pop()}`,
  ),
  deleteAttachmentFile: jest.fn(async () => {}),
  pickBackupFile: jest.fn(async () => null),
  shareBackupFile: jest.fn(async () => "Finance-backup-2026-10-06.json"),
}));
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function renderHook<T>(db: Db, hook: () => T) {
  const result: { current: T | undefined } = { current: undefined };
  function Probe(): ReactNode {
    result.current = hook();
    return null;
  }
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(
      createElement(
        DatabaseContext.Provider,
        { value: db },
        createElement(Probe),
      ),
    );
  });
  return {
    get value(): T {
      if (result.current === undefined) throw new Error("hook did not render");
      return result.current;
    },
    unmount: () => act(() => renderer?.unmount()),
  };
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

describe("feature hooks react to writes made through useActions", () => {
  it("tags: live list, totals, per-tag transactions and tag assignment through create", async () => {
    const db = createTestDb();
    const { cash } = makeAccounts(db);
    const period = { from: "2026-10-01", to: "2026-10-31" };
    const hooks = renderHook(db, () => ({
      actions: useActions(),
      tags: useTags(),
      totals: useTagTotals(period),
      items: useRecentTransactions(5),
    }));
    expect(hooks.value.tags).toEqual([]);

    let tagId = "";
    act(() => {
      tagId = hooks.value.actions.tags.create({
        name: "Goa",
        color: "cyan",
      }).id;
    });
    await flush();
    expect(hooks.value.tags.map((t) => t.name)).toEqual(["Goa"]);

    act(() => {
      hooks.value.actions.transactions.create({
        kind: "expense",
        amount: 4200,
        accountId: cash.id,
        categoryId: categoryId(db, "Travel"),
        occurredAt: at("2026-10-03"),
        tagIds: [tagId],
      });
    });
    await flush();
    expect(hooks.value.totals[0]).toMatchObject({ spent: 4200, count: 1 });
    expect(hooks.value.items[0]?.tags.map((t) => t.name)).toEqual(["Goa"]);

    const tagged = renderHook(db, () => useTagTransactions(tagId));
    expect(tagged.value).toHaveLength(1);
    act(() => {
      hooks.value.actions.tags.setForTransaction(hooks.value.items[0]!.id, []);
    });
    await flush();
    expect(tagged.value).toHaveLength(0);
    expect(hooks.value.totals[0]?.spent).toBe(0);
    tagged.unmount();
    hooks.unmount();
  });

  it("lending: people, outstanding, history and settle", async () => {
    const db = createTestDb();
    const { cash } = makeAccounts(db);
    const hooks = renderHook(db, () => ({
      actions: useActions(),
      people: usePeople(),
      accounts: useAccounts(),
      outstanding: useOutstanding(),
      totals: useOutstandingTotals(),
    }));
    let personId = "";
    act(() => {
      personId = hooks.value.actions.people.create({ name: "Asha" }).id;
    });
    await flush();
    expect(hooks.value.people.map((p) => p.name)).toEqual(["Asha"]);
    expect(hooks.value.outstanding).toEqual([]);

    act(() => {
      hooks.value.actions.transactions.create({
        kind: "lent",
        amount: 3000,
        accountId: cash.id,
        personId,
        occurredAt: at("2026-10-02"),
      });
    });
    await flush();
    expect(hooks.value.outstanding[0]).toMatchObject({ total: 3000 });
    expect(hooks.value.totals).toMatchObject({ owedToMe: 3000, iOwe: 0 });
    expect(hooks.value.accounts.find((a) => a.id === cash.id)?.balance).toBe(
      100000 - 3000,
    );

    const history = renderHook(db, () => usePersonHistory(personId));
    expect(history.value?.entries).toHaveLength(1);
    act(() => {
      hooks.value.actions.people.settle({
        personId,
        amount: 1000,
        accountId: cash.id,
      });
    });
    await flush();
    expect(history.value?.entries.map((e) => e.item.kind)).toEqual([
      "repaid_to_me",
      "lent",
    ]);
    expect(hooks.value.outstanding[0]?.total).toBe(2000);
    expect(hooks.value.accounts.find((a) => a.id === cash.id)?.balance).toBe(
      100000 - 2000,
    );
    history.unmount();
    hooks.unmount();
  });

  it("attachments: copies the picked file, stores metadata and deletes the file on removal", async () => {
    const db = createTestDb();
    const { cash } = makeAccounts(db);
    const hooks = renderHook(db, () => useActions());
    let txId = "";
    act(() => {
      txId = hooks.value.transactions.create({
        kind: "expense",
        amount: 100,
        accountId: cash.id,
        categoryId: categoryId(db, "Groceries"),
        occurredAt: at("2026-10-02"),
      }).id;
    });
    const list = renderHook(db, () => useAttachments(txId));
    let id = "";
    await act(async () => {
      id = (
        await hooks.value.attachments.add(txId, {
          uri: "file:///cache/pick.jpg",
          width: 10,
          height: 20,
        })
      ).id;
    });
    expect(list.value).toMatchObject([
      { uri: "file:///docs/attachments/pick.jpg", width: 10, height: 20 },
    ]);
    await act(async () => {
      await hooks.value.attachments.remove(id);
    });
    expect(list.value).toEqual([]);
    expect(files.deleteAttachmentFile).toHaveBeenCalledWith(
      "file:///docs/attachments/pick.jpg",
    );
    // A failed insert removes the copy it just made.
    await expect(
      hooks.value.attachments.add("ghost", { uri: "file:///cache/x.jpg" }),
    ).rejects.toThrow();
    expect(files.deleteAttachmentFile).toHaveBeenLastCalledWith(
      "file:///docs/attachments/x.jpg",
    );
    list.unmount();
    hooks.unmount();
  });

  it("subscriptions, daily totals, settings and sync status", async () => {
    const db = createTestDb();
    const { cash } = makeAccounts(db);
    const hooks = renderHook(db, () => ({
      actions: useActions(),
      subs: useSubscriptions(),
      days: useDailyTotals("2026-10"),
      provider: useSetting("sync_provider"),
      style: useSetting("icon_style"),
      sync: useSyncStatus(),
    }));
    expect(hooks.value.subs.totals.count).toBe(0);
    expect(hooks.value.sync).toMatchObject({
      provider: "none",
      status: null,
      lastBackupAt: null,
    });
    expect(hooks.value.style[0]).toBe("sf");

    act(() => {
      hooks.value.actions.recurring.create({
        kind: "expense",
        title: "Netflix",
        amount: 64900,
        accountId: cash.id,
        categoryId: categoryId(db, "Subscriptions"),
        frequency: "monthly",
        startDate: "2026-10-12",
      });
      hooks.value.actions.transactions.create({
        kind: "expense",
        amount: 500,
        accountId: cash.id,
        categoryId: categoryId(db, "Groceries"),
        occurredAt: at("2026-10-05"),
      });
      hooks.value.actions.settings.set("sync_provider", "icloud");
      hooks.value.actions.settings.set("icon_style", "lucide");
    });
    await flush();
    expect(hooks.value.subs.items[0]).toMatchObject({
      monthly: 64900,
      nextCharge: "2026-10-12",
    });
    expect(hooks.value.days.days[4]).toEqual({
      dateKey: "2026-10-05",
      amount: 500,
    });
    expect(hooks.value.sync.status).toEqual({
      status: "unavailable",
      reason: "needs-paid-developer-account",
    });
    expect(hooks.value.style[0]).toBe("lucide");
    hooks.unmount();
  });

  it("backup actions create, validate and restore, and sync is a no-op without a provider", async () => {
    const db = createTestDb();
    const { cash } = makeAccounts(db);
    const actions = renderHook(db, () => useActions());
    act(() => {
      actions.value.transactions.create({
        kind: "expense",
        amount: 700,
        accountId: cash.id,
        categoryId: categoryId(db, "Groceries"),
        occurredAt: at("2026-10-02"),
      });
    });
    const json = actions.value.backup.create();
    expect(getSetting(db, "last_backup_at")).not.toBeNull();
    const checked = actions.value.backup.validate(json);
    expect(checked.ok && checked.summary.transactions).toBe(1);
    expect(actions.value.backup.validate("nonsense")).toMatchObject({
      ok: false,
      error: "not_json",
    });

    const other = createTestDb();
    const otherActions = renderHook(other, () => useActions());
    act(() => {
      otherActions.value.backup.restore(json);
    });
    expect(otherActions.value.backup.create()).toContain('"amount":700');
    expect(await otherActions.value.sync.now()).toEqual({ action: "none" });
    expect(await actions.value.backup.share()).toBe(
      "Finance-backup-2026-10-06.json",
    );
    actions.unmount();
    otherActions.unmount();
  });
});
