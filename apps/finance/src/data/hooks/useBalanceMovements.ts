import { balanceMovements, listAccounts } from "@/db/repos/accounts";
import type { AccountRow } from "@/db/schema";
import { useLiveData } from "@/data/use-live-data";
import type { Movement } from "@/lib/balance/history";
import type { ConversionContext } from "@/lib/insights";
import { conversionContext } from "./summary";

export interface BalanceMovements {
  ctx: ConversionContext;
  /** Active accounts in their sort order. */
  accounts: AccountRow[];
  /** Net change per account per day, in each account's own currency. */
  movements: Movement[];
}

/** Opening balances plus every day's movements, for reconstructing balances over time (Insights net worth). */
export function useBalanceMovements(): BalanceMovements {
  return useLiveData(
    ["accounts", "transactions", "fx_rates", "settings"],
    "balance-movements",
    (db) => ({
      ctx: conversionContext(db),
      accounts: listAccounts(db),
      movements: balanceMovements(db),
    }),
  );
}
