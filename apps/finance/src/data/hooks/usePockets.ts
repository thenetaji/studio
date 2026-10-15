import { pocketStatus, type Pocket, type PocketStatus } from "@/db/repos/pockets";
import { useLiveData } from "@/data/use-live-data";

import { useAccounts, type AccountWithBalance } from "./useAccounts";
import { useSetting } from "./useSettings";

export type PocketView = Pocket &
  PocketStatus & { account: AccountWithBalance; from: AccountWithBalance | null };

/** Configured pockets whose account still exists, with what is left since the last refill. */
export function usePockets(): PocketView[] {
  const [pockets] = useSetting("pockets");
  const accounts = useAccounts();
  const statuses = useLiveData(
    ["transactions"],
    pockets.map((p) => p.accountId).join(","),
    (db) => pockets.map((p) => pocketStatus(db, p.accountId)),
  );
  return pockets.flatMap((p, i) => {
    const account = accounts.find((a) => a.id === p.accountId);
    const status = statuses[i];
    if (!account || !status) return [];
    const from = accounts.find((a) => a.id === p.fromAccountId) ?? null;
    return [{ ...p, ...status, account, from }];
  });
}
