import { and, desc, eq } from "drizzle-orm";
import {
  addDays,
  addMonths,
  keyToLocalMs,
  makeKey,
  parseKey,
  toDateKey,
  weekday,
  type DateKey,
} from "@studio/dates";
import { createAccount, type AccountInput } from "./repos/accounts";
import { listCategories } from "./repos/categories";
import { setRate } from "./repos/fx";
import { createRule, postDue, setRulePaused } from "./repos/recurring";
import { setSetting } from "./repos/settings";
import {
  budgetPeriodFor,
  budgetSpent,
  createBudget,
  deleteBudget,
  getBudget,
} from "./repos/budgets";
import { addAttachment } from "./repos/attachments";
import { getPersonByName } from "./repos/people";
import { createTag, setTransactionTags } from "./repos/tags";
import {
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  type TransactionInput,
} from "./repos/transactions";
import type { TransactionRow } from "./schema";
import {
  accounts,
  attachments,
  people,
  tags,
  transactionTags,
  budgetCategories,
  budgets,
  fxRates,
  recurringRules,
  titleMemory,
  transactionSplits,
  transactions,
} from "./schema";
import { seedDefaults } from "./seed";
import type { Db } from "./types";

const MONTHS_OF_HISTORY = 6;
const rupees = (amount: number) => Math.round(amount * 100);

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Rng {
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
}

function makeRng(seed: number): Rng {
  const next = mulberry32(seed);
  return {
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) =>
      items[Math.floor(next() * items.length)] as (typeof items)[number],
    chance: (p) => next() < p,
  };
}

function clearDemoData(db: Db): void {
  db.delete(transactionTags).run();
  db.delete(attachments).run();
  db.delete(transactionSplits).run();
  db.delete(transactions).run();
  db.delete(tags).run();
  db.delete(people).run();
  db.delete(recurringRules).run();
  db.delete(budgetCategories).run();
  db.delete(budgets).run();
  db.delete(titleMemory).run();
  db.delete(fxRates).run();
  db.delete(accounts).run();
}

/** Roughly six months of realistic INR data for an Indian user. Clears existing ledger data first. */
export function seedDemoData(db: Db, now = Date.now()): void {
  db.transaction((tx) => {
    seedDefaults(tx, now);
    clearDemoData(tx);
    populate(tx, now);
  });
}

