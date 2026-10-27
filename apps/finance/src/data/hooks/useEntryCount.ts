import { sql } from "drizzle-orm";

import { transactions } from "@/db/schema";
import { useLiveData } from "@/data/use-live-data";

/** Number of transactions recorded, transfers included. */
export function useEntryCount(): number {
  return useLiveData(
    ["transactions"],
    "entry-count",
    (db) =>
      db.select({ n: sql<number>`count(*)` }).from(transactions).get()?.n ?? 0,
  );
}
