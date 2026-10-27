// Flow definitions for tooling/qa/e2e.mjs. Each flow: { name, run({ page, base }), skip? }.
// The web database is in-memory, so a full page.goto wipes it: navigate through the UI after the first load.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SLOW = { timeout: 120000 };

// -- helpers ------------------------------------------------------------------------------------
export async function open(page, base, path) {
  await page.goto(base + path);
  await page.waitForFunction(
    () => document.body.innerText.trim().length > 10,
    null,
    SLOW,
  );
}

const label = (page, text, opts = {}) =>
  opts.exact === false
    ? page.locator(`[aria-label*="${text}"]`)
    : page.locator(`[aria-label="${text}"]`);
/** Press an element addressed by exact aria-label, falling back to visible text. */
export async function tap(page, name, { last = false, nth } = {}) {
  let loc = page.locator(`[aria-label="${name}"]`);
  if ((await loc.count()) === 0) loc = page.getByText(name, { exact: true });
  loc = nth !== undefined ? loc.nth(nth) : last ? loc.last() : loc.first();
  await loc.tap();
}
export const tapText = (page, text, { nth, ...opts } = {}) => {
  const loc = page.getByText(text, { exact: true, ...opts });
  return (nth === undefined ? loc.first() : loc.nth(nth)).tap();
};
export const body = (page) => page.evaluate(() => document.body.innerText);
export const expectText = (page, text, timeout = 30000) =>
  page
    .waitForFunction((t) => document.body.innerText.includes(t), text, {
      timeout,
    })
    .catch(async () => {
      throw new Error(
        `expected text "${text}" on screen; saw: ${(await body(page)).replace(/\s+/g, " ").slice(0, 300)}`,
      );
    });
export const expectNoText = (page, text, timeout = 30000) =>
  page
    .waitForFunction((t) => !document.body.innerText.includes(t), text, {
      timeout,
    })
    .catch(async () => {
      throw new Error(
        `expected "${text}" to be gone; saw: ${(await body(page)).replace(/\s+/g, " ").slice(0, 300)}`,
      );
    });
export async function expectLabel(
  page,
  text,
  { exact = true, timeout = 30000 } = {},
) {
  await page
    .locator(
      exact
        ? `[aria-label="${text}"]:visible`
        : `[aria-label*="${text}"]:visible`,
    )
    .first()
    .waitFor({ timeout })
    .catch(async () => {
      throw new Error(
        `expected aria-label "${text}"; saw: ${(await body(page)).replace(/\s+/g, " ").slice(0, 300)}`,
      );
    });
}
export const labelsOf = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[aria-label]")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          getComputedStyle(e).visibility !== "hidden"
        );
      })
      .map((e) => e.getAttribute("aria-label")),
  );

/** Minimal RFC 4180 parser (quoted fields, doubled quotes, embedded commas/newlines); a leading BOM is dropped. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const KEY_NAMES = {
  "+": "Plus",
  "-": "Minus",
  ".": "Decimal point",
  "=": "Equals",
  "<": "Delete",
};
/** Press keypad keys by character: digits, + - . = and `<` for backspace. */
export async function keys(page, sequence) {
  for (const ch of sequence) {
    await page
      .locator(`[aria-label="${KEY_NAMES[ch] ?? ch}"]`)
      .last()
      .tap();
  }
}
export const tabTo = (page, name) =>
  page.getByRole("tab", { name }).first().tap();
export const addFab = (page) =>
  page.locator('[aria-label="Add transaction"]:visible').last();

/** Real onboarding through the UI with the given currency (default account "Cash"). */
export async function onboard(page, base, code) {
  await open(page, base, "/");
  await expectText(page, "Set up");
  await tapText(page, "Currency");
  await page.locator('[aria-label="Search currencies"]').fill(code);
  await page.locator(`[aria-label^="${code}"]`).first().tap();
  await tap(page, "Start");
  await expectText(page, "No transactions yet");
}

export async function seeded(page, base, mode) {
  await open(page, base, `/?seed=${mode}`);
  // An empty install shows only the hero and the empty state (no Recent list, no stats strip).
  await expectText(page, mode === "empty" ? "No transactions yet" : "Recent");
}

/** From Home: open the add sheet, enter amount/title/category and save. */
export async function addExpense(
  page,
  { amount, title = "", category = "Food & Drink", kind } = {},
) {
  await addFab(page).tap();
  await page.locator('[aria-label="Transaction type"]').waitFor();
  if (kind) await page.getByRole("tab", { name: kind }).tap();
  if (amount) await keys(page, amount);
  if (title) await typeTitle(page, title);
  if (category) await pickCategory(page, category);
}

/** Type a title and press return (the keypad comes back, as on a device). */
export async function typeTitle(page, title, { done = true } = {}) {
  const input = page.locator('[aria-label="Title"]');
  await input.fill(title);
  if (done) await input.press("Enter");
}

export async function pickCategory(page, name) {
  const chip = page.locator(`[aria-label="${name}"]`);
  if ((await chip.count()) > 0 && (await chip.first().isVisible())) {
    await chip.first().tap();
    return;
  }
  await page.locator('[aria-label="All categories"]').tap();
  await page.locator(`[aria-label="${name}"]`).last().tap();
}