function populate(db: Db, now: number): void {
  const rng = makeRng(20261005);
  const today = toDateKey(now);
  const { year, month } = parseKey(today);
  const firstMonth = addMonths(
    makeKey(year, month, 1),
    -(MONTHS_OF_HISTORY - 1),
  );

  const cat = new Map(listCategories(db).map((c) => [c.name, c.id]));
  const categoryOf = (name: string): string => {
    const id = cat.get(name);
    if (!id) throw new Error(`missing category ${name}`);
    return id;
  };

  const open = (input: AccountInput, id: string) => {
    const created = createAccount(db, input, now);
    // Fixed ids let screenshots route straight to an account.
    db.update(accounts).set({ id }).where(eq(accounts.id, created.id)).run();
    if (created.isDefault) setSetting(db, "default_account_id", id);
    return { ...created, id };
  };
  const bank = open(
    {
      name: "HDFC Savings",
      type: "bank",
      currency: "INR",
      openingBalance: rupees(85000),
      color: "blue",
      isDefault: true,
    },
    "demo-account-bank",
  );
  const cash = open(
    {
      name: "Cash",
      type: "cash",
      currency: "INR",
      openingBalance: rupees(6000),
      color: "green",
    },
    "demo-account-cash",
  );
  const card = open(
    {
      name: "ICICI Credit Card",
      type: "card",
      currency: "INR",
      openingBalance: 0,
      color: "orange",
    },
    "demo-account-card",
  );
  const usd = open(
    {
      name: "Wise USD",
      type: "bank",
      currency: "USD",
      openingBalance: 120000,
      color: "indigo",
    },
    "demo-account-usd",
  );

  const stamp = (key: DateKey, hour: number, minute: number) =>
    keyToLocalMs(key, hour, minute);
  const add = (
    key: DateKey,
    input: Omit<TransactionInput, "occurredAt"> & {
      hour?: number;
      minute?: number;
    },
  ): TransactionRow | undefined => {
    if (key > today) return undefined;
    const { hour = rng.int(8, 21), minute = rng.int(0, 59), ...rest } = input;
    return createTransaction(
      db,
      { ...rest, occurredAt: stamp(key, hour, minute) },
      now,
    );
  };
  /** Gives a demo row a fixed id so screenshots can route to it. */
  const pin = (row: TransactionRow | undefined, id: string) => {
    if (!row) return;
    const snapshot = deleteTransaction(db, row.id);
    if (!snapshot) return;
    restoreTransaction(db, {
      transaction: { ...snapshot.transaction, id },
      splits: snapshot.splits.map((line) => ({ ...line, transactionId: id })),
    });
  };

  setSetting(db, "display_currency", "INR");
  setSetting(db, "onboarding_done", true);
  setSetting(db, "last_account_id", bank.id);
  setSetting(db, "pockets", [
    { accountId: cash.id, amount: 600_000, fromAccountId: bank.id },
  ]);
  setRate(db, "USD", "INR", 84.5, now);

  const rules: [string, number, number, string, string, number][] = [
    ["Rent", rupees(32000), 5, "Housing", bank.id, 9],
    ["Netflix", rupees(649), 5, "Subscriptions", card.id, 9],
    ["Spotify", rupees(119), 12, "Subscriptions", card.id, 9],
  ];
  for (const [title, amount, day, category, accountId] of rules) {
    const rule = createRule(
      db,
      {
        kind: "expense",
        title,
        amount,
        accountId,
        categoryId: categoryOf(category),
        frequency: "monthly",
        startDate: makeKey(
          parseKey(firstMonth).year,
          parseKey(firstMonth).month,
          day,
        ),
      },
      now,
    );
    db.update(recurringRules)
      .set({ id: `demo-rule-${title.toLowerCase()}` })
      .where(eq(recurringRules.id, rule.id))
      .run();
  }
  createRule(
    db,
    {
      kind: "transfer",
      title: "Cash top-up",
      amount: rupees(5000),
      accountId: bank.id,
      transferAccountId: cash.id,
      frequency: "monthly",
      startDate: makeKey(
        parseKey(firstMonth).year,
        parseKey(firstMonth).month,
        3,
      ),
    },
    now,
  );
  const firstMonday = addDays(firstMonth, (8 - weekday(firstMonth)) % 7);
  createRule(
    db,
    {
      kind: "expense",
      title: "House help",
      amount: rupees(1200),
      accountId: cash.id,
      categoryId: categoryOf("Housing"),
      frequency: "weekly",
      interval: 2,
      startDate: firstMonday,
    },
    now,
  );
  createRule(
    db,
    {
      kind: "expense",
      title: "Cloud storage",
      amount: rupees(2900),
      accountId: card.id,
      categoryId: categoryOf("Subscriptions"),
      frequency: "yearly",
      startDate: makeKey(
        parseKey(addDays(today, 20)).year - 1,
        parseKey(addDays(today, 20)).month,
        parseKey(addDays(today, 20)).day,
      ),
      nextDue: addDays(today, 20),
    },
    now,
  );
  setRulePaused(
    db,
    createRule(
      db,
      {
        kind: "expense",
        title: "Gym",
        amount: rupees(1800),
        accountId: card.id,
        categoryId: categoryOf("Health"),
        frequency: "monthly",
        startDate: makeKey(
          parseKey(firstMonth).year,
          parseKey(firstMonth).month,
          20,
        ),
      },
      now,
    ).id,
    true,
    now,
  );
  postDue(db, today, now);

  for (let m = 0; m < MONTHS_OF_HISTORY; m++) {
    const first = addMonths(firstMonth, m);
    const at = (day: number): DateKey => addDays(first, day - 1);

    add(at(1), {
      kind: "income",
      title: "Salary",
      memo: "Acme Technologies",
      amount: rupees(145000),
      accountId: bank.id,
      categoryId: categoryOf("Salary"),
      hour: 10,
      minute: 5,
    });
    if (m === 1 || m === 4)
      add(at(18), {
        kind: "income",
        title: "Freelance invoice",
        memo: `Website project ${m === 1 ? "milestone 1" : "final"}`,
        amount: rupees(18000),
        accountId: bank.id,
        categoryId: categoryOf("Freelance"),
      });
    if (m === 2)
      add(at(20), {
        kind: "income",
        title: "Mutual fund dividend",
        amount: rupees(2340),
        accountId: bank.id,
        categoryId: categoryOf("Investments"),
      });

    add(at(15), {
      kind: "transfer",
      title: "",
      memo: "Credit card bill",
      amount: rupees(20000),
      accountId: bank.id,
      transferAccountId: card.id,
      hour: 11,
    });

    const groceryShops: [string, number, number][] = [
      ["BigBasket", 900, 2600],
      ["Blinkit", 180, 950],
      ["Zepto", 220, 780],
      ["Reliance Fresh", 400, 1500],
    ];
    for (let i = 0; i < rng.int(5, 7); i++) {
      const [title, low, high] = rng.pick(groceryShops);
      add(at(rng.int(1, 28)), {
        kind: "expense",
        title,
        amount: rupees(rng.int(low, high)) + (rng.chance(0.4) ? 5000 : 0),
        accountId: rng.chance(0.6) ? card.id : bank.id,
        categoryId: categoryOf("Groceries"),
      });
    }

    for (let i = 0; i < rng.int(9, 13); i++) {
      const title = rng.pick([
        "Swiggy",
        "Zomato",
        "Swiggy",
        "Zomato",
        "Chai Point",
        "Starbucks",
        "Third Wave Coffee",
      ]);
      add(at(rng.int(1, 28)), {
        kind: "expense",
        title,
        amount: rupees(
          rng.int(
            title === "Chai Point" ? 60 : 160,
            title === "Starbucks" ? 520 : 680,
          ),
        ),
        accountId: rng.chance(0.5)
          ? card.id
          : rng.chance(0.5)
            ? bank.id
            : cash.id,
        categoryId: categoryOf("Food & Drink"),
        memo: rng.chance(0.12) ? "Team lunch" : "",
      });
    }

    for (let i = 0; i < rng.int(7, 11); i++) {
      const title = rng.pick(["Uber", "Ola", "Uber", "Namma Metro", "Rapido"]);
      add(at(rng.int(1, 28)), {
        kind: "expense",
        title,
        amount: rupees(
          rng.int(
            title === "Namma Metro" ? 30 : 110,
            title === "Namma Metro" ? 60 : 460,
          ),
        ),
        accountId: rng.chance(0.5) ? bank.id : cash.id,
        categoryId: categoryOf("Transport"),
      });
    }
    for (let i = 0; i < 2; i++) {
      add(at(rng.int(1, 28)), {
        kind: "expense",
        title: "Indian Oil Petrol Pump",
        amount: rupees(rng.int(1400, 2600)),
        accountId: card.id,
        categoryId: categoryOf("Transport"),
        memo: i === 0 ? "Full tank" : "",
      });
    }

    add(at(8), {
      kind: "expense",
      title: "BESCOM Electricity",
      amount: rupees(rng.int(1600, 2900)),
      accountId: bank.id,
      categoryId: categoryOf("Bills"),
    });
    add(at(10), {
      kind: "expense",
      title: "Airtel Postpaid",
      amount: rupees(599),
      accountId: bank.id,
      categoryId: categoryOf("Bills"),
    });
    add(at(11), {
      kind: "expense",
      title: "ACT Broadband",
      amount: rupees(1049),
      accountId: bank.id,
      categoryId: categoryOf("Bills"),
    });

    for (let i = 0; i < rng.int(1, 3); i++) {
      add(at(rng.int(1, 28)), {
        kind: "expense",
        title: rng.pick(["Amazon", "Myntra", "Decathlon", "Croma"]),
        amount: rupees(rng.int(450, 4800)),
        accountId: card.id,
        categoryId: categoryOf("Shopping"),
        memo: rng.chance(0.3) ? "Gift for Amma" : "",
      });
    }
    if (rng.chance(0.5))
      add(at(rng.int(1, 28)), {
        kind: "expense",
        title: "Apollo Pharmacy",
        amount: rupees(rng.int(180, 1400)),
        accountId: cash.id,
        categoryId: categoryOf("Health"),
      });
    if (rng.chance(0.55))
      add(at(rng.int(1, 28)), {
        kind: "expense",
        title: "PVR Cinemas",
        amount: rupees(rng.int(500, 1100)),
        accountId: card.id,
        categoryId: categoryOf("Entertainment"),
        memo: "Movie night",
      });
    if (m === 3)
      add(at(22), {
        kind: "expense",
        title: "IndiGo flight BLR to DEL",
        amount: rupees(6840),
        accountId: card.id,
        categoryId: categoryOf("Travel"),
        memo: "Diwali trip",
      });
    if (m === 0)
      add(at(14), {
        kind: "expense",
        title: "Coursera subscription",
        amount: rupees(3499),
        accountId: card.id,
        categoryId: categoryOf("Education"),
      });
  }

  const splitDay = (monthIndex: number, day: number) =>
    addDays(addMonths(firstMonth, monthIndex), day - 1);
  add(splitDay(1, 9), {
    kind: "expense",
    title: "Reliance Smart",
    memo: "Monthly stock up",
    amount: rupees(3240),
    accountId: card.id,
    categoryId: null,
    splits: [
      { categoryId: categoryOf("Groceries"), amount: rupees(2480) },
      { categoryId: categoryOf("Personal"), amount: rupees(760) },
    ],
  });
  add(splitDay(3, 16), {
    kind: "expense",
    title: "Barbeque Nation",
    memo: "Anniversary",
    amount: rupees(4150),
    accountId: card.id,
    categoryId: null,
    splits: [
      { categoryId: categoryOf("Food & Drink"), amount: rupees(3650) },
      { categoryId: categoryOf("Entertainment"), amount: rupees(500) },
    ],
  });
  pin(
    add(splitDay(MONTHS_OF_HISTORY - 1, 2), {
      kind: "expense",
      title: "Amazon",
      amount: rupees(5890),
      accountId: card.id,
      categoryId: null,
      splits: [
        { categoryId: categoryOf("Shopping"), amount: rupees(3990) },
        { categoryId: categoryOf("Education"), amount: rupees(1200) },
        { categoryId: categoryOf("Personal"), amount: rupees(700) },
      ],
    }),
    "demo-split",
  );

  pin(
    add(addDays(firstMonth, 40), {
      kind: "income",
      title: "Client payment",
      memo: "Invoice #1042",
      amount: 45000,
      accountId: usd.id,
      categoryId: categoryOf("Freelance"),
    }),
    "demo-usd",
  );
  add(addDays(firstMonth, 95), {
    kind: "income",
    title: "Client payment",
    memo: "Invoice #1057",
    amount: 38000,
    accountId: usd.id,
    categoryId: categoryOf("Freelance"),
  });
  add(addDays(firstMonth, 62), {
    kind: "expense",
    title: "Notion",
    amount: 1000,
    accountId: usd.id,
    categoryId: categoryOf("Subscriptions"),
  });
  add(addDays(firstMonth, 120), {
    kind: "expense",
    title: "Figma",
    amount: 1500,
    accountId: usd.id,
    categoryId: categoryOf("Subscriptions"),
  });
  pin(
    add(addDays(firstMonth, 130), {
      kind: "transfer",
      title: "",
      memo: "Withdraw to India",
      amount: 20000,
      transferAmount: rupees(20000 * 0.845),
      accountId: usd.id,
      transferAccountId: bank.id,
    }),
    "demo-transfer",
  );

  seedDemoBudgets(db, today, categoryOf, now);
}

/**
 * One overall budget plus four category budgets with fixed ids (`demo-budget-*`), sized from what this
 * month has actually spent so the list always shows one near the limit, one over and two on track.
 */
function seedDemoBudgets(
  db: Db,
  today: DateKey,
  categoryOf: (name: string) => string,
  now: number,
): void {
  const pinned = (
    id: string,
    name: string | undefined,
    amount: (spent: number) => number,
    categoryNames: string[],
  ) => {
    const input = {
      name,
      amount: rupees(1000),
      currency: "INR",
      period: "monthly" as const,
      startAnchor: 1,
      scope:
        categoryNames.length === 0 ? ("all" as const) : ("categories" as const),
      categoryIds: categoryNames.map(categoryOf),
    };
    const draft = createBudget(db, input, now);
    const spent = budgetSpent(db, draft, budgetPeriodFor(draft, today)) / 100;
    const row = getBudget(db, draft.id);
    deleteBudget(db, draft.id);
    if (!row) return;
    db.insert(budgets)
      .values({ ...row, id, amount: rupees(amount(spent)) })
      .run();
    if (row.categoryIds.length > 0)
      db.insert(budgetCategories)
        .values(
          row.categoryIds.map((categoryId) => ({ budgetId: id, categoryId })),
        )
        .run();
  };
  const roundTo = (value: number, step: number) =>
    Math.max(step, Math.ceil(value / step) * step);
  pinned("demo-budget-overall", "Monthly spending", () => 75000, []);
  pinned(
    "demo-budget-food",
    undefined,
    (spent) => Math.max(500, Math.floor((spent * 0.8) / 100) * 100),
    ["Food & Drink"],
  );
  pinned(
    "demo-budget-groceries",
    undefined,
    (spent) => roundTo(spent * 2 + 3000, 500),
    ["Groceries"],
  );
  pinned(
    "demo-budget-transport",
    undefined,
    (spent) => roundTo(spent / 0.95, 50),
    ["Transport"],
  );
  pinned(
    "demo-budget-shopping",
    undefined,
    (spent) => roundTo(spent * 3 + 4000, 500),
    ["Shopping", "Personal"],
  );
}