/** Transaction rows only: Quick add chips ("Coffee, $450") and budget rows share the title prefix, but rows speak "minus"/"plus". */
export const rowSel = (title) =>
  `[aria-label^="${title}, "]:is([aria-label*=", minus "],[aria-label*=", plus "]):not([aria-label*=", due "])`;
export const isRowLabel = (l, title) =>
  l?.startsWith(`${title}, `) &&
  /, (minus|plus) /.test(l) &&
  !l.includes(", due ");
export const rowLabel = (page, title) =>
  page
    .locator(`${rowSel(title)}:visible`)
    .first()
    .getAttribute("aria-label");
export async function openRow(page, title) {
  await page
    .locator(`${rowSel(title)}:visible`)
    .first()
    .tap();
}

export const saveDisabled = (page) =>
  page
    .locator('[aria-label="Save"]')
    .first()
    .evaluate(
      (e) => e.disabled === true || e.getAttribute("aria-disabled") === "true",
    );

/** Client-side route change (a full goto would wipe the in-memory database). */
export async function goClient(page, path) {
  await page.evaluate((p) => {
    history.pushState({}, "", p);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

/** Touch swipe from the right edge towards the left across the row containing `locator` (full swipe). */
export async function swipeLeft(page, locator, { from = 365, to = 5 } = {}) {
  // Centre the row first: the floating Add pill covers the right edge near the bottom of Home.
  await locator.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(200);
  const bb = await locator.boundingBox();
  const y = bb.y + bb.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
    });
  await touch("touchStart", from);
  // Small steps with a pause: the web gesture/animation loop needs frames to see the translation cross the full-swipe line.
  const step = to < from ? -5 : 5;
  for (let x = from + step; step < 0 ? x >= to : x <= to; x += step) {
    await touch("touchMove", x);
    await page.waitForTimeout(30);
  }
  await touch("touchEnd", to);
  await cdp.detach();
}

export async function save(page) {
  const btn = page.locator('[aria-label="Save"]').first();
  await btn.tap();
}
/** Wait until the add/edit sheet has closed. */
export const sheetClosed = (page) =>
  page
    .locator('[aria-label="Transaction type"]')
    .waitFor({ state: "detached", timeout: 30000 });

// -- flows --------------------------------------------------------------------------------------
export const flows = [
  {
    name: "Onboarding",
    async run({ page, base }) {
      await open(page, base, "/");
      await expectText(page, "Set up");
      await tapText(page, "Currency");
      await page.locator('[aria-label="Search currencies"]').fill("EUR");
      await page.locator('[aria-label^="EUR"]').first().tap();
      await expectText(page, "€ EUR");
      await tap(page, "Start");
      await expectText(page, "No transactions yet");
      // Empty Home: the hero reads zero in the chosen currency (the Balance strip appears with the first transaction).
      await expectLabel(page, "Spent in ", { exact: false });
      assert.ok(
        (await labelsOf(page)).some((l) => /^Spent in \w+, 0 euros$/.test(l)),
        "hero should read zero euros",
      );
      assert.match(await body(page), /€\s*0/);
    },
  },
  {
    name: "Add expense",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await addExpense(page, {
        amount: "450",
        title: "Coffee",
        category: "Food & Drink",
      });
      await save(page);
      await sheetClosed(page);
      await expectLabel(page, "Coffee, Food & Drink, Cash, ", { exact: false });
      await expectText(page, "Recent");
      assert.match(await body(page), /Coffee[\s\S]*−\$450/);
      await tabTo(page, "Activity");
      await expectText(page, "Coffee");
      assert.match(await body(page), /−\$450/);
    },
  },
  {
    name: "Keypad maths",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await addFab(page).tap();
      await page.locator('[aria-label="Transaction type"]').waitFor();
      await keys(page, "1200+340");
      await expectText(page, "1,200 +");
      await keys(page, "=");
      await expectText(page, "1,540");
      await pickCategory(page, "Groceries");
      await save(page);
      await sheetClosed(page);
      assert.match(await body(page), /−\$1,540/);
    },
  },
  {
    name: "Title memory",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await addExpense(page, {
        amount: "450",
        title: "Coffee",
        category: "Groceries",
      });
      await save(page);
      await sheetClosed(page);
      await addFab(page).tap();
      await page.locator('[aria-label="Transaction type"]').waitFor();
      await keys(page, "90");
      await typeTitle(page, "Cof", { done: false });
      const suggestion = page.locator('[aria-label="Use Coffee"]');
      await suggestion.waitFor();
      // The first tap may only blur the field (the keypad reappears and the layout moves on web); retry once.
      for (
        let i = 0;
        i < 2 &&
        (await page.locator('[aria-label="Title"]').inputValue()) !== "Coffee";
        i++
      ) {
        await suggestion.tap();
        await page.waitForTimeout(500);
      }
      assert.equal(
        await page.locator('[aria-label="Title"]').inputValue(),
        "Coffee",
      );
      // The remembered category is applied: saving works without picking one and lands in Groceries.
      await save(page);
      await sheetClosed(page);
      const labels = (await labelsOf(page)).filter((l) =>
        isRowLabel(l, "Coffee"),
      );
      assert.equal(
        labels.length,
        2,
        `expected two Coffee rows, got ${labels.length}`,
      );
      assert.ok(
        labels.every((l) => l.includes("Groceries")),
        `rows: ${labels.join(" | ")}`,
      );
    },
  },
  {
    name: "Edit",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await addExpense(page, {
        amount: "450",
        title: "Coffee",
        category: "Food & Drink",
      });
      await save(page);
      await sheetClosed(page);
      await openRow(page, "Coffee");
      await expectText(page, "Coffee");
      await expectText(page, "−$450.00");
      await tapText(page, "Edit");
      await page.locator('[aria-label="Transaction type"]').waitFor();
      await page.locator('[aria-label^="Amount"]').first().tap();
      await keys(page, "<<<");
      await keys(page, "725");
      await save(page);
      await sheetClosed(page);
      await expectText(page, "−$725.00");
      await page.goBack();
      await expectText(page, "−$725");
      assert.ok(
        !(await body(page)).includes("$450"),
        "old amount still on screen",
      );
    },
  },
  {
    name: "Delete and undo",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await addExpense(page, {
        amount: "450",
        title: "Coffee",
        category: "Food & Drink",
      });
      await save(page);
      await sheetClosed(page);
      const before = await rowLabel(page, "Coffee");
      await openRow(page, "Coffee");
      await page.getByRole("button", { name: "Delete" }).last().tap();
      await expectText(page, "Undo");
      // The Quick add chip (title memory) outlives the transaction, so check the row, not the text.
      await page
        .locator(`${rowSel("Coffee")}:visible`)
        .first()
        .waitFor({ state: "detached" });
      await expectText(page, "No transactions yet");
      await tapText(page, "Undo");
      await page
        .locator(`${rowSel("Coffee")}:visible`)
        .first()
        .waitFor();
      assert.equal(
        await rowLabel(page, "Coffee"),
        before,
        "restored row differs from the original",
      );
      await openRow(page, "Coffee");
      await expectText(page, "−$450.00");
    },
  },
  {
    name: "Split",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await addFab(page).tap();
      await page.locator('[aria-label="Transaction type"]').waitFor();
      await keys(page, "1000");
      await typeTitle(page, "Market");
      await page.locator('[aria-label="Split"]').tap();
      await page.locator('[aria-label^="Line 2 amount"]').waitFor();
      await page.locator('[aria-label="Choose category for line 1"]').tap();
      await page.locator('[aria-label="Groceries"]').last().tap();
      await page.locator('[aria-label="Choose category for line 2"]').tap();
      await page.locator('[aria-label="Food & Drink"]').last().tap();
      // Line 1 holds the full amount, so the remaining is negative until the lines are balanced.
      await page.locator('[aria-label^="Line 1 amount"]').tap();
      await keys(page, "<<<<600");
      await expectText(page, "Remaining $400");
      assert.equal(
        await saveDisabled(page),
        true,
        "Save must be disabled while Remaining is not 0",
      );
      await page.locator('[aria-label^="Line 2 amount"]').tap();
      await keys(page, "300");
      await expectText(page, "Remaining $100");
      assert.equal(
        await saveDisabled(page),
        true,
        "Save must stay disabled at Remaining 100",
      );
      await keys(page, "<<<400");
      await expectText(page, "Remaining $0");
      assert.equal(
        await saveDisabled(page),
        false,
        "Save must be enabled at Remaining 0",
      );
      await save(page);
      await sheetClosed(page);
      await openRow(page, "Market");
      await expectText(page, "−$1,000.00");
      await expectText(page, "Split");
      const text = await body(page);
      assert.match(text, /Groceries\s+\$600\.00/);
      assert.match(text, /Food & Drink\s+\$400\.00/);
    },
  },
  {
    name: "Transfer",
    async run({ page, base }) {
      await seeded(page, base, "demo");
      const homeBalance = await page
        .locator('[aria-label^="Balance, "]')
        .first()
        .getAttribute("aria-label");
      // Demo accounts carry extras (people, lending), so read the starting balances instead of hard-coding them.
      const rupees = async (name) => {
        const l = (await labelsOf(page)).find(
          (x) => x.startsWith(`${name}, `) && x.endsWith(" rupees"),
        );
        assert.ok(l, `no ${name} account label`);
        return Number(
          l.match(/(-?[\d,]+(?:\.\d+)?) rupees$/)[1].replace(/,/g, ""),
        );
      };
      await page.locator('[aria-label^="Balance, "]').first().tap();
      await expectLabel(page, "HDFC Savings, Bank, ", { exact: false });
      const [hdfc0, cash0] = [
        await rupees("HDFC Savings"),
        await rupees("Cash"),
      ];
      const total0 = (await labelsOf(page)).find((x) =>
        x.startsWith("Total, "),
      );
      await page.goBack();
      await expectText(page, "Recent");
      await addFab(page).tap();
      await page.locator('[aria-label="Transaction type"]').waitFor();
      await page.getByRole("tab", { name: "Transfer" }).tap();
      await page.locator('[aria-label^="From account"]').tap();
      await page.getByText("HDFC Savings", { exact: true }).last().tap();
      await page.locator('[aria-label^="To account"]').tap();
      await page.getByText("Cash", { exact: true }).last().tap();
      await expectLabel(page, "From account, HDFC Savings");
      await expectLabel(page, "To account, Cash");
      await keys(page, "5000");
      await save(page);
      await sheetClosed(page);
      assert.equal(
        await page
          .locator('[aria-label^="Balance, "]')
          .first()
          .getAttribute("aria-label"),
        homeBalance,
        "Home total changed after a transfer",
      );
      await page.locator('[aria-label^="Balance, "]').first().tap();
      await expectLabel(page, "HDFC Savings, Bank, ", { exact: false });
      assert.equal(
        await rupees("HDFC Savings"),
        hdfc0 - 5000,
        "source account should drop by exactly the transfer",
      );
      assert.equal(
        await rupees("Cash"),
        cash0 + 5000,
        "destination account should rise by exactly the transfer",
      );
      assert.equal(
        (await labelsOf(page)).find((x) => x.startsWith("Total, ")),
        total0,
        "Total changed after a transfer",
      );
    },
  },
  {
    name: "Search",
    async run({ page, base }) {
      await seeded(page, base, "demo");
      await tabTo(page, "Activity");
      await page.locator('[aria-label="Search"]:visible').tap();
      const input = page.locator('input[aria-label="Search"]');
      await input.fill("swiggy");
      await page.locator('[aria-label^="Swiggy, "]:visible').first().waitFor();
      let rows = await labelsOf(page);
      assert.ok(
        rows.some((l) => l.startsWith("Swiggy, ")),
        "no Swiggy result",
      );
      assert.ok(
        !rows.some((l) => l.startsWith("Rent, ")),
        "unrelated Rent row in swiggy results",
      );
      // Amount query: Rent is 32,000 in the demo data.
      await input.fill("32000");
      await page.locator('[aria-label^="Rent, "]:visible').first().waitFor();
      rows = await labelsOf(page);
      assert.ok(
        !rows.some((l) => l.startsWith("Swiggy, ")),
        "Swiggy row in a 32000 query",
      );
      await input.fill("zzzz");
      await expectNoText(page, "Rent");
      await expectText(page, "No matches");
    },
  },
  {
    name: "Activity filters",
    async run({ page, base }) {
      await seeded(page, base, "demo");
      await tabTo(page, "Activity");
      await expectLabel(page, "Earned ₹1,45,000");
      await expectLabel(page, "Spent ₹47,804");
      const all = await labelsOf(page);
      assert.ok(
        all.some((l) => /Salary, /.test(l)),
        "demo data should include a Salary row",
      );
      await page.locator('[aria-label="Filters"]:visible').tap();
      await page.getByText("Expense", { exact: true }).last().tap();
      await tapText(page, "Done");
      // The summary hides Earned when the type filter excludes income.
      await expectLabel(page, "Spent ₹47,804");
      await page
        .locator('[aria-label^="Earned "]:visible')
        .first()
        .waitFor({ state: "detached" });
      const filtered = await labelsOf(page);
      assert.ok(
        !filtered.some(
          (l) => /, plus [\d,.]+ rupees/.test(l) && !l.startsWith("Earned"),
        ),
        "income row visible under Expense filter",
      );
      assert.ok(
        filtered.some((l) => l.startsWith("Swiggy, ")),
        "expense rows should remain",
      );
      assert.ok(
        !filtered.some((l) => l.startsWith("Salary, ")),
        "Salary visible under Expense filter",
      );
      await page
        .locator("[role=button]:visible", { hasText: /^Clear$/ })
        .first()
        .tap();
      await expectLabel(page, "Earned ₹1,45,000");
      assert.ok(
        (await labelsOf(page)).some((l) => l.startsWith("Salary, ")),
        "Salary should return after Clear",
      );
    },
  },
  {
    name: "Insights",
    async run({ page, base }) {
      await seeded(page, base, "demo");
      await tabTo(page, "Insights");
      await expectText(page, "₹47,804");
      // Both is the default: Spent and Earned side by side with the net under them.
      await expectLabel(page, "Spent, ", { exact: false });
      await expectLabel(page, "Earned, ", { exact: false });
      await expectText(page, "Net");
      await expectLabel(page, "Spending by category: Housing 69%", {
        exact: false,
      });
      await expectLabel(page, "Housing, ₹33,200, 69%");
      await page
        .locator('[aria-label="Housing, 33,200 rupees, 69 percent"]:visible')
        .tap();
      await expectText(page, "Average per");
      await expectText(page, "₹33,200");
      assert.match(page.url(), /\/category\//);
      const rows = (await labelsOf(page)).filter((l) =>
        /^(Rent|House help), /.test(l),
      );
      assert.equal(
        rows.length,
        2,
        `expected Rent and House help rows, got ${rows.join(" | ")}`,
      );
    },
  },
  {
    name: "Budget",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await addExpense(page, {
        amount: "450",
        title: "Veg",
        category: "Groceries",
      });
      await save(page);
      await sheetClosed(page);
      await tabTo(page, "Budgets");
      await expectText(page, "No budgets");
      await tapText(page, "Add budget");
      await page.locator('[aria-label="Period"]').waitFor();
      await keys(page, "2000");
      await page
        .locator("[role=button]:visible", { hasText: /^Categories/ })
        .first()
        .tap();
      await page.locator('[aria-label="Groceries"]:visible').last().tap();
      // The sheet stays open after a pick until Done.
      await page.waitForTimeout(500);
      assert.ok(
        await page.locator('[aria-label="Done"]:visible').first().isVisible(),
        "category sheet must stay open after the first pick",
      );
      await page.locator('[aria-label="Done"]:visible').first().tap();
      await page
        .locator('[aria-label="Done"]:visible')
        .first()
        .waitFor({ state: "detached" });
      await page.locator('[aria-label="Save"]:visible').first().tap();
      const row = page
        .locator('[aria-label^="Groceries, "][aria-label*=" of "]:visible')
        .last();
      await row.waitFor();
      assert.equal(
        await row.getAttribute("aria-label"),
        "Groceries, 450 US dollars of 2,000 US dollars, 1,550 US dollars left",
      );
      await expectText(page, "$450 of $2,000");
      // The fill animates; wait for it to settle at 450/2000 = 22.5%.
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("[role=progressbar] > div")].some(
            (e) => Math.abs(parseFloat(e.style.width) - 22.5) < 0.2,
          ),
        null,
        { timeout: 10000 },
      );
      // Delete from the edit sheet, then undo.
      await row.tap();
      await tapText(page, "Edit");
      await tapText(page, "Delete budget");
      await expectText(page, "No budgets");
      await expectText(page, "Undo");
      await tapText(page, "Undo");
      await page
        .locator('[aria-label^="Groceries, "][aria-label*=" of "]:visible')
        .last()
        .waitFor();
      await expectText(page, "$450 of $2,000");
    },
  },
  {
    name: "Recurring",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await addExpense(page, {
        amount: "999",
        title: "Gym",
        category: "Health",
      });
      await page.locator('[aria-label^="Repeat, "]').tap();
      await tapText(page, "Monthly");
      await expectLabel(page, "Repeat, Monthly");
      await save(page);
      await sheetClosed(page);
      // Nothing links to /recurring until a rule is due within a week, so navigate by URL (client side, keeps the in-memory db).
      await goClient(page, "/recurring");
      await expectText(page, "Rules");
      await expectText(page, "Monthly ·");
      await page.locator('[aria-label^="Gym, Monthly"]:visible').first().tap();
      await expectText(page, "Edit rule");
      const due = await page.locator("input[type=date]").first().inputValue();
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const last = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        0,
      ).getDate();
      target.setDate(Math.min(now.getDate(), last));
      const pad = (n) => String(n).padStart(2, "0");
      assert.equal(
        due,
        `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`,
        "next due should be one month after the first transaction",
      );
    },
  },
  {
    name: "Account and rate",
    async run({ page, base }) {
      await open(page, base, "/");
      await expectText(page, "Set up");
      await tapText(page, "Currency");
      await page.locator('[aria-label="Search currencies"]').fill("EUR");
      await page.locator('[aria-label^="EUR"]').first().tap();
      await tap(page, "Start");
      await expectText(page, "No transactions yet");
      // The Balance strip only exists once there is a transaction: log a €10 expense so Home shows it.
      await addExpense(page, {
        amount: "10",
        title: "Tea",
        category: "Food & Drink",
      });
      await save(page);
      await sheetClosed(page);
      await expectLabel(page, "Balance, −€10");
      await page.locator('[aria-label^="Balance, "]:visible').first().tap();
      await page.locator('[aria-label="Add account"]:visible').tap();
      await page.locator('[aria-label="Name"]').waitFor();
      await page.locator('[aria-label="Name"]').fill("Dollars");
      await page.locator('[aria-label="Name"]').press("Enter");
      await tapText(page, "Currency");
      await page.locator('[aria-label="Search currencies"]').fill("USD");
      await page.locator('[aria-label^="USD"]').first().tap();
      await page.locator('[aria-label^="Opening balance"]').tap();
      await keys(page, "100");
      // A foreign account needs a rate (Rate row); Save stays disabled until one is entered.
      await expectLabel(page, "Rate, 1 USD equals … EUR");
      assert.equal(
        await saveDisabled(page),
        true,
        "Save must be disabled without a rate",
      );
      await page.locator('[aria-label^="Rate, "]').tap();
      await keys(page, "0.9");
      await expectLabel(page, "Rate, 1 USD equals 0.9", { exact: false });
      assert.equal(
        await saveDisabled(page),
        false,
        "Save must be enabled once a rate is set",
      );
      await save(page);
      await expectLabel(page, "Dollars, Bank, 100 US dollars", {
        exact: false,
      }).catch(async () => {
        throw new Error(
          `USD account missing on /accounts: ${(await labelsOf(page)).join(" | ")}`,
        );
      });
      await expectLabel(page, "Total, 80 euros");
      await goClient(page, "/");
      await expectLabel(page, "Balance, €80");
      // The rate lives in Settings > Currency too: changing it re-converts the total.
      await goClient(page, "/settings/currency");
      await expectText(page, "Exchange rates");
      const rate = page.locator('input[aria-label="USD to EUR rate"]');
      assert.equal(
        Number(await rate.inputValue()),
        0.9,
        "rate saved from the account form",
      );
      await rate.fill("0.5");
      await rate.press("Enter");
      await rate.blur();
      await goClient(page, "/");
      await expectLabel(page, "Balance, €40");
    },
  },
  {
    name: "Category",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await goClient(page, "/settings/categories");
      await expectText(page, "Categories");
      await page.locator('[aria-label="Add category"]:visible').tap();
      await page.locator('[aria-label="Name"]').fill("Pets");
      await page.locator('[aria-label="Save"]:visible').first().tap();
      await expectText(page, "Pets");
      // The new category is selectable in the add sheet (via the All grid) and saves.
      await goClient(page, "/");
      await addExpense(page, {
        amount: "300",
        title: "Chew toy",
        category: null,
      });
      await page.locator('[aria-label="All categories"]').tap();
      await page.locator('[aria-label="Pets"]:visible').last().tap();
      await save(page);
      await sheetClosed(page);
      assert.ok(
        (await rowLabel(page, "Chew toy")).includes("Pets"),
        "transaction should be in Pets",
      );
      // Delete the category by swiping its row, moving its transactions to Other.
      await goClient(page, "/settings/categories");
      const row = page.getByText("Pets", { exact: true }).last();
      await row.scrollIntoViewIfNeeded();
      await swipeLeft(page, row);
      await expectText(page, "Move transactions to…");
      await page.getByText("Other", { exact: true }).last().tap();
      await expectNoText(page, "Pets");
      await goClient(page, "/");
      assert.ok(
        (await rowLabel(page, "Chew toy")).includes("Other"),
        "transaction should have moved to Other",
      );
    },
  },
  {
    name: "Settings",
    async run({ page, base }) {
      await seeded(page, base, "demo");
      const bg = () =>
        page.evaluate(
          () =>
            getComputedStyle(document.querySelector(".bg-bg")).backgroundColor,
        );
      assert.equal(
        await bg(),
        "rgb(245, 243, 239)",
        "light theme expected before the change",
      );
      // Pick a Recent row amount from the data (the demo rows move with the clock), e.g. "−₹1,042".
      const amount = (await body(page)).match(/−₹[\d,]+(?!\.)/)?.[0];
      assert.ok(
        amount,
        "Home should list a Recent row with a whole-rupee amount",
      );
      assert.ok(
        !(await body(page)).includes(`${amount}.00`),
        "decimals should be off by default",
      );
      await page.locator('[aria-label="Settings"]:visible').tap();
      await expectText(page, "Show decimals");
      await tapText(page, "Theme");
      await tapText(page, "Dark");
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".bg-bg")).backgroundColor !==
          "rgb(245, 243, 239)",
        null,
        { timeout: 15000 },
      );
      const dark = await bg();
      assert.notEqual(dark, "rgb(245, 243, 239)");
      await page.goBack();
      await expectText(page, "Show decimals");
      await page
        .locator('input[aria-label="Show decimals"]')
        .dispatchEvent("click");
      await page.goBack();
      await expectText(page, `${amount}.00`);
      assert.match(await body(page), /−₹32,000\.00/);
      assert.equal(
        await page.evaluate(
          () =>
            getComputedStyle(document.querySelector(".bg-bg")).backgroundColor,
        ),
        dark,
        "theme should persist",
      );
    },
  },
  {
    name: "Export and import",
    async run({ page, base, freshPage }) {
      // Install A: demo data, export everything to CSV through the web download fallback.
      const exportAll = async (p) => {
        await goClient(p, "/settings/transfer");
        await expectText(p, "Export CSV");
        await p.getByRole("tab", { name: "All" }).tap();
        const [download] = await Promise.all([
          p.waitForEvent("download", { timeout: 60000 }),
          tapText(p, "Export CSV"),
        ]);
        const path = await download.path();
        return readFileSync(path, "utf8");
      };
      await seeded(page, base, "demo");
      const csvA = await exportAll(page);
      const rowsOfA = parseCsv(csvA);
      const [header, ...dataA] = rowsOfA;
      const idCol = header.indexOf("id");
      assert.ok(idCol >= 0, `export has no id column: ${header.join(",")}`);
      assert.ok(
        header.includes("tags") && header.includes("person"),
        "export should carry tags and person columns",
      );
      assert.ok(
        dataA.length > 100,
        `demo export looks too small: ${dataA.length} rows`,
      );
      assert.ok(
        dataA.every((r) => r.length === header.length),
        "every export row should have one field per column",
      );
      // The demo extras (lending, tags) must be in the export, or the round trip proves less.
      assert.ok(
        dataA.some((r) => r[header.indexOf("tags")] !== ""),
        "demo export should include tagged rows",
      );
      assert.ok(
        dataA.some((r) => r[header.indexOf("person")] !== ""),
        "demo export should include lending rows",
      );
      // A split transaction exports one row per line, so count distinct ids.
      const rowsA = new Set(dataA.map((r) => r[idCol])).size;

      // Install B: empty database, import that file with the native preset through the file chooser.
      // (An existing account is matched by name and its currency wins, so B is onboarded in INR like the demo "Cash".)
      const b = await freshPage();
      await onboard(b, base, "INR");
      await goClient(b, "/settings/transfer");
      await expectText(b, "Finance CSV");
      const [chooser] = await Promise.all([
        b.waitForEvent("filechooser", { timeout: 30000 }),
        tapText(b, "Finance CSV"),
      ]);
      await chooser.setFiles({
        name: "farthing.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csvA),
      });
      await expectText(b, `${rowsA} transactions`);
      await b.getByRole("button", { name: "Import", exact: true }).last().tap();
      await expectText(b, "Imported");
      // Round trip: exporting B reproduces A (same rows, order aside).
      const csvB = await exportAll(b);
      const dataB = parseCsv(csvB).slice(1);
      assert.equal(
        new Set(dataB.map((r) => r[idCol])).size,
        rowsA,
        "transaction count after import differs from the export",
      );
      assert.equal(
        dataB.length,
        dataA.length,
        "exported row count differs after the round trip",
      );
      // Ids are regenerated on import, so compare every other column.
      const strip = (r) => JSON.stringify(r.filter((_, i) => i !== idCol));
      const setA = new Set(dataA.map(strip));
      const setB = new Set(dataB.map(strip));
      const onlyA = [...setA].filter((l) => !setB.has(l));
      const onlyB = [...setB].filter((l) => !setA.has(l));
      assert.ok(
        onlyA.length === 0 && onlyB.length === 0,
        `round trip differs (${onlyA.length} rows): A has ${onlyA.slice(0, 2).join(" || ")} but B has ${onlyB.slice(0, 2).join(" || ")}`,
      );
    },
  },
  {
    name: "Erase all data",
    async run({ page, base }) {
      await seeded(page, base, "demo");
      await page.locator('[aria-label="Settings"]:visible').tap();
      await expectText(page, "Import & export");
      await tapText(page, "Import & export");
      await expectText(page, "Erase all data");
      const dialogs = [];
      page.on("dialog", (d) => {
        dialogs.push(d.message());
        void d.accept();
      });
      await tapText(page, "Erase all data");
      await expectText(page, "Set up");
      assert.equal(
        dialogs.length,
        2,
        `expected two confirmations, got ${dialogs.length}`,
      );
      // Everything is gone: finishing onboarding leaves an empty ledger.
      await tap(page, "Start");
      await expectText(page, "No transactions yet");
      assert.ok(
        !(await body(page)).includes("Swiggy"),
        "demo data survived the erase",
      );
    },
  },
  {
    name: "Swipe delete and undo",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      for (const [title, amount] of [
        ["Coffee", "450"],
        ["Tea", "120"],
      ]) {
        await addExpense(page, { amount, title, category: "Food & Drink" });
        await save(page);
        await sheetClosed(page);
      }
      // Half swipe reveals Delete (and must not trigger Duplicate); tapping it deletes.
      const coffeeRows = () =>
        page.locator(`${rowSel("Coffee")}:visible`).first();
      const teaRows = () => page.locator(`${rowSel("Tea")}:visible`).first();
      const coffee = coffeeRows();
      await swipeLeft(page, coffee, { from: 365, to: 250 });
      await page.waitForTimeout(600);
      assert.equal(
        new URL(page.url()).pathname,
        "/",
        "a half swipe must not navigate",
      );
      const box = await coffee.boundingBox();
      const buttons = page.getByRole("button", { name: "Delete" });
      for (let i = 0, n = await buttons.count(); i < n; i++) {
        const b = await buttons.nth(i).boundingBox();
        if (
          b &&
          b.width > 0 &&
          Math.abs(b.y + b.height / 2 - (box.y + box.height / 2)) <
            box.height / 2
        ) {
          await buttons.nth(i).tap();
          break;
        }
      }
      await expectText(page, "Undo");
      await coffeeRows().waitFor({ state: "detached" });
      await tapText(page, "Undo");
      await coffeeRows().waitFor();
      // A full swipe deletes without a tap.
      const tea = teaRows();
      await swipeLeft(page, tea);
      await teaRows().waitFor({ state: "detached" });
      await expectText(page, "Undo");
      await tapText(page, "Undo");
      await teaRows().waitFor();
    },
  },
  {
    name: "Swipe duplicate",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await addExpense(page, {
        amount: "450",
        title: "Coffee",
        category: "Food & Drink",
      });
      await save(page);
      await sheetClosed(page);
      const row = page.locator(`${rowSel("Coffee")}:visible`).first();
      await swipeLeft(page, row, { from: 30, to: 300 });
      await page.locator('[aria-label="Transaction type"]').waitFor();
      assert.equal(
        await page.locator('[aria-label="Title"]').inputValue(),
        "Coffee",
      );
      await save(page);
      await sheetClosed(page);
      const rows = (await labelsOf(page)).filter((l) =>
        isRowLabel(l, "Coffee"),
      );
      assert.equal(
        rows.length,
        2,
        `expected the original and the duplicate, got ${rows.length}`,
      );
    },
  },
  {
    name: "Upcoming post and skip",
    async run({ page, base }) {
      await seeded(page, base, "empty");
      await addExpense(page, {
        amount: "100",
        title: "Paper",
        category: "Bills",
      });
      await page.locator('[aria-label^="Repeat, "]').tap();
      await tapText(page, "Daily");
      await save(page);
      await sheetClosed(page);
      // Home surfaces the next bill under "Coming up"; the swipe actions live on the Recurring screen.
      await expectText(page, "Coming up");
      await expectLabel(page, "Paper, Tomorrow, $100");
      await goClient(page, "/recurring");
      await expectText(page, "Rules");
      const due = () =>
        page
          .locator('[aria-label^="Paper, "][aria-label*="due"]:visible')
          .first();
      // Posted transactions are counted on Home (Recent); the occurrences live on Recurring.
      const rowsOf = async () => {
        await goClient(page, "/");
        await expectText(page, "Recent");
        await page.waitForTimeout(500);
        const n = (await labelsOf(page)).filter((l) =>
          isRowLabel(l, "Paper"),
        ).length;
        await goClient(page, "/recurring");
        await due().waitFor();
        return n;
      };
      await due().waitFor();
      assert.equal(await rowsOf(), 1);
      const firstDue = await due().getAttribute("aria-label");
      // Swipe right: Post now creates a transaction and the next occurrence moves on.
      await swipeLeft(page, due(), { from: 30, to: 300 });
      await expectText(page, "Posted");
      assert.equal(
        await rowsOf(),
        2,
        "Post now should add a Paper transaction",
      );
      const secondDue = await due().getAttribute("aria-label");
      assert.notEqual(
        secondDue,
        firstDue,
        "next due date should advance after posting",
      );
      // Swipe left: Skip advances the due date without a transaction.
      await swipeLeft(page, due());
      await expectText(page, "Skipped");
      await page.waitForFunction(
        (prev) => {
          const el = [
            ...document.querySelectorAll('[aria-label^="Paper, "]'),
          ].find((e) => e.getAttribute("aria-label").includes(", due "));
          return el && el.getAttribute("aria-label") !== prev;
        },
        secondDue,
        { timeout: 15000 },
      );
      assert.equal(await rowsOf(), 2, "Skip must not add a transaction");
    },
  },
  {
    name: "Quick add",
    async run({ page, base }) {
      await seeded(page, base, "demo");
      // The section label renders uppercase through a text transform, so match it case-insensitively.
      assert.match(await body(page), /quick add/i);
      const chip = page.locator('[aria-label="Add Uber"]:visible').first();
      await chip.tap();
      await page.locator('[aria-label="Transaction type"]').waitFor();
      // The sheet is prefilled from the chip (title, category, account); the amount is typed on the ready keypad.
      assert.equal(
        await page.locator('[aria-label="Title"]').inputValue(),
        "Uber",
      );
      await expectLabel(page, "Transport");
      assert.equal(
        await saveDisabled(page),
        true,
        "Save must wait for an amount",
      );
      await keys(page, "404");
      assert.equal(
        await saveDisabled(page),
        false,
        "a prefilled sheet with an amount should be ready to save",
      );
      await save(page);
      await sheetClosed(page);
      // The new row appears in Recent (Home shows five), carrying the chip's title and the typed amount.
      const row = page.locator(`${rowSel("Uber")}:visible`).first();
      await row.waitFor();
      const text = await row.getAttribute("aria-label");
      assert.match(
        text,
        /^Uber, Transport, .*minus 404 rupees/,
        `unexpected row: ${text}`,
      );
      // Demo data has a row later today, so the new one is not necessarily first: it must be within the five shown.
      const recent = (await labelsOf(page)).filter(
        (l) => /, (minus|plus) /.test(l) && !l.includes(", due "),
      );
      assert.equal(
        recent.length,
        5,
        `Recent shows five rows: ${recent.join(" | ")}`,
      );
      assert.equal(recent.filter((l) => l.startsWith("Uber, ")).length, 1);
    },
  },
  {
    name: "Settings to Recurring",
    async run({ page, base }) {
      await seeded(page, base, "demo");
      await page.locator('[aria-label="Settings"]:visible').tap();
      await expectText(page, "Show decimals");
      await tapText(page, "Recurring");
      await page.waitForFunction(
        () => location.pathname === "/recurring",
        null,
        { timeout: 15000 },
      );
      await expectText(page, "Rules");
    },
  },
  {
    name: "Monthly report and calendar",
    async run({ page, base }) {
      const name = (offset) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() + offset);
        return d.toLocaleString("en-US", { month: "long" });
      };
      await open(page, base, "/report/last?seed=demo");
      await expectText(page, "Spending by category");
      await expectText(page, `Spent in ${name(-1)}`);
      await tap(page, "Previous month");
      await expectText(page, `Spent in ${name(-2)}`);
      await tap(page, "Next month");
      await expectText(page, `Spent in ${name(-1)}`);
      await tapText(page, "Calendar");
      await expectText(page, "Current streak");
      await expectText(page, "Best streak");
    },
  },
  {
    name: "Year in review and share",
    async run({ page, base }) {
      await open(page, base, "/review/now?seed=demo");
      await expectText(page, "Year in review");
      await tap(page, "Next card", { last: false });
      await expectText(page, "In and out");
      await page.locator('[aria-label="Share"]:visible').first().tap();
      await expectText(page, "Hide amounts");
      await expectText(page, "Share image");
    },
  },
];