/** A drawn slip of paper for the demo receipt (web has no camera; native shows it too). */
const DEMO_RECEIPT = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="240" height="320" fill="#d9d5cc"/><rect x="30" y="20" width="180" height="290" fill="#f7f5f0"/>' +
    [50, 74, 98, 122, 146, 190, 214, 238]
      .map(
        (y, i) =>
          `<rect x="48" y="${y}" width="${i % 3 === 0 ? 90 : 144}" height="6" fill="#6b675f"/>`,
      )
      .join("") +
    '<rect x="48" y="268" width="144" height="10" fill="#2b2924"/></svg>',
)}`;

/**
 * Lending, tags and a receipt on top of the demo ledger: three people (Rahul owes, Priya is owed, Amit is settled),
 * two tags and fixed ids `demo-lent` and `demo-tagged`. Idempotent: does nothing when Rahul already exists.
 */
export function seedDemoExtras(db: Db, now = Date.now()): void {
  if (getPersonByName(db, "Rahul")) return;
  const bank = db
    .select()
    .from(accounts)
    .where(eq(accounts.id, "demo-account-bank"))
    .get();
  if (!bank) return;
  const today = toDateKey(now);
  const at = (daysAgo: number, hour: number) =>
    keyToLocalMs(addDays(today, -daysAgo), hour, 15);

  // Fixed ids let screenshots route straight to a person or tag.
  const person = (slug: string, name: string) => {
    const row = { id: `demo-person-${slug}`, name, createdAt: now };
    db.insert(people).values(row).run();
    return row;
  };
  const rahul = person("rahul", "Rahul");
  const priya = person("priya", "Priya");
  const amit = person("amit", "Amit");

  const lend = (
    kind: "lent" | "borrowed" | "repaid_to_me" | "repaid_by_me",
    personId: string,
    rupeeAmount: number,
    daysAgo: number,
    memo = "",
  ) =>
    createTransaction(
      db,
      {
        kind,
        personId,
        accountId: bank.id,
        amount: rupees(rupeeAmount),
        occurredAt: at(daysAgo, 19),
        memo,
      },
      now,
    );

  const goa = createTag(db, { name: "Goa trip", color: "teal" }, now);
  const work = createTag(db, { name: "Work", color: "indigo" }, now);
  db.update(tags).set({ id: "demo-tag-goa" }).where(eq(tags.id, goa.id)).run();
  db.update(tags)
    .set({ id: "demo-tag-work" })
    .where(eq(tags.id, work.id))
    .run();
  goa.id = "demo-tag-goa";
  work.id = "demo-tag-work";

  const lent = lend("lent", rahul.id, 2400, 9, "Goa flights");
  const snapshot = deleteTransaction(db, lent.id);
  if (snapshot)
    restoreTransaction(db, {
      ...snapshot,
      transaction: { ...snapshot.transaction, id: "demo-lent" },
    });
  setTransactionTags(db, "demo-lent", [goa.id]);
  lend("lent", rahul.id, 1000, 21, "Dinner");
  lend("repaid_to_me", rahul.id, 500, 5);
  lend("borrowed", priya.id, 800, 13, "Cab share");
  lend("lent", amit.id, 1500, 40);
  lend("repaid_to_me", amit.id, 1500, 18);

  const spend = db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.kind, "expense"),
        eq(transactions.accountId, bank.id),
      ),
    )
    .orderBy(desc(transactions.occurredAt))
    .limit(40)
    .all()
    .filter((row) => row.amount <= rupees(3000))
    .slice(0, 7);
  spend.slice(0, 4).forEach((row) => setTransactionTags(db, row.id, [goa.id]));
  spend.slice(4).forEach((row) => setTransactionTags(db, row.id, [work.id]));
  const first = spend[0];
  if (first) {
    const pinned = deleteTransaction(db, first.id);
    if (pinned)
      restoreTransaction(db, {
        ...pinned,
        transaction: { ...pinned.transaction, id: "demo-tagged" },
      });
    setTransactionTags(db, "demo-tagged", [goa.id, work.id]);
    addAttachment(
      db,
      {
        transactionId: "demo-tagged",
        uri: DEMO_RECEIPT,
        width: 240,
        height: 320,
      },
      now,
    );
  }
}
